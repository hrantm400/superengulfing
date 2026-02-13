import React, { useEffect, useRef } from 'react';

/**
 * WebGL fluid simulation background (https://github.com/tkabalin/WebGL-Fluid-Background).
 * Renders a full-viewport canvas and loads the fluid script once the canvas is in the DOM.
 */
const FluidBackground: React.FC = () => {
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    const canvas = document.getElementById('fluid-background-canvas');
    if (!canvas) return;

    scriptLoaded.current = true;
    const script = document.createElement('script');
    script.src = '/fluid/webgl-fluid.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      scriptLoaded.current = false;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <canvas
        id="fluid-background-canvas"
        className="block w-full h-full"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};

export default FluidBackground;
