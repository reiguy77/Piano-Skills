import { useEffect, useRef, useState } from 'react';

// Notes struck within this window count as one chord.
const CHORD_WINDOW_MS = 80;

// Computer-keyboard fallback for trying the app without a MIDI device: A row = white keys from C4.
const QWERTY: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74,
};

export interface Strike {
  notes: number[];
  atMs: number; // performance.now() time of the first note
}

export type MidiStatus = 'connecting' | 'ready' | 'no-device' | 'unsupported';

export function useMidi(onStrike: (s: Strike) => void, qwertyOctaveShift = -12) {
  const [held, setHeld] = useState<number[]>([]);
  const [status, setStatus] = useState<MidiStatus>(() =>
    typeof navigator.requestMIDIAccess === 'function' ? 'connecting' : 'unsupported',
  );
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const onStrikeRef = useRef(onStrike);
  useEffect(() => {
    onStrikeRef.current = onStrike;
  });

  useEffect(() => {
    const heldSet = new Set<number>();
    let pending: Strike | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const noteOn = (note: number, atMs: number) => {
      heldSet.add(note);
      setHeld([...heldSet].sort((a, b) => a - b));
      if (!pending) {
        pending = { notes: [], atMs };
        timer = setTimeout(() => {
          const s = pending!;
          pending = null;
          onStrikeRef.current(s);
        }, CHORD_WINDOW_MS);
      }
      pending.notes.push(note);
    };
    const noteOff = (note: number) => {
      heldSet.delete(note);
      setHeld([...heldSet].sort((a, b) => a - b));
    };

    const onMidi = (e: MIDIMessageEvent) => {
      const [status, note, velocity] = e.data ?? [];
      const kind = status & 0xf0;
      if (kind === 0x90 && velocity > 0) noteOn(note, e.timeStamp);
      else if (kind === 0x80 || (kind === 0x90 && velocity === 0)) noteOff(note);
    };

    let access: MIDIAccess | null = null;
    const bindInputs = () => {
      if (!access) return;
      const inputs = [...access.inputs.values()];
      inputs.forEach((input) => (input.onmidimessage = onMidi));
      setDeviceName(inputs[0]?.name ?? null);
      setStatus(inputs.length ? 'ready' : 'no-device');
    };

    if (typeof navigator.requestMIDIAccess === 'function')
      navigator.requestMIDIAccess().then(
        (a) => {
          access = a;
          a.onstatechange = bindInputs;
          bindInputs();
        },
        () => setStatus('unsupported'),
      );

    const onKeyDown = (e: KeyboardEvent) => {
      const n = QWERTY[e.key.toLowerCase()];
      if (n !== undefined && !e.repeat) noteOn(n + qwertyOctaveShift, performance.now());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const n = QWERTY[e.key.toLowerCase()];
      if (n !== undefined) noteOff(n + qwertyOctaveShift);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (access) {
        access.onstatechange = null;
        access.inputs.forEach((input) => (input.onmidimessage = null));
      }
    };
  }, [qwertyOctaveShift]);

  return { held, status, deviceName };
}
