// Teoría pura — CERO DOM.
//
// fret[i] = (rootMidi + pitch[i]) - openString[i]
// span    = max(fret) - min(fret)
//
// El voicing se coloca en la posición más grave posible en la que todos los
// trastes son >= 0 (traste más bajo en [0..11]). El mismo voicing produce
// formas distintas por juego de cuerdas (3ra mayor Sol–Si); nunca se hereda.

// Afinación estándar: MIDI de cada cuerda al aire, por número de cuerda.
export const OPEN = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };

// Juegos de cuerdas (grave→agudo), como números de cuerda.
export const SET_STRINGS = {
  "6543": [6, 5, 4, 3],
  "5432": [5, 4, 3, 2],
  "4321": [4, 3, 2, 1],
};

// MIDI de cuerdas al aire por juego (grave→agudo) — equivalente a STRING_SETS de CLAUDE.md.
export const STRING_SETS = Object.fromEntries(
  Object.entries(SET_STRINGS).map(([k, ss]) => [k, ss.map((s) => OPEN[s])])
);

// Trastes y span de un voicing (pitches top→bottom) en un juego de cuerdas.
// rootPc = clase de altura de la raíz (Do = 0). La octava de la raíz se elige
// para dejar el traste más grave en [0..11] (posición más baja tocable).
export function fretsForSet(pitches, setKey, rootPc = 0) {
  const strings = SET_STRINGS[setKey];
  if (!strings) throw new Error(`Juego de cuerdas desconocido: ${setKey}`);
  const opens = strings.map((s) => OPEN[s]);
  const pg = [...pitches].reverse(); // grave→agudo
  const raw = opens.map((o, j) => rootPc + pg[j] - o);
  const shift = -12 * Math.floor(Math.min(...raw) / 12);
  const frets = raw.map((f) => f + shift);
  const rootMidi = rootPc + shift;
  const span = Math.max(...frets) - Math.min(...frets);
  return { setKey, strings, frets, span, rootMidi };
}

// Variante con salto de cuerda: la voz aguda se mueve a la cuerda inmediatamente
// más delgada, manteniendo la posición (rootMidi) del voicing base. Devuelve null
// si el juego ya usa la cuerda más aguda (1) y no hay cuerda por encima.
export function fretsWithStringSkip(pitches, setKey, rootPc = 0) {
  const base = fretsForSet(pitches, setKey, rootPc);
  const strings = SET_STRINGS[setKey];
  const skipString = strings[strings.length - 1] - 1; // una cuerda hacia arriba
  if (!(skipString in OPEN)) return null;
  const pg = [...pitches].reverse();
  const topPitch = pg[pg.length - 1];
  const topFret = base.rootMidi + topPitch - OPEN[skipString];
  const frets = [...base.frets.slice(0, 3), topFret];
  const usedStrings = [...strings.slice(0, 3), skipString];
  const span = Math.max(...frets) - Math.min(...frets);
  return { setKey, strings: usedStrings, frets, span, skipString, rootMidi: base.rootMidi };
}

// Mejor span base entre los tres juegos (para el filtro de tocabilidad).
export function bestSpan(pitches, rootPc = 0) {
  return Math.min(...Object.keys(SET_STRINGS).map((s) => fretsForSet(pitches, s, rootPc).span));
}

// Heurística de salto de cuerda: ¿el mejor span con salto mejora al mejor sin salto?
// OJO: `betterWithStringSkip` es juicio del autor (color rojo/rosa) y es ground
// truth para CALIBRAR esta heurística, no al revés.
export function betterWithStringSkip(pitches, rootPc = 0) {
  const sets = Object.keys(SET_STRINGS);
  const bestBase = Math.min(...sets.map((s) => fretsForSet(pitches, s, rootPc).span));
  const skipSpans = sets
    .map((s) => fretsWithStringSkip(pitches, s, rootPc))
    .filter(Boolean)
    .map((r) => r.span);
  const bestSkip = skipSpans.length ? Math.min(...skipSpans) : Infinity;
  return bestSkip < bestBase;
}
