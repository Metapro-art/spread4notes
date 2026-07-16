// Checksum de flechas (arcos de conducción) contra la conducción DERIVADA.
// Hipótesis del manuscrito: hay flecha desde la voz i (columna n → n+1)
// ⟺ esa voz cambió de grado entre n y n+1. Se MIDE, no se asume.
//   node tools/arcs.js data/draft/p02-jonico.json
//
// Reporta total de pares medidos, cuántos cumplen, cuántos no, y lista los que
// no. Cada incumplimiento es un error de lectura: NO se corrige aquí.

import { readFileSync } from "node:fs";

const path = process.argv[2] || "data/draft/p02-jonico.json";
const doc = JSON.parse(readFileSync(path, "utf8"));
const vs = [...doc.voicings].sort((a, b) => a.order - b.order);

let measured = 0, ok = 0;
const fails = [];
let withArcs = 0;

for (let n = 0; n < vs.length - 1; n++) {
  const a = vs[n], b = vs[n + 1];
  if (a.system !== b.system) continue;           // los arcos no cruzan de sistema
  if (!Array.isArray(a.arcsToNext)) continue;     // sin flechas transcritas aún
  withArcs++;
  for (let i = 0; i < 4; i++) {
    const derived = a.degrees[i] !== b.degrees[i]; // ¿cambió de grado esa voz?
    const arc = !!a.arcsToNext[i];
    measured++;
    if (derived === arc) ok++;
    else fails.push(`${a.id}→${b.id} voz ${i} (top=0): flecha=${arc} pero cambió=${derived}`);
  }
}

console.log(`archivo: ${path}`);
console.log(`columnas con arcsToNext transcritos: ${withArcs}`);
if (measured === 0) {
  console.log("Aún no hay flechas transcritas (arcsToNext). Nada que medir.");
  process.exit(0);
}
const pct = ((ok / measured) * 100).toFixed(1);
console.log(`voces medidas: ${measured}   cumplen: ${ok}   no cumplen: ${fails.length}   (${pct}%)`);
for (const f of fails) console.log(`  ✗ ${f}`);
if (ok / measured > 0.95) {
  console.log("\n>95% ⇒ las flechas son un CHECKSUM redundante: se pueden derivar de order+degrees.");
} else {
  console.log("\n<=95% ⇒ las flechas aportan información / hay errores de lectura. Reportar, no corregir.");
}
