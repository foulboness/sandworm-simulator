import type { AnimationState } from '../types/sandwraith';

/**
 * 100% procedural Web Audio soundscape:
 * - Desert wind noise band-pass sweep
 * - Sub-bass biomechanical reactor hum
 * - Hydraulic crusher turbine whine scaled by jaw aperture and RPM
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private turbineOsc: OscillatorNode | null = null;
  private turbineGain: GainNode | null = null;
  private enabled = false;

  public toggle(): boolean {
    if (!this.enabled) {
      this.initIfNeeded();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.enabled = true;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.25);
      }
    } else {
      this.enabled = false;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.18);
      }
    }
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private initIfNeeded(): void {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0;
    masterGain.connect(ctx.destination);
    this.masterGain = masterGain;

    // 1. Desert sandstorm wind (filtered looping pink-ish noise)
    const bufferLen = ctx.sampleRate * 3;
    const noiseBuf = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.08) * 1.4;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    noiseSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.6;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.24;

    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    noiseSource.start();

    this.windFilter = windFilter;
    this.windGain = windGain;

    // 2. Deep sub-bass seismic core hum
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 42;

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 115;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.22;

    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();

    this.droneOsc = droneOsc;
    this.droneGain = droneGain;

    // 3. Mechanical jaw grinder / hydraulic resonance
    const turbineOsc = ctx.createOscillator();
    turbineOsc.type = 'triangle';
    turbineOsc.frequency.value = 88;

    const turbineFilter = ctx.createBiquadFilter();
    turbineFilter.type = 'bandpass';
    turbineFilter.frequency.value = 220;
    turbineFilter.Q.value = 3.0;

    const turbineGain = ctx.createGain();
    turbineGain.gain.value = 0.04;

    turbineOsc.connect(turbineFilter);
    turbineFilter.connect(turbineGain);
    turbineGain.connect(masterGain);
    turbineOsc.start();

    this.turbineOsc = turbineOsc;
    this.turbineGain = turbineGain;
  }

  public update(
    state: AnimationState,
    jawAperture: number,
    stormIntensity: number,
    speedNorm: number,
  ): void {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const isAggressive = state === 'roaring' || state === 'attack';
    const windFreq = 240 + stormIntensity * 420 + (isAggressive ? 140 : 0);
    const windVol = 0.1 + stormIntensity * 0.26;
    const droneFreq = 36 + speedNorm * 16 + jawAperture * 18;
    const droneVol = 0.16 + jawAperture * 0.24 + (state === 'underground' ? 0.12 : 0);
    const turbineFreq = 72 + jawAperture * 125 + speedNorm * 35;
    const turbineVol = 0.02 + jawAperture * 0.18;

    this.windFilter?.frequency.setTargetAtTime(windFreq, now, 0.18);
    this.windGain?.gain.setTargetAtTime(windVol, now, 0.18);
    this.droneOsc?.frequency.setTargetAtTime(droneFreq, now, 0.15);
    this.droneGain?.gain.setTargetAtTime(droneVol, now, 0.15);
    this.turbineOsc?.frequency.setTargetAtTime(turbineFreq, now, 0.12);
    this.turbineGain?.gain.setTargetAtTime(turbineVol, now, 0.12);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
