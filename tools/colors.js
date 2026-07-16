// Extrae el resaltado del manuscrito por muestreo de píxeles (SIN OCR, sin leer
// dígitos). Detecta blobs de resaltador por hue, los cuenta por columna y estima
// el total de columnas.
//   node tools/colors.js [scans/p02-jonico.png]
//
// Decodificador PNG mínimo integrado (colortype 2 RGB, 8-bit, no-interlaced),
// sólo con node:zlib — sin dependencias externas.

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

// ── umbrales FIJOS (elegidos para separar tinta/papel/resaltado; NO ajustados
// para cuadrar ninguna distribución) ───────────────────────────────────────
const S_MIN = 0.20; // saturación mínima para considerar "coloreado"
const V_MIN = 0.45; // brillo mínimo (descarta tinta negra)
const INK_V = 0.40; // brillo máximo para "tinta"
// Bins de hue (grados). El valle empírico entre naranja y amarillo está en ~45°.
const HUE = {
  yellow: (h) => h >= 45 && h < 70,
  orange: (h) => h >= 20 && h < 45,
  redpink: (h) => h >= 330 || h < 20,
};
const MIN_BLOB_AREA = 200; // px; descarta motas de compresión
const LEGEND_Y = 820;      // sobre esta y está el swatch de leyenda "= Sin 3ra", no es columna
// Bandas de sistema (y), derivadas de los valles de la proyección de tinta de p02.
const SYSTEM_BANDS = [[855, 1015], [1055, 1215], [1235, 1400], [1410, 1580]];
const PEAK_SMOOTH = 17;  // ventana de suavizado para proyección de columnas
const PEAK_MINDIST = 40; // px; separación mínima entre columnas (≈ paso de dígito)
const LEFT_MARGIN = 330; // x; recorta etiquetas "Top note"/"+Grave"

// ── PNG ──────────────────────────────────────────────────────────────────────
function decodePNG(path) {
  const buf = readFileSync(path);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error("no es PNG");
  let off = 8, width, height, bitDepth, colorType, interlace;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 2 || interlace !== 0)
    throw new Error(`PNG no soportado: depth=${bitDepth} color=${colorType} interlace=${interlace}`);
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = width * bpp, out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], rowIn = y * (stride + 1) + 1, rowOut = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[rowIn + x];
      const a = x >= bpp ? out[rowOut + x - bpp] : 0;
      const b = y > 0 ? out[rowOut - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[rowOut - stride + x - bpp] : 0;
      let val;
      switch (filter) {
        case 0: val = v; break;
        case 1: val = v + a; break;
        case 2: val = v + b; break;
        case 3: val = v + ((a + b) >> 1); break;
        case 4: val = v + paeth(a, b, c); break;
        default: throw new Error("filtro " + filter);
      }
      out[rowOut + x] = val & 0xff;
    }
  }
  return { width, height, data: out };
}

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = h * 60; if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function classify(h) {
  if (HUE.yellow(h)) return "yellow";
  if (HUE.orange(h)) return "orange";
  if (HUE.redpink(h)) return "redpink";
  return "other";
}

// ── main ─────────────────────────────────────────────────────────────────────
const path = process.argv[2] || "scans/p02-jonico.png";
const { width: W, height: H, data } = decodePNG(path);

// Máscara de color etiquetada (1 yellow, 2 orange, 3 redpink, 4 other).
const CID = { yellow: 1, orange: 2, redpink: 3, other: 4 };
const NAME = { 1: "yellow", 2: "orange", 3: "redpink", 4: "other" };
const lab = new Uint8Array(W * H);
const ink = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 3;
  const [h, s, v] = rgb2hsv(data[o], data[o + 1], data[o + 2]);
  if (v < INK_V) ink[y * W + x] = 1;
  if (s >= S_MIN && v >= V_MIN) lab[y * W + x] = CID[classify(h)];
}

