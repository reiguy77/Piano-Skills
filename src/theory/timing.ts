// Timing is graded against the chord's target beat. Comping often lands an
// eighth early on purpose, so a swung-eighth anticipation also counts.

export interface TimingGrade {
  offsetMs: number; // from the target beat, or from the anticipation point
  anticipated: boolean;
  onTime: boolean;
}

export const beatMs = (bpm: number) => 60000 / bpm;

// The swung offbeat falls ratio/(1+ratio) of the way through the beat (2:1 → 2/3).
export const swungOffbeatMs = (bpm: number, ratio: number) => (beatMs(bpm) * ratio) / (1 + ratio);

export function gradeTiming(
  onsetMs: number,
  targetMs: number,
  bpm: number,
  swingRatio: number,
  toleranceMs = 50,
): TimingGrade {
  const offset = onsetMs - targetMs;
  const anticipation = -(beatMs(bpm) - swungOffbeatMs(bpm, swingRatio));
  if (Math.abs(offset - anticipation) < Math.abs(offset)) {
    const fromAnticipation = offset - anticipation;
    return { offsetMs: fromAnticipation, anticipated: true, onTime: Math.abs(fromAnticipation) <= toleranceMs };
  }
  return { offsetMs: offset, anticipated: false, onTime: Math.abs(offset) <= toleranceMs };
}

// Swing ratio from pairs of eighth notes: (offbeat - downbeat) / (next downbeat - offbeat).
export function measureSwingRatio(onsetsMs: number[], gridStartMs: number, bpm: number): number | null {
  const beat = beatMs(bpm);
  const ratios: number[] = [];
  for (const t of onsetsMs) {
    const pos = (t - gridStartMs) / beat;
    const frac = pos - Math.floor(pos);
    // Offbeats sit in the middle of the beat; downbeats are excluded.
    if (frac > 0.3 && frac < 0.85) ratios.push(frac / (1 - frac));
  }
  if (ratios.length === 0) return null;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}
