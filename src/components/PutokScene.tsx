"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import BreadModel from "./BreadModel";
import { scrollState } from "./scrollState";

type Pose = {
  pos: [number, number, number];
  rot: [number, number, number]; // euler, radians
  scale: number;
};

/**
 * One pose per `data-scene` section on the page.
 * 0 hero · 1 what it is · 2 how it's made · 3 how we eat it · 4 price list · 5 order · 6 footer
 */
const POSES: Pose[] = [
  { pos: [1.62, 0.3, 0], rot: [0.78, -0.22, 0.1], scale: 1.35 }, // hero: full loaf, balanced with text and layout
  { pos: [-1.7, 0.05, 0], rot: [0.5, 0.55, -0.12], scale: 1.1 }, // oblique dome
  { pos: [1.95, 0.1, -0.2], rot: [2.92, 0.3, 0.2], scale: 1.0 }, // flipped: flat cream base
  { pos: [-1.55, -0.15, 0], rot: [1.5, 0, -0.35], scale: 1.05 }, // straight down
  { pos: [2.15, 0.05, -0.4], rot: [Math.PI / 2 + 0.12, 0.85, 0.04], scale: 0.92 }, // edge-on profile
  { pos: [-1.6, 0.3, -0.6], rot: [0.95, -0.55, 0.28], scale: 0.92 }, // three-quarter
  { pos: [0, -0.9, 1.1], rot: [1.62, 0, 0], scale: 1.6 }, // footer: huge, top-down
];

const QUATS = POSES.map((p) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rot)));

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* Image-based lighting: a neutral studio room, pre-filtered for PBR */
function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const target = pmrem.fromScene(envScene, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.85;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/* Soft shadow blob that trails the loaf so it sits *in front of* the paper */
function makeShadowTexture() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(43, 29, 18, 0.55)");
  g.addColorStop(0.45, "rgba(43, 29, 18, 0.28)");
  g.addColorStop(1, "rgba(43, 29, 18, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Shadow() {
  const tex = useMemo(() => makeShadowTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <>
      {/* soft ambient blob */}
      <mesh position={[0.35, -0.55, -0.9]} scale={[3.2, 2.6, 1]} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} opacity={0.7} />
      </mesh>
      {/* true cast shadow from the key light, shaped by the loaf's silhouette */}
      <mesh position={[0, 0, -1.25]} scale={[7, 7, 1]} receiveShadow renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <shadowMaterial transparent opacity={0.22} color="#2b1d12" depthWrite={false} />
      </mesh>
    </>
  );
}

