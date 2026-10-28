import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BedDouble, Plus, Wrench, Sparkles, UserCheck, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { money, fmtDate, title } from '../../lib/format';
import { PageHeader, Badge, Tabs, Modal, Field, Input, Select, Textarea, useToast, Skeleton } from '../../components/ui';
import { BookingDetail, NewBooking } from './Bookings';

const STATUSES = ['available', 'occupied', 'dirty', 'cleaning', 'maintenance', 'out_of_order'];
const TILE = { available: 'border-emerald-200 bg-emerald-50/60', occupied: 'border-sky-200 bg-sky-50/60', dirty: 'border-amber-200 bg-amber-50/60', cleaning: 'border-violet-200 bg-violet-50/60', maintenance: 'border-rose-200 bg-rose-50/60', out_of_order: 'border-slate-300 bg-slate-100' };

export default function Rooms() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [rooms, setRooms] = useState(null);
  const [types, setTypes] = useState([]);
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [openBooking, setOpenBooking] = useState(null);
  const [newBooking, setNewBooking] = useState(null);
  const filter = params.get('status') || '';

  const load = () => Promise.all([api.get('/api/rooms'), api.get('/api/room-types')]).then(([r, t]) => { setRooms(r); setTypes(t); }).catch((e) => toast.error(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const setStatus = async (room, status, notes) => { try { await api.post(`/api/rooms/${room.id}/status`, { status, notes }); toast.success(`Room ${room.number} marked ${title(status)}`); setSel(null); load(); } catch (e) { toast.error(e.message); } };
  const save = async () => { try { if (edit.id) await api.put(`/api/rooms/${edit.id}`, edit); else await api.post('/api/rooms', edit); toast.success('Saved'); setEdit(null); load(); } catch (e) { toast.error(e.message); } };

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: rooms?.filter((r) => r.status === s).length || 0 }), {});
  const shown = rooms?.filter((r) => !filter || r.status === filter) || [];
  const floors = [...new Set(shown.map((r) => r.floor))].sort();

  return (
    <div>
      <PageHeader title="Rooms" subtitle="Live room status board" actions={<button className="btn-primary" onClick={() => setEdit({ number: '', room_type_id: types[0]?.id || '', floor: 1, status: 'available', notes: '' })}><Plus size={16} /> Add room</button>} />
      <div className="mb-4"><Tabs tabs={[{ value: '', label: 'All', count: rooms?.length }, ...STATUSES.map((s) => ({ value: s, label: title(s), count: counts[s] }))]} value={filter} onChange={(v) => setParams(v ? { status: v } : {})} /></div>
      {!rooms ? <Skeleton /> : floors.map((fl) => (
        <div key={fl} className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{fl === 0 ? 'Villas' : `Floor ${fl}`}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {shown.filter((r) => r.floor === fl).map((r, i) => (
              <motion.button key={r.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }} onClick={() => setSel(r)} className={`room-tile ${TILE[r.status]}`}>
                <div className="flex items-start justify-between"><div className="font-display text-2xl font-semibold text-slate-900">{r.number}</div><Badge status={r.status} className="!text-[10px]" /></div>
                <div className="text-xs text-slate-500 mt-1">{r.type_name}</div>
                {r.current_guest && <div className="mt-2 text-xs flex items-center gap-1 text-sky-800 font-medium"><UserCheck size={12} /> {r.current_guest}<span className="text-slate-400 font-normal"> · out {fmtDate(r.current_check_out).slice(0, 6)}</span></div>}
                {!r.current_guest && r.next_arrival && <div className="mt-2 text-[11px] text-slate-500">Next arrival {fmtDate(r.next_arrival)}</div>}
                {r.notes && <div className="mt-1 text-[11px] text-rose-600 truncate">{r.notes}</div>}
              </motion.button>
            ))}
          </div>
        </div>
      ))}

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `Room ${sel.number} · ${sel.type_name}` : ''} size="sm">
        {sel && (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><Badge status={sel.status} /><span className="text-sm text-slate-500">{money(sel.base_rate, { decimals: 0 })}/night</span></div>
            {sel.current_booking_id && <button className="btn-primary w-full" onClick={() => { setOpenBooking(sel.current_booking_id); setSel(null); }}><UserCheck size={16} /> Open {sel.current_guest}'s folio</button>}
            {sel.status === 'available' && <button className="btn-primary w-full" onClick={() => { setNewBooking({ room_type_id: sel.room_type_id, room_id: sel.id }); setSel(null); }}><BedDouble size={16} /> Walk-in booking</button>}
            <div>
              <div className="label">Change status</div>
              <div className="grid grid-cols-2 gap-2">
                {sel.status !== 'occupied' && STATUSES.filter((s) => s !== 'occupied' && s !== sel.status).map((s) => <button key={s} className="btn-secondary btn-sm justify-start" onClick={() => setStatus(sel, s)}>{s === 'maintenance' ? <Wrench size={13} /> : s === 'available' ? <Sparkles size={13} /> : null}{title(s)}</button>)}
                {sel.status === 'occupied' && <p className="text-xs text-slate-500 col-span-2">Room is occupied. Check the guest out to change its status.</p>}
              </div>
            </div>
            <button className="btn-ghost w-full" onClick={() => { setEdit({ id: sel.id, number: sel.number, room_type_id: sel.room_type_id, floor: sel.floor, status: sel.status, notes: sel.notes || '' }); setSel(null); }}><Pencil size={14} /> Edit room details</button>
          </div>
        )}
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit room' : 'Add room'} size="sm" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
        {edit && <div className="space-y-3">
          <Field label="Room number"><Input value={edit.number} onChange={(e) => setEdit({ ...edit, number: e.target.value })} /></Field>
          <Field label="Room type"><Select value={edit.room_type_id} onChange={(e) => setEdit({ ...edit, room_type_id: Number(e.target.value) })} options={types.map((t) => ({ value: t.id, label: t.name }))} /></Field>
          <Field label="Floor (0 = villas)"><Input type="number" value={edit.floor} onChange={(e) => setEdit({ ...edit, floor: Number(e.target.value) })} /></Field>
          <Field label="Notes"><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
        </div>}
      </Modal>
      <BookingDetail id={openBooking} onClose={() => { setOpenBooking(null); load(); }} />
      <NewBooking open={!!newBooking} preset={newBooking || {}} onClose={() => setNewBooking(null)} onCreated={(b) => { setNewBooking(null); load(); setOpenBooking(b.id); }} />
    </div>
  );
}
