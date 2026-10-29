import { iiVIBars, iiVIInKey, keyName, minorIiVIInKey, minorKeyName, progression, type Bar } from './iiVI';

export type { Bar };

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** Whether the user picks a starting key (pitch class, C = 0). */
  needsKey: boolean;
  /** Key picker heading, when "Key" isn't right. */
  keyLabel?: string;
  /** Header title once chosen, e.g. "ii–V–I in E♭". */
  title(key: number): string;
  bars(key: number): Bar[];
}

/** Key picker order and labels. */
export const KEYS: { pc: number; label: string }[] = [
  { pc: 0, label: 'C' },
  { pc: 1, label: 'D♭' },
  { pc: 2, label: 'D' },
  { pc: 3, label: 'E♭' },
  { pc: 4, label: 'E' },
  { pc: 5, label: 'F' },
  { pc: 6, label: 'F♯/G♭' },
  { pc: 7, label: 'G' },
  { pc: 8, label: 'A♭' },
  { pc: 9, label: 'A' },
  { pc: 10, label: 'B♭' },
  { pc: 11, label: 'B' },
];

export const SKILLS: Skill[] = [
  {
    id: 'iivi-one-key',
    name: 'ii–V–I in one key',
    description: 'Major ii–V–I–I in a key you choose, played twice.',
    needsKey: true,
    title: (key) => `ii–V–I in ${keyName(key)}`,
    bars: (key) => [...iiVIInKey(key), ...iiVIInKey(key)],
  },
  {
    id: 'iivi-chain',
    name: 'ii–V–I chain, two keys',
    description: 'The I chord turns minor and becomes the next ii, so the key drops a whole step (as in “Tune Up”).',
    needsKey: true,
    keyLabel: 'Starting key',
    title: (key) => `ii–V–I chain: ${keyName(key)} → ${keyName(key - 2)}`,
    bars: (key) => [...iiVIInKey(key), ...iiVIInKey(key - 2)],
  },
  {
    id: 'iivi-12-keys',
    name: 'ii–V–I, all 12 keys',
    description: 'Major ii–V–I around the cycle of 4ths from C: C, F, B♭, E♭ … G.',
    needsKey: false,
    title: () => 'ii–V–I, all 12 keys',
    bars: () => iiVIBars(),
  },
  {
    id: 'diatonic-sevenths',
    name: 'Diatonic 7th chords',
    description: 'Up the major scale one chord per bar: Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7 Imaj7.',
    needsKey: true,
    title: (key) => `Diatonic 7ths in ${keyName(key)}`,
    bars: (key) =>
      progression(key, [
        [0, 'maj7'], [2, 'm7'], [4, 'm7'], [5, 'maj7'],
        [7, '7'], [9, 'm7'], [11, 'm7b5'], [0, 'maj7'],
      ]),
  },
  {
    id: 'turnaround',
    name: 'I–vi–ii–V turnaround',
    description: 'The “rhythm changes” loop that ends countless tunes, played twice.',
    needsKey: true,
    title: (key) => `I–vi–ii–V in ${keyName(key)}`,
    bars: (key) => {
      const loop = progression(key, [[0, 'maj7'], [9, 'm7'], [2, 'm7'], [7, '7']]);
      return [...loop, ...loop];
    },
  },
  {
    id: 'minor-iivi',
    name: 'Minor ii–V–i',
    description: 'Half-diminished ii, dominant V, minor i, played twice. The ♭9 and ♭13 sound great on the V.',
    needsKey: true,
    keyLabel: 'Minor key',
    title: (key) => `Minor ii–V–i in ${minorKeyName(key)}`,
    bars: (key) => [...minorIiVIInKey(key), ...minorIiVIInKey(key)],
  },
  {
    id: 'autumn-leaves',
    name: '“Autumn Leaves” changes',
    description: 'A major ii–V–I–IV into the relative minor’s ii–V–i: the first jazz standard most players learn.',
    needsKey: true,
    keyLabel: 'Minor key',
    title: (key) => `“Autumn Leaves” in ${minorKeyName(key)}`,
    bars: (key) => [
      ...progression(key + 3, [[2, 'm7'], [7, '7'], [0, 'maj7'], [5, 'maj7']]),
      ...minorIiVIInKey(key),
    ],
  },
  {
    id: 'jazz-blues',
    name: '12-bar jazz blues',
    description: 'I7 IV7 I7 I7 · IV7 IV7 I7 VI7 · ii7 V7 I7 V7, the blues as jazz players comp it.',
    needsKey: true,
    title: (key) => `Jazz blues in ${keyName(key)}`,
    bars: (key) =>
      progression(key, [
        [0, '7'], [5, '7'], [0, '7'], [0, '7'],
        [5, '7'], [5, '7'], [0, '7'], [9, '7'],
        [2, 'm7'], [7, '7'], [0, '7'], [7, '7'],
      ]),
  },
];

export function findSkill(id: string): Skill {
  return SKILLS.find((s) => s.id === id) ?? SKILLS[0];
}
