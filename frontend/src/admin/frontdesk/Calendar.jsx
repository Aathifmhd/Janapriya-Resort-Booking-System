import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { addDays, today } from '../../lib/format';
import { PageHeader, Badge, useToast } from '../../components/ui';
import { BookingDetail, NewBooking } from './Bookings';

const DAYS = 14;
const COLORS = { pending: 'bg-amber-400', confirmed: 'bg-sky-500', checked_in: 'bg-emerald-500', checked_out: 'bg-slate-400' };

export default function Calendar() {
  const toast = useToast();
  const [start, setStart] = useState(addDays(today(), -2));
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [open, setOpen] = useState(null);
  const [create, setCreate] = useState(null);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start]);
  const end = addDays(start, DAYS);

  const load = () => {
    Promise.all([api.get('/api/rooms'), api.get(`/api/bookings/calendar${qs({ from: start, to: end })}`)]).then(([r, b]) => { setRooms(r); setBookings(b); }).catch((e) => toast.error(e.message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [start]);

  const groups = useMemo(() => { const g = {}; rooms.forEach((r) => { (g[r.type_name] ||= []).push(r); }); return g; }, [rooms]);

  return (
    <div>
      <PageHeader title="Room calendar" subtitle="Drag-free tape chart. Click a booking to open it, click an empty cell to create one." actions={<div className="flex items-center gap-2">
        <button className="btn-secondary btn-sm" onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={14} /></button>
        <button className="btn-secondary btn-sm" onClick={() => setStart(addDays(today(), -2))}>Today</button>
        <button className="btn-secondary btn-sm" onClick={() => setStart(addDays(start, 7))}><ChevronRight size={14} /></button>
      </div>} />
      <div className="flex flex-wrap gap-3 mb-3 text-xs">{Object.entries(COLORS).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${c}`} /> <Badge status={k} /></span>)}</div>
      <div className="table-wrap">
        <div className="min-w-[1100px]">
          <div className="grid border-b border-slate-200 bg-slate-50 sticky top-0 z-10" style={{ gridTemplateColumns: `140px repeat(${DAYS}, 1fr)` }}>
            <div className="px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">Room</div>
            {days.map((d) => { const dt = new Date(d + 'T00:00:00'); const isT = d === today(); return <div key={d} className={`px-1 py-2 text-center border-l border-slate-100 ${isT ? 'bg-brand-50' : dt.getDay() % 6 === 0 ? 'bg-sand-100/60' : ''}`}><div className="text-[10px] uppercase text-slate-400">{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</div><div className={`text-sm font-semibold ${isT ? 'text-brand-700' : 'text-slate-700'}`}>{dt.getDate()}</div></div>; })}
          </div>
          {Object.entries(groups).map(([type, rs]) => (
            <div key={type}>
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/70 border-b border-slate-100">{type}</div>
              {rs.map((room) => {
                const rb = bookings.filter((b) => b.room_id === room.id);
                return (
                  <div key={room.id} className="relative grid border-b border-slate-100 h-12" style={{ gridTemplateColumns: `140px repeat(${DAYS}, 1fr)` }}>
                    <div className="px-3 flex items-center gap-2 text-sm font-medium text-slate-800"><span>{room.number}</span><Badge status={room.status} className="!text-[9px] !px-1.5" /></div>
                    {days.map((d) => <div key={d} className={`border-l border-slate-100 cursor-pointer hover:bg-brand-50/60 ${d === today() ? 'bg-brand-50/40' : ''}`} onClick={() => setCreate({ check_in: d, check_out: addDays(d, 1), room_type_id: room.room_type_id, room_id: room.id })} />)}
                    {rb.map((b) => {
                      const s = Math.max(0, Math.round((new Date(b.check_in) - new Date(start)) / 86400000));
                      const e = Math.min(DAYS, Math.round((new Date(b.check_out) - new Date(start)) / 86400000));
                      if (e <= 0 || s >= DAYS) return null;
                      const colW = `calc((100% - 140px) / ${DAYS})`;
                      return (
                        <motion.button key={b.id} initial={{ opacity: 0, scaleX: 0.8 }} animate={{ opacity: 1, scaleX: 1 }} onClick={() => setOpen(b.id)} title={`${b.guest_name} · ${b.code}`}
                          className={`absolute top-2 h-8 rounded-lg text-white text-xs font-medium px-2 truncate shadow ${COLORS[b.status] || 'bg-slate-400'} hover:brightness-110`}
                          style={{ left: `calc(140px + ${colW} * ${s} + ${colW} * 0.5)`, width: `calc(${colW} * ${e - s} - 4px)`, transformOrigin: 'left' }}>
                          {b.guest_name}
                        </motion.button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <BookingDetail id={open} onClose={() => { setOpen(null); load(); }} />
      <NewBooking open={!!create} preset={create || {}} onClose={() => setCreate(null)} onCreated={() => { setCreate(null); load(); }} />
    </div>
  );
}
