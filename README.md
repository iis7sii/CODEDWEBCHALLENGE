# Learnr — Personal Learning Dashboard

A full-stack web app to track courses, goals, streaks, and weekly study activity — with a built-in **AI Tutor** powered by OpenRouter.

![Status](https://img.shields.io/badge/status-live-brightgreen) ![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js) ![SQLite](https://img.shields.io/badge/database-SQLite-003B57?logo=sqlite) ![OpenRouter](https://img.shields.io/badge/AI-OpenRouter-6366f1)

---

## 🌐 Live Links

| | URL |
|--|--|
| **Frontend (Vercel)** | [https://codedwebchallenge.vercel.app](https://codedwebchallenge.vercel.app) |
| **Backend (Railway)** | `https://your-backend.up.railway.app` |

> Replace with your actual URLs after deployment.

---

## ✨ Features

- 🔐 **Auth** — Register / Login with JWT, auto session restore
- 📊 **Dashboard** — Streak banner, metrics, weekly activity bar chart
- 📚 **Courses** — Add, track progress, pause/complete courses
- 🎯 **Goals** — Set targets with deadlines and track completion
- 📈 **Stats** — Total hours, heatmap, completion rate
- 🤖 **AI Tutor** — Chat with an AI that knows your courses and goals (OpenRouter / Llama 3.1 free)
- 🗄️ **SQLite Database** — All data persisted per user on the backend

---

## 🗂 Project Structure

```
learnr/
├── frontend/
│   ├── index.html       ← Full SPA (HTML + CSS + JS)
│   └── vercel.json      ← Vercel deploy config
├── backend/
│   ├── server.js        ← Express REST API + OpenRouter AI
│   ├── package.json
│   ├── railway.toml     ← Railway deploy config
│   └── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 Local Development

### 1. Clone
```bash
git clone https://github.com/YOUR_USERNAME/learnr-dashboard.git
cd learnr-dashboard
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env      # then edit .env with your values
npm start
# → http://localhost:3001
```

### 3. Frontend
```bash
# No build needed — just open in browser:
open frontend/index.html

# Or use live-server:
npx live-server frontend
# → http://localhost:5500
```

### 4. Demo account
```
Email:    demo@learnr.app
Password: demo123
```

---

## ☁️ Deployment

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/learnr-dashboard.git
git push -u origin main
```

---

### Step 2 — Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your repo → set **Root Directory** to `backend`
3. Railway auto-detects Node.js and runs `npm start`
4. Go to **Variables** tab and add:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | A long random string (see below) |
| `OPENROUTER_API_KEY` | Your key from openrouter.ai/keys |
| `FRONTEND_URL` | Your Vercel URL (add after Step 3) |

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

5. Go to **Settings → Networking** → click **Generate Domain**
6. Copy your Railway URL → looks like [https://codedwebchallenge-production.up.railway.app](https://codedwebchallenge-production.up.railway.app)

---

### Step 3 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework preset: **Other**
4. Click **Deploy**
5. Copy your Vercel URL → looks like [https://codedwebchallenge.vercel.app](https://codedwebchallenge.vercel.app)

**Update the Railway URL in your frontend:**

Open `frontend/index.html`, find line:
```js
const RAILWAY_URL = 'https://codedwebchallenge-production.up.railway.app';
```
Replace with your actual Railway URL, commit and push — Vercel auto-redeploys.

**Update FRONTEND_URL in Railway:**
Go back to Railway → Variables → set `FRONTEND_URL` to your Vercel URL.

---

### Step 4 — Get your OpenRouter API Key

1. Go to [openrouter.ai](https://openrouter.ai) → Sign up (free)
2. Go to [openrouter.ai/keys](https://openrouter.ai/keys) → **Create Key**
3. Copy the key → paste into Railway as `OPENROUTER_API_KEY`

The app uses **`meta-llama/llama-3.1-8b-instruct:free`** — completely free, no credits needed.

---

## 🗄️ Database Setup

SQLite is used via `better-sqlite3`. The database file `learnr.db` is **auto-created** on first start — no setup required.

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Account info, bcrypt password, streak count |
| `courses` | Per-user course tracking with progress |
| `goals` | Learning goals with current/target values |
| `activity_log` | Daily study hours for charts and stats |
| `ai_chats` | AI conversation history per user |

The demo user (`demo@learnr.app`) is automatically seeded with sample data.

---

## 🔌 API Reference

### Auth
```
POST /api/auth/register   { name, email, password }
POST /api/auth/login      { email, password }
GET  /api/auth/me         → current user
```

### Courses
```
GET    /api/courses
POST   /api/courses       { name, platform, total_hrs, progress, status, emoji, color }
PUT    /api/courses/:id
DELETE /api/courses/:id
```

### Goals
```
GET    /api/goals
POST   /api/goals         { name, current, target, deadline, emoji, color }
DELETE /api/goals/:id
```

### Activity & Stats
```
GET  /api/activity/week
POST /api/activity/log    { hours }
GET  /api/stats
```

### AI Tutor
```
POST /api/ai/chat         { message, history[] }  → { reply }
GET  /api/ai/history
```

> All endpoints except `/api/auth/*` require `Authorization: Bearer <token>`

---

## 🎥 Demo Walkthrough

Record using [Loom](https://loom.com) (free, shareable link):

1. Show the **login screen** → log in with demo account
2. Walk through the **Dashboard** — streak, metrics, chart
3. Go to **Courses** → add a new course
4. Go to **Goals** → add a new goal
5. Open **AI Tutor** → ask "What should I focus on this week?"
6. Show **Stats** page
7. Sign out and sign back in (session persistence)

---

## 🤖 AI Usage

Built with **Claude (Anthropic)**:
- Designed the full UI/UX — layout, dark theme, color system, typography
- Scaffolded the SPA with auth, routing, and all views
- Built the Express backend with SQLite schema and REST API
- Integrated OpenRouter AI with user-personalized system prompts
- Wrote Vercel + Railway deployment configs
- Generated this README

**Built/decided without AI:**
- Product requirements and feature decisions
- Choosing the tech stack (Node + SQLite + OpenRouter)
- Selecting Vercel, Railway, and OpenRouter as platforms
- Reviewing, testing, and debugging all generated code
- Deployment and configuration

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla HTML/CSS/JS (SPA) |
| Hosting | Vercel |
| Backend | Node.js + Express |
| Hosting | Railway |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| AI | OpenRouter (Llama 3.1 8B free) |
| Fonts | Google Fonts (Syne, Instrument Serif, JetBrains Mono) |

---

## 📄 License

MIT
