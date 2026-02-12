import React, { useState } from 'react';
import PdfSuccessPopup from './PdfSuccessPopup';
import { useTranslation } from '../locales';
import { getApiUrl } from '../lib/api';

type PatternType = 'bull' | 'bear';
type SetupType = 'RUN' | 'REV';
type VariantType = 'Standard' | 'Plus';

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PatternConfig {
  name: string;
  type: PatternType;
  setup: SetupType;
  variant: VariantType;
  prev: CandleData;
  curr: CandleData;
  description: string;
  descriptionKey: 'descContinuation' | 'descReversal' | 'descStrongContinuation' | 'descStrongReversal';
  condition: string;
}

// Y-axis: 0 is Top (High Price), 100 is Bottom (Low Price)
const PATTERNS: PatternConfig[] = [
  // --- RUN PATTERNS (Continuation) ---
  {
    name: "RUN Bull",
    type: 'bull',
    setup: 'RUN',
    variant: 'Standard',
    prev: { open: 60, high: 40, low: 70, close: 50 }, // Green
    curr: { open: 50, high: 30, low: 80, close: 45 }, // Green, Lower Low (Sweep), Higher Close
    description: "Continuation",
    descriptionKey: 'descContinuation',
    condition: "Close > Prev Close"
  },
  {
    name: "RUN Bear",
    type: 'bear',
    setup: 'RUN',
    variant: 'Standard',
    prev: { open: 40, high: 30, low: 60, close: 50 }, // Red
    curr: { open: 50, high: 20, low: 70, close: 55 }, // Red, Higher High (Sweep), Lower Close
    description: "Continuation",
    descriptionKey: 'descContinuation',
    condition: "Close < Prev Close"
  },
  // --- REV PATTERNS (Reversal) ---
  {
    name: "REV Bull",
    type: 'bull',
    setup: 'REV',
    variant: 'Standard',
    prev: { open: 45, high: 35, low: 65, close: 55 }, // Red
    curr: { open: 55, high: 30, low: 75, close: 40 }, // Green, Lower Low (Sweep), Close > Prev Open
    description: "Reversal",
    descriptionKey: 'descReversal',
    condition: "Close > Prev Open"
  },
  {
    name: "REV Bear",
    type: 'bear',
    setup: 'REV',
    variant: 'Standard',
    prev: { open: 55, high: 35, low: 65, close: 45 }, // Green
    curr: { open: 45, high: 25, low: 70, close: 60 }, // Red, Higher High (Sweep), Close < Prev Open
    description: "Reversal",
    descriptionKey: 'descReversal',
    condition: "Close < Prev Open"
  },
  // --- RUN+ PATTERNS (Strong Continuation) ---
  {
    name: "RUN+ Bull",
    type: 'bull',
    setup: 'RUN',
    variant: 'Plus',
    prev: { open: 65, high: 45, low: 75, close: 55 }, // Green
    curr: { open: 55, high: 30, low: 85, close: 40 }, // Green, Lower Low, Close > Prev High
    description: "Strong Continuation",
    descriptionKey: 'descStrongContinuation',
    condition: "Close > Prev High"
  },
  {
    name: "RUN+ Bear",
    type: 'bear',
    setup: 'RUN',
    variant: 'Plus',
    prev: { open: 45, high: 35, low: 65, close: 55 }, // Red
    curr: { open: 55, high: 25, low: 75, close: 70 }, // Red, Higher High, Close < Prev Low
    description: "Strong Continuation",
    descriptionKey: 'descStrongContinuation',
    condition: "Close < Prev Low"
  },
  // --- REV+ PATTERNS (Strong Reversal) ---
  {
    name: "REV+ Bull",
    type: 'bull',
    setup: 'REV',
    variant: 'Plus',
    prev: { open: 50, high: 40, low: 70, close: 60 }, // Red
    curr: { open: 60, high: 30, low: 80, close: 35 }, // Green, Lower Low, Close > Prev High
    description: "Strong Reversal",
    descriptionKey: 'descStrongReversal',
    condition: "Close > Prev High"
  },
  {
    name: "REV+ Bear",
    type: 'bear',
    setup: 'REV',
    variant: 'Plus',
    prev: { open: 60, high: 40, low: 70, close: 50 }, // Green
    curr: { open: 50, high: 20, low: 80, close: 75 }, // Red, Higher High, Close < Prev Low
    description: "Strong Reversal",
    descriptionKey: 'descStrongReversal',
    condition: "Close < Prev Low"
  }
];

const Candle: React.FC<{ data: CandleData; type: 'bull' | 'bear'; x: number }> = ({ data, type, x }) => {
  // Determine actual color based on Open/Close relationship for the individual candle, 
  // though the pattern type defines the setup sentiment.
  const isCandleBull = data.close < data.open; // Lower Y is higher price
  const colorClass = isCandleBull ? 'text-primary' : 'text-bearish';
  const fillClass = isCandleBull ? 'fill-primary' : 'fill-bearish';
  const strokeClass = isCandleBull ? 'stroke-primary' : 'stroke-bearish';

  // Calculate dimensions
  const wickTop = Math.min(data.high, data.low);
  const wickBottom = Math.max(data.high, data.low);
  const bodyTop = Math.min(data.open, data.close);
  const bodyHeight = Math.abs(data.open - data.close);

  return (
    <g className={`${colorClass}`}>
      {/* Wick */}
      <line x1={x + 10} y1={wickTop} x2={x + 10} y2={wickBottom} stroke="currentColor" strokeWidth="1.5" />
      {/* Body */}
      <rect
        x={x}
        y={bodyTop}
        width="20"
        height={bodyHeight < 1 ? 1 : bodyHeight}
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.2"
      />
    </g>
  );
};

