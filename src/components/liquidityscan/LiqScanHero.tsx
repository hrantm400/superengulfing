import React from 'react';
import { motion } from 'framer-motion';
import { Link } from '@remix-run/react';
import { useLocale } from '../../contexts/LocaleContext';
import { useTranslation } from '../../locales';

const LiqScanHero: React.FC = () => {
  const { localizePath } = useLocale();
  const { t } = useTranslation();
  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16 sm:pb-20">
      {/* Logo: favicon + styled SuperEngulfing text (same as navbar) */}
      <div className="flex justify-center mb-14">
        <Link to={localizePath('/')} className="group flex items-center gap-3">
          <motion.img
            src="/logo/se-favicon.png"
            alt=""
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-11 w-11 md:h-12 md:w-12 object-contain transition-transform duration-300 group-hover:scale-[1.05]"
          />
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="text-foreground font-bold text-2xl md:text-3xl tracking-tight select-none"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            Super<span className="text-primary">Engulfing</span>
          </motion.span>
        </Link>
      </div>

      <div className="text-center max-w-3xl mx-auto space-y-6">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-[0.2em] uppercase">
          {t('liqScan.hero.badge')}
        </span>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tighter text-foreground">
          {t('liqScan.hero.title')} <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-glow to-teal-400">
            {t('liqScan.hero.subtitle')}
          </span>
        </h1>
        <p className="text-muted text-lg md:text-xl font-light leading-relaxed">
          {t('liqScan.hero.description')}
        </p>
      </div>
    </section>
  );
};

export default LiqScanHero;
