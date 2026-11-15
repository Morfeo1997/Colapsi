import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { N } from '../../game/engine';
import { useCollapsi } from '../../game/store';
import { PAWN_Y, SPACING, tilePos } from './constants';

const BELLY = '#f8fafc';
const ORANGE = '#f59e0b'; // pico y patas
const EYE_WHITE = '#ffffff';
const EYE_DARK = '#0f172a';

const TAU = Math.PI * 2;
const SPAN = N * SPACING; // ancho total del tablero (para el wrap tipo Pacman)

/** Diferencia de posición considerando el salto por el borde. */
const wrapDelta = (d: number) => (d > SPAN / 2 ? d - SPAN : d < -SPAN / 2 ? d + SPAN : d);

/** Ángulo equivalente a `to` más cercano a `from` (gira por el camino corto). */
const shortest = (from: number, to: number) =>
  from + ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

// ---------- Modelo del pingüino (el frente apunta a +Z) ----------

function PenguinModel({ color }: { color: string }) {
  return (
    <>
      {/* Cuerpo */}
      <mesh position={[0, 0.36, 0]} scale={[1, 1.25, 0.9]}>
        <sphereGeometry args={[0.3, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      {/* Cabeza */}
      <mesh position={[0, 0.74, 0.02]}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      {/* Panza blanca */}
      <mesh position={[0, 0.34, 0.13]} scale={[0.85, 1.15, 0.5]}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial color={BELLY} roughness={0.6} />
      </mesh>
      {/* Ojos */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.09, 0.78, 0.16]}>
          <mesh>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color={EYE_WHITE} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshStandardMaterial color={EYE_DARK} />
          </mesh>
        </group>
      ))}
      {/* Pico (el cono apunta a +Y por defecto; se gira hacia +Z) */}
      <mesh position={[0, 0.7, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.065, 0.15, 16]} />
        <meshStandardMaterial color={ORANGE} roughness={0.5} />
      </mesh>
      {/* Aletas */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.32, 0.4, 0]}
          rotation={[0, 0, -s * 0.4]}
          scale={[0.3, 1.2, 0.6]}
        >
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color={color} roughness={0.45} />
        </mesh>
      ))}
      {/* Patas */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.1, 0.03, 0.1]} scale={[1, 0.35, 1.5]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

// ---------- Ficha con movimiento ----------

interface PawnProps {
  player: 0 | 1;
  tile: number;
  color: string;
  /** Es el turno de este jugador (hace un pequeño rebote). */
  active?: boolean;
}

export default function Pawn({ player, tile, color, active = false }: PawnProps) {
  const root = useRef<THREE.Group>(null); // posición y orientación
  const body = useRef<THREE.Group>(null); // balanceo, respiración y rebote

  // Orientación inicial: el azul mira a +Z (hacia la cámara) y el rojo al lado contrario.
  useLayoutEffect(() => {
    if (root.current) root.current.rotation.y = player === 0 ? 0 : Math.PI;
  }, [player]);

  // Solo se re-ejecuta cuando ESTE jugador cambia de casilla.
  useEffect(() => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    gsap.killTweensOf([g.position, g.rotation, b.rotation]);

    const [tx, , tz] = tilePos(tile);
    const lm = useCollapsi.getState().lastMove;
    const animated = lm && lm.player === player && lm.path[lm.path.length - 1] === tile;

    if (!animated) {
      g.position.set(tx, PAWN_Y, tz);
      return;
    }

    const tl = gsap.timeline();
    let prev = { x: g.position.x, z: g.position.z };
    let heading = g.rotation.y;
    let sign = 1;

    for (const t of lm.path) {
      const [x, , z] = tilePos(t);

      // Girar hacia la dirección del paso (considerando el wrap del tablero).
      const dx = wrapDelta(x - prev.x);
      const dz = wrapDelta(z - prev.z);
      const target = shortest(heading, Math.atan2(dx, dz));
      if (Math.abs(target - heading) > 0.01) {
        tl.to(g.rotation, { y: target, duration: 0.12, ease: 'power1.out' });
      }
      heading = target;

      const wraps = Math.hypot(x - prev.x, z - prev.z) > SPACING * 1.5;
      if (wraps) {
        tl.set(g.position, { x, z }); // salto por el borde
      } else {
        tl.to(g.position, { x, z, duration: 0.22, ease: 'power1.inOut' });
        tl.to(
          g.position,
          { y: PAWN_Y + 0.12, duration: 0.11, yoyo: true, repeat: 1, ease: 'sine.out' },
          '<',
        );
        // Balanceo lateral alternando de lado en cada paso (andar de pingüino).
        tl.to(
          b.rotation,
          { z: 0.28 * sign, duration: 0.11, yoyo: true, repeat: 1, ease: 'sine.inOut' },
          '<',
        );
        sign = -sign;
      }
      prev = { x, z };
    }
    tl.set(g.position, { x: tx, y: PAWN_Y, z: tz });
    tl.set(b.rotation, { z: 0 });

    return () => {
      tl.kill();
    };
  }, [tile, player]);

  // Respiración suave; si es su turno, además rebota un poco.
  useFrame(({ clock }) => {
    const b = body.current;
    if (!b) return;
    const t = clock.elapsedTime + player * 1.3;
    b.position.y = active ? Math.abs(Math.sin(t * 4)) * 0.04 : 0;
    b.scale.y = 1 + Math.sin(t * 2) * 0.015;
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <PenguinModel color={color} />
      </group>
    </group>
  );
}
