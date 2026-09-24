import { buildPutokGeometries } from "./putokGeometry";
import type * as THREE from "three";

type Attrs = {
  position: Float32Array;
  normal: Float32Array;
  tangent: Float32Array;
  uv: Float32Array;
  uv2: Float32Array;
  index: Uint32Array | Uint16Array;
};

function collect(geo: THREE.BufferGeometry): Attrs {
  const position = geo.attributes.position.array as Float32Array;
  const normal = geo.attributes.normal.array as Float32Array;
  const tangent = geo.attributes.tangent.array as Float32Array;
  const uv = geo.attributes.uv.array as Float32Array;
  const uv2 = geo.attributes.uv2.array as Float32Array;
  const index = geo.index!.array as Uint32Array | Uint16Array;
  return { position, normal, tangent, uv, uv2, index };
}

self.onmessage = (e: MessageEvent<{ detail: number }>) => {
  const set = buildPutokGeometries(e.data.detail);
  const payload = {
    top: collect(set.top),
    wall: collect(set.wall),
    bottom: collect(set.bottom),
  };
  const buffers: ArrayBuffer[] = [];
  for (const part of [payload.top, payload.wall, payload.bottom]) {
    buffers.push(
      part.position.buffer as ArrayBuffer,
      part.normal.buffer as ArrayBuffer,
      part.tangent.buffer as ArrayBuffer,
      part.uv.buffer as ArrayBuffer,
      part.uv2.buffer as ArrayBuffer,
      part.index.buffer as ArrayBuffer,
    );
  }
  (self as unknown as Worker).postMessage(payload, buffers);
};
