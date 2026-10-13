/**
 * The lazy-loaded decorative 3D "floating pocket deck" hero scene.
 *
 * Loaded ONLY through `HeroScene` (React.lazy + Suspense) which gates it on
 * device capability, idle time and viewport visibility. Everything in this
 * module (three, @react-three/fiber) stays out of the entry chunk.
 *
 * Budget: 6 rounded card planes with canvas-painted faces, 3 lights, no
 * postprocessing — far under 1ms/frame on a mid-range phone.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_PALETTES, cardFaceTexture, disposeCardFaceTextures } from './cardFaceTexture';

export interface HeroScene3DProps {
  variant?: 'signin' | 'empty';
  /** Pause the render loop while false (offscreen / hidden tab). */
  active?: boolean;
}

const CARD_W = 1.0;
const CARD_H = CARD_W * (358 / 300);
const CARD_R = 0.13;

/** Rounded-rect plane with UVs remapped to [0,1] so the face texture fits. */
function useRoundedCardGeometry(): THREE.ShapeGeometry {
  return useMemo(() => {
    const w = CARD_W / 2;
    const h = CARD_H / 2;
    const r = CARD_R;
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.absarc(w - r, -h + r, r, -Math.PI / 2, 0);
    shape.lineTo(w, h - r);
    shape.absarc(w - r, h - r, r, 0, Math.PI / 2);
    shape.lineTo(-w + r, h);
    shape.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI);
    shape.lineTo(-w, -h + r);
    shape.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5);

    const geo = new THREE.ShapeGeometry(shape, 8);
    const pos = geo.attributes.position as THREE.BufferAttribute | undefined;
    const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
    if (pos && uv) {
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (pos.getX(i) + w) / CARD_W, (pos.getY(i) + h) / CARD_H);
      }
      uv.needsUpdate = true;
    }
    return geo;
  }, []);
}

interface CardSpec {
  /** Fan position: rotation, base offset, float phase. */
  rotZ: number;
  x: number;
  y: number;
  z: number;
  phase: number;
  paletteIndex: number;
}

function FloatingCards({ count, pointer }: { count: number; pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const cards = useRef<(THREE.Group | null)[]>([]);
  const geometry = useRoundedCardGeometry();
  const rimGeometry = useMemo(() => {
    const rim = geometry.clone();
    rim.scale(1.055, 1.055, 1);
    return rim;
  }, [geometry]);

  const specs = useMemo<CardSpec[]>(() => {
    const mid = (count - 1) / 2;
    return Array.from({ length: count }, (_, i) => {
      const t = (i - mid) / mid; // -1 .. 1
      return {
        rotZ: t * 0.34,
        x: t * 0.58,
        y: -Math.abs(t) * 0.16,
        // Unique depth per card: mirrored |t| depth alone makes symmetric cards
        // coplanar, which z-fights where they overlap.
        z: -Math.abs(t) * 0.2 + i * 0.02,
        phase: i * 1.7,
        paletteIndex: i % FACE_PALETTES.length,
      };
    });
  }, [count]);

  const materials = useMemo(
    () =>
      FACE_PALETTES.map((p) => ({
        face: new THREE.MeshStandardMaterial({
          map: cardFaceTexture(p),
          roughness: 0.42,
          metalness: 0.12,
          emissive: new THREE.Color(p.dark),
          emissiveIntensity: 0.22,
        }),
        rim: new THREE.MeshStandardMaterial({
          color: new THREE.Color(p.dark),
          emissive: new THREE.Color(p.light),
          emissiveIntensity: 0.55,
          roughness: 0.5,
          metalness: 0.2,
        }),
      })),
    [],
  );

  useEffect(() => {
    return () => {
      for (const m of materials) {
        m.face.dispose();
        m.rim.dispose();
      }
      geometry.dispose();
      rimGeometry.dispose();
      disposeCardFaceTextures();
    };
  }, [materials, geometry, rimGeometry]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    // Gentle whole-stack breathing + pointer parallax (damped).
    const targetRotY = pointer.current.x * 0.22;
    const targetRotX = -pointer.current.y * 0.12;
    const damp = 1 - Math.exp(-delta * 4.5);
    g.rotation.y += (targetRotY - g.rotation.y) * damp;
    g.rotation.x += (targetRotX - g.rotation.x) * damp;
    g.position.y = Math.sin(t * 0.55) * 0.045;

    // Per-card float and tiny sway.
    for (let i = 0; i < specs.length; i++) {
      const c = cards.current[i];
      const s = specs[i];
      if (!c || !s) continue;
      c.position.y = s.y + Math.sin(t * 0.9 + s.phase) * 0.05;
      c.rotation.z = s.rotZ + Math.sin(t * 0.5 + s.phase) * 0.02;
    }
  });

  return (
    <group ref={group}>
      {specs.map((s, i) => (
        <group
          key={i}
          ref={(el) => {
            cards.current[i] = el;
          }}
          position={[s.x, s.y, s.z]}
          rotation={[0, 0, s.rotZ]}
        >
          <mesh geometry={rimGeometry} material={materials[s.paletteIndex]?.rim} position={[0, 0, -0.012]} />
          <mesh geometry={geometry} material={materials[s.paletteIndex]?.face} />
        </group>
      ))}
    </group>
  );
}

/** Soft elliptical shadow under the stack (transparent PNG-free gradient plane). */
function GroundShadow() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, -1.08, -0.1]} rotation={[-Math.PI / 2.6, 0, 0]}>
      <planeGeometry args={[3.6, 1.6]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

/**
 * Default export = the lazy chunk entry (`React.lazy(() => import(...))`).
 */
export default function HeroScene3D({ variant = 'signin', active = true }: HeroScene3DProps) {
  const pointer = useRef({ x: 0, y: 0 });
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Pointer parallax listens on the window so it works even though the canvas
  // itself is pointer-events-none (decorative, never intercepts taps).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const running = active && tabVisible;

  return (
    <div
      className={variant === 'empty' ? 'relative mx-auto h-40 w-full max-w-[15rem]' : 'relative mx-auto h-56 w-full max-w-xs md:h-64 md:max-w-sm'}
      aria-hidden
    >
      {/* arena glow behind the transparent canvas */}
      <div className="absolute top-1/2 left-1/2 size-[135%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(109_92_255/0.28),transparent)] blur-2xl" />
      <Canvas
        frameloop={running ? 'always' : 'never'}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power', stencil: false, depth: true }}
        camera={{ position: [0, 0.12, 4.4], fov: 33 }}
        style={{ pointerEvents: 'none', position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={1.05} />
        <directionalLight position={[3.2, 4, 5]} intensity={1.5} color="#ffe8c4" />
        <pointLight position={[-4, -1.5, 2.5]} intensity={6} distance={14} color="#8f7bff" />
        <group scale={variant === 'empty' ? 0.72 : 1}>
          <FloatingCards count={variant === 'empty' ? 5 : 6} pointer={pointer} />
          <GroundShadow />
        </group>
      </Canvas>
    </div>
  );
}
