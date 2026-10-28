import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, LogIn, LogOut, Ban, Check, Loader2, Printer, Trash2, CreditCard, PlusCircle, Pencil } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { money, fmtDate, fmtDateTime, today, addDays, nightsBetween } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { PageHeader, DataTable, Badge, Tabs, SearchBox, Modal, Field, Input, Select, Textarea, useToast, Confirm } from '../../components/ui';

const VIEWS = [{ value: '', label: 'All' }, { value: 'arrivals', label: 'Arrivals' }, { value: 'inhouse', label: 'In-house' }, { value: 'departures', label: 'Departures' }, { value: 'pending', label: 'Website requests' }];

export default function Bookings() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const view = params.get('view') || '';
  const [openId, setOpenId] = useState(params.get('open') ? Number(params.get('open')) : null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const query = view === 'pending' ? { status: 'pending', q } : { view, q };
    api.get(`/api/bookings${qs(query)}`).then(setRows).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [view, q, toast]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const columns = [
    { key: 'code', label: 'Ref', render: (r) => <span className="font-mono font-semibold text-brand-800">{r.code}</span> },
    { key: 'guest_name', label: 'Guest', render: (r) => <div><div className="font-medium">{r.guest_name}</div><div className="text-xs text-slate-400">{r.guest_phone}</div></div> },
    { key: 'room', label: 'Room', render: (r) => <div><div className="font-medium">{r.room_number ? `Room ${r.room_number}` : '-'}</div><div className="text-xs text-slate-400">{r.room_type_name}</div></div> },
    { key: 'check_in', label: 'Check-in', render: (r) => fmtDate(r.check_in) },
    { key: 'check_out', label: 'Check-out', render: (r) => fmtDate(r.check_out) },
    { key: 'nights', label: 'Nights', className: 'text-center' },
    { key: 'source', label: 'Source', render: (r) => <span className="capitalize text-slate-500">{r.source}</span> },
    { key: 'total', label: 'Total', className: 'text-right', render: (r) => <div className="text-right"><div className="font-semibold">{money(r.total, { decimals: 0 })}</div>{r.total - r.paid > 1 && r.status !== 'cancelled' && <div className="text-[11px] text-rose-600">Due {money(r.total - r.paid, { decimals: 0 })}</div>}</div> },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Reservations, arrivals, departures and in-house guests" actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New booking</button>} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs tabs={VIEWS} value={view} onChange={(v) => setParams(v ? { view: v } : {})} />
        <SearchBox value={q} onChange={setQ} placeholder="Search ref, guest, phone, room..." className="w-72" />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => setOpenId(r.id)} />
      <BookingDetail id={openId} onClose={() => { setOpenId(null); load(); }} />
      <NewBooking open={creating} onClose={() => setCreating(false)} onCreated={(b) => { setCreating(false); load(); setOpenId(b.id); }} />
    </div>
  );
}

