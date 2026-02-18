import React from 'react';
import { CheckCircle2, Zap } from 'lucide-react';

export const HeroContent: React.FC = () => {
  const features = [
    "Full LiquidityScan Premium access",
    "All markets — Crypto, Forex, Indices",
    "All timeframes",
    "Real-time alerts",
    "15+ strategy presets",
    "SuperEngulfing scanner",
    "3 full months access"
  ];

  return (
    <div className="flex flex-col justify-center h-full max-w-2xl relative">
      {/* Badge */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-red-500/20 bg-red-500/10 backdrop-blur-sm animate-pulse">
          <Zap className="text-red-500" size={14} strokeWidth={3} />
          <span className="text-red-500 text-[11px] font-black uppercase tracking-[0.1em]">Only 100 Early Access Spots</span>
        </div>
      </div>

      {/* Headline */}
      <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[0.9] tracking-tight mb-6 uppercase">
        <span className="block text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          Stop Hunting
        </span>
        <span className="block text-primary drop-shadow-[0_0_28px_rgba(57,255,20,0.45)]">
          Liquidity.
        </span>
        <span className="block text-[#facc15] drop-shadow-[0_0_28px_rgba(250,204,21,0.55)]">
          Let It Find You.
        </span>
      </h1>

      {/* Subhead */}
      <p className="text-text-muted text-lg font-medium leading-relaxed mb-10 max-w-xl">
        You learned the pattern. Now let the scanner find every setup — across every market — while you sleep. 24/7. Automatic.
      </p>

      {/* Features List */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 md:p-8 backdrop-blur-md">
        <h3 className="text-white text-sm font-black uppercase tracking-widest mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
          <span className="text-primary">///</span> What You Get:
        </h3>
        
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 group cursor-default">
              <CheckCircle2 
                className="text-primary shrink-0 mt-0.5 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(57,255,20,0.5)] transition-all duration-300" 
                size={18} 
                strokeWidth={3}
              />
              <span className="text-gray-200 font-bold text-sm tracking-tight group-hover:text-white transition-colors">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};