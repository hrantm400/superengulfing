import React from 'react';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, onToggle }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative focus:outline-none flex items-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
      style={{ width: '76px', height: '36px' }}
      aria-label="Toggle theme"
    >
      <svg viewBox="0 0 100 44" className="w-full h-full drop-shadow-sm overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="theme-track-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1120" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id="theme-track-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="100%" stopColor="#BAE6FD" />
          </linearGradient>
          <radialGradient id="theme-sun-grad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="30%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#EAB308" />
          </radialGradient>
          <radialGradient id="theme-sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(253, 224, 71, 0.6)" />
            <stop offset="100%" stopColor="rgba(253, 224, 71, 0)" />
          </radialGradient>
          <radialGradient id="theme-moon-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="45%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#64748B" />
          </radialGradient>
          <radialGradient id="theme-crater-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#94A3B8" />
          </radialGradient>
          <radialGradient id="theme-moon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(203, 213, 225, 0.4)" />
            <stop offset="100%" stopColor="rgba(203, 213, 225, 0)" />
          </radialGradient>
          <filter id="theme-inset-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="3" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.4" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
          <filter id="theme-thumb-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>
        <rect
          width="100"
          height="44"
          rx="22"
          fill={isDark ? 'url(#theme-track-dark)' : 'url(#theme-track-light)'}
          filter="url(#theme-inset-shadow)"
          className="transition-all duration-700 ease-in-out"
        />
        <rect
          width="100"
          height="44"
          rx="22"
          fill="none"
          stroke={isDark ? 'rgba(29, 215, 130, 0.3)' : 'rgba(255, 255, 255, 0.5)'}
          strokeWidth="1.5"
          className="transition-all duration-700"
        />
        <g style={{ opacity: isDark ? 1 : 0 }} className="transition-opacity duration-700 delay-100">
          <circle cx="28" cy="14" r="1" fill="#FFF" className="animate-pulse" />
          <circle cx="45" cy="24" r="1.5" fill="#FFF" opacity="0.8" />
          <circle cx="34" cy="32" r="1" fill="#FFF" opacity="0.6" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
          <circle cx="20" cy="26" r="0.5" fill="#FFF" opacity="0.4" />
        </g>
        <g style={{ opacity: isDark ? 0 : 1 }} className="transition-opacity duration-700 delay-100">
          <path d="M55 26 Q58 20 65 22 Q72 18 78 24 Q85 26 80 32 Q72 35 55 26 Z" fill="#FFF" opacity="0.9" />
          <path d="M70 30 Q75 25 82 28 Q88 32 80 36 Z" fill="#FFF" opacity="0.7" />
        </g>
        <g
          style={{ transform: `translateX(${isDark ? 56 : 4}px)` }}
          className="transition-transform duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        >
          <circle
            cx="20"
            cy="22"
            r="26"
            fill={isDark ? 'url(#theme-moon-glow)' : 'url(#theme-sun-glow)'}
            className="transition-all duration-700"
          />
          <g filter="url(#theme-thumb-shadow)">
            <g
              style={{
                opacity: isDark ? 0 : 1,
                transform: `rotate(${isDark ? 90 : 0}deg)`,
                transformOrigin: '20px 22px',
              }}
              className="transition-all duration-[600ms] ease-in-out"
            >
              <circle cx="20" cy="22" r="16" fill="url(#theme-sun-grad)" />
              <circle cx="20" cy="22" r="16" fill="none" stroke="#FFF" strokeWidth="1" opacity="0.5" />
            </g>
            <g
              style={{
                opacity: isDark ? 1 : 0,
                transform: `rotate(${isDark ? 0 : -90}deg)`,
                transformOrigin: '20px 22px',
              }}
              className="transition-all duration-[600ms] ease-in-out"
            >
              <circle cx="20" cy="22" r="16" fill="url(#theme-moon-grad)" />
              <circle cx="14" cy="16" r="3.5" fill="url(#theme-crater-grad)" />
              <circle cx="26" cy="20" r="2.5" fill="url(#theme-crater-grad)" />
              <circle cx="18" cy="28" r="2" fill="url(#theme-crater-grad)" />
              <circle cx="12" cy="24" r="1" fill="url(#theme-crater-grad)" />
              <circle cx="20" cy="22" r="16" fill="none" stroke="#FFF" strokeWidth="1" opacity="0.3" />
            </g>
          </g>
        </g>
      </svg>
    </button>
  );
};

export default ThemeToggle;
