import { useEffect, useRef } from 'react';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import type { Cell } from '../../game/engine';
import { useCollapsi } from '../../game/store';
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

const COLS: [number, number][] = [
  [-0.33, 0.34],
  [0, 0.32],
  [0.33, 0.34],
];
const ROWS: [number, number][] = [
  [-0.25, 0.5],
  [0.25, 0.5],
];
const SHARDS = ROWS.flatMap(([z, d]) => COLS.map(([x, w]) => ({ x, z, w, d })));

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
      opacity={0.9}
    />
  );
}

// ---------- Casilla ----------

interface TileProps {
  index: number;
  value: Cell;
  inPath: boolean;
}

export default function Tile({ index, value, inPath }: TileProps) {
  const tapTile = useCollapsi((s) => s.tapTile);
  const root = useRef<THREE.Group>(null); // escala de aparición
  const whole = useRef<THREE.Group>(null); // casilla entera
  const shards = useRef<THREE.Group>(null); // fragmentos (ocultos hasta romperse)
  const destroyed = value === null;
  const [x, , z] = tilePos(index);

  // Aparición (pop) al montar y rotura en fragmentos al destruirse.
  useEffect(() => {
    const r = root.current;
    const w = whole.current;
    const s = shards.current;
    if (!r || !w || !s) return;

    const pieces = s.children as THREE.Mesh[];
    gsap.killTweensOf([r.scale, ...pieces.map((p) => p.position), ...pieces.map((p) => p.rotation), ...pieces.map((p) => p.scale)]);

    if (!destroyed) {
      // Estado intacto: casilla entera visible, fragmentos reiniciados.
      w.visible = true;
      s.visible = false;
      pieces.forEach((p, i) => {
        p.position.set(SHARDS[i].x, 0, SHARDS[i].z);
        p.rotation.set(0, 0, 0);
        p.scale.setScalar(1);
      });
      gsap.fromTo(
        r.scale,
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1, duration: 0.4, delay: index * 0.03, ease: 'back.out(1.7)' },
      );
      return;
    }

    // Rotura: la casilla entera se oculta y los fragmentos saltan, se separan y se hunden.
    w.visible = false;
    s.visible = true;
    pieces.forEach((p, i) => {
      const sh = SHARDS[i];
      const len = Math.hypot(sh.x, sh.z) || 1;
      const dirX = sh.x / len + (Math.random() - 0.5) * 0.6;
      const dirZ = sh.z / len + (Math.random() - 0.5) * 0.6;
      const delay = Math.random() * 0.08;

      const tl = gsap.timeline({ delay });
      tl.to(p.position, { y: 0.12, duration: 0.1, ease: 'power1.out' }); // sacudida al romperse
      tl.to(p.position, {
        x: sh.x + dirX * 0.55,
        z: sh.z + dirZ * 0.55,
        y: -2.6,
        duration: 1,
        ease: 'power2.in',
      });
      tl.to(
        p.rotation,
        {
          x: (Math.random() - 0.5) * 3,
          z: (Math.random() - 0.5) * 3,
          y: (Math.random() - 0.5) * 2,
          duration: 1,
          ease: 'power1.in',
        },
        '<',
      );
      tl.to(p.scale, { x: 0.3, y: 0.3, z: 0.3, duration: 1, ease: 'power1.in' }, '<');
      tl.call(() => {
        p.visible = false;
      });
    });
  }, [destroyed, index]);

  const color = inPath ? COLORS.path : COLORS.ice[value ?? 1];
  const glow = inPath ? COLORS.pathGlow : COLORS.iceGlow;
  const glowIntensity = inPath ? 0.45 : 0.18;

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
              <IceMaterial color={COLORS.ice[2]} glow={COLORS.iceGlow} glowIntensity={0.18} />
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
