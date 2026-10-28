let currencySymbol = 'Rs.';
export const setCurrencySymbol = (s) => { if (s) currencySymbol = s; };

export const money = (v, opts = {}) => {
  const n = Number(v) || 0;
  const s = n.toLocaleString('en-LK', { minimumFractionDigits: opts.decimals ?? 2, maximumFractionDigits: opts.decimals ?? 2 });
  return `${opts.symbol ?? currencySymbol} ${s}`;
};
export const compact = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};
export const num = (v, d = 0) => (Number(v) || 0).toLocaleString('en-LK', { maximumFractionDigits: d, minimumFractionDigits: d });

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const fmtDate = (s) => {
  if (!s) return '-';
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s.replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (s) => {
  if (!s) return '-';
  const d = new Date(s.replace(' ', 'T') + (s.length === 19 ? 'Z' : ''));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
export const fmtTime = (s) => (s ? s.slice(0, 5) : '-');
export const monthLabel = (ym) => { const [y, m] = ym.split('-'); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };
export const nightsBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
export const timeAgo = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
export const title = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const STATUS_COLORS = {
  // bookings
  pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-sky-100 text-sky-800', checked_in: 'bg-emerald-100 text-emerald-800',
  checked_out: 'bg-slate-100 text-slate-700', cancelled: 'bg-rose-100 text-rose-700', no_show: 'bg-rose-100 text-rose-700',
  // rooms
  available: 'bg-emerald-100 text-emerald-800', occupied: 'bg-sky-100 text-sky-800', dirty: 'bg-amber-100 text-amber-800',
  cleaning: 'bg-violet-100 text-violet-800', maintenance: 'bg-rose-100 text-rose-700', out_of_order: 'bg-slate-200 text-slate-700',
  // tables / orders
  free: 'bg-emerald-100 text-emerald-800', reserved: 'bg-violet-100 text-violet-800', open: 'bg-sky-100 text-sky-800',
  billed: 'bg-amber-100 text-amber-800', paid: 'bg-emerald-100 text-emerald-800', served: 'bg-emerald-100 text-emerald-800',
  preparing: 'bg-amber-100 text-amber-800', ready: 'bg-sky-100 text-sky-800',
  // generic
  active: 'bg-emerald-100 text-emerald-800', on_leave: 'bg-amber-100 text-amber-800', resigned: 'bg-slate-200 text-slate-700',
  present: 'bg-emerald-100 text-emerald-800', absent: 'bg-rose-100 text-rose-700', leave: 'bg-violet-100 text-violet-800', half_day: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-rose-100 text-rose-700', draft: 'bg-slate-100 text-slate-700',
  unpaid: 'bg-rose-100 text-rose-700', partial: 'bg-amber-100 text-amber-800', received: 'bg-sky-100 text-sky-800', ordered: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800', in_progress: 'bg-sky-100 text-sky-800', booked: 'bg-sky-100 text-sky-800', requested: 'bg-amber-100 text-amber-800',
  seated: 'bg-emerald-100 text-emerald-800', high: 'bg-rose-100 text-rose-700', normal: 'bg-slate-100 text-slate-700', low: 'bg-slate-100 text-slate-500',
};
