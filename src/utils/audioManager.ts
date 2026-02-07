import { Howl, Howler } from 'howler';

// Web Audio API Fallback Synthesizer
// Used if the physical MP3 files are not present in public/sounds/
class SynthFallback {
    ctx: AudioContext | null = null;
    masterGain: GainNode | null = null;

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx!.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx!.destination);
    }

    playType(rate = 1.0) {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        // High pitch "crystal" click
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 * rate, t);
        osc.frequency.exponentialRampToValueAtTime(1200 * rate, t + 0.1);
        gain.gain.setValueAtTime(0.05, t); // Lower volume
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + 0.1);
    }

    playBoom() {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + 0.6);
    }

    playWhoosh() {
        this.init();
        if (!this.ctx || !this.masterGain) return;
        const t = this.ctx.currentTime;
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.linearRampToValueAtTime(2000, t + 0.5);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.5);
        gain.gain.linearRampToValueAtTime(0, t + 1);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start();
    }
}

const synth = new SynthFallback();

// 1. Preload sounds (if they exist)
const sfx = {
    whoosh: new Howl({ src: ['/sounds/whoosh.mp3'], volume: 0.7, preload: true, onloaderror: () => {} }),
    boom: new Howl({ src: ['/sounds/boom.mp3'], volume: 1.0, preload: true, onloaderror: () => {} }),
    magic: new Howl({ src: ['/sounds/magic.mp3'], volume: 0.5, preload: true }),
    type: new Howl({ src: ['/sounds/type.mp3'], volume: 0.4, preload: true, onloaderror: () => {} }),
};

// Helper: Check if Howl loaded successfully, else use Synth
const isLoaded = (sound: Howl) => sound.state() === 'loaded';

// 2. Typing Sound (Random Pitch)
export const playTypingSound = () => {
    if (isLoaded(sfx.type)) {
        const soundId = sfx.type.play();
        sfx.type.rate(0.9 + Math.random() * 0.2, soundId);
    } else {
        synth.playType(0.9 + Math.random() * 0.2);
    }
};

// 3. Stamp Impact (Boom + Magic)
export const playStampImpact = () => {
    if (isLoaded(sfx.boom)) {
        sfx.boom.play();
    } else {
        synth.playBoom();
    }

    if (isLoaded(sfx.magic)) {
        setTimeout(() => sfx.magic.play(), 50);
    } else {
        // Synth magic? (Just a high frequency twinkle)
        setTimeout(() => synth.playType(2.0), 50);
        setTimeout(() => synth.playType(2.5), 100);
        setTimeout(() => synth.playType(3.0), 150);
    }
};

export const playWhoosh = () => {
    if (isLoaded(sfx.whoosh)) {
        sfx.whoosh.play();
    } else {
        synth.playWhoosh();
    }
}

// User Interaction Unlock (AudioContext usually needs a gesture)
export const initAudio = () => {
    synth.init();
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume();
    }
}
