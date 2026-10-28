import CrudPage from '../../components/CrudPage';
import { money } from '../../lib/format';

export default function RoomTypes() {
  return (
    <CrudPage
      title="Room Types" subtitle="Categories shown on the website with rates and amenities"
      endpoint="/api/room-types" searchable={false}
      columns={[
        { key: 'image', label: '', render: (r) => <img src={r.image_url} alt="" className="h-12 w-16 rounded-lg object-cover bg-slate-100" /> },
        { key: 'name', label: 'Name', render: (r) => <div><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-400 line-clamp-1 max-w-xs">{r.description}</div></div> },
        { key: 'base_rate', label: 'Rate / night', render: (r) => <span className="font-semibold">{money(r.base_rate, { decimals: 0 })}</span> },
        { key: 'cap', label: 'Capacity', render: (r) => `${r.max_adults} adults, ${r.max_children} children` },
        { key: 'size_sqm', label: 'Size', render: (r) => `${r.size_sqm || '-'} m²` },
        { key: 'room_count', label: 'Rooms', className: 'text-center' },
        { key: 'active', label: 'Website', render: (r) => <span className={`chip ${r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{r.active ? 'Visible' : 'Hidden'}</span> },
      ]}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'base_rate', label: 'Base rate per night', type: 'number', required: true },
        { key: 'description', label: 'Description', type: 'textarea', span: 2 },
        { key: 'max_adults', label: 'Max adults', type: 'number' },
        { key: 'max_children', label: 'Max children', type: 'number' },
        { key: 'size_sqm', label: 'Size (m²)', type: 'number' },
        { key: 'image_url', label: 'Image URL' },
        { key: 'amenities', label: 'Amenities (comma separated)', span: 2, hint: 'e.g. Air conditioning, Lake view, Mini bar', parse: (v) => { try { return (typeof v === 'string' && v.startsWith('[') ? JSON.parse(v) : v || []).join(', '); } catch { return v || ''; } } },
        { key: 'active', label: 'Show on website', type: 'toggle', toggleLabel: 'Visible to customers' },
      ]}
      defaults={{ max_adults: 2, max_children: 1, active: 1, amenities: '' }}
      transform={(f) => ({ ...f, amenities: Array.isArray(f.amenities) ? f.amenities : typeof f.amenities === 'string' && f.amenities.startsWith('[') ? JSON.parse(f.amenities) : String(f.amenities || '').split(',').map((s) => s.trim()).filter(Boolean) })}
    />
  );
}
