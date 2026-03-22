const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── ROOMS ───
const rooms = {};

function createRoom(code) {
  return rooms[code] = {
    code, phase: 'lobby', round: 1,
    security: 70, secHistory: [70],
    teams: [], investments: {},
    readyTeams: new Set(),
    wealthHistory: [], hostId: null,
  };
}

function computeROIs(t) {
  return {
    oil:      t.oil      > 250 ? -0.30 : t.oil      > 100 ? 0.08 : 0.25,
    industry: t.industry > 300 ?  0.03 : t.industry > 150 ? 0.07 : 0.12,
    assets:   t.assets   > 350 ? -0.20 : t.assets   > 150 ? 0.06 : 0.18,
  };
}

function calcRound(room) {
  const totals = {oil:0,industry:0,assets:0,defense:0,reserve:0};
  room.teams.forEach(t => {
    const inv = room.investments[t.id] || {oil:40,industry:40,assets:40,defense:40,reserve:40};
    Object.keys(totals).forEach(s => totals[s] += inv[s]);
  });

  const rois = computeROIs(totals);
  const terror = totals.defense < 200;
  const terrorList = [];

  room.teams.forEach(t => {
    const inv = room.investments[t.id] || {oil:40,industry:40,assets:40,defense:40,reserve:40};
    let delta = inv.oil*rois.oil + inv.industry*rois.industry + inv.assets*rois.assets + inv.reserve*0.02;
    let penalty = 0;
    if (terror) {
      const s = room.security;
      penalty = s<40 ? t.wealth*.15 : s<60 ? t.wealth*.08 : t.wealth*.03;
      if (inv.reserve >= 40) penalty *= .6;
      else if (inv.reserve >= 20) penalty *= .8;
      penalty = Math.round(penalty);
      terrorList.push({id:t.id, name:t.name, penalty});
      t.trust = Math.max(0, t.trust - (s<40?10:s<60?6:3));
    }
    t.wealth = Math.max(0, Math.round(t.wealth + delta - penalty));
  });

  room.security = Math.max(0, Math.min(100, room.security - 3 + totals.defense*.2/room.teams.length));
  room.secHistory.push(Math.round(room.security));
  room.teams.forEach(t => {
    const h = room.wealthHistory.find(w => w.id===t.id);
    if (h) h.data.push(t.wealth);
  });

  return { rois, totals, terror, terrorList, teams: room.teams.map(t=>({id:t.id,wealth:t.wealth,trust:t.trust})) };
}

// ─── SOCKET ───
io.on('connection', socket => {
  console.log('🔌', socket.id);

  socket.on('host:create', ({teams}) => {
    const code = Math.random().toString(36).substr(2,4).toUpperCase();
    const room = createRoom(code);
    room.hostId = socket.id;
    room.teams = teams.map((t,i) => ({id:i, name:t.name, color:t.color, emoji:t.emoji, wealth:200, trust:80}));
    room.wealthHistory = room.teams.map(t=>({id:t.id, name:t.name, color:t.color, data:[200]}));
    room.phase = 'invest';
    socket.join(code);
    socket.roomCode = code;
    socket.isHost = true;
    socket.emit('host:created', {code, teams:room.teams, round:1, security:70});
    console.log('🏠 Room:', code);
  });

  socket.on('player:join', ({code, teamId, playerName}) => {
    const room = rooms[code];
    if (!room) { socket.emit('error',{msg:'Бөлме табылмады!'}); return; }
    socket.join(code);
    socket.roomCode = code;
    socket.teamId = teamId;
    socket.playerName = playerName;
    socket.isHost = false;
    socket.emit('player:joined', {
      teams: room.teams, round: room.round,
      security: room.security, phase: room.phase,
      myWealth: room.teams[teamId]?.wealth || 200,
    });
    io.to(room.hostId).emit('host:player_joined', {teamId, playerName});
  });

  socket.on('host:start_round', () => {
    const room = rooms[socket.roomCode];
    if (!room || !socket.isHost) return;
    room.investments = {};
    room.readyTeams = new Set();
    room.phase = 'invest';
    io.to(room.code).emit('round:start', {
      round: room.round, security: room.security,
      teams: room.teams.map(t=>({id:t.id,wealth:t.wealth}))
    });
  });

  socket.on('player:invest', ({invest}) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    if (Object.values(invest).reduce((s,v)=>s+v,0) > 200) {
      socket.emit('error',{msg:'Бюджет асып кетті!'}); return;
    }
    room.investments[socket.teamId] = invest;
    room.readyTeams.add(socket.teamId);
    io.to(room.hostId).emit('host:team_ready', {
      teamId: socket.teamId, invest,
      readyCount: room.readyTeams.size,
      totalTeams: room.teams.length,
    });
    socket.emit('invest:confirmed');
  });

  socket.on('host:reveal', () => {
    const room = rooms[socket.roomCode];
    if (!room || !socket.isHost) return;
    room.phase = 'reveal';
    const result = calcRound(room);
    io.to(room.code).emit('round:result', {
      ...result, round: room.round,
      security: room.security,
      secHistory: room.secHistory,
      wealthHistory: room.wealthHistory,
    });
  });

  socket.on('host:next_round', () => {
    const room = rooms[socket.roomCode];
    if (!room || !socket.isHost) return;
    if (room.round >= 5) {
      room.phase = 'final';
      const sorted = [...room.teams]
        .map(t=>({...t, score: Math.round(t.wealth+t.trust*4)+(t.trust<30?-50:0)}))
        .sort((a,b)=>b.score-a.score);
      io.to(room.code).emit('game:final', {sorted, wealthHistory: room.wealthHistory});
    } else {
      room.round++;
      room.investments = {};
      room.readyTeams = new Set();
      io.to(room.code).emit('round:start', {
        round: room.round, security: room.security,
        teams: room.teams.map(t=>({id:t.id,wealth:t.wealth}))
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 EcoWars on port ${PORT}`));
