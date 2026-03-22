# 🎮 EcoWars — Multiplayer Server

## 📁 Файлдар құрылымы
```
ecowars-server/
├── server.js          ← Node.js + Socket.io сервері
├── package.json       ← npm конфигурациясы
└── public/
    ├── index.html     ← Басты бет (Host/Player таңдауы)
    ├── host.html      ← HOST экраны (проектор/ноутбук)
    └── player.html    ← PLAYER экраны (телефон)
```

---

## ☁️ Render.com-ға deploy (ТЕГІН)

### 1-қадам: GitHub-қа жүктеу
1. [github.com](https://github.com) → New repository → `ecowars`
2. Барлық файлдарды upload жасаңыз

### 2-қадам: Render.com
1. [render.com](https://render.com) → Sign up (тегін)
2. **New** → **Web Service**
3. GitHub репозиторийіңізді таңдаңыз
4. Параметрлер:
   - **Name:** `ecowars`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. **Deploy** басыңыз

### 3-қадам: URL алыңыз
Render сізге URL береді: `https://ecowars-xxxx.onrender.com`

---

## 🎮 Ойын ойнау

### HOST (ноутбук/проектор):
```
https://ecowars-xxxx.onrender.com/host.html
```

### PLAYER (телефон):
```
https://ecowars-xxxx.onrender.com/player.html
```

### Процесс:
1. HOST → Команда атауларын енгіз → **БӨЛМЕ АШУ**
2. 4 таңбалы КОД пайда болады (мысалы: `K7XQ`)
3. Барлық ойыншылар Player бетін ашып, URL + кодты енгізеді
4. HOST → **ОЙЫНДЫ БАСТАУ**
5. Раунд сайын телефоннан инвестиция жасайды
6. HOST **НӘТИЖЕЛЕРДІ АШУ** басады

---

## 🛠 Локалды іске қосу (тест үшін)

```bash
npm install
node server.js
```
Браузерде: `http://localhost:3000`

---

## ⚠️ Ескерту
Render Free tier 15 минут белсенсіз болса ұйықтайды.
Алғашқы кіруде 30-60 секунд күту керек.
