import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Maximize, Check } from 'lucide-react';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { Reveal } from '../components/ui';
import PageHero from './PageHero';

export default function Rooms() {
  const [types, setTypes] = useState([]);
  useEffect(() => { api.get('/api/public/room-types').then(setTypes).catch(() => {}); }, []);
  return (
    <div>
      <PageHero kicker="Stay with us" title="Rooms & Villas" text="Every room faces the water. Choose from cosy garden rooms, lake-view balconies, family suites and private pool villas." image="https://images.unsplash.com/photo-1582719508461-905c673771fd?w=2000&q=80" />
      <div className="max-w-7xl mx-auto px-5 mt-16 space-y-14">
        {types.map((t, i) => (
          <Reveal key={t.id}>
            <div className={`grid lg:grid-cols-2 gap-8 items-center ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div className="relative rounded-[2rem] overflow-hidden aspect-[4/3] group shadow-xl">
                <img src={t.image_url} alt={t.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute top-4 left-4 chip bg-white/90 text-slate-800">{t.room_count} rooms</div>
              </div>
              <div>
                <h2 className="font-display text-4xl text-slate-900">{t.name}</h2>
                <p className="text-slate-600 mt-4 leading-relaxed">{t.description}</p>
                <div className="flex flex-wrap gap-5 mt-5 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><Users size={16} className="text-brand-700" /> {t.max_adults} adults{t.max_children ? ` + ${t.max_children} children` : ''}</span>
                  <span className="inline-flex items-center gap-1.5"><Maximize size={16} className="text-brand-700" /> {t.size_sqm} m²</span>
                </div>
                <ul className="grid grid-cols-2 gap-2 mt-6">
                  {(t.amenities || []).map((a) => <li key={a} className="flex items-center gap-2 text-sm text-slate-700"><Check size={14} className="text-accent-600" /> {a}</li>)}
                </ul>
                <div className="flex items-center gap-6 mt-8">
                  <div><div className="text-xs uppercase tracking-wider text-slate-400">From</div><div className="font-display text-3xl font-semibold text-brand-800">{money(t.base_rate, { decimals: 0 })}<span className="text-sm font-sans font-normal text-slate-400"> / night</span></div></div>
                  <Link to={`/book?room_type_id=${t.id}`} className="btn-primary">Book this room</Link>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
