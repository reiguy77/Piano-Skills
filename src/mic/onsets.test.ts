import { describe, expect, it } from 'vitest';
import { createOnsetDetector } from './onsets';

const SR = 48000;

describe('createOnsetDetector', () => {
  const blockMs = (128 / SR) * 1000;

  it('fires once at the attack and not while the chord rings', () => {
    const detect = createOnsetDetector();
    const onsets: number[] = [];
    for (let b = 0; b < 400; b++) {
      const t = b * blockMs;
      // silence, then a strike at 100 ms decaying over the next second
      const rms = t < 100 ? 0.001 : 0.2 * Math.exp(-(t - 100) / 400);
      const hit = detect(rms * rms, t);
      if (hit !== null) onsets.push(hit);
    }
    expect(onsets).toHaveLength(1);
    expect(onsets[0]).toBeGreaterThanOrEqual(100);
    expect(onsets[0]).toBeLessThan(110);
  });

  it('catches a new chord struck over a ringing one', () => {
    const detect = createOnsetDetector();
    const onsets: number[] = [];
    for (let b = 0; b < 400; b++) {
      const t = b * blockMs;
      let rms = t < 100 ? 0.001 : 0.2 * Math.exp(-(t - 100) / 400);
      if (t >= 600) rms += 0.2 * Math.exp(-(t - 600) / 400);
      const hit = detect(rms * rms, t);
      if (hit !== null) onsets.push(hit);
    }
    expect(onsets).toHaveLength(2);
    expect(onsets[1]).toBeGreaterThanOrEqual(600);
    expect(onsets[1]).toBeLessThan(610);
  });

  it('ignores partials beating in a ringing chord', () => {
    const detect = createOnsetDetector();
    const onsets: number[] = [];
    for (let b = 0; b < 800; b++) {
      const t = b * blockMs;
      // 4 Hz beating that dips the level to a fifth, on top of a slow decay
      const beat = 0.6 + 0.4 * Math.cos((2 * Math.PI * 4 * t) / 1000);
      const rms = t < 100 ? 0.001 : 0.2 * Math.exp(-(t - 100) / 800) * beat;
      const hit = detect(rms * rms, t);
      if (hit !== null) onsets.push(hit);
    }
    expect(onsets).toHaveLength(1);
  });

  it('stays quiet below the floor', () => {
    const detect = createOnsetDetector();
    let hits = 0;
    for (let b = 0; b < 200; b++) if (detect((0.001 * (1 + (b % 3))) ** 2, b * blockMs) !== null) hits++;
    expect(hits).toBe(0);
  });
});
