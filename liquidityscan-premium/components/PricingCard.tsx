import React from 'react';
import { Lock } from 'lucide-react';

interface PricingCardProps {
  customerEmail?: string;
  orderId?: string;
  payUrl?: string;
}

export const PricingCard: React.FC<PricingCardProps> = ({ payUrl = '/pay/liquidityscan' }) => {
  const btnText = "CLAIM MY 3 MONTHS";

  return (
    <>
      <style>{`
        .morph-btn {
          position: relative;
          padding: 24px 48px;
          font-family: "Inter", sans-serif;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #000000;
          background: transparent;
          border: none;
          cursor: pointer;
          overflow: visible;
          isolation: isolate;
          width: 100%;
        }

        .morph-btn .btn-fill {
          position: absolute;
          inset: 0;
          background: #39ff14;
          border-radius: 6px;
          transition: border-radius 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          z-index: 1;
        }

        .morph-btn:hover .btn-fill {
          border-radius: 50px;
          animation: jelly 0.6s ease;
          box-shadow: 0 0 25px rgba(57, 255, 20, 0.6);
        }

        @keyframes jelly {
          0% { transform: scale(1, 1); }
          30% { transform: scale(1.15, 0.85); }
          50% { transform: scale(0.9, 1.1); }
          70% { transform: scale(1.05, 0.95); }
          100% { transform: scale(1, 1); }
        }

        .morph-btn .orbit-dots {
          position: absolute;
          inset: -20px;
          pointer-events: none;
          z-index: 10;
        }

        .morph-btn .orbit-dots span {
          position: absolute;
          width: 6px;
          height: 6px;
          background: #39ff14;
          border-radius: 50%;
          opacity: 0;
          transition: opacity 0.3s ease;
          box-shadow: 0 0 10px #39ff14;
        }

        .morph-btn:hover .orbit-dots span { opacity: 1; }
        .morph-btn .orbit-dots span:nth-child(1) { top: 0; left: 50%; animation: orbit1 2s linear infinite; }
        .morph-btn .orbit-dots span:nth-child(2) { bottom: 0; left: 50%; animation: orbit2 2s linear infinite; }
        .morph-btn .orbit-dots span:nth-child(3) { top: 50%; left: 0; animation: orbit3 3s linear infinite; }
        .morph-btn .orbit-dots span:nth-child(4) { top: 50%; right: 0; animation: orbit4 3s linear infinite; }

        @keyframes orbit1 { 0% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(60px) translateY(20px); } 100% { transform: translateX(-50%) translateY(0); } }
        @keyframes orbit2 { 0% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-60px) translateY(-20px); } 100% { transform: translateX(-50%) translateY(0); } }
        @keyframes orbit3 { 0% { transform: translateY(-50%) translateX(0); } 50% { transform: translateY(-50%) translateX(-20px); } 100% { transform: translateY(-50%) translateX(0); } }
        @keyframes orbit4 { 0% { transform: translateY(-50%) translateX(0); } 50% { transform: translateY(-50%) translateX(20px); } 100% { transform: translateY(-50%) translateX(0); } }

        .morph-btn .btn-text {
          position: relative;
          z-index: 3;
          display: flex;
          justify-content: center;
          gap: 0;
        }
        
        .morph-btn .btn-text span {
          display: inline-block;
          transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .morph-btn:hover .btn-text span {
           transform: translateY(-3px);
           text-shadow: 0 5px 10px rgba(0,0,0,0.3);
        }

        .morph-btn .corners span {
          position: absolute;
          width: 15px;
          height: 15px;
          border: 2px solid #39ff14;
          transition: all 0.4s ease;
          opacity: 0.6;
          z-index: 2;
        }
        .morph-btn .corners span:nth-child(1) { top: -6px; left: -6px; border-right: none; border-bottom: none; }
        .morph-btn .corners span:nth-child(2) { top: -6px; right: -6px; border-left: none; border-bottom: none; }
        .morph-btn .corners span:nth-child(3) { bottom: -6px; left: -6px; border-right: none; border-top: none; }
        .morph-btn .corners span:nth-child(4) { bottom: -6px; right: -6px; border-left: none; border-top: none; }

        .morph-btn:hover .corners span { opacity: 0; transform: scale(1.5); }
      `}</style>

      <div className="flex flex-col justify-center h-full w-full max-w-md">
        {/* Card Container */}
        <div className="bg-surface border border-border p-1 rounded-2xl shadow-2xl relative overflow-hidden group">
          {/* Hover Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-b from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl blur-md pointer-events-none"></div>
          
          <div className="bg-surface rounded-xl p-8 lg:p-10 relative z-10 flex flex-col gap-6 h-full border border-border">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-foreground text-2xl font-black uppercase tracking-tight">Early Access</h3>
                <p className="text-muted text-xs mt-1 font-medium">Batch #1: Closing Soon</p>
              </div>
              <div className="bg-primary text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded animate-pulse shadow-[0_0_10px_rgba(57,255,20,0.4)]">
                66% OFF
              </div>
            </div>

            {/* Pricing */}
            <div className="py-6 border-y border-dashed border-border flex flex-col items-center justify-center text-center bg-background/50 rounded-lg">
              <span className="text-muted line-through text-sm font-bold mb-1 opacity-60">$147.00</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-primary text-5xl font-black tracking-tighter drop-shadow-[0_0_15px_rgba(57,255,20,0.15)]">$49</span>
                <span className="text-foreground font-bold uppercase text-lg tracking-tight opacity-90">/ 3 MONTHS</span>
              </div>
              <p className="text-primary font-bold text-sm mt-2 tracking-wide bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                Just $16.33 / month
              </p>
              <p className="text-muted text-[10px] mt-4 max-w-[240px] leading-tight opacity-80">
                <span className="text-foreground font-bold">Regular Price: $49/mo</span>.<br/> 
                Early Access Deal: 3 Months for the price of 1.
              </p>
            </div>

            {/* Button */}
            <div className="space-y-4 pt-2">
              <a
                href={payUrl}
                className="morph-btn group block text-center no-underline"
              >
                <div className="corners">
                    <span></span><span></span><span></span><span></span>
                </div>
                <div className="btn-fill"></div>
                <div className="btn-text">
                    {btnText.split("").map((char, i) => (
                        <span key={i} style={{ transitionDelay: `${i * 0.02}s` }}>
                            {char === " " ? "\u00A0" : char}
                        </span>
                    ))}
                </div>
                <div className="orbit-dots">
                    <span></span><span></span><span></span><span></span>
                </div>
              </a>
              
              <div className="flex items-center justify-center gap-2 text-muted text-[10px] uppercase font-bold tracking-wider opacity-70">
                <Lock size={12} />
                SSL Secure Checkout
              </div>
            </div>

            {/* What Happens Next */}
            <div className="bg-background/30 rounded-lg p-5 border border-border mt-2">
                <h4 className="text-foreground text-[10px] font-black uppercase tracking-widest mb-4 text-center border-b border-border pb-2">
                  What Happens Next:
                </h4>
                <ul className="space-y-4">
                    {[
                        "Complete payment ($49)",
                        "You're added to the early access list",
                        "Platform launches → Instant access",
                        "3 full months of Premium starts"
                    ].map((step, i) => (
                        <li 
                          key={i} 
                          className="flex items-center gap-4 text-sm text-muted group"
                        >
                            <span className="relative shrink-0 flex items-center justify-center size-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-black font-black text-lg shadow-[0_0_16px_rgba(250,204,21,0.6)] ring-2 ring-amber-400/40">
                                {i + 1}
                            </span>
                            <span className="leading-snug group-hover:text-foreground transition-colors font-medium">
                              {step}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
          </div>
        </div>

        {/* Social Proof Quote */}
        <div className="mt-8 text-center max-w-xs mx-auto cursor-default opacity-80 hover:opacity-100 transition-opacity">
          <p className="text-foreground text-sm font-medium italic leading-relaxed">
            "I found 3 setups in my first hour that I would've missed manually. This scanner pays for itself instantly."
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="size-6 rounded-full bg-gradient-to-tr from-primary to-blue-500 shadow-[0_0_10px_rgba(57,255,20,0.3)]"></div>
            <span className="text-primary text-xs font-bold tracking-wide">@CryptoChaser</span>
          </div>
        </div>
      </div>
    </>
  );
};