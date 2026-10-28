import { motion } from 'framer-motion';

export default function PageHero({ kicker, title, text, image }) {
  return (
    <section className="relative h-[52vh] min-h-[380px] flex items-end overflow-hidden">
      <motion.img initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease: 'easeOut' }} src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-950/40 to-brand-950/20" />
      <div className="relative max-w-7xl mx-auto px-5 pb-14 w-full">
        <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">{kicker}</motion.span>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="font-display text-5xl sm:text-6xl text-white mt-3">{title}</motion.h1>
        {text && <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="text-white/75 mt-4 max-w-2xl leading-relaxed">{text}</motion.p>}
      </div>
    </section>
  );
}
