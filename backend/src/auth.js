import jwt from 'jsonwebtoken';
import { get } from './db.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set (a long random string that signs staff logins)');
export const JWT_SECRET = process.env.JWT_SECRET;

export const ROLES = ['admin', 'manager', 'frontdesk', 'restaurant', 'bar', 'housekeeping', 'hr', 'accounts', 'store'];

// Which roles may access which module prefix. Admin & manager can access everything.
export const MODULE_ACCESS = {
  rooms: ['frontdesk', 'housekeeping'],
  'room-types': ['frontdesk'],
  bookings: ['frontdesk'],
  guests: ['frontdesk', 'restaurant'],
  housekeeping: ['frontdesk', 'housekeeping'],
  tables: ['restaurant', 'bar'],
  menu: ['restaurant', 'bar'],
  orders: ['restaurant', 'bar', 'frontdesk'],
  inventory: ['store', 'bar', 'restaurant'],
  suppliers: ['store', 'accounts'],
  purchases: ['store', 'accounts'],
  'empty-bottles': ['store', 'bar'],
  employees: ['hr'],
  attendance: ['hr'],
  leaves: ['hr'],
  payroll: ['hr', 'accounts'],
  expenses: ['accounts'],
  invoices: ['accounts', 'frontdesk', 'restaurant'],
  payments: ['accounts', 'frontdesk', 'restaurant', 'bar'],
  reports: ['accounts'],
  dashboard: ROLES,
  settings: [],
  users: [],
  audit: [],
};

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });
}

export async function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid or expired session' }); }
  const user = await get('SELECT id, name, email, role, active, employee_id FROM users WHERE id=?', [payload.id]);
  if (!user || !user.active) return res.status(401).json({ error: 'Account disabled' });
  req.user = user;
  next();
}

/**
 * Allow admin, manager and the roles listed for moduleName. `readAlso` lets the roles of other
 * modules make GET requests too, for lookups their pages need (e.g. the supplier list on the stock page).
 */
export function requireModule(moduleName, { readAlso = [] } = {}) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (role === 'admin' || role === 'manager') return next();
    const modules = req.method === 'GET' ? [moduleName, ...readAlso] : [moduleName];
    if (modules.some((m) => (MODULE_ACCESS[m] || []).includes(role))) return next();
    return res.status(403).json({ error: `Your role (${role}) cannot access ${moduleName}` });
  };
}

/** Module keys a role can use. Sent to the client so the menu only shows pages that will load. */
export function modulesFor(role) {
  if (role === 'admin' || role === 'manager') return Object.keys(MODULE_ACCESS);
  return Object.keys(MODULE_ACCESS).filter((m) => MODULE_ACCESS[m].includes(role));
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}
