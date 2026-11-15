import { N } from '../../game/engine';

export const SPACING = 1.15; // distancia entre centros de casillas
export const TILE_H = 0.3; // grosor de las casillas
export const PAWN_Y = TILE_H / 2; // los pingüinos apoyan los pies sobre la superficie de la casilla

export const COLORS = {
  blue: '#3b82f6',
  red: '#ef4444',
  path: '#86efac', // casilla marcada en el recorrido
  pathGlow: '#22c55e',
  bg: '#0f172a',
  water: '#0c4a6e',
  // Hielo: más intenso (cyan más profundo) cuanto mayor es el valor de la casilla.
  ice: { 1: '#cffafe', 2: '#a5f3fc', 3: '#67e8f9', 4: '#22d3ee' } as Record<number, string>,
  iceGlow: '#0891b2',
  iceCloud: '#ecfeff',
  iceText: '#083344',
  iceTextOutline: '#ecfeff',
};

/** Posición 3D del centro de la casilla `i` (el tablero queda centrado en el origen). */
export const tilePos = (i: number): [number, number, number] => [
  ((i % N) - (N - 1) / 2) * SPACING,
  0,
  (Math.floor(i / N) - (N - 1) / 2) * SPACING,
];
