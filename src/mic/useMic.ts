import { useEffect, useRef, useState } from 'react';
import type { Strike } from '../midi/useMidi';
import { BASIC_PITCH_MS, combineNotes } from './combine';
import { createOnsetDetector } from './onsets';
import { analysisMs, transcribeChord } from './transcribe';

// Below this level the room counts as silent and nothing is shown as held.
const SILENCE_RMS = 0.003;
const LEVEL_POLL_MS = 100;
// If Basic Pitch hasn't answered by then (a slow machine), the spectral answer stands alone.
const BASIC_PITCH_TIMEOUT_MS = 1500;

// Input 0 (low-passed) is metered: the mean square of every 128-sample block, so onsets are timed
// to within ~3 ms. Input 1 (raw) goes into a two-second ring buffer, from which the main thread
// asks for the audio after an onset once it has all arrived.
const WORKLET = `
class ChordTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(2 * sampleRate);
    this.written = 0;
    this.requests = [];
    this.port.onmessage = (e) => this.requests.push(e.data);
  }
  process(inputs) {
    const level = inputs[0][0];
    const raw = inputs[1][0];
    if (level) {
      let s = 0;
      for (let i = 0; i < level.length; i++) s += level[i] * level[i];
      this.port.postMessage({ type: 'level', frame: currentFrame, meanSquare: s / level.length });
    }
    if (raw) {
      for (let i = 0; i < raw.length; i++) this.ring[(currentFrame + i) % this.ring.length] = raw[i];
      this.written = currentFrame + raw.length;
    }
    this.requests = this.requests.filter((r) => {
      if (this.written < r.from + r.length) return true;
      const audio = new Float32Array(r.length);
      if (r.from >= this.written - this.ring.length)
        for (let i = 0; i < r.length; i++) audio[i] = this.ring[(r.from + i) % this.ring.length];
      this.port.postMessage({ type: 'audio', id: r.id, audio }, [audio.buffer]);
      return false;
    });
    return true;
  }
}
registerProcessor('chord-tap', ChordTap);
`;

type TapMessage =
  | { type: 'level'; frame: number; meanSquare: number }
  | { type: 'audio'; id: number; audio: Float32Array };

export type MicStatus = 'off' | 'starting' | 'listening' | 'denied' | 'unsupported';

// mediaDevices is missing outside secure contexts (plain http on another host).
const supported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices;

/**
 * Listens to an acoustic piano through the microphone and reports chords the same way useMidi
 * does. `latencyMs` is subtracted from each onset to make up for audio input delay.
 */
export function useMic(enabled: boolean, onStrike: (s: Strike) => void, latencyMs: number) {
  const [held, setHeld] = useState<number[]>([]);
  const [level, setLevel] = useState(0);
  const [state, setState] = useState<'starting' | 'listening' | 'denied'>('starting');
  const onStrikeRef = useRef(onStrike);
  const latencyRef = useRef(latencyMs);
  useEffect(() => {
    onStrikeRef.current = onStrike;
    latencyRef.current = latencyMs;
  });

  useEffect(() => {
    if (!enabled || !supported()) return;
    let cancelled = false;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    // Basic Pitch (and TensorFlow.js with it) loads in the background; until it's ready, or if it
    // can't run here, chords are named by transcribeChord alone.
    let basicPitch: typeof import('./basicPitch') | null = null;
    import('./basicPitch')
      .then(async (m) => {
        await m.warmUpBasicPitch();
        if (!cancelled) basicPitch = m;
      })
      .catch(() => {});

    (async () => {
      try {
        // Voice processing would gate, level and filter the piano, so turn it all off.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch {
        if (!cancelled) setState('denied');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);

      const sr = ctx.sampleRate;

      // Onsets are found below the metronome's clicks, so speaker bleed doesn't trigger them.
      const lowpass = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
      lowpass.forEach((f) => {
        f.type = 'lowpass';
        f.frequency.value = 600;
      });
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
      if (cancelled) return;
      const tap = new AudioWorkletNode(ctx, 'chord-tap', { numberOfInputs: 2 });
      source.connect(lowpass[0]).connect(lowpass[1]).connect(tap, 0, 0);
      source.connect(tap, 0, 1);
      // The tap outputs silence; connecting it to the output just keeps it being processed.
      tap.connect(ctx.destination);

      const onset = createOnsetDetector();
      const captureFrames = Math.ceil((Math.max(analysisMs(sr), BASIC_PITCH_MS) / 1000) * sr);
      const strikes = new Map<number, number>(); // request id → onset time on the performance.now() clock
      let nextId = 0;
      let rms = 0;
      // The chord just struck shows as held until the room goes quiet: the spectral answer at
      // once, then the combined one.
      const nameChord = async (audio: Float32Array) => {
        const spectral = transcribeChord(audio, sr);
        if (rms > SILENCE_RMS) setHeld(spectral);
        if (!basicPitch) return spectral;
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), BASIC_PITCH_TIMEOUT_MS));
        const evidence = await Promise.race([basicPitch.noteEvidence(audio, sr).catch(() => null), timeout]);
        const notes = evidence ? combineNotes(spectral, evidence) : spectral;
        if (!cancelled && rms > SILENCE_RMS) setHeld(notes);
        return notes;
      };
      // Chords are named one at a time, so strikes reach the drill in the order they were played.
      let queue = Promise.resolve();
      tap.port.onmessage = (e: MessageEvent<TapMessage>) => {
        const msg = e.data;
        if (msg.type === 'audio') {
          const atMs = strikes.get(msg.id)!;
          strikes.delete(msg.id);
          queue = queue.then(async () => {
            const notes = await nameChord(msg.audio);
            if (!cancelled && notes.length) onStrikeRef.current({ notes, atMs: atMs - latencyRef.current });
          });
          return;
        }
        rms = Math.sqrt(msg.meanSquare);
        // Onsets are found on the audio clock, then mapped onto performance.now(), which the drill uses.
        const hitMs = onset(msg.meanSquare, (msg.frame / sr) * 1000);
        if (hitMs === null) return;
        const id = nextId++;
        strikes.set(id, performance.now() - (ctx!.currentTime * 1000 - hitMs));
        tap.port.postMessage({ id, from: Math.round((hitMs / 1000) * sr), length: captureFrames });
      };

      poll = setInterval(() => {
        setLevel(rms);
        if (rms <= SILENCE_RMS) setHeld([]);
      }, LEVEL_POLL_MS);
      setState('listening');
    })();

    return () => {
      cancelled = true;
      clearInterval(poll);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setHeld([]);
      setLevel(0);
      setState('starting');
    };
  }, [enabled]);

  const status: MicStatus = !supported() ? 'unsupported' : !enabled ? 'off' : state;
  return { held, level, status };
}
