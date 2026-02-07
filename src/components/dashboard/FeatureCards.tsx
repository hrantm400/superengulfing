import React from 'react';
import { Link } from '@remix-run/react';
import { Send, ArrowUpRight } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

export const FeatureCards: React.FC = () => {
  const { localizePath } = useLocale();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Liquidity Scan Feature Card */}
      <div className="lg:col-span-2 relative glass-panel rounded-card p-6 md:p-10 overflow-hidden flex flex-col md:flex-row items-center gap-8 group transition-all duration-500 hover:shadow-card-hover">
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

      {/* Telegram Community Card */}
      <div className="glass-panel rounded-card p-6 md:p-8 flex flex-col justify-between text-center relative overflow-hidden group transition-all duration-500 hover:shadow-card-hover">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-surfaceElevated rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6 group-hover:scale-105 transition-transform duration-500 border border-border">
            <Send className="text-primary ml-1 mt-1" size={28} />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Join the TG Tribe</h3>
          <p className="text-muted text-sm mb-6 max-w-[200px] mx-auto">Connect with 2,400+ traders daily. Share setups and grow together.</p>

          <div className="flex -space-x-3 justify-center mb-8">
            <Avatar url="https://lh3.googleusercontent.com/aida-public/AB6AXuCNTjzSHqstnM_GKox8m0e8J-jlBe8CbtadKkNqQLk2Z5TXpQh22XdYQaa9NJXsyaaeKJ4vlbAw2FUj6SQoqgty1ZfhcVjdJSRczX2suyygVHxNtBRa0pV7ChMfwvslebGnNI5E7b0rZxAYA9xmptvj7cJY3B2u3kSxZgvzgRDKBuHmhb4GJBX3o1cFDFIfJ1u4RpW58Et2kD6q6ooQ09BISMTbf8LUYh77K-iFYcMDHVDOrZP3XhZwuUYJ4_HIZfmb8GI5eTLFY3Y" />
            <Avatar url="https://lh3.googleusercontent.com/aida-public/AB6AXuDzD_iIgYEn-sNMrmra4lxLokXZzIzBOXy8oVT-N62s2z_p59QRuP_LWkcIIvmcQXBOzQ_H3c-eR0ajvjVdDvQP8B_15N-PTwn4ucd6u1ClDokKnqkuX3RCGPLqVPwGy_sb4Q6Li_Ay1QW7UepdyypaAch6GHefmqUgCkCvUSw_UFWEjkeRU1sviN7KLI-oN-uGxrmyiBmu0C5DOonaRCtSwOPsmwXE5pVEW2TXdQ6wmR0pFHdwavA3w5mPGsHXfz-ho2r06r-7-Zg" />
            <div className="w-10 h-10 rounded-full bg-surface border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted shadow-sm">+2k</div>
          </div>
        </div>

        <button className="relative z-10 w-full bg-surfaceElevated hover:bg-surface border border-border text-foreground py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 hover:border-primary/30 group-hover:shadow-lg">
          Open Telegram
          <ArrowUpRight size={16} className="text-muted group-hover:text-primary transition-colors" />
        </button>
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

const Avatar: React.FC<{ url: string }> = ({ url }) => (
  <div className="w-10 h-10 rounded-full bg-cover border-2 border-background" style={{ backgroundImage: `url("${url}")` }}></div>
);
