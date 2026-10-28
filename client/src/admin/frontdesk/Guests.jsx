import { useState, useEffect } from 'react';
import { Star, History } from 'lucide-react';
import CrudPage from '../../components/CrudPage';
import { api } from '../../lib/api';
import { money, fmtDate } from '../../lib/format';
import { Modal, Badge } from '../../components/ui';
import { BookingDetail } from './Bookings';

export default function Guests() {
  const [hist, setHist] = useState(null);
  const [rows, setRows] = useState([]);
  const [openBooking, setOpenBooking] = useState(null);
  useEffect(() => { if (hist) api.get(`/api/guests/${hist.id}/bookings`).then(setRows); }, [hist]);
  return (
    <>
      <CrudPage
        title="Guests" subtitle="Guest profiles, stay history and lifetime value"
        endpoint="/api/guests"
        columns={[
          { key: 'name', label: 'Guest', render: (r) => <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-xs font-bold">{r.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div><div><div className="font-medium flex items-center gap-1">{r.name}{!!r.vip && <Star size={12} className="text-amber-500" fill="currentColor" />}</div><div className="text-xs text-slate-400">{r.nationality}</div></div></div> },
          { key: 'phone', label: 'Contact', render: (r) => <div><div>{r.phone}</div><div className="text-xs text-slate-400">{r.email}</div></div> },
          { key: 'nic_passport', label: 'NIC / Passport' },
          { key: 'stays', label: 'Stays', className: 'text-center' },
          { key: 'lifetime_value', label: 'Lifetime value', render: (r) => <span className="font-semibold">{money(r.lifetime_value, { decimals: 0 })}</span> },
          { key: 'last_visit', label: 'Last visit', render: (r) => fmtDate(r.last_visit) },
        ]}
        fields={[
          { key: 'name', label: 'Full name', required: true }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email', type: 'email' },
          { key: 'nic_passport', label: 'NIC / Passport' }, { key: 'nationality', label: 'Nationality' }, { key: 'address', label: 'Address' },
          { key: 'notes', label: 'Notes / preferences', type: 'textarea', span: 2 }, { key: 'vip', label: 'VIP', type: 'toggle', toggleLabel: 'VIP guest' },
        ]}
        defaults={{ nationality: 'Sri Lankan', vip: 0 }}
        extraActions={(r) => <button className="btn-ghost btn-sm" title="Stay history" onClick={() => setHist(r)}><History size={14} /></button>}
      />
      <Modal open={!!hist} onClose={() => setHist(null)} title={`${hist?.name} - stay history`} size="lg">
        <div className="table-wrap"><table className="data"><thead><tr><th>Ref</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Total</th><th>Status</th></tr></thead><tbody>
          {rows.map((b) => <tr key={b.id} className="cursor-pointer" onClick={() => setOpenBooking(b.id)}><td className="font-mono text-brand-800">{b.code}</td><td>{b.room_number || '-'} <span className="text-xs text-slate-400">{b.room_type_name}</span></td><td>{fmtDate(b.check_in)}</td><td>{fmtDate(b.check_out)}</td><td>{money(b.total, { decimals: 0 })}</td><td><Badge status={b.status} /></td></tr>)}
          {!rows.length && <tr><td colSpan={6} className="text-center text-slate-400 py-6">No bookings yet</td></tr>}
        </tbody></table></div>
      </Modal>
      <BookingDetail id={openBooking} onClose={() => setOpenBooking(null)} />
    </>
  );
}
