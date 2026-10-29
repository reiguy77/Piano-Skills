import { parseChord, type ChordSymbol, type Quality } from '../theory/chords';

export interface Bar {
  key: string;
  chord: ChordSymbol;
}

// Flat keys are spelled with flats (E♭m7 A♭7 D♭maj7), sharp keys with sharps (F♯m7 B7 Emaj7).
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const SHARP_KEYS = new Set([7, 2, 9, 4, 11]); // G D A E B

export function keyName(tonic: number): string {
  return FLAT_NAMES[((tonic % 12) + 12) % 12];
}

function spell(pc: number, tonic: number): string {
  return (SHARP_KEYS.has(tonic) ? SHARP_NAMES : FLAT_NAMES)[((pc % 12) + 12) % 12];
}

/** One major ii–V–I–I (4 bars) in the key whose tonic is the given pitch class. */
export function iiVIInKey(tonic: number): Bar[] {
  tonic = ((tonic % 12) + 12) % 12;
  const key = keyName(tonic);
  return ([[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']] as [number, Quality][]).map(([offset, quality]) => ({
    key,
    chord: parseChord(`${spell(tonic + offset, tonic)}${quality}`),
  }));
}

// Major ii–V–I in all 12 keys, moving around the cycle of 4ths from C.
export function iiVIBars(): Bar[] {
  return Array.from({ length: 12 }, (_, k) => iiVIInKey(k * 5)).flat();
}
