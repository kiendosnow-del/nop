require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { init } = require('./db');
const path = require('path');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'please_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

const db = init(DB_FILE);

// Prepared statements
const createUserStmt = db.prepare('INSERT INTO users (username, password, balance, roles, createdAt) VALUES (?, ?, ?, ?, ?)');
const getUserByUsernameStmt = db.prepare('SELECT * FROM users WHERE username = ?');
const updateUserPasswordStmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
const updateUserBalanceStmt = db.prepare('UPDATE users SET balance = ? WHERE username = ?');
const allUsersStmt = db.prepare('SELECT id, username, balance, roles, createdAt FROM users');

const createDepositStmt = db.prepare('INSERT INTO deposits (id, username, amount, bank, reference, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
const getDepositsStmt = db.prepare('SELECT * FROM deposits ORDER BY createdAt DESC');

const createOrderStmt = db.prepare('INSERT INTO orders (id, username, packageId, packageName, price, login, note, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const getOrdersStmt = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC');

// utils
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Middlewares
const app = express();
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try later' }
}));

// Auth helpers
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!Array.isArray(req.user.roles) || !req.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

/* ---------- Public auth endpoints ---------- */

// Register (creates normal user, not admin)
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  const existing = getUserByUsernameStmt.get(username);
  if (existing) return res.status(409).json({ error: 'User exists' });
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  createUserStmt.run(username, hashed, 0, JSON.stringify([]), Date.now());
  return res.json({ ok: true });
});

// Login
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  const user = getUserByUsernameStmt.get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  const roles = JSON.parse(user.roles || '[]');
  const token = signToken({ username: user.username, roles });
  return res.json({ token, user: { username: user.username, balance: user.balance, roles } });
});

// Whoami
app.get('/auth/me', authMiddleware, (req, res) => {
  const user = getUserByUsernameStmt.get(req.user.username);
  if (!user) return res.status(404).json({ error: 'Not found' });
  return res.json({ user: { username: user.username, balance: user.balance, roles: JSON.parse(user.roles || '[]'), createdAt: user.createdAt } });
});

/* ---------- Admin endpoints ---------- */

// Create admin user (admin-only). For initial admin seed, use create-admin.js script.
app.post('/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  const existing = getUserByUsernameStmt.get(username);
  if (existing) return res.status(409).json({ error: 'User exists' });
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  createUserStmt.run(username, hashed, 0, JSON.stringify(['admin']), Date.now());
  return res.json({ ok: true, username });
});

// Change admin password (admin-only)
app.patch('/admin/users/:username/password', authMiddleware, requireAdmin, async (req, res) => {
  const target = req.params.username;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });
  const user = getUserByUsernameStmt.get(target);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  updateUserPasswordStmt.run(hashed, target);
  return res.json({ ok: true });
});

// List users (admin-only)
app.get('/admin/users', authMiddleware, requireAdmin, (req, res) => {
  const rows = allUsersStmt.all().map(u => ({ id: u.id, username: u.username, balance: u.balance, roles: JSON.parse(u.roles || '[]'), createdAt: u.createdAt }));
  return res.json(rows);
});

/* ---------- Deposits (simple) ---------- */

// Create deposit request (user)
app.post('/deposits', authMiddleware, (req, res) => {
  const { amount, bank, reference } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const id = 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  createDepositStmt.run(id, req.user.username, amount, bank || '', reference || '', 'pending', Date.now());
  // In production, send notification to admin (server-side) here (Discord webhook, etc.)
  return res.json({ ok: true, id });
});

// Admin: list deposits
app.get('/admin/deposits', authMiddleware, requireAdmin, (req, res) => {
  const rows = getDepositsStmt.all();
  return res.json(rows);
});

// Admin: approve deposit
app.post('/admin/deposits/:id/approve', authMiddleware, requireAdmin, (req, res) => {
  const id = req.params.id;
  const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(id);
  if (!deposit) return res.status(404).json({ error: 'Not found' });
  if (deposit.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
  db.prepare('UPDATE deposits SET status = ?, reviewedBy = ?, reviewedAt = ? WHERE id = ?').run('approved', req.user.username, Date.now(), id);
  // credit user
  const user = getUserByUsernameStmt.get(deposit.username);
  const newBalance = (user.balance || 0) + deposit.amount;
  updateUserBalanceStmt.run(newBalance, deposit.username);
  return res.json({ ok: true });
});

// Admin: decline deposit
app.post('/admin/deposits/:id/decline', authMiddleware, requireAdmin, (req, res) => {
  const id = req.params.id;
  const { reason } = req.body;
  const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(id);
  if (!deposit) return res.status(404).json({ error: 'Not found' });
  if (deposit.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
  db.prepare('UPDATE deposits SET status = ?, reviewedBy = ?, reviewedAt = ?, declineReason = ? WHERE id = ?')
    .run('declined', req.user.username, Date.now(), reason || '', id);
  return res.json({ ok: true });
});

/* ---------- Orders (simple) ---------- */

app.post('/orders', authMiddleware, (req, res) => {
  const { packageId, packageName, price, login, note } = req.body;
  const id = 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  createOrderStmt.run(id, req.user.username, packageId || '', packageName || '', price || 0, login || '', note || '', 'pending', Date.now());
  // notify admins in production
  return res.json({ ok: true, id });
});

app.get('/orders', authMiddleware, (req, res) => {
  // if admin, return all; else only user's
  if (req.user.roles && req.user.roles.includes('admin')) {
    const rows = getOrdersStmt.all();
    return res.json(rows);
  } else {
    const rows = db.prepare('SELECT * FROM orders WHERE username = ? ORDER BY createdAt DESC').all(req.user.username);
    return res.json(rows);
  }
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`SNOW SHOP API listening on port ${PORT}`);
});
