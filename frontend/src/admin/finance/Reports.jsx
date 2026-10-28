import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Printer, TrendingUp, TrendingDown, Percent, BedDouble } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { api, qs } from '../../lib/api';
import { money, compact, fmtDate, title, today, addDays, monthLabel } from '../../lib/format';
import { PageHeader, Input, Stat, Skeleton } from '../../components/ui';
import { ChartCard } from '../Dashboard';

const C = { room: '#2a78d6', restaurant: '#eb6834', bar: '#1baf7a', expenses: '#eda100' };

export default function Reports() {
  const [range, setRange] = useState({ from: addDays(today(), -29), to: today() });
  const [d, setD] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const load = useCallback(() => { api.get(`/api/reports/summary${qs(range)}`).then(setD); api.get('/api/reports/monthly').then(setMonthly); }, [range]);
  useEffect(load, [load]);
  const preset = (days) => setRange({ from: addDays(today(), -(days - 1)), to: today() });
  if (!d) return <Skeleton rows={10} />;
  const margin = d.revenue.total ? Math.round((d.net_profit / d.revenue.total) * 100) : 0;

  return (
    <div>
      <PageHeader title="Reports & Profit / Loss" subtitle={`${fmtDate(d.from)} - ${fmtDate(d.to)}`} actions={<div className="flex flex-wrap items-center gap-2 no-print">
        <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="w-40" />
        <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="w-40" />
        {[7, 30, 90].map((n) => <button key={n} className="btn-secondary btn-sm" onClick={() => preset(n)}>{n}d</button>)}
        <button className="btn-secondary btn-sm" onClick={() => setRange({ from: today().slice(0, 8) + '01', to: today() })}>This month</button>
        <button className="btn-primary btn-sm" onClick={() => window.print()}><Printer size={14} /> Print</button>
      </div>} />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Total revenue" value={money(d.revenue.total, { decimals: 0 })} sub={`Rooms ${compact(d.revenue.room)} · F&B ${compact(d.revenue.restaurant + d.revenue.bar)}`} icon={TrendingUp} tone="emerald" />
        <Stat label="Expenses + COGS" value={money(d.expenses + d.cogs, { decimals: 0 })} sub={`COGS ${compact(d.cogs)} · Opex ${compact(d.expenses)}`} icon={TrendingDown} tone="rose" delay={0.05} />
        <Stat label="Net profit" value={money(d.net_profit, { decimals: 0 })} sub={`${margin}% margin`} icon={Percent} tone={d.net_profit >= 0 ? 'brand' : 'rose'} delay={0.1} />
        <Stat label="Occupancy / ADR" value={`${d.occupancy}%`} sub={`ADR ${money(d.adr, { decimals: 0 })} · ${d.nights_sold} room nights`} icon={BedDouble} tone="sky" delay={0.15} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <ChartCard title="Daily revenue by outlet">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.daily} margin={{ left: 0, right: 8, top: 10 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v, n) => [money(v, { decimals: 0 }), n]} labelFormatter={fmtDate} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="room" name="Rooms" stackId="a" fill={C.room} />
              <Bar dataKey="restaurant" name="Restaurant" stackId="a" fill={C.restaurant} />
              <Bar dataKey="bar" name="Bar" stackId="a" fill={C.bar} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="12-month revenue vs expenses">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthly.map((m) => ({ ...m, revenue: m.room + m.restaurant + m.bar }))} margin={{ left: 0, right: 8, top: 10 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tickFormatter={(v) => monthLabel(v).slice(0, 3)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v, n) => [money(v, { decimals: 0 }), n]} labelFormatter={monthLabel} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke={C.room} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke={C.expenses} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5 lg:col-span-1">
          <h3 className="font-semibold text-slate-800 mb-3">Profit & loss statement</h3>
          <table className="w-full text-sm">
            <tbody>
              <PLRow label="Room revenue" v={d.revenue.room} />
              <PLRow label="Restaurant revenue" v={d.revenue.restaurant} />
              <PLRow label="Bar revenue" v={d.revenue.bar} />
              <PLRow label="Total revenue" v={d.revenue.total} bold />
              <PLRow label="Cost of goods sold (stock used)" v={-d.cogs} />
              <PLRow label="Gross profit" v={d.gross_profit} bold />
              {d.expenses_by_category.map((e) => <PLRow key={e.category} label={title(e.category)} v={-e.amount} muted />)}
              <PLRow label="Total operating expenses" v={-d.expenses} bold />
              <PLRow label="Net profit" v={d.net_profit} bold big />
            </tbody>
          </table>
          <div className="mt-4 text-xs text-slate-500 space-y-1">
            <div className="flex justify-between"><span>Tax collected (VAT)</span><span>{money(d.tax_collected, { decimals: 0 })}</span></div>
            <div className="flex justify-between"><span>Service charge collected</span><span>{money(d.service_charge, { decimals: 0 })}</span></div>
            <div className="flex justify-between"><span>Cash & card received</span><span>{money(d.payments_received, { decimals: 0 })}</span></div>
            <div className="flex justify-between text-rose-600"><span>Receivables (unpaid invoices)</span><span>{money(d.receivables, { decimals: 0 })}</span></div>
            <div className="flex justify-between text-rose-600"><span>Payables (supplier bills)</span><span>{money(d.purchases_unpaid, { decimals: 0 })}</span></div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Top selling items</h3>
          <div className="space-y-2">{d.top_items.map((t, i) => { const max = d.top_items[0]?.revenue || 1; return <div key={t.name}><div className="flex justify-between text-sm"><span className="truncate"><span className="text-slate-400 mr-1">{i + 1}.</span>{t.name}</span><span className="font-medium whitespace-nowrap">{money(t.revenue, { decimals: 0 })} <span className="text-xs text-slate-400">×{t.qty}</span></span></div><div className="h-1.5 rounded-full bg-slate-100 mt-1"><motion.div initial={{ width: 0 }} animate={{ width: `${(t.revenue / max) * 100}%` }} className="h-full rounded-full bg-[#eb6834]" /></div></div>; })}{!d.top_items.length && <div className="text-sm text-slate-400">No sales in this period</div>}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Bookings by source</h3>
          <div className="space-y-2">{d.booking_sources.map((s) => <div key={s.source} className="flex items-center justify-between text-sm"><span className="capitalize">{s.source}</span><span><span className="font-semibold">{s.count}</span> <span className="text-xs text-slate-400">· {money(s.revenue, { decimals: 0 })}</span></span></div>)}{!d.booking_sources.length && <div className="text-sm text-slate-400">No bookings in this period</div>}</div>
          <h3 className="font-semibold text-slate-800 mb-3 mt-6">Payments by method</h3>
          <div className="space-y-2">{d.payments_by_method.map((p) => <div key={p.method} className="flex items-center justify-between text-sm"><span className="capitalize">{p.method}</span><span className="font-semibold">{money(p.amount, { decimals: 0 })}</span></div>)}</div>
        </motion.div>
      </div>
    </div>
  );
}

const PLRow = ({ label, v, bold, big, muted }) => <tr className={`${bold ? 'border-t border-slate-200 font-semibold' : ''} ${muted ? 'text-slate-500' : ''}`}><td className={`py-1.5 ${muted ? 'pl-3' : ''} ${big ? 'text-base pt-3' : ''}`}>{label}</td><td className={`py-1.5 text-right ${v < 0 ? 'text-rose-600' : ''} ${big ? 'text-base pt-3 ' + (v >= 0 ? 'text-emerald-700' : '') : ''}`}>{v < 0 ? `(${money(-v, { decimals: 0 })})` : money(v, { decimals: 0 })}</td></tr>;
