const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'learnr_dev_secret_change_in_production';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://codedweb.vercel.app';

// ── Global error handlers ──
process.on('uncaughtException', (err) => { console.error('❌ Uncaught:', err.message); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('❌ Unhandled:', reason); process.exit(1); });

// ── Middleware ──
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5500',
    'https://codedweb.vercel.app',
    FRONTEND_URL
  ],
  credentials: true
}));
app.use(express.json());

// ── Database (lowdb — pure JS, no native compilation) ──
const dbPath = path.join(__dirname, 'db.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);

db.defaults({
  users: [],
  courses: [],
  goals: [],
  activity_log: [],
  ai_chats: [],
  _counters: { users: 0, courses: 0, goals: 0, activity: 0, chats: 0 }
}).write();

console.log('✅ Database ready:', dbPath);

// ── ID generator ──
function nextId(table) {
  const current = db.get(`_counters.${table}`).value() || 0;
  const next = current + 1;
  db.set(`_counters.${table}`, next).write();
  return next;
}

// ── Seed Demo User ──
const demoExists = db.get('users').find({ email: 'demo@learnr.app' }).value();
if (!demoExists) {
  const uid = nextId('users');
  const hash = bcrypt.hashSync('demo123', 10);
  db.get('users').push({ id: uid, name: 'Alex Demo', email: 'demo@learnr.app', password: hash, streak: 12, created_at: new Date().toISOString() }).write();

  const seedCourses = [
    ['Machine Learning Fundamentals','Coursera',18,78,'active','🤖','fill-blue'],
    ['Spanish B2 — Grammar & Speaking','Duolingo Pro',17,52,'active','🌍','fill-teal'],
    ['UX Research Methods','Interaction Design Foundation',16,31,'active','🎨','fill-coral'],
    ['Intro to Photography','Skillshare',10,20,'paused','📷','fill-amber'],
  ];
  seedCourses.forEach(([name,platform,total_hrs,progress,status,emoji,color]) => {
    db.get('courses').push({ id: nextId('courses'), user_id: uid, name, platform, total_hrs, progress, status, emoji, color, created_at: new Date().toISOString() }).write();
  });

  const seedGoals = [
    ['Finish ML course',78,100,'2026-05-15','🎓','fill-blue'],
    ['Read 12 books',7,12,'2026-12-31','📚','fill-teal'],
    ['8 hrs/week avg',6.5,8,'2026-12-31','⏱','fill-amber'],
  ];
  seedGoals.forEach(([name,current,target,deadline,emoji,color]) => {
    db.get('goals').push({ id: nextId('goals'), user_id: uid, name, current, target, deadline, emoji, color, created_at: new Date().toISOString() }).write();
  });

  [2.5,1.8,0.5,1.2,0,0.5,0].forEach((hours, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    db.get('activity_log').push({ id: nextId('activity'), user_id: uid, hours, logged_date: d.toISOString().split('T')[0] }).write();
  });

  console.log('✅ Demo user seeded');
}

// ── Auth Middleware ──
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// ════════════ AUTH ════════════
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const exists = db.get('users').find({ email: email.toLowerCase().trim() }).value();
  if (exists) return res.status(400).json({ error: 'Email already registered' });
  const id = nextId('users');
  const hash = bcrypt.hashSync(password, 10);
  db.get('users').push({ id, name, email: email.toLowerCase().trim(), password: hash, streak: 0, created_at: new Date().toISOString() }).write();
  const token = jwt.sign({ id, name, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, name, email } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields required' });
  const user = db.get('users').find({ email: email.toLowerCase().trim() }).value();
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Incorrect email or password' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, streak: user.streak } });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, streak: user.streak });
});

// ════════════ COURSES ════════════
app.get('/api/courses', auth, (req, res) => {
  const courses = db.get('courses').filter({ user_id: req.user.id }).value();
  res.json(courses.reverse());
});

app.post('/api/courses', auth, (req, res) => {
  const { name, platform, total_hrs, progress, status, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Course name required' });
  const course = { id: nextId('courses'), user_id: req.user.id, name, platform: platform||'Unknown', total_hrs: total_hrs||10, progress: progress||0, status: status||'active', emoji: emoji||'📘', color: color||'fill-blue', created_at: new Date().toISOString() };
  db.get('courses').push(course).write();
  res.json(course);
});

app.put('/api/courses/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, platform, total_hrs, progress, status, emoji, color } = req.body;
  db.get('courses').find({ id, user_id: req.user.id }).assign({ name, platform, total_hrs, progress, status, emoji, color }).write();
  res.json({ success: true });
});

app.delete('/api/courses/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  db.get('courses').remove({ id, user_id: req.user.id }).write();
  res.json({ success: true });
});

// ════════════ GOALS ════════════
app.get('/api/goals', auth, (req, res) => {
  const goals = db.get('goals').filter({ user_id: req.user.id }).value();
  res.json(goals.reverse());
});

app.post('/api/goals', auth, (req, res) => {
  const { name, current, target, deadline, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Goal name required' });
  const goal = { id: nextId('goals'), user_id: req.user.id, name, current: current||0, target: target||10, deadline: deadline||null, emoji: emoji||'🎯', color: color||'fill-teal', created_at: new Date().toISOString() };
  db.get('goals').push(goal).write();
  res.json(goal);
});

app.delete('/api/goals/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  db.get('goals').remove({ id, user_id: req.user.id }).write();
  res.json({ success: true });
});

