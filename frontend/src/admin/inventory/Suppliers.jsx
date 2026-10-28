import CrudPage from '../../components/CrudPage';
import { money, title } from '../../lib/format';

export default function Suppliers() {
  return (
    <CrudPage
      title="Suppliers" subtitle="Breweries, distilleries, produce and general suppliers"
      endpoint="/api/suppliers"
      columns={[
        { key: 'name', label: 'Supplier', render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.contact_person}</div></div> },
        { key: 'category', label: 'Category', render: (r) => <span className="chip bg-slate-100 text-slate-700">{title(r.category)}</span> },
        { key: 'phone', label: 'Contact', render: (r) => <div><div>{r.phone}</div><div className="text-xs text-slate-400">{r.email}</div></div> },
        { key: 'purchase_count', label: 'Purchases', className: 'text-center' },
        { key: 'outstanding', label: 'Outstanding', render: (r) => <span className={`font-semibold ${r.outstanding > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{money(r.outstanding, { decimals: 0 })}</span> },
      ]}
      fields={[
        { key: 'name', label: 'Supplier name', required: true }, { key: 'category', label: 'Category', type: 'select', options: ['beer', 'liquor', 'wine', 'soft_drink', 'food', 'general'] },
        { key: 'contact_person', label: 'Contact person' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'address', label: 'Address' },
        { key: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ]}
      defaults={{ category: 'general' }}
    />
  );
}
