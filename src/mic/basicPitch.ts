// Spotify's Basic Pitch, a small neural note transcriber, run on the audio after a chord's onset.
// It is surest where the spectrum alone is ambiguous (octaves, doubled notes, notes on another
// note's partials), so its evidence is combined with transcribeChord's (see combine.ts). The
// library brings TensorFlow.js, so this module is loaded only once the microphone is in use.
import { BasicPitch } from '@spotify/basic-pitch';
import { EVIDENCE_HIGHEST, EVIDENCE_LOWEST, type NoteEvidence } from './combine';

const MODEL_SR = 22050;

let model: BasicPitch | null = null;
const getModel = () => (model ??= new BasicPitch(`${import.meta.env.BASE_URL}basic-pitch/model.json`));

/** Starts downloading the model (about 0.9 MB) and compiling it, so the first chord isn't slow. */
export async function warmUpBasicPitch() {
  await noteEvidence(new Float32Array(MODEL_SR / 2), MODEL_SR);
}

async function resample(audio: Float32Array, sampleRate: number): Promise<Float32Array> {
  if (sampleRate === MODEL_SR) return audio;
  const ctx = new OfflineAudioContext(1, Math.ceil((audio.length * MODEL_SR) / sampleRate), MODEL_SR);
  const buffer = ctx.createBuffer(1, audio.length, sampleRate);
  buffer.getChannelData(0).set(audio);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  return (await ctx.startRendering()).getChannelData(0);
}

/** `audio` starts at the chord's onset and should be BASIC_PITCH_MS long. */
export async function noteEvidence(audio: Float32Array, sampleRate: number): Promise<NoteEvidence> {
  const frames: number[][] = [];
  const onsets: number[][] = [];
  await getModel().evaluateModel(
    await resample(audio, sampleRate),
    (f, o) => {
      frames.push(...f);
      onsets.push(...o);
    },
    () => {},
  );
  return summarise(frames, onsets);
}

/** Per-note evidence from the model's frame-by-frame outputs (about 86 frames a second). */
export function summarise(frames: number[][], onsets: number[][]): NoteEvidence {
  const evidence: NoteEvidence = { onset: [], frame: [] };
  for (let midi = EVIDENCE_LOWEST; midi <= EVIDENCE_HIGHEST; midi++) {
    const p = midi - 21; // the model's pitches start at A0
    let onset = 0;
    for (let f = 0; f < Math.min(onsets.length, 12); f++) onset = Math.max(onset, onsets[f][p]);
    let [sum, n] = [0, 0];
    for (let f = 3; f < Math.min(frames.length, 40); f++, n++) sum += frames[f][p];
    evidence.onset.push(onset);
    evidence.frame.push(n ? sum / n : 0);
  }
  return evidence;
}
