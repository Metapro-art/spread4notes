// Enumera el universo de voicings de 4 notas del modo. La familia 7→6 está
// FUNDIDA en el universo principal aplicando la resolución mecánica (decisión C):
//   - el 6 escrito se guarda SIEMPRE como 13 (decisión B: 9/11/13 son función,
//     nunca 2/4/6).
//   - columna CON 7  → el 13 es tensión.
//   - columna SIN 7  → el 13 reemplaza al 7 → sixthForSeventh: true.
// Combinatoriamente la familia 6 no agrega pitches nuevos: son los voicings
// sin-7-con-13. El flag es la única información que aporta 7→6.
//   node tools/generate.js --mode ionian

import { computePitches } from "../src/core/voicing.js";
import { fretsForSet } from "../src/core/fretboard.js";

// chordScale canónico por modo (etiquetas de función: 9/11/13, nunca 2/4/6).
const MODE_SCALES = {
  ionian: ["1", "9", "3", "5", "13", "7"], // 11 = avoid
};
const SETS = ["6543", "5432", "4321"];
const PLAYABLE = 8; // tocable = bestSpan < 8 (span>=8 en los 3 = físicamente imposible)

let mode = "ionian";
const mi = process.argv.indexOf("--mode");
if (mi !== -1 && process.argv[mi + 1]) mode = process.argv[mi + 1];
const chordScale = MODE_SCALES[mode];
if (!chordScale) { console.error(`Modo desconocido: ${mode}`); process.exit(1); }

function permutations(arr, k) {
  const out = [], used = new Array(arr.length).fill(false), cur = [];
  (function rec() {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = 0; i < arr.length; i++) { if (used[i]) continue; used[i] = 1; cur.push(arr[i]); rec(); cur.pop(); used[i] = 0; }
  })();
  return out;
}
const bestSpan = (d) => Math.min(...SETS.map((s) => fretsForSet(computePitches(d), s, 0).span));
const playable = (d) => bestSpan(d) < PLAYABLE;

// Universo base: permutaciones con pitches distintos (siempre, en este sistema).
const all = permutations(chordScale, 4);

// Familia 3+7: contiene 3 y 7 (base "3 + 7 + T + T").
const family37 = all.filter((d) => d.includes("3") && d.includes("7"));
const family37Play = family37.filter(playable);

// Familia 6 (sixthForSeventh): 6 reemplaza al 7. Se deriva de los 3+7 SIN 13
// (si ya hay 13, el 6 chocaría) cambiando el 7 por 13 en su posición.
const family6 = family37
  .filter((d) => !d.includes("13"))
  .map((d) => d.map((g) => (g === "7" ? "13" : g))); // sixthForSeventh: true
const family6Play = family6.filter(playable);

const total = family37Play.length + family6Play.length;

// Aparte (contexto tarea 2): familia sin 3ra (contiene 7, no 3).
const sin3 = all.filter((d) => d.includes("7") && !d.includes("3"));
const sin3Play = sin3.filter(playable);

// ── histograma de SPAN FÍSICO sobre el universo CON 3ra (3+7 ∪ familia 6) ──
// El span mide dificultad FÍSICA (estiramiento). NO se mapea a los colores del
// manuscrito: esos son juicio de gusto del autor y se transcriben, no se derivan.
const con3 = [...family37Play, ...family6Play];
const spanHist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
for (const d of con3) { spanHist[bestSpan(d)]++; }

console.log(`modo: ${mode}   chordScale: ${chordScale.join(" ")}`);
console.log("");
console.log(`FAMILIA 7→6 FUNDIDA (universo con 3ra):`);
console.log(`  |3+7 tocables|      : ${family37Play.length}`);
console.log(`  |familia 6 tocables|: ${family6Play.length}`);
console.log(`  |total|             : ${total}`);
console.log("");
console.log(`aparte — sin 3ra (contiene 7, no 3) tocables: ${sin3Play.length}`);
console.log("");
console.log(`span físico sobre universo CON 3ra (${con3.length} voicings) — NO es dificultad-color:`);
console.log(`  span:  0:${spanHist[0]} 1:${spanHist[1]} 2:${spanHist[2]} 3:${spanHist[3]} 4:${spanHist[4]} 5:${spanHist[5]} 6:${spanHist[6]} 7:${spanHist[7]}`);
