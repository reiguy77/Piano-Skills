import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from './components/Keyboard';
import { MeasureStrip } from './components/MeasureStrip';
import { changes, findSkill, KEYS, SKILLS } from './drills/library';
import { startMetronome } from './midi/metronome';
import { useMic } from './mic/useMic';
import { useMidi, type Strike } from './midi/useMidi';
import { gradeVoicing, noteName, type VoicingGrade } from './theory/chords';
import { beatMs, gradeTiming, type TimingGrade } from './theory/timing';

const BEATS_PER_BAR = 4;
const SWING = 2;

interface ChordResult {
  voicing: VoicingGrade;
  timing: TimingGrade;
}

type Phase = 'setup' | 'running' | 'done';
type Input = 'midi' | 'mic';

// Remembered per browser; storage can be unavailable (private windows), so fall back quietly.
function stored<T extends string | number>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return (typeof fallback === 'number' ? Number(v) : v) as T;
  } catch {
    return fallback;
  }
}
function store(key: string, value: string | number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // not remembered this time
  }
}

export default function App() {
  const [skillId, setSkillId] = useState(() => findSkill(stored('skill', SKILLS[0].id)).id);
  const [key, setKey] = useState(() => {
    const k = stored<number>('key', 0);
    return Number.isInteger(k) && k >= 0 && k < 12 ? k : 0;
  });
  const skill = findSkill(skillId);
  const bars = useMemo(() => skill.bars(key), [skill, key]);
  const chords = useMemo(() => changes(bars, BEATS_PER_BAR), [bars]);
  const [bpm, setBpm] = useState(120);
  const [input, setInput] = useState<Input>(() => stored<Input>('input', 'midi'));
  const [micLatency, setMicLatency] = useState(() => stored<number>('micLatencyMs', 40));
  const [phase, setPhase] = useState<Phase>('setup');
  // Beats since the first downbeat; the count-in is -BEATS_PER_BAR…-1.
  const [beat, setBeat] = useState(-BEATS_PER_BAR);
  const [results, setResults] = useState<Record<number, ChordResult>>({});
  const run = useRef<{ downbeatMs: number; stop: () => void } | null>(null);

  const barIndex = Math.floor(beat / BEATS_PER_BAR);
  const chordIndex = chords.findLastIndex((c) => c.beat <= beat);

  const onStrike = (s: Strike) => {
    if (phase !== 'running' || !run.current) return;
    // Take the nearest chord change, so an anticipated chord is graded against the one it leads into.
    const at = (s.atMs - run.current.downbeatMs) / beatMs(bpm);
    const target = chords.reduce((best, c, i) => (Math.abs(c.beat - at) < Math.abs(chords[best].beat - at) ? i : best), 0);
    if (at < -1 || at > bars.length * BEATS_PER_BAR) return;
    const result = {
      voicing: gradeVoicing(chords[target].chord, s.notes),
      timing: gradeTiming(s.atMs, run.current.downbeatMs + chords[target].beat * beatMs(bpm), bpm, SWING),
    };
    // First strike per chord counts.
    setResults((r) => (r[target] ? r : { ...r, [target]: result }));
  };

  const midi = useMidi(onStrike);
  const mic = useMic(input === 'mic', onStrike, micLatency);
  const held = [...new Set([...midi.held, ...mic.held])].sort((a, b) => a - b);
  const { status, deviceName } = midi;

  const chooseInput = (i: Input) => {
    setInput(i);
    store('input', i);
  };

  const chooseSkill = (id: string) => {
    setSkillId(id);
    store('skill', id);
  };

  const chooseKey = (k: number) => {
    setKey(k);
    store('key', k);
  };

  useEffect(() => {
    if (phase !== 'running') return;
    let frame = 0;
    const tick = () => {
      const r = run.current!;
      const b = Math.floor((performance.now() - r.downbeatMs) / beatMs(bpm));
      if (b >= bars.length * BEATS_PER_BAR) {
        r.stop();
        setPhase('done');
        return;
      }
      setBeat(Math.max(b, -BEATS_PER_BAR));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, bpm, bars.length]);

  useEffect(() => () => run.current?.stop(), []);

  const start = () => {
    setResults({});
    setBeat(-BEATS_PER_BAR);
    run.current = startMetronome(bpm, bars.length * BEATS_PER_BAR, BEATS_PER_BAR, SWING);
    setPhase('running');
  };

  const stop = () => {
    run.current?.stop();
    setPhase('done');
  };

  const graded = Object.values(results);
  const clean = graded.filter((r) => r.voicing.correct && r.timing.onTime).length;
  const last = results[chordIndex] ?? results[chordIndex - 1];

  return (
    <main>
      <header>
        <h1>{skill.title(key)}</h1>
        <div className="segmented" role="group" aria-label="Input">
          <button type="button" aria-pressed={input === 'midi'} onClick={() => chooseInput('midi')}>
            MIDI keyboard
          </button>
          <button type="button" aria-pressed={input === 'mic'} onClick={() => chooseInput('mic')}>
            Microphone
          </button>
        </div>
        {input === 'mic' ? (
          <MicStatusLine status={mic.status} level={mic.level} />
        ) : (
          <p className="muted">
            {status === 'ready' && `MIDI: ${deviceName}`}
            {status === 'no-device' && 'No MIDI device found. Plug one in, or use the A–L keys on your computer keyboard.'}
            {status === 'unsupported' && 'This browser has no Web MIDI (try Chrome or Edge). Computer keys A–L still work.'}
            {status === 'connecting' && 'Looking for MIDI devices…'}
          </p>
        )}
      </header>

      {phase === 'setup' && (
        <section className="card">
          <fieldset className="skills">
            <legend>Skill</legend>
            {SKILLS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="skill"
                aria-pressed={s.id === skill.id}
                onClick={() => chooseSkill(s.id)}
              >
                <strong>{s.name}</strong>
                <span>{s.description}</span>
              </button>
            ))}
          </fieldset>
          {skill.needsKey && (
            <fieldset className="keys">
              <legend>{skill.keyLabel ?? 'Key'}</legend>
              {KEYS.map((k) => (
                <button key={k.pc} type="button" aria-pressed={k.pc === key} onClick={() => chooseKey(k.pc)}>
                  {k.label}
                </button>
              ))}
            </fieldset>
          )}
          <p>
            Play a shell for each chord, landing on its beat (or a swung eighth early). The 3rd and 7th are
            required (the 6th on a 6 chord, the 4th on a sus); root, 5, 9 and 13 are optional.
          </p>
          <label htmlFor="bpm">Tempo: {bpm} BPM</label>
          <input id="bpm" type="range" min={60} max={240} value={bpm} onChange={(e) => setBpm(+e.target.value)} />
          {input === 'mic' && (
            <>
              <label htmlFor="latency">Mic delay correction: {micLatency} ms</label>
              <input
                id="latency"
                type="range"
                min={0}
                max={200}
                step={5}
                value={micLatency}
                onChange={(e) => {
                  setMicLatency(+e.target.value);
                  store('micLatencyMs', +e.target.value);
                }}
              />
              <p className="muted">
                Wear headphones so the mic hears the piano, not the click. If chords you play on the beat keep
                showing as late, raise the delay correction by about that much.
              </p>
            </>
          )}
          <button type="button" className="primary" onClick={start}>
            Start drill
          </button>
        </section>
      )}

      {phase === 'running' && (
        <section className="card prompt">
          <p className="muted">
            {barIndex < 0 ? `Count-in · key of ${bars[0].key}` : `Key of ${bars[barIndex].key} · bar ${barIndex + 1} of ${bars.length}`}
          </p>
          <MeasureStrip bars={bars} beat={beat} beatsPerBar={BEATS_PER_BAR} />
          {last && <Feedback result={last} />}
          <button type="button" onClick={stop}>
            Stop
          </button>
        </section>
      )}

      {phase === 'done' && (
        <section className="card">
          <h2>
            {clean} / {chords.length} chords clean
          </h2>
          <p className="muted">
            Average timing:{' '}
            {graded.length
              ? `${Math.round(graded.reduce((a, r) => a + Math.abs(r.timing.offsetMs), 0) / graded.length)} ms`
              : 'n/a'}
          </p>
          <ul className="results">
            {chords.map((c, i) => (
              <li key={i} className={results[i]?.voicing.correct && results[i]?.timing.onTime ? 'ok' : 'miss'}>
                <span>{c.chord.symbol}</span>
                <span>{results[i] ? describe(results[i]) : 'not played'}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="primary" onClick={start}>
            Go again
          </button>
        </section>
      )}

      <p className="muted">Holding: {held.map(noteName).join(' ') || 'nothing'}</p>
      <Keyboard held={held} />
    </main>
  );
}

function MicStatusLine({ status, level }: { status: ReturnType<typeof useMic>['status']; level: number }) {
  // Show the input level on a -60…0 dBFS scale.
  const pct = Math.max(0, Math.min(100, ((20 * Math.log10(level + 1e-9) + 60) / 60) * 100));
  return (
    <div className="mic-status">
      <p className="muted">
        {status === 'listening' && 'Listening. Play a chord to check the notes it hears.'}
        {status === 'starting' && 'Starting the microphone…'}
        {status === 'denied' && 'Microphone access was blocked. Allow it in the address bar, then pick Microphone again.'}
        {status === 'unsupported' && 'This browser can’t use the microphone here.'}
        {status === 'off' && 'Microphone off.'}
      </p>
      {status === 'listening' && (
        <div className="meter" aria-label="Microphone level">
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Feedback({ result }: { result: ChordResult }) {
  return <p className={result.voicing.correct && result.timing.onTime ? 'ok' : 'miss'}>{describe(result)}</p>;
}

function describe({ voicing, timing }: ChordResult) {
  const notes = voicing.correct
    ? `${voicing.heard.join(' + ')}`
    : [voicing.missing.length && `missing ${voicing.missing.join(', ')}`, voicing.wrong.length && `wrong ${voicing.wrong.join(', ')}`]
        .filter(Boolean)
        .join(' · ');
  const ms = Math.round(timing.offsetMs);
  const when = `${timing.anticipated ? 'anticipated, ' : ''}${ms >= 0 ? '+' : ''}${ms} ms`;
  return `${notes} · ${when}`;
}
