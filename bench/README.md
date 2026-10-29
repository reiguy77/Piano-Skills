# Chord recognition benchmark

Measures microphone chord recognition (`src/mic/transcribe.ts`) on real piano recordings: the
Salamander Grand Piano (CC-BY 3.0, Alexander Holm), sampled every minor third and pitch-shifted at
most a semitone.

```sh
./bench/fetch-samples.sh   # once: downloads ~36 MB into bench/samples/ (needs curl and ffmpeg)
npm run bench
```

Two suites run under three conditions: a clean recording, a laptop mic (bass rolled off below
200 Hz, noise at −40 dB), and a piano 30 cents flat.

- **recognition** — 480 chords, 19 kinds of voicing chosen to be hard to pick apart: octaves,
  12ths and 17ths that sit on the lower note's own partials, doubled triads, clusters, quartal,
  two-hand and six-note voicings. Every key, a random register within E2–C6, uneven touch,
  sometimes rolled, and half the time the previous chord still dying away underneath.
  *exact* = every note right; *pc-exact* = every pitch class right, which is what grading uses.
- **drill** — every bar of the ii–V–I drill in five common jazz voicings. *false-fail* = played
  right but graded wrong; *false-pass* = one required tone a semitone off, but graded right.

Options can be compared side by side:
`VARIANTS='{"a": {}, "b": {"relThreshold": 0.2}}' npm run bench`. `COND=studio` limits the
conditions, `MISSES=1 CAT="rootless A"` lists wrong answers in one category.

## Results (clean recording)

| Detector | exact | pc-exact | drill false-fail | drill false-pass |
| --- | --- | --- | --- | --- |
| First version (8192-point analyser, peak scoring) | 34.8% | 64.4% | 13.3% | 0% |
| `transcribeChord` | 56.9% | 84.2% | 3.3% | 0% |
| Spotify Basic Pitch (ML), best thresholds | 66.7% | 86.9% | 0% | 0% |
| Basic Pitch + `transcribeChord` notes it gives ≥ 0.2 | 62.9% | 90.0% | 0% | 0% |

The Basic Pitch rows come from `bench/ensemble.bench.test.ts`, which combines saved model output
(`bench/basic-pitch/posteriors-*.jsonl`) with `transcribeChord` on the same renders; its
thresholds were picked on this same data, so treat its edge as a little optimistic.

Most of what's left is ambiguous in a single spectrum: a soft note a 12th or two octaves above
another note sits exactly on that note's own partials, and a strong 3rd partial looks like a soft
12th. Octave mistakes don't change grading.
