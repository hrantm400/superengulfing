import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playTypewriterTick } from './typewriterSound';
import { ParticleBackground } from './ParticleBackground';
import { useTranslation } from '../../locales';

interface CertificateStepProps {
  firstName: string;
  onAgree: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export const CertificateStep: React.FC<CertificateStepProps> = ({ firstName, onAgree, onSkip }) => {
  const { t } = useTranslation();
  const [firstLineDone, setFirstLineDone] = useState(false);
  const [agreeLoading, setAgreeLoading] = useState(false);
  const [visibleChars, setVisibleChars] = useState(0);
  const [declarationChars, setDeclarationChars] = useState(0);

  const DECLARATION_LINES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => t(`onboarding.declaration${i}`));
  const DECLARATION_FULL = DECLARATION_LINES.join('\n');
  const firstLine = t('onboarding.certDeclarePrefix') + firstName + t('onboarding.certDeclareSuffix');
  const declarationComplete = firstLineDone && declarationChars >= DECLARATION_FULL.length;

  useEffect(() => {
    if (visibleChars >= firstLine.length) {
      setFirstLineDone(true);
      return;
    }
    const speed = Math.random() * 28 + 22;
    const timeout = setTimeout(() => {
      setVisibleChars(prev => prev + 1);
      playTypewriterTick();
    }, speed);
    return () => clearTimeout(timeout);
  }, [visibleChars, firstLine.length]);

  useEffect(() => {
    if (!firstLineDone || declarationChars >= DECLARATION_FULL.length) return;
    const speed = Math.random() * 26 + 20;
    const timeout = setTimeout(() => {
      setDeclarationChars(prev => prev + 1);
      playTypewriterTick();
    }, speed);
    return () => clearTimeout(timeout);
  }, [firstLineDone, declarationChars, DECLARATION_FULL.length]);

  const handleAgree = async () => {
    setAgreeLoading(true);
    try {
      await onAgree();
    } catch {
      setAgreeLoading(false);
    }
  };

