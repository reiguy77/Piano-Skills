import type { Bar } from '../drills/library';

const SHOWN = 4;

/**
 * Lead-sheet style row: the current bar plus the next few, with beat dots for the current bar.
 * `beat` counts from the first downbeat, so the count-in is beats -4…-1.
 */
export function MeasureStrip({ bars, beat, beatsPerBar }: { bars: Bar[]; beat: number; beatsPerBar: number }) {
  const barIndex = Math.floor(beat / beatsPerBar);
  const countIn = barIndex < 0;
  const first = Math.max(barIndex, 0);
  const beatInBar = ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
  const lastBeat = beatInBar === beatsPerBar - 1;
  // The bar about to start: bar 0 during the count-in, otherwise the one after the current bar.
  const upcoming = countIn ? 0 : barIndex + 1;
  const shown = bars.slice(first, first + SHOWN);

  return (
    <div className="measures">
      <div className="beats" aria-label={`${countIn ? 'Count-in' : 'Beat'} ${beatInBar + 1} of ${beatsPerBar}`}>
        <span className="muted">{countIn ? 'Count-in' : 'Beat'}</span>
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span key={i} className={`dot${i <= beatInBar ? ' on' : ''}${i === beatInBar ? ' now' : ''}`} />
        ))}
      </div>
      <ol className="strip">
        {shown.map((bar, j) => {
          const i = first + j;
          const keyChange = i > 0 && bars[i - 1].key !== bar.key;
          const classes = [
            'measure',
            i === barIndex && 'current',
            i === upcoming && 'next',
            i === upcoming && lastBeat && 'ready',
            keyChange && 'key-change',
          ];
          return (
            <li key={i} className={classes.filter(Boolean).join(' ')} aria-current={i === barIndex ? 'step' : undefined}>
              <span className="measure-key">
                {keyChange ? `→ ${bar.key}` : j === 0 ? bar.key : ' '}
              </span>
              <span className="measure-chord">{bar.chord.symbol}</span>
              <span className="measure-tag">{i === barIndex ? 'now' : i === upcoming ? (lastBeat ? 'get ready' : 'next') : ' '}</span>
            </li>
          );
        })}
        {shown.length < SHOWN && <li className="measure end">end</li>}
      </ol>
    </div>
  );
}
