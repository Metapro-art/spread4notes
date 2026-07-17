// Valida una transcripción contra el universo legal del modo. Cada voicing que
// no exista en el universo legal "salta solo" (dígito mal leído o hueco del
// generador). Exporta validateVoicing() y corre como CLI.
//   node tools/validate.js <transcription.json>
//
// NOTA: la invariante #3 de CLAUDE.md ("span<=5 en algún juego") quedó SUPERADA
// — el span clasifica, no excluye. Aquí se sustituye por "físicamente posible"
// (span<8 en los tres juegos).

// Node-only builtins (node:fs, node:url) se cargan con import() dinámico dentro
// del bloque CLI, para que este módulo también se pueda importar en el navegador.
import { SEMITONE } from "../src/core/degrees.js";
import { computePitches } from "../src/core/voicing.js";
import { fretsForSet } from "../src/core/fretboard.js";

const SETS = ["6543", "5432", "4321"];

// Etiquetas CANÓNICAS por modo (decisión B: 9/11/13, nunca 2/4/6). Grados RESUELTOS.
const ALLOWED = {
  ionian: new Set(["1", "9", "3", "5", "13", "7"]),
  dorian: new Set(["1", "9", "b3", "11", "5", "13", "b7"]),
  aeolian: new Set(["1", "9", "b3", "11", "5", "b13", "b7"]),
};
const RAW_DIGITS = new Set(["2", "4", "6"]); // nunca deben llegar (decisión B)
const MODE_RULE = {
  ionian: (d) => d.includes("7") || d.includes("13"), // 7 o su sustituto 6→13
  // dórico/eólico: 3+7+T+T, pero la 7ma se puede reemplazar por tensión (3+T+T+T).
  // Sin regla dura extra: bastan los checks estructurales (4 distintos, en escala).
  dorian: () => true,
  aeolian: () => true,
};

const bestSpan = (degrees) =>
  Math.min(...SETS.map((s) => fretsForSet(computePitches(degrees), s, 0).span));

// Devuelve un array de motivos de rechazo (vacío = aceptado).
export function validateVoicing(d, mode) {
  const allowed = ALLOWED[mode];
  const rule = MODE_RULE[mode];
  if (!allowed || !rule) throw new Error(`Modo sin reglas de validación: ${mode}`);
  const reasons = [];
  if (d.length !== 4) reasons.push("no tiene 4 grados");
  const raw = d.filter((g) => RAW_DIGITS.has(g));
  if (raw.length) reasons.push(`dígito crudo sin resolver (B): ${raw.join(",")}`);
  const unknown = d.filter((g) => !allowed.has(g) && !RAW_DIGITS.has(g));
  if (unknown.length) reasons.push(`grado(s) fuera del modo: ${unknown.join(",")}`);
  if (reasons.length === 0) {
    const pitches = d.map((g) => SEMITONE[g]);
    if (new Set(pitches).size !== 4) reasons.push(`pitch duplicado (${d.join(" ")} → ${pitches.join(",")})`);
    if (!rule(d)) reasons.push("no cumple regla del modo (falta 7 o 6→13)");
    if (reasons.length === 0 && bestSpan(d) >= 8) reasons.push("span>=8 en los 3 juegos (imposible)");
  }
  return reasons;
}

// CLI (solo en Node; en el navegador `process` no existe)
if (typeof process !== "undefined" && process.argv[1] && process.argv[1] === (await import("node:url")).fileURLToPath(import.meta.url)) {
  const { readFileSync } = await import("node:fs");
  const path = process.argv[2];
  if (!path) { console.error("uso: node tools/validate.js <transcription.json>"); process.exit(1); }
  const doc = JSON.parse(readFileSync(path, "utf8"));
  let accepted = 0;
  const rejects = [];
  for (const v of doc.voicings) {
    const reasons = validateVoicing(v.degrees, doc.mode);
    if (reasons.length === 0) accepted++;
    else rejects.push({ id: v.id, degrees: v.degrees.join(" "), reasons });
  }
  console.log(`archivo: ${path}   modo: ${doc.mode}`);
  console.log(`voicings transcritos : ${doc.voicings.length}`);
  console.log(`ACEPTADOS            : ${accepted}`);
  console.log(`RECHAZADOS           : ${rejects.length}`);
  console.log(`% captura            : ${((accepted / doc.voicings.length) * 100).toFixed(1)}%`);
  for (const r of rejects) console.log(`  ✗ ${r.id} [${r.degrees}] : ${r.reasons.join("; ")}`);
}
