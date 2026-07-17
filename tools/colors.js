// Extrae el resaltado del manuscrito por muestreo de píxeles (SIN OCR). Emite UN
// REGISTRO POR COLUMNA RESALTADA {system, color, x, y}, no sólo totales, para
// poder unir el color a cada voicing por proximidad de X.
//   node tools/colors.js [scans/p02-jonico.png] [--json]
//
// Método: por sistema y por color, proyecta la máscara de ese color sobre el eje
// X y cuenta picos (columnas). Umbrales FIJOS; NO se ajustan a ningún objetivo.

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const S_MIN = 0.20, V_MIN = 0.45; // coloreado = saturado y no oscuro
// Rangos de hue (grados). El morado/azul pueden necesitar afinarse contra el
// escaneo concreto (el resaltador varía). Se reporta, no se fuerza.
const HUE = {
  yellow: (h) => h >= 45 && h < 70,
  orange: (h) => h >= 20 && h < 45,
  blue:   (h) => h >= 175 && h < 250,
  purple: (h) => h >= 250 && h < 320,
  red:    (h) => h >= 320 || h < 20,   // rojo/rosa
};
const LEFT = 430;
const MIN_DIST = 30;   // separación mínima entre columnas
const MIN_COL_INK = 8; // filas coloreadas mínimas en la columna para contar
// Bandas de sistema (y) — por defecto p02 (4 sistemas). Se sobreescribe con --sys.
const SYSTEMS = [[855, 1025], [1055, 1235], [1245, 1410], [1415, 1585]];

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
const classify = (h) => {
  for (const c of ["yellow", "orange", "blue", "purple", "red"]) if (HUE[c](h)) return c;
  return null;
};

const smooth = (p, win) => {
  const out = new Array(p.length).fill(0), hw = win >> 1;
  for (let i = 0; i < p.length; i++) { let s = 0, n = 0; for (let k = i - hw; k <= i + hw; k++) if (k >= 0 && k < p.length) { s += p[k]; n++; } out[i] = s / n; }
  return out;
};

const path = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "scans/p02-jonico.png";
const asJson = process.argv.includes("--json");
const { width: W, height: H, data } = decodePNG(path);

// Máscara por color.
const COLORS = ["yellow", "orange", "blue", "purple", "red"];
const mask = {}; for (const c of COLORS) mask[c] = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = LEFT; x < W; x++) {
  const o = (y * W + x) * 3;
  const [h, s, v] = rgb2hsv(data[o], data[o + 1], data[o + 2]);
  if (s < S_MIN || v < V_MIN) continue;
  const c = classify(h);
  if (c) mask[c][y * W + x] = 1;
}

// Por sistema y color: proyección X → picos = columnas resaltadas.
const records = []; // {system, color, x, y}
const perColor = Object.fromEntries(COLORS.map((c) => [c, 0]));
const perSystem = SYSTEMS.map(() => Object.fromEntries(COLORS.map((c) => [c, 0])));

SYSTEMS.forEach(([y0, y1], si) => {
  for (const c of COLORS) {
    const prof = new Array(W).fill(0);
    for (let x = LEFT; x < W; x++) { let s = 0; for (let y = y0; y < y1; y++) s += mask[c][y * W + x]; prof[x] = s; }
    const sp = smooth(prof, 7);
    const peaks = [];
    for (let x = LEFT + 1; x < W - 1; x++) {
      if (sp[x] >= MIN_COL_INK && sp[x] >= sp[x - 1] && sp[x] > sp[x + 1]) {
        const last = peaks[peaks.length - 1];
        if (last !== undefined && x - last < MIN_DIST) { if (sp[x] > sp[last]) peaks[peaks.length - 1] = x; }
        else peaks.push(x);
      }
    }
    for (const x of peaks) {
      // y central de la columna coloreada (para el registro)
      let ys = 0, yn = 0;
      for (let y = y0; y < y1; y++) for (let dx = -12; dx <= 12; dx++) if (mask[c][y * W + x + dx]) { ys += y; yn++; }
      records.push({ system: si + 1, color: c, x, y: yn ? Math.round(ys / yn) : (y0 + y1) >> 1 });
      perColor[c]++; perSystem[si][c]++;
    }
  }
});

if (asJson) { console.log(JSON.stringify(records, null, 0)); process.exit(0); }

const line = (p) => COLORS.filter((c) => p[c]).map((c) => `${c} ${p[c]}`).join("  ") || "(ninguno)";
console.log(`archivo: ${path}  (${W}×${H})   S>=${S_MIN} V>=${V_MIN}  LEFT=${LEFT}`);
console.log(`hue: amarillo[45,70) naranja[20,45) azul[175,250) morado[250,320) rojo[320,360)∪[0,20)`);
console.log("");
perSystem.forEach((p, i) => console.log(`  sistema ${i + 1}:  ${line(p)}`));
console.log("");
console.log(`  TOTAL  ${line(perColor)}`);
console.log(`  columnas resaltadas: ${records.length}   (usa --json para el detalle X/Y)`);