// ════════════ ACTIVITY ════════════
app.get('/api/activity/week', auth, (req, res) => {
  const logs = db.get('activity_log').filter({ user_id: req.user.id }).value();
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const result = {};
  logs.forEach(l => {
    if (new Date(l.logged_date) >= sevenDaysAgo) {
      result[l.logged_date] = (result[l.logged_date] || 0) + l.hours;
    }
  });
  res.json(Object.entries(result).map(([logged_date, hours]) => ({ logged_date, hours })).sort((a,b) => a.logged_date.localeCompare(b.logged_date)));
});

app.post('/api/activity/log', auth, (req, res) => {
  const { hours } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const existing = db.get('activity_log').find({ user_id: req.user.id, logged_date: today }).value();
  if (existing) {
    db.get('activity_log').find({ id: existing.id }).assign({ hours: existing.hours + hours }).write();
  } else {
    db.get('activity_log').push({ id: nextId('activity'), user_id: req.user.id, hours, logged_date: today }).write();
  }
  res.json({ success: true });
});

// ════════════ STATS ════════════
app.get('/api/stats', auth, (req, res) => {
  const logs = db.get('activity_log').filter({ user_id: req.user.id }).value();
  const totalHrs = logs.reduce((sum, l) => sum + l.hours, 0);
  const completed = db.get('courses').filter({ user_id: req.user.id, status: 'done' }).value().length;
  const user = db.get('users').find({ id: req.user.id }).value();
  const twentyEightDaysAgo = new Date(); twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 27);
  const activity = logs.filter(l => new Date(l.logged_date) >= twentyEightDaysAgo)
    .reduce((acc, l) => { acc[l.logged_date] = (acc[l.logged_date]||0) + l.hours; return acc; }, {});
  res.json({ totalHrs, completed, streak: user?.streak||0, activity: Object.entries(activity).map(([logged_date,hours])=>({logged_date,hours})).sort((a,b)=>a.logged_date.localeCompare(b.logged_date)) });
});

// ════════════ AI TUTOR ════════════
app.post('/api/ai/chat', auth, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY in Railway environment variables.' });

  const userCourses = db.get('courses').filter({ user_id: req.user.id }).value();
  const userGoals = db.get('goals').filter({ user_id: req.user.id }).value();
  const systemPrompt = `You are Learnr AI, a friendly personal learning coach inside the Learnr dashboard app.
User: ${req.user.name}
Their courses:\n${userCourses.map(c=>`- ${c.name} (${c.progress}% complete, ${c.status})`).join('\n')||'None yet'}
Their goals:\n${userGoals.map(g=>`- ${g.name}: ${g.current}/${g.target}`).join('\n')||'None yet'}
Be encouraging, personalized, and concise. Keep replies to 2-4 sentences unless asked for more. Use emojis occasionally.`;

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': FRONTEND_URL, 'X-Title': 'Learnr Dashboard' },
      body: JSON.stringify({ model: 'meta-llama/llama-3.1-8b-instruct:free', messages: [{ role:'system', content:systemPrompt }, ...history.slice(-8).map(h=>({role:h.role,content:h.content})), {role:'user',content:message}], max_tokens:400, temperature:0.7 })
    });
    if (!aiRes.ok) { const err = await aiRes.json(); throw new Error(err.error?.message || `OpenRouter ${aiRes.status}`); }
    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, no response generated.';
    db.get('ai_chats').push({ id: nextId('chats'), user_id: req.user.id, role: 'user', content: message, created_at: new Date().toISOString() }).write();
    db.get('ai_chats').push({ id: nextId('chats'), user_id: req.user.id, role: 'assistant', content: reply, created_at: new Date().toISOString() }).write();
    res.json({ reply });
  } catch(e) {
    console.error('OpenRouter error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ai/history', auth, (req, res) => {
  res.json(db.get('ai_chats').filter({ user_id: req.user.id }).value().slice(-100));
});

// ════════════ HEALTH ════════════
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ai_configured: !!OPENROUTER_API_KEY, db: 'lowdb (json)', timestamp: new Date().toISOString() }));

// ════════════ ROOT ════════════
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Learnr API</title><style>body{font-family:monospace;background:#0d0d0b;color:#d4f261;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px;}h1{font-size:28px;margin:0;}p{color:#9e9b92;margin:0;font-size:13px;}a{color:#34d39a;}</style></head><body><h1>🚀 Learnr API is running</h1><p>Backend is live. Open your <a href="${FRONTEND_URL}">Vercel frontend</a> to use the app.</p><p style="margin-top:8px">Health check: <a href="/api/health">/api/health</a></p></body></html>`);
});

app.listen(PORT, () => {
  console.log(`🚀 Learnr API → http://localhost:${PORT}`);
  console.log(`🗄️  Database: lowdb JSON (no native deps)`);
  console.log(`🤖 OpenRouter AI: ${OPENROUTER_API_KEY ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`🌐 CORS: ${FRONTEND_URL}`);
});
