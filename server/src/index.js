import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import './db.js';
import { seedIfEmpty } from './seed.js';
import { requireAuth } from './auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import frontdeskRoutes from './routes/frontdesk.js';
import restaurantRoutes from './routes/restaurant.js';
import inventoryRoutes from './routes/inventory.js';
import hrRoutes from './routes/hr.js';
import financeRoutes from './routes/finance.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

if (seedIfEmpty()) console.log('✔ Seeded database with demo data');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

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

// Serve the built client in production
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`\n🏨 Janapriya Resort API running at http://localhost:${PORT}`);
  if (fs.existsSync(dist)) console.log(`🌐 Website + staff portal served at http://localhost:${PORT}`);
});
