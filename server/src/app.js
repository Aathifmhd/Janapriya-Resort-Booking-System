import express from 'express';
import cors from 'cors';
import { ensureSchema } from './db.js';
import { requireAuth } from './auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import frontdeskRoutes from './routes/frontdesk.js';
import restaurantRoutes from './routes/restaurant.js';
import inventoryRoutes from './routes/inventory.js';
import hrRoutes from './routes/hr.js';
import financeRoutes from './routes/finance.js';
import adminRoutes from './routes/admin.js';

export const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// make sure tables exist (cached after the first call)
app.use('/api', async (req, res, next) => { try { await ensureSchema(); next(); } catch (e) { next(e); } });

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);

// everything below requires a signed-in staff user
app.use('/api', requireAuth);
app.use('/api', frontdeskRoutes);
app.use('/api', restaurantRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', hrRoutes);
app.use('/api', financeRoutes);
app.use('/api', adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: `No API route for ${req.method} ${req.path}` }));

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

export default app;
