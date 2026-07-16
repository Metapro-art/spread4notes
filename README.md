# spread4notes

Un estudio de contrapunto y conducción melódica, desarrollado sobre voicings spread de 4 notas para guitarra (manuscrito de Juan D. Arango, `scans/`).

## Levantar la app local

La app (`index.html`) usa ES modules nativos y `fetch`, así que **debe servirse por HTTP** — abrirla con `file://` no funciona (los módulos y el JSON no cargan).

```bash
npx serve -l 3000 .
```

Luego abre <http://localhost:3000/> en el navegador.

Alternativa sin npx:

```bash
python -m http.server 3000
```

### Qué es

Una **app de estudio**, no un visor del manuscrito. Responde una sola pregunta: *¿por cuál voy?*

- **Capítulos = modos** (Jónico, Dórico, Eólico, Mixolidio, Lidio, Locrio). Hoy solo Jónico tiene datos (73 voicings estudiables); los demás van visibles y vacíos.
- Dentro del capítulo, los voicings van en el orden exacto de `order` (la conducción melódica del estudio) — **nunca se reordenan**.
- Cada voicing es un botón: los 4 grados apilados, la voz más aguda arriba. Su color = dificultad (`src/core/legend.js`). Los colores de dificultad son lo único saturado de la pantalla.
- Click = **"ya me lo sé"**: el voicing se apaga y retrocede; el progreso persiste en `localStorage`.
- La barra **Continuar** salta al primer voicing sin marcar — la respuesta literal a "¿por cuál voy?".

El escaneo (`scans/`) es la fuente de la transcripción, **no se le muestra al usuario**. **Nada se esconde:** todas las columnas transcritas se muestran; las que el validador rechaza salen marcadas `needsReview` (trama diagonal, tachado) y siguen siendo clickeables. Las opcionales (entre paréntesis en el manuscrito) se distinguen con borde punteado y paréntesis.

## Herramientas (`tools/`, Node, sin dependencias)

```bash
node tools/generate.js --mode ionian          # enumera el universo legal jónico
node tools/validate.js data/draft/p02-jonico.json   # valida una transcripción
node tools/columns.js scans/p02-jonico.png     # detección estructural: cuenta columnas por sistema
node tools/colors.js scans/p02-jonico.png      # resaltado por color, un registro por columna
node tools/arcs.js data/draft/p02-jonico.json  # checksum de flechas vs. conducción derivada
node tools/slice.js --systems scans/p02-jonico.png scans/systems   # recortes de sistema
node tests/regression.test.js                  # tests de regresión del motor
```
