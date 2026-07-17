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

La app **es la herramienta de transcripción** (y de estudio). El borrador (`data/draft/*.json`) es una lectura por visión con columnas faltantes y errores; el autor lo corrige **mientras estudia**, en línea. El único lector del escaneo es el autor.

- **Capítulos = modos** (Jónico, Dórico, Eólico, Mixolidio, Lidio, Locrio). Hoy solo Jónico tiene datos; los demás van visibles y vacíos.
- Los voicings van en el orden exacto de `order` — **nunca se reordenan**. 4 grados apilados, la voz más aguda arriba.
- **Edición en línea, sin modales:** tocar un grado lo cambia (solo grados válidos del modo); alternar color (chévere / buenísimo / advertencia / locrio ♮9 / ninguno), `optional`, insertar columna (`+`), borrar (`🗑`).
- **Dos estados distintos:** `✓` verificado (transcripción correcta, se exporta) y `♪` aprendido (estudio personal, no se exporta).
- **Honestidad en pantalla:** "N de 85 transcritos — faltan M" + auditoría de color en vivo (amarillo 29 · naranja 12 · rojo 3).
- **Exportar JSON** baja el archivo corregido — **eso** es lo que se commitea. `localStorage` es solo el estado de trabajo (`↺ reimportar` lo descarta y recarga del repo).
- **Nada se esconde:** las columnas que el validador rechaza salen `needsReview` (trama, tachado) y siguen editables. Las opcionales, con paréntesis y borde punteado.

Los colores son DATO (gusto/advertencia), lo único saturado; su significado vive en `src/core/legend.js`, nunca en `/data/`. Las flechas no se transcriben: se derivan de `order`+`degrees`.

## Herramientas (`tools/`, Node, sin dependencias)

```bash
node tools/generate.js --mode ionian          # enumera el universo legal jónico
node tools/validate.js data/draft/p02-jonico.json   # valida una transcripción
node tools/columns.js scans/p02-jonico.png     # detección estructural: cuenta columnas por sistema
node tools/colors.js scans/p02-jonico.png      # resaltado por color, un registro por columna (auditoría)
node tools/slice.js scans/p02-jonico.png 40 858 1400 1030 3 out.png   # recorte para que el AUTOR lea
node tests/regression.test.js                  # tests de regresión del motor
```
