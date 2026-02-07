import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Zap, TrendingUp, TrendingDown, Trophy, Brain, X, ArrowRight, Plus } from 'lucide-react';

// --- 1. CORE LOGIC (Shared) ---

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
}

interface PatternResult {
  type: 'RUN' | 'REV' | 'NONE';
  direction: 'BULL' | 'BEAR' | null;
  isPlus: boolean;
  reasons: string[];
}

const analyzeCandle = (curr: Candle, prev: Candle | undefined): PatternResult => {
  if (!prev) return { type: 'NONE', direction: null, isPlus: false, reasons: [] };

  const isBull = curr.close > curr.open;
  const isBear = curr.close < curr.open;
  const prevBull = prev.close > prev.open;
  const prevBear = prev.close < prev.open;

  let result: PatternResult = { type: 'NONE', direction: null, isPlus: false, reasons: [] };

  // Helper Conditions
  const bullLiquidityGrab = curr.low < prev.low;
  const bearLiquidityGrab = curr.high > prev.high;
  
  // PLUS Conditions
  const plusBull = curr.close > prev.high;
  const plusBear = curr.close < prev.low;

  // 1. RUN PATTERN (Continuation)
  if (isBull && prevBull && bullLiquidityGrab && curr.close > prev.close) {
    result.type = 'RUN';
    result.direction = 'BULL';
    result.reasons.push("Continuation (Green → Green)");
    result.reasons.push("Liquidity Grab (Low < Prev Low)");
    result.reasons.push("Stronger Close (Close > Prev Close)");
    if (plusBull) {
      result.isPlus = true;
      result.reasons.push("PLUS: Close > Prev High");
    }
  }
  else if (isBear && prevBear && bearLiquidityGrab && curr.close < prev.close) {
    result.type = 'RUN';
    result.direction = 'BEAR';
    result.reasons.push("Continuation (Red → Red)");
    result.reasons.push("Liquidity Grab (High > Prev High)");
    result.reasons.push("Weaker Close (Close < Prev Close)");
    if (plusBear) {
      result.isPlus = true;
      result.reasons.push("PLUS: Close < Prev Low");
    }
  }
  // 2. REV PATTERN (Reversal)
  else if (isBull && prevBear && bullLiquidityGrab && curr.close > prev.open) {
    result.type = 'REV';
    result.direction = 'BULL';
    result.reasons.push("Reversal (Red → Green)");
    result.reasons.push("Liquidity Grab (Low < Prev Low)");
    result.reasons.push("Engulfing (Close > Prev Open)");
    if (plusBull) {
      result.isPlus = true;
      result.reasons.push("PLUS: Close > Prev High");
    }
  }
  else if (isBear && prevBull && bearLiquidityGrab && curr.close < prev.open) {
    result.type = 'REV';
    result.direction = 'BEAR';
    result.reasons.push("Reversal (Green → Red)");
    result.reasons.push("Liquidity Grab (High > Prev High)");
    result.reasons.push("Engulfing (Close < Prev Open)");
    if (plusBear) {
      result.isPlus = true;
      result.reasons.push("PLUS: Close < Prev Low");
    }
  }

  return result;
};

const generateCandle = (prevClose: number, volatility: number = 5): Candle => {
  const change = (Math.random() - 0.5) * volatility * 2;
  const close = prevClose + change;
  const open = prevClose;
  const high = Math.max(open, close) + Math.abs(Math.random() * volatility * 0.5);
  const low = Math.min(open, close) - Math.abs(Math.random() * volatility * 0.5);
  return { open, high, low, close, timestamp: Date.now() };
};

