// Would combining transcribeChord with Basic Pitch beat both? Uses Basic Pitch's saved per-note
// evidence (bench/basic-pitch/posteriors-*.jsonl, studio condition) so nothing slow runs here.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { combineNotes } from '../src/mic/combine';
import { transcribeChord } from '../src/mic/transcribe';
import { gradeVoicing } from '../src/theory/chords';
import { drillRenders, recognitionRenders } from './cases';
import { CONDITIONS, SR } from './piano';

interface Evidence {
  checksum: number;
  onset: number[]; // MIDI 40..84
  frame: number[];
}

const load = (name: string): Evidence[] => {
  const p = join(import.meta.dirname, 'basic-pitch', `posteriors-${name}.jsonl`);
  return existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
};

const LOW = 40;
const ev = (e: Evidence, key: 'onset' | 'frame', n: number) => e[key][n - LOW] ?? 0;
const bpNotes = (e: Evidence, onset = 0.3, frame = 0.3) =>
  e.frame.map((_, i) => i + LOW).filter((n) => ev(e, 'onset', n) >= onset && ev(e, 'frame', n) >= frame);

type Combiner = (dsp: number[], e: Evidence) => number[];
const uniq = (x: number[]) => [...new Set(x)].sort((a, b) => a - b);

const COMBINERS: Record<string, Combiner> = {
  dsp: (dsp) => dsp,
  'basic pitch': (_, e) => bpNotes(e),
  'combineNotes (the app)': combineNotes,
  union: (dsp, e) => uniq([...dsp, ...bpNotes(e)]),
  'both agree': (dsp, e) => dsp.filter((n) => bpNotes(e).includes(n)),
  // Keep a DSP note when Basic Pitch hears at least a little of it (or of its octave); add notes
  // Basic Pitch is sure of.
  ...Object.fromEntries(
    [0.05, 0.1, 0.15, 0.2].flatMap((t) =>
      [0.5, 0.7].map((sure) => [
        `dsp vetted ${t}, + bp ≥${sure}`,
        ((dsp, e) => {
          const vetted = dsp.filter((n) => [n, n - 12, n + 12].some((m) => ev(e, 'frame', m) >= t));
          return uniq([...vetted, ...bpNotes(e, 0.3, sure)]);
        }) as Combiner,
      ]),
    ),
  ),
  // Basic Pitch's notes, plus DSP notes it heard some evidence of.
  ...Object.fromEntries(
    [0.1, 0.15, 0.2].map((t) => [
      `bp + dsp ≥${t}`,
      ((dsp, e) => uniq([...bpNotes(e), ...dsp.filter((n) => ev(e, 'frame', n) >= t)])) as Combiner,
    ]),
  ),
};

it('dsp + basic pitch ensembles', () => {
  const recEv = load('recognition');
  const drillEv = load('drill');
  if (!recEv.length || !drillEv.length) return console.log('No Basic Pitch evidence saved; skipping.');
  const studio = CONDITIONS[0];
  const checksum = (a: Float32Array) => a.reduce((s, v) => s + Math.abs(v), 0);

  const rec = [...recognitionRenders(studio)].map((c, i) => {
    if (Math.abs(checksum(c.audio) - recEv[i].checksum) > 1e-3) throw new Error(`recognition case ${i} doesn't line up`);
    return { notes: c.notes, dsp: transcribeChord(c.audio, SR), e: recEv[i] };
  });
  const drill = [...drillRenders(studio)].map((r, i) => {
    if (Math.abs(checksum(r.audio) - drillEv[i].checksum) > 1e-3) throw new Error(`drill render ${i} doesn't line up`);
    return { ...r, dsp: transcribeChord(r.audio, SR), e: drillEv[i] };
  });

  const pcKey = (x: number[]) => uniq(x.map((n) => n % 12)).join();
  const rows = [`${'combination'.padEnd(30)} exact  pc-exact  drill false-fail  false-pass`];
  for (const [name, combine] of Object.entries(COMBINERS)) {
    let [exact, pcExact] = [0, 0];
    for (const r of rec) {
      const got = combine(r.dsp, r.e);
      if (got.join() === r.notes.join()) exact++;
      if (pcKey(got) === pcKey(r.notes)) pcExact++;
    }
    let [ff, fp] = [0, 0];
    for (const r of drill) {
      const ok = gradeVoicing(r.chord, combine(r.dsp, r.e)).correct;
      if (r.wrong && ok) fp++;
      if (!r.wrong && !ok) ff++;
    }
    const pct = (x: number, of: number) => `${((100 * x) / of).toFixed(1)}%`.padStart(6);
    rows.push(
      `${name.padEnd(30)}${pct(exact, rec.length)}  ${pct(pcExact, rec.length)}   ${pct(ff, drill.length / 2)}        ${pct(fp, drill.length / 2)}`,
    );
  }
  console.log(rows.join('\n'));
}, 600_000);
