import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { get, update, audit } from '../db.js';
import { signToken, requireAuth, modulesFor } from '../auth.js';

const r = Router();

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await get('SELECT * FROM users WHERE email=?', [String(email || '').toLowerCase().trim()]);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.active) return res.status(403).json({ error: 'Account disabled' });
  const token = signToken(user);
  await audit({ user }, 'login', 'users', user.id);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, modules: modulesFor(user.role) } });
});

r.get('/me', requireAuth, (req, res) => res.json({ ...req.user, modules: modulesFor(req.user.role) }));

r.post('/change-password', requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  const user = await get('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (!bcrypt.compareSync(current || '', user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (!next || next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  await update('users', user.id, { password_hash: bcrypt.hashSync(next, 10) });
  res.json({ ok: true });
});

export default r;
