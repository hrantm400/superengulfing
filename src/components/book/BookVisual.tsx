import React from 'react';

const BookVisual: React.FC = () => {
    return (
        <div className="relative w-full max-w-[380px] aspect-[3/4.2] mt-10 group perspective-[1000px] mx-auto">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full scale-75 animate-pulse"></div>
            
            {/* Book Container */}
            <div className="relative w-full h-full rounded-sm shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] transition-transform duration-700 group-hover:rotate-y-6 group-hover:-translate-y-2 bg-surface border border-border overflow-hidden flex flex-col transform-style-3d">
                
                {/* Book Cover Design */}
                <div className="h-full w-full bg-gradient-to-br from-[#0a0c10] to-[#1a1c22] flex flex-col justify-between p-10 relative">
                    
                    {/* Gold Diagonal Overlay Pattern */}
                    <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
                        <svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
                            <path d="M0 100 L100 0 L100 100 Z" fill="url(#goldGrad)"></path>
                            <defs>
                                <linearGradient id="goldGrad" x1="0" x2="1" y1="0" y2="1">
                                    <stop offset="0" stopColor="#d4af37"></stop>
                                    <stop offset="1" stopColor="transparent"></stop>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    {/* Top Text */}
                    <div className="relative z-10">
                        <div className="text-primary text-[10px] font-bold tracking-[0.4em] mb-4 opacity-70 font-display">QUANTITATIVE SERIES</div>
                        <div className="text-foreground text-5xl font-bold leading-[0.9] tracking-tighter font-display">
                            SUPER<br />ENGULFING
                        </div>
                    </div>

                    {/* Center Icon */}
                    <div className="relative z-10 flex justify-center py-4">
                        <span className="material-symbols-outlined text-[100px] text-primary/40">token</span>
                    </div>

                    {/* Bottom Text */}
                    <div className="relative z-10 border-t border-border pt-6">
                        <div className="text-muted text-xs tracking-widest uppercase font-display">Volume III / First Edition</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookVisual;