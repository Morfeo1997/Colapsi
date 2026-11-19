import { useEffect, useRef } from 'react';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import type { Cell } from '../../game/engine';
import { useCollapsi } from '../../game/store';
import { playSfx } from '../../game/audio';
import { COLORS, SPACING, TILE_H, tilePos } from './constants';

// ---------- Números en las esquinas ----------

const CORNER_OFFSET = 0.3;

/**
 * Esquinas vistas desde arriba (la cámara mira desde +Z, así que -Z es "arriba" en pantalla).
 * `rot` gira cada número dentro del plano de la casilla: 0°, 270°, 180° y 90°,
 * de modo que la parte superior de cada número apunta a un borde distinto (efecto molinete).
 */
const CORNERS = [
  { x: -1, z: -1, rot: 0 }, // arriba-izquierda: 0°
  { x: 1, z: -1, rot: -Math.PI / 2 }, // arriba-derecha: 270°
  { x: 1, z: 1, rot: Math.PI }, // abajo-derecha: 180°
  { x: -1, z: 1, rot: Math.PI / 2 }, // abajo-izquierda: 90°
];

// ---------- Fragmentos para la rotura (rejilla de 3x2) ----------

interface Shard {
  x: number;
  z: number;
  w: number;
  d: number;
}

const COLS: [number, number][] = [
  [-0.33, 0.34],
  [0, 0.32],
  [0.33, 0.34],
];
const ROWS: [number, number][] = [
  [-0.25, 0.5],
  [0.25, 0.5],
];
const SHARDS: Shard[] = ROWS.flatMap(([z, d]) => COLS.map(([x, w]) => ({ x, z, w, d })));

const DUST_COUNT = 10;

// ---------- Animaciones de rotura ----------

export type BreakStyle = 'crumble' | 'burst' | 'split' | 'cascade' | 'random';

const FALL_Y = -2.6;
const REST_OPACITY = 0.9;
const REST_GLOW = 0.18;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const matOf = (m: THREE.Mesh) => m.material as THREE.MeshPhysicalMaterial;

/** Dirección horizontal (aprox. unitaria) desde el centro de la casilla hacia el fragmento, con algo de azar. */
function outward(sh: Shard, jitter: number) {
  const len = Math.hypot(sh.x, sh.z) || 1;
  return {
    x: sh.x / len + rand(-jitter / 2, jitter / 2),
    z: sh.z / len + rand(-jitter / 2, jitter / 2),
  };
}

/** Destello inicial (el hielo "brilla" al agrietarse) y desvanecido final con ocultado. */
function flash(tl: gsap.core.Timeline, p: THREE.Mesh) {
  tl.fromTo(matOf(p), { emissiveIntensity: 1.4 }, { emissiveIntensity: REST_GLOW, duration: 0.3 }, 0);
}
function fade(tl: gsap.core.Timeline, p: THREE.Mesh, at: number, dur: number) {
  tl.to(matOf(p), { opacity: 0, duration: dur, ease: 'power1.in' }, at);
  tl.call(
    () => {
      p.visible = false;
    },
    [],
    at + dur,
  );
}

interface BreakCtx {
  impact: { x: number; z: number }; // punto de impacto (solo lo usa "cascade")
}
type BreakVariant = (p: THREE.Mesh, sh: Shard, ctx: BreakCtx) => gsap.core.Timeline;

/** Se desmorona: los trozos dan un saltito, se separan y caen girando. */
const crumble: BreakVariant = (p, sh) => {
  const o = outward(sh, 0.6);
  const tl = gsap.timeline({ delay: rand(0, 0.08) });
  flash(tl, p);
  tl.to(p.position, { y: 0.12, duration: 0.1, ease: 'power1.out' });
  tl.to(p.position, {
    x: sh.x + o.x * 0.55,
    z: sh.z + o.z * 0.55,
    y: FALL_Y,
    duration: 1,
    ease: 'power2.in',
  });
  tl.to(p.rotation, { x: rand(-1.5, 1.5), y: rand(-1, 1), z: rand(-1.5, 1.5), duration: 1, ease: 'power1.in' }, '<');
  tl.to(p.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 1, ease: 'power1.in' }, '<');
  fade(tl, p, 0.7, 0.4);
  return tl;
};