// ================= Booking detail drawer =================
export function BookingDetail({ id, onClose }) {
  const toast = useToast();
  const { settings } = useAuth();
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState(null);
  const [charge, setCharge] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => id && api.get(`/api/bookings/${id}`).then(setB).catch((e) => toast.error(e.message)), [id, toast]);
  useEffect(() => { setB(null); load(); }, [load]);

  const setStatus = async (status, extra = {}) => {
    setBusy(true);
    try { setB(await api.post(`/api/bookings/${id}/status`, { status, ...extra })); toast.success(`Booking ${status.replace('_', ' ')}`); } catch (e) {
      if (e.message.includes('Outstanding balance')) setConfirm({ title: 'Outstanding balance', message: e.message + ' Check out anyway and leave the balance due?', onConfirm: () => setStatus('checked_out', { allow_balance: true }) });
      else if (e.message.includes('Room is')) setConfirm({ title: 'Room not ready', message: e.message, onConfirm: () => setStatus('checked_in', { force: true }) });
      else toast.error(e.message);
    } finally { setBusy(false); }
  };
  const addPayment = async () => { try { setB(await api.post(`/api/bookings/${id}/payments`, pay)); setPay(null); toast.success('Payment recorded'); } catch (e) { toast.error(e.message); } };
  const addCharge = async () => { try { setB(await api.post(`/api/bookings/${id}/charges`, charge)); setCharge(null); toast.success('Charge added'); } catch (e) { toast.error(e.message); } };
  const removeCharge = async (cid) => { try { setB(await api.del(`/api/bookings/${id}/charges/${cid}`)); } catch (e) { toast.error(e.message); } };
  const saveEdit = async () => { try { setB(await api.put(`/api/bookings/${id}`, edit)); setEdit(null); toast.success('Booking updated'); } catch (e) { toast.error(e.message); } };

  const open = !!id;
  return (
    <Modal open={open} onClose={onClose} title={b ? <span className="flex items-center gap-3">Booking <span className="font-mono text-brand-800">{b.code}</span><Badge status={b.status} /></span> : 'Booking'} size="xl">
      {!b ? <div className="skeleton h-64" /> : (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Info label="Guest" value={<><div className="font-semibold">{b.guest_name}</div><div className="text-xs text-slate-500">{b.guest_phone} · {b.guest_email || 'no email'}</div><div className="text-xs text-slate-500">{b.nationality} · {b.nic_passport || 'no ID'}</div></>} />
              <Info label="Room" value={<><div className="font-semibold">{b.room_number ? `Room ${b.room_number}` : 'Not assigned'}</div><div className="text-xs text-slate-500">{b.room_type_name}</div></>} />
              <Info label="Stay" value={<><div className="font-semibold">{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</div><div className="text-xs text-slate-500">{b.nights} nights · {b.adults} adults, {b.children} children</div></>} />
              <Info label="Source / Rate" value={<><div className="font-semibold capitalize">{b.source}</div><div className="text-xs text-slate-500">{money(b.rate)} per night</div></>} />
              {b.special_requests && <Info label="Special requests" value={b.special_requests} className="sm:col-span-2" />}
              {(b.checked_in_at || b.checked_out_at) && <Info label="Timeline" value={<div className="text-xs">{b.checked_in_at && <div>Checked in {fmtDateTime(b.checked_in_at)}</div>}{b.checked_out_at && <div>Checked out {fmtDateTime(b.checked_out_at)}</div>}</div>} />}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-slate-800">Folio / charges</h4>{['pending', 'confirmed', 'checked_in'].includes(b.status) && <button className="btn-secondary btn-sm" onClick={() => setCharge({ description: '', amount: '', type: 'service' })}><PlusCircle size={14} /> Add charge</button>}</div>
              <div className="table-wrap"><table className="data"><thead><tr><th>Description</th><th>Type</th><th className="text-right">Amount</th><th></th></tr></thead><tbody>
                {b.charges.map((c) => <tr key={c.id}><td>{c.description}</td><td><span className="capitalize text-slate-500">{c.type}</span></td><td className="text-right font-medium">{money(c.amount)}</td><td className="text-right">{c.type !== 'room' && b.status !== 'checked_out' && <button className="btn-ghost btn-sm text-rose-600" onClick={() => removeCharge(c.id)}><Trash2 size={13} /></button>}</td></tr>)}
              </tbody></table></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><h4 className="font-semibold text-slate-800">Payments</h4>{b.status !== 'cancelled' && <button className="btn-secondary btn-sm" onClick={() => setPay({ amount: Math.max(0, b.balance).toFixed(2), method: 'cash', reference: '', note: '' })}><CreditCard size={14} /> Record payment</button>}</div>
              {b.payments.length === 0 ? <div className="text-sm text-slate-400 py-3">No payments yet</div> : (
                <div className="table-wrap"><table className="data"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>By</th><th className="text-right">Amount</th></tr></thead><tbody>
                  {b.payments.map((p) => <tr key={p.id}><td>{fmtDateTime(p.created_at)}</td><td className="capitalize">{p.method}</td><td className="text-slate-500">{p.reference || p.note || '-'}</td><td className="text-slate-500">{p.received_by_name || '-'}</td><td className="text-right font-medium text-emerald-700">{money(p.amount)}</td></tr>)}
                </tbody></table></div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl bg-slate-900 text-white p-5">
              <div className="text-xs uppercase tracking-wider text-white/50">Folio summary</div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-white/70"><span>Charges</span><span>{money(b.folio_subtotal)}</span></div>
                {b.discount > 0 && <div className="flex justify-between text-white/70"><span>Discount</span><span>- {money(b.discount)}</span></div>}
                <div className="flex justify-between text-white/70"><span>Tax ({settings?.tax_rate}%)</span><span>{money(b.folio_tax)}</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10"><span>Total</span><span>{money(b.folio_total)}</span></div>
                <div className="flex justify-between text-emerald-300"><span>Paid</span><span>{money(b.paid)}</span></div>
                <div className={`flex justify-between font-semibold ${b.balance > 1 ? 'text-amber-300' : 'text-emerald-300'}`}><span>Balance</span><span>{money(b.balance)}</span></div>
              </div>
            </div>
            <div className="card p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Actions</div>
              {b.status === 'pending' && <button className="btn-primary w-full" disabled={busy} onClick={() => setStatus('confirmed')}><Check size={16} /> Confirm booking</button>}
              {['pending', 'confirmed'].includes(b.status) && <button className="btn-primary w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" disabled={busy} onClick={() => setStatus('checked_in')}>{busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Check in</button>}
              {b.status === 'checked_in' && <button className="btn-primary w-full" disabled={busy} onClick={() => setStatus('checked_out')}>{busy ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} Check out</button>}
              {['pending', 'confirmed', 'checked_in'].includes(b.status) && <button className="btn-secondary w-full" onClick={() => setEdit({ check_in: b.check_in, check_out: b.check_out, adults: b.adults, children: b.children, rate: b.rate, discount: b.discount, special_requests: b.special_requests || '', room_id: b.room_id || '' })}><Pencil size={16} /> Edit booking</button>}
              {['pending', 'confirmed'].includes(b.status) && <><button className="btn-ghost w-full text-rose-600" onClick={() => setConfirm({ title: 'Cancel booking', message: 'Cancel this reservation?', onConfirm: () => setStatus('cancelled') })}><Ban size={16} /> Cancel</button><button className="btn-ghost w-full text-slate-500" onClick={() => setStatus('no_show')}>Mark as no-show</button></>}
              <button className="btn-secondary w-full" onClick={() => window.print()}><Printer size={16} /> Print folio</button>
            </div>
            {b.orders?.length > 0 && <div className="card p-4"><div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">F&B orders</div>{b.orders.map((o) => <div key={o.id} className="flex justify-between text-sm py-1"><span className="font-mono">{o.code}</span><span><Badge status={o.status} /> {money(o.total, { decimals: 0 })}</span></div>)}</div>}
          </div>
        </div>
      )}

      <Modal open={!!pay} onClose={() => setPay(null)} title="Record payment" size="sm" footer={<><button className="btn-secondary" onClick={() => setPay(null)}>Cancel</button><button className="btn-primary" onClick={addPayment}>Save payment</button></>}>
        {pay && <div className="space-y-3">
          <Field label="Amount"><Input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
          <Field label="Method"><Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} options={['cash', 'card', 'bank', 'online']} /></Field>
          <Field label="Reference"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="Card slip / transfer ref" /></Field>
          <Field label="Note"><Input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field>
        </div>}
      </Modal>
      <Modal open={!!charge} onClose={() => setCharge(null)} title="Add charge to folio" size="sm" footer={<><button className="btn-secondary" onClick={() => setCharge(null)}>Cancel</button><button className="btn-primary" onClick={addCharge}>Add</button></>}>
        {charge && <div className="space-y-3">
          <Field label="Description"><Input value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} placeholder="Laundry, airport transfer, mini bar..." /></Field>
          <Field label="Amount"><Input type="number" step="0.01" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} /></Field>
          <Field label="Type"><Select value={charge.type} onChange={(e) => setCharge({ ...charge, type: e.target.value })} options={['service', 'restaurant', 'bar', 'minibar', 'laundry', 'transport', 'other']} /></Field>
        </div>}
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit booking" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={saveEdit}>Save changes</button></>}>
        {edit && b && <EditForm edit={edit} setEdit={setEdit} booking={b} />}
      </Modal>
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.onConfirm} title={confirm?.title} message={confirm?.message} confirmText="Proceed" />
    </Modal>
  );
}

