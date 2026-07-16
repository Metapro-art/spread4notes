// Tests de regresión OBLIGATORIOS de CLAUDE.md.
// Si no pasan, el motor está mal. NO se ajusta el test.
//   node tests/regression.test.js

import assert from "node:assert/strict";
import { computePitches, computeIntervals } from "../src/core/voicing.js";
import { fretsForSet, fretsWithStringSkip, betterWithStringSkip } from "../src/core/fretboard.js";

// Nombres en español con bemoles (los modos del estudio se escriben con bemoles).
const NOTES_ES = ["Do", "Reb", "Re", "Mib", "Mi", "Fa", "Solb", "Sol", "Lab", "La", "Sib", "Si"];
const noteEs = (rootPc, pitch) => NOTES_ES[(((rootPc + pitch) % 12) + 12) % 12];
// El manuscrito lista las voces top→bottom; las notas de la regresión están
// escritas grave→agudo, así que comparamos bottom-up.
const notesBottomUp = (degrees, rootPc) =>
  [...computePitches(degrees)].reverse().map((p) => noteEs(rootPc, p));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

// ── Regresión 1: degrees ["9","13","3","7"] (top→bottom), raíz Do ──────────
test("R1 notas (grave→agudo) = Si Mi La Re", () => {
  assert.deepEqual(notesBottomUp(["9", "13", "3", "7"], 0), ["Si", "Mi", "La", "Re"]);
});
test("R1 6543 → trastes 7-7-7-7 (span 0)", () => {
  const r = fretsForSet(computePitches(["9", "13", "3", "7"]), "6543", 0);
  assert.deepEqual(r.frets, [7, 7, 7, 7]);
  assert.equal(r.span, 0);
});
test("R1 4321 → trastes 9-9-10-10 (span 1)", () => {
  const r = fretsForSet(computePitches(["9", "13", "3", "7"]), "4321", 0);
  assert.deepEqual(r.frets, [9, 9, 10, 10]);
  assert.equal(r.span, 1);
});

// ── Regresión 2: degrees ["1","11","b7","b5"] (top→bottom), raíz Do, locrio ─
test("R2 notas (grave→agudo) = Solb Sib Fa Do", () => {
  assert.deepEqual(notesBottomUp(["1", "11", "b7", "b5"], 0), ["Solb", "Sib", "Fa", "Do"]);
});
test("R2 intervals (top→bottom) = [7,7,4]", () => {
  assert.deepEqual(computeIntervals(["1", "11", "b7", "b5"]), [7, 7, 4]);
});
test("R2 6543 → trastes 2-1-3-5 (span 4)", () => {
  const r = fretsForSet(computePitches(["1", "11", "b7", "b5"]), "6543", 0);
  assert.deepEqual(r.frets, [2, 1, 3, 5]);
  assert.equal(r.span, 4);
});
test("R2 salto a la 2da cuerda → trastes 2-1-3-1 (span 2)", () => {
  const r = fretsWithStringSkip(computePitches(["1", "11", "b7", "b5"]), "6543", 0);
  assert.deepEqual(r.frets, [2, 1, 3, 1]);
  assert.equal(r.span, 2);
  assert.equal(r.skipString, 2); // 2da cuerda (Si)
});
test("R2 betterWithStringSkip === true", () => {
  assert.equal(betterWithStringSkip(computePitches(["1", "11", "b7", "b5"]), 0), true);
});

console.log(`\n${passed} tests passed`);
