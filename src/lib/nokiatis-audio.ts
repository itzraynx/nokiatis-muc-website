/**
 * Nokiatis MUC audio engine — real sound in the browser (v1.17.3-beta.1).
 *
 * Every catalog track carries a deterministic `synthSeed`; the engine turns
 * that seed into a genre-correct arrangement (bpm / scale / drum pattern /
 * lead wave) and streams it through a Spotify-style master chain:
 *
 *   voices -> songGain(fade) -> stereo widener -> low shelf (bass EQ)
 *          -> high shelf (treble EQ) -> warmth shaper (high quality)
 *          -> dynamics compressor (loudness normalization) -> master volume
 *          -> analyser (visualizer) -> destination
 *
 * Pause/resume suspends the AudioContext itself, so the clock, the fades and
 * every scheduled voice freeze together — seek rebuilds the song at the new
 * offset. The engine is a singleton: `audioEngine`.
 */

import type { RichTrack, AppSettings } from "./nokiatis-types";

// ---------------------------------------------------------------------------
// Genre-specific arrangement profiles
// ---------------------------------------------------------------------------

interface AudioProfile {
  bpm: number;
  /** semitone offsets from the root */
  scale: number[];
  root: number; // Hz of the scale root (bass register)
  leadWave: OscillatorType;
  leadDensity: number; // 0..1 share of 16th steps that carry a lead note
  kick: "floor" | "halved" | "sparse" | "none";
  hat: "off" | "eighth" | "sixteenth";
  clap: boolean;
  pluck: boolean; // oud/guitar-like plucked fills
  padGain: number;
  swing: number; // 0..0.3
}

