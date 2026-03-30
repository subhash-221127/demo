# CityFix — Render Deployment Guide

## Project Structure
```
demo/
├── backend/          ← Node.js + Express server (root for Render)
│   ├── server.js     ← Entry point
│   ├── package.json
│   ├── .env.example  ← Copy this and fill in real values (never commit .env!)
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
Set ALL of these in the Render → Environment tab. Do NOT set PORT — Render manages it automatically.

| Variable | Value |
|---|---|
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | A long random string (run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `GEMINI_API_KEY` | Your Gemini API key |
| `CLIENT_URL` | `https://your-app-name.onrender.com` (your actual Render URL) |
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Your Gmail App Password |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |

> ⚠️ Do NOT add `PORT` — Render injects it automatically.

## MongoDB Atlas Setup
Make sure your MongoDB Atlas cluster allows connections from anywhere (IP whitelist: `0.0.0.0/0`) since Render uses dynamic IPs.

## After Deploy
Update `CLIENT_URL` in Render env vars to your actual Render URL, then redeploy.
