import { chordName, parseChord, type ChordSymbol } from '../theory/chords';

// Major ii–V–I in all 12 keys, moving around the cycle of 4ths from C.
export interface Bar {
  key: string;
  chord: ChordSymbol;
}

export function iiVIBars(): Bar[] {
  const bars: Bar[] = [];
  for (let k = 0; k < 12; k++) {
    const tonic = (k * 5) % 12;
    const key = chordName(tonic, 'maj7').replace('maj7', '');
    for (const [offset, quality] of [[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']] as const) {
      bars.push({ key, chord: parseChord(chordName((tonic + offset) % 12, quality)) });
    }
  }
  return bars;
}
