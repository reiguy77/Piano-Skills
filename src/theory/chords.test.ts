import { describe, expect, it } from 'vitest';
import { gradeVoicing, parseChord } from './chords';

const G3 = 55, F3 = 53, B3 = 59, E4 = 64, A3 = 57, C4 = 60;

describe('gradeVoicing', () => {
  it('accepts a 3–7 shell for G7', () => {
    expect(gradeVoicing(parseChord('G7'), [F3, B3]).correct).toBe(true);
  });

  it('accepts a shell with the 13 added', () => {
    const g = gradeVoicing(parseChord('G7'), [F3, B3, E4]);
    expect(g.correct).toBe(true);
    expect(g.heard).toContain('13');
  });

  it('flags a missing 7th', () => {
    const g = gradeVoicing(parseChord('G7'), [G3, B3]);
    expect(g.correct).toBe(false);
    expect(g.missing).toEqual(['♭7']);
  });

  it('flags the natural 4th on a dominant as wrong', () => {
    const g = gradeVoicing(parseChord('G7'), [F3, B3, C4]);
    expect(g.correct).toBe(false);
    expect(g.wrong).toEqual(['C4']);
  });

  it('handles flats and rootless voicings', () => {
    // Rootless Dm7 (A voicing): F A C E = b3 5 b7 9
    expect(gradeVoicing(parseChord('Dm7'), [F3, A3, C4, E4]).correct).toBe(true);
    expect(parseChord('Bbmaj7').root).toBe(10);
  });
});
