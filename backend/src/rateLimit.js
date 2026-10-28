import { get, run } from './db.js';

const since = (minutes) => `to_char((now() at time zone 'utc') - interval '${minutes} minutes','YYYY-MM-DD HH24:MI:SS')`;

/**
 * Per-visitor limit for the public website endpoints: at most `max` requests per `minutes` in each bucket.
 * Counted in Postgres so it holds across serverless instances.
 */
export function rateLimit(bucket, max, minutes) {
  return async (req, res, next) => {
    // Vercel puts the visitor's address in x-real-ip; elsewhere req.ip comes from the proxy (see 'trust proxy' in app.js)
    const ip = (process.env.VERCEL && req.get('x-real-ip')) || req.ip || 'unknown';
    const { c } = await get(`SELECT COUNT(*) AS c FROM rate_limit_hits WHERE bucket=? AND ip=? AND created_at >= ${since(minutes)}`, [bucket, ip]);
    if (c >= max) return res.status(429).json({ error: 'Too many requests. Please try again a little later.' });
    await run(`DELETE FROM rate_limit_hits WHERE created_at < ${since(24 * 60)}`);
    await run('INSERT INTO rate_limit_hits (bucket, ip) VALUES (?, ?)', [bucket, ip]);
    next();
  };
}
