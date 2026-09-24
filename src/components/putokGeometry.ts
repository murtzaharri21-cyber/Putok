import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------------ */
/*  Noise                                                              */
/* ------------------------------------------------------------------ */
function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}
const sm = (t: number) => t * t * (3 - 2 * t);
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const u = sm(x - xi),
    v = sm(y - yi),
    w = sm(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(
      l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u),
      l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u),
      v,
    ),
    w,
  );
}
export const smoothstep = (a: number, b: number, x: number) =>
  sm(THREE.MathUtils.clamp((x - a) / (b - a), 0, 1));
const clamp = THREE.MathUtils.clamp;

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise2(x: number, y: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = sm(x - xi),
    yf = sm(y - yi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(hash2(xi, yi), hash2(xi + 1, yi), xf),
    l(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), xf),
    yf,
  );
}
export function fbm2(x: number, y: number) {
  let v = 0,
    a = 0.5,
    f = 1;
  for (let i = 0; i < 5; i++) {
    v += noise2(x * f, y * f) * a;
    f *= 2.1;
    a *= 0.5;
  }
  return v;
}

/* ------------------------------------------------------------------ */
/*  Maps                                                               */
/* ------------------------------------------------------------------ */
export type PutokMaps = {
  map: THREE.Texture; // top face, photo
  bottomMap: THREE.Texture; // bottom face, pale & dimpled
  bottomNormalMap: THREE.Texture;
  bottomOrmMap: THREE.Texture;
  bottomDispMap: THREE.Texture;
  sideMap: THREE.Texture; // rim wall, chevron scored
  sideNormalMap: THREE.Texture;
  sideOrmMap: THREE.Texture;
  sideDispMap: THREE.Texture;
  normalMap: THREE.Texture;
  ormMap: THREE.Texture;
  displacementMap: THREE.Texture;
  displacementScale: number;
  sideDisplacementScale: number;
  dispose: () => void;
};

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function boxBlur(src: Float32Array, S: number, radius: number, passes = 1): Float32Array {
  const a = Float32Array.from(src);
  const b = new Float32Array(S * S);
  const win = radius * 2 + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < S; y++) {
      const row = y * S;
      let acc = 0;
      for (let x = -radius; x <= radius; x++) acc += a[row + clamp(x, 0, S - 1)];
      for (let x = 0; x < S; x++) {
        b[row + x] = acc / win;
        acc += a[row + clamp(x + radius + 1, 0, S - 1)] - a[row + clamp(x - radius, 0, S - 1)];
      }
    }
    for (let x = 0; x < S; x++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++) acc += b[clamp(y, 0, S - 1) * S + x];
      for (let y = 0; y < S; y++) {
        a[y * S + x] = acc / win;
        acc += b[clamp(y + radius + 1, 0, S - 1) * S + x] - b[clamp(y - radius, 0, S - 1) * S + x];
      }
    }
  }
  return a;
}

export function dilate(src: Float32Array, S: number, radius: number): Float32Array {
  const a = new Float32Array(S * S);
  const b = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const row = y * S;
    for (let x = 0; x < S; x++) {
      let m = -1e9;
      for (let k = -radius; k <= radius; k++) m = Math.max(m, src[row + clamp(x + k, 0, S - 1)]);
      a[row + x] = m;
    }
  }
  for (let x = 0; x < S; x++) {
    for (let y = 0; y < S; y++) {
      let m = -1e9;
      for (let k = -radius; k <= radius; k++) m = Math.max(m, a[clamp(y + k, 0, S - 1) * S + x]);
      b[y * S + x] = m;
    }
  }
  return b;
}

