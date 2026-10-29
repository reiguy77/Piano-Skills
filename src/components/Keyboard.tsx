const LOW = 48; // C3
const HIGH = 83; // B5
const BLACK = new Set([1, 3, 6, 8, 10]);

export function Keyboard({ held }: { held: number[] }) {
  const whites: number[] = [];
  for (let n = LOW; n <= HIGH; n++) if (!BLACK.has(n % 12)) whites.push(n);
  const keyWidth = 100 / whites.length;

  return (
    <div className="keyboard" aria-label="Notes you are holding">
      {whites.map((n) => (
        <div key={n} className={held.includes(n) ? 'white on' : 'white'}>
          {n % 12 === 0 && <span>C{n / 12 - 1}</span>}
        </div>
      ))}
      {whites.map((n, i) =>
        BLACK.has((n + 1) % 12) && n + 1 <= HIGH ? (
          <div
            key={n + 1}
            className={held.includes(n + 1) ? 'black on' : 'black'}
            style={{ left: `${(i + 1) * keyWidth - keyWidth * 0.3}%`, width: `${keyWidth * 0.6}%` }}
          />
        ) : null,
      )}
    </div>
  );
}
