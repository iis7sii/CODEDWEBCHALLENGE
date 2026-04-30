# Learnr — Personal Learning Dashboard

A full-stack web app to track courses, goals, streaks, and weekly study activity — with a built-in **AI Tutor** powered by OpenRouter.

![Status](https://img.shields.io/badge/status-live-brightgreen) ![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js) ![lowdb](https://img.shields.io/badge/database-lowdb%20JSON-orange) ![OpenRouter](https://img.shields.io/badge/AI-OpenRouter-6366f1)

---

## 🌐 Live Links

| | URL |
|--|--|
| **Frontend (Vercel)** | [https://codedweb.vercel.app](https://codedweb.vercel.app)
| **Backend (Railway)** | [https://codedwebb.up.railway.app](https://codedwebb.up.railway.app)



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
│   ├── render.yaml      ← Render deploy config
│   └── .env.example
├── .gitignore
└── README.md
```


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
| Database | lowdb (JSON file)       |
| Auth | JWT + bcrypt |
| AI | OpenRouter (Llama 3.1 8B free) |
| Fonts | Google Fonts (Syne, Instrument Serif, JetBrains Mono) |

---

## 📄 License

MIT
