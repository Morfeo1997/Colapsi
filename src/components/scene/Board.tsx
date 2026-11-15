import { useEffect, useLayoutEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { N } from '../../game/engine';
import { useCollapsi } from '../../game/store';
import { COLORS, SPACING, TILE_H, tilePos } from './constants';
import Pawn from './Pawn';
import Tile from './Tile';

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
        <meshStandardMaterial color={COLORS.water} />
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
