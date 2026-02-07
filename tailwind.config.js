/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "var(--primary)",
        "primary-dim": "rgba(57, 255, 20, 0.1)",
        "primary-glow": "var(--primary-glow)",
        "bearish": "#ff3b30",
        "accent": "#002b2b",
        "background": "var(--bg)",
        "surface": "var(--surface)",
        "surfaceElevated": "var(--surface-elevated)",
        "foreground": "var(--foreground)",
        "muted": "var(--muted)",
        "border": "var(--border)",
        "background-dark": "#020617",
        "surface-dark": "#0f172a",
        "tech-blue": "#00f0ff",
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "display-armenian": ["Noto Sans Armenian", "Inter", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "card": "1.5rem",
        "btn": "0.75rem",
      },
      boxShadow: {
        card: "0 4px 24px -4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
        "card-hover": "0 12px 40px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(57,255,20,0.15)",
        "glow-primary": "0 0 20px rgba(57,255,20,0.25), 0 0 40px rgba(57,255,20,0.1)",
        "glow-primary-sm": "0 0 12px rgba(57,255,20,0.2)",
        "inner-glow": "inset 0 0 20px rgba(57,255,20,0.03)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
        shimmer: "shimmer 2s ease-in-out infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "slide-in-right": "slideInRight 0.4s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 12px rgba(57,255,20,0.2)" },
          "50%": { boxShadow: "0 0 24px rgba(57,255,20,0.35)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      transitionDuration: {
        200: "200ms",
        300: "300ms",
        500: "500ms",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
