// Detectors under comparison. Each takes mono audio starting at the chord's onset.
import { transcribeChord, type TranscribeOptions } from '../src/mic/transcribe';

export type Detector = (audio: Float32Array, sampleRate: number) => number[];

// VARIANTS='{"name": {...options}}' compares option settings side by side.
const variants: Record<string, Partial<TranscribeOptions>> = JSON.parse(process.env.VARIANTS ?? '{"transcribeChord": {}}');

const all: Record<string, Detector> = {
  ...Object.fromEntries(
    Object.entries(variants).map(([name, o]) => [name, (audio: Float32Array, sr: number) => transcribeChord(audio, sr, o)]),
  ),
};

// ONLY=v2 limits the run to detectors whose name contains that text.
export const detectors = Object.fromEntries(Object.entries(all).filter(([name]) => name.includes(process.env.ONLY ?? '')));
