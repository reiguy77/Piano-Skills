import { describe, expect, it } from 'vitest';
import { combineNotes, type NoteEvidence } from './combine';

// Evidence with the given { midi: [onset, frame] } scores, zero elsewhere.
function evidence(scores: Record<number, [number, number]>): NoteEvidence {
  const e: NoteEvidence = { onset: Array(45).fill(0), frame: Array(45).fill(0) };
  for (const [midi, [onset, frame]] of Object.entries(scores)) {
    e.onset[+midi - 40] = onset;
    e.frame[+midi - 40] = frame;
  }
  return e;
}

describe('combineNotes', () => {
  it("keeps Basic Pitch's confident notes", () => {
    expect(combineNotes([], evidence({ 48: [0.9, 0.8], 60: [0.5, 0.4] }))).toEqual([48, 60]);
  });

  it('drops a spectral note Basic Pitch heard nothing of', () => {
    // e.g. a strong 3rd partial taken for a note a 12th up
    expect(combineNotes([48, 67], evidence({ 48: [0.9, 0.8], 67: [0.05, 0.05] }))).toEqual([48]);
  });

  it('keeps a spectral note Basic Pitch heard some of', () => {
    expect(combineNotes([48, 70], evidence({ 48: [0.9, 0.8], 70: [0.1, 0.25] }))).toEqual([48, 70]);
  });

  it('needs an onset as well as a sound for a note of its own', () => {
    // still ringing from the previous chord
    expect(combineNotes([], evidence({ 55: [0.1, 0.6] }))).toEqual([]);
  });
});
