// Every sound in this game is synthesized with the Web Audio API at
// runtime - no external audio files, so there is nothing to license or
// download.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.started = false;
    this._heartbeatPhase = 0;
    this._ambientNodes = [];
  }

  start() {
    if (this.started) return;
    this.started = true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    this.noiseBuffer = this._makeNoiseBuffer(2);
    this._startAmbient();
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  setMasterVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  _makeNoiseBuffer(seconds) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _noiseSource(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    return src;
  }

  _startAmbient() {
    const ctx = this.ctx;

    // Low drone bed
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    droneGain.connect(this.master);

    [55, 58.5, 110].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? "sine" : "sawtooth";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.6 : 0.25;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 220;
      osc.connect(filter).connect(g).connect(droneGain);
      osc.start();
      this._ambientNodes.push(osc);
    });

    // Filtered noise "wind"
    const wind = this._noiseSource(true);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 300;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.04;
    wind.connect(windFilter).connect(windGain).connect(this.master);
    wind.start();
    this._ambientNodes.push(wind);

    // Slow LFO modulating wind filter for unease
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();
    this._ambientNodes.push(lfo);
  }

  footstep(sprinting) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = this._noiseSource(false);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = sprinting ? 500 : 350;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(sprinting ? 0.35 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(now);
    src.stop(now + 0.15);
  }

  uiBlip() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  chaseStinger() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.9);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.5, now + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc.connect(oscGain).connect(this.master);
    osc.start(now);
    osc.stop(now + 1.2);

    const noise = this._noiseSource(false);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    noise.connect(filter).connect(noiseGain).connect(this.master);
    noise.start(now);
    noise.stop(now + 0.5);
  }

  jumpscare() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const noise = this._noiseSource(false);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    noise.connect(gain).connect(this.master);
    noise.start(now);
    noise.stop(now + 0.8);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(90, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.6);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    sub.connect(subGain).connect(this.master);
    sub.start(now);
    sub.stop(now + 1);
  }

  whisper(intensity = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const baseFreq = 220 + Math.random() * 90;
    osc.frequency.setValueAtTime(baseFreq, now);

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5 + Math.random() * 3;
    const vibratoGain = ctx.createGain();
    vibratoGain.gain.value = 8;
    vibrato.connect(vibratoGain).connect(osc.frequency);
    vibrato.start(now);
    vibrato.stop(now + 2.2);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 4;

    const gain = ctx.createGain();
    const vol = 0.05 + intensity * 0.1;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2);

    osc.connect(filter).connect(gain).connect(pan).connect(this.master);
    osc.start(now);
    osc.stop(now + 2.1);
  }

  panelPower() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    [220, 330, 440].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }

  heartbeatTick(danger) {
    if (!this.ctx || danger <= 0) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const thump = (delay, vol) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(60, now + delay);
      osc.frequency.exponentialRampToValueAtTime(35, now + delay + 0.15);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
      osc.connect(gain).connect(this.master);
      osc.start(now + delay);
      osc.stop(now + delay + 0.22);
    };
    thump(0, 0.35 * danger);
    thump(0.14, 0.25 * danger);
  }

  update(dt, danger) {
    if (!this.ctx) return;
    if (danger <= 0.01) {
      this._heartbeatPhase = 0;
      return;
    }
    const interval = 0.85 - danger * 0.5;
    this._heartbeatPhase += dt;
    if (this._heartbeatPhase >= interval) {
      this._heartbeatPhase = 0;
      this.heartbeatTick(danger);
    }
  }
}
