import { Router } from 'express';
import { all, get, insert, update, remove, audit } from '../db.js';

/**
 * Generic CRUD router factory.
 * opts: { table, fields (whitelist), listSql?, getSql?, orderBy?, beforeInsert?, afterChange?, searchCols? }
 */
export function crud(opts) {
  const r = Router();
  const { table, fields, orderBy = 'id DESC', searchCols = [] } = opts;
  const prefix = opts.alias ? opts.alias + '.' : '';
  const listSql = opts.listSql || `SELECT * FROM ${table}`;
  // listSql must not contain an outer WHERE (subqueries are fine) so filters can be appended.
  const getSql = opts.getSql || `${listSql} WHERE ${prefix}id=?`;

  r.get('/', (req, res) => {
    const where = [];
    const params = [];
    if (req.query.q && searchCols.length) {
      where.push('(' + searchCols.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
      searchCols.forEach(() => params.push(`%${req.query.q}%`));
    }
    for (const [k, v] of Object.entries(req.query)) {
      if (['q', 'limit', 'offset', 'sort'].includes(k)) continue;
      if (fields.includes(k)) { where.push(`${prefix}${k}=?`); params.push(v); }
    }
    const sql = `${listSql}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy}${req.query.limit ? ` LIMIT ${parseInt(req.query.limit, 10)}` : ''}`;
    res.json(all(sql, params));
  });

  r.get('/:id', (req, res) => {
    const row = get(getSql, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  r.post('/', (req, res) => {
    const body = pick(req.body, fields);
    if (opts.beforeInsert) opts.beforeInsert(body, req);
    const id = insert(table, body);
    audit(req, 'create', table, id, body);
    opts.afterChange?.(id, req);
    res.status(201).json(get(getSql, [id]));
  });

  r.put('/:id', (req, res) => {
    const body = pick(req.body, fields);
    if (opts.beforeUpdate) opts.beforeUpdate(body, req);
    update(table, req.params.id, body);
    audit(req, 'update', table, req.params.id, body);
    opts.afterChange?.(req.params.id, req);
    res.json(get(getSql, [req.params.id]));
  });

  r.delete('/:id', (req, res) => {
    try {
      remove(table, req.params.id);
      audit(req, 'delete', table, req.params.id);
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
