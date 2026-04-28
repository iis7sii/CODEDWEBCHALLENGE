const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'learnr_dev_secret';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://codedweb.vercel.app';

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

// ── Database ──
const db = new Database(path.join(__dirname, 'learnr.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    streak INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    platform TEXT DEFAULT 'Unknown',
    total_hrs REAL DEFAULT 10,
    progress INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    emoji TEXT DEFAULT '📘',
    color TEXT DEFAULT 'fill-blue',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    current REAL DEFAULT 0,
    target REAL DEFAULT 10,
    deadline TEXT,
    emoji TEXT DEFAULT '🎯',
    color TEXT DEFAULT 'fill-teal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hours REAL DEFAULT 0,
    logged_date DATE DEFAULT (DATE('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ai_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ── Seed Demo User ──
if (!db.prepare('SELECT id FROM users WHERE email = ?').get('demo@learnr.app')) {
  const hash = bcrypt.hashSync('demo123', 10);
  const uid = db.prepare('INSERT INTO users (name,email,password,streak) VALUES (?,?,?,?)').run('Alex Demo', 'demo@learnr.app', hash, 12).lastInsertRowid;
  [
    ['Machine Learning Fundamentals','Coursera',18,78,'active','🤖','fill-blue'],
    ['Spanish B2 — Grammar & Speaking','Duolingo Pro',17,52,'active','🌍','fill-teal'],
    ['UX Research Methods','Interaction Design Foundation',16,31,'active','🎨','fill-coral'],
    ['Intro to Photography','Skillshare',10,20,'paused','📷','fill-amber'],
  ].forEach(c => db.prepare('INSERT INTO courses (user_id,name,platform,total_hrs,progress,status,emoji,color) VALUES (?,?,?,?,?,?,?,?)').run(uid,...c));
  [
    ['Finish ML course',78,100,'2026-05-15','🎓','fill-blue'],
    ['Read 12 books',7,12,'2026-12-31','📚','fill-teal'],
    ['8 hrs/week avg',6.5,8,'2026-12-31','⏱','fill-amber'],
  ].forEach(g => db.prepare('INSERT INTO goals (user_id,name,current,target,deadline,emoji,color) VALUES (?,?,?,?,?,?,?)').run(uid,...g));
  [2.5,1.8,0.5,1.2,0,0.5,0].forEach((h,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    db.prepare('INSERT INTO activity_log (user_id,hours,logged_date) VALUES (?,?,?)').run(uid,h,d.toISOString().split('T')[0]);
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
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run(name, email.toLowerCase().trim(), hash);
    const token = jwt.sign({ id: r.lastInsertRowid, name, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: r.lastInsertRowid, name, email } });
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Incorrect email or password' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, streak: user.streak } });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT id,name,email,streak FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ════════════ COURSES ════════════
app.get('/api/courses', auth, (req, res) => res.json(db.prepare('SELECT * FROM courses WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)));

app.post('/api/courses', auth, (req, res) => {
  const { name, platform, total_hrs, progress, status, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Course name required' });
  const r = db.prepare('INSERT INTO courses (user_id,name,platform,total_hrs,progress,status,emoji,color) VALUES (?,?,?,?,?,?,?,?)').run(req.user.id,name,platform||'Unknown',total_hrs||10,progress||0,status||'active',emoji||'📘',color||'fill-blue');
  res.json(db.prepare('SELECT * FROM courses WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/courses/:id', auth, (req, res) => {
  const { name, platform, total_hrs, progress, status, emoji, color } = req.body;
  db.prepare('UPDATE courses SET name=?,platform=?,total_hrs=?,progress=?,status=?,emoji=?,color=? WHERE id=? AND user_id=?').run(name,platform,total_hrs,progress,status,emoji,color,req.params.id,req.user.id);
  res.json({ success: true });
});

app.delete('/api/courses/:id', auth, (req, res) => {
  db.prepare('DELETE FROM courses WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ════════════ GOALS ════════════
app.get('/api/goals', auth, (req, res) => res.json(db.prepare('SELECT * FROM goals WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)));

app.post('/api/goals', auth, (req, res) => {
  const { name, current, target, deadline, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Goal name required' });
  const r = db.prepare('INSERT INTO goals (user_id,name,current,target,deadline,emoji,color) VALUES (?,?,?,?,?,?,?)').run(req.user.id,name,current||0,target||10,deadline||null,emoji||'🎯',color||'fill-teal');
  res.json(db.prepare('SELECT * FROM goals WHERE id=?').get(r.lastInsertRowid));
});

app.delete('/api/goals/:id', auth, (req, res) => {
  db.prepare('DELETE FROM goals WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ════════════ ACTIVITY ════════════
app.get('/api/activity/week', auth, (req, res) => {
  res.json(db.prepare(`SELECT logged_date, SUM(hours) as hours FROM activity_log WHERE user_id=? AND logged_date >= DATE('now','-6 days') GROUP BY logged_date ORDER BY logged_date ASC`).all(req.user.id));
});

app.post('/api/activity/log', auth, (req, res) => {
  const { hours } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT id FROM activity_log WHERE user_id=? AND logged_date=?').get(req.user.id, today);
  if (existing) db.prepare('UPDATE activity_log SET hours=hours+? WHERE id=?').run(hours, existing.id);
  else db.prepare('INSERT INTO activity_log (user_id,hours,logged_date) VALUES (?,?,?)').run(req.user.id, hours, today);
  res.json({ success: true });
});

// ════════════ STATS ════════════
app.get('/api/stats', auth, (req, res) => {
  const totalHrs = db.prepare('SELECT SUM(hours) as total FROM activity_log WHERE user_id=?').get(req.user.id);
  const completed = db.prepare("SELECT COUNT(*) as count FROM courses WHERE user_id=? AND status='done'").get(req.user.id);
  const streak = db.prepare('SELECT streak FROM users WHERE id=?').get(req.user.id);
  const activity = db.prepare(`SELECT logged_date, SUM(hours) as hours FROM activity_log WHERE user_id=? AND logged_date >= DATE('now','-27 days') GROUP BY logged_date ORDER BY logged_date ASC`).all(req.user.id);
  res.json({ totalHrs: totalHrs?.total||0, completed: completed?.count||0, streak: streak?.streak||0, activity });
});

// ════════════ AI TUTOR (OpenRouter) ════════════
app.post('/api/ai/chat', auth, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY in Railway environment variables.' });

  const userCourses = db.prepare('SELECT name,progress,status FROM courses WHERE user_id=?').all(req.user.id);
  const userGoals = db.prepare('SELECT name,current,target FROM goals WHERE user_id=?').all(req.user.id);

  const systemPrompt = `You are Learnr AI, a friendly personal learning coach inside the Learnr dashboard app.

User: ${req.user.name}

Their courses:
${userCourses.map(c=>`- ${c.name} (${c.progress}% complete, ${c.status})`).join('\n')||'None yet'}

Their goals:
${userGoals.map(g=>`- ${g.name}: ${g.current}/${g.target}`).join('\n')||'None yet'}

Be encouraging, personalized, and concise. Use their actual data to give relevant advice. Keep replies to 2-4 sentences unless asked for more. Use emojis occasionally.`;

  try {
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': FRONTEND_URL,
        'X-Title': 'Learnr Dashboard'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: message }
        ],
        max_tokens: 400,
        temperature: 0.7
      })
    });

    if (!aiRes.ok) {
      const err = await aiRes.json();
      throw new Error(err.error?.message || `OpenRouter ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, no response generated.';

    db.prepare('INSERT INTO ai_chats (user_id,role,content) VALUES (?,?,?)').run(req.user.id, 'user', message);
    db.prepare('INSERT INTO ai_chats (user_id,role,content) VALUES (?,?,?)').run(req.user.id, 'assistant', reply);

    res.json({ reply });
  } catch(e) {
    console.error('OpenRouter error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ai/history', auth, (req, res) => {
  res.json(db.prepare('SELECT role,content,created_at FROM ai_chats WHERE user_id=? ORDER BY created_at ASC LIMIT 100').all(req.user.id));
});

// ════════════ HEALTH ════════════
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ai_configured: !!OPENROUTER_API_KEY, timestamp: new Date().toISOString() }));

// ════════════ ROOT ════════════
app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Learnr API</title><style>
      body { font-family: monospace; background: #0d0d0b; color: #d4f261; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; flex-direction:column; gap:12px; }
      h1 { font-size: 28px; margin:0; }
      p { color: #9e9b92; margin:0; font-size:13px; }
      a { color: #34d39a; }
    </style></head>
    <body>
      <h1>🚀 Learnr API is running</h1>
      <p>Backend is live. Open your <a href="${FRONTEND_URL}" target="_blank">Vercel frontend</a> to use the app.</p>
      <p style="margin-top:8px">Health check: <a href="/api/health">/api/health</a></p>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Learnr API → http://localhost:${PORT}`);
  console.log(`🤖 OpenRouter AI: ${OPENROUTER_API_KEY ? '✅ Connected' : '❌ Not configured (add OPENROUTER_API_KEY)'}`);
});
