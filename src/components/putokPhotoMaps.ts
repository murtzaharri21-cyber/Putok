import * as THREE from "three";
import {
  boxBlur,
  buildSideMaps,
  canvasTex,
  dilate,
  fbm2,
  loadImage,
  normalsFromField,
  smoothstep,
  type PutokMaps,
} from "./putokGeometry";

const clamp = THREE.MathUtils.clamp;

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/* ------------------------------------------------------------------ */
/*  Procedural dome face — honey crown with soft fingerprint arcs,     */
/*  a circular seam groove, and a ring of toasted wedges separated     */
/*  by cream-lipped radial cuts that line up with the wall flutes.     */
/* ------------------------------------------------------------------ */
const N_WEDGES = 28;
const RING = 0.68;

function buildProceduralPainting(S = 1024): Painting {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const im = ctx.createImageData(S, S);
  const px = im.data;
  const lum = new Float32Array(S * S);
  const mask = new Float32Array(S * S);
  const dA = (Math.PI * 2) / N_WEDGES;

  // nested wavy fingerprint arcs centred off the disc (loop pattern)
  const arcs = {
    cx: 1.05,
    cy: 0.1,
    spacing: 0.052,
    width: 0.016,
  };
  const ridgeField = (u: number, v: number, rr: number) => {
    const dx = u - arcs.cx;
    const dy = v - arcs.cy;
    const d = Math.hypot(dx, dy);
    const th = Math.atan2(dy, dx);
    const wd = d + 0.016 * Math.sin(th * 2.2 + d * 3.4) + 0.01 * Math.sin(th * 5 + 1.4);
    const f = (wd / arcs.spacing) % 1;
    const dist = Math.abs(f - 0.5) * arcs.spacing;
    const core = 1 - smoothstep(arcs.width * 0.5, arcs.width * 1.6, dist);
    // broken, soft arcs confined to the crown
    const cell = hash(Math.floor(wd / arcs.spacing), Math.floor(th * 7));
    const broken = cell > 0.08 ? 1 : 0.3;
    const fade = 1 - smoothstep(RING - 0.06, RING + 0.02, rr);
    return core * broken * fade;
  };

  // wedge cuts sit on flute centres: angle (k + 0.5) * dA
  const wedges = Array.from({ length: N_WEDGES }, (_, k) => ({
    a: (k + 0.5) * dA + (hash(k, 3) - 0.5) * dA * 0.22,
    tilt: (hash(k, 4) - 0.5) * 0.45,
    shade: 0.86 + hash(k, 5) * 0.26,
    rust: hash(k, 6),
    len: 0.9 + hash(k, 8) * 0.12,
  }));

  const branches = Array.from({ length: 20 }, (_, k) => ({
    a: hash(k, 11) * Math.PI * 2,
    r0: 0.72 + hash(k, 12) * 0.08,
    len: 0.1 + hash(k, 15) * 0.14,
    side: hash(k, 16) > 0.5 ? 1 : -1,
    w: 0.005 + hash(k, 17) * 0.005,
  }));

  const blotches = Array.from({ length: 10 }, (_, k) => ({
    a: hash(k, 21) * Math.PI * 2,
    r: 0.7 + hash(k, 22) * 0.28,
    rad: 0.05 + hash(k, 23) * 0.09,
    s: 0.45 + hash(k, 24) * 0.55,
  }));
  // one big rust patch like the reference (upper-left area)
  blotches.push({ a: Math.PI * 1.15, r: 0.82, rad: 0.2, s: 0.95 });

  for (let y = 0; y < S; y++) {
    const vv = (y / (S - 1) - 0.5) * 2;
    for (let x = 0; x < S; x++) {
      const k = y * S + x;
      const i = k * 4;
      const u = (x / (S - 1) - 0.5) * 2;
      const rr = Math.hypot(u, vv);
      const ang = ((Math.atan2(vv, u) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (rr > 1.01) {
        px[i] = 196;
        px[i + 1] = 132;
        px[i + 2] = 64;
        px[i + 3] = 255;
        lum[k] = 0.55;
        mask[k] = 0;
        continue;
      }
      mask[k] = clamp((1.02 - rr) / 0.03, 0, 1);

      const mottle = fbm2(u * 20 + 4, vv * 20 + 9) - 0.5;
      const fine = hash(x, y) - 0.5;

      // honey crown -> warm amber wedge ring -> toasted rim
      let shade: number;
      if (rr < RING) {
        shade = 1.16 - (rr / RING) * 0.16;
      } else {
        const t = (rr - RING) / (1 - RING);
        shade = 1.0 - t * 0.3;
      }
      let r = 222 * shade;
      let g = 182 * shade;
      let b = 108 * shade;

      if (rr >= RING - 0.02) {
        const wk = Math.floor(ang / dA);
        const w = wedges[((wk % N_WEDGES) + N_WEDGES) % N_WEDGES];
        const fw = ang / dA - wk; // 0..1 inside the wedge cell
        // wedge centres are the raised crust; the groove is on fw~0.5
        const ridge = Math.exp(-Math.pow((fw - 0.0) / 0.26, 2));
        const tone = w.shade;
        r *= 0.8 + tone * 0.22;
        g *= 0.8 + tone * 0.22;
        b *= 0.8 + tone * 0.22;
        r += ridge * 12;
        g += ridge * 10;
        b += ridge * 7;
      }
      r += mottle * 13 + fine * 6;
      g += mottle * 10 + fine * 4;
      b += mottle * 6 + fine * 3;

      let dark = 0;
      let pale = 0;

      // soft fingerprint arcs on the crown
      if (rr < RING + 0.02) {
        const rf = ridgeField(u, vv, rr);
        pale = Math.max(pale, rf * 0.62);
        dark = Math.max(dark, rf * 0.26);
      }

      // circular seam groove with a cream torn lip on the inside
      const dg = Math.abs(rr - RING);
      dark = Math.max(dark, (1 - smoothstep(0.008, 0.024, dg)) * 0.85);
      pale = Math.max(pale, Math.exp(-Math.pow((rr - (RING - 0.035)) / 0.014, 2)) * 0.55);

      // radial wedge cuts, aligned to the geometric flutes
      if (rr > RING - 0.03) {
        for (const w of wedges) {
          const t = clamp((rr - (RING - 0.03)) / (w.len - (RING - 0.03)), 0, 1);
          const expected = w.a + w.tilt * (t - 0.25) * 0.1;
          let da = Math.abs(((ang - expected + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          da *= 1 + t * 0.35;
          const taper = smoothstep(0, 0.1, t) * (1 - smoothstep(0.85, 1, t) * 0.5);
          const core = 1 - smoothstep(0.008, 0.024, da);
          dark = Math.max(dark, core * taper * 0.9);
          pale = Math.max(pale, Math.exp(-Math.pow((da - 0.03) / 0.013, 2)) * taper * 0.6);
        }
      }

      // short branch cracks on wedges
      for (const c of branches) {
        if (rr < c.r0 || rr > c.r0 + c.len) continue;
        const t = (rr - c.r0) / c.len;
        const expected = c.a + c.side * t * 0.2;
        let da = Math.abs(((ang - expected + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        da *= 1 + t * 0.6;
        const m = Math.sin(t * Math.PI);
        dark = Math.max(dark, (1 - smoothstep(c.w * 0.5, c.w * 1.6, da)) * m * 0.6);
        pale = Math.max(pale, Math.exp(-Math.pow((da - c.w * 2) / (c.w * 1.4), 2)) * m * 0.25);
      }

      // rust-red toast blotches
      for (const bl of blotches) {
        const bx = Math.cos(bl.a) * bl.r;
        const by = Math.sin(bl.a) * bl.r;
        const n = fbm2(u * 8 + bl.a * 4, vv * 8 + bl.r * 9);
        const d = Math.hypot(u - bx, vv - by);
        const m = smoothstep(bl.rad, bl.rad * 0.3, d * (0.75 + n * 0.5)) * bl.s;
        r = r * (1 - m * 0.5) + 152 * m * 0.5;
        g = g * (1 - m * 0.62) + 76 * m * 0.62;
        b = b * (1 - m * 0.72) + 30 * m * 0.72;
        dark = Math.max(dark, m * 0.1);
      }

      // toasted outer rim
      const edge = smoothstep(0.9, 1.0, rr);
      r -= edge * 22;
      g -= edge * 26;
      b -= edge * 24;

      // sparse pepper pores on the ring
      const pore = hash(Math.floor(x / 2), Math.floor(y / 2) + 3);
      if (pore > 0.984 && rr > RING) dark = Math.max(dark, 0.3);

      // light flour dust
      const dust = Math.max(0, fbm2(u * 50 + 40, vv * 50 + 7) - 0.67) * 2.2;
      r += dust * 16;
      g += dust * 14;
      b += dust * 11;

      r = r * (1 - dark * 0.58) + 242 * pale;
      g = g * (1 - dark * 0.62) + 222 * pale;
      b = b * (1 - dark * 0.68) + 186 * pale;

      px[i] = clamp(r, 0, 255);
      px[i + 1] = clamp(g, 0, 255);
      px[i + 2] = clamp(b, 0, 255);
      px[i + 3] = 255;
      lum[k] = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  let mean = 0;
  for (let k = 0; k < S * S; k++) mean += lum[k];
  return { S, px, lum, mean: mean / (S * S), mask, texture, canvas };
}


/* ------------------------------------------------------------------ */
/*  Procedural base — the flat cream underside from the reference:     */
/*  uniform pale crumb with soft mottle, faint centre texture, and a   */
/*  thin toasted lip ring where it sits on the oven stone.             */
/* ------------------------------------------------------------------ */
function buildProceduralBottom(S = 1024): Painting {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const im = ctx.createImageData(S, S);
  const px = im.data;
  const lum = new Float32Array(S * S);
  const mask = new Float32Array(S * S);

  for (let y = 0; y < S; y++) {
    const vv = (y / (S - 1) - 0.5) * 2;
    for (let x = 0; x < S; x++) {
      const k = y * S + x;
      const i = k * 4;
      const u = (x / S - 0.5) * 2;
      const rr = Math.hypot(u, vv);
      if (rr > 1.01) {
        px[i] = 205;
        px[i + 1] = 178;
        px[i + 2] = 138;
        px[i + 3] = 255;
        lum[k] = 0.7;
        mask[k] = 0;
        continue;
      }
      mask[k] = clamp((1.02 - rr) / 0.03, 0, 1);
      const mottle = fbm2(u * 9 + 2, vv * 9 + 7) - 0.5;
      const fine = fbm2(u * 34, vv * 34) - 0.5;
      let r = 231 + mottle * 16 + fine * 8;
      let g = 216 + mottle * 13 + fine * 7;
      let b = 187 + mottle * 10 + fine * 6;
      // soft tan centre splotch
      const patch = smoothstep(0.55, 0.8, fbm2(u * 3 + 12, vv * 3 + 4)) * (1 - smoothstep(0.3, 0.62, rr));
      r -= patch * 18;
      g -= patch * 20;
      b -= patch * 22;
      // toasted lip ring
      const lip = Math.exp(-Math.pow((rr - 0.9) / 0.07, 2));
      r -= lip * 34;
      g -= lip * 36;
      b -= lip * 32;
      const edge = smoothstep(0.96, 1, rr);
      r -= edge * 18;
      g -= edge * 22;
      b -= edge * 20;
      // flour dust
      const dust = Math.max(0, fbm2(u * 40 + 30, vv * 40 + 11) - 0.6) * 2;
      r += dust * 16;
      g += dust * 15;
      b += dust * 12;
      px[i] = clamp(r, 0, 255);
      px[i + 1] = clamp(g, 0, 255);
      px[i + 2] = clamp(b, 0, 255);
      px[i + 3] = 255;
      lum[k] = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  let mean = 0;
  for (let k = 0; k < S * S; k++) mean += lum[k];
  return { S, px, lum, mean: mean / (S * S), mask, texture, canvas };
}


/* ------------------------------------------------------------------ */
/*  Canvas helpers                                                     */
/* ------------------------------------------------------------------ */
function imageToCanvas(img: HTMLImageElement, maxW = 1800) {
  const W = Math.min(maxW, img.naturalWidth);
  const scale = W / img.naturalWidth;
  const H = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, W, H);
  return c;
}

function slicePanel(src: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}

function cornerBg(data: Uint8ClampedArray, W: number, H: number) {
  const bg = [0, 0, 0];
  let n = 0;
  const p = Math.max(4, Math.floor(Math.min(W, H) * 0.025));
  for (const [ox, oy] of [
    [0, 0],
    [W - p, 0],
    [0, H - p],
    [W - p, H - p],
  ]) {
    for (let y = oy; y < oy + p; y++)
      for (let x = ox; x < ox + p; x++) {
        const i = (y * W + x) * 4;
        bg[0] += data[i];
        bg[1] += data[i + 1];
        bg[2] += data[i + 2];
        n++;
      }
  }
  return [bg[0] / n, bg[1] / n, bg[2] / n];
}

/** A pixel belongs to the loaf if it leaves the background colour or if
    it carries warm saturated crust colour (the cloth background is grey). */
function loafPixel(data: Uint8ClampedArray, i: number, bg: number[]) {
  const r = data[i],
    g = data[i + 1],
    b = data[i + 2];
  const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return dist > 42 || (sat > 30 && r > 110 && r >= b + 18);
}

function cropLoaf(src: HTMLCanvasElement) {
  const W = src.width;
  const H = src.height;
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, W, H).data;
  const bg = cornerBg(data, W, H);

  const rows = new Uint32Array(H);
  const cols = new Uint32Array(W);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (loafPixel(data, (y * W + x) * 4, bg)) {
        rows[y]++;
        cols[x]++;
      }
  const minRun = Math.max(3, Math.floor(Math.min(W, H) * 0.012));
  let minY = 0,
    maxY = H - 1,
    minX = 0,
    maxX = W - 1;
  while (minY < H && rows[minY] < minRun) minY++;
  while (maxY > minY && rows[maxY] < minRun) maxY--;
  while (minX < W && cols[minX] < minRun) minX++;
  while (maxX > minX && cols[maxX] < minRun) maxX--;
  if (maxX - minX < 16 || maxY - minY < 16) {
    minX = 0;
    minY = 0;
    maxX = W - 1;
    maxY = H - 1;
  }

  // representative crust / crumb colour from the centre of the crop
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2,
    rad = Math.max(8, Math.min(maxX - minX, maxY - minY) * 0.14);
  for (let y = Math.floor(cy - rad); y < cy + rad; y += 2)
    for (let x = Math.floor(cx - rad); x < cx + rad; x += 2) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  const centre = n ? [r / n, g / n, b / n] : [196, 128, 62];

  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext("2d", { willReadFrequently: true })!;
  octx.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return { canvas: out, bg, centre };
}

type Painting = {
  S: number;
  px: Uint8ClampedArray;
  lum: Float32Array;
  mean: number;
  mask: Float32Array;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
};

/** Crop the loaf, square it, paint the background out in the loaf's own
    edge colour, and return luminance + a coverage mask. */
function paintLoafSquare(src: HTMLCanvasElement, S = 1024, tint?: [number, number, number]): Painting {
  const { canvas: crop, bg, centre } = cropLoaf(src);
  const fill = tint ?? (centre as [number, number, number]);

  const out = document.createElement("canvas");
  out.width = S;
  out.height = S;
  const octx = out.getContext("2d", { willReadFrequently: true })!;
  octx.fillStyle = `rgb(${fill.map(Math.round).join(",")})`;
  octx.fillRect(0, 0, S, S);
  const pad = S * 0.012;
  octx.drawImage(crop, -pad, -pad, S + pad * 2, S + pad * 2);

  const od = octx.getImageData(0, 0, S, S);
  const px = od.data;
  const R2 = (S / 2) * (S / 2);
  const mask = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = y * S + x;
      const i = k * 4;
      const d = Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
      let a = clamp((d - 20) / 48, 0, 1);
      const dx = x - S / 2,
        dy = y - S / 2;
      const rr = (dx * dx + dy * dy) / R2;
      if (rr > 1) a *= clamp(1 - (rr - 1) / 0.12, 0, 1);
      mask[k] = a;
      if (a < 1) {
        px[i] = px[i] * a + fill[0] * (1 - a);
        px[i + 1] = px[i + 1] * a + fill[1] * (1 - a);
        px[i + 2] = px[i + 2] * a + fill[2] * (1 - a);
      }
    }
  octx.putImageData(od, 0, 0);

  if (tint) {
    // gently unify very pale / photo surfaces toward the requested colour
    const td2 = octx.getImageData(0, 0, S, S);
    const q = td2.data;
    for (let k = 0; k < S * S; k++) {
      const i = k * 4;
      const m = 0.22 * mask[k];
      q[i] = q[i] * (1 - m) + tint[0] * m;
      q[i + 1] = q[i + 1] * (1 - m) + tint[1] * m;
      q[i + 2] = q[i + 2] * (1 - m) + tint[2] * m;
    }
    octx.putImageData(td2, 0, 0);
  }

  const lum = new Float32Array(S * S);
  let mean = 0;
  for (let k = 0; k < S * S; k++) {
    const i = k * 4;
    lum[k] = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    mean += lum[k];
  }
  mean /= S * S;

  const texture = new THREE.CanvasTexture(out);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return { S, px, lum, mean, mask, texture, canvas: out };
}

/* ------------------------------------------------------------------ */
/*  Face maps — both faces of the reference share the exact same       */
/*  scoring (circular ring, parallel docking, radial dashes); only     */
/*  the colour differs (golden top / floury bottom).                   */
/* ------------------------------------------------------------------ */
type FaceData = {
  height: Float32Array;
  crack: Float32Array;
  lum: Float32Array;
  mean: number;
  mask: Float32Array;
  S: number;
};

function extractFaceData(p: Painting): FaceData {
  const { S, lum, mask } = p;
  const soft1 = boxBlur(lum, S, 1, 1);
  const soft4 = boxBlur(lum, S, 4, 2);
  const hat = dilate(soft1, S, 7);
  const crack = new Float32Array(S * S);
  for (let k = 0; k < S * S; k++)
    crack[k] = clamp((hat[k] - soft1[k] - 0.05) * 3.2, 0, 1) * mask[k];
  const crackSoft = boxBlur(crack, S, 1, 1);
  const low = boxBlur(lum, S, 48, 2);
  const broad = new Float32Array(S * S);
  for (let k = 0; k < S * S; k++) broad[k] = clamp((lum[k] - low[k]) * 1.5, -0.5, 0.5) * mask[k];
  const broadSoft = boxBlur(broad, S, 6, 2);
  const micro = new Float32Array(S * S);
  for (let k = 0; k < S * S; k++)
    micro[k] =
      clamp((lum[k] - soft1[k]) * 2.2, -1, 1) * 0.5 * mask[k] +
      clamp((lum[k] - soft4[k]) * 1.1, -1, 1) * 0.35 * mask[k];
  const height = new Float32Array(S * S);
  for (let k = 0; k < S * S; k++)
    height[k] = clamp(-crackSoft[k] + broadSoft[k] * 0.35 + micro[k] * 0.18, -1, 1);
  let mean = 0;
  for (let k = 0; k < S * S; k++) mean += lum[k];
  mean /= S * S;
  return { height, crack: crackSoft, lum, mean, mask, S };
}

/** Recolor a baked face painting into the pale floury base while keeping
    every knife line and the faint toast patches. */
function creamTexture(p: Painting, strength: number) {
  const { S, px, lum } = p;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const im = ctx.createImageData(S, S);
  const o = im.data;
  const cream = [233, 218, 183];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = y * S + x;
      const i = k * 4;
      const L = lum[k];
      const dx = (x / S - 0.5) * 2;
      const dy = (y / S - 0.5) * 2;
      const rr = Math.hypot(dx, dy);
      // shade cuts darker, ridges lighter
      const shade = 0.66 + 0.52 * L;
      let col = [cream[0] * shade, cream[1] * shade, cream[2] * shade];
      // keep a trace of the original dark toast patches
      const sat = px[i] - px[i + 2];
      const toast = clamp((0.82 - L) * 1.6, 0, 1) * clamp(sat / 40, 0, 1);
      col = [
        col[0] * (1 - toast * 0.5) + px[i] * toast * 0.5,
        col[1] * (1 - toast * 0.55) + px[i + 1] * toast * 0.45,
        col[2] * (1 - toast * 0.65) + px[i + 2] * toast * 0.35,
      ];
      // the outer band is a touch more golden on the base too
      const warm = smoothstep(0.8, 1.0, rr) * 0.22;
      col = [col[0] * (1 - warm) + 210 * warm, col[1] * (1 - warm) + 168 * warm, col[2] * (1 - warm) + 106 * warm];
      // flour dust
      const dust = Math.max(0, fbm2(x * 0.012 + 40, y * 0.012 + 7) - 0.55) * 2 * 18;
      o[i] = clamp(col[0] * strength + px[i] * (1 - strength) + dust, 0, 255);
      o[i + 1] = clamp(col[1] * strength + px[i + 1] * (1 - strength) + dust, 0, 255);
      o[i + 2] = clamp(col[2] * strength + px[i + 2] * (1 - strength) + dust, 0, 255);
      o[i + 3] = 255;
    }
  ctx.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

type FaceOpts = {
  pale: boolean;
  creamStrength: number;
  normalStrength: number;
  dispCompress: number;
  roughness: number;
};

function faceMaps(p: Painting, opts: FaceOpts, shared?: FaceData) {
  const d = shared ?? extractFaceData(p);
  const { S, height, crack, lum, mean } = d;
  const normalMap = normalsFromField(height, S, S, opts.normalStrength, opts.normalStrength);
  const aoWide = boxBlur(crack, S, 5, 2);
  const ormMap = canvasTex(
    S,
    S,
    (op) => {
      for (let k = 0; k < S * S; k++) {
        const cavity = clamp(crack[k] * 0.55 + aoWide[k] * 0.35, 0, 0.7);
        const rough = opts.pale
          ? clamp(opts.roughness - (lum[k] - mean) * 0.3 + crack[k] * 0.15, 0.85, 1)
          : clamp(opts.roughness - (lum[k] - mean) * 0.8 + crack[k] * 0.25, 0.55, 1);
        const i = k * 4;
        op[i] = (1 - cavity) * 255;
        op[i + 1] = rough * 255;
        op[i + 2] = 0;
        op[i + 3] = 255;
      }
    },
    false,
  );
  const displacementMap = canvasTex(
    S,
    S,
    (dp) => {
      for (let k = 0; k < S * S; k++) {
        const v = (0.5 + height[k] * 0.5 * opts.dispCompress) * 255;
        const i = k * 4;
        dp[i] = dp[i + 1] = dp[i + 2] = v;
        dp[i + 3] = 255;
      }
    },
    false,
  );
  displacementMap.minFilter = THREE.LinearFilter;
  displacementMap.generateMipmaps = false;
  const map = opts.pale ? creamTexture(p, opts.creamStrength) : p.texture;
  return { map, normalMap, ormMap, displacementMap };
}

const TOP_OPTS: FaceOpts = {
  pale: false,
  creamStrength: 0,
  normalStrength: 11,
  dispCompress: 0.9,
  roughness: 0.86,
};
const BOTTOM_OPTS: FaceOpts = {
  pale: true,
  creamStrength: 0.92,
  normalStrength: 8,
  dispCompress: 0.6,
  roughness: 0.97,
};
// near-flat cream base: faint mottle, no deep cuts
const BASE_OPTS: FaceOpts = {
  pale: false,
  creamStrength: 0,
  normalStrength: 5,
  dispCompress: 0.25,
  roughness: 0.98,
};

/* ------------------------------------------------------------------ */
/*  Rim wall from the side photo — cylindrical unwrap                  */
/* ------------------------------------------------------------------ */
function bilinear(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: number[]) {
  const x0 = clamp(Math.floor(x), 0, w - 1);
  const x1 = clamp(x0 + 1, 0, w - 1);
  const y0 = clamp(Math.floor(y), 0, h - 1);
  const y1 = clamp(y0 + 1, 0, h - 1);
  const tx = x - x0,
    ty = y - y0;
  for (let c = 0; c < 3; c++) {
    const a = data[(y0 * w + x0) * 4 + c];
    const b = data[(y0 * w + x1) * 4 + c];
    const cc = data[(y1 * w + x0) * 4 + c];
    const d = data[(y1 * w + x1) * 4 + c];
    out[c] = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + cc * (1 - tx) * ty + d * tx * ty;
  }
}

function sideMapsFromPhoto(panel: HTMLCanvasElement) {
  const { canvas: crop, centre } = cropLoaf(panel);
  const W = crop.width;
  const H = crop.height;
  const ctx = crop.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, W, H).data;

  const UW = 2048;
  const UH = 400;
  // wall occupies the vertical middle of a side view; leave lips to blend
  const V0 = 0.1;
  const V1 = 0.9;
  const rgb = [0, 0, 0];
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = UW;
  albedoCanvas.height = UH;
  const actx = albedoCanvas.getContext("2d", { willReadFrequently: true })!;
  const aim = actx.createImageData(UW, UH);
  const px = aim.data;
  const lum = new Float32Array(UW * UH);

  for (let y = 0; y < UH; y++) {
    const v = y / (UH - 1);
    const sy = (V0 + v * (V1 - V0)) * (H - 1);
    for (let x = 0; x < UW; x++) {
      const u = x / (UW - 1);
      // front half shows the photo; back half mirrors it around the loaf
      const th = u <= 0.5 ? u / 0.5 * Math.PI - Math.PI / 2 : Math.PI / 2 - ((u - 0.5) / 0.5) * Math.PI;
      const sx = (0.5 + Math.sin(th) * 0.49) * (W - 1);
      bilinear(data, W, H, sx, sy, rgb);
      const k = y * UW + x;
      const i = k * 4;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = 255;
      lum[k] = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    }
  }

  // feather the mirror seams (u = 0/1 left silhouette, u = 0.5 right silhouette)
  const seamDist = (u: number) => Math.min(u, 0.5 - Math.abs(u - 0.5), 1 - u);
  for (let x = 0; x < UW; x++) {
    const u = x / (UW - 1);
    const d = seamDist(u);
    const feather = clamp(d / 0.012, 0, 1);
    if (feather < 1) {
      for (let y = 0; y < UH; y++) {
        const k = (y * UW + x) * 4;
        px[k] = px[k] * feather + centre[0] * (1 - feather);
        px[k + 1] = px[k + 1] * feather + centre[1] * (1 - feather);
        px[k + 2] = px[k + 2] * feather + centre[2] * (1 - feather);
      }
    }
  }
  actx.putImageData(aim, 0, 0);

  // knife scores on the wall
  const soft1 = boxBlur(lum, UW, 1, 1);
  const hat = dilate(soft1, UW, 5);
  const groove = new Float32Array(UW * UH);
  for (let k = 0; k < UW * UH; k++) groove[k] = clamp((hat[k] - soft1[k] - 0.03) * 3.0, 0, 1);
  const grooveS = boxBlur(groove, UW, 1, 1);
  const mottle = new Float32Array(UW * UH);
  for (let k = 0; k < UW * UH; k++) mottle[k] = (soft1[k] - lum[k]) * 0.4;
  const height = new Float32Array(UW * UH);
  for (let k = 0; k < UW * UH; k++) height[k] = clamp(-grooveS[k] * 0.9 + mottle[k] * 0.15, -1, 0.4);

  const normalMap = normalsFromField(height, UW, UH, 11, 7);
  const ormMap = canvasTex(
    UW,
    UH,
    (op) => {
      for (let k = 0; k < UW * UH; k++) {
        const cavity = clamp(grooveS[k] * 0.7, 0, 0.7);
        const i = k * 4;
        op[i] = (1 - cavity) * 255;
        op[i + 1] = clamp(0.85 + cavity * 0.15, 0, 1) * 255;
        op[i + 2] = 0;
        op[i + 3] = 255;
      }
    },
    false,
    true,
  );
  const dispMap = canvasTex(
    UW,
    UH,
    (dp) => {
      for (let k = 0; k < UW * UH; k++) {
        const v = (0.5 + height[k] * 0.5) * 255;
        const i = k * 4;
        dp[i] = dp[i + 1] = dp[i + 2] = v;
        dp[i + 3] = 255;
      }
    },
    false,
    true,
  );
  dispMap.minFilter = THREE.LinearFilter;
  dispMap.generateMipmaps = false;

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = 8;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.ClampToEdgeWrapping;

  return { albedo, normal: normalMap, orm: ormMap, disp: dispMap, scale: 0.04 };
}

/* ------------------------------------------------------------------ */
/*  Three-view composite detection                                     */
/*  Layout: bottom half = scored top (full width), top-left quarter    */
/*  = flat bottom face, top-right quarter = side pill.                 */
/* ------------------------------------------------------------------ */
function zoneCoverage(src: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number) {
  const W = src.width;
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, W, src.height).data;
  const bg = cornerBg(data, W, src.height);
  let fg = 0,
    n = 0;
  for (let y = y0; y < y1; y += 3)
    for (let x = x0; x < x1; x += 3) {
      n++;
      if (loafPixel(data, (y * W + x) * 4, bg)) fg++;
    }
  return fg / n;
}

/* ------------------------------------------------------------------ */
/*  Default (no upload): the reference face is painted procedurally    */
/*  so it lines up exactly with the geometry.                          */
/* ------------------------------------------------------------------ */
export function prepareDefaultMaps(): PutokMaps {
  const painting = buildProceduralPainting();
  const data = extractFaceData(painting);
  const top = faceMaps(painting, TOP_OPTS, data);
  const basePainting = buildProceduralBottom();
  const baseData = extractFaceData(basePainting);
  const bottom = faceMaps(basePainting, BASE_OPTS, baseData);
  const side = buildSideMaps();
  const all = [
    top.map, top.normalMap, top.ormMap, top.displacementMap,
    bottom.map, bottom.normalMap, bottom.ormMap, bottom.displacementMap,
    side.albedo, side.normal, side.orm, side.disp,
  ];
  return {
    map: top.map,
    normalMap: top.normalMap,
    ormMap: top.ormMap,
    displacementMap: top.displacementMap,
    displacementScale: 0.075,
    bottomMap: bottom.map,
    bottomNormalMap: bottom.normalMap,
    bottomOrmMap: bottom.ormMap,
    bottomDispMap: bottom.displacementMap,
    sideMap: side.albedo,
    sideNormalMap: side.normal,
    sideOrmMap: side.orm,
    sideDispMap: side.disp,
    sideDisplacementScale: 0.04,
    dispose: () => all.forEach((t) => t.dispose()),
  };
}

/** Choose the painted default unless the baker has uploaded a photo. */
export async function preparePutokMapsAuto(): Promise<PutokMaps> {
  try {
    const head = await fetch("/api/texture?probe=1", { method: "HEAD", cache: "no-store" });
    if (head.headers.get("x-putok-source") !== "upload") return prepareDefaultMaps();
  } catch {
    return prepareDefaultMaps();
  }
  return preparePutokMaps(`/api/texture?v=${Date.now()}`);
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */
export async function preparePutokMaps(src: string): Promise<PutokMaps> {
  const img = await loadImage(src);
  const source = imageToCanvas(img);
  const W = source.width;
  const H = source.height;

  const portrait = H / W > 1.45;
  let isComposite = false;
  if (portrait) {
    const midX = Math.floor(W / 2);
    const midY = Math.floor(H / 2);
    const covBottom = zoneCoverage(source, 0, midY, W, H);
    const covTL = zoneCoverage(source, 0, 0, midX, midY);
    const covTR = zoneCoverage(source, midX, 0, W, midY);
    isComposite = covBottom > 0.3 && covTL > 0.16 && covTR > 0.13;
  }

  const DISP = 0.08;

  if (isComposite) {
    const midX = Math.floor(W / 2);
    const midY = Math.floor(H / 2);
    const facePanel = slicePanel(source, 0, midY, W, H - midY); // scored top
    const bottomPanel = slicePanel(source, 0, 0, midX, midY); // flat base
    const sidePanel = slicePanel(source, midX, 0, W - midX, midY); // side wall

    const topPainting = paintLoafSquare(facePanel);
    const top = faceMaps(topPainting, TOP_OPTS);
    const bottomPainting = paintLoafSquare(bottomPanel, 1024, [228, 212, 182]);
    // the panel is already a photo of the pale base, so keep most of its colour
    const bottom = faceMaps(bottomPainting, { ...BOTTOM_OPTS, creamStrength: 0.55 });
    const side = sideMapsFromPhoto(sidePanel);

    const all = [
      top.map, top.normalMap, top.ormMap, top.displacementMap,
      bottom.map, bottom.normalMap, bottom.ormMap, bottom.displacementMap,
      side.albedo, side.normal, side.orm, side.disp,
    ];
    return {
      map: top.map,
      normalMap: top.normalMap,
      ormMap: top.ormMap,
      displacementMap: top.displacementMap,
      displacementScale: DISP,
      bottomMap: bottom.map,
      bottomNormalMap: bottom.normalMap,
      bottomOrmMap: bottom.ormMap,
      bottomDispMap: bottom.displacementMap,
      sideMap: side.albedo,
      sideNormalMap: side.normal,
      sideOrmMap: side.orm,
      sideDispMap: side.disp,
      sideDisplacementScale: side.scale,
      dispose: () => all.forEach((t) => t.dispose()),
    };
  }

  // Single photo: it sculpts the scored top. The bottom is the same face
  // recoloured floury, and the wall is generated to match the reference.
  const painting = paintLoafSquare(source);
  const data = extractFaceData(painting);
  const top = faceMaps(painting, TOP_OPTS, data);
  const bottom = faceMaps(painting, BOTTOM_OPTS, data);
  const side = buildSideMaps();
  const all = [
    top.map, top.normalMap, top.ormMap, top.displacementMap,
    bottom.map, bottom.normalMap, bottom.ormMap, bottom.displacementMap,
    side.albedo, side.normal, side.orm, side.disp,
  ];
  return {
    map: top.map,
    normalMap: top.normalMap,
    ormMap: top.ormMap,
    displacementMap: top.displacementMap,
    displacementScale: DISP,
    bottomMap: bottom.map,
    bottomNormalMap: bottom.normalMap,
    bottomOrmMap: bottom.ormMap,
    bottomDispMap: bottom.displacementMap,
    sideMap: side.albedo,
    sideNormalMap: side.normal,
    sideOrmMap: side.orm,
    sideDispMap: side.disp,
    sideDisplacementScale: 0.045,
    dispose: () => all.forEach((t) => t.dispose()),
  };
}