/** Explota: los trozos salen disparados hacia arriba y afuera, girando rápido, y luego caen. */
const burst: BreakVariant = (p, sh) => {
  const o = outward(sh, 0.3);
  const tl = gsap.timeline();
  flash(tl, p);
  tl.to(p.position, {
    x: sh.x + o.x * 0.9,
    z: sh.z + o.z * 0.9,
    y: rand(0.5, 1.1),
    duration: 0.35,
    ease: 'power2.out',
  });
  tl.to(p.position, {
    x: sh.x + o.x * 1.3,
    z: sh.z + o.z * 1.3,
    y: FALL_Y,
    duration: 0.9,
    ease: 'power2.in',
  });
  tl.to(p.rotation, { x: rand(-6, 6), y: rand(-6, 6), z: rand(-6, 6), duration: 1.25, ease: 'none' }, 0);
  tl.to(p.scale, { x: 0.2, y: 0.2, z: 0.2, duration: 0.6, ease: 'power1.in' }, 0.65);
  fade(tl, p, 0.8, 0.45);
  return tl;
};

/** Se parte en dos: las mitades se levantan formando una "tienda" y se hunden hacia lados opuestos. */
const split: BreakVariant = (p, sh) => {
  const side = sh.x < -0.1 ? -1 : sh.x > 0.1 ? 1 : 0;
  const tl = gsap.timeline({ delay: rand(0, 0.05) });
  flash(tl, p);
  if (side !== 0) {
    tl.to(p.rotation, { z: -side * 0.9, duration: 0.35, ease: 'power2.out' });
    tl.to(p.position, { x: sh.x + side * 0.3, y: 0.05, duration: 0.35, ease: 'power2.out' }, '<');
    tl.to(p.rotation, { z: -side * 1.6, duration: 1, ease: 'power1.in' });
    tl.to(p.position, { x: sh.x + side * 0.55, y: FALL_Y, duration: 1, ease: 'power2.in' }, '<');
  } else {
    tl.to(p.position, { y: 0.06, duration: 0.2, ease: 'power1.out' });
    tl.to(p.position, { y: FALL_Y, duration: 1.15, ease: 'power2.in' });
    tl.to(p.rotation, { x: rand(-0.5, 0.5), duration: 1.15, ease: 'power1.in' }, '<');
  }
  fade(tl, p, 0.9, 0.45);
  return tl;
};

