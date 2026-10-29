import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import mountainView from '../assets/hero/mountain-view.jpg';
import infinityPool from '../assets/hero/infinity-pool.jpg';

export const HERO_SLIDES = [
  { src: mountainView, alt: 'Sun loungers with folded towels facing a mountain valley at sunset' },
  { src: infinityPool, alt: 'Infinity pool overlooking the sea, shaded by palm trees' },
];
const INTERVAL = 7000; // ms each image stays up

// The outgoing image dims away to the dark backdrop first, then the next one fades in with a slow zoom.
const SLIDE = {
  shown: { opacity: 1, scale: 1.1, transition: { opacity: { duration: 1.2, delay: 0.5, ease: 'easeOut' }, scale: { duration: 8, ease: 'linear' } } },
  hidden: { opacity: 0, scale: 1.18, transition: { opacity: { duration: 0.8, ease: 'easeIn' }, scale: { duration: 0, delay: 0.8 } } },
};
const SLIDE_REDUCED = {
  shown: { opacity: 1, scale: 1.1, transition: { duration: 0.3 } },
  hidden: { opacity: 0, scale: 1.1, transition: { duration: 0.3 } },
};

/** Current slide index; moves on every INTERVAL unless the visitor prefers reduced motion. */
export function useSlideshow(count) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduceMotion || count < 2) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL);
    return () => clearTimeout(t);
  }, [index, count, reduceMotion]);
  return index;
}

/** All slides stacked (so they are preloaded); only the current one is visible. */
export function HeroImages({ slides, index }) {
  const reduceMotion = useReducedMotion();
  return slides.map((s, i) => (
    <motion.img key={s.src} src={s.src} alt={i === index ? s.alt : ''} aria-hidden={i !== index} decoding="async" fetchpriority={i === 0 ? 'high' : 'low'}
      className="absolute inset-0 h-full w-full object-cover"
      initial={i === 0 ? { opacity: 1, scale: reduceMotion ? 1.1 : 1.18 } : 'hidden'}
      animate={i === index ? 'shown' : 'hidden'} variants={reduceMotion ? SLIDE_REDUCED : SLIDE} />
  ));
}
