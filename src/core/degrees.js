// Teoría pura — CERO DOM. Testeable con `node` puro.
//
// Los dígitos del manuscrito son ÍNDICES DE GRADO, no etiquetas absolutas.
// La alteración la aporta el chordScale del modo. Aquí sólo se manejan
// grados YA resueltos ("b5", "#11", ...) más la resolución de dígito crudo.

// Tabla de grados → semitonos desde la raíz (CLAUDE.md).
// b5/#11 y #5/b13 y 6/13 suenan igual pero NO son intercambiables como etiqueta.
export const SEMITONE = {
  "1": 0,
  "b9": 1,
  "9": 2,
  "b3": 3,
  "3": 4,
  "11": 5,
  "b5": 6, "#11": 6,
  "5": 7,
  "#5": 8, "b13": 8,
  "6": 9, "13": 9,
  "b7": 10,
  "7": 11,
};

// Intervalo hacia arriba entre dos grados: la instancia más cercana de `b`
// por encima de `a`. Nunca 0 — no existen notas duplicadas en este sistema.
export const interval = (a, b) => (((SEMITONE[b] - SEMITONE[a]) % 12) + 12) % 12;

// Número de grado "core" (sin alteración): "b5" → 5, "#11" → 11, "b13" → 13.
// Dentro de un chordScale cada core aparece exactamente una vez ⇒ es clave única.
export const degreeCore = (deg) => parseInt(String(deg).replace(/[b#]/g, ""), 10);

// Resuelve un dígito crudo del manuscrito contra el chordScale de un modo.
// El dígito es un índice; la escala del modo aporta la alteración.
//
// `alternates` (opcional) mapea grado por defecto → alternativa (p. ej. locrio
// { "b9": "9" }). Con `preferAlternate: true` devuelve la alternativa cuando
// existe — este bit sólo lo aporta el desambiguador de color, nunca el dígito.
export function resolveDigit(digit, chordScale, { preferAlternate = false, alternates } = {}) {
  const n = parseInt(String(digit), 10);
  if (Number.isNaN(n)) throw new Error(`Dígito inválido: ${digit}`);
  const match = chordScale.find((d) => degreeCore(d) === n);
  if (!match) {
    throw new Error(`Grado ${digit} no existe en la escala ${chordScale.join(" ")}`);
  }
  if (preferAlternate && alternates && alternates[match] !== undefined) {
    return alternates[match];
  }
  return match;
}
