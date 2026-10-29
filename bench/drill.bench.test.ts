// What the user feels: does the ii–V–I drill grade a voicing the way it should when it hears it
// through the mic? Plays every bar of the drill on real piano with common jazz voicings, plus a
// wrong version of each.
import { it } from 'vitest';
import { gradeVoicing } from '../src/theory/chords';
import { drillRenders } from './cases';
import { detectors } from './detectors';
import { CONDITIONS, SR } from './piano';

it('drill grading through the mic', () => {
  const rows: string[] = [];
  for (const [name, detect] of Object.entries(detectors))
    for (const cond of CONDITIONS) {
      const byVoicing = new Map<string, { right: number; falseFail: number; wrong: number; falsePass: number }>();
      const examples: string[] = [];
      for (const r of drillRenders(cond)) {
        const s = byVoicing.get(r.voicing) ?? { right: 0, falseFail: 0, wrong: 0, falsePass: 0 };
        byVoicing.set(r.voicing, s);
        const heard = detect(r.audio, SR);
        const correct = gradeVoicing(r.chord, heard).correct;
        if (r.wrong) {
          s.wrong++;
          if (correct) s.falsePass++;
        } else {
          s.right++;
          if (!correct) {
            s.falseFail++;
            if (examples.length < 12)
              examples.push(`  ${r.chord.symbol} ${r.voicing}: played ${r.notes.join(' ')} heard ${heard.join(' ')}`);
          }
        }
      }
      rows.push(`\n== ${name} · ${cond.name}`, `${'voicing'.padEnd(14)} false-fail  false-pass`);
      const t = { right: 0, falseFail: 0, wrong: 0, falsePass: 0 };
      for (const [v, s] of byVoicing) {
        rows.push(`${v.padEnd(14)} ${String(s.falseFail).padStart(3)}/${s.right}     ${String(s.falsePass).padStart(3)}/${s.wrong}`);
        for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += s[k];
      }
      rows.push(
        `${'TOTAL'.padEnd(14)} ${((100 * t.falseFail) / t.right).toFixed(1).padStart(5)}%     ${((100 * t.falsePass) / t.wrong).toFixed(1).padStart(5)}%`,
      );
      if (process.env.MISSES) rows.push(...examples);
    }
  console.log(rows.join('\n'));
}, 600_000);