// Generates a pair of candles that FORCE a specific pattern (Regular or Plus)
const createPatternPair = (type: 'RUN' | 'REV', direction: 'BULL' | 'BEAR', isPlus: boolean, startPrice: number): Candle[] => {
  const prevOpen = startPrice;
  const prevIsBull = direction === 'BULL' ? (type === 'RUN') : (type === 'REV');
  
  // Previous Candle Construction
  const prevClose = prevIsBull ? startPrice + 6 : startPrice - 6;
  const prevHigh = Math.max(prevOpen, prevClose) + 3;
  const prevLow = Math.min(prevOpen, prevClose) - 3;
  const prevCandle: Candle = { open: prevOpen, close: prevClose, high: prevHigh, low: prevLow, timestamp: 1 };

  // Current Candle Logic
  let currOpen = prevClose;
  let currClose = 0, currHigh = 0, currLow = 0;
  
  // Visual tuning to make the patterns OBVIOUS
  const grabAmount = 2.5; 
  const plusBuffer = 3; // Clear break of the level
  const regularBuffer = 1.5; // Clearly inside the level

  if (direction === 'BULL') {
      // 1. Grab Liquidity (Low < PrevLow)
      currLow = prevLow - grabAmount;

      // 2. Calculate Close
      if (type === 'RUN') {
          // Green. Close > PrevClose.
          if (isPlus) {
              // Close > PrevHigh
              currClose = prevHigh + plusBuffer;
          } else {
              // PrevClose < Close <= PrevHigh
              // We target slightly below PrevHigh to show it didn't break
              currClose = prevHigh - regularBuffer; 
          }
      } else { // REV
          // Green. Close > PrevOpen.
          if (isPlus) {
             // Close > PrevHigh
             currClose = prevHigh + plusBuffer;
          } else {
             // PrevOpen < Close <= PrevHigh
             currClose = prevHigh - regularBuffer;
          }
      }
      
      // 3. Set High (must be >= close)
      currHigh = Math.max(currClose + 1.5, prevHigh - 0.5); // Ensure high makes sense

  } else { // BEAR
      // 1. Grab Liquidity (High > PrevHigh)
      currHigh = prevHigh + grabAmount;

      // 2. Calculate Close
      if (type === 'RUN') {
          // Red. Close < PrevClose.
          if (isPlus) {
             // Close < PrevLow
             currClose = prevLow - plusBuffer;
          } else {
             // PrevClose > Close >= PrevLow
             currClose = prevLow + regularBuffer;
          }
      } else { // REV
          // Red. Close < PrevOpen.
          if (isPlus) {
             // Close < PrevLow
             currClose = prevLow - plusBuffer;
          } else {
             // PrevOpen > Close >= PrevLow
             currClose = prevLow + regularBuffer;
          }
      }
      
      // 3. Set Low (must be <= close)
      currLow = Math.min(currClose - 1.5, prevLow + 0.5);
  }
  
  const currCandle: Candle = { open: currOpen, close: currClose, high: currHigh, low: currLow, timestamp: 2 };
  return [prevCandle, currCandle];
};

// --- 2. SUB-COMPONENTS ---

