// Web Audio API Synthesizer for "Hollywood" Effects
// No external assets required. Pure code.

class SoundManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;

    constructor() {
        // Lazy load context to comply with autoplay policies
        window.addEventListener('click', () => this.init(), { once: true });
        window.addEventListener('keydown', () => this.init(), { once: true });
    }

    private init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx!.createGain();
        this.masterGain.gain.value = 0.5; // Master volume
        this.masterGain.connect(this.ctx!.destination);
    }

    // Scene 1: Light Leak / Ambient Hum
    playAmbience() {
        if (!this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, this.ctx.currentTime); // Low rumble
        osc.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + 10);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 2); // Slow fade in

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();

        return { osc, gain }; // Return to stop later
    }

    // Scene 3: Magical Typewriter (High pitch sparkly click)
    playType() {
        if (!this.ctx || !this.masterGain) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Magical tone
        osc.frequency.setValueAtTime(800 + Math.random() * 200, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        osc.type = 'sine';

        // Short envelope
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + 0.1);
    }

    // Scene 4: The Impact (Deep Thud + Explosion)
    playImpact() {
        this.init(); // Ensure init
        if (!this.ctx || !this.masterGain) return;

        const t = this.ctx.currentTime;

        // 1. The Sub Bass (Thud)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.frequency.setValueAtTime(100, t);
        sub.frequency.exponentialRampToValueAtTime(20, t + 0.5);
        subGain.gain.setValueAtTime(1, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start();
        sub.stop(t + 0.8);

        // 2. The Noise (Explosion/Crumble)
        const bufferSize = this.ctx.sampleRate * 1.5; // 1.5s noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1000, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 1);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start();
    }

    // Scene 2: Swoosh (Monolith Reveal)
    playSwoosh() {
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * 1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(2000, t + 0.5); // Rise

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.5);
        gain.gain.linearRampToValueAtTime(0, t + 1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    }
}

export const soundManager = new SoundManager();
