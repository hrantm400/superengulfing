import React from 'react';

const AccessBackground: React.FC = () => {
  return (
    <>
      <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 flex items-center justify-center lg:justify-start lg:pl-20">
        <div className="relative w-[600px] h-[500px] opacity-[0.15] transform scale-110 md:scale-100">

          <div className="absolute top-[65%] left-0 w-full border-t border-dashed border-gray-500/50 flex items-end justify-end pr-4">
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest -mt-5">SSL Grabbed</span>
          </div>

          {/* Bearish Candle */}
          <div className="absolute left-[35%] top-[25%] h-[40%] w-8 md:w-12 text-bearish group">
            <div className="absolute w-[1px] md:w-[2px] bg-current left-1/2 -translate-x-1/2 top-0 h-[15%]"></div>
            <div className="absolute w-4 md:w-8 border border-bearish left-1/2 -translate-x-1/2 top-[15%] h-[50%] bg-bearish/10"></div>
            <div className="absolute w-[1px] md:w-[2px] bg-current left-1/2 -translate-x-1/2 bottom-0 h-[35%]"></div>
          </div>

          {/* Bullish Engulfing Candle */}
          <div className="absolute left-[50%] top-[30%] h-[50%] w-8 md:w-12 text-primary group animate-float">
            <div className="absolute w-[1px] md:w-[2px] bg-current left-1/2 -translate-x-1/2 top-0 h-[10%]"></div>
            <div className="absolute w-4 md:w-8 border border-primary left-1/2 -translate-x-1/2 top-[10%] h-[30%] bg-primary/10 shadow-glow-primary-decor"></div>
            <div className="absolute w-[1px] md:w-[2px] bg-current left-1/2 -translate-x-1/2 bottom-0 h-[60%] shadow-glow-primary-decor-strong"></div>
          </div>

          <div className="absolute left-[50%] top-[85%] -translate-x-1/2 font-mono text-xs text-primary/70 tracking-tight">
            ENGULFING CONFIRMED
          </div>
        </div>
      </div>
    </>
  );
};

export default AccessBackground;