// Web Audio API Arcade Sound Engine with Audio Limiting for High-Volume TikTok Gift Floods
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterVolume = 0.7;
    this.initialized = false;

    // Audio Throttle / Limiter timestamps
    this.lastPunchTime = 0;
    this.lastGiftSoundTime = 0;
    this.lastComboSoundTime = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  ensureContext() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  // Ring Bell / Gong (Ding Ding Ding)
  playGong() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const playSingleDing = (delay = 0, pitch = 880) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(pitch * 2.756, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.55 * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.6);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc2.start();
        osc.stop(this.ctx.currentTime + 1.7);
        osc2.stop(this.ctx.currentTime + 1.7);
      }, delay);
    };

    playSingleDing(0, 920);
    playSingleDing(180, 920);
    playSingleDing(360, 920);
  }

  // Throttled Punch sounds (prevents distortion on rapid rose spam)
  playPunch(type = 'jab') {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const nowMs = performance.now();
    // Throttle to max 25 punch sounds per second to keep audio crisp
    if (nowMs - this.lastPunchTime < 40) return;
    this.lastPunchTime = nowMs;

    const now = this.ctx.currentTime;

    // Swoosh air sound
    const swooshOsc = this.ctx.createOscillator();
    const swooshGain = this.ctx.createGain();
    swooshOsc.type = 'sine';
    swooshOsc.frequency.setValueAtTime(type === 'uppercut' ? 500 : 380, now);
    swooshOsc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    swooshGain.gain.setValueAtTime(0.25 * this.masterVolume, now);
    swooshGain.gain.linearRampToValueAtTime(0.01, now + 0.1);
    swooshOsc.connect(swooshGain);
    swooshGain.connect(this.ctx.destination);
    swooshOsc.start(now);
    swooshOsc.stop(now + 0.11);

    // Impact Thump & Crack
    setTimeout(() => {
      if (!this.ctx) return;
      const hitTime = this.ctx.currentTime;

      // Noise crack
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.025));
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(type === 'uppercut' || type === 'super' ? 1800 : (type === 'heavy' ? 1300 : 850), hitTime);

      const noiseGain = this.ctx.createGain();
      const intensity = type === 'super' ? 1.0 : (type === 'uppercut' ? 0.85 : (type === 'heavy' ? 0.7 : 0.45));
      noiseGain.gain.setValueAtTime(intensity * this.masterVolume, hitTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, hitTime + (type === 'uppercut' ? 0.28 : 0.16));

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      whiteNoise.start(hitTime);

      // Deep Sub Bass Thump
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sine';
      const startFreq = type === 'super' ? 180 : (type === 'uppercut' ? 150 : 110);
      bassOsc.frequency.setValueAtTime(startFreq, hitTime);
      bassOsc.frequency.exponentialRampToValueAtTime(30, hitTime + 0.2);

      bassGain.gain.setValueAtTime(intensity * 0.8 * this.masterVolume, hitTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.2);

      bassOsc.connect(bassGain);
      bassGain.connect(this.ctx.destination);
      bassOsc.start(hitTime);
      bassOsc.stop(hitTime + 0.21);
    }, 35);
  }

  // Crowd gasp / cheer
  playCheer() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 1.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35 * this.masterVolume, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 1.3);
  }

  // KO Horn / Fanfare
  playKOFanfare() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.playGong();

    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now);

        gain.gain.setValueAtTime(0.35 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.55);
      }, idx * 90);
    });

    setTimeout(() => this.playCheer(), 450);
  }

  // Throttled Gift Alert Sound (prevents ear-fatigue during gift storms)
  playGiftAlert(isBig = false) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const nowMs = performance.now();
    if (!isBig && nowMs - this.lastGiftSoundTime < 200) return;
    this.lastGiftSoundTime = nowMs;

    const chords = isBig ? [523.25, 659.25, 783.99, 1046.50] : [659.25, 880.00, 1318.51];
    chords.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.42);
      }, i * 60);
    });
  }

  // Throttled Combo Sound
  playComboSound(combo) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastComboSoundTime < 60) return;
    this.lastComboSoundTime = nowMs;

    const baseFreq = 440;
    const freq = baseFreq * Math.pow(1.05, Math.min(20, combo));
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.12);

    gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }
}

export const audio = new AudioEngine();
