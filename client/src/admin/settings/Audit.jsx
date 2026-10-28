import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { fmtDateTime, title } from '../../lib/format';
import { PageHeader, DataTable, SearchBox } from '../../components/ui';

export default function Audit() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/api/audit').then(setRows).finally(() => setLoading(false)); }, []);
  const shown = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Who did what, and when" />
      <SearchBox value={q} onChange={setQ} className="w-72 mb-4" placeholder="Filter by user, action, entity..." />
      <DataTable loading={loading} rows={shown} pageSize={50} columns={[
        { key: 'created_at', label: 'When', render: (r) => fmtDateTime(r.created_at) },
        { key: 'user_name', label: 'User', render: (r) => <span className="font-medium">{r.user_name}</span> },
        { key: 'action', label: 'Action', render: (r) => <span className="chip bg-slate-100 text-slate-700">{title(r.action)}</span> },
        { key: 'entity', label: 'Entity', render: (r) => <span>{title(r.entity)}{r.entity_id ? <span className="text-slate-400"> #{r.entity_id}</span> : ''}</span> },
        { key: 'detail', label: 'Detail', render: (r) => <span className="text-xs text-slate-500 font-mono line-clamp-1 max-w-md">{r.detail}</span> },
      ]} />
    </div>
  );
}
