// Renders chords from real piano recordings (Salamander Grand, sampled every minor third) for the
// recognition benchmark. Run ./bench/fetch-samples.sh first.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SR = 48000;
const NAMES: Record<string, number> = { C: 0, Ds: 3, Fs: 6, A: 9 };

const samples = new Map<number, Float32Array>();
for (let octave = 1; octave <= 7; octave++)
  for (const [name, pc] of Object.entries(NAMES)) {
    const buf = readFileSync(join(import.meta.dirname, 'samples', `${name}${octave}.raw`));
    const pcm = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    samples.set(12 * (octave + 1) + pc, Float32Array.from(pcm, (v) => v / 32768));
  }

// Mulberry32: small, seedable, good enough for test variety.
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One note, pitch-shifted from the nearest sample (at most a semitone away) with cubic interpolation.
function note(midi: number, length: number, detuneCents = 0): Float32Array {
  let src = midi;
  for (let d = 0; d <= 2 && !samples.has(src); d++) src = samples.has(midi - d) ? midi - d : midi + d;
  const s = samples.get(src)!;
  const ratio = 2 ** ((midi - src) / 12 + detuneCents / 1200);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const p = i * ratio;
    const k = Math.floor(p);
    if (k + 2 >= s.length) break;
    const f = p - k;
    const [y0, y1, y2, y3] = [s[k - 1] ?? 0, s[k], s[k + 1], s[k + 2]];
    out[i] = y1 + 0.5 * f * (y2 - y0 + f * (2 * y0 - 5 * y1 + 4 * y2 - y3 + f * (3 * (y1 - y2) + y3 - y0)));
  }
  return out;
}

export interface RenderOptions {
  random: () => number;
  /** Max spread between the chord's notes, as when a chord is rolled or not struck quite together. */
  spreadMs?: number;
  /** Notes of the previous chord, released as this one is struck (dampers take a moment). */
  previous?: number[];
  /** Background noise level relative to the chord's peak, in dB. */
  noiseDb?: number;
  /** Whole instrument out of tune by this much. */
  detuneCents?: number;
  /** Small built-in mics roll off the bass: a 2nd-order high-pass at this frequency. */
  highpassHz?: number;
}

export interface Condition {
  name: string;
  options: Omit<RenderOptions, 'random' | 'previous' | 'spreadMs'>;
}

export const CONDITIONS: Condition[] = [
  { name: 'studio', options: {} },
  { name: 'laptop mic', options: { highpassHz: 200, noiseDb: -40 } },
  { name: 'piano 30¢ flat', options: { detuneCents: -30 } },
];

/** Audio from the moment the chord is struck, `ms` long. */
export function renderChord(notes: number[], ms: number, opts: RenderOptions): Float32Array {
  const { random, spreadMs = 15, previous = [], noiseDb = -50, detuneCents = 0, highpassHz } = opts;
  const length = Math.round((ms / 1000) * SR);
  const out = new Float32Array(length);
  for (const n of notes) {
    const delay = Math.round(random() * (spreadMs / 1000) * SR);
    const gain = 0.5 + 0.5 * random(); // uneven touch across the voicing
    const x = note(n, length - delay, detuneCents);
    for (let i = 0; i < x.length; i++) out[i + delay] += gain * x[i];
  }
  // The previous chord, half a second into its ring, dying away as its dampers come down.
  for (const n of previous) {
    const x = note(n, length + SR / 2, detuneCents);
    const gain = 0.5 + 0.5 * random();
    for (let i = 0; i < length; i++) out[i] += gain * x[i + SR / 2] * Math.exp(-i / (0.06 * SR));
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const noise = peak * 10 ** (noiseDb / 20);
  for (let i = 0; i < length; i++) out[i] += noise * (random() * 2 - 1) * Math.sqrt(3);
  if (highpassHz) {
    // RBJ biquad high-pass, Q = 0.707.
    const w = (2 * Math.PI * highpassHz) / SR;
    const alpha = Math.sin(w) / Math.SQRT2;
    const cw = Math.cos(w);
    const a0 = 1 + alpha;
    const [b0, b1, b2] = [(1 + cw) / 2 / a0, -(1 + cw) / a0, (1 + cw) / 2 / a0];
    const [a1, a2] = [(-2 * cw) / a0, (1 - alpha) / a0];
    let [x1, x2, y1, y2] = [0, 0, 0, 0];
    for (let i = 0; i < length; i++) {
      const x = out[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      [x2, x1, y2, y1] = [x1, x, y1, y];
      out[i] = y;
    }
  }
  // Normalise to a typical mic level (peak around -12 dBFS).
  const scale = 0.25 / (peak || 1);
  for (let i = 0; i < length; i++) out[i] *= scale;
  return out;
}