const PatternCard: React.FC<{ config: PatternConfig; index?: number }> = ({ config, index = 0 }) => {
  const { t } = useTranslation();
  const isBull = config.type === 'bull';
  const accentColor = isBull ? 'text-primary border-primary/20' : 'text-bearish border-bearish/20';
  const glowColor = isBull ? 'shadow-[0_0_20px_rgba(57,255,20,0.1)]' : 'shadow-[0_0_20px_rgba(255,59,48,0.1)]';

  // Determine Sweep Line Coordinates
  const sweepY = isBull ? config.prev.low : config.prev.high;
  const sweepX1 = 35; // Center of Prev
  const sweepX2 = 80; // Past Curr

  return (
    <div
      className={`relative p-4 rounded-card bg-surface/60 border border-border shadow-card hover:shadow-card-hover backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 group animate-fade-in-up opacity-0 [animation-fill-mode:forwards] ${accentColor} ${glowColor}`}
      style={{ animationDelay: `${0.1 + index * 0.05}s` }}
    >

      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className={`font-bold text-sm tracking-wider ${isBull ? 'text-primary' : 'text-bearish'}`}>
            {config.name}
          </h3>
          <p className="text-[10px] text-muted font-mono uppercase">{t(`home.patternShowcase.${config.descriptionKey}`)}</p>
        </div>
        {config.variant === 'Plus' && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${isBull ? 'bg-primary/10 border-primary text-primary' : 'bg-bearish/10 border-bearish text-bearish'}`}>
            {t('home.patternShowcase.plus')}
          </span>
        )}
      </div>

      {/* Visualization */}
      <div className="h-32 w-full flex items-center justify-center relative">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">

          {/* Sweep Marker Line */}
          <line
            x1={25}
            y1={sweepY}
            x2={95}
            y2={sweepY}
            stroke="white"
            strokeOpacity="0.2"
            strokeDasharray="2 2"
            strokeWidth="0.5"
          />
          <text
            x={98}
            y={sweepY + (isBull ? 2 : 2)}
            fontSize="5"
            fill="currentColor"
            opacity="0.5"
            alignmentBaseline="middle"
            textAnchor="start"
          >
            {t('home.patternShowcase.sweep')}
          </text>

          {/* Previous Candle */}
          <Candle data={config.prev} type={config.type === 'bull' ? 'bear' : 'bull'} x={25} />
          <text x={35} y={110} fontSize="6" textAnchor="middle" fill="gray" className="font-mono">t-1</text>

          {/* Current Candle */}
          <Candle data={config.curr} type={config.type} x={65} />
          <text x={75} y={110} fontSize="6" textAnchor="middle" fill="white" className="font-mono font-bold">t</text>

          {/* Logic Annotation */}
          <path
            d={`M 75 ${config.curr.close} L 85 ${config.curr.close}`}
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* Footer Condition */}
      <div className="mt-4 pt-3 border-t border-border text-center">
        <code className="text-[10px] text-muted font-mono">
          {config.condition}
        </code>
      </div>
    </div>
  );
};

const PatternShowcase: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch(`${getApiUrl()}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'pattern-showcase' })
      });

      const data = await res.json();

      if (data.success) {
        if (data.subscriptionStatus === 'already_subscribed') {
          setStatus('error');
          setMessage(t('home.patternShowcase.emailAlreadyUsed'));
        } else if (data.subscriptionStatus === 'pending_confirmation') {
          setStatus('error');
          setMessage(t('home.patternShowcase.pendingConfirm'));
        } else {
          setStatus('success');
          setMessage(data.message);
          setEmail('');
        }
      } else {
        setStatus('error');
        setMessage(data.message);
      }
    } catch (err) {
      setStatus('error');
      setMessage(t('home.hero.connectionError'));
    }
  };

  return (
    <>
      <PdfSuccessPopup
        open={status === 'success'}
        onClose={() => setStatus('idle')}
      />
      <section className="py-24 px-4 bg-background relative border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.05s' }}>
            {t('home.patternShowcase.title')}
          </h2>
          <p className="text-muted max-w-2xl mx-auto animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.1s' }}>
            {t('home.patternShowcase.subline')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-20">
          {PATTERNS.map((pattern, idx) => (
            <PatternCard key={idx} config={pattern} index={idx} />
          ))}
        </div>

        {/* CTA Section */}
        <div className="max-w-md mx-auto relative z-10">
          <div className="absolute inset-0 bg-primary/5 blur-3xl -z-10 rounded-full"></div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-muted">mail</span>
              </div>
              <input
                type="email"
                required
                disabled={status === 'loading'}
                className="w-full h-14 bg-surface/80 border border-border rounded-lg px-12 text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all duration-300 backdrop-blur-md input-glow font-mono disabled:opacity-50"
                placeholder={t('home.patternShowcase.placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              disabled={status === 'loading'}
              className="w-full h-16 bg-primary hover:bg-primary-glow text-black rounded-lg font-bold text-lg md:text-xl shadow-glow-primary hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
            >
              {status === 'loading' ? t('home.patternShowcase.sending') : t('home.patternShowcase.getPdf')}
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">download</span>
            </button>

            {status === 'error' && (
              <div className="text-red-400 text-sm font-medium text-center animate-scale-in">{message}</div>
            )}
          </form>

          <p className="mt-4 text-center text-[10px] text-muted font-mono uppercase tracking-widest">
            {t('home.patternShowcase.footer')}
          </p>
        </div>
      </div>
    </section>
    </>
  );
};

export default PatternShowcase;