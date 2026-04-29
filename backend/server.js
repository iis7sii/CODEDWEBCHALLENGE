const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const fs      = require('fs');
const path    = require('path');

const app          = express();
const PORT         = process.env.PORT || 3001;
const JWT_SECRET   = process.env.JWT_SECRET || 'learnr_dev_secret';
const OPENROUTER   = process.env.OPENROUTER_API_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://codedweb.vercel.app';
const DB_PATH      = path.join(__dirname, 'db.json');

// ── Crash guards ──
process.on('uncaughtException',  e => { console.error('CRASH:', e); process.exit(1); });
process.on('unhandledRejection', e => { console.error('REJECT:', e); process.exit(1); });

// ── Pure-JS JSON database ──
function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch(e) { console.error('DB read error:', e.message); }
  return { users:[], courses:[], goals:[], activity:[], chats:[], seq: 0 };
}
function writeDB(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
  catch(e) { console.error('DB write error:', e.message); }
}
function nextId() {
  const db = readDB(); db.seq = (db.seq||0)+1; writeDB(db); return db.seq;
}

// ── Seed demo user ──
(function seedDemo() {
  const db = readDB();
  if (db.users.find(u => u.email === 'demo@learnr.app')) return;
  const uid = nextId();
  const db2 = readDB();
  db2.users.push({ id:uid, name:'Alex Demo', email:'demo@learnr.app', password: bcrypt.hashSync('demo123',10), streak:12 });
  [
    [uid,'Machine Learning Fundamentals','Coursera',18,78,'active','🤖','fill-blue'],
    [uid,'Spanish B2 — Grammar & Speaking','Duolingo Pro',17,52,'active','🌍','fill-teal'],
    [uid,'UX Research Methods','Interaction Design Foundation',16,31,'active','🎨','fill-coral'],
    [uid,'Intro to Photography','Skillshare',10,20,'paused','📷','fill-amber'],
  ].forEach(([user_id,name,platform,total_hrs,progress,status,emoji,color]) => {
    db2.courses.push({ id:nextId(), user_id, name, platform, total_hrs, progress, status, emoji, color });
  });
  [
    [uid,'Finish ML course',78,100,'2026-05-15','🎓','fill-blue'],
    [uid,'Read 12 books',7,12,'2026-12-31','📚','fill-teal'],
    [uid,'8 hrs/week avg',6.5,8,'2026-12-31','⏱','fill-amber'],
  ].forEach(([user_id,name,current,target,deadline,emoji,color]) => {
    db2.goals.push({ id:nextId(), user_id, name, current, target, deadline, emoji, color });
  });
  [2.5,1.8,0.5,1.2,0,0.5,0].forEach((hours,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    db2.activity.push({ id:nextId(), user_id:uid, hours, logged_date: d.toISOString().split('T')[0] });
  });
  writeDB(db2);
  console.log('✅ Demo user seeded');
})();

// ── Middleware ──
app.use(cors({ origin: ['http://localhost:3000','http://127.0.0.1:5500','http://localhost:5173', FRONTEND_URL, 'https://codedweb.vercel.app'], credentials:true }));
app.use(express.json());

// ── Auth guard ──
function auth(req, res, next) {
  const token = (req.headers.authorization||'').split(' ')[1];
  if (!token) return res.status(401).json({ error:'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error:'Invalid token' }); }
}

// ══ AUTH ══
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name||!email||!password) return res.status(400).json({ error:'All fields required' });
  if (password.length < 6) return res.status(400).json({ error:'Password must be 6+ characters' });
  const db = readDB();
  if (db.users.find(u => u.email === email.toLowerCase())) return res.status(400).json({ error:'Email already registered' });
  const id = nextId();
  const db2 = readDB();
  db2.users.push({ id, name, email:email.toLowerCase(), password:bcrypt.hashSync(password,10), streak:0 });
  writeDB(db2);
  const token = jwt.sign({ id, name, email }, JWT_SECRET, { expiresIn:'7d' });
  res.json({ token, user:{ id, name, email } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email||!password) return res.status(400).json({ error:'All fields required' });
  const db = readDB();
  const user = db.users.find(u => u.email === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error:'Incorrect email or password' });
  const token = jwt.sign({ id:user.id, name:user.name, email:user.email }, JWT_SECRET, { expiresIn:'7d' });
  res.json({ token, user:{ id:user.id, name:user.name, email:user.email, streak:user.streak } });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = readDB().users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error:'Not found' });
  res.json({ id:user.id, name:user.name, email:user.email, streak:user.streak });
});

// ══ COURSES ══
app.get('/api/courses', auth, (req, res) => {
  res.json(readDB().courses.filter(c => c.user_id === req.user.id).reverse());
});
app.post('/api/courses', auth, (req, res) => {
  const { name, platform, total_hrs, progress, status, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  const course = { id:nextId(), user_id:req.user.id, name, platform:platform||'Unknown', total_hrs:total_hrs||10, progress:progress||0, status:status||'active', emoji:emoji||'📘', color:color||'fill-blue' };
  const db = readDB(); db.courses.push(course); writeDB(db);
  res.json(course);
});
app.put('/api/courses/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const idx = db.courses.findIndex(c => c.id===id && c.user_id===req.user.id);
  if (idx > -1) { db.courses[idx] = { ...db.courses[idx], ...req.body }; writeDB(db); }
  res.json({ success:true });
});
app.delete('/api/courses/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  db.courses = db.courses.filter(c => !(c.id===id && c.user_id===req.user.id));
  writeDB(db);
  res.json({ success:true });
});

