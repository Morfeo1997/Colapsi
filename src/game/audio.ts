import { useSyncExternalStore } from 'react';

// Los archivos van en `public/audio/` (se sirven como /audio/...).
// Ajusta aquí los nombres y extensiones reales de tus archivos.
const BASE = '/audio/';

export type SfxGroup = 'break' | 'win';

interface GroupConfig {
  files: string[]; // varias opciones por acción: se alterna entre ellas
  volume: number; // 0..1
  rate: [number, number]; // rango de velocidad/tono aleatorio (1 = original)
}

export const SFX: Record<SfxGroup, GroupConfig> = {
  break: { files: ['break-1.wav', 'break-2.wav'], volume: 0.8, rate: [0.92, 1.08] },
  win: { files: ['win-1.mp3', 'win-2.mp3'], volume: 0.9, rate: [1, 1] },
};

const MUSIC = { file: 'music.mp3', volume: 0.3 };
const STORAGE_KEY = 'collapsi-muted';

// ---------- Silencio (persistente y reactivo) ----------

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readMuted();
const listeners = new Set<() => void>();

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* sin almacenamiento: se ignora */
  }
  if (music) music.muted = muted;
  listeners.forEach((l) => l());
}

/** Hook para que la UI (botón de sonido) se actualice al cambiar el silencio. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => muted,
  );
}

// ---------- Efectos de sonido ----------

const cache = new Map<string, HTMLAudioElement>();

function load(file: string): HTMLAudioElement {
  let a = cache.get(file);
  if (!a) {
    a = new Audio(BASE + file);
    a.preload = 'auto';
    cache.set(file, a);
  }
  return a;
}

// Precarga para que el primer sonido no tenga retraso.
Object.values(SFX).forEach((g) => g.files.forEach(load));

const lastPicked: Partial<Record<SfxGroup, number>> = {};

/** Elige una variante al azar evitando repetir la anterior. */
function pickIndex(group: SfxGroup, n: number): number {
  if (n <= 1) return 0;
  const last = lastPicked[group];
  let i = Math.floor(Math.random() * (last === undefined ? n : n - 1));
  if (last !== undefined && i >= last) i += 1;
  return i;
}

interface PlayOptions {
  /** Fuerza una variante concreta (por ejemplo, una por jugador). */
  index?: number;
  /** Retraso antes de sonar, en milisegundos. */
  delayMs?: number;
}

export function playSfx(group: SfxGroup, opts: PlayOptions = {}) {
  const run = () => {
    if (muted) return;
    const cfg = SFX[group];
    const i = (opts.index ?? pickIndex(group, cfg.files.length)) % cfg.files.length;
    lastPicked[group] = i;

    // Se clona para permitir sonidos solapados.
    const a = load(cfg.files[i]).cloneNode() as HTMLAudioElement;
    a.volume = cfg.volume;
    a.preservesPitch = false; // la variación de velocidad también cambia el tono
    a.playbackRate = cfg.rate[0] + Math.random() * (cfg.rate[1] - cfg.rate[0]);
    void a.play().catch(() => {
      /* el navegador puede bloquear el audio antes del primer gesto del usuario */
    });
  };
  if (opts.delayMs) setTimeout(run, opts.delayMs);
  else run();
}

// ---------- Música de fondo ----------

let music: HTMLAudioElement | null = null;

export function playMusic() {
  if (!music) {
    music = new Audio(BASE + MUSIC.file);
    music.loop = true;
    music.volume = MUSIC.volume;
  }
  music.muted = muted;
  void music.play().catch(() => {});
}

export function stopMusic() {
  if (!music) return;
  music.pause();
  music.currentTime = 0;
}
