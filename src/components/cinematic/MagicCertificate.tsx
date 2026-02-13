import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import { playTypingSound, playStampImpact, playWhoosh, initAudio } from '../../utils/audioManager';
import { useTranslation } from '../../locales';

interface MagicCertificateProps {
    onSubmitName: (name: string) => Promise<void>;
    onAgree: (certificatePngBase64?: string) => Promise<void>;
    onContinue?: () => void;
    /** When user already has name (e.g. after first login), skip to certificate step */
    initialStep?: 'trap' | 'certificate';
    initialName?: string;
}

export const MagicCertificate: React.FC<MagicCertificateProps> = ({ onSubmitName, onAgree, onContinue, initialStep = 'trap', initialName = '' }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<'trap' | 'certificate' | 'aftermath'>(initialStep);
    const [name, setName] = useState(initialName);
    const [isSubmittingName, setIsSubmittingName] = useState(false);
    const [typedLength, setTypedLength] = useState(0);
    const [declarationTyped, setDeclarationTyped] = useState(0);
    const mountedRef = useRef(true);
    const confettiRafRef = useRef<number | null>(null);
    const certificateCardRef = useRef<HTMLDivElement>(null);

    const DECLARATION_LINES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => t(`onboarding.declaration${i}`));
    const DECLARATION_FULL = DECLARATION_LINES.join('\n');

    useEffect(() => {
        mountedRef.current = true;
        const prevOverflow = document.body.style.overflow;
        const prevTouchAction = document.body.style.touchAction;
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        return () => {
            mountedRef.current = false;
            document.body.style.overflow = prevOverflow;
            document.body.style.touchAction = prevTouchAction;
            if (confettiRafRef.current != null) {
                cancelAnimationFrame(confettiRafRef.current);
                confettiRafRef.current = null;
            }
        };
    }, []);

    // SCENE 1: THE TRAP (Input)
    const handleNameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        initAudio(); // Unlock audio context on user gesture
        setIsSubmittingName(true);
        await onSubmitName(name); // Backend update
        setStep('certificate');
    };

    // SCENE 2: DECLARATION — typewriter for first line "I, [name], declare..."
    const firstLine = t('onboarding.certDeclarePrefix') + name + t('onboarding.certDeclareSuffix');
    const fullTypedText = step === 'certificate' ? firstLine : '';
    useEffect(() => {
        if (step !== 'certificate') return;
        setTypedLength(0);
        setDeclarationTyped(0);
        playWhoosh();
    }, [step]);

    useEffect(() => {
        if (step !== 'certificate' || fullTypedText.length === 0 || typedLength >= fullTypedText.length) return;
        const delay = 26 + Math.random() * 18;
        const t = setTimeout(() => {
            if (!mountedRef.current) return;
            setTypedLength((n) => Math.min(n + 1, fullTypedText.length));
            if (Math.random() > 0.35) playTypingSound();
        }, delay);
        return () => clearTimeout(t);
    }, [step, fullTypedText, typedLength]);

    const firstLineDone = step === 'certificate' && typedLength >= fullTypedText.length;
    useEffect(() => {
        if (!firstLineDone || declarationTyped >= DECLARATION_FULL.length) return;
        const delay = 18 + Math.random() * 13;
        const t = setTimeout(() => {
            if (!mountedRef.current) return;
            setDeclarationTyped((n) => Math.min(n + 1, DECLARATION_FULL.length));
            if (Math.random() > 0.35) playTypingSound();
        }, delay);
        return () => clearTimeout(t);
    }, [firstLineDone, declarationTyped, DECLARATION_FULL.length]);

    // SCENE 4: IMPACT — show aftermath; onAgree is called when user clicks OK
    const handleAgreeClick = () => {
        playStampImpact();
        gsap.fromTo("body",
            { x: -5, y: 5 },
            { x: 0, y: 0, duration: 0.3, ease: "rough({strength: 2, points: 10})" }
        );
        const end = Date.now() + 1000;
        const colors = ['#d4af37', '#ffffff'];
        (function frame() {
            if (!mountedRef.current) return;
            confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors });
            confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors });
            if (Date.now() < end) confettiRafRef.current = requestAnimationFrame(frame);
        }());
        setStep('aftermath');
    };

    const handleAftermathOK = async () => {
        try {
            await onAgree(undefined);
        } finally {
            onContinue?.();
        }
    };

    return (
        <div
            className="fixed inset-0 z-[5000] h-[100dvh] max-h-[100dvh] w-full flex items-center justify-center overflow-hidden font-space text-slate-200"
            style={{
                background: 'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(30, 28, 45, 0.5) 0%, transparent 50%), #09090b',
            }}
        >
            <AnimatePresence mode="wait">

                {/* SCENE 1: THE TRAP */}
                {step === 'trap' && (
                    <motion.form
                        key="trap"
                        onSubmit={handleNameSubmit}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, filter: "blur(12px)" }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col items-center gap-6 flex-shrink-0"
                    >
                        <motion.label
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="text-sm uppercase tracking-[0.2em] text-slate-500 font-cinzel"
                        >
                            {t('onboarding.certIdentifyYourself')}
                        </motion.label>
                        <motion.input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={t('onboarding.certStateYourName')}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.35, duration: 0.5 }}
                            className="bg-transparent border-b-2 border-white/25 text-3xl md:text-5xl text-center py-2 focus:outline-none focus:border-amber-500/70 transition-all duration-300 w-[300px] md:w-[500px] placeholder:text-slate-800 focus:shadow-[0_0_24px_rgba(245,158,11,0.2)] focus:placeholder:text-slate-700"
                            autoFocus
                            disabled={isSubmittingName}
                        />
                        <button type="submit" className="hidden" />
                    </motion.form>
                )}

                {/* SCENE 2: THE CERTIFICATE (MONOLITH) — no scroll, fit viewport */}
                {step === 'certificate' && (
                    <motion.div
                        key="certificate"
                        className="absolute inset-0 flex items-center justify-center p-4 md:p-6 overflow-hidden perspective-1000"
                        initial={{ scale: 0.88, opacity: 0, rotateX: 40, filter: 'blur(6px)' }}
                        animate={{ scale: 1, opacity: 1, rotateX: 0, filter: 'blur(0px)' }}
                        exit={{ scale: 0.88, opacity: 0, z: -500, filter: 'blur(8px)', transition: { duration: 1.2 } }}
                        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <motion.div
                            ref={certificateCardRef}
                            initial={{ boxShadow: '0 0 0 rgba(212, 175, 55, 0)' }}
                            animate={{
                                boxShadow:
                                    '0 0 0 1px rgba(212, 175, 55, 0.3), 0 0 50px -10px rgba(245, 158, 11, 0.08), 0 25px 50px -12px rgba(0,0,0,0.5)',
                            }}
                            transition={{ delay: 0.8, duration: 1 }}
                            className="relative w-full max-w-xl bg-glass-metal border border-gold-rich/50 rounded-lg p-6 md:p-8 text-center flex flex-col items-center justify-center max-h-[85vh] overflow-y-auto"
                        >

                            <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 0.7, delay: 0.2, ease: [0.33, 1, 0.68, 1] }}
                                className="w-full max-w-[200px] h-[1px] mb-2 origin-center bg-gradient-to-r from-transparent via-amber-500/70 to-transparent animate-gold-shimmer"
                                style={{ boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)' }}
                            />
                            <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                className="text-sm md:text-base text-gold-rich font-cinzel tracking-widest mb-2 animate-title-glow"
                            >
                                {t('onboarding.certMyDeclaration')}
                            </motion.h1>
                            <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 0.7, delay: 0.5, ease: [0.33, 1, 0.68, 1] }}
                                className="w-full max-w-[200px] h-px mb-4 origin-center bg-gradient-to-r from-transparent via-amber-500/70 to-transparent animate-gold-shimmer"
                            />

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6, duration: 0.45 }}
                                className="min-h-[2rem] flex items-center justify-center mb-3"
                            >
                                <p className="text-sm md:text-base leading-relaxed text-slate-200 font-space drop-shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                                    {fullTypedText.slice(0, typedLength)}
                                </p>
                                {typedLength < fullTypedText.length && (
                                    <motion.span
                                        animate={{ opacity: [1, 0.4, 1] }}
                                        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                                        className="w-2 h-5 bg-amber-500 ml-1 flex-shrink-0 rounded-sm"
                                        style={{ boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)' }}
                                    />
                                )}
                            </motion.div>

                            <div className="text-left w-full space-y-1.5 mb-4 text-slate-400 text-sm md:text-base font-space">
                                {DECLARATION_FULL.substring(0, declarationTyped).split('\n').map((line, i) => (
                                    <motion.p
                                        key={i}
                                        initial={{ opacity: 0.85 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2 }}
                                        className={(i === 3 || i === 10) ? 'text-amber-400/95 font-medium' : ''}
                                    >
                                        {line}
                                    </motion.p>
                                ))}
                                {declarationTyped < DECLARATION_FULL.length && (
                                    <motion.span
                                        animate={{ opacity: [1, 0.35, 1] }}
                                        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                                        className="inline-block w-2 h-4 bg-amber-500 ml-0.5 align-middle rounded-sm"
                                        style={{ boxShadow: '0 0 6px rgba(245, 158, 11, 0.4)' }}
                                    />
                                )}
                            </div>
                            {declarationTyped >= DECLARATION_FULL.length && (
                                <>
                                    <motion.div
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ duration: 0.55, ease: [0.33, 1, 0.68, 1] }}
                                        className="w-full max-w-[200px] h-px my-2 origin-center bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"
                                    />
                                    <motion.p
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.08 }}
                                        className="text-gold-rich text-xs tracking-widest mb-2 animate-commitment-pulse"
                                        style={{ filter: 'drop-shadow(0 0 14px rgba(245, 158, 11, 0.3))' }}
                                    >
                                        {t('onboarding.certCommitment')}
                                    </motion.p>
                                    <motion.div
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ duration: 0.55, delay: 0.18, ease: [0.33, 1, 0.68, 1] }}
                                        className="w-full max-w-[200px] h-px mb-5 origin-center bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"
                                    />
                                </>
                            )}

                            {declarationTyped >= DECLARATION_FULL.length && (
                            <motion.button
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                whileHover={{ scale: 1.06 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={handleAgreeClick}
                                className="relative group px-10 py-3 rounded-lg overflow-hidden transition-all duration-300"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(9,9,11,0.98) 100%)',
                                    boxShadow:
                                        'inset 0 1px 0 rgba(245,158,11,0.12), 0 0 0 2px rgba(212, 175, 55, 0.35), 0 0 28px rgba(245, 158, 11, 0.06)',
                                }}
                            >
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/15 to-transparent"
                                    initial={{ x: '-100%' }}
                                    whileHover={{ x: '100%' }}
                                    transition={{ duration: 0.6 }}
                                />
                                <span
                                    className="relative text-gold-rich font-bold tracking-[0.2em] text-lg uppercase font-cinzel"
                                    style={{ textShadow: '0 0 18px rgba(245, 158, 11, 0.2)' }}
                                >
                                    {t('onboarding.certAgree')}
                                </span>
                            </motion.button>
                            )}

                        </motion.div>
                    </motion.div>
                )}

                {/* SCENE 5: AFTERMATH — "Check your email" + OK (always visible when step is aftermath) */}
                {step === 'aftermath' && (
                    <motion.div
                        key="aftermath"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 overflow-hidden"
                        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(30, 28, 45, 0.5) 0%, transparent 50%), #09090b' }}
                    >
                        <motion.h2
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="text-xl md:text-2xl text-slate-400 font-space tracking-widest uppercase mb-2"
                        >
                            {t('onboarding.certCheckEmail')}
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="text-gold-rich font-cinzel text-lg md:text-xl mb-8 drop-shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                        >
                            {t('onboarding.certJourneyBegins')}
                        </motion.p>
                        <motion.button
                            type="button"
                            onClick={handleAftermathOK}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.65, duration: 0.45 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-8 py-3 rounded-md bg-gold-rich/10 border-2 border-gold-rich/70 text-gold-rich font-cinzel font-semibold tracking-widest uppercase text-sm hover:bg-gold-rich/20 hover:border-gold-rich transition-all duration-300"
                        >
                            {t('onboarding.certOK')}
                        </motion.button>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};
