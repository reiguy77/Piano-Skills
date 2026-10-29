// Finds the moment a chord is struck from a stream of short-block loudness readings: the level
// has to jump well above the loudest it was a moment ago. Comparing with the recent peak, not the
// recent dip, keeps partials beating against each other in a ringing chord from retriggering.

export interface OnsetOptions {
  floor?: number; // minimum RMS to count as playing
  rise?: number; // how many times louder than the recent peak
  smoothBlocks?: number; // blocks averaged into one reading
  lookbackMs?: number; // how far back the recent peak is taken from
  gapMs?: number; // readings this recent are part of the attack itself, so not compared against
  refractoryMs?: number; // ignore further onsets this soon after one
}

export function createOnsetDetector({
  floor = 0.004,
  rise = 2,
  smoothBlocks = 4,
  lookbackMs = 150,
  gapMs = 15,
  refractoryMs = 120,
}: OnsetOptions = {}) {
  const recent: number[] = [];
  const history: { t: number; rms: number }[] = [];
  let lastOnset = -Infinity;

  /** Feed one block's mean square and its time; returns the onset time when one is detected. */
  return (meanSquare: number, tMs: number): number | null => {
    recent.push(meanSquare);
    if (recent.length > smoothBlocks) recent.shift();
    const rms = Math.sqrt(recent.reduce((a, b) => a + b, 0) / recent.length);

    while (history.length && history[0].t < tMs - lookbackMs) history.shift();
    const before = Math.max(0, ...history.filter((h) => h.t < tMs - gapMs).map((h) => h.rms));
    history.push({ t: tMs, rms });

    if (rms > floor && rms > before * rise && tMs - lastOnset > refractoryMs) {
      lastOnset = tMs;
      return tMs;
    }
    return null;
  };
}
