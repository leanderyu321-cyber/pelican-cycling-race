export class RaceAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.started = false;
    this.lastNote = 0;
    this.noteIndex = 0;
    this.pattern = [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 880, 659.25];
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this._startAmbience();
    this.started = true;
    return this.ctx;
  }

  _noiseBuffer(seconds = 3) {
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * seconds, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.018 * white) / 1.018;
      data[i] = last * 2.4;
    }
    return buffer;
  }

  _startAmbience() {
    const ctx = this.ctx;

    // Ocean wash.
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(4);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 780;
    noiseFilter.Q.value = 0.35;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.075;
    noise.connect(noiseFilter).connect(noiseGain).connect(this.master);

    const swell = ctx.createOscillator();
    swell.frequency.value = 0.09;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.025;
    swell.connect(swellDepth).connect(noiseGain.gain);
    swell.start();
    noise.start();

    // Soft evening pad.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.2;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.018;
    padFilter.connect(padGain).connect(this.master);

    const notes = [130.81, 196.0, 329.63, 392.0];
    const oscillators = [];
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = frequency;
      osc.detune.value = (index - 1.5) * 4;
      const gain = ctx.createGain();
      gain.gain.value = index === 2 ? 0.26 : 0.42;
      osc.connect(gain).connect(padFilter);
      osc.start();
      oscillators.push(osc);
    });

    const breath = ctx.createOscillator();
    breath.frequency.value = 0.055;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.012;
    breath.connect(breathDepth).connect(padGain.gain);
    breath.start();
    this.oscillators = oscillators;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, this.ctx.currentTime + 0.18);
    }
  }

  _tone(freq, duration = 0.2, { type = 'sine', gain = 0.08, when = 0, slide = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  countdown(isGo = false) {
    if (!this.ctx) return;
    if (isGo) {
      this._tone(1046.5, 0.5, { type: 'triangle', gain: 0.11 });
      this._tone(1318.5, 0.6, { type: 'sine', gain: 0.06, when: 0.02 });
      this._tone(1568, 0.8, { type: 'sine', gain: 0.035, when: 0.04 });
    } else {
      this._tone(587.33, 0.13, { type: 'sine', gain: 0.07 });
    }
  }

  ui() {
    this.ensure();
    this._tone(659.25, 0.09, { type: 'sine', gain: 0.035 });
  }

  fish() {
    if (!this.ctx) return;
    const base = 880;
    [0, 0.07, 0.14].forEach((when, index) => {
      this._tone(base * Math.pow(1.22, index), 0.22, {
        type: 'triangle',
        gain: 0.08,
        when,
      });
    });
  }

  boost() {
    if (!this.ctx) return;
    this._tone(220, 0.45, { type: 'sawtooth', gain: 0.035, slide: 660 });
    this._tone(880, 0.3, { type: 'sine', gain: 0.045, when: 0.05 });
  }

  finish(success = true) {
    if (!this.ctx) return;
    const notes = success ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [392, 349.23, 293.66];
    notes.forEach((freq, index) => {
      this._tone(freq, 0.6, {
        type: 'triangle',
        gain: index === notes.length - 1 ? 0.08 : 0.055,
        when: index * 0.12,
      });
    });

    // Crowd swell.
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(t);
    noise.stop(t + 2.3);
  }

  tick() {
    if (!this.ctx || this.muted) return;
    this._tone(120, 0.035, { type: 'square', gain: 0.012 });
  }

  update(time, state) {
    if (!this.ctx || this.muted) return;
    if (state !== 'racing') return;
    if (time - this.lastNote > 0.62) {
      this.lastNote = time;
      if (Math.random() > 0.35) {
        const freq = this.pattern[this.noteIndex % this.pattern.length];
        this._tone(freq, 0.45, { type: 'sine', gain: 0.018 });
        this._tone(freq * 2, 0.3, { type: 'triangle', gain: 0.005, when: 0.01 });
        this.noteIndex += 1;
      }
    }
  }
}
