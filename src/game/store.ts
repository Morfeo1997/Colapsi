import { create } from 'zustand';
import {
  type GameState,
  type PlayerId,
  createGame,
  legalPaths,
  nextStepOptions,
  applyMove,
  aiChoosePath,
} from './engine';

export type Screen = 'menu' | 'rules' | 'game';
export type Mode = 'ai' | 'pvp';
export type Difficulty = 'easy' | 'normal' | 'hard';

const AI_PLAYER: PlayerId = 1; // la IA juega con el rojo
const AI_DELAY_MS = 700;
const AI_DEPTH: Record<Difficulty, number> = { easy: 1, normal: 3, hard: 6 };
const AI_RANDOM_CHANCE: Record<Difficulty, number> = { easy: 0.3, normal: 0, hard: 0 };

/** Pasos que debe dar el jugador en turno (valor de su casilla actual). */
export const stepsOf = (g: GameState): number => g.tiles[g.players[g.turn]] ?? 0;

interface LastMove {
  player: PlayerId;
  path: number[];
}

interface Illegal {
  tile: number;
  id: number; // cambia en cada toque ilegal para re-disparar el estallido rojo
}

interface CollapsiStore {
  // Navegación
  screen: Screen;
  mode: Mode;
  difficulty: Difficulty;

  // Partida
  game: GameState;
  path: number[]; // recorrido parcial del turno actual (casillas marcadas en verde)
  score: [number, number]; // partidas ganadas [azul, rojo]
  round: number;
  aiThinking: boolean;
  matchId: number; // invalida timeouts de la IA al salir o reiniciar

  // Efectos visuales para la escena
  lastMove: LastMove | null; // para animar la ficha
  lastIllegal: Illegal | null; // para el estallido rojo

  // Acciones
  goTo: (screen: Screen) => void;
  startGame: (mode: Mode, difficulty?: Difficulty) => void;
  tapTile: (tile: number) => void;
  undo: () => void;
  confirm: () => void;
  nextRound: () => void;
  backToMenu: () => void;
}

export const useCollapsi = create<CollapsiStore>((set, get) => {
  const isAiTurn = () => {
    const { mode, game } = get();
    return mode === 'ai' && game.turn === AI_PLAYER;
  };

  const scheduleAi = () => {
    if (!isAiTurn() || get().game.winner !== null) return;
    const token = get().matchId;
    set({ aiThinking: true });
    setTimeout(() => {
      const s = get();
      if (s.matchId !== token || s.game.winner !== null) return;

      let aiPath: number[];
      if (Math.random() < AI_RANDOM_CHANCE[s.difficulty]) {
        const all = legalPaths(s.game);
        aiPath = all[Math.floor(Math.random() * all.length)];
      } else {
        aiPath = aiChoosePath(s.game, AI_DEPTH[s.difficulty]);
      }
      set({ aiThinking: false });
      commitMove(aiPath);
    }, AI_DELAY_MS);
  };

  const commitMove = (movePath: number[]) => {
    const { game, score } = get();
    const mover = game.turn;
    const next = applyMove(game, movePath);
    const newScore: [number, number] = [...score];
    if (next.winner !== null) newScore[next.winner] += 1;

    set({
      game: next,
      path: [],
      score: newScore,
      lastMove: { player: mover, path: movePath },
      lastIllegal: null,
    });
    if (next.winner === null) scheduleAi();
  };

  const newRound = (round: number) => {
    const first = (round % 2) as PlayerId; // alterna quién empieza cada partida
    set((s) => ({
      game: { ...createGame(), turn: first },
      path: [],
      round,
      aiThinking: false,
      matchId: s.matchId + 1,
      lastMove: null,
      lastIllegal: null,
    }));
    scheduleAi();
  };

  return {
    screen: 'menu',
    mode: 'pvp',
    difficulty: 'normal',
    game: createGame(),
    path: [],
    score: [0, 0],
    round: 0,
    aiThinking: false,
    matchId: 0,
    lastMove: null,
    lastIllegal: null,

    goTo: (screen) => set({ screen }),

    startGame: (mode, difficulty = get().difficulty) => {
      set({ mode, difficulty, screen: 'game', score: [0, 0] });
      newRound(0);
    },

    tapTile: (tile) => {
      const { game, path, aiThinking } = get();
      if (game.winner !== null || aiThinking || isAiTurn()) return;

      // Casillas válidas como siguiente paso (ya excluye destruidas, rival y repetidas).
      if (nextStepOptions(game, path).includes(tile)) {
        set({ path: [...path, tile], lastIllegal: null });
      } else {
        // Retroceso, casilla destruida, zona ilegal o recorrido ya completo.
        set({ lastIllegal: { tile, id: (get().lastIllegal?.id ?? 0) + 1 } });
      }
    },

    // Se puede deshacer hasta confirmar, incluso con todos los pasos usados.
    undo: () => {
      const { game, path, aiThinking } = get();
      if (game.winner !== null || aiThinking || isAiTurn() || path.length === 0) return;
      set({ path: path.slice(0, -1), lastIllegal: null });
    },

    confirm: () => {
      const { game, path, aiThinking } = get();
      if (game.winner !== null || aiThinking || isAiTurn()) return;
      if (path.length === 0 || path.length !== stepsOf(game)) return;
      commitMove(path);
    },

    nextRound: () => {
      if (get().game.winner === null) return;
      newRound(get().round + 1);
    },

    backToMenu: () =>
      set((s) => ({
        screen: 'menu',
        aiThinking: false,
        matchId: s.matchId + 1,
        path: [],
      })),
  };
});

// ---------- Selectores para el HUD ----------

export const selectMovesLeft = (s: CollapsiStore): number =>
  Math.max(0, stepsOf(s.game) - s.path.length);

export const selectCanConfirm = (s: CollapsiStore): boolean =>
  s.game.winner === null && s.path.length > 0 && s.path.length === stepsOf(s.game);
