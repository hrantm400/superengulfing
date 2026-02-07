import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { useCinematic } from '../CinematicContext';
import { soundManager } from '../lib/audio';

const TEXT_PREFIX = " commits to success in any possible way with trading.";

export const SceneMonolith: React.FC = () => {
    const { scene, userName, vfx, setScene } = useCinematic();
    const [displayedText, setDisplayedText] = useState("");

    // 3D Tilt Logic
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useSpring(useTransform(y, [-300, 300], [5, -5]), { stiffness: 150, damping: 20 });
    const rotateY = useSpring(useTransform(x, [-300, 300], [-5, 5]), { stiffness: 150, damping: 20 });

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - (rect.left + rect.width / 2));
        y.set(e.clientY - (rect.top + rect.height / 2));
    };

    // Typing Effect Logic
    useEffect(() => {
        if (scene !== 'reveal' && scene !== 'typing') return;

        let i = 0;
        const fullText = userName + TEXT_PREFIX;

        // Delay before typing starts (Monolith reveal time)
        const startDelay = setTimeout(() => {
            setScene('typing');

            const interval = setInterval(() => {
                i++;
                setDisplayedText(fullText.substring(0, i));

                // VFX & Sound per letter
                if (vfx.current) {
                    // Random position near center for spark (simplified)
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    // Ideally we'd calculate exact letter position, but for now random sparks in the text area
                    vfx.current.emitSpark(w / 2 + (Math.random() - 0.5) * 200, h / 2);
                }
                soundManager.playType();

                if (i >= fullText.length) {
                    clearInterval(interval);
                    setScene('impact'); // Ready for stamping
                }
            }, 50); // Speed

            return () => clearInterval(interval);
        }, 2000); // 2s reveal animation

        return () => clearTimeout(startDelay);
    }, [scene]);

    if (scene === 'void') return null;

    return (
        <motion.div
            className="absolute inset-0 flex items-center justify-center perspective-1000 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.5, filter: 'blur(20px)', transition: { duration: 1 } }}
            onMouseMove={handleMouseMove}
        >
            {/* The Monolith Certificate */}
            <motion.div
                className="relative bg-[#09090b] w-[90vw] max-w-3xl aspect-[1.6/1] border border-amber-900/30 rounded-sm shadow-2xl overflow-hidden flex flex-col items-center justify-center p-12 md:p-20 text-center"
                style={{
                    rotateX, rotateY,
                    transformStyle: 'preserve-3d',
                    boxShadow: '0 20px 50px -10px rgba(0,0,0,0.8)'
                }}
                initial={{ rotateX: 45, z: -500, filter: 'blur(10px)', opacity: 0 }}
                animate={{ rotateX: 0, z: 0, filter: 'blur(0px)', opacity: 1 }}
                transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* Holographic Border Effect */}
                <div className="absolute inset-0 pointer-events-none rounded-sm border-[4px] border-transparent"
                    style={{
                        background: 'linear-gradient(45deg, transparent 40%, rgba(212,175,55,0.2) 45%, rgba(255,255,255,0.5) 50%, rgba(212,175,55,0.2) 55%, transparent 60%)',
                        backgroundSize: '200% 200%',
                        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        maskComposite: 'exclude',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        animation: 'shimmer 8s linear infinite' // Add keyframe globally or use Framer
                    }}
                />

                <h1 className="text-amber-500/60 text-xs tracking-[0.4em] uppercase mb-8 font-serif">Official Decree</h1>

                {/* Typer Text */}
                <p className="text-2xl md:text-4xl text-slate-300 font-serif leading-relaxed" style={{ fontFamily: 'Playfair Display, serif' }}>
                    {displayedText.split('').map((char, index) => (
                        <motion.span
                            key={index}
                            initial={{ color: '#ffffff', textShadow: '0 0 20px white' }}
                            animate={{ color: index < userName.length ? '#d4af37' : '#94a3b8', textShadow: '0 0 0px transparent' }}
                            transition={{ duration: 0.5 }}
                        >
                            {char}
                        </motion.span>
                    ))}
                    <span className="inline-block w-0.5 h-8 bg-amber-500 ml-1 align-middle animate-pulse" />
                </p>

            </motion.div>
        </motion.div>
    );
};
