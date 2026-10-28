import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BedDouble, LogIn, LogOut, Globe, Banknote, UtensilsCrossed, Package, Sparkles, Users, Wine, ArrowRight, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { api } from '../lib/api';
import { money, compact, timeAgo, fmtDate } from '../lib/format';
import { useAuth } from '../lib/auth';
import { Stat, Badge, Skeleton, Counter } from '../components/ui';

const C = { room: '#2a78d6', fnb: '#eb6834', occ: '#1baf7a' };

export default function Dashboard() {
  const { user, can } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/api/dashboard').then(setD); const t = setInterval(() => api.get('/api/dashboard').then(setD).catch(() => {}), 60000); return () => clearInterval(t); }, []);
  if (!d) return <Skeleton rows={8} />;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{greet}, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500 mt-1">Here's what's happening at the resort today.</p>
      </motion.div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Occupancy" value={<><Counter value={d.rooms.occupancy} format={(v) => Math.round(v)} />%</>} sub={`${d.rooms.occupied} of ${d.rooms.total} rooms occupied`} icon={BedDouble} tone="brand" />
        <Stat label="Arrivals today" value={d.arrivals} sub={`${d.departures} departures`} icon={LogIn} tone="sky" delay={0.05} />
        <Stat label="Revenue today" value={money(d.revenue_today, { decimals: 0 })} sub={`${money(d.revenue_month, { decimals: 0 })} this month`} icon={Banknote} tone="emerald" delay={0.1} />
        <Stat label="Website bookings" value={d.pending_web_bookings} sub="awaiting confirmation" icon={Globe} tone="gold" delay={0.15} />
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        <Stat label="Open F&B orders" value={d.open_orders} sub={`${d.orders_today} orders today · ${money(d.orders_today_value, { decimals: 0 })}`} icon={UtensilsCrossed} tone="rose" delay={0.2} />
        <Stat label="Housekeeping tasks" value={d.housekeeping_pending} sub="pending or in progress" icon={Sparkles} tone="violet" delay={0.25} />
        <Stat label="Staff present" value={`${d.staff_present}/${d.staff_total}`} sub={`${d.pending_leaves} leave requests pending`} icon={Users} tone="slate" delay={0.3} />
        <Stat label="Low stock items" value={d.low_stock} sub={`${d.empties} empty bottles · ${money(d.empties_value, { decimals: 0 })} deposit`} icon={Package} tone={d.low_stock ? 'rose' : 'emerald'} delay={0.35} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <ChartCard title="Revenue - last 14 days" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={d.revenue14} margin={{ left: 0, right: 8, top: 10 }}>
              <defs>
                <linearGradient id="gRoom" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.room} stopOpacity={0.35} /><stop offset="100%" stopColor={C.room} stopOpacity={0} /></linearGradient>
                <linearGradient id="gFnb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.fnb} stopOpacity={0.35} /><stop offset="100%" stopColor={C.fnb} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<Tip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="room" name="Rooms" stroke={C.room} strokeWidth={2} fill="url(#gRoom)" />
              <Area type="monotone" dataKey="fnb" name="Restaurant & Bar" stroke={C.fnb} strokeWidth={2} fill="url(#gFnb)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Rooms occupied - 14 days">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.occupancy14} margin={{ left: 0, right: 8, top: 10 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(8)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, d.rooms.total]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => [`${v} / ${d.rooms.total}`, 'Occupied']} labelFormatter={fmtDate} />
              <Bar dataKey="occupied" name="Occupied" fill={C.occ} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <ListCard title="Today's arrivals" icon={LogIn} to="/admin/bookings?view=arrivals" show={can('bookings')}>
          {d.arrivals_list.length === 0 && <EmptyLine>No arrivals due today</EmptyLine>}
          {d.arrivals_list.map((b) => <Line key={b.id} to={`/admin/bookings?open=${b.id}`} title={b.guest_name} sub={`${b.room_type_name} · ${b.nights}n · ${b.code}`} right={<Badge status={b.status} />} />)}
        </ListCard>
        <ListCard title="Today's departures" icon={LogOut} to="/admin/bookings?view=departures" show={can('bookings')}>
          {d.departures_list.length === 0 && <EmptyLine>No departures today</EmptyLine>}
          {d.departures_list.map((b) => <Line key={b.id} to={`/admin/bookings?open=${b.id}`} title={`${b.guest_name} · Room ${b.room_number}`} sub={b.code} right={<span className={`text-xs font-semibold ${b.total - b.paid > 1 ? 'text-rose-600' : 'text-emerald-600'}`}>{b.total - b.paid > 1 ? `Due ${money(b.total - b.paid, { decimals: 0 })}` : 'Settled'}</span>} />)}
        </ListCard>
        <ListCard title="Recent activity" icon={Activity} to={can('audit') ? '/admin/audit' : null} show>
          {d.recent_activity.map((a) => <div key={a.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0"><span className="h-2 w-2 mt-1.5 rounded-full bg-brand-400 shrink-0" /><div className="min-w-0 flex-1 text-sm"><span className="font-medium text-slate-800">{a.user_name}</span> <span className="text-slate-500">{a.action} {a.entity?.replace(/_/g, ' ')} {a.entity_id ? `#${a.entity_id}` : ''}</span></div><span className="text-[11px] text-slate-400 shrink-0">{timeAgo(a.created_at)}</span></div>)}
        </ListCard>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        {d.rooms.by_status.map((s) => {
          const body = <><Badge status={s.status} /><span className="font-bold text-slate-800">{s.c}</span></>;
          return can('rooms')
            ? <Link key={s.status} to={`/admin/rooms?status=${s.status}`} className="card px-4 py-3 flex items-center justify-between hover:shadow-md transition">{body}</Link>
            : <div key={s.status} className="card px-4 py-3 flex items-center justify-between">{body}</div>;
        })}
        {can('empty-bottles') && <Link to="/admin/empty-bottles" className="card px-4 py-3 flex items-center justify-between hover:shadow-md transition"><span className="chip bg-amber-100 text-amber-800 gap-1"><Wine size={12} /> Empty bottles</span><span className="font-bold text-slate-800">{d.empties}</span></Link>}
      </div>
    </div>
  );
}

const Tip = ({ active, payload, label }) => active && payload?.length ? (
  <div className="card p-3 text-xs shadow-xl"><div className="font-semibold text-slate-700 mb-1">{fmtDate(label)}</div>{payload.map((p) => <div key={p.name} className="flex justify-between gap-6"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</span><span className="font-semibold">{money(p.value, { decimals: 0 })}</span></div>)}</div>
) : null;

export function ChartCard({ title, children, className = '', action }) {
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`card p-5 ${className}`}><div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-slate-800">{title}</h3>{action}</div>{children}</motion.div>;
}
function ListCard({ title, icon: I, to, children, show }) {
  if (!show) return null;
  return <div className="card p-5"><div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-slate-800 flex items-center gap-2"><I size={16} className="text-brand-700" />{title}</h3>{to && <Link to={to} className="text-xs font-semibold text-brand-700 inline-flex items-center gap-1 hover:gap-2 transition-all">View <ArrowRight size={12} /></Link>}</div>{children}</div>;
}
const Line = ({ to, title, sub, right }) => <Link to={to} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded-lg"><div className="min-w-0"><div className="text-sm font-medium text-slate-800 truncate">{title}</div><div className="text-xs text-slate-500">{sub}</div></div>{right}</Link>;
const EmptyLine = ({ children }) => <div className="text-sm text-slate-400 py-4 text-center">{children}</div>;
