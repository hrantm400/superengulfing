import React from 'react';
import { CandlestickChart } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-white/5 bg-background-dark/90 backdrop-blur-xl shrink-0 z-10">
      <div className="flex items-center justify-between px-6 py-4 lg:px-12 max-w-[1600px] mx-auto w-full">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <div className="size-8 rounded bg-primary flex items-center justify-center text-black shadow-[0_0_15px_rgba(57,255,20,0.4)]">
            <CandlestickChart size={20} strokeWidth={3} />
          </div>
          <h2 className="text-white text-lg font-black leading-tight tracking-tighter uppercase select-none">
            LiquidityScan 
            <span className="text-primary text-[10px] align-top ml-1 font-bold">BETA</span>
          </h2>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-text-muted bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <span className="block size-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#39ff14]"></span>
            <span>14 Spots Left</span>
          </div>
        </div>
      </div>
    </header>
  );
};