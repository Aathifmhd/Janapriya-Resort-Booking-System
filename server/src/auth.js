import jwt from 'jsonwebtoken';
import { get } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'janapriya-dev-secret-change-me';

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

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = get('SELECT id, name, email, role, active, employee_id FROM users WHERE id=?', [payload.id]);
    if (!user || !user.active) return res.status(401).json({ error: 'Account disabled' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireModule(moduleName) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (role === 'admin' || role === 'manager') return next();
    const allowed = MODULE_ACCESS[moduleName] || [];
    if (allowed.includes(role)) return next();
    return res.status(403).json({ error: `Your role (${role}) cannot access ${moduleName}` });
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}
