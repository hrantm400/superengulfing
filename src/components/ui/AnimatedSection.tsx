import React, { useEffect, useRef, useState } from 'react';

interface AnimatedSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional delay in ms before animation starts once in view */
  delayMs?: number;
}

/**
 * Generic scroll-reveal wrapper: fades content in and slides it up
 * when it first enters the viewport.
 *
 * Uses IntersectionObserver and the existing Tailwind keyframes
 * (see .animate-fade-in-up in app/tailwind.css).
 */
export const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  className = '',
  delayMs = 0,
  ...rest
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    let timeoutId: number | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (delayMs > 0) {
              timeoutId = window.setTimeout(() => {
                setIsVisible(true);
              }, delayMs);
            } else {
              setIsVisible(true);
            }
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    observer.observe(node);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      observer.disconnect();
    };
  }, [delayMs]);

  const base =
    'opacity-0 translate-y-6 will-change-transform will-change-opacity';
  const animated =
    'opacity-100 translate-y-0 animate-fade-in-up';

  return (
    <div
      ref={ref}
      className={`${isVisible ? animated : base} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

export default AnimatedSection;