// ══ GOALS ══
app.get('/api/goals', auth, (req, res) => {
  res.json(readDB().goals.filter(g => g.user_id === req.user.id).reverse());
});
app.post('/api/goals', auth, (req, res) => {
  const { name, current, target, deadline, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error:'Name required' });
  const goal = { id:nextId(), user_id:req.user.id, name, current:current||0, target:target||10, deadline:deadline||null, emoji:emoji||'🎯', color:color||'fill-teal' };
  const db = readDB(); db.goals.push(goal); writeDB(db);
  res.json(goal);
});
app.delete('/api/goals/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  db.goals = db.goals.filter(g => !(g.id===id && g.user_id===req.user.id));
  writeDB(db);
  res.json({ success:true });
});

// ══ ACTIVITY ══
app.get('/api/activity/week', auth, (req, res) => {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-6);
  const logs = readDB().activity.filter(l => l.user_id===req.user.id && new Date(l.logged_date)>=cutoff);
  const map = {};
  logs.forEach(l => { map[l.logged_date] = (map[l.logged_date]||0) + l.hours; });
  res.json(Object.entries(map).map(([logged_date,hours])=>({logged_date,hours})).sort((a,b)=>a.logged_date.localeCompare(b.logged_date)));
});
app.post('/api/activity/log', auth, (req, res) => {
  const { hours } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const db = readDB();
  const ex = db.activity.find(l => l.user_id===req.user.id && l.logged_date===today);
  if (ex) ex.hours += hours;
  else db.activity.push({ id:nextId(), user_id:req.user.id, hours, logged_date:today });
  writeDB(db);
  res.json({ success:true });
});

// ══ STATS ══
app.get('/api/stats', auth, (req, res) => {
  const db = readDB();
  const logs = db.activity.filter(l => l.user_id===req.user.id);
  const totalHrs = logs.reduce((s,l)=>s+l.hours, 0);
  const completed = db.courses.filter(c=>c.user_id===req.user.id && c.status==='done').length;
  const user = db.users.find(u=>u.id===req.user.id);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-27);
  const map = {};
  logs.filter(l=>new Date(l.logged_date)>=cutoff).forEach(l=>{ map[l.logged_date]=(map[l.logged_date]||0)+l.hours; });
  res.json({ totalHrs, completed, streak:user?.streak||0, activity:Object.entries(map).map(([logged_date,hours])=>({logged_date,hours})).sort((a,b)=>a.logged_date.localeCompare(b.logged_date)) });
});

// ══ AI TUTOR ══
app.post('/api/ai/chat', auth, async (req, res) => {
  const { message, history=[] } = req.body;
  if (!message) return res.status(400).json({ error:'Message required' });
  if (!OPENROUTER) return res.status(503).json({ error:'AI not configured — add OPENROUTER_API_KEY in Railway variables' });
  const db = readDB();
  const courses = db.courses.filter(c=>c.user_id===req.user.id);
  const goals   = db.goals.filter(g=>g.user_id===req.user.id);
  const system  = `You are Learnr AI, a friendly learning coach. User: ${req.user.name}.
Courses: ${courses.map(c=>`${c.name} (${c.progress}%, ${c.status})`).join(', ')||'none'}
Goals: ${goals.map(g=>`${g.name}: ${g.current}/${g.target}`).join(', ')||'none'}
Be concise, encouraging, 2-4 sentences. Use emojis occasionally.`;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${OPENROUTER}`, 'Content-Type':'application/json', 'HTTP-Referer':FRONTEND_URL, 'X-Title':'Learnr' },
      body: JSON.stringify({ model:'meta-llama/llama-3.1-8b-instruct:free', messages:[{role:'system',content:system},...history.slice(-8),{role:'user',content:message}], max_tokens:400 })
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || 'No response.';
    const db2 = readDB();
    db2.chats.push({ id:nextId(), user_id:req.user.id, role:'user',      content:message, ts:Date.now() });
    db2.chats.push({ id:nextId(), user_id:req.user.id, role:'assistant', content:reply,   ts:Date.now() });
    writeDB(db2);
    res.json({ reply });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/ai/history', auth, (req, res) => {
  res.json(readDB().chats.filter(c=>c.user_id===req.user.id).slice(-100));
});

// ══ HEALTH + ROOT ══
app.get('/api/health', (_,res) => res.json({ status:'ok', db:'json-fs', ai:!!OPENROUTER, ts:new Date().toISOString() }));
app.get('/', (_,res) => res.send(`<!DOCTYPE html><html><head><title>Learnr API</title><style>body{font-family:monospace;background:#0d0d0b;color:#d4f261;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px}h1{font-size:28px;margin:0}p{color:#9e9b92;margin:0;font-size:13px}a{color:#34d39a}</style></head><body><h1>🚀 Learnr API is running</h1><p>Open your <a href="${FRONTEND_URL}">frontend</a> to use the app.</p><p style="margin-top:8px">Health: <a href="/api/health">/api/health</a></p></body></html>`));

app.listen(PORT, () => {
  console.log(`🚀 Learnr API → http://localhost:${PORT}`);
  console.log(`🗄️  DB: ${DB_PATH}`);
  console.log(`🤖 AI: ${OPENROUTER ? '✅' : '❌ set OPENROUTER_API_KEY'}`);
  console.log(`🌐 CORS: ${FRONTEND_URL}`);
});
