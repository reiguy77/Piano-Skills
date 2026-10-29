export const EVIDENCE_LOWEST = 40; // E2, as transcribeChord
export const EVIDENCE_HIGHEST = 84; // C6
/** Audio after the onset Basic Pitch is given: its frame scores are averaged up to ~465 ms. */
export const BASIC_PITCH_MS = 600;

/** Basic Pitch's scores (0–1) for each MIDI note EVIDENCE_LOWEST..EVIDENCE_HIGHEST. */
export interface NoteEvidence {
  onset: number[]; // strongest onset score in the first ~140 ms
  frame: number[]; // mean "sounding" score from ~35 to ~465 ms
}

// How the two recognisers' answers are merged, tuned on the recognition benchmark (bench/): Basic
// Pitch's confident notes, plus the spectral notes it heard at least some of. Basic Pitch rarely
// hears a note that isn't there but drops some in wide voicings; the spectral search finds those,
// and Basic Pitch's evidence weeds out the overtones it mistakes for notes.
const SURE_ONSET = 0.3;
const SURE_FRAME = 0.3;
const SUPPORT_FRAME = 0.2;

export function combineNotes(spectral: number[], evidence: NoteEvidence): number[] {
  const frame = (n: number) => evidence.frame[n - EVIDENCE_LOWEST] ?? 0;
  const onset = (n: number) => evidence.onset[n - EVIDENCE_LOWEST] ?? 0;
  const sure = evidence.frame.map((_, i) => i + EVIDENCE_LOWEST).filter((n) => onset(n) >= SURE_ONSET && frame(n) >= SURE_FRAME);
  const supported = spectral.filter((n) => frame(n) >= SUPPORT_FRAME);
  return [...new Set([...sure, ...supported])].sort((a, b) => a - b);
}
