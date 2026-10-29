# Piano Skills

A piano practice app that levels you up toward advanced jazz skills. It listens to a MIDI keyboard
and grades each drill on **voicings** (by what each note does in the chord, so any good voicing
passes) and **swing timing** (offsets from the beat, with swung-eighth anticipations allowed).

Wireframes: https://claude.ai/artifact/RBtLUrjatc6ysTbtMDmYhv

## Run it

```sh
npm install
npm run dev      # open in Chrome or Edge (Safari has no Web MIDI)
npm test         # theory + timing unit tests
npm run build
```

No MIDI keyboard? The A–L row of your computer keyboard plays C3–D4 (W, E, T, Y, U, O are the
black keys). Press keys together to play a chord.

Acoustic piano? Pick **Microphone** at the top. Wear headphones so the mic hears the piano rather than
the click, and if on-the-beat chords keep showing as late, raise the mic delay correction by that much.

## What's here

- `src/theory/chords.ts` — parses chord symbols (`Dm7`, `G7`, `B♭maj7`, `F♯m7b5`, `dim7`, `C6`, `Cm6`,
  `Cm(maj7)`, `G7sus4`) and grades a voicing: required tones (3rd and 7th; the 6th on a 6 chord, the 4th
  on a sus), allowed colour tones (root, 5, 9, 11, 13, altered tensions on dominants), everything else wrong.
- `src/theory/timing.ts` — timing against the target beat, anticipations, swing-ratio measurement.
- `src/midi/useMidi.ts` — Web MIDI input; notes within 80 ms count as one chord.
- `src/midi/metronome.ts` — swung click track on the Web Audio clock, hi-hat accents on 2 and 4.
- `src/mic/transcribe.ts` — names a chord's notes from its spectrum: partials matched with piano
  inharmonicity and the instrument's tuning, notes taken one at a time, each removing only the share
  of a partial its own envelope explains, so stacked octaves and 12ths still come through.
- `src/mic/basicPitch.ts` + `combine.ts` — Spotify's Basic Pitch model (loaded only in mic mode)
  vets and fills in those notes. Accuracy on real piano recordings is measured in `bench/`.
- `src/mic/onsets.ts` — finds chord attacks from the input level without retriggering on a ringing chord.
- `src/mic/useMic.ts` — microphone input that reports chords the same way `useMidi` does.
- `src/drills/iiVI.ts` — builds progressions spelled for their key, one chord a bar or two at two beats each.
- `src/drills/library.ts` — the skills you pick from: ii–V–I (one key, chained, all 12), diatonic 7th
  chords, I–vi–ii–V and two-beat turnarounds, sus → dominant → 6, minor ii–V–i and minor tonic colours,
  “Autumn Leaves” changes, and the 12-bar jazz blues with and without its ii–Vs.

## Roadmap

1. Level / XP / stars and the skill tree (voicings, harmony, feel & comping, improvisation).
2. More drills: rootless A/B voicings, guide-tone lines, Charleston comping, minor blues.
3. Practice history and "work on" warm-ups built from missed keys and chords.
4. ~~Microphone input as a fallback for acoustic pianos.~~ First version in; next is a tap-along
   latency calibration and tuning against real recordings.
5. iOS app (Capacitor + CoreMIDI) once the web version is solid.