// A. Canvas/Chart Renderer
const ChartRenderer: React.FC<{
  data: Candle[];
  showLabels: boolean;
  highlightIndex?: number | null;
  onHover?: (index: number | null) => void;
}> = ({ data, showLabels, highlightIndex, onHover }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const patterns = useMemo(() => data.map((c, i) => analyzeCandle(c, data[i - 1])), [data]);

  // Viewport
  const { min, max } = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 };
    const values = data.flatMap(d => [d.high, d.low]);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const range = vMax - vMin || 10;
    return { min: vMin - range * 0.3, max: vMax + range * 0.3 };
  }, [data]);

  const getX = (i: number, w: number) => {
    const padding = 40;
    const effectiveWidth = w - (padding * 2);
    return (i / (data.length - 1)) * effectiveWidth + padding;
  };
  
  const getY = (v: number, h: number) => {
    const range = max - min;
    return h - ((v - min) / range) * h;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const w = rect.width;
    const padding = 40;
    const effectiveWidth = w - (padding * 2);
    
    // Reverse calc index from X
    const relativeX = Math.max(0, Math.min(x - padding, effectiveWidth));
    const rawIdx = (relativeX / effectiveWidth) * (data.length - 1);
    const idx = Math.round(rawIdx);
    
    if (idx >= 0 && idx < data.length) {
      setHoverIdx(idx);
      if (onHover) onHover(idx);
    }
  };

  const bullColor = 'var(--chart-bull)';
  const bearColor = 'var(--chart-bear)';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 cursor-crosshair touch-none"
      onMouseLeave={() => { setHoverIdx(null); if (onHover) onHover(null); }}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchMove}
    >
      <div className="absolute inset-0 chart-grid" />
      <svg className="w-full h-full overflow-visible">
        {data.map((candle, i) => {
          if (!containerRef.current) return null;
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;

          const x = getX(i, w);
          const yOpen = getY(candle.open, h);
          const yClose = getY(candle.close, h);
          const yHigh = getY(candle.high, h);
          const yLow = getY(candle.low, h);
          const isBull = candle.close >= candle.open;
          const color = isBull ? bullColor : bearColor;
          const pattern = patterns[i];

          const isHovered = hoverIdx === i || highlightIndex === i;
          const opacity = (highlightIndex !== undefined && highlightIndex !== null && highlightIndex !== i) ? 0.3 : 1;

          const markerColor = pattern.direction === 'BULL' ? bullColor : bearColor;
          const markerY = pattern.direction === 'BULL' ? yLow + 20 : yHigh - 20;
          const bodyW = 10;
          const bodyHalf = bodyW / 2;

          return (
            <g key={i}
               onMouseEnter={() => { setHoverIdx(i); if (onHover) onHover(i); }}
               style={{ opacity, transition: 'opacity 0.2s' }}>
              <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.5" />
              <rect x={x - bodyHalf} y={Math.min(yOpen, yClose)} width={bodyW} height={Math.max(1, Math.abs(yClose - yOpen))} fill={color} stroke={color} strokeWidth="0.5" />
              {showLabels && pattern.type !== 'NONE' && (
                <g transform={`translate(${x}, ${markerY})`}>
                  <path
                    d={pattern.direction === 'BULL' ? "M0 0 L-5 7 L5 7 Z" : "M0 0 L-5 -7 L5 -7 Z"}
                    fill={markerColor}
                  />
                  <text
                    textAnchor="middle"
                    y={pattern.direction === 'BULL' ? 20 : -16}
                    fill={markerColor}
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                    style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.8)' }}
                  >
                    {pattern.type}
                  </text>
                  {pattern.isPlus && (
                    <text
                      textAnchor="middle"
                      y={pattern.direction === 'BULL' ? 32 : -28}
                      fill={markerColor}
                      fontSize="11"
                      fontWeight="bold"
                      style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.8)' }}
                    >+</text>
                  )}
                </g>
              )}
              {isHovered && <line x1={x} y1={0} x2={x} y2={h} stroke="var(--chart-hover-line)" strokeDasharray="4 4" strokeWidth="1" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// B. Simulator View
const SimulatorView: React.FC = () => {
  const [data, setData] = useState<Candle[]>([]);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  useEffect(() => {
    let initial: Candle[] = [];
    let p = 100;
    for(let i=0; i<25; i++) {
      const c = generateCandle(p);
      initial.push(c);
      p = c.close;
    }
    setData(initial);
  }, []);

  const inject = (type: 'RUN' | 'REV', dir: 'BULL' | 'BEAR', isPlus: boolean) => {
    const last = data[data.length-1];
    const pair = createPatternPair(type, dir, isPlus, last.close);
    const newData = data.length > 40 ? [...data.slice(2), ...pair] : [...data, ...pair];
    setData(newData);
    setFocusedIdx(newData.length - 1);
  };

  const currentPattern = focusedIdx !== null && focusedIdx > 0 ? analyzeCandle(data[focusedIdx], data[focusedIdx-1]) : null;

  const btnBull = "px-3 py-2.5 rounded-btn text-xs font-semibold border transition-all whitespace-nowrap bg-emerald-500/10 border-emerald-500/20 text-emerald-500 active:bg-emerald-500/30 md:hover:bg-emerald-500/20 md:hover:border-emerald-500/40";
  const btnBear = "px-3 py-2.5 rounded-btn text-xs font-semibold border transition-all whitespace-nowrap bg-rose-500/10 border-rose-500/20 text-rose-500 active:bg-rose-500/30 md:hover:bg-rose-500/20 md:hover:border-rose-500/40";

  return (
    <div className="flex flex-col h-full relative">
      {/* Inject toolbar */}
      <div className="p-4 md:p-5 border-b border-border bg-surface/80 backdrop-blur-sm flex flex-row items-center justify-between gap-4 z-10 relative flex-wrap shadow-sm">
        <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar mask-gradient-right min-w-0">
          {/* Bullish */}
          <div className="flex flex-col gap-2 shrink-0">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Bullish</span>
            <div className="flex gap-2">
              <button onClick={() => inject('RUN', 'BULL', false)} className={btnBull}>RUN BULL</button>
              <button onClick={() => inject('RUN', 'BULL', true)} className={btnBull}>RUN+</button>
              <button onClick={() => inject('REV', 'BULL', false)} className={btnBull}>REV BULL</button>
              <button onClick={() => inject('REV', 'BULL', true)} className={btnBull}>REV+</button>
            </div>
          </div>
          <div className="w-px h-10 bg-border shrink-0 self-center" aria-hidden />
          {/* Bearish */}
          <div className="flex flex-col gap-2 shrink-0">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Bearish</span>
            <div className="flex gap-2">
              <button onClick={() => inject('RUN', 'BEAR', false)} className={btnBear}>RUN BEAR</button>
              <button onClick={() => inject('RUN', 'BEAR', true)} className={btnBear}>RUN+</button>
              <button onClick={() => inject('REV', 'BEAR', false)} className={btnBear}>REV BEAR</button>
              <button onClick={() => inject('REV', 'BEAR', true)} className={btnBear}>REV+</button>
            </div>
          </div>
        </div>
        <button
          onClick={() => { const last = data[data.length - 1]; setData([...data.slice(1), generateCandle(last.close)]); }}
          className="py-2.5 px-4 rounded-btn bg-surfaceElevated border border-border active:bg-surface/80 md:hover:bg-surface/80 text-muted hover:text-foreground shrink-0 flex items-center gap-2 text-sm font-medium"
        >
          <Play size={18} />
          <span className="hidden sm:inline">Next Candle</span>
        </button>
      </div>

      <div className="flex-1 relative flex flex-col min-h-0">
        <div className="chart-zone flex-1 relative rounded-xl overflow-hidden m-3 min-h-0">
          <ChartRenderer data={data} showLabels={true} highlightIndex={focusedIdx} onHover={setFocusedIdx} />
        </div>
        {/* Pattern overlay */}
        <div className={`absolute bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-sm w-auto transition-all duration-300 transform ${currentPattern?.type !== 'NONE' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
          <div className={`glass-panel p-5 md:p-6 rounded-card border border-border shadow-2xl bg-surface/95 backdrop-blur-md border-l-4 ${currentPattern?.direction === 'BULL' ? 'border-l-primary shadow-glow-primary-sm' : 'border-l-rose-500'}`}>
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Detected pattern</p>
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-lg shrink-0 ${currentPattern?.direction === 'BULL' ? 'bg-primary/20 text-primary' : 'bg-rose-500/20 text-rose-500'}`}>
                {currentPattern?.direction === 'BULL' ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              </div>
              <h4 className="font-bold text-foreground text-lg md:text-xl leading-tight">
                {currentPattern?.type} {currentPattern?.direction} {currentPattern?.isPlus ? 'PLUS' : ''}
              </h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// C. Exam View
const ExamView: React.FC = () => {
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [data, setData] = useState<Candle[]>([]);
  const [gameState, setGameState] = useState<'GUESSING' | 'RESULT'>('GUESSING');
  const [result, setResult] = useState<{ correct: boolean; actual: PatternResult | null }>({ correct: false, actual: null });
  const [isLoading, setIsLoading] = useState(false);

  const generateScenario = useCallback(() => {
    setIsLoading(true);
    setGameState('GUESSING');
    
    // 1. Generate random base data
    let newData: Candle[] = [];
    let p = 100;
    for(let i=0; i<15; i++){
        const c = generateCandle(p);
        newData.push(c);
        p = c.close;
    }

    // 2. Decide what to append (Random or Pattern)
    const roll = Math.random();
    if(roll > 0.2) { // 80% chance of a pattern
        const types = ['RUN', 'REV'] as const;
        const dirs = ['BULL', 'BEAR'] as const;
        const isPlus = Math.random() > 0.5;
        
        const t = types[Math.floor(Math.random()*types.length)];
        const d = dirs[Math.floor(Math.random()*dirs.length)];
        const pair = createPatternPair(t, d, isPlus, p);
        newData = [...newData, ...pair];
    } else {
        // Just add two random candles
        const c1 = generateCandle(p);
        const c2 = generateCandle(c1.close);
        newData.push(c1, c2);
    }

    setData(newData);
    setIsLoading(false);
  }, []);

  useEffect(() => { generateScenario(); }, [generateScenario]);

  const handleGuess = (type: 'RUN' | 'REV' | 'NONE', direction: 'BULL' | 'BEAR' | null, isPlus: boolean) => {
     if(gameState !== 'GUESSING') return;

     const last = data[data.length-1];
     const prev = data[data.length-2];
     const actual = analyzeCandle(last, prev);

     let isCorrect = false;
     if (type === 'NONE') {
         isCorrect = actual.type === 'NONE';
     } else {
         isCorrect = actual.type === type && actual.direction === direction && actual.isPlus === isPlus;
     }
     
     if(isCorrect) {
         setScore(s => s + 100 + (streak * 20));
         setStreak(s => s + 1);
     } else {
         setStreak(0);
     }

     setResult({ correct: isCorrect, actual });
     setGameState('RESULT');
  };

  const GuessButton: React.FC<{ type: 'RUN'|'REV', dir: 'BULL'|'BEAR', isPlus: boolean, label: string, desc: string }> = ({ type, dir, isPlus, label, desc }) => {
      const isBull = dir === 'BULL';
      const colorClass = isBull ? 'text-emerald-400 group-hover:text-emerald-300' : 'text-rose-400 group-hover:text-rose-300';
      const bgClass = isBull ? 'bg-emerald-500/5 border-emerald-500/20 active:bg-emerald-500/20 md:hover:bg-emerald-500/20 md:hover:border-emerald-500' : 'bg-rose-500/5 border-rose-500/20 active:bg-rose-500/20 md:hover:bg-rose-500/20 md:hover:border-rose-500';
      const icon = isBull ? <TrendingUp size={18} className="text-emerald-500 opacity-75 md:opacity-50 group-hover:opacity-100"/> : <TrendingDown size={18} className="text-rose-500 opacity-75 md:opacity-50 group-hover:opacity-100"/>;

      return (
        <button 
            onClick={() => handleGuess(type, dir, isPlus)}
            disabled={gameState !== 'GUESSING'}
            className={`p-4 border rounded-lg text-left group transition-all relative ${bgClass} ${gameState !== 'GUESSING' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div className="flex items-center justify-between mb-1.5">
                <span className={`font-semibold text-sm ${colorClass}`}>{label}</span>
                {icon}
            </div>
            <span className="text-xs text-muted block leading-tight">{desc}</span>
            {isPlus && <div className="absolute top-2 right-2"><Plus size={12} className={colorClass} strokeWidth={3}/></div>}
        </button>
      );
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Score Header */}
      <div className="h-14 md:h-16 border-b border-border flex justify-between items-center px-4 md:px-6 bg-surface/60 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="text-primary" size={22} />
          <span className="font-bold text-foreground text-base">Practice Exam</span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="bg-surface border border-border rounded-xl px-4 py-2.5 flex flex-col items-end shadow-card">
            <span className="text-xs text-muted uppercase font-semibold">Streak</span>
            <div className="flex items-center gap-1 text-teal-400 font-mono font-bold text-xl">
              <Zap size={16} fill="currentColor" /> {streak}
            </div>
          </div>
          <div className="w-px h-10 bg-border" aria-hidden />
          <div className="bg-surface border border-border rounded-xl px-4 py-2.5 flex flex-col items-end shadow-card">
            <span className="text-xs text-muted uppercase font-semibold">Score</span>
            <span className="font-mono font-bold text-xl text-foreground">{score}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 relative border-b md:border-b-0 md:border-r border-border min-h-[300px] md:min-h-0 chart-zone rounded-xl overflow-hidden m-2 md:m-3">
            <ChartRenderer data={data} showLabels={gameState === 'RESULT'} highlightIndex={data.length-1} />
            
            {/* Result Overlay */}
            {gameState === 'RESULT' && (
                <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-surface border border-border p-6 md:p-8 rounded-card shadow-2xl max-w-md w-full text-center animate-scale-in">
                        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ring-4 ${result.correct ? 'bg-emerald-500/20 text-emerald-500 ring-emerald-500/20' : 'bg-rose-500/20 text-rose-500 ring-rose-500/20'}`}>
                            {result.correct ? <Trophy size={32} /> : <X size={32} />}
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{result.correct ? 'Excellent Read!' : 'Incorrect'}</h3>
                        <p className="text-muted mb-6 text-sm">
                            {result.correct 
                              ? "You correctly identified the pattern logic." 
                              : `Correct: ${result.actual?.type === 'NONE' ? 'NO PATTERN' : `${result.actual?.direction} ${result.actual?.type}${result.actual?.isPlus ? ' PLUS' : ''}`}`
                            }
                        </p>
                        {!result.correct && result.actual && result.actual.reasons.length > 0 && (
                            <div className="bg-surfaceElevated rounded-lg p-4 text-left mb-6 border border-border">
                                <p className="text-xs font-bold text-muted uppercase mb-2">Why it is {result.actual.type}:</p>
                                <ul className="list-disc pl-4 space-y-2 text-sm text-muted">
                                    {result.actual.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                </ul>
                            </div>
                        )}
                        <button onClick={generateScenario} className="w-full py-4 bg-primary active:scale-[0.98] text-black font-bold rounded-btn hover:bg-primary-glow shadow-glow-primary-sm hover:shadow-glow-primary transition-all duration-300 flex items-center justify-center gap-2">
                            Next Scenario <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Interaction Area */}
        <div className="w-full md:w-80 bg-surface border border-border rounded-card p-5 flex flex-col justify-center overflow-y-auto shadow-sm">
            <div className="text-center mb-4">
                <h4 className="text-foreground font-bold text-base mb-1">Analyze the last candle</h4>
                <p className="text-sm text-muted">Identify the specific pattern variation.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
                <GuessButton type="RUN" dir="BULL" isPlus={false} label="RUN BULL" desc="Green → Green" />
                <GuessButton type="RUN" dir="BULL" isPlus={true} label="RUN BULL +" desc="Close > Prev High" />
                <GuessButton type="REV" dir="BULL" isPlus={false} label="REV BULL" desc="Red → Green" />
                <GuessButton type="REV" dir="BULL" isPlus={true} label="REV BULL +" desc="Close > Prev High" />
                <GuessButton type="RUN" dir="BEAR" isPlus={false} label="RUN BEAR" desc="Red → Red" />
                <GuessButton type="RUN" dir="BEAR" isPlus={true} label="RUN BEAR +" desc="Close < Prev Low" />
                <GuessButton type="REV" dir="BEAR" isPlus={false} label="REV BEAR" desc="Green → Red" />
                <GuessButton type="REV" dir="BEAR" isPlus={true} label="REV BEAR +" desc="Close < Prev Low" />
            </div>
            <button
                onClick={() => handleGuess('NONE', null, false)}
                disabled={gameState !== 'GUESSING'}
                className="w-full py-3 rounded-lg border-2 border-border bg-transparent font-semibold text-sm text-muted hover:text-foreground hover:border-foreground/30 active:bg-surface/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                No Valid Pattern
            </button>
        </div>
      </div>
    </div>
  );
};


// --- 3. MAIN COMPONENT ---

export const ChartSection: React.FC = () => {
  const [mode, setMode] = useState<'SIMULATOR' | 'EXAM'>('SIMULATOR');

  return (
    <div className="glass-panel rounded-card border border-border border-l-4 border-l-primary shadow-card hover:shadow-card-hover flex flex-col relative overflow-hidden h-[480px] sm:h-[560px] md:h-[700px] transition-all duration-300">
       {/* Tab Switcher — segmented control */}
       <div className="shrink-0 p-3 md:p-4 border-b border-border bg-surface/60 backdrop-blur-md">
          <div className="flex bg-surfaceElevated rounded-card p-1 border border-border max-w-md mx-auto">
            <button
              onClick={() => setMode('SIMULATOR')}
              className={`flex-1 py-3 px-4 md:py-3.5 md:px-6 text-sm font-semibold transition-all flex items-center justify-center gap-2 rounded-lg ${mode === 'SIMULATOR' ? 'text-primary bg-surface shadow-card border border-primary ring-2 ring-primary/20' : 'text-muted hover:text-foreground'}`}
            >
              <Zap size={18} /> <span className="hidden sm:inline">Pattern</span> Simulator
            </button>
            <div className="w-px bg-border self-stretch my-1" aria-hidden />
            <button
              onClick={() => setMode('EXAM')}
              className={`flex-1 py-3 px-4 md:py-3.5 md:px-6 text-sm font-semibold transition-all flex items-center justify-center gap-2 rounded-lg ${mode === 'EXAM' ? 'text-primary bg-surface shadow-card border border-primary ring-2 ring-primary/20' : 'text-muted hover:text-foreground'}`}
            >
              <Trophy size={18} /> <span className="hidden sm:inline">Practice</span> Exam
            </button>
          </div>
       </div>

       <div className="flex-1 relative overflow-hidden">
         {mode === 'SIMULATOR' ? <SimulatorView /> : <ExamView />}
       </div>
    </div>
  );
};
