import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Flame, CheckCircle2, Bell } from 'lucide-react';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { PageHeader, Empty, useToast } from '../../components/ui';

const COLS = [
  { status: 'pending', label: 'New', icon: Bell, next: 'preparing', nextLabel: 'Start', color: 'border-amber-300 bg-amber-50' },
  { status: 'preparing', label: 'Preparing', icon: Flame, next: 'ready', nextLabel: 'Ready', color: 'border-sky-300 bg-sky-50' },
  { status: 'ready', label: 'Ready to serve', icon: CheckCircle2, next: 'served', nextLabel: 'Served', color: 'border-emerald-300 bg-emerald-50' },
];

export default function Kitchen() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const load = useCallback(() => api.get('/api/orders/kitchen').then(setItems).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  const advance = async (it, status) => { try { await api.put(`/api/orders/${it.order_id}/items/${it.id}`, { status }); load(); } catch (e) { toast.error(e.message); } };

  // group by order within each column
  const grouped = (status) => {
    const g = {};
    items.filter((i) => i.status === status).forEach((i) => { (g[i.order_id] ||= { code: i.code, table: i.table_name || (i.room_number ? `Room ${i.room_number}` : 'Takeaway'), items: [], since: i.created_at }).items.push(i); });
    return Object.values(g);
  };

  return (
    <div>
      <PageHeader title="Kitchen & Bar Display" subtitle="Live ticket board - refreshes every 8 seconds" actions={<span className="chip bg-emerald-100 text-emerald-800 animate-pulse-soft">● Live</span>} />
      <div className="grid md:grid-cols-3 gap-4">
        {COLS.map((c) => {
          const tickets = grouped(c.status);
          return (
            <div key={c.status} className={`rounded-2xl border-2 ${c.color} p-3 min-h-[60vh]`}>
              <div className="flex items-center justify-between mb-3 px-1"><h3 className="font-bold text-slate-800 flex items-center gap-2"><c.icon size={18} /> {c.label}</h3><span className="chip bg-white text-slate-700">{tickets.reduce((a, t) => a + t.items.length, 0)}</span></div>
              <div className="space-y-3">
                <AnimatePresence>
                  {tickets.map((t) => (
                    <motion.div key={t.code + c.status} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="card p-3 shadow-md">
                      <div className="flex items-center justify-between mb-2"><div><span className="font-bold text-slate-900">{t.table}</span> <span className="font-mono text-xs text-slate-400">{t.code}</span></div><span className="text-[11px] text-slate-400">{timeAgo(t.since)}</span></div>
                      <ul className="space-y-1.5">
                        {t.items.map((i) => (
                          <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                            <span><span className="font-bold text-brand-800 mr-1.5">{i.qty}×</span>{i.name}{i.notes && <span className="block text-[11px] text-rose-600">{i.notes}</span>}</span>
                            <button className="btn-secondary btn-sm whitespace-nowrap" onClick={() => advance(i, c.next)}>{c.nextLabel}</button>
                          </li>
                        ))}
                      </ul>
                      {t.items.length > 1 && <button className="btn-primary btn-sm w-full mt-2" onClick={() => t.items.forEach((i) => advance(i, c.next))}>All {c.nextLabel.toLowerCase()}</button>}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!tickets.length && <div className="text-center text-sm text-slate-400 py-10"><ChefHat className="mx-auto mb-2 opacity-40" /> Nothing here</div>}
              </div>
            </div>
          );
        })}
      </div>
      {!items.length && <div className="mt-4 card"><Empty title="All caught up" message="No open tickets. New orders from the POS will appear here automatically." /></div>}
    </div>
  );
}
