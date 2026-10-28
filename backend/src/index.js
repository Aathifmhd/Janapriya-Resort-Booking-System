// Local / VPS entry point: serves the API and the built website from one process.
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { ensureSchema } from './db.js';
import { seedIfEmpty } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

await ensureSchema();
if (await seedIfEmpty()) console.log('✔ Seeded database with demo data');

app.listen(PORT, () => {
  console.log(`\n🏨 Janapriya Resort API running at http://localhost:${PORT}`);
  if (fs.existsSync(dist)) console.log(`🌐 Website + staff portal served at http://localhost:${PORT}`);
});
