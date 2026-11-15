import { N } from '../../game/engine';

export const SPACING = 1.15; // distancia entre centros de casillas
export const TILE_H = 0.3; // grosor de las casillas
export const PAWN_Y = TILE_H / 2; // los pingüinos apoyan los pies sobre la superficie de la casilla

export const COLORS = {
  blue: '#3b82f6',
  red: '#ef4444',
  path: '#4ade80',
  text: '#0f172a',
  bg: '#0f172a',
  byValue: { 1: '#f1f5f9', 2: '#e2e8f0', 3: '#cbd5e1', 4: '#94a3b8' } as Record<number, string>,
};

/** Posición 3D del centro de la casilla `i` (el tablero queda centrado en el origen). */
export const tilePos = (i: number): [number, number, number] => [
  ((i % N) - (N - 1) / 2) * SPACING,
  0,
  (Math.floor(i / N) - (N - 1) / 2) * SPACING,
];
