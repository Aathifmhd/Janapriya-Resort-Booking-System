import CrudPage from '../../components/CrudPage';
import { money, fmtDate, title, today } from '../../lib/format';

const CATS = ['utilities', 'maintenance', 'supplies', 'marketing', 'transport', 'licenses', 'salaries', 'statutory', 'purchases', 'breakage', 'rent', 'general'];

export default function Expenses() {
  return (
    <CrudPage
      title="Expenses" subtitle="Operating costs. Salaries, supplier payments and bottle breakages are posted here automatically."
      endpoint="/api/expenses"
      columns={[
        { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
        { key: 'category', label: 'Category', render: (r) => <span className="chip bg-slate-100 text-slate-700">{title(r.category)}</span> },
        { key: 'description', label: 'Description', render: (r) => <div><div className="font-medium">{r.description}</div><div className="text-xs text-slate-400">{r.paid_to}{r.reference ? ` · ${r.reference}` : ''}</div></div> },
        { key: 'method', label: 'Method', render: (r) => title(r.method) },
        { key: 'created_by_name', label: 'By', render: (r) => <span className="text-xs text-slate-500">{r.created_by_name || 'system'}</span> },
        { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => <span className="font-semibold text-rose-600">{money(r.amount)}</span> },
      ]}
      fields={[
        { key: 'description', label: 'Description', required: true, span: 2 }, { key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'category', label: 'Category', type: 'select', options: CATS }, { key: 'method', label: 'Paid by', type: 'select', options: ['cash', 'bank', 'card', 'cheque', 'other'] },
        { key: 'paid_to', label: 'Paid to' }, { key: 'reference', label: 'Receipt / reference' },
      ]}
      defaults={{ date: today(), category: 'general', method: 'cash' }}
    />
  );
}
