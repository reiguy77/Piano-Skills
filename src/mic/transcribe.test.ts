import { describe, expect, it } from 'vitest';
import { iiVIBars } from '../drills/iiVI';
import { gradeVoicing, type Quality } from '../theory/chords';
import { analysisMs, transcribeChord } from './transcribe';

// Real-piano accuracy is measured by the benchmark in bench/; these cover the basics on a
// synthetic tone so they run anywhere.
const SR = 48000;
const LENGTH = Math.ceil((analysisMs(SR) / 1000) * SR);
const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);

// A rough piano tone: decaying, slightly sharp partials, with a weak fundamental in the bass.
function piano(notes: number[], amps = notes.map(() => 1), detuneCents = 0): Float32Array {
  const x = new Float32Array(LENGTH);
  notes.forEach((n, k) => {
    const f0 = hz(n) * 2 ** (detuneCents / 1200);
    for (let h = 1; h <= 12; h++) {
      const f = h * f0 * Math.sqrt(1 + 0.0004 * h * h);
      if (f > SR / 2) break;
      const a = (0.05 * amps[k] * (h === 1 && n < 48 ? 0.4 : 1)) / h ** 1.2;
      const phase = (h * 1.7 + k) % (2 * Math.PI);
      for (let i = 0; i < LENGTH; i++) x[i] += a * Math.exp(-i / SR / 0.8) * Math.sin((2 * Math.PI * f * i) / SR + phase);
    }
  });
  return x;
}

const pcs = (notes: number[]) => [...new Set(notes.map((n) => n % 12))].sort((a, b) => a - b);
const hear = (notes: number[], amps?: number[], detune?: number) => transcribeChord(piano(notes, amps, detune), SR);

describe('transcribeChord', () => {
  it('hears a single note', () => {
    expect(hear([60])).toEqual([60]);
  });

  it('hears nothing in silence', () => {
    expect(transcribeChord(new Float32Array(LENGTH), SR)).toEqual([]);
  });

  it.each([
    ['Dm7 shell', [50, 53, 60]],
    ['G7 shell', [43, 53, 59]],
    ['Cmaj7 shell', [48, 52, 59]],
    ['Dm7 rootless A', [53, 57, 60, 64]],
    ['G7 rootless B', [53, 57, 59, 64]],
    ['B♭maj7 shell', [46, 57, 62]],
  ])('hears the notes of a %s', (_, notes) => {
    expect(hear(notes)).toEqual(notes);
  });

  it.each([
    ['an octave', [48, 60]],
    ['a 12th', [48, 67]],
    ['octave bass under a shell', [43, 55, 59, 65]],
  ])('hears both notes of %s', (_, notes) => {
    expect(pcs(hear(notes))).toEqual(pcs(notes));
  });

  it('grades every shell in the ii–V–I drill as correct', () => {
    const third: Partial<Record<Quality, number>> = { m7: 3, '7': 4, maj7: 4 };
    const seventh: Partial<Record<Quality, number>> = { m7: 10, '7': 10, maj7: 11 };
    const wrong = iiVIBars().map((b) => b.chords[0]).filter((chord) => {
      const root = 43 + ((chord.root - 7 + 12) % 12); // G2 up to F♯3
      // Alternate 1-3-7 and 1-7-3 voicings.
      const notes =
        root % 2
          ? [root, root + third[chord.quality]! + 12, root + seventh[chord.quality]!]
          : [root, root + third[chord.quality]!, root + seventh[chord.quality]!];
      return !gradeVoicing(chord, hear(notes)).correct;
    });
    expect(wrong.map((c) => c.symbol)).toEqual([]);
  });

  it('still hears a softer inner voice', () => {
    expect(hear([50, 53, 60], [1, 0.5, 1])).toEqual([50, 53, 60]);
  });

  it('follows a piano that is out of tune', () => {
    expect(hear([50, 53, 60], undefined, -35)).toEqual([50, 53, 60]);
  });

  it('ignores the metronome clicks', () => {
    const x = piano([60]);
    for (const f of [900, 1200, 1500]) for (let i = 0; i < LENGTH; i++) x[i] += 0.02 * Math.sin((2 * Math.PI * f * i) / SR);
    expect(transcribeChord(x, SR)).toEqual([60]);
  });
});
