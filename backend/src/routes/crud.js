import { Router } from 'express';
import { all, get, insert, update, remove, audit } from '../db.js';

/**
 * Generic CRUD router factory.
 * opts: { table, fields (whitelist), listSql?, getSql?, orderBy?, beforeInsert?, beforeUpdate?, afterChange?, searchCols?, alias? }
 * listSql must not contain an outer WHERE (subqueries are fine) so filters can be appended.
 */
export function crud(opts) {
  const r = Router();
  const { table, fields, orderBy = 'id DESC', searchCols = [] } = opts;
  const prefix = opts.alias ? opts.alias + '.' : '';
  const listSql = opts.listSql || `SELECT * FROM ${table}`;
  const getSql = opts.getSql || `${listSql} WHERE ${prefix}id=?`;

  r.get('/', async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.q && searchCols.length) {
      where.push('(' + searchCols.map((c) => `${c} ILIKE ?`).join(' OR ') + ')');
      searchCols.forEach(() => params.push(`%${req.query.q}%`));
    }
    for (const [k, v] of Object.entries(req.query)) {
      if (['q', 'limit', 'offset', 'sort'].includes(k)) continue;
      if (fields.includes(k)) { where.push(`${prefix}${k}=?`); params.push(v); }
    }
    const sql = `${listSql}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy}${req.query.limit ? ` LIMIT ${parseInt(req.query.limit, 10)}` : ''}`;
    res.json(await all(sql, params));
  });

  r.get('/:id', async (req, res) => {
    const row = await get(getSql, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  r.post('/', async (req, res) => {
    const body = pick(req.body, fields);
    if (opts.beforeInsert) await opts.beforeInsert(body, req);
    const id = await insert(table, body);
    await audit(req, 'create', table, id, body);
    if (opts.afterChange) await opts.afterChange(id, req);
    res.status(201).json(await get(getSql, [id]));
  });

  r.put('/:id', async (req, res) => {
    const body = pick(req.body, fields);
    if (opts.beforeUpdate) await opts.beforeUpdate(body, req);
    await update(table, req.params.id, body);
    await audit(req, 'update', table, req.params.id, body);
    if (opts.afterChange) await opts.afterChange(req.params.id, req);
    res.json(await get(getSql, [req.params.id]));
  });

  r.delete('/:id', async (req, res) => {
    try {
      await remove(table, req.params.id);
      await audit(req, 'delete', table, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: 'Cannot delete: record is referenced elsewhere.' });
    }
  });
  return r;
}

export function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
}
