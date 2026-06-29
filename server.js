require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'data', 'smm.sqlite'));
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DEFAULT_MARGIN = Number(process.env.DEFAULT_MARGIN_PERCENT || 80);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function money(n) { return Math.round(Number(n || 0) * 100) / 100; }
function now() { return new Date().toISOString(); }
function publicUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role, balance: money(u.balance), referralCode: u.referral_code }; }
function sign(user) { return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' }); }
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login necessário.' });
  try { req.auth = jwt.verify(token, JWT_SECRET); next(); } catch { return res.status(401).json({ error: 'Sessão inválida.' }); }
}
function requireAdmin(req, res, next) { if (req.auth?.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' }); next(); }
function referralCode(name='user') { return (name.replace(/[^a-z0-9]/gi, '').slice(0, 5) + Math.random().toString(36).slice(2, 7)).toUpperCase(); }

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client',
      balance REAL NOT NULL DEFAULT 0,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_service_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      type TEXT,
      rate REAL NOT NULL,
      min INTEGER DEFAULT 1,
      max INTEGER DEFAULT 100000,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      provider_order_id TEXT,
      link TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      charge REAL NOT NULL,
      profit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_response TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL DEFAULT 'pix',
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wallet_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );
  `);
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@suaempresa.com';
  const admin = db.prepare('SELECT * FROM users WHERE email=?').get(adminEmail);
  if (!admin) {
    db.prepare('INSERT INTO users (name,email,password_hash,role,balance,referral_code,created_at) VALUES (?,?,?,?,?,?,?)')
      .run('Administrador', adminEmail, bcrypt.hashSync(process.env.ADMIN_PASSWORD || '12345678', 10), 'admin', 0, 'ADMIN', now());
  }
}
initDb();

async function provider(action, params = {}) {
  const url = process.env.SMM_API_URL;
  const key = process.env.SMM_API_KEY;
  if (!url || !key || key.includes('sua-chave')) throw new Error('Configure SMM_API_URL e SMM_API_KEY no .env');
  const body = new URLSearchParams({ key, action, ...Object.fromEntries(Object.entries(params).map(([k,v]) => [k, String(v)])) });
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, referral } = req.body || {};
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Nome, e-mail e senha com mínimo de 6 caracteres.' });
  try {
    const info = db.prepare('INSERT INTO users (name,email,password_hash,role,balance,referral_code,referred_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(name.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password, 10), 'client', 0, referralCode(name), referral || null, now());
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) { res.status(400).json({ error: 'E-mail já cadastrado.' }); }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase().trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  res.json({ token: sign(user), user: publicUser(user) });
});
app.get('/api/me', requireAuth, (req, res) => res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.auth.id)) }));

app.get('/api/config', (req, res) => res.json({ appName: process.env.APP_NAME || 'SMM Pro', minDeposit: Number(process.env.MIN_DEPOSIT || 10), pixKey: process.env.PIX_KEY || '', pixName: process.env.PIX_NAME || '', pixCity: process.env.PIX_CITY || '' }));
app.get('/api/services', (req, res) => res.json({ services: db.prepare('SELECT * FROM services WHERE active=1 ORDER BY category,name').all() }));

app.post('/api/deposits', requireAuth, (req, res) => {
  const amount = money(req.body.amount);
  if (amount < Number(process.env.MIN_DEPOSIT || 10)) return res.status(400).json({ error: 'Valor abaixo do mínimo.' });
  const info = db.prepare('INSERT INTO deposits (user_id,amount,method,status,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(req.auth.id, amount, 'pix', 'pending', req.body.note || '', now(), now());
  res.json({ ok: true, depositId: info.lastInsertRowid });
});
app.get('/api/deposits', requireAuth, (req, res) => res.json({ deposits: db.prepare('SELECT * FROM deposits WHERE user_id=? ORDER BY id DESC').all(req.auth.id) }));

app.post('/api/orders', requireAuth, async (req, res) => {
  const { serviceId, link, quantity } = req.body || {};
  const service = db.prepare('SELECT * FROM services WHERE id=? AND active=1').get(serviceId);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.auth.id);
  const qty = Number(quantity);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });
  if (!link || !qty || qty < service.min || qty > service.max) return res.status(400).json({ error: `Quantidade permitida: ${service.min} a ${service.max}.` });
  const charge = money((service.rate * qty) / 1000);
  if (user.balance < charge) return res.status(400).json({ error: 'Saldo insuficiente.' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance - ? WHERE id=?').run(charge, user.id);
    db.prepare('INSERT INTO wallet_logs (user_id,amount,type,description,created_at) VALUES (?,?,?,?,?)').run(user.id, -charge, 'order', `Pedido de ${service.name}`, now());
    return db.prepare('INSERT INTO orders (user_id,service_id,link,quantity,charge,profit,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(user.id, service.id, link, qty, charge, money(charge * DEFAULT_MARGIN / (100 + DEFAULT_MARGIN)), 'processing', now(), now()).lastInsertRowid;
  });
  const orderId = tx();

  try {
    const result = await provider('add', { service: service.provider_service_id, link, quantity: qty });
    const providerOrderId = result.order || result.id || null;
    db.prepare('UPDATE orders SET provider_order_id=?, provider_response=?, status=?, updated_at=? WHERE id=?')
      .run(providerOrderId, JSON.stringify(result), providerOrderId ? 'sent' : 'provider_error', now(), orderId);
    res.json({ ok: true, orderId, provider: result });
  } catch (e) {
    db.prepare('UPDATE users SET balance = balance + ? WHERE id=?').run(charge, user.id);
    db.prepare('INSERT INTO wallet_logs (user_id,amount,type,description,created_at) VALUES (?,?,?,?,?)').run(user.id, charge, 'refund', `Estorno pedido ${orderId}`, now());
    db.prepare('UPDATE orders SET status=?, provider_response=?, updated_at=? WHERE id=?').run('provider_error', e.message, now(), orderId);
    res.status(502).json({ error: 'Erro no fornecedor. Saldo estornado.', details: e.message });
  }
});
app.get('/api/orders', requireAuth, (req, res) => res.json({ orders: db.prepare(`SELECT o.*, s.name service_name FROM orders o JOIN services s ON s.id=o.service_id WHERE o.user_id=? ORDER BY o.id DESC`).all(req.auth.id) }));
app.post('/api/orders/:id/sync', requireAuth, async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id, req.auth.id);
  if (!order || !order.provider_order_id) return res.status(404).json({ error: 'Pedido não encontrado.' });
  const result = await provider('status', { order: order.provider_order_id });
  db.prepare('UPDATE orders SET status=?, provider_response=?, updated_at=? WHERE id=?').run(result.status || order.status, JSON.stringify(result), now(), order.id);
  res.json({ ok: true, status: result });
});

app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  let providerBalance = null;
  try { providerBalance = await provider('balance'); } catch (e) { providerBalance = { error: e.message }; }
  res.json({
    providerBalance,
    users: db.prepare('SELECT COUNT(*) total FROM users').get().total,
    orders: db.prepare('SELECT COUNT(*) total, COALESCE(SUM(charge),0) revenue, COALESCE(SUM(profit),0) profit FROM orders').get(),
    pendingDeposits: db.prepare("SELECT COUNT(*) total FROM deposits WHERE status='pending'").get().total
  });
});
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => res.json({ users: db.prepare('SELECT id,name,email,role,balance,referral_code,referred_by,created_at FROM users ORDER BY id DESC').all() }));
app.post('/api/admin/users/:id/balance', requireAuth, requireAdmin, (req, res) => {
  const amount = money(req.body.amount);
  const desc = req.body.description || 'Ajuste manual admin';
  db.prepare('UPDATE users SET balance = balance + ? WHERE id=?').run(amount, req.params.id);
  db.prepare('INSERT INTO wallet_logs (user_id,amount,type,description,created_at) VALUES (?,?,?,?,?)').run(req.params.id, amount, 'admin', desc, now());
  res.json({ ok: true });
});
app.get('/api/admin/deposits', requireAuth, requireAdmin, (req, res) => res.json({ deposits: db.prepare('SELECT d.*, u.name, u.email FROM deposits d JOIN users u ON u.id=d.user_id ORDER BY d.id DESC').all() }));
app.post('/api/admin/deposits/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const dep = db.prepare('SELECT * FROM deposits WHERE id=?').get(req.params.id);
  if (!dep || dep.status !== 'pending') return res.status(400).json({ error: 'Depósito inválido.' });
  db.prepare("UPDATE deposits SET status='approved', updated_at=? WHERE id=?").run(now(), dep.id);
  db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(dep.amount, dep.user_id);
  db.prepare('INSERT INTO wallet_logs (user_id,amount,type,description,created_at) VALUES (?,?,?,?,?)').run(dep.user_id, dep.amount, 'deposit', `Depósito PIX #${dep.id}`, now());
  res.json({ ok: true });
});
app.get('/api/admin/orders', requireAuth, requireAdmin, (req, res) => res.json({ orders: db.prepare(`SELECT o.*, u.name user_name, u.email, s.name service_name FROM orders o JOIN users u ON u.id=o.user_id JOIN services s ON s.id=o.service_id ORDER BY o.id DESC LIMIT 300`).all() }));
app.post('/api/admin/import-services', requireAuth, requireAdmin, async (req, res) => {
  const margin = Number(req.body.marginPercent ?? DEFAULT_MARGIN);
  const list = await provider('services');
  if (!Array.isArray(list)) return res.status(502).json({ error: 'Fornecedor não retornou lista de serviços.', response: list });
  const stmt = db.prepare(`INSERT INTO services (provider_service_id,name,category,type,rate,min,max,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(provider_service_id) DO UPDATE SET name=excluded.name, category=excluded.category, type=excluded.type, rate=excluded.rate, min=excluded.min, max=excluded.max, active=1`);
  const tx = db.transaction(items => {
    for (const s of items) {
      const providerRate = Number(s.rate || 0);
      const sellRate = money(providerRate * (1 + margin / 100));
      stmt.run(String(s.service), s.name || 'Serviço', s.category || 'Geral', s.type || '', sellRate, Number(s.min || 1), Number(s.max || 100000), 1, now());
    }
  });
  tx(list);
  res.json({ ok: true, imported: list.length, marginPercent: margin });
});
app.post('/api/admin/services/:id/toggle', requireAuth, requireAdmin, (req, res) => { db.prepare('UPDATE services SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=?').run(req.params.id); res.json({ ok: true }); });

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`SMM Pro rodando em http://localhost:${PORT}`));
