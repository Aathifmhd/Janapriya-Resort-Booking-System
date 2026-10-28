import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { Reveal } from '../components/ui';
import { useResortInfo } from './SiteLayout';
import PageHero from './PageHero';

export default function Contact() {
  const info = useResortInfo();
  return (
    <div>
      <PageHero kicker="Get in touch" title="Contact us" text="Our reservations team is available every day from 7am to 10pm." image="https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=2000&q=80" />
      <div className="max-w-7xl mx-auto px-5 mt-16 grid lg:grid-cols-2 gap-10">
        <Reveal>
          <div className="space-y-5">
            {[[MapPin, 'Address', info.address], [Phone, 'Phone / WhatsApp', info.phone], [Mail, 'Email', info.email], [Clock, 'Check-in / Check-out', `${info.check_in_time} / ${info.check_out_time}`]].map(([I, l, v]) => (
              <div key={l} className="card p-5 flex items-start gap-4"><span className="h-11 w-11 shrink-0 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center"><I size={20} /></span><div><div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{l}</div><div className="text-slate-800 font-medium mt-0.5">{v}</div></div></div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-[2rem] overflow-hidden shadow-xl h-full min-h-[360px]">
            <iframe title="map" className="w-full h-full min-h-[360px] border-0" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=79.70%2C6.80%2C80.20%2C7.20&layer=mapnik" />
          </div>
        </Reveal>
      </div>
    </div>
  );
}