// Componentes conexas (8-conn) de la máscara de color, y>=LEGEND_Y.
function components() {
  const seen = new Uint8Array(W * H), blobs = [], stack = [];
  for (let y = LEGEND_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const idx = y * W + x;
    if (lab[idx] === 0 || seen[idx]) continue;
    const col = lab[idx];
    stack.length = 0; stack.push(idx); seen[idx] = 1;
    let area = 0, minx = W, maxx = 0, miny = H, maxy = 0;
    while (stack.length) {
      const p = stack.pop(), py = (p / W) | 0, px = p % W;
      area++;
      if (px < minx) minx = px; if (px > maxx) maxx = px;
      if (py < miny) miny = py; if (py > maxy) maxy = py;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || nx >= W || ny < LEGEND_Y || ny >= H) continue;
        const np = ny * W + nx;
        if (!seen[np] && lab[np] === col) { seen[np] = 1; stack.push(np); }
      }
    }
    if (area >= MIN_BLOB_AREA) blobs.push({ col, area, h: maxy - miny });
  }
  return blobs;
}
const blobs = components();

// Un blob de resaltador puede cubrir la MISMA columna a través de 2 sistemas
// (trazo continuo). Nº de columnas del blob = round(alto / alto_mediano de blob).
const median = (arr) => { const a = [...arr].sort((x, y) => x - y); return a[a.length >> 1]; };
const medH = median(blobs.map((b) => b.h)) || 1;
const highlighted = { yellow: 0, orange: 0, redpink: 0 };
for (const b of blobs) {
  const cols = Math.max(1, Math.round(b.h / medH));
  highlighted[NAME[b.col]] += cols;
}
const totalHighlighted = highlighted.yellow + highlighted.orange + highlighted.redpink;

// ── total de columnas (tinta) — BAJA CONFIANZA: los arcos de conducción
// melódica conectan columnas adyacentes y borran los huecos. ─────────────────
function colProfile(y0, y1) {
  const prof = new Array(W).fill(0);
  for (let x = LEFT_MARGIN; x < W; x++) { let s = 0; for (let y = y0; y < y1; y++) s += ink[y * W + x]; prof[x] = s; }
  return prof;
}
function smooth(p, win) {
  const out = new Array(p.length).fill(0), hw = win >> 1;
  for (let i = 0; i < p.length; i++) { let s = 0, n = 0; for (let k = i - hw; k <= i + hw; k++) if (k >= 0 && k < p.length) { s += p[k]; n++; } out[i] = s / n; }
  return out;
}
function countPeaks(p) {
  const peaks = [];
  for (let x = LEFT_MARGIN + 1; x < W - 1; x++) {
    if (p[x] >= 3 && p[x] >= p[x - 1] && p[x] > p[x + 1]) {
      const last = peaks[peaks.length - 1];
      if (last !== undefined && x - last < PEAK_MINDIST) { if (p[x] > p[last]) peaks[peaks.length - 1] = x; }
      else peaks.push(x);
    }
  }
  return peaks.length;
}
const perSystemCols = SYSTEM_BANDS.map(([y0, y1]) => countPeaks(smooth(colProfile(y0, y1), PEAK_SMOOTH)));
const totalCols = perSystemCols.reduce((a, b) => a + b, 0);
const unhighlighted = totalCols - totalHighlighted;

// ── salida ────────────────────────────────────────────────────────────────────
console.log(`archivo: ${path}  (${W}×${H})`);
console.log(`umbrales FIJOS: S>=${S_MIN} V>=${V_MIN} | hue amarillo[45,70) naranja[20,45) rojo-rosa[330,360)∪[0,20)`);
console.log(`blobs de color detectados: ${blobs.length}  (alto mediano ${medH}px)`);
console.log("");
console.log(`── columnas resaltadas por color (ALTA confianza) ──`);
console.log(`  amarillo   : ${highlighted.yellow}`);
console.log(`  naranja    : ${highlighted.orange}`);
console.log(`  rojo-rosa  : ${highlighted.redpink}`);
console.log(`  TOTAL resaltadas : ${totalHighlighted}`);
console.log("");
console.log(`── total de columnas por proyección de tinta (BAJA confianza: arcos de`);
console.log(`   conducción puentean columnas) ──`);
console.log(`  columnas por sistema : [${perSystemCols.join(", ")}]`);
console.log(`  TOTAL columnas       : ${totalCols}`);
console.log(`  sin resaltar (= total − resaltadas) : ${unhighlighted}`);
