import React from 'react';
import { Link } from '@remix-run/react';
import { useLocale } from '../../contexts/LocaleContext';

export const FeatureCards: React.FC = () => {
  const { localizePath } = useLocale();
  return (
    <div className="grid grid-cols-1 gap-6">

      {/* Liquidity Scan Feature Card */}
      <div className="relative glass-panel rounded-card p-6 md:p-10 overflow-hidden flex flex-col md:flex-row items-center gap-8 group transition-all duration-500 hover:shadow-card-hover">
        <div className="absolute -right-20 -top-20 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/10 transition-all duration-1000"></div>
        <div className="absolute bottom-0 left-0 w-full h-2/3 bg-gradient-to-t from-background/50 to-transparent pointer-events-none"></div>

        <div className="flex-1 relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surfaceElevated border border-border mb-4 backdrop-blur-sm shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">New Feature</span>
          </div>
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight tracking-tight">
            LiquidityScan<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Automated Patterns</span>
          </h3>
          <p className="text-muted mb-8 max-w-lg text-sm md:text-base leading-relaxed">
            Detect institutional order flow and liquidity voids instantly. Our AI scans 42 pairs in real-time to find high-probability setups.
          </p>
          <Link
            to={localizePath('/liquidityscan')}
            className="w-full md:w-auto inline-flex justify-center bg-foreground text-background hover:bg-foreground/90 px-8 py-3.5 rounded-xl font-bold transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
          >
            Start Scanning
          </Link>
        </div>

        {/* Floating Scan List Widget - Simplified, less "live" noise */}
        <div className="relative w-full md:w-64 h-auto bg-surface/80 rounded-xl border border-border p-4 flex flex-col gap-2 shadow-xl backdrop-blur-md transform transition-transform duration-500 hover:-translate-y-1 hidden sm:flex">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-1">
            <span className="text-[10px] text-muted uppercase font-medium">Live Scanner</span>
            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500"></span> Active
            </span>
          </div>
          <div className="space-y-2">
            <ScanItem pair="GBP/JPY" signal="BULLISH" type="bull" />
            <ScanItem pair="EUR/USD" signal="WAIT" type="neutral" />
            <ScanItem pair="XAU/USD" signal="BEARISH" type="bear" />
          </div>
        </div>
      </div>

    </div>
  );
};

const ScanItem: React.FC<{ pair: string; signal: string; type: 'bull' | 'bear' | 'neutral' }> = ({ pair, signal, type }) => {
  let colorClass = "text-muted";
  if (type === 'bull') colorClass = "text-primary";
  if (type === 'bear') colorClass = "text-rose-400";

  return (
    <div className="flex items-center justify-between p-2 bg-surfaceElevated rounded border border-border hover:bg-surface/80 transition-colors cursor-pointer">
      <span className="font-mono text-xs text-foreground">{pair}</span>
      <span className={`font-bold text-xs ${colorClass}`}>{signal}</span>
    </div>
  );
};