const HIJAZ = [0, 1, 4, 5, 7, 8, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR_PENT = [0, 3, 5, 7, 10];
const MAJOR_PENT = [0, 2, 4, 7, 9];

const PROFILES: Record<string, AudioProfile> = {
  "شعبي": { bpm: 116, scale: MAJOR, root: 146.83, leadWave: "sawtooth", leadDensity: 0.72, kick: "halved", hat: "off", clap: true, pluck: true, padGain: 0.05, swing: 0.08 },
  "راي": { bpm: 102, scale: HIJAZ, root: 110, leadWave: "square", leadDensity: 0.68, kick: "halved", hat: "eighth", clap: false, pluck: true, padGain: 0.04, swing: 0.05 },
  "بوب": { bpm: 120, scale: MAJOR_PENT, root: 130.81, leadWave: "triangle", leadDensity: 0.62, kick: "floor", hat: "off", clap: true, pluck: false, padGain: 0.06, swing: 0 },
  "صحراوي": { bpm: 76, scale: MINOR_PENT, root: 82.41, leadWave: "sine", leadDensity: 0.5, kick: "sparse", hat: "eighth", clap: false, pluck: true, padGain: 0.07, swing: 0.12 },
  "أندلسي": { bpm: 84, scale: HIJAZ, root: 146.83, leadWave: "triangle", leadDensity: 0.55, kick: "none", hat: "eighth", clap: false, pluck: true, padGain: 0.06, swing: 0.1 },
  "إلكتروني": { bpm: 126, scale: MINOR, root: 87.31, leadWave: "sawtooth", leadDensity: 0.8, kick: "floor", hat: "sixteenth", clap: false, pluck: false, padGain: 0.08, swing: 0 },
  "راب": { bpm: 92, scale: MINOR_PENT, root: 98, leadWave: "sawtooth", leadDensity: 0.42, kick: "halved", hat: "eighth", clap: true, pluck: false, padGain: 0.03, swing: 0.14 },
  "فلكلور": { bpm: 72, scale: MINOR, root: 110, leadWave: "triangle", leadDensity: 0.48, kick: "sparse", hat: "eighth", clap: false, pluck: true, padGain: 0.06, swing: 0.16 },
};

const FALLBACK: AudioProfile = PROFILES["بوب"];

function profileFor(genre: string): AudioProfile {
  return PROFILES[genre] ?? FALLBACK;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Song material generated once per track
// ---------------------------------------------------------------------------

interface SongMaterial {
  profile: AudioProfile;
  stepDur: number; // seconds per 16th step
  progression: number[]; // scale degrees, one chord per bar
  melody: (number | null)[]; // scale-degree index or rest, 32 steps of 16ths
  leadPan: number;
  hatPan: number;
  pluckPattern: number[]; // steps carrying a pluck fill
}

function buildMaterial(track: RichTrack): SongMaterial {
  const profile = profileFor(track.genre);
  const rand = mulberry32(track.synthSeed);
  const scaleLen = profile.scale.length;

  // Chord progression: 4 bars, random walk over degrees
  const progression: number[] = [];
  let deg = Math.floor(rand() * scaleLen);
  for (let i = 0; i < 4; i++) {
    progression.push(deg % scaleLen);
    deg += Math.floor(rand() * 5) - 2; // -2..2
    deg = Math.max(0, Math.min(scaleLen - 1, deg));
  }

  // Melody: smooth random walk with rests — 32 steps = 2 bars
  const melody: (number | null)[] = [];
  let idx = Math.floor(rand() * scaleLen);
  for (let i = 0; i < 32; i++) {
    if (rand() < 0.22) {
      melody.push(null); // rest
      continue;
    }
    idx += Math.floor(rand() * 5) - 2;
    if (idx < 0) idx += scaleLen;
    if (idx >= scaleLen * 2) idx -= scaleLen;
    melody.push(idx);
  }

  const pluckPattern: number[] = [];
  for (let s = 0; s < 16; s++) {
    if (profile.pluck && rand() < 0.22 && s % 4 !== 0) pluckPattern.push(s);
  }

  return {
    profile,
    stepDur: 60 / profile.bpm / 4,
    progression,
    melody,
    leadPan: (rand() * 2 - 1) * 0.3,
    hatPan: 0.35 + rand() * 0.15,
    pluckPattern,
  };
}

function scaleFreq(mat: SongMaterial, degree: number, octave: number): number {
  const p = mat.profile;
  const len = p.scale.length;
  const d = ((degree % len) + len) % len;
  const oct = Math.floor(degree / len) + octave;
  return p.root * Math.pow(2, p.scale[d] / 12) * Math.pow(2, oct);
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

interface LiveSource {
  node: AudioScheduledSourceNode;
}

export class NokiatisAudioEngine {
  private ctx: AudioContext | null = null;

  // master chain
  private songGain: GainNode | null = null;
  private lGain: GainNode | null = null;
  private rDirect: GainNode | null = null;
  private rDelay: DelayNode | null = null;
  private rDelayGain: GainNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private lowShelf: BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private shaperWet: GainNode | null = null;
  private shaperDry: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  // song state
  private material: SongMaterial | null = null;
  private track: RichTrack | null = null;
  private sources: LiveSource[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private songStartCtx = 0; // ctx time when position 0 of the song was
  private nextStepIdx = 0;
  private nextStepTime = 0;
  private token = 0;
  private endedFired = false;
  private volume = 0.85;
  private playing = false;

  onEnded: (() => void) | null = null;

  // -------------------------------------------------------------------------

  private ensureCtx(): AudioContext {
    if (this.ctx) return this.ctx;
    const AC: typeof AudioContext =
      typeof window !== "undefined"
        ? window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : AudioContext;
    const ctx = new AC();

    // Stereo image: mono bus duplicated; the right channel can run through a
    // 11 ms delay for a wide, "3D" image (toggled by settings.surround).
    const songGain = ctx.createGain();
    const merger = ctx.createChannelMerger(2);
    const lGain = ctx.createGain();
    const rDirect = ctx.createGain();
    const rDelay = ctx.createDelay(0.05);
    const rDelayGain = ctx.createGain();
    rDelay.delayTime.value = 0.011;
    rDelayGain.gain.value = 0;
    songGain.connect(lGain);
    lGain.connect(merger, 0, 0);
    songGain.connect(rDirect);
    songGain.connect(rDelay);
    rDelay.connect(rDelayGain);
    rDelayGain.connect(merger, 0, 1);
    rDirect.connect(merger, 0, 1);

    // EQ
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 90;
    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = 10000;
    merger.connect(lowShelf);
    lowShelf.connect(highShelf);

    // Warmth shaper (parallel wet path, used by "high" quality)
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(1.5 * x) * 0.85; // gentle soft-clip "tube" curve
    }
    shaper.curve = curve;
    const shaperWet = ctx.createGain();
    shaperWet.gain.value = 0;
    const shaperDry = ctx.createGain();
    shaperDry.gain.value = 1;
    highShelf.connect(shaperDry);
    highShelf.connect(shaper);
    shaper.connect(shaperWet);

    // Compressor used as loudness normalization
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.008;
    comp.release.value = 0.25;
    shaperDry.connect(comp);
    shaperWet.connect(comp);

    const masterGain = ctx.createGain();
    masterGain.gain.value = this.volume;
    comp.connect(masterGain);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    // Shared white-noise buffer for hats / claps
    const noise = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.songGain = songGain;
    this.merger = merger;
    this.lGain = lGain;
    this.rDirect = rDirect;
    this.rDelay = rDelay;
    this.rDelayGain = rDelayGain;
    this.lowShelf = lowShelf;
    this.highShelf = highShelf;
    this.shaper = shaper;
    this.shaperWet = shaperWet;
    this.shaperDry = shaperDry;
    this.comp = comp;
    this.masterGain = masterGain;
    this.analyser = analyser;
    this.noiseBuffer = noise;
    return ctx;
  }

  // -- settings ---------------------------------------------------------------

  applySettings(s: AppSettings): void {
    if (!this.ctx || !this.lowShelf || !this.highShelf || !this.comp) return;
    const t = this.ctx.currentTime;
    this.lowShelf.gain.setTargetAtTime(s.bass, t, 0.05);
    this.highShelf.gain.setTargetAtTime(s.treble, t, 0.05);
    if (this.rDirect && this.rDelayGain) {
      const wide = s.surround ? 1 : 0;
      this.rDirect.gain.setTargetAtTime(1 - wide * 0.35, t, 0.05);
      this.rDelayGain.gain.setTargetAtTime(wide, t, 0.05);
    }
    if (this.shaperWet && this.shaperDry) {
      this.shaperWet.gain.setTargetAtTime(s.audioQuality === "high" ? 0.3 : 0, t, 0.05);
      this.shaperDry.gain.setTargetAtTime(s.audioQuality === "high" ? 0.75 : 1, t, 0.05);
    }
    if (s.normalization) {
      this.comp.threshold.setTargetAtTime(-20, t, 0.05);
      this.comp.ratio.setTargetAtTime(4, t, 0.05);
    } else {
      this.comp.threshold.setTargetAtTime(0, t, 0.05);
      this.comp.ratio.setTargetAtTime(1, t, 0.05);
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  // -- transport ----------------------------------------------------------------

  position(): number {
    if (!this.ctx || !this.track) return 0;
    if (!this.playing) {
      // suspended ctx keeps its frozen currentTime — still the right math
      return Math.max(0, Math.min(this.track.durationSec, this.ctx.currentTime - this.songStartCtx));
    }
    return Math.max(0, Math.min(this.track.durationSec, this.ctx.currentTime - this.songStartCtx));
  }

  duration(): number {
    return this.track?.durationSec ?? 0;
  }

  async playTrack(track: RichTrack, seekSec = 0): Promise<void> {
    const ctx = this.ensureCtx();
    this.stopInternal();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* autoplay guard — user will retry */
      }
    }
    const myToken = ++this.token;
    this.track = track;
    this.material = buildMaterial(track);
    this.endedFired = false;
    this.songStartCtx = ctx.currentTime - seekSec;
    this.nextStepIdx = Math.ceil(Math.max(0, seekSec) / this.material.stepDur);
    this.nextStepTime = ctx.currentTime + 0.08;

    // Natural fade-out at the tail of the song (gentle, always on)
    if (this.songGain) {
      const g = this.songGain.gain;
      const fade = Math.min(3, track.durationSec - seekSec);
      if (fade > 1) {
        g.setValueAtTime(1, ctx.currentTime);
        g.setValueAtTime(1, ctx.currentTime + Math.max(0, track.durationSec - seekSec - fade));
        g.linearRampToValueAtTime(0, ctx.currentTime + Math.max(0.1, track.durationSec - seekSec));
      } else {
        g.setValueAtTime(0.8, ctx.currentTime);
        g.linearRampToValueAtTime(0, ctx.currentTime + Math.max(0.1, fade));
      }
    }

    this.playing = true;
    this.timer = setInterval(() => this.tick(myToken), 80);
    this.tick(myToken);
  }

  async pause(): Promise<void> {
    if (!this.ctx) return;
    this.playing = false;
    try {
      await this.ctx.suspend();
    } catch {
      /* ignore */
    }
  }

  async resume(): Promise<void> {
    if (!this.ctx) return;
    this.playing = true;
    try {
      await this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  async seek(sec: number): Promise<void> {
    if (!this.track) return;
    const clamped = Math.max(0, Math.min(this.track.durationSec - 0.5, sec));
    const wasPlaying = this.playing;
    await this.playTrack(this.track, clamped);
    if (!wasPlaying) await this.pause();
  }

  stop(): void {
    this.stopInternal();
    this.track = null;
    this.playing = false;
  }

  private stopInternal(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.sources.length > 0) {
      const now = this.ctx.currentTime;
      for (const s of this.sources) {
        try {
          s.node.stop(now);
        } catch {
          /* already stopped */
        }
        try {
          s.node.disconnect();
        } catch {
          /* ignore */
        }
      }
    }
    this.sources = [];
  }

  // -- scheduler ------------------------------------------------------------------

  private tick(myToken: number): void {
    if (!this.ctx || !this.material || this.token !== myToken || !this.track) return;
    const ctx = this.ctx;
    const mat = this.material;

    while (this.nextStepTime < ctx.currentTime + 0.35) {
      const swing =
        this.nextStepIdx % 2 === 1 ? mat.profile.swing * mat.stepDur : 0;
      this.scheduleStep(this.nextStepIdx, this.nextStepTime + swing, mat);
      this.nextStepTime += mat.stepDur;
      this.nextStepIdx += 1;
    }

    // End-of-track detection happens in the ctx time domain
    const endAt = this.songStartCtx + this.track.durationSec;
    if (!this.endedFired && ctx.currentTime >= endAt - 0.02) {
      this.endedFired = true;
      const cb = this.onEnded;
      this.stopInternal();
      this.playing = false;
      if (cb) cb();
    }
  }

  private scheduleStep(step: number, t: number, mat: SongMaterial): void {
    const p = mat.profile;
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const chordDeg = mat.progression[bar % 4];

    // ---- drums
    if (p.kick === "floor" && step % 4 === 0) this.kick(t);
    if (p.kick === "halved" && (inBar === 0 || inBar === 8)) this.kick(t);
    if (p.kick === "sparse" && (inBar === 0 || inBar === 10)) this.kick(t, 0.7);
    if (p.kick === "none" && (inBar === 4 || inBar === 12) && p.pluck) this.tom(t);

    if (p.hat === "sixteenth" && inBar % 1 === 0 && (step % 2 === 1 || inBar % 4 === 2)) {
      this.hat(t, mat.hatPan);
    } else if (p.hat === "eighth" && inBar % 2 === 0 && inBar % 4 !== 0) {
      this.hat(t, mat.hatPan, 0.6);
    } else if (p.hat === "off" && inBar === 6) {
      this.hat(t, mat.hatPan, 0.4);
    }
    if (p.clap && (inBar === 4 || inBar === 12)) this.clap(t);

    // ---- bass (root of the current chord)
    if (inBar === 0 || inBar === 6 || inBar === 10) {
      this.tone(p.root / 2, t, mat.stepDur * 3.2, 0.2, "triangle", 0, 0.01, 0.12, 700);
    }

    // ---- pad every 2 bars
    if (inBar === 0 && bar % 2 === 0 && p.padGain > 0) {
      this.pad(scaleFreq(mat, chordDeg, 1), scaleFreq(mat, chordDeg + 2, 1), scaleFreq(mat, chordDeg + 4, 1), t, p.padGain);
    }

    // ---- pluck fills
    if (mat.pluckPattern.includes(inBar) && bar % 2 === 1) {
      const deg = chordDeg + (mat.melody[(step * 7) % 32] ?? 3);
      this.pluck(scaleFreq(mat, deg, 2), t, 0.14);
    }

    // ---- lead melody
    const note = mat.melody[step % 32];
    if (note !== null && (step % 2 === 0 ? true : Math.random() < 0.4)) {
      // leadDensity gates 16th-note runs; even steps pass more often
      if (step % 4 === 0 || Math.random() < p.leadDensity) {
        const freq = scaleFreq(mat, chordDeg * 0 + note, 2); // melody is absolute, chord-aware via scale
        this.tone(freq, t, mat.stepDur * 1.8, 0.15, p.leadWave, mat.leadPan, 0.012, 0.08, 2200);
      }
    }
  }

  // -- voices ------------------------------------------------------------------

  private register(node: AudioScheduledSourceNode): void {
    this.sources.push({ node });
    if (this.sources.length > 400) {
      // housekeeping: drop entries that ended long ago
      this.sources = this.sources.filter((s) => {
        try {
          return s.node.context.currentTime < 1e9;
        } catch {
          return false;
        }
      }).slice(-200).length > 0 ? this.sources.slice(-200) : this.sources;
    }
  }

  /** Generic subtractive-synth voice. */
  private tone(
    freq: number,
    t: number,
    dur: number,
    gain: number,
    wave: OscillatorType,
    pan = 0,
    attack = 0.01,
    release = 0.08,
    filterFreq?: number,
  ): void {
    if (!this.ctx || !this.songGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq ?? 4000;
    f.Q.value = 0.8;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setTargetAtTime(0, t + Math.max(attack, dur - release), release / 3);
    osc.connect(f);
    f.connect(g);
    g.connect(panner);
    panner.connect(this.songGain);
    osc.start(t);
    osc.stop(t + dur + release + 0.05);
    this.register(osc);
  }

  private kick(t: number, mul = 1): void {
    if (!this.ctx || !this.songGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55 * mul, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(this.songGain);
    osc.start(t);
    osc.stop(t + 0.25);
    this.register(osc);
  }

  private tom(t: number): void {
    if (!this.ctx || !this.songGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.songGain);
    osc.start(t);
    osc.stop(t + 0.32);
    this.register(osc);
  }

  private hat(t: number, pan: number, mul = 1): void {
    if (!this.ctx || !this.songGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09 * mul, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    src.connect(f);
    f.connect(g);
    g.connect(panner);
    panner.connect(this.songGain);
    src.start(t);
    src.stop(t + 0.07);
    this.register(src);
  }

  private clap(t: number): void {
    if (!this.ctx || !this.songGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(f);
    f.connect(g);
    g.connect(this.songGain);
    src.start(t);
    src.stop(t + 0.14);
    this.register(src);
  }

  /** Oud/guitar-like pluck: fast decay + octave harmonic. */
  private pluck(freq: number, t: number, gain: number): void {
    if (!this.ctx || !this.songGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq * 1.003, t); // slight upward bend
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(gain * 0.35, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 3500;
    osc.connect(g);
    osc2.connect(g2);
    g.connect(f);
    g2.connect(f);
    f.connect(this.songGain);
    osc.start(t);
    osc.stop(t + 0.25);
    osc2.start(t);
    osc2.stop(t + 0.15);
    this.register(osc);
    this.register(osc2);
  }

  /** Slow-attack pad chord (2 detuned saws per note). */
  private pad(a: number, b: number, c: number, t: number, gain: number): void {
    if (!this.ctx || !this.songGain) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.8);
    g.gain.setTargetAtTime(0, t + 1.6, 0.5);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1600;
    g.connect(f);
    f.connect(this.songGain);
    for (const freq of [a, b, c]) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        osc.detune.value = detune;
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 2.4);
        this.register(osc);
      }
    }
  }
}

/** Singleton — one audio graph per page. */
export const audioEngine = new NokiatisAudioEngine();
