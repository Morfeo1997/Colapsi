// Motor de reglas de Collapsi: TypeScript puro, sin React ni Three.js.
// Tablero 4x4, índices 0..15 (fila = floor(i / 4), columna = i % 4).

export const N = 4;
export type Cell = number | null; // null = casilla destruida
export type PlayerId = 0 | 1; // 0 = azul, 1 = rojo

export interface GameState {
  tiles: Cell[];
  players: [number, number]; // índice de casilla de cada jugador
  turn: PlayerId;
  winner: PlayerId | null;
}

const idx = (r: number, c: number) => r * N + c;

/** Vecinos ortogonales con wrap tipo Pacman. */
export function neighbors(i: number): number[] {
  const r = Math.floor(i / N);
  const c = i % N;
  return [
    idx((r + N - 1) % N, c),
    idx((r + 1) % N, c),
    idx(r, (c + N - 1) % N),
    idx(r, (c + 1) % N),
  ];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGame(): GameState {
  const values = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4];
  const tiles = shuffle(values);
  // Los jugadores empiezan sobre 2 casillas de valor 1 elegidas al azar.
  const ones = shuffle(tiles.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0));
  return { tiles, players: [ones[0], ones[1]], turn: 0, winner: null };
}

/**
 * Todos los recorridos legales del jugador en turno.
 * Cada recorrido son exactamente `valor` pasos (sin incluir la casilla inicial).
 */
export function legalPaths(s: GameState, p: PlayerId = s.turn): number[][] {
  const start = s.players[p];
  const steps = s.tiles[start] ?? 0;
  const rival = s.players[p === 0 ? 1 : 0];
  const result: number[][] = [];

  const dfs = (path: number[], visited: Set<number>) => {
    if (path.length === steps) {
      result.push([...path]);
      return;
    }
    const cur = path.length ? path[path.length - 1] : start;
    for (const n of neighbors(cur)) {
      if (visited.has(n) || s.tiles[n] === null || n === rival) continue;
      visited.add(n);
      path.push(n);
      dfs(path, visited);
      path.pop();
      visited.delete(n);
    }
  };

  dfs([], new Set([start]));
  return result;
}

/** Casillas a las que se puede ir como siguiente paso, dado el recorrido parcial (para pintar verde/rojo al tocar). */
export function nextStepOptions(s: GameState, partial: number[]): number[] {
  return [...new Set(legalPaths(s).filter((p) => partial.every((v, i) => p[i] === v) && p.length > partial.length).map((p) => p[partial.length]))];
}

export function applyMove(s: GameState, path: number[]): GameState {
  const p = s.turn;
  const tiles = [...s.tiles];
  tiles[s.players[p]] = null; // se destruye la casilla donde empezó el turno
  const players: [number, number] = [...s.players];
  players[p] = path[path.length - 1];
  const next: PlayerId = p === 0 ? 1 : 0;
  const state: GameState = { tiles, players, turn: next, winner: null };
  // Pierde el primer jugador que se queda sin movimientos al empezar su turno.
  if (legalPaths(state, next).length === 0) state.winner = p;
  return state;
}

// ---------- IA (negamax con poda alfa-beta) ----------

function evaluate(s: GameState, me: PlayerId): number {
  const opp: PlayerId = me === 0 ? 1 : 0;
  return legalPaths(s, me).length - legalPaths(s, opp).length;
}

function negamax(s: GameState, depth: number, alpha: number, beta: number, me: PlayerId): number {
  if (s.winner !== null) return s.winner === s.turn ? 1000 : -1000;
  if (depth === 0) return evaluate(s, s.turn);
  let best = -Infinity;
  for (const path of legalPaths(s)) {
    const score = -negamax(applyMove(s, path), depth - 1, -beta, -alpha, me);
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

export function aiChoosePath(s: GameState, depth = 5): number[] {
  let bestPath: number[] = [];
  let bestScore = -Infinity;
  for (const path of shuffle(legalPaths(s))) {
    const score = -negamax(applyMove(s, path), depth - 1, -Infinity, Infinity, s.turn);
    if (score > bestScore) {
      bestScore = score;
      bestPath = path;
    }
  }
  return bestPath;
}
