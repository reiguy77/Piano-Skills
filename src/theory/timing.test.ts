import { describe, expect, it } from 'vitest';
import { gradeTiming, measureSwingRatio } from './timing';

describe('gradeTiming', () => {
  // 120 BPM: beat = 500 ms, swung offbeat at 333 ms, anticipation 167 ms early
  it('scores a slightly late chord as on time', () => {
    const g = gradeTiming(1030, 1000, 120, 2);
    expect(g).toMatchObject({ anticipated: false, onTime: true, offsetMs: 30 });
  });

  it('recognises a swung-eighth anticipation', () => {
    const g = gradeTiming(1000 - 167, 1000, 120, 2);
    expect(g.anticipated).toBe(true);
    expect(g.onTime).toBe(true);
  });

  it('marks a rushed chord as off', () => {
    expect(gradeTiming(920, 1000, 120, 2).onTime).toBe(false);
  });
});

describe('measureSwingRatio', () => {
  it('measures a 2:1 swing', () => {
    const onsets = [0, 333, 500, 833, 1000, 1333];
    expect(measureSwingRatio(onsets, 0, 120)).toBeCloseTo(2, 1);
  });
});
