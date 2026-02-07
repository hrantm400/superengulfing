import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

/**
 * 3D tilt background on the landing page: a large gradient plane that tilts
 * following the cursor (same idea as navbar TiltButton and SceneMonolith).
 * Only mount on the Home/landing page.
 */
const LandingCursorSpotlight: React.FC = () => {
  const { theme } = useTheme();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 200, damping: 25 });
  const mouseY = useSpring(y, { stiffness: 200, damping: 25 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-8, 8]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouseXFromCenter = (e.clientX - w / 2) / w;
      const mouseYFromCenter = (e.clientY - h / 2) / h;
      x.set(mouseXFromCenter);
      y.set(mouseYFromCenter);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [x, y]);

  const spotColor = theme === 'dark' ? 'rgba(57, 255, 20, 0.08)' : 'rgba(22, 163, 74, 0.08)';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      style={{ perspective: 1200 }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-[140vw] h-[140vw] max-w-[900px] max-h-[900px] rounded-full"
          style={{
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
            background: `radial-gradient(ellipse 70% 70% at 50% 50%, ${spotColor}, transparent 55%)`,
            boxShadow: theme === 'dark'
              ? '0 0 120px 60px rgba(57, 255, 20, 0.03)'
              : '0 0 120px 60px rgba(22, 163, 74, 0.04)'
          }}
        />
      </div>
    </div>
  );
};

export default LandingCursorSpotlight;