  const easeOutExpo = [0.16, 1, 0.3, 1];
  const easeSmooth = [0.33, 1, 0.68, 1];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-auto p-4 perspective-2000 font-serif"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(30, 27, 75, 0.4) 0%, transparent 50%), radial-gradient(ellipse 100% 100% at 50% 50%, rgba(0,0,0,0.1) 0%, black 70%), #000',
      }}
    >
      <ParticleBackground />

      {/* Ambient glow behind card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1.5 }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(245, 158, 11, 0.06) 0%, transparent 55%)',
        }}
      />

      <motion.div
        initial={{ rotateX: 18, opacity: 0, y: 60, scale: 0.96, filter: 'blur(8px)' }}
        animate={{ rotateX: 0, opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 2, ease: easeOutExpo }}
        className="relative z-10 w-full max-w-4xl"
      >
        <motion.div
          initial={{ boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' }}
          animate={{
            boxShadow:
              '0 0 0 1px rgba(245, 158, 11, 0.12), 0 0 60px -12px rgba(245, 158, 11, 0.08), 0 25px 50px -12px rgba(0,0,0,0.5)',
          }}
          transition={{ delay: 1.2, duration: 1.2 }}
          className="relative bg-[#0f172a]/60 backdrop-blur-xl border border-amber-500/25 rounded-2xl p-10 md:p-20 text-center overflow-hidden"
        >
          {/* Top Ornamental Line — gradient draw + shimmer */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.4, delay: 0.4, ease: easeSmooth }}
            className="absolute top-0 left-0 right-0 h-[2px] origin-left bg-gradient-to-r from-transparent via-amber-500/80 to-transparent animate-gold-shimmer"
            style={{ boxShadow: '0 0 16px rgba(245, 158, 11, 0.4)' }}
          />

          {/* Title block — staggered */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1, ease: easeOutExpo }}
            className="mb-12"
          >
            <motion.h2
              initial={{ opacity: 0, letterSpacing: '0.8em' }}
              animate={{ opacity: 1, letterSpacing: '0.5em' }}
              transition={{ delay: 0.85, duration: 0.8 }}
              className="text-amber-500/90 text-xs md:text-sm tracking-[0.5em] uppercase mb-4 font-bold"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              {t('onboarding.certificateTitle')}
            </motion.h2>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, delay: 1, ease: easeSmooth }}
              className="w-full max-w-md h-px mx-auto mb-4 origin-center bg-gradient-to-r from-transparent via-amber-500/60 to-transparent animate-gold-shimmer"
            />
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="text-lg md:text-xl text-amber-400 tracking-widest mb-6 animate-title-glow"
              style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 24px rgba(245, 158, 11, 0.2)' }}
            >
              {t('onboarding.certMyDeclaration')}
            </motion.h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, delay: 1.35, ease: easeSmooth }}
              className="w-full max-w-md h-px mx-auto mb-6 origin-center bg-gradient-to-r from-transparent via-amber-500/60 to-transparent animate-gold-shimmer"
            />
          </motion.div>

          <div className="min-h-[120px] flex flex-col items-center justify-center mb-6">
            <p className="text-lg md:text-xl text-slate-200 leading-relaxed max-w-2xl mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              <span className="text-amber-400 font-bold drop-shadow-[0_0_12px_rgba(245,158,11,0.2)]">{firstLine.substring(0, visibleChars)}</span>
              {!firstLineDone && (
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-block w-0.5 h-6 bg-amber-400 ml-1 align-middle rounded-full"
                  style={{ boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)' }}
                />
              )}
            </p>
            {firstLineDone && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-left w-full max-w-2xl space-y-1.5 text-slate-300 text-sm md:text-base"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {DECLARATION_FULL.substring(0, declarationChars).split('\n').map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className={(i === 3 || i === 10) ? 'text-amber-400/95 font-medium' : ''}
                  >
                    {line}
                  </motion.p>
                ))}
                {declarationChars < DECLARATION_FULL.length && (
                  <motion.span
                    animate={{ opacity: [1, 0.35, 1] }}
                    transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 align-middle rounded-full"
                    style={{ boxShadow: '0 0 6px rgba(245, 158, 11, 0.5)' }}
                  />
                )}
              </motion.div>
            )}
          </div>
          {declarationComplete && (
            <>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, ease: easeSmooth }}
                className="w-full max-w-md h-px mx-auto mb-3 origin-center bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"
              />
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-amber-500/95 text-sm tracking-widest mb-2 drop-shadow-[0_0_14px_rgba(245,158,11,0.3)] animate-commitment-pulse"
              >
                {t('onboarding.certCommitment')}
              </motion.p>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.2, ease: easeSmooth }}
                className="w-full max-w-md h-px mx-auto mb-8 origin-center bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"
              />
            </>
          )}

          <AnimatePresence>
            {declarationComplete && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.9, delay: 0.25, ease: easeOutExpo }}
                className="mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-8 border-t border-white/10"
              >
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 0.7, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="text-left"
                >
                  <p className="text-xl italic text-slate-300" style={{ fontFamily: 'Playfair Display, serif' }}>{firstName}</p>
                </motion.div>

                <motion.button
                  onClick={handleAgree}
                  disabled={agreeLoading}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative px-10 py-4 overflow-hidden rounded-full transition-all duration-500"
                  style={{
                    background: 'linear-gradient(180deg, rgba(30,27,25,0.9) 0%, rgba(15,15,18,0.95) 100%)',
                    boxShadow:
                      'inset 0 1px 0 rgba(245,158,11,0.15), 0 0 0 2px rgba(245,158,11,0.25), 0 0 32px rgba(245,158,11,0.06)',
                  }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent opacity-0 group-hover:opacity-100"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.7, ease: easeSmooth }}
                  />
                  <span
                    className="relative text-amber-400 font-bold tracking-widest text-sm uppercase"
                    style={{ textShadow: '0 0 20px rgba(245, 158, 11, 0.25)' }}
                  >
                    {agreeLoading ? t('onboarding.certSealing') : t('onboarding.certAcceptSeal')}
                  </span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};
