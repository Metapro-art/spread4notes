// Detección ESTRUCTURAL de columnas — corre ANTES de leer ningún dígito.
// La fila de la voz superior tiene exactamente un dígito por columna: se cuenta
// ahí (los arcos de conducción están más abajo y no puentean esta fila).
//
// Salida: centro X de cada columna por sistema, y el conteo por sistema. Sólo
// node:zlib — sin dependencias. NO lee dígitos, NO ajusta a ningún objetivo.
//   node tools/columns.js [scans/p02-jonico.png]

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function decodePNG(path) {
  const buf = readFileSync(path);
  let off = 8, width, height, bitDepth, colorType, interlace;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 2 || interlace !== 0) throw new Error("PNG no soportado");
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = width * bpp, out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], ri = y * (stride + 1) + 1, ro = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[ri + x], a = x >= bpp ? out[ro + x - bpp] : 0, b = y > 0 ? out[ro - stride + x] : 0, c = x >= bpp && y > 0 ? out[ro - stride + x - bpp] : 0;
      let val;
      switch (f) { case 0: val = v; break; case 1: val = v + a; break; case 2: val = v + b; break; case 3: val = v + ((a + b) >> 1); break; case 4: val = v + paeth(a, b, c); break; default: throw new Error("filtro " + f); }
      out[ro + x] = val & 0xff;
    }
  }
  return { width, height, data: out };
}

const path = process.argv[2] || "scans/p02-jonico.png";
const { width: W, height: H, data } = decodePNG(path);

// Tinta = píxel oscuro (descarta papel y pentagrama gris claro).
const INK_V = 105; // 0..255 (~0.41)
const ink = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 3;
  const mx = Math.max(data[o], data[o + 1], data[o + 2]);
  if (mx < INK_V) ink[y * W + x] = 1;
}

const LEFT = 430;  // salta etiquetas "Top note"/"+Grave" y la llave "}"
const smooth = (p, win) => {
  const out = new Array(p.length).fill(0), hw = win >> 1;
  for (let i = 0; i < p.length; i++) { let s = 0, n = 0; for (let k = i - hw; k <= i + hw; k++) if (k >= 0 && k < p.length) { s += p[k]; n++; } out[i] = s / n; }
  return out;
};

// Proyección horizontal (tinta por fila) para localizar filas de texto.
function rowInk(x0, x1) {
  const prof = new Array(H).fill(0);
  for (let y = 0; y < H; y++) { let s = 0; for (let x = x0; x < x1; x++) s += ink[y * W + x]; prof[y] = s; }
  return prof;
}

// Dentro de una banda de sistema, la fila de texto superior: se centra en la
// fila de máxima tinta de la mitad alta y se toma ±HALF px (alto de un dígito).
const HALF = 26;
function topRowBand(y0, y1) {
  const rp = smooth(rowInk(LEFT, W), 3);
  let best = y0, bestV = -1;
  for (let y = y0; y < y0 + Math.round((y1 - y0) * 0.5); y++) if (rp[y] > bestV) { bestV = rp[y]; best = y; }
  return [Math.max(y0, best - HALF), Math.min(y1, best + HALF)];
}

// Cuenta columnas = picos de la proyección vertical de tinta en la banda dada.
function countCols(yb0, yb1, dbg) {
  const prof = new Array(W).fill(0);
  for (let x = LEFT; x < W; x++) { let s = 0; for (let y = yb0; y < yb1; y++) s += ink[y * W + x]; prof[x] = s; }
  const sp = smooth(prof, 5);
  const MIN_DIST = 30;      // paso mínimo entre dígitos de columnas contiguas
  const MIN_H = 2;          // altura mínima de tinta para contar como dígito
  const peaks = [];
  for (let x = LEFT + 1; x < W - 1; x++) {
    if (sp[x] >= MIN_H && sp[x] >= sp[x - 1] && sp[x] > sp[x + 1]) {
      const last = peaks[peaks.length - 1];
      if (last !== undefined && x - last < MIN_DIST) { if (sp[x] > sp[last]) peaks[peaks.length - 1] = x; }
      else peaks.push(x);
    }
  }
  if (dbg) {
    // vuelca el perfil suavizado cada 1px comprimido a bloques de ~7px
    let line = "";
    for (let x = LEFT; x < W; x += 6) line += Math.min(9, Math.round(sp[x]));
    console.log(`  perfil(${LEFT}..${W} paso6): ${line}`);
  }
  return peaks;
}

// Autodetección de bandas de sistema por proyección horizontal de tinta:
// corridas de filas con tinta > umbral, más altas que MIN_SYS_H, separadas por
// gaps (los sistemas de columnas están separados por pentagrama gris = poca tinta).
function detectSystems() {
  const rp = smooth(rowInk(LEFT, W), 5);
  const peak = Math.max(...rp);
  const thr = peak * 0.16;
  const MIN_SYS_H = 70, MIN_GAP = 22;
  const runs = [];
  let start = -1;
  for (let y = 0; y < H; y++) {
    if (rp[y] >= thr) { if (start < 0) start = y; }
    else if (start >= 0) {
      if (y - start >= 30) runs.push([start, y]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, H]);
  // fusiona corridas separadas por gaps chicos (filas dentro del mismo sistema)
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] < MIN_GAP) last[1] = r[1];
    else merged.push([...r]);
  }
  return merged.filter(([a, b]) => b - a >= MIN_SYS_H);
}

const SYSTEMS = detectSystems();

console.log(`archivo: ${path}  (${W}×${H})   INK_V=${INK_V}  LEFT=${LEFT}`);
console.log(`sistemas detectados: ${SYSTEMS.length}  bandas y: ${SYSTEMS.map(([a, b]) => `[${a},${b}]`).join(" ")}`);
let total = 0;
const perSystem = [];
SYSTEMS.forEach(([y0, y1], i) => {
  const [ry0, ry1] = topRowBand(y0, y1);
  const peaks = countCols(ry0, ry1, false);
  perSystem.push(peaks.length);
  total += peaks.length;
  console.log(`\nSISTEMA ${i + 1}  banda y=[${y0},${y1}]  fila-top y=[${ry0},${ry1}]  columnas: ${peaks.length}`);
  console.log(`  centros X: ${peaks.join(", ")}`);
});
console.log(`\n== conteo por sistema: [${perSystem.join(", ")}]  TOTAL: ${total} ==`);
console.log(`(la proyección de tinta SUBCUENTA en este JPEG: es un piso, no la verdad)`);
