import React, { createContext, useContext, useState, useRef } from 'react';
import { VFXHandles } from './VFXLayer';

export type CinematicScene = 'void' | 'reveal' | 'typing' | 'impact' | 'exit';

interface CinematicContextType {
    scene: CinematicScene;
    setScene: (s: CinematicScene) => void;
    vfx: React.RefObject<VFXHandles>;
    userName: string;
    setUserName: (n: string) => void;
    submitOnboarding: () => Promise<void>;
}

const CinematicContext = createContext<CinematicContextType | null>(null);

export const CinematicProvider: React.FC<{ children: React.ReactNode, vfxRef: React.RefObject<VFXHandles>, onSubmit: (name: string) => Promise<void> }> = ({ children, vfxRef, onSubmit }) => {
    const [scene, setScene] = useState<CinematicScene>('void');
    const [userName, setUserName] = useState('');

    const submitOnboarding = async () => {
        await onSubmit(userName);
    };

    return (
        <CinematicContext.Provider value={{ scene, setScene, vfx: vfxRef, userName, setUserName, submitOnboarding }}>
            {children}
        </CinematicContext.Provider>
    );
};

export const useCinematic = () => {
    const ctx = useContext(CinematicContext);
    if (!ctx) throw new Error("useCinematic must be used within CinematicProvider");
    return ctx;
};