/** Cascada: tiembla y se hunde en ola, empezando por un punto de impacto aleatorio. */
const cascade: BreakVariant = (p, sh, ctx) => {
  const dist = Math.hypot(sh.x - ctx.impact.x, sh.z - ctx.impact.z);
  const tl = gsap.timeline({ delay: dist * 0.22 });
  flash(tl, p);
  tl.to(p.position, { y: 0.05, duration: 0.06, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  tl.to(p.position, { y: FALL_Y, duration: 0.9, ease: 'power2.in' });
  tl.to(p.rotation, { x: rand(-0.8, 0.8), z: rand(-0.8, 0.8), duration: 0.9, ease: 'power1.in' }, '<');
  fade(tl, p, 0.7, 0.4);
  return tl;
};

const VARIANTS: Record<Exclude<BreakStyle, 'random'>, BreakVariant> = { crumble, burst, split, cascade };
const VARIANT_NAMES = Object.keys(VARIANTS) as (keyof typeof VARIANTS)[];

/** Polvo de hielo: partículas blancas que suben y se desvanecen. */
function dustBurst(group: THREE.Group, tls: gsap.core.Timeline[]) {
  group.visible = true;
  (group.children as THREE.Mesh[]).forEach((m) => {
    const mat = m.material as THREE.MeshBasicMaterial;
    m.position.set(rand(-0.4, 0.4), 0.02, rand(-0.4, 0.4));
    m.scale.setScalar(rand(0.6, 1.4));
    mat.opacity = 0.9;
    const tl = gsap.timeline({ delay: rand(0, 0.1) });
    tl.to(m.position, {
      x: m.position.x + rand(-0.4, 0.4),
      y: rand(0.4, 0.9),
      z: m.position.z + rand(-0.4, 0.4),
      duration: 0.8,
      ease: 'power2.out',
    });
    tl.to(mat, { opacity: 0, duration: 0.8, ease: 'power1.in' }, 0);
    tl.to(m.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'power1.in' }, 0);
    tls.push(tl);
  });
}

// ---------- Material de hielo ----------

function IceMaterial({ color, glow, glowIntensity }: { color: string; glow: string; glowIntensity: number }) {
  return (
    <meshPhysicalMaterial
      color={color}
      emissive={glow}
      emissiveIntensity={glowIntensity}
      roughness={0.12}
      metalness={0.05}
      clearcoat={0.8}
      clearcoatRoughness={0.15}
      transparent
      opacity={REST_OPACITY}
    />
  );
}

// ---------- Casilla ----------

interface TileProps {
  index: number;
  value: Cell;
  inPath: boolean;
  /** Animación de rotura. Por defecto se elige una al azar en cada rotura. */
  breakStyle?: BreakStyle;
}

export default function Tile({ index, value, inPath, breakStyle = 'random' }: TileProps) {
  const tapTile = useCollapsi((s) => s.tapTile);
  const root = useRef<THREE.Group>(null); // escala de aparición
  const whole = useRef<THREE.Group>(null); // casilla entera
  const shards = useRef<THREE.Group>(null); // fragmentos (ocultos hasta romperse)
  const dust = useRef<THREE.Group>(null); // polvo de hielo
  const destroyed = value === null;
  const [x, , z] = tilePos(index);

  // Aparición (pop) al montar y rotura animada al destruirse.
  useEffect(() => {
    const r = root.current;
    const w = whole.current;
    const s = shards.current;
    const d = dust.current;
    if (!r || !w || !s || !d) return;

    const tls: gsap.core.Timeline[] = [];
    const cleanup = () => tls.forEach((t) => t.kill());
    const pieces = s.children as THREE.Mesh[];

    if (!destroyed) {
      // Estado intacto: casilla entera visible, fragmentos y polvo reiniciados.
      w.visible = true;
      s.visible = false;
      d.visible = false;
      pieces.forEach((p, i) => {
        p.visible = true;
        p.position.set(SHARDS[i].x, 0, SHARDS[i].z);
        p.rotation.set(0, 0, 0);
        p.scale.setScalar(1);
        matOf(p).opacity = REST_OPACITY;
        matOf(p).emissiveIntensity = REST_GLOW;
      });
      gsap.fromTo(
        r.scale,
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1, duration: 0.4, delay: index * 0.03, ease: 'back.out(1.7)' },
      );
      return cleanup;
    }

    // Rotura: la casilla entera se oculta y los fragmentos siguen la variante elegida.
    const name = breakStyle === 'random' ? VARIANT_NAMES[Math.floor(Math.random() * VARIANT_NAMES.length)] : breakStyle;
    const variant = VARIANTS[name];
    const ctx: BreakCtx = { impact: { x: rand(-0.5, 0.5), z: rand(-0.5, 0.5) } };

    w.visible = false;
    s.visible = true;
    pieces.forEach((p, i) => tls.push(variant(p, SHARDS[i], ctx)));
    dustBurst(d, tls);
    playSfx('break'); // en el mismo instante que empieza la animación

    return cleanup;
  }, [destroyed, index, breakStyle]);

  const color = inPath ? COLORS.path : COLORS.ice[value ?? 1];
  const glow = inPath ? COLORS.pathGlow : COLORS.iceGlow;
  const glowIntensity = inPath ? 0.45 : REST_GLOW;

  return (
    <group position={[x, 0, z]}>
      <group ref={root}>
        {/* Casilla entera */}
        <group ref={whole}>
          <RoundedBox args={[1, TILE_H, 1]} radius={0.07} smoothness={4}>
            <IceMaterial color={color} glow={glow} glowIntensity={glowIntensity} />
          </RoundedBox>

          {/* Núcleo nublado: da profundidad al hielo */}
          <mesh>
            <boxGeometry args={[0.72, TILE_H * 0.6, 0.72]} />
            <meshStandardMaterial
              color={COLORS.iceCloud}
              transparent
              opacity={0.35}
              roughness={0.9}
              depthWrite={false}
            />
          </mesh>

          {/* Valor repetido en las 4 esquinas */}
          {value !== null &&
            CORNERS.map((c) => (
              <Text
                key={`${c.x}${c.z}`}
                position={[c.x * CORNER_OFFSET, TILE_H / 2 + 0.01, c.z * CORNER_OFFSET]}
                rotation={[-Math.PI / 2, 0, c.rot]}
                fontSize={0.2}
                color={COLORS.iceText}
                outlineWidth={0.012}
                outlineColor={COLORS.iceTextOutline}
                anchorX="center"
                anchorY="middle"
              >
                {value}
              </Text>
            ))}
        </group>

        {/* Fragmentos (visibles solo al romperse) */}
        <group ref={shards} visible={false}>
          {SHARDS.map((sh, i) => (
            <mesh key={i} position={[sh.x, 0, sh.z]}>
              <boxGeometry args={[sh.w - 0.01, TILE_H, sh.d - 0.01]} />
              <IceMaterial color={COLORS.ice[2]} glow={COLORS.iceGlow} glowIntensity={REST_GLOW} />
            </mesh>
          ))}
        </group>

        {/* Polvo de hielo (sobre la superficie de la casilla) */}
        <group ref={dust} position={[0, TILE_H / 2, 0]} visible={false}>
          {Array.from({ length: DUST_COUNT }, (_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Plano de toque siempre presente (también sobre casillas destruidas). */}
      <mesh
        position={[0, TILE_H / 2 + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          tapTile(index);
        }}
      >
        <planeGeometry args={[SPACING, SPACING]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
