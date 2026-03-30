# CityFix — Render Deployment Guide

## Project Structure
```
cityfix/
├── backend/          ← Node.js + Express server
│   ├── server.js     ← Entry point
│   ├── package.json
│   ├── .env.example  ← Copy this to .env with real values
│   └── ...
└── frontend/         ← Static HTML/CSS/JS (served by backend)
```

## Render Settings
| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | Free |

## Environment Variables (add in Render dashboard)
Copy values from your `.env` file:
- MONGO_URI
- PORT = 5000
- GEMINI_API_KEY
- CLIENT_URL = https://your-app-name.onrender.com
- EMAIL_USER
- EMAIL_PASS
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
