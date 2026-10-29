// Chord-recognition benchmark on real piano recordings. Not part of `npm test`; run with
//   ./bench/fetch-samples.sh && npm run bench
import { it } from 'vitest';
import { detectors } from './detectors';
import { recognitionRenders } from './cases';
import { CONDITIONS, SR } from './piano';

interface Score {
  chords: number;
  exact: number; // detected notes exactly right
  pcExact: number; // pitch classes exactly right (what grading uses)
  tp: number;
  fp: number;
  fn: number;
  pcTp: number;
  pcFp: number;
  pcFn: number;
}

const blank = (): Score => ({ chords: 0, exact: 0, pcExact: 0, tp: 0, fp: 0, fn: 0, pcTp: 0, pcFp: 0, pcFn: 0 });

function add(s: Score, truth: number[], got: number[]) {
  const pcs = (x: number[]) => new Set(x.map((n) => n % 12));
  const [t, g, tp, gp] = [new Set(truth), new Set(got), pcs(truth), pcs(got)];
  s.chords++;
  const tpN = [...g].filter((n) => t.has(n)).length;
  s.tp += tpN;
  s.fp += g.size - tpN;
  s.fn += t.size - tpN;
  if (tpN === t.size && g.size === t.size) s.exact++;
  const pcTp = [...gp].filter((n) => tp.has(n)).length;
  s.pcTp += pcTp;
  s.pcFp += gp.size - pcTp;
  s.pcFn += tp.size - pcTp;
  if (pcTp === tp.size && gp.size === tp.size) s.pcExact++;
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(6);
const f1 = (tp: number, fp: number, fn: number) => (2 * tp) / (2 * tp + fp + fn || 1);

it('chord recognition on real piano', () => {
  const rows: string[] = [];
  const conditions = CONDITIONS.filter((c) => c.name.includes(process.env.COND ?? ''));
  for (const [name, detect] of Object.entries(detectors)) for (const cond of conditions) {
    const byCat = new Map<string, Score>();
    const total = blank();
    const misses: string[] = [];
    // Why pitch classes went wrong: extra ones by how they sit above a played note, and missed ones.
    const why = new Map<string, number>();
    const tally = (k: string) => why.set(k, (why.get(k) ?? 0) + 1);
    const t0 = performance.now();
    let count = 0;
    for (const c of recognitionRenders(cond)) {
      count++;
      const got = detect(c.audio, SR);
      if (!byCat.has(c.category)) byCat.set(c.category, blank());
      add(byCat.get(c.category)!, c.notes, got);
      add(total, c.notes, got);
      const truePcs = new Set(c.notes.map((n) => n % 12));
      for (const g of got) {
        if (truePcs.has(g % 12)) continue;
        const above = c.notes.map((n) => g - n).filter((d) => d > 0);
        const kind =
          above.find((d) => [19, 31].includes(d)) !== undefined ? 'extra: 3rd/6th partial (a 5th)'
          : above.find((d) => [28, 40].includes(d)) !== undefined ? 'extra: 5th partial (a 3rd)'
          : above.includes(34) ? 'extra: 7th partial (a ♭7)'
          : c.previous?.some((p) => p % 12 === g % 12) ? 'extra: from previous chord'
          : 'extra: other';
        tally(kind + (c.previous ? ' [prev]' : ''));
      }
      const gotPcs = new Set(got.map((n) => n % 12));
      for (const pc of truePcs)
        if (!gotPcs.has(pc)) {
          // Is every played note of this pitch class sitting on a lower played note's partial?
          const hidden = c.notes
            .filter((n) => n % 12 === pc)
            .every((n) => c.notes.some((m) => m < n && [12, 19, 24, 28, 31, 34, 36].includes(n - m)));
          tally(`missed: ${hidden ? 'on a lower note\'s partial' : 'in the clear'}${c.previous ? ' [prev]' : ''}`);
        }
      if (misses.length < 40 && got.join() !== c.notes.join() && (!process.env.CAT || c.category === process.env.CAT))
        misses.push(`  ${c.category}: played ${c.notes.join(' ')} heard ${got.join(' ')}${c.previous ? ' (prev ringing)' : ''}`);
    }
    const ms = (performance.now() - t0) / count;
    rows.push(`\n== ${name} · ${cond.name}  (${count} chords, ${ms.toFixed(1)} ms/chord incl. rendering)`);
    rows.push(`${'category'.padEnd(32)} exact  pc-exact  note-F1  pc-F1`);
    for (const [cat, s] of [...byCat, ['TOTAL', total] as const])
      rows.push(
        `${cat.padEnd(32)}${pct(s.exact / s.chords)}  ${pct(s.pcExact / s.chords)}   ${pct(f1(s.tp, s.fp, s.fn))} ${pct(f1(s.pcTp, s.pcFp, s.pcFn))}`,
      );
    rows.push('pitch-class errors:', ...[...why].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${String(n).padStart(4)}  ${k}`));
    if (process.env.MISSES) rows.push('first misses:', ...misses);
  }
  console.log(rows.join('\n'));
}, 600_000);
