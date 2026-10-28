import { useEffect, useState } from 'react';
import CrudPage from '../../components/CrudPage';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDateTime, title } from '../../lib/format';
import { Badge } from '../../components/ui';

const ROLE_DESC = { admin: 'Full access incl. users & settings', manager: 'Full access to all modules', frontdesk: 'Bookings, rooms, guests, housekeeping, payments', restaurant: 'Tables, POS, menu, orders, reservations', bar: 'Bar POS, orders, stock & empty bottles', housekeeping: 'Room status & cleaning tasks', hr: 'Employees, attendance, leave, payroll', accounts: 'Invoices, payments, expenses, reports, suppliers', store: 'Inventory, purchases, suppliers, empties' };

export default function Users() {
  const { user } = useAuth();
  const [emps, setEmps] = useState([]);
  useEffect(() => { api.get('/api/employees').then(setEmps).catch(() => {}); }, []);
  const isAdmin = user.role === 'admin';
  return (
    <div>
      <CrudPage
        title="Users & Roles" subtitle="Staff logins for the portal. Each role only sees its own modules."
        endpoint="/api/users" searchable={false} canCreate={isAdmin} canEdit={isAdmin} canDelete={isAdmin} createLabel="Add user"
        columns={[
          { key: 'name', label: 'User', render: (r) => <div><div className="font-medium">{r.name}{r.id === user.id && <span className="ml-2 chip bg-brand-100 text-brand-800">you</span>}</div><div className="text-xs text-slate-400">{r.email}</div></div> },
          { key: 'role', label: 'Role', render: (r) => <div><Badge status={r.role}>{title(r.role)}</Badge><div className="text-[11px] text-slate-400 mt-0.5">{ROLE_DESC[r.role]}</div></div> },
          { key: 'employee_name', label: 'Linked employee', render: (r) => r.employee_name || <span className="text-slate-300">-</span> },
          { key: 'created_at', label: 'Created', render: (r) => fmtDateTime(r.created_at) },
          { key: 'active', label: 'Status', render: (r) => <span className={`chip ${r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{r.active ? 'Active' : 'Disabled'}</span> },
        ]}
        fields={[
          { key: 'name', label: 'Name', required: true }, { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'password', label: 'Password', type: 'password', hint: 'Leave blank to keep the current password when editing' },
          { key: 'role', label: 'Role', type: 'select', required: true, options: Object.keys(ROLE_DESC).map((r) => ({ value: r, label: `${title(r)} - ${ROLE_DESC[r]}` })) },
          { key: 'employee_id', label: 'Link to employee', type: 'select', options: emps.map((e) => ({ value: e.id, label: `${e.name} (${e.emp_code})` })), placeholder: 'None' },
          { key: 'active', label: 'Active', type: 'toggle', toggleLabel: 'Can sign in' },
        ]}
        defaults={{ role: 'frontdesk', active: 1 }}
        transform={(f) => ({ ...f, password: f.password || undefined, employee_id: f.employee_id || null })}
      />
    </div>
  );
}
