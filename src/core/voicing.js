// Teoría pura — CERO DOM.
//
// Un voicing = 4 grados resueltos, guardados SIEMPRE top→bottom (idéntico al
// manuscrito): degrees[0] = voz más aguda, degrees[3] = voz más grave.
//
// Derivación determinista de alturas: partiendo de la voz grave, cada voz
// superior es la instancia más cercana por encima de la anterior. Los 4 grados
// determinan la forma completa — sin ambigüedad de octava, sin inversiones.

import { SEMITONE, interval } from "./degrees.js";

// Intervalos entre voces adyacentes, top→bottom (3 valores para 4 voces).
// intervals[i] = intervalo desde la voz inferior (i+1) hasta la superior (i).
export function computeIntervals(degrees) {
  if (degrees.length !== 4) throw new Error("Un voicing tiene exactamente 4 grados");
  const out = [];
  for (let i = 0; i < 3; i++) {
    out.push(interval(degrees[i + 1], degrees[i]));
  }
  return out;
}

// Pitches relativos a la raíz, top→bottom. Se construye desde la voz grave;
// cada voz superior se apila el intervalo mínimo por encima de la anterior.
export function computePitches(degrees) {
  if (degrees.length !== 4) throw new Error("Un voicing tiene exactamente 4 grados");
  const pitches = new Array(4);
  const bottom = SEMITONE[degrees[3]];
  if (bottom === undefined) throw new Error(`Grado sin semitono: ${degrees[3]}`);
  pitches[3] = bottom; // voz grave, octava base
  for (let i = 2; i >= 0; i--) {
    if (SEMITONE[degrees[i]] === undefined) throw new Error(`Grado sin semitono: ${degrees[i]}`);
    pitches[i] = pitches[i + 1] + interval(degrees[i + 1], degrees[i]);
  }
  return pitches;
}
