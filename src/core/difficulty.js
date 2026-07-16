// Teoría pura — CERO DOM.
//
// Heurística de dificultad por span (best span entre los 3 juegos de cuerdas).
// Umbrales fijados por el autor: 0-4 / 5-6 / 7.
//
// RECALIBRACIÓN (turno actual) sobre el universo CON 3ra jónico (3+7 ∪ familia
// 6, tocables, sin filtro de cluster; 173 voicings — `tools/generate.js`):
//
//   span 0-4  → "normal"    : 74/173 = 42.8%   (0:4 1:4 2:18 3:11 4:37)
//   span 5-6  → "hard"      : 69/173 = 39.9%   (5:42 6:27)
//   span 7    → "veryHard"  : 30/173 = 17.3%
//
// ⚠ Estos umbrales NO reproducen el ~33/44/18 de la calibración anterior. Esa
// medición corría sobre 89 voicings post-cluster que mezclaban ~31% sin-3ra
// (la página tiene ~5%); al corregir el universo, "normal" pasa a ser la
// mayoría, no "hard". La coincidencia previa fue en buena parte suerte. No se
// ajustaron los umbrales para forzar el objetivo.
//
// span >= 8 es físicamente imposible (span>=8 en los tres juegos) y no debería
// llegar aquí; se marca "impossible" para que salte en validación, no se oculta.
//
// NOTA: `difficulty` del manuscrito (amarillo=hard, naranja=veryHard) es el
// ground truth del autor; esta heurística es la aproximación a calibrar contra
// él, no al revés.

export function difficultyForSpan(bestSpan) {
  if (bestSpan <= 4) return "normal";
  if (bestSpan <= 6) return "hard";
  if (bestSpan === 7) return "veryHard";
  return "impossible";
}
