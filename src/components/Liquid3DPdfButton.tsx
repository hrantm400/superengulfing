import React, { useState, useRef, useId } from 'react';

interface Liquid3DPdfButtonProps {
  type?: 'button' | 'submit';
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const Liquid3DPdfButton: React.FC<Liquid3DPdfButtonProps> = ({
  type = 'submit',
  disabled = false,
  children = 'GET THE FREE PDF',
  className = '',
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0 });
  const [lightPos, setLightPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const uid = useId().replace(/:/g, '');
  const id = (s: string) => `${uid}-${s}`;

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -18;
    const rotateY = ((x - centerX) / centerX) * 18;
    const lightX = (x / rect.width) * 100;
    const lightY = (y / rect.height) * 100;
    setTransform({ rotateX, rotateY });
    setLightPos({ x: lightX, y: lightY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
    setTransform({ rotateX: 0, rotateY: 0 });
    setLightPos({ x: 50, y: 50 });
  };

  const transitionStyle =
    isHovered && !isPressed ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

  return (
    <div className={`relative group w-full perspective-[1200px] ${className}`}>
      <style>
        {`
          @keyframes wave-forward {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes wave-backward {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          @keyframes bubble-rise {
            0% { transform: translateY(100%) scale(0.5); opacity: 0; }
            50% { opacity: 0.8; }
            100% { transform: translateY(-20%) scale(1.2); opacity: 0; }
          }
        `}
      </style>

      <div
        className="absolute inset-0 bg-black/80 rounded-xl blur-[15px] transition-all duration-400"
        style={{
          transform: isHovered
            ? `translate(${transform.rotateY * 0.5}px, ${-transform.rotateX * 0.5 + 15}px) scale(0.95)`
            : 'translate(0px, 12px) scale(0.9)',
          opacity: isHovered ? 0.8 : 0.4,
        }}
        aria-hidden
      />

      <button
        ref={buttonRef}
        type={type}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        className="relative w-full h-[64px] rounded-xl outline-none preserve-3d cursor-pointer bg-[#081226] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          transform: `rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) translateZ(${isPressed ? '-5px' : '0px'})`,
          transition: transitionStyle,
          transformStyle: 'preserve-3d',
        }}
        aria-label={typeof children === 'string' ? children : 'Get the free PDF'}
      >
        <div
          className="absolute inset-0 w-full h-full rounded-xl bg-[#081226] border border-[#0c1f3d]"
          style={{ transform: 'translateZ(-12px)' }}
          aria-hidden
        />

        <div
          className="absolute inset-0 w-full h-full rounded-xl overflow-hidden border border-[#38bdf8]/40 shadow-[inset_0_5px_20px_rgba(0,0,0,0.9)] bg-gradient-to-b from-[#0c1f3d] to-[#061224]"
          style={{ transform: 'translateZ(0px)' }}
          aria-hidden
        >
          <div
            className="absolute inset-0 w-full h-full origin-center"
            style={{
              transform: `scale(1.3) rotateZ(${-transform.rotateY * 0.6}deg) translateY(${transform.rotateX * 0.4}px)`,
              transition: transitionStyle,
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              {[
                { left: 12, delay: 0, dur: 4.2 },
                { left: 38, delay: 0.4, dur: 5 },
                { left: 62, delay: 1, dur: 3.8 },
                { left: 78, delay: 1.5, dur: 5.5 },
                { left: 22, delay: 0.8, dur: 4.5 },
                { left: 88, delay: 0.2, dur: 4.8 },
              ].map((b, i) => (
                <div
                  key={i}
                  className="absolute bottom-0 w-1.5 h-1.5 bg-white/40 rounded-full animate-[bubble-rise_4s_ease-in_infinite]"
                  style={{
                    left: `${b.left}%`,
                    animationDelay: `${b.delay}s`,
                    animationDuration: `${b.dur}s`,
                  }}
                />
              ))}
            </div>
            <svg
              className="absolute w-[200%] h-[130%] left-0 bottom-[-15%] animate-[wave-backward_6s_linear_infinite]"
              viewBox="0 0 200 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M 0 60 Q 20 45 40 60 T 80 60 T 120 60 T 160 60 T 200 60 V 100 H 0 Z"
                fill={`url(#${id('water-grad-back')})`}
              />
            </svg>
            <svg
              className="absolute w-[200%] h-[140%] left-0 bottom-[-20%] animate-[wave-forward_4s_linear_infinite]"
              viewBox="0 0 200 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M 0 55 Q 25 35 50 55 T 100 55 T 150 55 T 200 55 V 100 H 0 Z"
                fill={`url(#${id('water-grad-front')})`}
              />
            </svg>
            <svg
              className="absolute w-[200%] h-[140%] left-0 bottom-[-20%] animate-[wave-forward_4s_linear_infinite]"
              viewBox="0 0 200 100"
              preserveAspectRatio="none"
              style={{ mixBlendMode: 'overlay' }}
              aria-hidden
            >
              <path
                d="M 0 55 Q 25 35 50 55 T 100 55 T 150 55 T 200 55 V 58 H 0 Z"
                fill={`url(#${id('foam-grad')})`}
                opacity="0.6"
              />
            </svg>
          </div>

          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id={id('water-grad-front')} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id={id('water-grad-back')} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id={id('foam-grad')} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <pattern id={id('tech-grid')} width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1" />
              </pattern>
              <radialGradient id={id('spotlight')} cx={`${lightPos.x}%`} cy={`${lightPos.y}%`} r="60%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <linearGradient id={id('sharp-glare')} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                <stop offset="25%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="26%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${id('tech-grid')})`} />
            <rect width="100%" height="100%" fill={`url(#${id('sharp-glare')})`} className="opacity-80" />
            <rect
              width="100%"
              height="100%"
              fill={`url(#${id('spotlight')})`}
              className="transition-opacity duration-200 mix-blend-overlay"
              style={{ opacity: isHovered ? 1 : 0 }}
            />
            <rect
              width="calc(100% - 4px)"
              height="calc(100% - 4px)"
              x="2"
              y="2"
              rx="10"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              style={{ clipPath: 'inset(0 0 80% 0)' }}
            />
          </svg>
        </div>

        <div
          className="absolute inset-0 w-full h-full flex items-center justify-center gap-3 text-white font-black tracking-widest text-[16px] pointer-events-none"
          style={{
            transform: `translateZ(${isPressed ? '5px' : '25px'})`,
            transition: transitionStyle,
            textShadow: '0px 4px 15px rgba(0,0,0,0.9), 0px 0px 5px rgba(0,0,0,0.5)',
          }}
        >
          <span className="uppercase">{children}</span>
          <div className="relative flex items-center justify-center w-6 h-6 overflow-visible">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-all duration-300 ${isHovered ? 'translate-x-1.5' : ''}`}
              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.8))' }}
              aria-hidden
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </button>
    </div>
  );
};

export default Liquid3DPdfButton;
