import Board from './components/scene/Board';
import Hud from './components/Hud';
import Menu from './components/Menu';
import { btn } from './components/ui';
import { useCollapsi } from './game/store';

// ---------- Reglas ----------

function Rules() {
  const goTo = useCollapsi((s) => s.goTo);
  const rules = [
    'El tablero es de 4x4 casillas con valores 1 a 4, repartidas al azar (los jugadores también).',
    'En tu turno debes moverte exactamente el valor de la casilla donde empiezas el turno.',
    'Te mueves en ortogonal (arriba, abajo, izquierda, derecha) y puedes cambiar de dirección.',
    'No puedes repetir casillas en el mismo recorrido ni volver a la de inicio.',
    'Si sales por un borde, apareces en el lado opuesto (como Pacman).',
    'No puedes pasar por casillas destruidas ni por la casilla del otro jugador.',
    'Al terminar tu turno, la casilla donde empezaste se destruye.',
    'Pierde el primer jugador que se quede sin movimientos posibles.',
    'Toca las casillas una a una (se marcan en verde), y pulsa Confirmar. Puedes Deshacer antes de confirmar.',
  ];
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col gap-4 overflow-y-auto p-6">
      <h2 className="text-3xl font-bold">Reglas</h2>
      <ul className="list-disc space-y-2 pl-5 text-slate-300">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <button className={`${btn} mt-2 bg-slate-700 hover:bg-slate-600`} onClick={() => goTo('menu')}>
        Volver
      </button>
    </div>
  );
}

// ---------- App ----------

export default function App() {
  const screen = useCollapsi((s) => s.screen);

  return (
    <div className="h-dvh w-full bg-slate-900 text-slate-100">
      {screen === 'menu' && <Menu />}
      {screen === 'rules' && <Rules />}
      {screen === 'game' && (
        <div className="relative h-full w-full">
          <Board />
          <Hud />
        </div>
      )}
    </div>
  );
}
