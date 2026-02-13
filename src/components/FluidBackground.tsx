import React, { useEffect, useRef } from 'react';

/**
 * WebGL fluid simulation background (https://github.com/tkabalin/WebGL-Fluid-Background).
 * Renders a full-viewport canvas and loads the fluid script after the canvas is in the DOM.
 */
const FluidBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.getElementById('fluid-background-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const script = document.createElement('script');
    script.src = '/fluid/webgl-fluid.js';
    script.async = true;
    script.onerror = () => console.warn('[FluidBackground] Failed to load webgl-fluid.js');

    const timeoutId = window.setTimeout(() => {
      if (!document.getElementById('fluid-background-canvas')) return;
      document.body.appendChild(script);
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
      script.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 overflow-hidden bg-[#080c12]"
      aria-hidden
      style={{ width: '100vw', height: '100vh' }}
    >
      <canvas
        id="fluid-background-canvas"
        className="block w-full h-full"
        style={{
          width: '100vw',
          height: '100vh',
          display: 'block',
        }}
      />
    </div>
  );
};

export default FluidBackground;
