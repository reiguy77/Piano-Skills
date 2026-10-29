import { parseChord, type ChordSymbol, type Quality } from '../theory/chords';

/** One bar of 4/4: a single chord, or two splitting the bar two beats each. */
export interface Bar {
  key: string;
  chords: ChordSymbol[];
}

/** A chord as it falls in time, which is what gets graded. */
export interface Change {
  chord: ChordSymbol;
  key: string;
  bar: number;
  /** First beat, counted from the first downbeat. */
  beat: number;
  beats: number;
}

export function changes(bars: Bar[], beatsPerBar: number): Change[] {
  return bars.flatMap((b, bar) => {
    const beats = beatsPerBar / b.chords.length;
    return b.chords.map((chord, j) => ({ chord, key: b.key, bar, beat: bar * beatsPerBar + j * beats, beats }));
  });
}

// Flat keys are spelled with flats (E♭m7 A♭7 D♭maj7), sharp keys with sharps (F♯m7 B7 Emaj7).
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const SHARP_KEYS = new Set([7, 2, 9, 4, 11]); // G D A E B

export function keyName(tonic: number): string {
  return FLAT_NAMES[((tonic % 12) + 12) % 12];
}

function spell(pc: number, tonic: number): string {
  return (SHARP_KEYS.has(((tonic % 12) + 12) % 12) ? SHARP_NAMES : FLAT_NAMES)[((pc % 12) + 12) % 12];
}

/** A chord as a semitone offset from the tonic; `raised` spells it with a sharp, as in ♯IV°7. */
type Step = [offset: number, quality: Quality, raised?: true];
/** A whole-bar chord, or two chords of two beats each. */
type BarSteps = Step | [Step, Step];

/**
 * One bar per entry, each chord a semitone offset from the tonic. Chords are spelled for the major
 * key `spellIn` (a minor key passes its relative major), and every bar is labelled `key`.
 */
export function progression(tonic: number, bars: BarSteps[], key = keyName(tonic), spellIn = tonic): Bar[] {
  tonic = ((tonic % 12) + 12) % 12;
  spellIn = ((spellIn % 12) + 12) % 12;
  const chord = ([offset, quality, raised]: Step) => {
    const root = raised ? SHARP_NAMES[(tonic + offset) % 12] : spell(tonic + offset, spellIn);
    return parseChord(`${root}${symbolFor(quality)}`);
  };
  return bars.map((b) => ({
    key,
    chords: typeof b[0] === 'number' ? [chord(b as Step)] : (b as [Step, Step]).map(chord),
  }));
}

// How a quality is written on the lead sheet, where it differs from its name.
function symbolFor(quality: Quality): string {
  return quality === 'mMaj7' ? 'm(maj7)' : quality;
}

/** One major ii–V–I–I (4 bars) in the key whose tonic is the given pitch class. */
export function iiVIInKey(tonic: number): Bar[] {
  return progression(tonic, [[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']]);
}

/** Name of a minor key, spelled like its relative major: E♭m, F♯m, Am. */
export function minorKeyName(tonic: number): string {
  return `${spell(tonic, tonic + 3)}m`;
}

/** A progression in a minor key, spelled with its relative major's sharps or flats. */
export function minorProgression(tonic: number, bars: BarSteps[]): Bar[] {
  return progression(tonic, bars, minorKeyName(tonic), tonic + 3);
}

/** One minor ii–V–i–i (4 bars): half-diminished ii, dominant V (♭9 and ♭13 fit), minor i. */
export function minorIiVIInKey(tonic: number): Bar[] {
  return minorProgression(tonic, [[2, 'm7b5'], [7, '7'], [0, 'm7'], [0, 'm7']]);
}

// Major ii–V–I in all 12 keys, moving around the cycle of 4ths from C.
export function iiVIBars(): Bar[] {
  return Array.from({ length: 12 }, (_, k) => iiVIInKey(k * 5)).flat();
}
