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

  it('grades a minor 6 by its 6th, not a 7th', () => {
    // Cm6: E♭ A, plus G and D
    const g = gradeVoicing(parseChord('Cm6'), [51, 55, 57, 62]);
    expect(g.correct).toBe(true);
    expect(g.heard).toContain('6');
    expect(gradeVoicing(parseChord('Cm6'), [51, 58]).missing).toEqual(['6']);
  });

  it('wants the major 7th on a minor-major 7', () => {
    const c = parseChord('Cm(maj7)');
    expect(c.quality).toBe('mMaj7');
    expect(gradeVoicing(c, [51, 59]).correct).toBe(true);
    expect(gradeVoicing(c, [51, 58]).wrong).toEqual(['B♭3']);
  });

  it('takes the 4th instead of the 3rd on a sus chord', () => {
    const g7sus = parseChord('G7sus4');
    expect(parseChord('G7sus').quality).toBe('7sus4');
    // F/G: the rootless sus voicing F A C = ♭7 9 4
    const g = gradeVoicing(g7sus, [F3, A3, C4]);
    expect(g.correct).toBe(true);
    expect(g.heard).toContain('4');
    expect(gradeVoicing(g7sus, [F3, B3, C4]).wrong).toEqual(['B3']);
  });

  it('accepts a 6/9 on a major 6 chord', () => {
    // C6/9: E A D
    expect(gradeVoicing(parseChord('C6'), [52, 57, 62]).correct).toBe(true);
    expect(gradeVoicing(parseChord('C6'), [52, 59]).correct).toBe(false);
  });
});
