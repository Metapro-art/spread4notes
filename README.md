# spread4notes

Un estudio de contrapunto y conducción melódica, desarrollado sobre voicings spread de 4 notas para guitarra (manuscrito de Juan D. Arango, `scans/`).

## Levantar el visor local

El visor (`index.html`) usa ES modules nativos y `fetch`, así que **debe servirse por HTTP** — abrirlo con `file://` no funciona (los módulos y el JSON no cargan).

```bash
npx serve -l 3000 .
```

Luego abre <http://localhost:3000/> en el navegador.

Alternativa sin npx:

```bash
python -m http.server 3000
```

### Qué hace el visor

- Selector de sistema (S1–S4) de la página `p02-jonico`.
- Arriba: el recorte del escaneo del sistema (`scans/systems/`).
- Abajo: las columnas transcritas de ese sistema, alineadas bajo su columna del escaneo.
- Cada columna aceptada: mástil SVG (juego `6543`, raíz Do) + los 4 grados resueltos. Click = suena (Tone.js por CDN); botones **bloque** / **arpegiado**.
- Cada columna: veredicto `ok` / `mal`, guardado en `localStorage`. Botón **descargar veredictos.json**.
- Las columnas rechazadas por `tools/validate.js` salen en rojo, sin mástil, con su recorte a 6×.

Los datos son `data/draft/p02-jonico.json` (`verified: false` — transcripción sin verificar; el visor existe para juzgarla de oído).

## Herramientas (`tools/`, Node, sin dependencias)

```bash
node tools/generate.js --mode ionian          # enumera el universo legal jónico
node tools/validate.js data/draft/p02-jonico.json   # valida una transcripción
node tools/slice.js --systems scans/p02-jonico.png scans/systems   # regenera recortes de sistema
node tools/colors.js scans/p02-jonico.png      # detecta resaltados por hue
node tests/regression.test.js                  # tests de regresión del motor
```
