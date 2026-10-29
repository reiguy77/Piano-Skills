import { describe, expect, it } from 'vitest';
import { iiVIBars } from './iiVI';
import { findSkill, KEYS, SKILLS } from './library';

const symbols = (id: string, key = 0) => findSkill(id).bars(key).map((b) => b.chord.symbol);

describe('skill library', () => {
  it('plays a ii–V–I–I twice in the chosen key', () => {
    expect(symbols('iivi-one-key', 3)).toEqual([
      'Fm7', 'B♭7', 'E♭maj7', 'E♭maj7',
      'Fm7', 'B♭7', 'E♭maj7', 'E♭maj7',
    ]);
    expect(findSkill('iivi-one-key').bars(3).every((b) => b.key === 'E♭')).toBe(true);
  });

  it('spells sharp keys with sharps', () => {
    expect(symbols('iivi-one-key', 4).slice(0, 3)).toEqual(['F♯m7', 'B7', 'Emaj7']);
    expect(symbols('iivi-one-key', 11).slice(0, 3)).toEqual(['C♯m7', 'F♯7', 'Bmaj7']);
    expect(symbols('iivi-one-key', 6).slice(0, 3)).toEqual(['A♭m7', 'D♭7', 'G♭maj7']);
  });

  it('chains the I into the next ii a whole step down', () => {
    const bars = findSkill('iivi-chain').bars(0);
    expect(bars.map((b) => b.chord.symbol)).toEqual([
      'Dm7', 'G7', 'Cmaj7', 'Cmaj7',
      'Cm7', 'F7', 'B♭maj7', 'B♭maj7',
    ]);
    expect(bars.map((b) => b.key)).toEqual(['C', 'C', 'C', 'C', 'B♭', 'B♭', 'B♭', 'B♭']);
    // The I's root carries over as the next ii's root.
    expect(bars[4].chord.root).toBe(bars[3].chord.root);
  });

  it('wraps the chain around the octave', () => {
    expect(symbols('iivi-chain', 1)).toEqual([
      'E♭m7', 'A♭7', 'D♭maj7', 'D♭maj7',
      'C♯m7', 'F♯7', 'Bmaj7', 'Bmaj7',
    ]);
  });

  it('keeps the 12-key drill around the cycle of 4ths', () => {
    const bars = findSkill('iivi-12-keys').bars(0);
    expect(bars).toEqual(iiVIBars());
    expect(bars).toHaveLength(48);
    expect([...new Set(bars.map((b) => b.key))]).toEqual(['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'B', 'E', 'A', 'D', 'G']);
    expect(bars.slice(0, 4).map((b) => b.chord.symbol)).toEqual(['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
  });

  it('builds every skill in every key with valid chords', () => {
    for (const s of SKILLS)
      for (const { pc } of KEYS) {
        const bars = s.bars(pc);
        expect(bars.length % 4).toBe(0);
        for (const b of bars) expect(['m7', '7', 'maj7', 'm7b5']).toContain(b.chord.quality);
      }
  });

  it('walks the diatonic 7th chords up the scale', () => {
    expect(symbols('diatonic-sevenths', 7)).toEqual([
      'Gmaj7', 'Am7', 'Bm7', 'Cmaj7', 'D7', 'Em7', 'F♯m7b5', 'Gmaj7',
    ]);
  });

  it('loops the I–vi–ii–V turnaround twice', () => {
    expect(symbols('turnaround', 5)).toEqual([
      'Fmaj7', 'Dm7', 'Gm7', 'C7',
      'Fmaj7', 'Dm7', 'Gm7', 'C7',
    ]);
  });

  it('plays a minor ii–V–i spelled from the relative major', () => {
    expect(symbols('minor-iivi', 0).slice(0, 4)).toEqual(['Dm7b5', 'G7', 'Cm7', 'Cm7']);
    expect(symbols('minor-iivi', 4).slice(0, 3)).toEqual(['F♯m7b5', 'B7', 'Em7']);
    expect(symbols('minor-iivi', 6).slice(0, 3)).toEqual(['G♯m7b5', 'C♯7', 'F♯m7']);
    expect(findSkill('minor-iivi').bars(6)[0].key).toBe('F♯m');
    expect(findSkill('minor-iivi').title(3)).toBe('Minor ii–V–i in E♭m');
  });

  it('moves “Autumn Leaves” from the relative major into the minor key', () => {
    const bars = findSkill('autumn-leaves').bars(7);
    expect(bars.map((b) => b.chord.symbol)).toEqual([
      'Cm7', 'F7', 'B♭maj7', 'E♭maj7',
      'Am7b5', 'D7', 'Gm7', 'Gm7',
    ]);
    expect(bars.map((b) => b.key)).toEqual(['B♭', 'B♭', 'B♭', 'B♭', 'Gm', 'Gm', 'Gm', 'Gm']);
  });

  it('builds the 12-bar jazz blues', () => {
    expect(symbols('jazz-blues', 10)).toEqual([
      'B♭7', 'E♭7', 'B♭7', 'B♭7',
      'E♭7', 'E♭7', 'B♭7', 'G7',
      'Cm7', 'F7', 'B♭7', 'F7',
    ]);
  });

  it('falls back to the first skill for an unknown id', () => {
    expect(findSkill('nope')).toBe(SKILLS[0]);
  });
});
