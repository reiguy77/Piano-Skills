// Jazz voicings aren't one fixed set of keys, so a chord is graded by what
// each note does in it: required tones, allowed colour tones, everything else wrong.

export type Quality = 'maj7' | 'm7' | '7' | 'm7b5' | 'dim7' | '6' | 'm6' | 'mMaj7' | '7sus4';

export interface ChordSymbol {
  symbol: string;
  root: number; // pitch class, C = 0
  quality: Quality;
}

interface Rule {
  required: number[]; // semitones above the root
  allowed: number[];
}

const RULES: Record<Quality, Rule> = {
  // 3, 7 required; root, 5, 9, 13, #11 allowed
  maj7: { required: [4, 11], allowed: [0, 7, 2, 9, 6] },
  // b3, b7 required; root, 5, 9, 11, 13 allowed
  m7: { required: [3, 10], allowed: [0, 7, 2, 5, 9] },
  // 3, b7 required; root, 5, 9, 13 plus the altered tensions b9 #9 #11 b13
  '7': { required: [4, 10], allowed: [0, 7, 2, 9, 1, 3, 6, 8] },
  // b3, b7 required; root, b5, 9, 11, b13 allowed
  m7b5: { required: [3, 10], allowed: [0, 6, 2, 5, 8] },
  dim7: { required: [3, 9], allowed: [0, 6, 2, 5, 8, 11] },
  // The 6th stands in for the 7th: 3, 6 required; root, 5, 9 allowed (a 6/9 passes)
  '6': { required: [4, 9], allowed: [0, 7, 2] },
  // b3, 6 required; root, 5, 9, 11 allowed
  m6: { required: [3, 9], allowed: [0, 7, 2, 5] },
  // b3, major 7 required; root, 5, 9, 11, 13 allowed
  mMaj7: { required: [3, 11], allowed: [0, 7, 2, 5, 9] },
  // The 4th replaces the 3rd, which now clashes: 4, b7 required; root, 5, 9, 13 allowed
  '7sus4': { required: [5, 10], allowed: [0, 7, 2, 9] },
};

// Other ways of writing a quality.
const SPELLINGS: Record<string, Quality> = { 'm(maj7)': 'mMaj7', '7sus': '7sus4' };

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

const INTERVAL_NAMES: Record<number, string> = {
  0: 'R', 1: '♭9', 2: '9', 3: '♭3', 4: '3', 5: '11', 6: '♯11',
  7: '5', 8: '♭13', 9: '13', 10: '♭7', 11: '7',
};

// The same semitone plays a different role depending on the chord.
function intervalName(i: number, quality: Quality): string {
  if (quality === '7' && i === 3) return '♯9';
  if ((quality === 'm7b5' || quality === 'dim7') && i === 6) return '♭5';
  if (quality === 'dim7' && i === 9) return '°7';
  if ((quality === '6' || quality === 'm6') && i === 9) return '6';
  if (quality === '7sus4' && i === 5) return '4';
  return INTERVAL_NAMES[i];
}

export function parseChord(symbol: string): ChordSymbol {
  const m = /^([A-G])([#b♯♭]?)(maj7|m7b5|m\(maj7\)|mMaj7|m7|m6|dim7|7sus4?|7|6)$/.exec(symbol.trim());
  if (!m) throw new Error(`Unsupported chord symbol: ${symbol}`);
  const accidental = m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0;
  return { symbol, root: (LETTERS[m[1]] + accidental + 12) % 12, quality: SPELLINGS[m[3]] ?? (m[3] as Quality) };
}

export function pitchClassName(pc: number): string {
  return SHARP_NAMES[((pc % 12) + 12) % 12];
}

export function noteName(midi: number): string {
  return `${pitchClassName(midi)}${Math.floor(midi / 12) - 1}`;
}

export function chordName(root: number, quality: Quality): string {
  return `${pitchClassName(root)}${quality}`;
}

export interface VoicingGrade {
  correct: boolean;
  missing: string[]; // required tones not played
  wrong: string[]; // played notes outside the chord
  heard: string[]; // every played note as its function, e.g. "3", "♭7", "13"
}

export function gradeVoicing(chord: ChordSymbol, midiNotes: number[]): VoicingGrade {
  const rule = RULES[chord.quality];
  const intervals = [...new Set(midiNotes.map((n) => (((n - chord.root) % 12) + 12) % 12))];
  const missing = rule.required.filter((i) => !intervals.includes(i)).map((i) => intervalName(i, chord.quality));
  const wrongNotes = midiNotes.filter((n) => {
    const i = (((n - chord.root) % 12) + 12) % 12;
    return !rule.required.includes(i) && !rule.allowed.includes(i);
  });
  return {
    correct: missing.length === 0 && wrongNotes.length === 0,
    missing,
    wrong: wrongNotes.map(noteName),
    heard: intervals.map((i) => intervalName(i, chord.quality)),
  };
}