function EditForm({ edit, setEdit, booking }) {
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    if (nightsBetween(edit.check_in, edit.check_out) < 1) return;
    api.get(`/api/bookings/availability${qs({ check_in: edit.check_in, check_out: edit.check_out, exclude: booking.id })}`).then((types) => setRooms(types.find((t) => t.id === booking.room_type_id)?.rooms || [])).catch(() => {});
  }, [edit.check_in, edit.check_out, booking]);
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Check-in"><Input type="date" value={edit.check_in} onChange={(e) => setEdit({ ...edit, check_in: e.target.value })} disabled={booking.status === 'checked_in'} /></Field>
      <Field label="Check-out"><Input type="date" value={edit.check_out} onChange={(e) => setEdit({ ...edit, check_out: e.target.value })} /></Field>
      <Field label="Adults"><Input type="number" min={1} value={edit.adults} onChange={(e) => setEdit({ ...edit, adults: Number(e.target.value) })} /></Field>
      <Field label="Children"><Input type="number" min={0} value={edit.children} onChange={(e) => setEdit({ ...edit, children: Number(e.target.value) })} /></Field>
      <Field label="Room"><Select value={edit.room_id} onChange={(e) => setEdit({ ...edit, room_id: e.target.value })} placeholder="Auto-assign">{rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} ({r.status})</option>)}</Select></Field>
      <Field label="Rate per night"><Input type="number" value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: Number(e.target.value) })} /></Field>
      <Field label="Discount (amount)"><Input type="number" value={edit.discount} onChange={(e) => setEdit({ ...edit, discount: Number(e.target.value) })} /></Field>
      <Field label="Special requests" className="sm:col-span-2"><Textarea value={edit.special_requests} onChange={(e) => setEdit({ ...edit, special_requests: e.target.value })} /></Field>
    </div>
  );
}

