import { beatMs, swungOffbeatMs } from '../theory/timing';

// Schedules a click track (and swung ride-style offbeats) on the audio clock.
// Returns the performance.now() time of beat 1 after the count-in, plus a stop function.
export function startMetronome(bpm: number, totalBeats: number, countInBeats: number, swingRatio: number) {
  const ctx = new AudioContext();
  const lead = 0.15;
  const audioStart = ctx.currentTime + lead;
  const perfStart = performance.now() + lead * 1000;
  const beat = beatMs(bpm) / 1000;
  const offbeat = swungOffbeatMs(bpm, swingRatio) / 1000;

  const click = (at: number, freq: number, gain: number) => {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    osc.connect(amp).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.06);
  };

  for (let i = 0; i < countInBeats + totalBeats; i++) {
    const t = audioStart + i * beat;
    const inCountIn = i < countInBeats;
    // Hi-hat feel: accent 2 and 4.
    click(t, inCountIn ? 1500 : i % 2 === 1 ? 1200 : 900, inCountIn || i % 2 === 1 ? 0.4 : 0.2);
    if (!inCountIn) click(t + offbeat, 900, 0.08);
  }

  return {
    downbeatMs: perfStart + countInBeats * beatMs(bpm),
    stop: () => void ctx.close(),
  };
}
