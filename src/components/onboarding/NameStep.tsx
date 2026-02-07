import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParticleBackground } from './ParticleBackground';
import { useTranslation } from '../../locales';

interface NameStepProps {
  onSubmit: (name: string) => Promise<void>;
}

export const NameStep: React.FC<NameStepProps> = ({ onSubmit }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setIsExiting(true);

    setTimeout(async () => {
      try {
        await onSubmit(name.trim());
      } catch (err) {
        setIsExiting(false);
        setIsSubmitting(false);
        setError('Connection interrupted.');
      }
    }, 1200); // Longer delay to enjoy the exit
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black text-white perspective-1000">
      <ParticleBackground />

      <AnimatePresence>
        {!isExiting && (
          <div className="relative z-10 w-full max-w-2xl px-6 text-center">

            {/* Title: Fast entry, slow settle */}
            <motion.h1
              initial={{ opacity: 0, y: 100, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }} // ExpoOut
              className="text-5xl md:text-7xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-600 drop-shadow-[0_10px_30px_rgba(217,119,6,0.2)]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              IAM
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 2 }}
              className="text-slate-400 text-lg md:text-xl font-light tracking-[0.2em] mb-16 uppercase"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              {t('onboarding.identifyToProceed')}
            </motion.p>

            <form onSubmit={handleSubmit} className="relative max-w-lg mx-auto">
              <div className="relative group">
                <motion.input
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 0.8, duration: 1.2, ease: "circOut" }}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border-none text-4xl md:text-5xl text-center text-amber-50 placeholder:text-slate-800 focus:outline-none focus:ring-0 py-4 transition-all"
                  placeholder={t('onboarding.stateYourName')}
                  style={{ fontFamily: 'Cinzel, serif' }}
                  autoFocus
                  disabled={isSubmitting}
                  autoComplete="off"
                />

                {/* The Line - Draws itself */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
                  className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"
                />

                {/* Floating Particles on Focus (handled by CSS usually, but here we keep it clean) */}
                <div className="absolute -bottom-10 left-0 w-full text-center h-4">
                  {isSubmitting && <span className="text-xs text-amber-500/80 tracking-widest animate-pulse">{t('onboarding.verifyingIdentity')}</span>}
                </div>
              </div>

              {error && <p className="text-red-500 mt-4 font-serif">{error}</p>}

              {/* Submit button is hidden visually, triggered by Enter, or barely visible */}
              <button type="submit" className="hidden" />
            </form>
          </div>
        )}
      </AnimatePresence>

      {/* Exit Overlay - Cinema Fade to White/Gold */}
      <AnimatePresence>
        {isExiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-50 bg-white pointer-events-none mix-blend-overlay"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
