import { Router } from 'express';
import { all, get, insert, update, run, audit, nextCode, getSettings, transaction } from '../db.js';
import { requireModule } from '../auth.js';
import { crud } from './crud.js';

const r = Router();

r.use('/departments', requireModule('employees'), crud({
  table: 'departments', alias: 'd', fields: ['name'],
  listSql: 'SELECT d.*, (SELECT COUNT(*) FROM employees WHERE department_id=d.id AND status=\'active\') AS headcount FROM departments d', orderBy: 'd.name',
}));
r.use('/shifts', requireModule('employees'), crud({ table: 'shifts', fields: ['name', 'start_time', 'end_time'], orderBy: 'start_time' }));

r.use('/employees', requireModule('employees'), crud({
  table: 'employees', alias: 'e',
  fields: ['emp_code', 'name', 'email', 'phone', 'nic', 'department_id', 'designation', 'hire_date', 'salary_basic', 'allowances', 'status', 'address', 'emergency_contact', 'bank_details', 'shift_id'],
  listSql: `SELECT e.*, d.name AS department_name, s.name AS shift_name,
            (SELECT status FROM attendance WHERE employee_id=e.id AND date=date('now')) AS today_status
            FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN shifts s ON s.id=e.shift_id`,
  orderBy: 'e.emp_code', searchCols: ['e.name', 'e.emp_code', 'e.designation', 'e.phone'],
  beforeInsert: (b) => { if (!b.emp_code) b.emp_code = nextCode('EMP', 'employees', 'emp_code'); },
}));

r.get('/employees/:id/summary', requireModule('employees'), (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  res.json({
    attendance: all('SELECT * FROM attendance WHERE employee_id=? AND date LIKE ? ORDER BY date', [req.params.id, `${month}%`]),
    leaves: all('SELECT * FROM leaves WHERE employee_id=? ORDER BY from_date DESC LIMIT 20', [req.params.id]),
    payroll: all('SELECT * FROM payroll WHERE employee_id=? ORDER BY month DESC LIMIT 12', [req.params.id]),
  });
});

// ---------- Attendance ----------
r.get('/attendance', requireModule('attendance'), (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  if (req.query.month) {
    return res.json(all(`SELECT a.*, e.name AS employee_name, e.emp_code FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE a.date LIKE ? ORDER BY a.date, e.emp_code`, [`${req.query.month}%`]));
  }
  const rows = all(`SELECT e.id AS employee_id, e.emp_code, e.name, e.designation, d.name AS department_name, s.name AS shift_name, s.start_time, s.end_time,
      a.id AS attendance_id, a.check_in, a.check_out, a.status, a.hours, a.overtime_hours, a.note
      FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN shifts s ON s.id=e.shift_id
      LEFT JOIN attendance a ON a.employee_id=e.id AND a.date=? WHERE e.status='active' ORDER BY e.emp_code`, [date]);
  res.json(rows);
});

r.post('/attendance', requireModule('attendance'), (req, res) => {
  const { employee_id, date, status = 'present', check_in = null, check_out = null, note = '' } = req.body;
  if (!employee_id || !date) return res.status(400).json({ error: 'employee_id and date required' });
  const s = getSettings();
  let hours = 0; let overtime = 0;
  if (check_in && check_out) {
    const [h1, m1] = check_in.split(':').map(Number); const [h2, m2] = check_out.split(':').map(Number);
    hours = Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60); if (hours < 0) hours += 24;
    hours = Math.round(hours * 100) / 100;
    overtime = Math.max(0, hours - (Number(s.working_hours_per_day) || 8));
  } else if (status === 'present') hours = Number(s.working_hours_per_day) || 8;
  else if (status === 'half_day') hours = (Number(s.working_hours_per_day) || 8) / 2;
  const existing = get('SELECT id FROM attendance WHERE employee_id=? AND date=?', [employee_id, date]);
  if (existing) update('attendance', existing.id, { status, check_in, check_out, hours, overtime_hours: overtime, note });
  else insert('attendance', { employee_id, date, status, check_in, check_out, hours, overtime_hours: overtime, note });
  res.json({ ok: true });
});

r.post('/attendance/bulk', requireModule('attendance'), (req, res) => {
  const { date, status = 'present', employee_ids = [] } = req.body;
  transaction(() => {
    for (const id of employee_ids) {
      if (!get('SELECT id FROM attendance WHERE employee_id=? AND date=?', [id, date])) {
        insert('attendance', { employee_id: id, date, status, hours: status === 'present' ? 8 : 0 });
      }
    }
  });
  res.json({ ok: true });
});

// ---------- Leaves ----------
r.use('/leaves', requireModule('leaves'), crud({
  table: 'leaves', alias: 'l',
  fields: ['employee_id', 'type', 'from_date', 'to_date', 'days', 'reason', 'status'],
  listSql: 'SELECT l.*, e.name AS employee_name, e.emp_code FROM leaves l JOIN employees e ON e.id=l.employee_id',
  orderBy: "CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.from_date DESC",
  beforeInsert: (b) => { if (!b.days) b.days = Math.max(1, Math.round((new Date(b.to_date) - new Date(b.from_date)) / 86400000) + 1); },
  afterChange: (id) => {
    const l = get('SELECT * FROM leaves WHERE id=?', [id]);
    if (l?.status === 'approved') {
      // mark attendance as leave for each day
      const from = new Date(l.from_date); const to = new Date(l.to_date);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const date = d.toISOString().slice(0, 10);
        if (!get('SELECT id FROM attendance WHERE employee_id=? AND date=?', [l.employee_id, date])) insert('attendance', { employee_id: l.employee_id, date, status: 'leave', hours: 0, note: `${l.type} leave` });
      }
    }
  },
}));

