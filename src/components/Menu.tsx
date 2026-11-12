import { useEffect, useState } from 'react';
import { useCollapsi, type Difficulty } from '../game/store';
import { btn } from './ui';

// Decoración: mini tablero 4x4 con las dos casillas de jugador resaltadas.
const DECOR = [1, 3, 2, 1, 4, 1, 3, 2, 2, 3, 1, 4, 1, 2, 3, 1];
const BLUE_AT = 5;
const RED_AT = 10;

function DecorBoard() {
  return (
    <div className="mb-8 grid grid-cols-4 gap-1.5" aria-hidden>
      {DECOR.map((v, i) => {
        const tone =
          i === BLUE_AT ? 'bg-blue-500 text-white' : i === RED_AT ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400';
        return (
          <div
            key={i}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${tone}`}
          >
            {v}
          </div>
        );
      })}
    </div>
  );
}

const LEVELS: { id: Difficulty; label: string; desc: string }[] = [
  { id: 'easy', label: 'Fácil', desc: 'La IA se equivoca a propósito.' },
  { id: 'normal', label: 'Normal', desc: 'Piensa unos turnos por delante.' },
  { id: 'hard', label: 'Difícil', desc: 'Analiza muchas jugadas. Cuesta ganarle.' },
];

function DifficultyModal({ onClose }: { onClose: () => void }) {
  const startGame = useCollapsi((s) => s.startGame);
  const current = useCollapsi((s) => s.difficulty);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Elegir dificultad"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-center text-xl font-bold">Elige la dificultad</h2>
        <p className="mb-4 text-center text-sm text-slate-400">Jugarás con el azul contra la IA roja.</p>
        <div className="flex flex-col gap-3">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              className={`${btn} bg-slate-700 text-left hover:bg-slate-600 ${
                l.id === current ? 'ring-2 ring-blue-400' : ''
              }`}
              onClick={() => startGame('ai', l.id)}
            >
              <span className="block">{l.label}</span>
              <span className="block text-xs font-normal text-slate-400">{l.desc}</span>
            </button>
          ))}
          <button className="mt-1 text-sm text-slate-400 hover:text-slate-200" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Menu() {
  const startGame = useCollapsi((s) => s.startGame);
  const goTo = useCollapsi((s) => s.goTo);
  const [pickingDifficulty, setPickingDifficulty] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <DecorBoard />
      <h1 className="mb-6 text-5xl font-extrabold tracking-tight">
        <span className="text-blue-500">Col</span>
        <span className="text-red-500">lapsi</span>
      </h1>

      <button
        className={`${btn} w-72 bg-blue-600 hover:bg-blue-500`}
        onClick={() => setPickingDifficulty(true)}
      >
        Jugador vs IA
      </button>
      <button className={`${btn} w-72 bg-red-600 hover:bg-red-500`} onClick={() => startGame('pvp')}>
        Jugador vs Jugador
      </button>
      <button className={`${btn} w-72 bg-slate-700 hover:bg-slate-600`} onClick={() => goTo('rules')}>
        Reglas
      </button>

      {pickingDifficulty && <DifficultyModal onClose={() => setPickingDifficulty(false)} />}
    </div>
  );
}
