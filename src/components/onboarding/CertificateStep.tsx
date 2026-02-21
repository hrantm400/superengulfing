import React, { useState, useEffect, useMemo, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playTypewriterTick } from './typewriterSound';
import { useTranslation } from '../../locales';
import { useLocale } from '../../contexts/LocaleContext';

interface CertificateStepProps {
  firstName: string;
  onAgree: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export const CertificateStep: React.FC<CertificateStepProps> = ({ firstName, onAgree, onSkip }) => {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const uid = useId().replace(/:/g, '');
  const id = (s: string) => `${uid}-${s}`;

  const [firstLineDone, setFirstLineDone] = useState(false);
  const [agreeLoading, setAgreeLoading] = useState(false);
  const [visibleChars, setVisibleChars] = useState(0);
  const [declarationChars, setDeclarationChars] = useState(0);
  const [showSeal, setShowSeal] = useState(false);

  const DECLARATION_LINES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => t(`onboarding.declaration${i}`));
  const DECLARATION_FULL = DECLARATION_LINES.join('\n');
  const firstLine = t('onboarding.certDeclarePrefix') + firstName + t('onboarding.certDeclareSuffix');
  const declarationComplete = firstLineDone && declarationChars >= DECLARATION_FULL.length;

  const candles = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const isBull = Math.random() > 0.4;
      const height = Math.random() * 80 + 20;
      const top = Math.random() * 50 + 10;
      const wickTop = top - (Math.random() * 15 + 5);
      const wickBottom = top + height + (Math.random() * 15 + 5);
      return {
        id: i,
        left: `${i * 4.2 + Math.random() * 2}%`,
        bodyTop: `${top}%`,
        bodyHeight: `${height}px`,
        wickTop: `${wickTop}%`,
        wickHeight: `${wickBottom - wickTop}%`,
        isBull,
        opacity: Math.random() * 0.15 + 0.05,
        delay: Math.random() * 2,
      };
    });
  }, []);

  useEffect(() => {
    if (visibleChars >= firstLine.length) {
      setTimeout(() => setFirstLineDone(true), 600);
      return;
    }
    const speed = Math.random() * 20 + 20;
    const timeout = setTimeout(() => {
      setVisibleChars((prev) => prev + 1);
      playTypewriterTick();
    }, speed);
    return () => clearTimeout(timeout);
  }, [visibleChars, firstLine.length, firstLine]);

  useEffect(() => {
    if (!firstLineDone || declarationChars >= DECLARATION_FULL.length) {
      if (declarationChars >= DECLARATION_FULL.length && !showSeal) {
        setTimeout(() => setShowSeal(true), 1200);
      }
      return;
    }
    const speed = Math.random() * 12 + 8;
    const timeout = setTimeout(() => {
      setDeclarationChars((prev) => prev + 1);
      playTypewriterTick();
    }, speed);
    return () => clearTimeout(timeout);
  }, [firstLineDone, declarationChars, DECLARATION_FULL.length, showSeal]);

  const handleAgree = async () => {
    setAgreeLoading(true);
    try {
      await onAgree();
    } catch {
      setAgreeLoading(false);
    }
  };

  const dateLocale = locale === 'am' ? 'hy-AM' : 'en-US';
  const issuedDate = new Date().toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();

  const SvgDefs = () => (
    <defs>
      <linearGradient id={id('goldPremium')} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="20%" stopColor="#D97706" />
        <stop offset="40%" stopColor="#FEF3C7" />
        <stop offset="60%" stopColor="#B45309" />
        <stop offset="80%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
      <linearGradient id={id('waxGradient')} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#991b1b" />
        <stop offset="40%" stopColor="#7f1d1d" />
        <stop offset="80%" stopColor="#450a0a" />
        <stop offset="100%" stopColor="#2e0505" />
      </linearGradient>
      <linearGradient id={id('chartFade')} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(16, 185, 129, 0.15)" />
        <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
      </linearGradient>
      <filter id={id('extremeGlow')} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <filter id={id('waxDropShadow')}>
        <feDropShadow dx="3" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.8" />
      </filter>
      <pattern id={id('fineGrid')} width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.5" fill="#ffffff" opacity="0.05" />
      </pattern>
      <pattern id={id('terminalGrid')} width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      </pattern>
    </defs>
  );

  return (
    <div className="fixed inset-0 z-[100] min-h-screen bg-[#060B14] flex flex-col items-center justify-center p-4 md:p-8 font-sans overflow-auto relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Cinzel:wght@400;600;700&family=Great+Vibes&display=swap');
        .cert-font-serif { font-family: 'Playfair Display', serif; }
        .cert-font-signature { font-family: 'Great Vibes', cursive; }
        .cert-font-cinzel { font-family: 'Cinzel', serif; }
        .gold-foil-text {
          background: linear-gradient(to right, #FDE68A 0%, #D97706 25%, #FEF3C7 50%, #D97706 75%, #FDE68A 100%);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: foilShine 6s linear infinite;
        }
        @keyframes foilShine {
          to { background-position: 200% center; }
        }
      `}</style>

      {/* Trading background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg width="100%" height="100%">
          <SvgDefs />
          <rect width="100%" height="100%" fill={`url(#${id('terminalGrid')})`} />
          <motion.path
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            d="M 0 600 L 200 550 L 350 580 L 550 400 L 700 450 L 900 250 L 1200 300 L 1500 150 L 2000 200"
            fill="none"
            stroke="rgba(16, 185, 129, 0.2)"
            strokeWidth="2"
          />
          <path
            d="M 0 600 L 200 550 L 350 580 L 550 400 L 700 450 L 900 250 L 1200 300 L 1500 150 L 2000 200 L 2000 1000 L 0 1000 Z"
            fill={`url(#${id('chartFade')})`}
            opacity="0.5"
          />
        </svg>
        {candles.map((candle) => (
          <motion.div
            key={candle.id}
            className="absolute"
            style={{
              left: candle.left,
              top: 0,
              bottom: 0,
              width: '6px',
              opacity: candle.opacity,
            }}
            initial={{ y: 10 }}
            animate={{ y: -10 }}
            transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: candle.delay }}
          >
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-[1px] ${candle.isBull ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ top: candle.wickTop, height: candle.wickHeight }}
            />
            <div
              className={`absolute left-0 w-full rounded-[1px] ${candle.isBull ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ top: candle.bodyTop, height: candle.bodyHeight }}
            />
          </motion.div>
        ))}
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/10 rounded-full blur-[150px] pointer-events-none z-0" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-3xl bg-[#090d18] p-8 md:p-14 rounded-lg z-10 border border-amber-900/40 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]"
      >
        <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none opacity-40">
          <svg width="100%" height="100%">
            <rect width="100%" height="100%" fill={`url(#${id('fineGrid')})`} />
          </svg>
        </div>

        <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-lg" xmlns="http://www.w3.org/2000/svg">
          <rect x="24" y="24" width="calc(100% - 48px)" height="calc(100% - 48px)" fill="none" stroke={`url(#${id('goldPremium')})`} strokeWidth="0.5" opacity="0.6" />
          <rect x="32" y="32" width="calc(100% - 64px)" height="calc(100% - 64px)" fill="none" stroke={`url(#${id('goldPremium')})`} strokeWidth="1.5" opacity="0.9" />
          <rect x="38" y="38" width="calc(100% - 76px)" height="calc(100% - 76px)" fill="none" stroke={`url(#${id('goldPremium')})`} strokeWidth="0.5" strokeDasharray="4 6" opacity="0.4" />
        </svg>

        <div className="relative z-10 cert-font-serif flex flex-col items-center pt-2">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 1.5, ease: 'easeOut' }}
            className="text-center mb-10 relative"
          >
            <div className="absolute -inset-10 bg-amber-500/10 blur-3xl rounded-full -z-10" />
            <h2 className="cert-font-cinzel text-amber-500 uppercase tracking-[0.5em] text-sm md:text-lg font-bold mb-4 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">
              {t('onboarding.certManifestoTitle')}
            </h2>
            <div className="flex items-center justify-center gap-6">
              <div className="w-16 h-[1px] bg-gradient-to-l from-amber-500/80 to-transparent" />
              <div className="w-2 h-2 rotate-45 border border-amber-400 bg-amber-900/50 shadow-[0_0_8px_#fbbf24]" />
              <div className="w-16 h-[1px] bg-gradient-to-r from-amber-500/80 to-transparent" />
            </div>
          </motion.div>

          <div className="w-full max-w-[700px] min-h-[440px]">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              className="text-2xl md:text-[26px] text-slate-300 leading-relaxed mb-10 text-center md:text-left font-medium tracking-wide"
            >
              <span className="gold-foil-text font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] relative inline-block">
                {firstLine.substring(0, visibleChars)}
              </span>
              {!firstLineDone && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="inline-block w-[3px] h-7 bg-amber-300 ml-2 align-middle shadow-[0_0_10px_#fcd34d]"
                />
              )}
            </motion.p>

            {firstLineDone && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-left w-full space-y-4 text-slate-300/80 text-[17px] md:text-[19px] leading-relaxed"
              >
                {DECLARATION_FULL.substring(0, declarationChars).split('\n').map((line, i) => {
                  const isHighlight = i === 3 || i === 10;
                  return (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, x: -20, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`relative ${isHighlight ? 'gold-foil-text font-semibold italic mt-8 border-l-[4px] border-amber-500/60 pl-6 text-[18px] md:text-[21px]' : 'pl-6 border-l-[2px] border-transparent hover:text-slate-200 transition-colors duration-300'}`}
                    >
                      {isHighlight && <span className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent -z-10 -left-[4px]" />}
                      {line}
                    </motion.p>
                  );
                })}
                {declarationChars < DECLARATION_FULL.length && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-block w-[2px] h-5 bg-amber-400 ml-6 align-middle shadow-[0_0_8px_#fcd34d]"
                  />
                )}
              </motion.div>
            )}
          </div>

          <div className="w-full mt-10 flex flex-col md:flex-row justify-between items-stretch md:items-end gap-8 relative min-h-[140px]">
            <AnimatePresence>
              {showSeal && (
                <motion.div
                  initial={{ opacity: 0, filter: 'blur(10px)', x: -30 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', x: 0 }}
                  transition={{ delay: 0.8, duration: 1.5, ease: 'easeOut' }}
                  className="w-full md:w-64"
                >
                  <p className="cert-font-signature text-[54px] leading-none text-amber-50/90 mb-3 drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)] relative z-10 transform -rotate-3">
                    {firstName}
                  </p>
                  <div className="w-full h-[1.5px] bg-gradient-to-r from-amber-800 via-amber-600/50 to-transparent mb-3" />
                  <p className="text-[11px] md:text-[13px] tracking-[0.25em] text-amber-500/70 uppercase cert-font-cinzel font-bold">
                    {t('onboarding.certAuthorizedSignature')}
                  </p>
                  <p className="text-[10px] tracking-[0.1em] text-slate-500 mt-1 font-sans">
                    {t('onboarding.certIssued')}: {issuedDate}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {declarationComplete && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col items-center md:items-end justify-end gap-4"
              >
                <AnimatePresence>
                  {showSeal && (
                    <motion.div className="relative flex items-center justify-center md:ml-auto">
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 2, 3] }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                        className="absolute w-40 h-40 bg-red-600/30 blur-2xl rounded-full z-0"
                      />
                      <motion.svg
                        initial={{ scale: 5, opacity: 0, rotate: -120 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 120, damping: 10, mass: 1.5 }}
                        width="120"
                        height="140"
                        viewBox="0 0 140 170"
                        xmlns="http://www.w3.org/2000/svg"
                        filter={`url(#${id('waxDropShadow')})`}
                        className="relative z-10"
                      >
                        <path d="M 50 70 L 20 165 L 45 155 L 60 170 Z" fill={`url(#${id('waxGradient')})`} opacity="0.8" />
                        <path d="M 90 70 L 75 170 L 95 160 L 120 165 Z" fill={`url(#${id('waxGradient')})`} opacity="0.8" />
                        <path d="M 70 12 C 30 12 15 38 22 70 C 28 108 42 128 70 128 C 102 128 118 102 118 70 C 118 38 108 12 70 12 Z" fill={`url(#${id('waxGradient')})`} />
                        <circle cx="70" cy="70" r="40" fill={`url(#${id('waxGradient')})`} opacity="0.9" />
                        <circle cx="70" cy="70" r="38" fill="none" stroke="#2e0505" strokeWidth="2.5" opacity="0.9" />
                        <circle cx="70" cy="70" r="32" fill="none" stroke="#fca5a5" strokeWidth="0.8" opacity="0.5" strokeDasharray="3 4" />
                        <g filter={`url(#${id('extremeGlow')})`}>
                          <text x="70" y="81" fontFamily="Cinzel" fontSize="34" fill="#fecaca" textAnchor="middle" fontWeight="bold">SE</text>
                        </g>
                      </motion.svg>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  onClick={handleAgree}
                  disabled={agreeLoading}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative px-10 py-4 overflow-hidden rounded-full transition-all duration-500 mt-4 md:mt-0"
                  style={{
                    background: 'linear-gradient(180deg, rgba(30,27,25,0.9) 0%, rgba(15,15,18,0.95) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(245,158,11,0.15), 0 0 0 2px rgba(245,158,11,0.25), 0 0 32px rgba(245,158,11,0.06)',
                  }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent opacity-0 group-hover:opacity-100"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.7, ease: [0.33, 1, 0.68, 1] }}
                  />
                  <span className="relative text-amber-400 font-bold tracking-widest text-sm uppercase" style={{ textShadow: '0 0 20px rgba(245, 158, 11, 0.25)' }}>
                    {agreeLoading ? t('onboarding.certSealing') : t('onboarding.certAcceptSeal')}
                  </span>
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
