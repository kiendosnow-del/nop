/**
 * CLI: create-admin.js
 * Usage:
 *   1) copy .env.example -> .env, set ADMIN_USERNAME & ADMIN_PASSWORD (or pass via env)
 *   2) node create-admin.js
 *
 * This script initializes the DB (if missing) and inserts an admin user.
 * Run this from the server (not exposed via HTTP).
 */

require('dotenv').config();
const readline = require('readline');
const { init } = require('./db');
const bcrypt = require('bcrypt');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

async function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans); }));
}

(async function main(){
  const db = init(DB_FILE);
  const getUser = db.prepare('SELECT * FROM users WHERE username = ?');
  const insertUser = db.prepare('INSERT INTO users (username, password, balance, roles, createdAt) VALUES (?, ?, ?, ?, ?)');
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  const username = envUser || (await prompt('Admin username: '));
  const password = envPass || (await prompt('Admin password: '));

  if (!username || !password) {
    console.error('username & password required');
    process.exit(1);
  }

  const existing = getUser.get(username);
  if (existing) {
    console.log('User exists:', username);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  insertUser.run(username, hashed, 0, JSON.stringify(['admin']), Date.now());
  console.log('Admin created:', username);
  process.exit(0);
})();
