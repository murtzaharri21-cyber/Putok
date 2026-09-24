"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = "/models/bread_round_loaf.glb";

export default function BreadModel() {
  const [model, setModel] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let alive = true;
    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      if (!alive) return;
      const clone = gltf.scene.clone(true);
      const bounds = new THREE.Box3().setFromObject(clone);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const fitScale = 1.75 / Math.max(size.x, size.y, size.z);

      clone.position.set(-center.x * fitScale, -center.y * fitScale, -center.z * fitScale);
      clone.scale.setScalar(fitScale);
      clone.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      setModel(clone);
    });
    return () => {
      alive = false;
    };
  }, []);

  return model ? <primitive object={model} /> : null;
}
