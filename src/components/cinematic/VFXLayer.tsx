import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface VFXHandles {
    emitSpark: (x: number, y: number) => void;
    emitExplosion: (x: number, y: number) => void;
    emitImplosion: (rect: DOMRect) => void;
}

export const VFXLayer = forwardRef<VFXHandles>((_, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particles = useRef<any[]>([]);

    useImperativeHandle(ref, () => ({
        // Scene 3: Tiny sparks on typing
        emitSpark: (x, y) => {
            for (let i = 0; i < 5; i++) {
                particles.current.push(new Spark(x, y));
            }
        },
        // Scene 4: Golden Embers on Impact
        emitExplosion: (x, y) => {
            for (let i = 0; i < 60; i++) {
                particles.current.push(new Ember(x, y));
            }
            for (let i = 0; i < 10; i++) {
                particles.current.push(new Shockwave(x, y));
            }
        },
        // Scene 1: Dissolve Input
        emitImplosion: (rect) => {
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            for (let i = 0; i < 100; i++) {
                // Spawn inside the rect
                const lx = rect.left + Math.random() * rect.width;
                const ly = rect.top + Math.random() * rect.height;
                particles.current.push(new DissolveParticle(lx, ly, cx, cy));
            }
        }
    }));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };
        window.addEventListener('resize', resize);
        resize();

        let frameId: number;
        const loop = () => {
            ctx.clearRect(0, 0, width, height);

            // Update & Draw
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.update();
                p.draw(ctx);
                if (p.dead) particles.current.splice(i, 1);
            }

            frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[9999]" />;
});

// TYPES

class Spark {
    x: number; y: number; vx: number; vy: number; life: number; color: string; dead = false;
    constructor(x: number, y: number) {
        this.x = x; this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.color = `255, 255, 255`;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vy += 0.1; // Gravity
        this.life -= 0.05;
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = `rgb(${this.color})`;
        ctx.fillRect(this.x, this.y, 2, 2);
    }
}

class Ember {
    x: number; y: number; vx: number; vy: number; life: number; dead = false;
    constructor(x: number, y: number) {
        this.x = x; this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 10 + 5; // Fast explosion
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.95; this.vy *= 0.95; // Friction
        this.vy += 0.2; // Gravity
        this.life -= 0.02;
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Shockwave {
    x: number; y: number; radius: number; opacity: number; dead = false;
    constructor(x: number, y: number) {
        this.x = x; this.y = y;
        this.radius = 10;
        this.opacity = 0.8;
    }
    update() {
        this.radius += 15; // Expand fast
        this.opacity -= 0.05;
        if (this.opacity <= 0) this.dead = true;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

class DissolveParticle {
    x: number; y: number; tx: number; ty: number; dead = false;
    constructor(x: number, y: number, tx: number, ty: number) {
        this.x = x; this.y = y;
        this.tx = tx; this.ty = ty; // Target center
    }
    update() {
        // Move towards target
        this.x += (this.tx - this.x) * 0.1;
        this.y += (this.ty - this.y) * 0.1;
        // Die when close
        if (Math.abs(this.x - this.tx) < 5) this.dead = true;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(this.x, this.y, 2, 2);
    }
}
