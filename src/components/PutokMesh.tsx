"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { ThreeElements } from "@react-three/fiber";
import { buildPutokGeometries, type PutokGeometrySet, type PutokMaps } from "./putokGeometry";
import { preparePutokMapsAuto } from "./putokPhotoMaps";

type Attrs = {
  position: Float32Array;
  normal: Float32Array;
  tangent: Float32Array;
  uv: Float32Array;
  uv2: Float32Array;
  index: Uint32Array | Uint16Array;
};
type WorkerPayload = { top: Attrs; wall: Attrs; bottom: Attrs };

function attrsToGeometry(a: Attrs) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(a.position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(a.normal, 3));
  g.setAttribute("tangent", new THREE.BufferAttribute(a.tangent, 4));
  g.setAttribute("uv", new THREE.BufferAttribute(a.uv, 2));
  g.setAttribute("uv2", new THREE.BufferAttribute(a.uv2, 2));
  g.setIndex(new THREE.BufferAttribute(a.index, 1));
  g.computeBoundingSphere();
  return g;
}

/** One plain, guaranteed-compatible crust material shown before maps load. */
function placeholderMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xc9853d,
    roughness: 0.86,
    metalness: 0,
    sheen: 0.4,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color(0xf2ddbd),
    envMapIntensity: 0.8,
  });
}

/** All-stock materials — zero hand-written GLSL, so nothing here can fail
    on a strict GPU driver. */
function buildMaterials(maps: PutokMaps) {
  const shared = {
    metalness: 0,
    sheen: 0.5,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xf7e9d0),
    specularIntensity: 0.55,
    envMapIntensity: 0.95,
  } as const;

  const top = new THREE.MeshPhysicalMaterial({
    ...shared,
    color: 0xffffff,
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: maps.ormMap,
    aoMap: maps.ormMap,
    aoMapIntensity: 1.1,
    displacementMap: maps.displacementMap,
    displacementScale: maps.displacementScale * 2,
    displacementBias: -maps.displacementScale,
    roughness: 0.9,
  });

  const wall = new THREE.MeshPhysicalMaterial({
    ...shared,
    color: 0xffffff,
    map: maps.sideMap,
    normalMap: maps.sideNormalMap,
    normalScale: new THREE.Vector2(0.75, 0.4),
    roughnessMap: maps.sideOrmMap,
    aoMap: maps.sideOrmMap,
    aoMapIntensity: 1.0,
    displacementMap: maps.sideDispMap,
    displacementScale: maps.sideDisplacementScale * 1.3,
    displacementBias: -maps.sideDisplacementScale * 0.65,
    roughness: 0.9,
  });

  const bottom = new THREE.MeshPhysicalMaterial({
    ...shared,
    color: 0xffffff,
    map: maps.bottomMap,
    normalMap: maps.bottomNormalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: maps.bottomOrmMap,
    aoMap: maps.bottomOrmMap,
    aoMapIntensity: 1.0,
    displacementMap: maps.bottomDispMap,
    displacementScale: maps.displacementScale * 2 * 0.6,
    displacementBias: -maps.displacementScale * 0.6,
    roughness: 0.98,
  });

  return { top, wall, bottom };
}

type MaterialSet = ReturnType<typeof buildMaterials> | null;

function Part({
  geometry,
  material,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  return (
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  );
}

export default function PutokMesh(props: Omit<ThreeElements["group"], "ref">) {
  const [maps, setMaps] = useState<PutokMaps | null>(null);
  const [dense, setDense] = useState<PutokGeometrySet | null>(null);

  // Light placeholder set (built synchronously, always renders)
  const light = useMemo(() => buildPutokGeometries(0.35), []);

  // Dense set in a worker so the main thread never stutters
  useEffect(() => {
    let worker: Worker | null = null;
    let alive = true;
    let built: PutokGeometrySet | null = null;
    const buildOnMain = () => {
      if (built || !alive) return;
      built = buildPutokGeometries(1);
      setDense(built);
      worker?.terminate();
    };
    try {
      worker = new Worker(new URL("./putokGeometry.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<WorkerPayload>) => {
        if (!alive) return;
        const set: PutokGeometrySet = {
          top: attrsToGeometry(e.data.top),
          wall: attrsToGeometry(e.data.wall),
          bottom: attrsToGeometry(e.data.bottom),
        };
        built = set;
        setDense(set);
        worker?.terminate();
        clearTimeout(watchdog);
      };
      worker.onerror = buildOnMain;
      worker.onmessageerror = buildOnMain;
      worker.postMessage({ detail: 1 });
      const watchdog = setTimeout(buildOnMain, 12000);
    } catch {
      buildOnMain();
    }
    return () => {
      alive = false;
      worker?.terminate();
    };
  }, []);

  // Painted/photo-driven maps
  useEffect(() => {
    let alive = true;
    let loaded: PutokMaps | null = null;
    preparePutokMapsAuto()
      .then((m) => {
        if (alive) {
          loaded = m;
          setMaps(m);
        } else m.dispose();
      })
      .catch(() => {});
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, []);

  const materials: MaterialSet = useMemo(() => (maps ? buildMaterials(maps) : null), [maps]);
  const placeholder = useMemo(() => placeholderMaterial(), []);

  // dispose geometries only on unmount / replacement
  useEffect(() => {
    return () => {
      Object.values(light).forEach((g) => g.dispose());
    };
  }, [light]);
  useEffect(() => {
    return () => {
      if (dense) Object.values(dense).forEach((g) => g.dispose());
    };
  }, [dense]);
  // dispose the placeholder once the real materials exist; dispose real ones on unmount
  useEffect(() => {
    if (!materials) return;
    placeholder.dispose();
    return () => {
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [materials, placeholder]);

  const geo = dense ?? light;
  const topMat = materials?.top ?? placeholder;
  const wallMat = materials?.wall ?? placeholder;
  const bottomMat = materials?.bottom ?? placeholder;

  return (
    <group {...props}>
      <Part geometry={geo.top} material={topMat} />
      <Part geometry={geo.wall} material={wallMat} />
      <Part geometry={geo.bottom} material={bottomMat} />
    </group>
  );
}
