import { useEffect, useLayoutEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { N, type Cell } from '../../game/engine';
import { useCollapsi } from '../../game/store';
import { COLORS, SPACING, TILE_H, tilePos } from './constants';
import Pawn from './Pawn';

// ---------- Casilla ----------

interface TileProps {
  index: number;
  value: Cell;
  inPath: boolean;
}

function Tile({ index, value, inPath }: TileProps) {
  const tapTile = useCollapsi((s) => s.tapTile);
  const inner = useRef<THREE.Group>(null);
  const destroyed = value === null;
  const [x, , z] = tilePos(index);

  // Aparición (pop) al montar y caída al destruirse.
  useEffect(() => {
    const g = inner.current;
    if (!g) return;
    gsap.killTweensOf([g.position, g.rotation, g.scale]);

    if (destroyed) {
      gsap.to(g.position, { y: -3, duration: 0.9, ease: 'power2.in' });
      gsap.to(g.rotation, { x: 0.6, z: 0.4, duration: 0.9, ease: 'power2.in' });
      gsap.to(g.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.9,
        ease: 'power2.in',
        onComplete: () => {
          g.visible = false;
        },
      });
    } else {
      g.visible = true;
      g.position.y = 0;
      g.rotation.set(0, 0, 0);
      gsap.fromTo(
        g.scale,
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1, duration: 0.4, delay: index * 0.03, ease: 'back.out(1.7)' },
      );
    }
  }, [destroyed, index]);

  const color = inPath ? COLORS.path : COLORS.byValue[value ?? 1];

  return (
    <group position={[x, 0, z]}>
      <group ref={inner}>
        <RoundedBox args={[1, TILE_H, 1]} radius={0.06} smoothness={4}>
          <meshStandardMaterial
            color={color}
            emissive={inPath ? COLORS.path : '#000000'}
            emissiveIntensity={inPath ? 0.35 : 0}
            roughness={0.6}
          />
        </RoundedBox>
        {value !== null && (
          <Text
            position={[0, TILE_H / 2 + 0.01, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.5}
            color={COLORS.text}
            anchorX="center"
            anchorY="middle"
          >
            {value}
          </Text>
        )}
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

// ---------- Estallido rojo (toque ilegal) ----------

const PARTICLES = 8;

function Burst() {
  const illegal = useCollapsi((s) => s.lastIllegal);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    const g = group.current;
    if (!g || !illegal) return;

    const [x, , z] = tilePos(illegal.tile);
    g.position.set(x, TILE_H / 2 + 0.1, z);
    g.visible = true;

    const tl = gsap.timeline({
      onComplete: () => {
        g.visible = false;
      },
    });

    g.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const a = (i / PARTICLES) * Math.PI * 2;
      mesh.position.set(0, 0, 0);
      mesh.scale.setScalar(1);
      mat.opacity = 1;
      tl.to(
        mesh.position,
        { x: Math.cos(a) * 0.6, y: 0.25, z: Math.sin(a) * 0.6, duration: 0.45, ease: 'power2.out' },
        0,
      );
      tl.to(mesh.scale, { x: 0.2, y: 0.2, z: 0.2, duration: 0.45, ease: 'power1.in' }, 0);
      tl.to(mat, { opacity: 0, duration: 0.45, ease: 'power1.in' }, 0);
    });

    return () => {
      tl.kill();
    };
  }, [illegal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={group} visible={false}>
      {Array.from({ length: PARTICLES }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color={COLORS.red} transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Cámara responsive ----------

/** Aleja la cámara en pantallas verticales para que el tablero siempre quepa. */
function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    const dist = Math.max(9.5, 9 / aspect);
    const tilt = THREE.MathUtils.degToRad(20); // leve inclinación respecto a la vista cenital
    camera.position.set(0, dist * Math.cos(tilt), dist * Math.sin(tilt));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}

// ---------- Tablero ----------

export default function Board() {
  const game = useCollapsi((s) => s.game);
  const path = useCollapsi((s) => s.path);
  const matchId = useCollapsi((s) => s.matchId);

  return (
    <Canvas
      className="touch-none"
      camera={{ position: [0, 9, 3.5], fov: 35 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={[COLORS.bg]} />
      <CameraRig />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 8, 3]} intensity={1.2} />

      {/* Base oscura bajo el tablero */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[N * SPACING + 1, N * SPACING + 1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* key con matchId: al empezar una partida nueva se remonta todo (pop de casillas, fichas directas). */}
      <group key={matchId}>
        {game.tiles.map((value, i) => (
          <Tile key={i} index={i} value={value} inPath={path.includes(i)} />
        ))}
        <Pawn
          player={0}
          tile={game.players[0]}
          color={COLORS.blue}
          active={game.winner === null && game.turn === 0}
        />
        <Pawn
          player={1}
          tile={game.players[1]}
          color={COLORS.red}
          active={game.winner === null && game.turn === 1}
        />
      </group>

      <Burst />
    </Canvas>
  );
}
