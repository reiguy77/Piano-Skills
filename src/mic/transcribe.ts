// Names the notes of a chord from audio of it ringing. The spectrum is reduced to its peaks, and
// notes are found one at a time: each candidate is scored by the energy on its (slightly sharp,
// as piano partials are) harmonic series, the best is taken, and only the share of each partial
// that fits a smooth harmonic envelope is removed before searching again. Leaving the rest is what
// lets stacked notes through: an octave, a 12th or a 17th above another note sits on that note's
// partials, and shows up as the excess over its envelope.
import { magnitudeSpectrum } from './fft';

export interface TranscribeOptions {
  lowest: number;
  highest: number;
  startMs: number; // skip the hammer's thump at the start
  windowSize: number; // samples analysed
  zeroPad: number; // spectrum interpolation factor
  maxNotes: number;
  maxHz: number; // partials above this are ignored
  weightExp: number; // harmonic h weighs 1 / h^weightExp
  ampExp: number; // compress partial amplitudes so soft notes count
  relThreshold: number; // a note must score this fraction of the strongest note
  floorDb: number; // peaks this far below the loudest are ignored
  prominenceDb: number; // peaks must rise this far above the local noise floor
  fundamentalRatio: number; // fundamental must be at least this fraction of the note's strongest partial
  smoothSpan: number; // harmonics either side averaged for the envelope
  minPartials: number; // partials (above presentRatio of the strongest) a note below C5 needs
  presentRatio: number;
  ownRatio: number; // below this share of its original height, a fundamental counts as another note's
  excludeSelf: boolean; // leave a partial out of its own envelope estimate
  envelopeGain: number; // a note's own partial may stand this far above its envelope
  bassBelow: number; // notes below this need bassPartials partials (room rumble can pose as a fundamental)
  bassPartials: number;
  trace?: (line: string) => void;
}

export const DEFAULTS: TranscribeOptions = {
  lowest: 40, // E2
  highest: 84, // C6
  startMs: 30,
  windowSize: 16384,
  zeroPad: 2,
  maxNotes: 8,
  maxHz: 5000,
  weightExp: 0.6,
  ampExp: 0.7,
  relThreshold: 0.18,
  floorDb: -60,
  prominenceDb: 8,
  fundamentalRatio: 0.08,
  smoothSpan: 1,
  minPartials: 2,
  presentRatio: 0.05,
  ownRatio: 0.6,
  excludeSelf: false,
  envelopeGain: 1,
  bassBelow: 55, // G3
  bassPartials: 3,
};

/** How long after the onset transcribeChord wants audio for. */
export const analysisMs = (sampleRate: number, o = DEFAULTS) => o.startMs + (o.windowSize / sampleRate) * 1000;

interface Peak {
  hz: number;
  amp: number; // what's left of it unexplained
  orig: number;
}

const etHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

// A peak must top the window's main lobe (so sidelobe ripples don't count) and stand clear of the
// local noise floor (the average log level within a sixth of an octave).
function findPeaks(mag: Float32Array, binHz: number, o: TranscribeOptions): Peak[] {
  let max = 0;
  for (const m of mag) max = Math.max(max, m);
  const floor = max * 10 ** (o.floorDb / 20);
  const lobe = 2 * o.zeroPad;
  const last = Math.min(mag.length - lobe - 1, Math.floor(o.maxHz / binHz));
  const logSum = new Float64Array(mag.length + 1);
  for (let i = 0; i < mag.length; i++) logSum[i + 1] = logSum[i] + Math.log(mag[i] + 1e-12);
  const prominence = Math.log(10 ** (o.prominenceDb / 20));
  const peaks: Peak[] = [];
  for (let i = lobe; i < last; i++) {
    const b = mag[i];
    if (b < floor) continue;
    let top = true;
    for (let k = i - lobe; k <= i + lobe && top; k++) if (k !== i && (mag[k] > b || (mag[k] === b && k < i))) top = false;
    if (!top) continue;
    const half = Math.max(lobe * 4, Math.round(i * (2 ** (1 / 12) - 1) * 2));
    const [lo, hi] = [Math.max(0, i - half), Math.min(mag.length, i + half + 1)];
    if (Math.log(b) < (logSum[hi] - logSum[lo]) / (hi - lo) + prominence) continue;
    // Parabolic interpolation on log magnitude places the peak between bins.
    const [a, c, l] = [Math.log(mag[i - 1] + 1e-12), Math.log(mag[i + 1] + 1e-12), Math.log(b)];
    const d = a - 2 * l + c;
    const offset = d < 0 ? (0.5 * (a - c)) / d : 0;
    peaks.push({ hz: (i + offset) * binHz, amp: b, orig: b });
  }
  return peaks;
}

// How far the instrument is from A440, in cents, judged by the strongest low peaks.
function tuningCents(peaks: Peak[]): number {
  const strong = peaks
    .filter((p) => p.hz > 70 && p.hz < 1200)
    .sort((a, b) => b.amp - a.amp)
    .slice(0, 12);
  let [x, y] = [0, 0];
  for (const p of strong) {
    const dev = (1200 * Math.log2(p.hz / 440)) % 100; // position within a semitone
    const ang = (2 * Math.PI * dev) / 100;
    x += p.amp * Math.cos(ang);
    y += p.amp * Math.sin(ang);
  }
  return strong.length ? (Math.atan2(y, x) / (2 * Math.PI)) * 100 : 0;
}

