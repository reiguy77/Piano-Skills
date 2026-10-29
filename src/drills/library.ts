import { iiVIBars, iiVIInKey, keyName, type Bar } from './iiVI';

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
];

export function findSkill(id: string): Skill {
  return SKILLS.find((s) => s.id === id) ?? SKILLS[0];
}