export function canvasTex(
  w: number,
  h: number,
  fill: (px: Uint8ClampedArray) => void,
  srgb: boolean,
  repeat = false,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const im = ctx.createImageData(w, h);
  fill(im.data);
  ctx.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function normalsFromField(h: Float32Array, w: number, hgt: number, sx: number, sy: number) {
  const at = (x: number, y: number) => h[clamp(y, 0, hgt - 1) * w + clamp(x, 0, w - 1)];
  return canvasTex(
    w,
    hgt,
    (np) => {
      for (let y = 0; y < hgt; y++)
        for (let x = 0; x < w; x++) {
          const gx =
            at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
            (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
          const gy =
            at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
            (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
          let nx = -gx * sx,
            ny = gy * sy,
            nz = 1;
          const len = Math.hypot(nx, ny, nz);
          const i = (y * w + x) * 4;
          np[i] = ((nx / len) * 0.5 + 0.5) * 255;
          np[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
          np[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
          np[i + 3] = 255;
        }
    },
    false,
  );
}

/* ----------------------- bottom face --------------------------------
   Flat pale base as seen in the reference: cream crumb, a soft tan
   centre splotch, a few dimples, faint radial cracks, toasted ring. */
export function buildBottomMaps(S: number) {
  const h = new Float32Array(S * S);
  const dimples = Array.from({ length: 11 }, (_, k) => ({
    a: hash2(k, 11) * Math.PI * 2,
    r: 0.08 + hash2(k, 23) * 0.55,
    rad: 0.012 + hash2(k, 37) * 0.028,
  }));
  const cracks = Array.from({ length: 6 }, (_, k) => ({
    a: hash2(k, 71) * Math.PI * 2,
    r0: 0.18 + hash2(k, 83) * 0.3,
    r1: 0.55 + hash2(k, 97) * 0.35,
    wig: hash2(k, 109) * 6,
    w: 0.004 + hash2(k, 127) * 0.006,
  }));

  const albedo = canvasTex(
    S,
    S,
    (px) => {
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const k = y * S + x;
          const dx = (x / S - 0.5) * 2,
            dy = (y / S - 0.5) * 2;
          const rr = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx);
          const mottle = fbm2(x * 0.02, y * 0.02) - 0.5;
          const flour = fbm2(x * 0.006 + 20, y * 0.006 + 20) - 0.5;
          const grain = hash2(x * 1.7, y * 0.9) - 0.5;

          let r = 230 + mottle * 20 + flour * 22 + grain * 7;
          let g = 214 + mottle * 16 + flour * 20 + grain * 6;
          let b = 184 + mottle * 12 + flour * 16 + grain * 5;

          // soft tan centre splotch
          const patchMask =
            smoothstep(0.5, 0.72, fbm2(x * 0.012 + 9, y * 0.012 + 3)) * (1 - smoothstep(0.35, 0.6, rr));
          r -= patchMask * 26;
          g -= patchMask * 30;
          b -= patchMask * 34;

          // dimples: pale rim, dark pit
          let dent = 0;
          for (const d of dimples) {
            const ddx = dx - Math.cos(d.a) * d.r;
            const ddy = dy - Math.sin(d.a) * d.r;
            const dist = Math.hypot(ddx, ddy) / d.rad;
            if (dist < 1.4) {
              const pit = Math.exp(-dist * dist * 2.2);
              const rim = Math.exp(-Math.pow((dist - 0.95) / 0.22, 2));
              r -= pit * 52;
              g -= pit * 48;
              b -= pit * 40;
              r += rim * 26;
              g += rim * 24;
              b += rim * 20;
              dent = Math.max(dent, pit - rim * 0.4);
            }
          }

          // faint wavy radial cracks
          for (const c of cracks) {
            if (rr >= c.r0 && rr <= c.r1) {
              const t = (rr - c.r0) / (c.r1 - c.r0);
              const target = c.a + Math.sin(t * c.wig) * 0.05;
              let da = Math.abs(((ang - target + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
              const wv = c.w * (0.5 + t);
              if (da < wv * 3) {
                const deep = Math.exp(-(da * da) / (2 * wv * wv)) * (0.4 + 0.6 * Math.sin(t * Math.PI));
                r -= deep * 46;
                g -= deep * 44;
                b -= deep * 40;
                dent = Math.max(dent, deep * 0.6);
              }
            }
          }

          // toasted contact ring, darker toward the lip
          const ring = Math.exp(-Math.pow((rr - 0.84) / 0.1, 2));
          r -= ring * 38;
          g -= ring * 42;
          b -= ring * 38;
          const edge = smoothstep(0.9, 1.0, rr);
          r -= edge * 26;
          g -= edge * 34;
          b -= edge * 34;

          // flour dust splotches
          const dust = Math.max(0, fbm2(x * 0.012 + 40, y * 0.012 + 7) - 0.56) * 2;
          r += dust * 20;
          g += dust * 20;
          b += dust * 18;

          const i = k * 4;
          px[i] = clamp(r, 0, 255);
          px[i + 1] = clamp(g, 0, 255);
          px[i + 2] = clamp(b, 0, 255);
          px[i + 3] = 255;
          h[k] = mottle * 0.25 + grain * 0.1 - dent * 0.8 - ring * 0.25;
        }
    },
    true,
  );
  const hSmooth = boxBlur(h, S, 1, 1);
  const normal = normalsFromField(hSmooth, S, S, 4, 4);
  const orm = canvasTex(
    S,
    S,
    (op) => {
      for (let k = 0; k < S * S; k++) {
        const cavity = clamp(-hSmooth[k] * 0.8, 0, 0.6);
        const i = k * 4;
        op[i] = (1 - cavity) * 255;
        op[i + 1] = clamp(0.97 + cavity * 0.03, 0, 1) * 255;
        op[i + 2] = 0;
        op[i + 3] = 255;
      }
    },
    false,
  );
  return { albedo, normal, orm };
}

/* ----------------------- fluted wall --------------------------------
   Matches the reference renders: warm orange crust with continuous
   vertical flute grooves (aligned to the dome's radial cuts), pale
   raised rib edges, faint horizontal strata, a dark toasted band
   under the dome seam and a pale lip where it meets the flat base. */
export function buildSideMaps(SW = 2048, SH = 420) {
  const N = 28;
  const h = new Float32Array(SW * SH);

  const albedo = canvasTex(
    SW,
    SH,
    (px) => {
      for (let y = 0; y < SH; y++) {
        const v = y / (SH - 1);
        for (let x = 0; x < SW; x++) {
          const u = x / (SW - 1);
          const k = y * SW + x;
          const mottle = fbm2(x * 0.02, y * 0.1) - 0.5;
          const grain = hash2(x, y) - 0.5;

          // bright honey-orange crust, slightly paler toward the base
          const mid = Math.exp(-Math.pow((v - 0.4) / 0.4, 2));
          let r = 219 + mid * 12 + mottle * 12 + grain * 6;
          let g = 162 + mid * 11 + mottle * 9 + grain * 4;
          let b = 88 + mid * 7 + mottle * 6 + grain * 3;

          // fine vertical crust fibre
          const fibre = fbm2(x * 0.06, v * 3 + fbm2(x * 0.01, 3) * 2) - 0.5;
          r += fibre * 9;
          g += fibre * 6;
          b += fibre * 3;

          // warm toasted band just under the shoulder seam; pale tan base lip
          const seamTop = Math.exp(-Math.pow((v - 0.05) / 0.09, 2));
          const baseLip = Math.exp(-Math.pow((1 - v) / 0.14, 2));
          r -= seamTop * 36;
          g -= seamTop * 34;
          b -= seamTop * 30;
          r += baseLip * 16;
          g += baseLip * 20;
          b += baseLip * 24;

          // shallow flute grooves on the upper wall, fading to the base
          const fu = (u * N) % 1;
          const grooveCore = Math.exp(-Math.pow((fu - 0.5) / 0.06, 2));
          const lip = Math.exp(-Math.pow(Math.min(Math.abs(fu - 0.36), Math.abs(fu - 0.64)) / 0.045, 2));
          const vEnv = smoothstep(0.0, 0.1, v) * (1 - smoothstep(0.7, 0.98, v));
          const depth = grooveCore * vEnv;
          r = r * (1 - depth * 0.42) + lip * vEnv * 18;
          g = g * (1 - depth * 0.46) + lip * vEnv * 15;
          b = b * (1 - depth * 0.52) + lip * vEnv * 11;

          // very faint horizontal strata
          const wav = fbm2(x * 0.008 + 4, v * 14) - 0.5;
          let strata = 0;
          for (const bv of [0.32, 0.55]) {
            strata += Math.exp(-Math.pow((v - bv - wav * 0.012) / 0.01, 2)) * 0.22;
          }
          r -= strata * 10;
          g -= strata * 8;
          b -= strata * 6;

          // sparse dark speckle on the toasted seam
          const pore = hash2(Math.floor(x / 2), Math.floor(y / 2) + 7);
          if (pore > 0.988 && seamTop > 0.3) {
            r -= 34;
            g -= 28;
            b -= 22;
          }

          const i = k * 4;
          px[i] = clamp(r, 0, 255);
          px[i + 1] = clamp(g, 0, 255);
          px[i + 2] = clamp(b, 0, 255);
          px[i + 3] = 255;
          h[k] = mottle * 0.04 - strata * 0.08 - seamTop * 0.16 - depth * 0.55 + fibre * 0.05;
        }
      }
    },
    true,
    true,
  );
  const hS = boxBlur(h, SW, 1, 1);
  const normal = normalsFromField(hS, SW, SH, 9, 4);
  const orm = canvasTex(
    SW,
    SH,
    (op) => {
      for (let k = 0; k < SW * SH; k++) {
        const cavity = clamp(-hS[k], 0, 0.85) * 0.75;
        const i = k * 4;
        op[i] = (1 - cavity) * 255;
        op[i + 1] = clamp(0.82 + cavity * 0.18, 0, 1) * 255;
        op[i + 2] = 0;
        op[i + 3] = 255;
      }
    },
    false,
    true,
  );
  const disp = canvasTex(
    SW,
    SH,
    (dp) => {
      for (let k = 0; k < SW * SH; k++) {
        const val = (0.5 + hS[k] * 0.5) * 255;
        const i = k * 4;
        dp[i] = dp[i + 1] = dp[i + 2] = val;
        dp[i + 3] = 255;
      }
    },
    false,
    true,
  );
  disp.minFilter = THREE.LinearFilter;
  disp.generateMipmaps = false;
  return { albedo, normal, orm, disp };
}


/* ------------------------------------------------------------------ */
/*  Geometry — domed Hunza loaf per the reference renders:             */
/*  a convex spherical-cap top, a vertically fluted wall (~28 ribs),   */
/*  a rolled upper crease, and a near-flat cream base with a lip.      */
/* ------------------------------------------------------------------ */
const R = 1;
const FLUTES = 28; // vertical ribs around the wall (matches outer cuts)
const R_DOME = 0.9; // radius of the dome shoulder/crease
const Y_SEAM = 0.028; // shoulder height
const DOME_H = 0.235; // dome rise above the shoulder (flat bannock cap)
const Y_BASE = -0.095; // flat base height
const WALL_R = 1.012; // slightly bulged wall radius

type Pt = {
  r: number;
  y: number;
  zone: "top" | "wall" | "bottom";
  planarR: number;
  q: number; // 0..1 along the wall (top -> bottom)
  flute: number; // 0..1 flute envelope at this point
};

function buildProfile(detail: number): Pt[] {
  const pts: Pt[] = [];

  // flat bannock dome, centre -> shoulder crease
  const topN = Math.round(110 * detail);
  for (let i = 0; i <= topN; i++) {
    const t = i / topN;
    const rr = R_DOME * t;
    // broad flat crown that steepens near the shoulder
    const cap = Math.pow(Math.max(0, 1 - t * t), 0.42);
    const y = Y_SEAM + DOME_H * cap;
    // flutes climb only the outer shoulder
    const flute = smoothstep(0.66, 1.0, t) * 0.4;
    pts.push({ r: rr, y, zone: "top", planarR: t * 0.985, q: 0, flute });
  }

  // short creased shoulder roll into the wall
  const wallN = Math.round(120 * detail);
  for (let i = 1; i <= wallN; i++) {
    const q = i / wallN;
    let r: number;
    let y: number;
    if (q < 0.14) {
      // crease: slight outward tuck from the dome shoulder
      const s = q / 0.14;
      const k = 0.5 - 0.5 * Math.cos(s * Math.PI / 2);
      r = R_DOME + (WALL_R - R_DOME) * k;
      y = Y_SEAM - (Y_SEAM - 0.012) * k;
    } else if (q < 0.62) {
      // short straight fluted wall with a faint bulge
      const s = (q - 0.14) / 0.48;
      r = WALL_R + 0.008 * Math.sin(s * Math.PI);
      y = 0.012 - s * 0.072;
    } else {
      // bottom corner rolling under to the flat base lip
      const s = (q - 0.62) / 0.38;
      const k = 0.5 - 0.5 * Math.cos(s * Math.PI / 2);
      r = 1.005 + (0.87 - 1.005) * k;
      y = -0.06 + (Y_BASE + 0.06) * k;
    }
    // flutes live on the upper wall and fade out toward the base
    let env: number;
    if (q < 0.14) env = smoothstep(0, 0.14, q) * 0.55 + 0.35;
    else if (q < 0.62) env = 1;
    else env = 1 - smoothstep(0.62, 0.86, q) * 0.95;
    pts.push({ r, y, zone: "wall", planarR: Math.min(1, r * 0.985), q, flute: env });
  }

  // flat base, rim -> centre
  const botN = Math.round(80 * detail);
  for (let i = 1; i <= botN; i++) {
    const s = i / botN; // 0 at edge, 1 at centre
    const t = 1 - s;
    const rr = 0.87 * t;
    const y = Y_BASE + Math.exp(-Math.pow(t / 0.55, 2)) * 0.008;
    pts.push({ r: i === botN ? 0 : rr, y, zone: "bottom", planarR: t * 0.96, q: 1, flute: 0 });
  }
  return pts;
}

/** Smooth periodic flute groove: -1 toward rib centres, +1 inside the
    vertical cuts that sit on the outer ring's radial score lines. */
function makeFluteField() {
  const dA = (Math.PI * 2) / FLUTES;
  return (theta: number) => {
    const a = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const k = a / dA;
    const f = k - Math.floor(k); // 0..1 across a rib cell
    // groove in the middle third of each cell (the radial cut between wedges)
    const groove = Math.exp(-Math.pow((f - 0.5) / 0.16, 2));
    const shoulder = Math.exp(-Math.pow((f - 0.32) / 0.1, 2)) + Math.exp(-Math.pow((f - 0.68) / 0.1, 2));
    return { groove, shoulder };
  };
}

export type PutokGeometrySet = {
  top: THREE.BufferGeometry;
  wall: THREE.BufferGeometry;
  bottom: THREE.BufferGeometry;
};

/* Mesh splits along the wall parameter: the dome texture owns the upper
   lip, the base texture the rolled bottom, and the wall map the rib band. */
const Q_TOP_END = 0.05;
const Q_BOT_START = 0.8;

function buildSubGeometry(
  pts: Pt[],
  zone: "top" | "wall" | "bottom",
  detail: number,
  fluteField: (theta: number) => { groove: number; shoulder: number },
): THREE.BufferGeometry {
  const segs = Math.round(480 * detail);
  const ordered = [...pts].reverse();
  const profile = ordered.map((p) => new THREE.Vector2(p.r, p.y));
  let geo: THREE.BufferGeometry = new THREE.LatheGeometry(profile, segs);
  geo.computeVertexNormals();

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const latheUv = geo.attributes.uv as THREE.BufferAttribute;
  const count = pos.count;
  const ptsLen = ordered.length;
  const uvA = new Float32Array(count * 2);
  const qAttr = new Float32Array(count);

  const p = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(pos, i);
    const lathePoint = i % ptsLen;
    const pt = ordered[lathePoint];
    const theta = Math.atan2(p.z, p.x);
    const radial = Math.hypot(p.x, p.z);

    // vertical fluting (macro ribs) — radial pinch only
    if (pt.flute > 0 && radial > 1e-4) {
      const { groove, shoulder } = fluteField(theta);
      const amp = 0.026 * pt.flute;
      const pinch = 1 - amp * groove + amp * 0.18 * shoulder;
      p.x *= pinch;
      p.z *= pinch;
    }
    // subtle organic crust bumps
    const bumps =
      (noise3(p.x * 2.4 + 3.1, p.y * 2.4, p.z * 2.4) - 0.5) * 0.016 +
      (noise3(p.x * 8 + 9.7, p.y * 8, p.z * 8) - 0.5) * 0.006;
    if (p.length() > 1e-4) {
      dir.copy(p).normalize();
      p.addScaledVector(dir, bumps * (pt.zone === "wall" ? 1 : 0.5));
    }

    const ang = radial > 1e-4 ? theta : 0;
    if (zone === "wall") {
      uvA[i * 2] = (ang / (Math.PI * 2) + 0.5) % 1;
      uvA[i * 2 + 1] = THREE.MathUtils.clamp((pt.q - Q_TOP_END) / (Q_BOT_START - Q_TOP_END), 0, 1);
    } else {
      const planar = pt.planarR;
      uvA[i * 2] = 0.5 + Math.cos(ang) * planar * 0.5;
      uvA[i * 2 + 1] = 0.5 + Math.sin(ang) * planar * 0.5;
    }
    qAttr[i] = pt.zone === "wall" ? pt.q : zone === "top" ? 0 : 1;
    latheUv.setXY(i, uvA[i * 2], uvA[i * 2 + 1]);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  latheUv.needsUpdate = true;

  geo.deleteAttribute("uv");
  geo.deleteAttribute("normal");
  geo = mergeVertices(geo, 1e-4);
  geo.setAttribute("uv", new THREE.BufferAttribute(uvA, 2));
  geo.setAttribute("uv2", new THREE.BufferAttribute(Float32Array.from(uvA), 2));
  geo.setAttribute("aQ", new THREE.BufferAttribute(qAttr, 1));
  geo.computeVertexNormals();

  const nPos = geo.attributes.position as THREE.BufferAttribute;
  const nNorm = geo.attributes.normal as THREE.BufferAttribute;

  // analytic tangent frame for stock normal mapping
  const tangent = new Float32Array(nPos.count * 4);
  const tv = new THREE.Vector3();
  const bv = new THREE.Vector3();
  const cv = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  for (let i = 0; i < nPos.count; i++) {
    const th = Math.atan2(nPos.getZ(i), nPos.getX(i));
    nrm.fromBufferAttribute(nNorm, i);
    if (zone === "wall") {
      tv.set(-Math.sin(th), 0, Math.cos(th)); // u around
      bv.set(0, -1, 0); // v down the profile
    } else {
      tv.set(Math.cos(th), 0, Math.sin(th)); // u radial
      bv.set(-Math.sin(th), 0, Math.cos(th)); // v around
    }
    cv.crossVectors(nrm, tv);
    const w = cv.dot(bv) >= 0 ? 1 : -1;
    tangent[i * 4] = tv.x;
    tangent[i * 4 + 1] = tv.y;
    tangent[i * 4 + 2] = tv.z;
    tangent[i * 4 + 3] = w;
  }
  geo.setAttribute("tangent", new THREE.BufferAttribute(tangent, 4));
  geo.computeBoundingSphere();
  return geo;
}

export function buildPutokGeometries(detail = 1): PutokGeometrySet {
  const all = buildProfile(detail);
  const topFaceEnd = all.findIndex((p) => p.zone !== "top");
  const wallPts = all.filter((p) => p.zone === "wall");
  const wallTopCut = wallPts.findIndex((p) => p.q >= Q_TOP_END);
  const wallBotCut = wallPts.findIndex((p) => p.q >= Q_BOT_START);
  const wallTopEnd = topFaceEnd + Math.max(1, wallTopCut);
  const wallBotStart = topFaceEnd + Math.max(wallTopCut + 1, wallBotCut);

  const topPts = all.slice(0, wallTopEnd + 1);
  const wallSub = wallPts.slice(Math.max(0, wallTopCut), Math.max(wallTopCut + 2, wallBotCut + 1));
  const bottomPts = all.slice(wallBotStart);

  const fluteField = makeFluteField();
  return {
    top: buildSubGeometry(topPts, "top", detail, fluteField),
    wall: buildSubGeometry(wallSub, "wall", detail, fluteField),
    bottom: buildSubGeometry(bottomPts, "bottom", detail, fluteField),
  };
}


/** Back-compat single-geometry helper (light placeholder / tests). */
export function buildPutokGeometry(detail = 1) {
  const set = buildPutokGeometries(detail);
  const merged = mergeGeometries([set.top, set.wall, set.bottom], false);
  merged.computeBoundingSphere();
  return merged;
}
