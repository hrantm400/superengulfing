import React, { useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CinematicProvider } from './CinematicContext';
import { VFXLayer, VFXHandles } from './VFXLayer';
import { SceneVoid } from './scenes/SceneVoid';
import { SceneMonolith } from './scenes/SceneMonolith';
import { SceneImpact } from './scenes/SceneImpact';

interface Props {
    onSubmit: (name: string) => Promise<void>;
    onAgree: () => Promise<void>; // Final step
}

export const CinematicOrchestrator: React.FC<Props> = ({ onSubmit, onAgree }) => {
    const vfxRef = useRef<VFXHandles>(null);

    // Wrapper to combine both logic steps if needed 
    // (We actually update name at step 1, and agree at step 4)
    const handleFinalSubmit = async (name: string) => {
        // Step 1 was just updating state locally or checking
        // SceneImpact calls this, so this should probably be the onAgree
        await onAgree();
    };

    return (
        <CinematicProvider vfxRef={vfxRef} onSubmit={handleFinalSubmit}>
            <div className="fixed inset-0 z-[5000] bg-black text-white font-sans overflow-hidden">
                <VFXLayer ref={vfxRef} />

                <AnimatePresence mode="wait">
                    <SceneVoid key="void" />
                    <SceneMonolith key="monolith" />
                    <SceneImpact key="impact" />
                </AnimatePresence>

                {/* Grain Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-20 z-[9998]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
                />
            </div>
        </CinematicProvider>
    );
};