// ---------- Payroll ----------
r.get('/payroll', requireModule('payroll'), (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  res.json(all('SELECT p.*, e.name AS employee_name, e.emp_code, e.designation, d.name AS department_name FROM payroll p JOIN employees e ON e.id=p.employee_id LEFT JOIN departments d ON d.id=e.department_id WHERE p.month=? ORDER BY e.emp_code', [month]));
});

/** Generate (or regenerate drafts of) payroll for a month from attendance. */
r.post('/payroll/generate', requireModule('payroll'), (req, res) => {
  const month = req.body.month || new Date().toISOString().slice(0, 7);
  const s = getSettings();
  const epfE = Number(s.epf_employee_rate) || 8, epfR = Number(s.epf_employer_rate) || 12, etfR = Number(s.etf_rate) || 3;
  const otMult = Number(s.overtime_multiplier) || 1.5; const wd = Number(s.working_days_per_month) || 26; const wh = Number(s.working_hours_per_day) || 8;
  let count = 0;
  transaction(() => {
    for (const e of all("SELECT * FROM employees WHERE status IN ('active','on_leave')")) {
      const existing = get('SELECT * FROM payroll WHERE employee_id=? AND month=?', [e.id, month]);
      if (existing && existing.status === 'paid') continue;
      const att = all('SELECT * FROM attendance WHERE employee_id=? AND date LIKE ?', [e.id, `${month}%`]);
      const absent = att.filter((a) => a.status === 'absent').length;
      const half = att.filter((a) => a.status === 'half_day').length;
      const otHours = att.reduce((a, x) => a + (x.overtime_hours || 0), 0);
      const dayRate = e.salary_basic / wd;
      const deductions = Math.round((absent + half * 0.5) * dayRate);
      const overtime = Math.round(otHours * (dayRate / wh) * otMult);
      const epf_employee = Math.round(e.salary_basic * epfE / 100);
      const epf_employer = Math.round(e.salary_basic * epfR / 100);
      const etf = Math.round(e.salary_basic * etfR / 100);
      const net = e.salary_basic + e.allowances + overtime - deductions - epf_employee;
      const row = { employee_id: e.id, month, basic: e.salary_basic, allowances: e.allowances, overtime, bonus: existing?.bonus || 0, deductions, epf_employee, epf_employer, etf, net: net + (existing?.bonus || 0), status: 'draft' };
      if (existing) update('payroll', existing.id, row); else insert('payroll', row);
      count++;
    }
  });
  audit(req, 'generate', 'payroll', month, { count });
  res.json({ ok: true, count, month });
});

r.put('/payroll/:id', requireModule('payroll'), (req, res) => {
  const p = get('SELECT * FROM payroll WHERE id=?', [req.params.id]);
  if (!p || p.status === 'paid') return res.status(400).json({ error: 'Cannot edit a paid payslip' });
  const bonus = req.body.bonus != null ? Number(req.body.bonus) : p.bonus;
  const deductions = req.body.deductions != null ? Number(req.body.deductions) : p.deductions;
  const overtime = req.body.overtime != null ? Number(req.body.overtime) : p.overtime;
  const net = p.basic + p.allowances + overtime + bonus - deductions - p.epf_employee;
  update('payroll', p.id, { bonus, deductions, overtime, net });
  res.json(get('SELECT * FROM payroll WHERE id=?', [p.id]));
});

r.post('/payroll/pay', requireModule('payroll'), (req, res) => {
  const { month, ids } = req.body;
  const rows = ids?.length ? all(`SELECT * FROM payroll WHERE id IN (${ids.map(() => '?').join(',')}) AND status='draft'`, ids) : all("SELECT * FROM payroll WHERE month=? AND status='draft'", [month]);
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  transaction(() => {
    for (const p of rows) {
      update('payroll', p.id, { status: 'paid', paid_at: now });
      const e = get('SELECT name FROM employees WHERE id=?', [p.employee_id]);
      insert('expenses', { category: 'salaries', description: `Salary ${p.month} - ${e.name}`, amount: p.net, date: now.slice(0, 10), paid_to: e.name, method: req.body.method || 'bank', reference: `PAY-${p.month}`, created_by: req.user.id });
      insert('expenses', { category: 'statutory', description: `EPF (12%) + ETF (3%) ${p.month} - ${e.name}`, amount: p.epf_employer + p.etf + p.epf_employee, date: now.slice(0, 10), paid_to: 'EPF / ETF Board', method: 'bank', reference: `EPF-${p.month}`, created_by: req.user.id });
    }
  });
  audit(req, 'pay', 'payroll', month, { count: rows.length });
  res.json({ ok: true, count: rows.length });
});

export default r;
