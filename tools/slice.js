// Recorta y escala (nearest-neighbor) un strip de sistema desde scans/ a un PNG
// legible para la pasada de transcripción. Sólo node:zlib — sin dependencias.
//   node tools/slice.js <in.png> <x0> <y0> <x1> <y1> <scale> <out.png>

import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

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

// CRC32 para chunks PNG.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// Bandas de sistema de p02 (y), y rango x común. Recortes ESTÁTICOS (se commitean).
export const P02_SYSTEMS = {
  x0: 40, x1: 1360, scale: 3,
  bands: { 1: [848, 1025], 2: [1030, 1225], 3: [1218, 1408], 4: [1400, 1595] },
};

function cropTo(img, X0, Y0, X1, Y1, S, outPath) {
  const cw = X1 - X0, ch = Y1 - Y0, ow = cw * S, oh = ch * S;
  const out = Buffer.alloc(ow * oh * 3);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const sx = X0 + Math.floor(x / S), sy = Y0 + Math.floor(y / S);
    const si = (sy * img.width + sx) * 3, di = (y * ow + x) * 3;
    out[di] = img.data[si]; out[di + 1] = img.data[si + 1]; out[di + 2] = img.data[si + 2];
  }
  writeFileSync(outPath, encodePNG(ow, oh, out));
  console.log(`slice ${cw}x${ch} @${S}x -> ${ow}x${oh}  ${outPath}`);
}

const argv = process.argv.slice(2);
if (argv[0] === "--systems") {
  // node tools/slice.js --systems <in.png> <outDir>
  const inPath = argv[1], outDir = argv[2];
  const img = decodePNG(inPath);
  const { x0, x1, scale, bands } = P02_SYSTEMS;
  for (const s of [1, 2, 3, 4]) {
    const [y0, y1] = bands[s];
    cropTo(img, x0, y0, x1, y1, scale, `${outDir}/p02-s${s}.png`);
  }
} else {
  // node tools/slice.js <in.png> <x0> <y0> <x1> <y1> <scale> <out.png>
  const [inPath, x0, y0, x1, y1, scale, outPath] = argv;
  cropTo(decodePNG(inPath), +x0, +y0, +x1, +y1, +scale, outPath);
}
