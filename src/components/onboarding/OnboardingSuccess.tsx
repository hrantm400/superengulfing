import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ParticleBackground } from './ParticleBackground';
import { useTranslation } from '../../locales';

interface OnboardingSuccessProps {
  email: string;
  onContinue: () => void;
}

export const OnboardingSuccess: React.FC<OnboardingSuccessProps> = ({ onContinue }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black text-white">
      <ParticleBackground />

      <div className="relative z-10 text-center">
        {/* Animated Ring of Power */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
          className="w-32 h-32 mx-auto mb-10 rounded-full border-2 border-amber-500/50 flex items-center justify-center relative"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 rounded-full border border-amber-500/30"
          />
          <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="text-4xl md:text-5xl font-bold mb-6 tracking-wide"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {t('onboarding.pactSealed')}
        </motion.h1>

        <motion.button
          onClick={onContinue}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          whileHover={{ scale: 1.05 }}
          className="mt-8 text-amber-500/60 hover:text-amber-400 uppercase tracking-[0.3em] text-xs font-bold transition-colors"
        >
          {t('onboarding.enterCommandCenter')}
        </motion.button>
      </div>
    </div>
  );
};
