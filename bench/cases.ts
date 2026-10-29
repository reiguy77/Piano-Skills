// The benchmark chords, shared by the benchmarks and by comparisons against saved model output
// (which line up by index, so the order of cases and of calls to random() must not change).
import { iiVIBars, type Bar } from '../src/drills/iiVI';
import type { Quality } from '../src/theory/chords';
import { renderChord, rng, type Condition } from './piano';

const LOW = 40; // E2
const HIGH = 84; // C6

// Voicings as semitones above their lowest note, weighted towards stacked and close voicings.
export const VOICINGS: Record<string, number[][]> = {
  single: [[0]],
  'octave': [[0, 12]],
  'two octaves': [[0, 24]],
  'R + 12th (5th over octave)': [[0, 19]],
  'R + 17th (3rd two octaves up)': [[0, 28]],
  'R + 5 + 8ve': [[0, 7, 12]],
  'shell 1-3-7': [[0, 4, 10], [0, 4, 11], [0, 3, 10]],
  'shell 1-7-3': [[0, 10, 16], [0, 11, 16], [0, 10, 15]],
  'R + 10th': [[0, 16], [0, 15]],
  'octave bass + shell': [[0, 12, 16, 22], [0, 12, 15, 22], [0, 12, 16, 23]],
  'doubled triad': [[0, 4, 7, 12], [0, 4, 7, 12, 16], [0, 3, 7, 12, 15]],
  'rootless A': [[0, 4, 7, 11], [0, 5, 6, 10], [0, 3, 7, 10]],
  'rootless B': [[0, 4, 5, 9], [0, 4, 6, 11], [0, 3, 5, 8]],
  'drop 2': [[0, 5, 9, 16], [0, 5, 8, 15], [0, 4, 9, 14]],
  'quartal (So What)': [[0, 5, 10, 15, 19]],
  'cluster (seconds)': [[0, 2, 4, 5], [0, 1, 5], [0, 2, 3, 7]],
  'two-hand 5 note': [[0, 10, 16, 21, 26], [0, 11, 16, 21, 26], [0, 10, 15, 19, 26]],
  'upper structure': [[0, 10, 14, 18, 21], [0, 10, 16, 20, 25]],
  'wide 6 note': [[0, 7, 16, 22, 26, 31], [0, 10, 15, 19, 24, 29]],
};

export interface RecognitionCase {
  category: string;
  notes: number[];
  previous?: number[];
  spreadMs: number;
  noiseDb: number;
}

export function recognitionCases(): RecognitionCase[] {
  const random = rng(7);
  const out: RecognitionCase[] = [];
  for (const [category, shapes] of Object.entries(VOICINGS))
    for (const shape of shapes)
      for (let key = 0; key < 12; key++) {
        const span = shape[shape.length - 1];
        // Lowest note anywhere that keeps the voicing inside E2–C6, landing on this key's pitch class.
        const options: number[] = [];
        for (let b = LOW; b + span <= HIGH; b++) if (b % 12 === key) options.push(b);
        if (!options.length) continue;
        const base = options[Math.floor(random() * options.length)];
        const notes = shape.map((i) => base + i);
        // Half the time the previous chord (a 4th away, as around the cycle) is still dying away.
        const previous = random() < 0.5 ? notes.map((n) => n + 5).filter((n) => n <= HIGH) : undefined;
        out.push({ category, notes, previous, spreadMs: random() < 0.2 ? 40 : 15, noiseDb: random() < 0.3 ? -35 : -50 });
      }
  return out;
}

/** Renders the recognition cases in benchmark order. */
export function* recognitionRenders(cond: Condition) {
  const random = rng(11);
  for (const c of recognitionCases())
    yield {
      ...c,
      audio: renderChord(c.notes, 600, { noiseDb: c.noiseDb, ...cond.options, random, previous: c.previous, spreadMs: c.spreadMs }),
    };
}

// Semitones above the root for each voicing, by chord quality.
export const DRILL_VOICINGS: Record<string, Partial<Record<Quality, number[]>>> = {
  'shell 1-3-7': { m7: [0, 3, 10], '7': [0, 4, 10], maj7: [0, 4, 11] },
  'shell 1-7-3': { m7: [0, 10, 15], '7': [0, 10, 16], maj7: [0, 11, 16] },
  'rootless A': { m7: [3, 7, 10, 14], '7': [10, 14, 16, 21], maj7: [4, 7, 11, 14] },
  'rootless B': { m7: [10, 14, 15, 19], '7': [4, 9, 10, 14], maj7: [11, 14, 16, 19] },
  'two-hand': { m7: [0, 10, 15, 19, 26], '7': [0, 10, 16, 21, 26], maj7: [0, 11, 16, 21, 26] },
};

/**
 * Every drill bar in every voicing, each followed by a wrong version (the 3rd a semitone off,
 * major ↔ minor, the classic mistake), rendered in benchmark order.
 */
export function* drillRenders(cond: Condition) {
  const random = rng(5);
  let prev: number[] | undefined;
  for (const [voicing, shapes] of Object.entries(DRILL_VOICINGS))
    for (const bar of iiVIBars()) {
      const shape = shapes[bar.chord.quality]!;
      // Root between E2 and D♯3 for rooted voicings; rootless ones sit an octave up.
      const root = 40 + ((bar.chord.root - 4 + 12) % 12) + (shape[0] === 0 ? 0 : 12);
      const notes = shape.map((i) => root + i);
      yield { bar, voicing, notes, wrong: false, audio: renderChord(notes, 600, { ...cond.options, random, previous: prev }) };
      const pc = (n: number) => (((n - bar.chord.root) % 12) + 12) % 12;
      const third = notes.findIndex((n) => [3, 4].includes(pc(n)));
      const wrongNotes = notes.map((n, i) => (i === third ? n + (pc(n) === 3 ? 1 : -1) : n));
      yield { bar, voicing, notes: wrongNotes, wrong: true, audio: renderChord(wrongNotes, 600, { ...cond.options, random, previous: notes }) };
      prev = notes;
    }
}

export type DrillRender = { bar: Bar; voicing: string; notes: number[]; wrong: boolean; audio: Float32Array };
