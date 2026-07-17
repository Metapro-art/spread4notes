// Teoría pura — CERO DOM.
//
// El SIGNIFICADO de cada color vive AQUÍ, nunca en /data/. En /data/ se guarda
// el color OBSERVADO y literal (`highlight`); esta tabla lo traduce a su rol.
// Regla permanente: /data/ guarda lo que se ve, nunca lo que significa.
//
// Amarillo y naranja = juicio de GUSTO (recomendaciones). Morado = recomendación
// específica: suena muy bien saltando cuerda. Rojo = dato ESTRUCTURAL: el voicing
// no tiene 3ra. Azul = modo (Locrio ♮9). Ningún color se deriva del span: se
// transcriben del escaneo.

export const LEGEND = {
  yellow: "Chévere",
  orange: "Buenísimo",
  purple: "Muy bien saltando cuerda",
  green: "Voicing con 5ta (lidio)",
  red: "Voicing sin tercera",
  blue: "Locrio ♮9",
};

// Eje semántico de cada color, para que la UI lo presente distinto.
//   recommend = gusto/consejo · structural = propiedad del voicing · mode = escala
export const LEGEND_KIND = {
  yellow: "recommend",
  orange: "recommend",
  purple: "recommend",
  green: "structural",
  red: "structural",
  blue: "mode",
};
