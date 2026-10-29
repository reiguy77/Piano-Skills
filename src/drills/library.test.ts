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
        for (const b of bars) expect(['m7', '7', 'maj7']).toContain(b.chord.quality);
        if (s.needsKey) expect(bars[2].chord.root).toBe(pc);
      }
  });

  it('falls back to the first skill for an unknown id', () => {
    expect(findSkill('nope')).toBe(SKILLS[0]);
  });
});