function Rig() {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const { size } = useThree();

  const state = useMemo(
    () => ({
      pos: new THREE.Vector3(POSES[0].pos[0], POSES[0].pos[1], POSES[0].pos[2]),
      quat: QUATS[0].clone(),
      scale: POSES[0].scale,
      targetPos: new THREE.Vector3(),
      targetQuat: new THREE.Quaternion(),
      tilt: new THREE.Vector2(),
      spin: 0,
      prevScene: 0,
    }),
    [],
  );

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const s = THREE.MathUtils.clamp(scrollState.scene, 0, POSES.length - 1);
    const i = Math.min(POSES.length - 2, Math.floor(s));
    const f = easeInOut(THREE.MathUtils.clamp(s - i, 0, 1));
    const a = POSES[i];
    const b = POSES[i + 1];

    const aspect = size.width / size.height;
    const mobile = aspect < 0.85;
    const xk = THREE.MathUtils.clamp(aspect / 1.75, 0.55, 1);
    const sk = THREE.MathUtils.clamp(aspect / 1.6, 0.8, 1);

    let x = THREE.MathUtils.lerp(a.pos[0], b.pos[0], f) * xk;
    let y = THREE.MathUtils.lerp(a.pos[1], b.pos[1], f);
    let z = THREE.MathUtils.lerp(a.pos[2], b.pos[2], f);
    let targetScale = THREE.MathUtils.lerp(a.scale, b.scale, f) * sk;
    const heroProgress = THREE.MathUtils.clamp(1 - s, 0, 1);
    const pointerInContent =
      heroProgress > 0.55 && scrollState.pointerY > -0.1 && scrollState.pointerX > -0.35;
    if (pointerInContent) {
      x += mobile ? -0.34 : 0.58;
      y += 0.2;
      z -= 0.25;
    }
    if (mobile) {
      const heroK = easeInOut(THREE.MathUtils.clamp(1 - s, 0, 1));
      const footerK = easeInOut(THREE.MathUtils.clamp(s - (POSES.length - 2), 0, 1));
      x = THREE.MathUtils.lerp(0.52, 0, heroK) * (1 - footerK) + (pointerInContent ? -0.34 : 0);
      y = THREE.MathUtils.lerp(THREE.MathUtils.lerp(1.18, 0.9, heroK), -0.9, footerK) + (pointerInContent ? 0.2 : 0);
      const base = THREE.MathUtils.lerp(0.42, 0.58, heroK);
      targetScale = THREE.MathUtils.lerp(base, 0.82, footerK);
    }
    state.targetPos.set(x, y, z);
    state.targetQuat.copy(QUATS[i]).slerp(QUATS[i + 1], f);

    const lam = 5.5;
    state.pos.x = THREE.MathUtils.damp(state.pos.x, state.targetPos.x, lam, dt);
    state.pos.y = THREE.MathUtils.damp(state.pos.y, state.targetPos.y, lam, dt);
    state.pos.z = THREE.MathUtils.damp(state.pos.z, state.targetPos.z, lam, dt);
    state.quat.slerp(state.targetQuat, 1 - Math.exp(-lam * dt));
    state.scale = THREE.MathUtils.damp(state.scale, targetScale, lam, dt);

    const dScene = s - state.prevScene;
    state.prevScene = s;
    state.spin += dScene * Math.PI * 1.6 + dt * 0.25;

    state.tilt.x = THREE.MathUtils.damp(state.tilt.x, scrollState.pointerY * 0.18, 4, dt);
    state.tilt.y = THREE.MathUtils.damp(state.tilt.y, scrollState.pointerX * 0.22, 4, dt);

    const t = performance.now() / 1000;
    if (outer.current) {
      outer.current.position.set(state.pos.x, state.pos.y + Math.sin(t * 1.1) * 0.035, state.pos.z);
      outer.current.rotation.set(state.tilt.x, state.tilt.y, 0);
      outer.current.scale.setScalar(state.scale);
    }
    if (inner.current) inner.current.quaternion.copy(state.quat);
    if (spinner.current) spinner.current.rotation.y = state.spin;
    // key light follows the loaf a little so highlights never fall off the edge
    if (keyLight.current) {
      keyLight.current.position.set(state.pos.x + 2.6, 4.5, 4.2);
      keyLight.current.target.position.copy(state.pos);
      keyLight.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <directionalLight
        ref={keyLight}
        intensity={3.1}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <group ref={outer}>
        <Shadow />
        <group ref={inner}>
          <group ref={spinner}>
            <BreadModel />
          </group>
        </group>
      </group>
    </>
  );
}

export default function PutokScene() {
  return (
    <div className="pointer-events-none fixed inset-0 z-25" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 6.2], fov: 34, near: 0.1, far: 30 }}
        shadows="soft"
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.18;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Environment />
        <hemisphereLight intensity={0.5} color="#fff8ec" groundColor="#7a5028" />
        {/* cool-ish fill from the window side */}
        <directionalLight position={[-4.5, 1.2, 2]} intensity={0.65} color="#f2e6d6" />
        {/* warm rim light from behind, like the oven glow catching the crust edge */}
        <directionalLight position={[-2, 2.5, -4]} intensity={1.25} color="#ffbe82" />
        {/* soft upward fill so the floury base never falls to black when flipped */}
        <directionalLight position={[0, -4, 2.5]} intensity={0.8} color="#ffe6c4" />
        <pointLight position={[0.5, -3, -2.5]} intensity={6} distance={12} decay={2} color="#ffab60" />
        <Rig />
      </Canvas>
    </div>
  );
}