const Info = ({ label, value, className = '' }) => <div className={`rounded-xl bg-slate-50 p-3 ${className}`}><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-sm text-slate-800">{value}</div></div>;

// ================= New booking (staff) =================
export function NewBooking({ open, onClose, onCreated, preset = {} }) {
  const toast = useToast();
  const { settings } = useAuth();
  const taxMul = 1 + (Number(settings?.tax_rate) || 0) / 100;
  const [f, setF] = useState({});
  const [types, setTypes] = useState([]);
  const [guests, setGuests] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ check_in: today(), check_out: addDays(today(), 1), adults: 2, children: 0, room_type_id: '', room_id: '', source: 'walkin', status: 'confirmed', guest_id: '', guest: { name: '', phone: '', email: '', nic_passport: '', nationality: 'Sri Lankan' }, rate: '', discount: 0, special_requests: '', ...preset }); }, [open, preset]);
  useEffect(() => {
    if (!open || !f.check_in || !f.check_out || nightsBetween(f.check_in, f.check_out) < 1) return;
    api.get(`/api/bookings/availability${qs({ check_in: f.check_in, check_out: f.check_out, adults: f.adults, children: f.children })}`).then(setTypes).catch(() => {});
  }, [open, f.check_in, f.check_out, f.adults, f.children]);
  const searchGuest = (q) => { setF((s) => ({ ...s, guest: { ...s.guest, name: q }, guest_id: '' })); if (q.length >= 2) api.get(`/api/guests?q=${encodeURIComponent(q)}&limit=6`).then(setGuests).catch(() => {}); else setGuests([]); };
  const type = types.find((t) => t.id === Number(f.room_type_id));
  const nights = nightsBetween(f.check_in, f.check_out);
  const rate = f.rate !== '' ? Number(f.rate) : type?.base_rate || 0;

  const submit = async () => {
    if (!f.room_type_id) return toast.error('Select a room type');
    if (!f.guest_id && !f.guest.name) return toast.error('Guest name is required');
    setBusy(true);
    try {
      const body = { ...f, rate: f.rate === '' ? undefined : Number(f.rate), room_id: f.room_id || undefined, guest_id: f.guest_id || undefined };
      const b = await api.post('/api/bookings', body);
      toast.success(`Booking ${b.code} created`); onCreated?.(b);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New booking" size="lg" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submit}>{busy && <Loader2 size={16} className="animate-spin" />}Create booking</button></>}>
      {f.guest && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-4 gap-3">
            <Field label="Check-in"><Input type="date" value={f.check_in} onChange={(e) => setF({ ...f, check_in: e.target.value, check_out: e.target.value >= f.check_out ? addDays(e.target.value, 1) : f.check_out })} /></Field>
            <Field label="Check-out"><Input type="date" min={addDays(f.check_in, 1)} value={f.check_out} onChange={(e) => setF({ ...f, check_out: e.target.value })} /></Field>
            <Field label="Adults"><Input type="number" min={1} value={f.adults} onChange={(e) => setF({ ...f, adults: Number(e.target.value) })} /></Field>
            <Field label="Children"><Input type="number" min={0} value={f.children} onChange={(e) => setF({ ...f, children: Number(e.target.value) })} /></Field>
          </div>
          <div>
            <label className="label">Room type ({nights} night{nights !== 1 ? 's' : ''})</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {types.map((t) => (
                <button key={t.id} type="button" disabled={!t.rooms.length} onClick={() => setF({ ...f, room_type_id: t.id, room_id: '' })} className={`room-tile ${Number(f.room_type_id) === t.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white'} ${!t.rooms.length ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <div className="flex justify-between items-start"><div className="font-semibold text-slate-800">{t.name}</div><div className="text-sm font-bold text-brand-800">{money(t.base_rate, { decimals: 0 })}</div></div>
                  <div className="text-xs text-slate-500 mt-1">{t.rooms.length} available · max {t.max_adults}A/{t.max_children}C{!t.fits_guests ? ' · too small' : ''}</div>
                </button>
              ))}
            </div>
          </div>
          {type && (
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Room (optional)"><Select value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })} placeholder="Auto-assign">{type.rooms.map((r) => <option key={r.id} value={r.id}>Room {r.number} ({r.status})</option>)}</Select></Field>
              <Field label="Rate per night" hint={`Default ${money(type.base_rate, { decimals: 0 })}`}><Input type="number" value={f.rate} placeholder={type.base_rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
              <Field label="Discount"><Input type="number" value={f.discount} onChange={(e) => setF({ ...f, discount: Number(e.target.value) })} /></Field>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="label">Guest</div>
            <div className="relative">
              <Input value={f.guest.name} onChange={(e) => searchGuest(e.target.value)} placeholder="Start typing name to find an existing guest, or enter a new one" />
              {guests.length > 0 && !f.guest_id && (
                <div className="absolute z-10 mt-1 w-full card shadow-xl p-1 max-h-48 overflow-auto">
                  {guests.map((g) => <button key={g.id} type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-brand-50 text-sm" onClick={() => { setF({ ...f, guest_id: g.id, guest: { name: g.name, phone: g.phone || '', email: g.email || '', nic_passport: g.nic_passport || '', nationality: g.nationality || '' } }); setGuests([]); }}>{g.name} <span className="text-slate-400">· {g.phone} · {g.stays} stays</span></button>)}
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-4 gap-3 mt-3">
              <Field label="Phone"><Input value={f.guest.phone} onChange={(e) => setF({ ...f, guest: { ...f.guest, phone: e.target.value } })} disabled={!!f.guest_id} /></Field>
              <Field label="Email"><Input value={f.guest.email} onChange={(e) => setF({ ...f, guest: { ...f.guest, email: e.target.value } })} disabled={!!f.guest_id} /></Field>
              <Field label="NIC / Passport"><Input value={f.guest.nic_passport} onChange={(e) => setF({ ...f, guest: { ...f.guest, nic_passport: e.target.value } })} disabled={!!f.guest_id} /></Field>
              <Field label="Nationality"><Input value={f.guest.nationality} onChange={(e) => setF({ ...f, guest: { ...f.guest, nationality: e.target.value } })} disabled={!!f.guest_id} /></Field>
            </div>
            {f.guest_id && <div className="text-xs text-emerald-700 mt-2 flex items-center gap-2">Existing guest selected <button className="underline" onClick={() => setF({ ...f, guest_id: '' })}>change</button></div>}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Source"><Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} options={['walkin', 'phone', 'website', 'agent', 'email']} /></Field>
            <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={['confirmed', 'pending']} /></Field>
            <Field label="Special requests"><Input value={f.special_requests} onChange={(e) => setF({ ...f, special_requests: e.target.value })} /></Field>
          </div>
          {type && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between"><div className="text-sm text-white/70">{type.name} · {nights} × {money(rate, { decimals: 0 })} - {money(f.discount, { decimals: 0 })} + tax</div><div className="font-bold text-lg">{money((rate * nights - f.discount) * taxMul, { decimals: 0 })}</div></motion.div>}
        </div>
      )}
    </Modal>
  );
}
