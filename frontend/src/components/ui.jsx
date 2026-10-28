import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, Search, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import { STATUS_COLORS, title } from '../lib/format';

// ---------------- Toast ----------------
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const toast = { success: (m) => push(m, 'success'), error: (m) => push(m, 'error'), info: (m) => push(m, 'info') };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 no-print">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl text-sm font-medium text-white min-w-[260px] max-w-sm ${t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`}>
              {t.type === 'success' ? <CheckCircle2 size={18} /> : t.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------- Modal ----------------
export function Modal({ open, onClose, title: t, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-[95vw]' };
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={`relative w-full ${sizes[size]} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-lg text-slate-800">{t}</h3>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
            {footer && <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/60 rounded-b-3xl">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Confirm({ open, onClose, onConfirm, title: t = 'Are you sure?', message, danger = true, confirmText = 'Confirm' }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={t} size="sm" footer={<>
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>{busy && <Loader2 className="animate-spin" size={16} />}{confirmText}</button>
    </>}>
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

// ---------------- Form controls ----------------
export function Field({ label, children, hint, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
const widthOf = (c = '') => (/(^|\s)w-/.test(c) ? '' : 'w-full');
export const Input = (props) => <input {...props} className={`input ${widthOf(props.className)} ${props.className || ''}`} />;
export const Textarea = (props) => <textarea rows={3} {...props} className={`input ${widthOf(props.className)} ${props.className || ''}`} />;
export function Select({ options = [], placeholder, children, ...props }) {
  return (
    <select {...props} className={`input ${widthOf(props.className)} ${props.className || ''}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {children}
      {options.map((o) => (typeof o === 'object' ? <option key={o.value} value={o.value}>{o.label}</option> : <option key={o} value={o}>{title(o)}</option>))}
    </select>
  );
}
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  );
}

// ---------------- Display ----------------
export function Badge({ status, children, className = '' }) {
  const c = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700';
  return <span className={`chip ${c} ${className}`}>{children ?? title(status)}</span>;
}

export function PageHeader({ title: t, subtitle, actions }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function Stat({ label, value, sub, icon: Icon, tone = 'brand', delay = 0, onClick }) {
  const tones = { brand: 'bg-brand-50 text-brand-700', gold: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600', sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600', slate: 'bg-slate-100 text-slate-600', emerald: 'bg-emerald-50 text-emerald-600' };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} onClick={onClick}
      className={`card p-5 flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition' : ''}`}>
      {Icon && <div className={`rounded-2xl p-3 ${tones[tone]}`}><Icon size={22} /></div>}
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className={`font-bold text-slate-900 mt-0.5 truncate ${String(typeof value === 'string' ? value : '').length > 11 ? 'text-xl' : 'text-2xl'}`}>{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1 flex-wrap">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={`relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${value === t.value ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
          {value === t.value && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          <span className="relative">{t.label}{t.count != null && <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>}</span>
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input w-full pl-9" />
    </div>
  );
}

export function Empty({ title: t = 'Nothing here yet', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="rounded-3xl bg-slate-100 p-4 text-slate-400 mb-3"><Inbox size={28} /></div>
      <div className="font-semibold text-slate-700">{t}</div>
      {message && <div className="text-sm text-slate-500 mt-1 max-w-sm">{message}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = '' }) {
  return <div className={`flex justify-center py-10 ${className}`}><Loader2 className="animate-spin text-brand-600" size={28} /></div>;
}

export function Skeleton({ rows = 5 }) {
  return <div className="space-y-2">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-10" />)}</div>;
}

// ---------------- Table ----------------
export function DataTable({ columns, rows, loading, onRowClick, empty, pageSize = 25, rowKey = 'id', footer }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows]);
  if (loading) return <div className="card p-4"><Skeleton /></div>;
  if (!rows?.length) return <div className="card">{empty || <Empty />}</div>;
  const pages = Math.ceil(rows.length / pageSize);
  const slice = rows.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{columns.map((c) => <th key={c.key || c.label} className={c.className || ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {slice.map((r, i) => (
            <motion.tr key={r[rowKey] ?? i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'cursor-pointer' : ''}>
              {columns.map((c) => <td key={c.key || c.label} className={c.className || ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </motion.tr>
          ))}
        </tbody>
        {footer && <tfoot><tr>{footer}</tr></tfoot>}
      </table>
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500">
          <span>{page * pageSize + 1}-{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}</span>
          <div className="flex gap-1">
            <button className="btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button>
            <button className="btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Animated number ----------------
export function Counter({ value, format = (v) => v, duration = 0.8 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const start = performance.now(); const from = display; const to = Number(value) || 0;
    cancelAnimationFrame(ref.current);
    const step = (t) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{format(display)}</>;
}

// Scroll-reveal wrapper for the public site
export function Reveal({ children, delay = 0, className = '', y = 24 }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// Generic form helper hook
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));
  const bind = (k, type) => ({
    value: values[k] ?? '',
    onChange: (e) => set(k, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value),
  });
  return { values, set, bind, setValues, reset: () => setValues(initial) };
}
