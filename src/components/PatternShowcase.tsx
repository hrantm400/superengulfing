import React, { useState, useRef } from 'react';
import PdfSuccessPopup from './PdfSuccessPopup';
import { useTranslation } from '../locales';
import { useTheme } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { getApiUrl } from '../lib/api';
import AnimatedSection from './ui/AnimatedSection';

// --- PATTERN DATA (8 setups) ---
const PATTERNS = [
  {
    id: 'run-bull',
    name: 'RUN Bull',
    type: 'CONTINUATION',
    isBull: true,
    isPlus: false,
    logic: 'Close > Prev Close',
    c1: { open: 55, close: 40, high: 30, low: 65, bull: true },
    c2: { open: 50, close: 30, high: 20, low: 80, bull: true },
    sweep: { y: 65, label: 'SWEEP', isHigh: false },
  },
  {
    id: 'run-bear',
    name: 'RUN Bear',
    type: 'CONTINUATION',
    isBull: false,
    isPlus: false,
    logic: 'Close < Prev Close',
    c1: { open: 40, close: 55, high: 35, low: 70, bull: false },
    c2: { open: 50, close: 70, high: 20, low: 80, bull: false },
    sweep: { y: 35, label: 'SWEEP', isHigh: true },
  },
  {
    id: 'rev-bull',
    name: 'REV Bull',
    type: 'REVERSAL',
    isBull: true,
    isPlus: false,
    logic: 'Close > Prev Open',
    c1: { open: 40, close: 60, high: 30, low: 70, bull: false },
    c2: { open: 65, close: 35, high: 25, low: 85, bull: true },
    sweep: { y: 70, label: 'SWEEP', isHigh: false },
  },
  {
    id: 'rev-bear',
    name: 'REV Bear',
    type: 'REVERSAL',
    isBull: false,
    isPlus: false,
    logic: 'Close < Prev Open',
    c1: { open: 60, close: 40, high: 30, low: 70, bull: true },
    c2: { open: 35, close: 65, high: 15, low: 80, bull: false },
    sweep: { y: 30, label: 'SWEEP', isHigh: true },
  },
  {
    id: 'run-plus-bull',
    name: 'RUN+ Bull',
    type: 'STRONG CONTINUATION',
    isBull: true,
    isPlus: true,
    logic: 'Close > Prev High',
    c1: { open: 65, close: 50, high: 40, low: 75, bull: true },
    c2: { open: 60, close: 25, high: 15, low: 90, bull: true },
    sweep: { y: 75, label: 'SWEEP', isHigh: false },
  },
  {
    id: 'run-plus-bear',
    name: 'RUN+ Bear',
    type: 'STRONG CONTINUATION',
    isBull: false,
    isPlus: true,
    logic: 'Close < Prev Low',
    c1: { open: 50, close: 65, high: 40, low: 75, bull: false },
    c2: { open: 45, close: 85, high: 20, low: 95, bull: false },
    sweep: { y: 40, label: 'SWEEP', isHigh: true },
  },
  {
    id: 'rev-plus-bull',
    name: 'REV+ Bull',
    type: 'STRONG REVERSAL',
    isBull: true,
    isPlus: true,
    logic: 'Close > Prev High',
    c1: { open: 40, close: 65, high: 30, low: 75, bull: false },
    c2: { open: 70, close: 20, high: 10, low: 90, bull: true },
    sweep: { y: 75, label: 'SWEEP', isHigh: false },
  },
  {
    id: 'rev-plus-bear',
    name: 'REV+ Bear',
    type: 'STRONG REVERSAL',
    isBull: false,
    isPlus: true,
    logic: 'Close < Prev Low',
    c1: { open: 65, close: 40, high: 30, low: 75, bull: true },
    c2: { open: 35, close: 85, high: 15, low: 95, bull: false },
    sweep: { y: 30, label: 'SWEEP', isHigh: true },
  },
] as const;

type PatternItem = (typeof PATTERNS)[number];

