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

## What's here

- `src/theory/chords.ts` — parses chord symbols (`Dm7`, `G7`, `B♭maj7`, `F♯m7b5`, `dim7`) and grades a
  voicing: required tones (3rd, 7th), allowed colour tones (root, 5, 9, 11, 13, altered tensions on
  dominants), everything else wrong.
- `src/theory/timing.ts` — timing against the target beat, anticipations, swing-ratio measurement.
- `src/midi/useMidi.ts` — Web MIDI input; notes within 80 ms count as one chord.
- `src/midi/metronome.ts` — swung click track on the Web Audio clock, hi-hat accents on 2 and 4.
- `src/drills/iiVI.ts` — the first drill: major ii–V–I in all 12 keys around the cycle of 4ths.

## Roadmap

1. Level / XP / stars and the skill tree (voicings, harmony, feel & comping, improvisation).
2. More drills: rootless A/B voicings, minor ii–V–i, guide-tone lines, Charleston comping, blues.
3. Practice history and "work on" warm-ups built from missed keys and chords.
4. Microphone input as a fallback for acoustic pianos.
5. iOS app (Capacitor + CoreMIDI) once the web version is solid.
