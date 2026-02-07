import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCinematic } from '../CinematicContext';
import { soundManager } from '../lib/audio';

export const SceneVoid: React.FC = () => {
    const { scene, setScene, setUserName, vfx } = useCinematic();
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Play subtle ambience on mount
        soundManager.playAmbience();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        setUserName(inputValue.trim());

        // VFX: Dissolve
        if (inputRef.current && vfx.current) {
            const rect = inputRef.current.getBoundingClientRect();
            vfx.current.emitImplosion(rect);
        }

        // Audio: Swoosh
        soundManager.playSwoosh();

        // Trigger next scene
        setScene('reveal');
    };

    if (scene !== 'void') return null;

    return (
        <motion.div
            className="absolute inset-0 flex items-center justify-center z-10"
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
        >
            <form onSubmit={handleSubmit} className="relative w-full max-w-md mx-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="relative group"
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg blur opacity-25 group-focus-within:opacity-75 transition duration-1000 group-focus-within:duration-200" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Identify Yourself"
                        className="relative block w-full bg-black/50 backdrop-blur-xl border border-white/10 rounded-lg py-4 px-6 text-xl text-center text-white placeholder:text-slate-600 focus:outline-none focus:border-white/30 transition-colors shadow-2xl"
                        autoFocus
                        style={{ fontFamily: 'Cinzel, serif' }}
                    />
                </motion.div>
            </form>
        </motion.div>
    );
};
