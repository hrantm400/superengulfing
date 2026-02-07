import React from 'react';

const BackgroundEffects: React.FC = () => {
  return (
    <>
      <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>
      <div className="absolute top-0 left-0 w-full h-[100vh] overflow-hidden pointer-events-none z-0 flex items-center justify-center">
        <div className="relative w-[600px] h-[500px] opacity-20 md:opacity-25 transform scale-110 md:scale-100">

          {/* Chart Grid Line / Dashed Indicator */}
          <div className="absolute top-[65%] left-0 w-full border-t border-dashed border-gray-500/50 flex items-end justify-end pr-4">
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest -mt-5">
              Sell Side Liquidity (SSL)
            </span>
          </div>

          {/* Bearish Candle (The setup) */}
          <div className="absolute left-[35%] top-[25%] h-[40%] w-8 md:w-12 text-bearish group">
            <div className="absolute w-[1px] md:w-[2px] bg-current left-1/2 -translate-x-1/2 top-0 h-[15%]"></div>
            <div className="absolute w-4 md:w-8 border bg-bearish/10 border-bearish left-1/2 -translate-x-1/2 top-[15%] h-[50%]"></div>
            <div className="absolute w-[1px] md:w-[2px] bg-current left-1/2 -translate-x-1/2 bottom-0 h-[35%]"></div>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted">
              t-1
            </div>
          </div>

          {/* Bullish Engulfing/Sweep Candle (Animated) */}
          <div className="absolute left-[50%] top-[30%] h-[50%] w-8 md:w-12 text-primary group animate-float">
            <div className="absolute w-[1px] md:w-[2px] bg-current left-1/2 -translate-x-1/2 top-0 h-[10%]"></div>
            <div className="absolute w-4 md:w-8 border bg-primary/10 border-primary left-1/2 -translate-x-1/2 top-[10%] h-[30%] shadow-glow-primary-decor"></div>
            <div className="absolute w-[1px] md:w-[2px] bg-current left-1/2 -translate-x-1/2 bottom-0 h-[60%] shadow-glow-primary-decor-strong"></div>

            {/* Code Annotation Popover */}
            <div className="absolute top-[75%] left-[140%] whitespace-nowrap hidden md:block">
              <div className="font-mono text-[10px] md:text-xs text-primary/80 bg-surface/80 border border-primary/20 px-2 py-1 rounded shadow-lg backdrop-blur-sm">
                <span className="text-muted">if</span> (low &lt; low[1]) <span className="text-muted">{`{`}</span> <br />
                &nbsp;&nbsp;sweep_detected = <span className="text-bearish">true</span>;<br />
                <span className="text-muted">{`}`}</span>
              </div>
              <div className="absolute top-1/2 -left-6 w-6 h-[1px] bg-primary/30"></div>
              <div className="absolute top-1/2 -left-6 w-1 h-1 bg-primary rounded-full -translate-y-1/2"></div>
            </div>
          </div>

          {/* Wick Grab Circle Indicator */}
          <div className="absolute left-[50%] top-[78%] w-16 h-16 -translate-x-1/2 -translate-y-1/2 border border-primary/30 rounded-full shadow-glow-primary-decor animate-pulse-slow"></div>
          <div className="absolute left-[50%] top-[85%] -translate-x-1/2 font-mono text-xs text-primary/70 tracking-tight">
            WICK GRAB
          </div>

        </div>
      </div>
    </>
  );
};

export default BackgroundEffects;