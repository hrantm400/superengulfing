import React, { useEffect, useRef } from 'react';

export const ParticleBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let particles: Particle[] = [];
        let smokeParticles: SmokeParticle[] = [];
        let animationFrameId: number;
        let width = window.innerWidth;
        let height = window.innerHeight;

        let mouseX = 0;
        let mouseY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = (e.clientX - width / 2) * 0.5;
            mouseY = (e.clientY - height / 2) * 0.5;
        };
        window.addEventListener('mousemove', handleMouseMove);

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            initParticles();
        };

        class Particle {
            x: number;
            y: number;
            size: number;
            speedX: number;
            speedY: number;
            opacity: number;
            fadeSpeed: number;
            color: string;

            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2.5;
                this.speedX = (Math.random() - 0.5) * 0.15;
                this.speedY = (Math.random() - 0.5) * 0.15;
                this.opacity = Math.random() * 0.6;
                this.fadeSpeed = Math.random() * 0.003;
                const colors = ['#d4af37', '#e2e8f0', '#94a3b8']; // Gold + Silver + Slate
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.x += mouseX * 0.002; // Subtle parallax
                this.y += mouseY * 0.002;

                if (this.x < 0) this.x = width;
                if (this.x > width) this.x = 0;
                if (this.y < 0) this.y = height;
                if (this.y > height) this.y = 0;

                this.opacity += this.fadeSpeed;
                if (this.opacity > 0.8 || this.opacity < 0.1) this.fadeSpeed = -this.fadeSpeed;
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.globalAlpha = this.opacity;
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        class SmokeParticle {
            x: number;
            y: number;
            size: number;
            speedX: number;
            opacity: number;

            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 300 + 100; // Giant blobs
                this.speedX = (Math.random() - 0.5) * 0.2; // Very slow drift
                this.opacity = Math.random() * 0.03 + 0.01; // Extremely subtle
            }

            update() {
                this.x += this.speedX;
                if (this.x < -this.size) this.x = width + this.size;
                if (this.x > width + this.size) this.x = -this.size;
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                // Create a radial gradient for soft smoke
                const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
                gradient.addColorStop(0, `rgba(200, 210, 230, ${this.opacity})`);
                gradient.addColorStop(1, 'rgba(200, 210, 230, 0)');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }

        const initParticles = () => {
            particles = [];
            smokeParticles = [];

            const pCount = Math.min((width * height) / 10000, 100);
            for (let i = 0; i < pCount; i++) {
                particles.push(new Particle());
            }

            const sCount = 15; // Number of smoke blobs
            for (let i = 0; i < sCount; i++) {
                smokeParticles.push(new SmokeParticle());
            }
        };

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);

            // Draw Smoke Background Layer
            smokeParticles.forEach(s => {
                s.update();
                s.draw();
            });

            // Vignette effect
            const gradient = ctx.createRadialGradient(width / 2, height / 2, width / 4, width / 2, height / 2, width);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, 'rgba(2, 6, 23, 0.8)'); // Darker edge
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Draw Crisp Particles on top
            particles.forEach(p => {
                p.update();
                p.draw();
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        resize();
        animate();

        window.addEventListener('resize', resize);
        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-0 pointer-events-none"
            style={{ background: '#020617' }} // Deep dark blue/black
        />
    );
};
