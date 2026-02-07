import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useCinematic } from '../CinematicContext';
import { soundManager } from '../lib/audio';

export const SceneImpact: React.FC = () => {
    const { scene, setScene, vfx, submitOnboarding } = useCinematic();
    const [stamped, setStamped] = useState(false);
    const controls = useAnimation(); // For shake

    const handleStamp = async () => {
        if (stamped) return;
        setStamped(true);

        // 1. Audio
        soundManager.playImpact();

        // 2. Shake Screen via parent transform or local (Here local)
        controls.start({
            x: [0, -10, 10, -5, 5, 0],
            transition: { duration: 0.4 }
        });

        // 3. VFX
        if (vfx.current) {
            const w = window.innerWidth;
            const h = window.innerHeight;
            vfx.current.emitExplosion(w / 2, h / 2);
        }

        // 4. Submit Backend
        await submitOnboarding();

        // 5. Exit Scene after delay
        setTimeout(() => {
            setScene('exit');
            window.location.reload(); // Hard reload to clear onboarding state or use router
        }, 2000);
    };

    if (scene !== 'impact' && scene !== 'exit') return null;

    return (
        <motion.div
            className="absolute inset-0 flex items-end justify-center pb-20 z-20 pointer-events-none"
            animate={controls}
        >
            <motion.button
                onClick={handleStamp}
                initial={{ scale: 3, opacity: 0, y: 0 }}
                animate={stamped
                    ? { scale: 1, opacity: 1 } // Stamped state (on document) - ideally moved to document center
                    : { scale: 1, opacity: 1 } // Button state
                }
                // We actually want the button to BE the stamp.
                // For Hollywood feel, the button shouldn't look like a button.
                // It should float, then slam down on click.
                className="pointer-events-auto group relative w-32 h-32 rounded-full border-4 border-amber-600 bg-amber-900/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:border-amber-400 transition-colors shadow-[0_0_30px_rgba(217,119,6,0.3)]"
                style={{ pointerEvents: stamped ? 'none' : 'auto' }}
            >
                {stamped ? (
                    <motion.div
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <span className="text-4xl font-serif font-bold text-amber-500">SE</span>
                    </motion.div>
                ) : (
                    <span className="text-sm font-bold text-amber-600 tracking-widest uppercase group-hover:text-amber-400">AGREE</span>
                )}
            </motion.button>
        </motion.div>
    );
};
