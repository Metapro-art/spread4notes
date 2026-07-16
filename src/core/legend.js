// Teoría pura — CERO DOM.
//
// El SIGNIFICADO de cada color vive AQUÍ, nunca en /data/. En /data/ se guarda
// el color OBSERVADO y literal (`highlight`); esta tabla lo traduce a su rol.
// Regla permanente: /data/ guarda lo que se ve, nunca lo que significa.
//
// Amarillo y naranja NO son dificultad: son juicio de GUSTO del autor —
// recomendaciones, no advertencias. Rojo es la única advertencia (cómodo solo
// saltando cuerda). Azul solo existe en locrio. Los colores NO se derivan del
// span (eso medía dificultad física, cosa distinta): se transcriben del escaneo.

export const LEGEND = {
  yellow: "Chévere",
  orange: "Buenísimo",
  red: "Difícil en cuerdas contiguas — mejor saltando cuerda",
  blue: "Locrio ♮9",
};

// Eje semántico de cada color: recomendación (gusto) vs. advertencia (física).
// La UI las presenta distinto — nunca al revés.
export const LEGEND_KIND = {
  yellow: "recommend",
  orange: "recommend",
  red: "warn",
  blue: "mode",
};