const TYPE_TO_LOCALE: Record<string, 'descContinuation' | 'descReversal' | 'descStrongContinuation' | 'descStrongReversal'> = {
  'CONTINUATION': 'descContinuation',
  'REVERSAL': 'descReversal',
  'STRONG CONTINUATION': 'descStrongContinuation',
  'STRONG REVERSAL': 'descStrongReversal',
};

// --- 3D PATTERN CARD ---
const PatternCard: React.FC<{ pattern: PatternItem; isDark: boolean; index: number }> = ({ pattern, isDark, index }) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const color = pattern.isBull ? '#1DD782' : '#F43F5E';
  const bgCard = isDark ? '#0F172A' : '#FFFFFF';
  const borderCard = isDark ? '#1E293B' : '#E2E8F0';
  const textSub = isDark ? '#64748B' : '#94A3B8';
  const textLogic = isDark ? '#E2E8F0' : '#0F172A';
  const gridLine = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const candleBg = isDark ? '#0F172A' : '#FFFFFF';
  const typeLabelKey = TYPE_TO_LOCALE[pattern.type];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotation({ x: 0, y: 0 });
  };

  const renderCandle = (c: { open: number; close: number; high: number; low: number; bull: boolean }, x: number) => {
    const cColor = c.bull ? '#1DD782' : '#F43F5E';
    const bodyTop = Math.min(c.open, c.close);
    const bodyHeight = Math.abs(c.open - c.close);
    return (
      <g
        className="transition-all duration-500 ease-out"
        style={{
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          transformOrigin: `${x}px 50px`,
        }}
      >
        <line
          x1={x}
          y1={c.high}
          x2={x}
          y2={c.low}
          stroke={cColor}
          strokeWidth="6"
          strokeLinecap="round"
          className="opacity-0 transition-opacity duration-300"
          style={{ opacity: isHovered ? 0.2 : 0, filter: 'blur(4px)' }}
        />
        <line x1={x} y1={c.high} x2={x} y2={c.low} stroke={cColor} strokeWidth="2" strokeLinecap="round" />
        <rect
          x={x - 6}
          y={bodyTop}
          width="12"
          height={bodyHeight}
          fill={isHovered ? `${cColor}15` : candleBg}
          stroke={cColor}
          strokeWidth="2"
          rx="1.5"
          className="transition-colors duration-300"
        />
      </g>
    );
  };

  return (
    <div className="relative group perspective-[1000px] w-full h-full" style={{ animationDelay: `${0.1 + index * 0.05}s` }}>
      <div
        className="absolute inset-0 rounded-2xl blur-xl transition-all duration-500 opacity-0 group-hover:opacity-30"
        style={{ backgroundColor: color, transform: `translate(${rotation.y}px, ${-rotation.x}px)` }}
        aria-hidden
      />
      <div
        ref={cardRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative flex flex-col w-full h-full rounded-2xl border transition-all duration-300 cursor-default overflow-hidden animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
        style={{
          backgroundColor: bgCard,
          borderColor: isHovered ? color : borderCard,
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) translateZ(${isHovered ? '10px' : '0px'})`,
          transformStyle: 'preserve-3d',
          boxShadow: isDark ? '0 10px 30px -10px rgba(0,0,0,0.5)' : '0 10px 30px -10px rgba(0,0,0,0.1)',
        }}
      >
        <div className="flex items-start justify-between p-5 pb-0">
          <div>
            <h3 className="font-mono font-bold text-[15px] tracking-wide" style={{ color }}>
              {pattern.name}
            </h3>
            <p className="font-mono text-xs tracking-widest mt-1 uppercase" style={{ color: textSub }}>
              {typeLabelKey ? t(`home.patternShowcase.${typeLabelKey}`) : pattern.type}
            </p>
          </div>
          {pattern.isPlus && (
            <div
              className="px-2 py-0.5 rounded text-xs font-bold font-mono tracking-wider border transition-colors duration-300"
              style={{
                color,
                borderColor: isHovered ? color : `${color}40`,
                backgroundColor: `${color}10`,
              }}
            >
              {t('home.patternShowcase.plus')}
            </div>
          )}
        </div>
        <div className="relative flex-grow flex items-center justify-center p-4">
          <svg viewBox="0 0 100 110" className="w-full h-full max-h-[160px] overflow-visible">
            <defs>
              <pattern id={`grid-${pattern.id}`} width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke={gridLine} strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill={`url(#grid-${pattern.id})`} />
            <g className="transition-all duration-500">
              <line
                x1="15"
                y1={pattern.sweep.y}
                x2="85"
                y2={pattern.sweep.y}
                stroke={color}
                strokeWidth="1"
                strokeDasharray="3 3"
                className="opacity-30 group-hover:opacity-100"
              />
              <text
                x="88"
                y={pattern.sweep.y + (pattern.sweep.isHigh ? -4 : 4)}
                fill={color}
                fontSize="5"
                fontFamily="monospace"
                fontWeight="bold"
                dominantBaseline={pattern.sweep.isHigh ? 'baseline' : 'hanging'}
                className={`transition-all duration-500 ${isHovered ? 'opacity-100 translate-x-1' : 'opacity-0'}`}
              >
                {pattern.sweep.label}
              </text>
            </g>
            {renderCandle(pattern.c1, 35)}
            {renderCandle(pattern.c2, 65)}
            <text x="35" y="105" fill={textSub} fontSize="6" fontFamily="monospace" textAnchor="middle">
              t-1
            </text>
            <text x="65" y="105" fill={textLogic} fontSize="6" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
              t
            </text>
            {isHovered && (
              <line
                x1="15"
                y1={pattern.sweep.y}
                x2="85"
                y2={pattern.sweep.y}
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="100"
                strokeDashoffset="100"
                style={{ animation: 'pattern-draw-line 0.5s ease-out forwards' }}
              />
            )}
          </svg>
        </div>
        <div
          className="p-4 pt-0 text-center font-mono text-xs font-medium transition-colors duration-300"
          style={{ color: isHovered ? textLogic : textSub }}
        >
          {pattern.logic}
        </div>
      </div>
    </div>
  );
};

const PatternShowcase: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { locale } = useLocale();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(`${getApiUrl()}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'pattern-showcase', locale }),
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
    } catch {
      setStatus('error');
      setMessage(t('home.hero.connectionError'));
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes pattern-draw-line {
            to { stroke-dashoffset: 0; }
          }
        `}
      </style>
      <PdfSuccessPopup open={status === 'success'} onClose={() => setStatus('idle')} />
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-border relative transition-colors duration-700">
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full pointer-events-none blur-[120px] -z-10 transition-opacity duration-1000"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(29,215,130,0.05) 0%, transparent 60%)'
              : 'radial-gradient(circle, rgba(29,215,130,0.1) 0%, transparent 60%)',
          }}
          aria-hidden
        />
        <div className="max-w-6xl mx-auto flex flex-col items-center relative z-0">
          <AnimatedSection className="text-center mb-16 max-w-2xl" delayMs={80}>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-foreground">
              {t('home.patternShowcase.title')}
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-muted">
              {t('home.patternShowcase.subline')}
            </p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-20" delayMs={100}>
            {PATTERNS.map((pattern, idx) => (
              <div key={pattern.id} className="h-[260px]">
                <PatternCard pattern={pattern} isDark={isDark} index={idx} />
              </div>
            ))}
          </AnimatedSection>

          <AnimatedSection className="max-w-md mx-auto w-full relative z-10" delayMs={120}>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-muted">mail</span>
                </div>
                <input
                  type="email"
                  required
                  disabled={status === 'loading'}
                  className="w-full h-14 bg-white dark:bg-slate-800/95 border border-border rounded-lg px-12 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all duration-300 backdrop-blur-md font-mono disabled:opacity-50"
                  placeholder={t('home.patternShowcase.placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full h-16 bg-primary hover:bg-primary-glow text-black rounded-lg font-bold text-lg md:text-xl shadow-glow-primary hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
              >
                {status === 'loading'
                  ? t('home.patternShowcase.sending')
                  : t('home.patternShowcase.getPdf')}
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">download</span>
              </button>
              {status === 'error' && (
                <div className="text-red-400 text-sm font-medium text-center animate-scale-in">{message}</div>
              )}
            </form>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
};

export default PatternShowcase;