// Index of the strongest peak within ±cents of hz (peaks are sorted by frequency), or -1.
function nearest(peaks: Peak[], hz: number, cents: number): number {
  const [lo, hi] = [hz * 2 ** (-cents / 1200), hz * 2 ** (cents / 1200)];
  let a = 0;
  let b = peaks.length;
  while (a < b) {
    const m = (a + b) >> 1;
    if (peaks[m].hz < lo) a = m + 1;
    else b = m;
  }
  let best = -1;
  for (let i = a; i < peaks.length && peaks[i].hz <= hi; i++) if (best < 0 || peaks[i].amp > peaks[best].amp) best = i;
  return best;
}

// Stiffer, shorter strings run sharper; try a spread of inharmonicity around the register's typical value.
function inharmonicities(note: number): number[] {
  const typical = 0.00025 * 2 ** ((note - 48) / 24); // about 2.5e-4 at C3, rising up the keyboard
  return [0, 0.5, 1, 2, 4].map((k) => k * typical);
}

interface Match {
  partials: number[]; // peak index per harmonic, or -1
  amps: number[];
  score: number;
}

function match(peaks: Peak[], note: number, tune: number, o: TranscribeOptions): Match | null {
  const f0 = etHz(note) * 2 ** (tune / 1200);
  const harmonics = Math.min(16, Math.floor(o.maxHz / f0));
  let best: Match | null = null;
  for (const B of inharmonicities(note)) {
    const partials: number[] = [];
    const amps: number[] = [];
    let score = 0;
    for (let h = 1; h <= harmonics; h++) {
      const i = nearest(peaks, h * f0 * Math.sqrt(1 + B * h * h), 30);
      partials.push(i);
      const a = i < 0 ? 0 : peaks[i].amp;
      amps.push(a);
      score += a ** o.ampExp / h ** o.weightExp;
    }
    if (!best || score > best.score) best = { partials, amps, score };
  }
  if (!best) return null;
  const strongest = Math.max(...best.amps);
  // A real note has energy at its fundamental (bass strings may be weak there, so their octave
  // will do) and more than one partial; otherwise these "partials" belong to other notes.
  // Leaning on the octave, though, needs the odd partials the note above doesn't have, or it is
  // just that note's shadow.
  const amps = best.amps;
  const ownFundamental = amps[0] >= o.fundamentalRatio * strongest;
  const oddPartials = [2, 4].some((h) => {
    const i = best.partials[h] ?? -1;
    return i >= 0 && amps[h] >= 0.1 * strongest && peaks[i].amp >= o.ownRatio * peaks[i].orig;
  });
  const base = ownFundamental || (note < 48 && oddPartials) ? Math.max(amps[0], amps[1] ?? 0) : 0;
  const present = best.amps.filter((a) => a > o.presentRatio * strongest).length;
  // Treble strings are close to pure tones, so a single strong partial is enough up there, unless
  // that partial is mostly another note's (a leftover 3rd partial looks just like a treble note).
  const f = best.partials[0];
  const shared = f >= 0 && peaks[f].amp < o.ownRatio * peaks[f].orig;
  const needed = note >= 72 && !shared ? 1 : note < o.bassBelow ? o.bassPartials : o.minPartials;
  if (base < o.fundamentalRatio * strongest || present < needed) return null;
  return best;
}

/** `audio` starts at the chord's onset. Returns MIDI notes, low to high. */
export function transcribeChord(audio: Float32Array, sampleRate: number, options: Partial<TranscribeOptions> = {}) {
  const o = { ...DEFAULTS, ...options };
  const start = Math.round((o.startMs / 1000) * sampleRate);
  const frame = audio.subarray(start, start + o.windowSize);
  if (frame.length < o.windowSize / 2) return [];
  const size = 2 ** Math.ceil(Math.log2(o.windowSize * o.zeroPad));
  const peaks = findPeaks(magnitudeSpectrum(frame, size), sampleRate / size, o);
  const tune = tuningCents(peaks);

  const found: number[] = [];
  let first = 0;
  while (found.length < o.maxNotes) {
    let bestNote = -1;
    let best: Match | null = null;
    for (let n = o.lowest; n <= o.highest; n++) {
      if (found.includes(n)) continue;
      const m = match(peaks, n, tune, o);
      if (m && (!best || m.score > best.score)) [bestNote, best] = [n, m];
    }
    if (!best) break;
    o.trace?.(
      `pick ${bestNote} score ${best.score.toFixed(4)} (${(best.score / (first || best.score)).toFixed(2)} of first) ` +
        `partials ${best.partials.map((i) => (i < 0 ? '-' : `${peaks[i].amp.toFixed(3)}/${peaks[i].orig.toFixed(3)}`)).join(' ')}`,
    );
    if (!first) first = best.score;
    else if (best.score < first * o.relThreshold) break;
    found.push(bestNote);
    explain(peaks, best, o);
  }
  return found.sort((a, b) => a - b);
}

// Remove only what this note's own smooth envelope accounts for at each partial.
function explain(peaks: Peak[], { amps, partials }: Match, o: TranscribeOptions) {
  partials.forEach((i, h) => {
    if (i < 0) return;
    const lo = Math.max(0, h - o.smoothSpan);
    const hi = Math.min(amps.length - 1, h + o.smoothSpan);
    let [sum, count] = [0, 0];
    for (let k = lo; k <= hi; k++)
      if (!(o.excludeSelf && k === h)) {
        sum += amps[k];
        count++;
      }
    const envelope = count ? sum / count : amps[h];
    peaks[i].amp = Math.max(0, peaks[i].amp - Math.min(amps[h], envelope * o.envelopeGain));
  });
}
