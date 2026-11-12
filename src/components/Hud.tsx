import { useCollapsi, selectMovesLeft, selectCanConfirm, stepsOf } from '../game/store';
import { btn } from './ui';

type Tone = 'blue' | 'red';

const TONE: Record<Tone, { solid: string; ring: string; text: string; label: string }> = {
  blue: { solid: 'bg-blue-600', ring: 'ring-blue-300', text: 'text-blue-400', label: 'Azul' },
  red: { solid: 'bg-red-600', ring: 'ring-red-300', text: 'text-red-400', label: 'Rojo' },
};

/** Puntos (partidas ganadas) de un jugador; resaltado si es su turno. */
function ScoreBadge({ tone, score, active }: { tone: Tone; score: number; active: boolean }) {
  const t = TONE[tone];
  return (
    <div
      className={`min-w-16 rounded-xl px-4 py-2 text-center transition ${t.solid} ${
        active ? `ring-2 ${t.ring}` : 'opacity-70'
      }`}
    >
      <div className="text-xs uppercase tracking-wide opacity-80">{t.label}</div>
      <div className="text-2xl font-bold leading-none">{score}</div>
    </div>
  );
}

/** Puntos que se van apagando a medida que el jugador usa sus movimientos. */
function MovesCounter({ total, left }: { total: number; left: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-slate-800/90 px-3 py-1.5">
      <span className="text-sm">Movimientos</span>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full transition ${i < left ? 'bg-white' : 'bg-white/20'}`}
          />
        ))}
      </div>
      <span className="w-4 text-center text-sm font-bold">{left}</span>
    </div>
  );
}

export default function Hud() {
  const game = useCollapsi((s) => s.game);
  const score = useCollapsi((s) => s.score);
  const mode = useCollapsi((s) => s.mode);
  const aiThinking = useCollapsi((s) => s.aiThinking);
  const path = useCollapsi((s) => s.path);
  const total = useCollapsi((s) => stepsOf(s.game));
  const movesLeft = useCollapsi(selectMovesLeft);
  const canConfirm = useCollapsi(selectCanConfirm);
  const undo = useCollapsi((s) => s.undo);
  const confirm = useCollapsi((s) => s.confirm);
  const nextRound = useCollapsi((s) => s.nextRound);
  const backToMenu = useCollapsi((s) => s.backToMenu);

  const over = game.winner !== null;
  const turnTone: Tone = game.turn === 0 ? 'blue' : 'red';
  const aiTurn = mode === 'ai' && game.turn === 1;
  const locked = over || aiTurn || aiThinking;

  const hint = over
    ? ''
    : aiTurn || aiThinking
      ? 'La IA está pensando…'
      : canConfirm
        ? 'Pulsa Confirmar para mover'
        : 'Toca la siguiente casilla';

  return (
    <>
      {/* Superior: puntos, turno y movimientos */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <ScoreBadge tone="blue" score={score[0]} active={!over && game.turn === 0} />

        <div className="flex flex-col items-center gap-2">
          <div className={`rounded-full px-4 py-1 text-sm font-semibold ${TONE[turnTone].solid}`}>
            {over ? 'Fin de la partida' : `Turno: ${TONE[turnTone].label}`}
          </div>
          {!over && <MovesCounter total={total} left={movesLeft} />}
        </div>

        <ScoreBadge tone="red" score={score[1]} active={!over && game.turn === 1} />
      </div>

      {/* Inferior: ayuda y controles */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4">
        <p className="h-5 text-sm text-slate-300">{hint}</p>
        <div className="flex items-center justify-center gap-3">
          <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={backToMenu}>
            Menú
          </button>
          <button
            className={`${btn} bg-amber-600 hover:bg-amber-500`}
            disabled={locked || path.length === 0}
            onClick={undo}
          >
            Deshacer
          </button>
          <button
            className={`${btn} bg-green-600 hover:bg-green-500`}
            disabled={locked || !canConfirm}
            onClick={confirm}
          >
            Confirmar
          </button>
        </div>
      </div>

      {/* Fin de partida */}
      {over && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-slate-800 p-6 text-center shadow-xl">
            <h2
              className={`mb-1 text-2xl font-extrabold ${
                TONE[game.winner === 0 ? 'blue' : 'red'].text
              }`}
            >
              ¡Ganó {TONE[game.winner === 0 ? 'blue' : 'red'].label}!
            </h2>
            <p className="mb-1 text-sm text-slate-400">
              {TONE[turnTone].label} se quedó sin movimientos.
            </p>
            <p className="mb-5 text-sm font-semibold">
              <span className="text-blue-400">{score[0]}</span>
              <span className="mx-2 text-slate-500">-</span>
              <span className="text-red-400">{score[1]}</span>
            </p>
            <div className="flex flex-col gap-3">
              <button className={`${btn} bg-green-600 hover:bg-green-500`} onClick={nextRound}>
                Siguiente partida
              </button>
              <button className={`${btn} bg-slate-700 hover:bg-slate-600`} onClick={backToMenu}>
                Menú
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
