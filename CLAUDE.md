# CLAUDE.md — spread4notes

App interactiva de estudio de **voicings spread de 4 notas para guitarra**, derivada de un manuscrito de Juan D. Arango (`/scans/`). Destino final: `spreads.juandarango.com` (GitHub Pages).

## Regla de oro

El manuscrito escaneado en `/scans/` es la **única fuente de verdad**. Nunca inventes, "completes" ni "corrijas" un voicing que no esté transcrito en `/data/`. Si el generador produce un voicing legal que no aparece en el manuscrito, se marca `inManuscript: false` y **no** se muestra en la app por defecto.

## Stack (no cambiar sin pedir permiso)

- HTML + CSS + JavaScript vanilla, ES modules nativos. **Sin framework, sin bundler, sin build step.**
- Audio: Tone.js por CDN.
- Diagramas: SVG generado a mano en JS. Sin librerías de guitarra.
- Datos: JSON estático en `/data/`. Sin backend, sin base de datos.
- Deploy: GitHub Pages desde `main`.

Razón: el sitio destino (`juandarango-web2026`) es HTML/CSS plano servido por GitHub Pages. Cualquier build step rompe la integración y la mantenibilidad.

---

## Teoría — reglas duras

### ⚠️ Los dígitos del manuscrito son ÍNDICES DE GRADO, no etiquetas absolutas

Esto es lo primero que hay que entender y lo más fácil de arruinar.

El manuscrito escribe `5`, `3`, `7`, `9` **sin alteraciones**. La alteración la aporta la **escala de acorde del modo**, declarada una sola vez en el encabezado de cada página. Como cada número de grado aparece exactamente una vez en la escala, el dígito solo es inequívoco.

Ejemplo real (locrio, escala `1 b9 b3 11 b5 b13 b7`):
- manuscrito `5` → **`b5`**
- manuscrito `7` → **`b7`**
- manuscrito `3` → **`b3`**

Nunca guardes el dígito crudo como si fuera un grado absoluto. **Siempre resuelve contra `chordScale` del modo al leer.** En `/data/` se guarda el **grado resuelto** (`"b5"`, no `"5"`).

Única ambigüedad conocida: en **locrio** el dígito `9` puede ser `b9` (por defecto) o `♮9` (alternativa entre paréntesis en el encabezado). **El resaltado azul es el único desambiguador.** Ver "Colores".

### Tabla de grados → semitonos desde la raíz

| grado | st | grado | st |
|---|---|---|---|
| `1` | 0 | `5` | 7 |
| `b9` | 1 | `#5` / `b13` | 8 |
| `9` | 2 | `6` / `13` | 9 |
| `b3` | 3 | `b7` | 10 |
| `3` | 4 | `7` | 11 |
| `11` | 5 | | |
| `b5` / `#11` | 6 | | |

`b5` y `#11` suenan igual (6) pero **NO son intercambiables como etiqueta**: `#11` es tensión (lidio), `b5` es nota estructural (locrio). Lo mismo con `#5`/`b13` y `6`/`13`. La etiqueta correcta la fija el `chordScale` del modo.

### Cómo se lee una columna del manuscrito

Cada columna vertical de 4 números = 1 voicing.

- Número **de arriba** = voz **más aguda** (cuerda más delgada).
- Número **de abajo** = voz **más grave** (cuerda más gruesa).

En `/data/` se guarda **siempre top→bottom**, idéntico al manuscrito. Nunca invertir "para que sea más natural".

### Derivación de alturas (determinista — leer esto antes de tocar el motor)

Un voicing ocupa 4 cuerdas contiguas, una nota por cuerda ⇒ las voces son estrictamente ascendentes por cuerda ⇒ el intervalo entre voces adyacentes está en 1..11 semitonos y queda **totalmente determinado** por los grados:

```js
// nunca 0: no existen notas duplicadas en este sistema
const interval = (a, b) => (((SEMITONE[b] - SEMITONE[a]) % 12) + 12) % 12;
```

Partiendo de la voz grave, cada voz superior es la instancia más cercana por encima de la anterior. Por lo tanto **los 4 grados determinan la forma completa**: no hay ambigüedad de octava, no hay "inversiones" que elegir, no hay parámetros libres.

### Juegos de cuerdas (afinación estándar, MIDI de cuerdas al aire, grave→agudo)

```js
const STRING_SETS = {
  "6543": [40, 45, 50, 55], // E2 A2 D3 G3
  "5432": [45, 50, 55, 59], // A2 D3 G3 B3
  "4321": [50, 55, 59, 64], // D3 G3 B3 E4
};
```

```
fret[i] = (rootMidi + pitch[i]) - openString[i]
span    = max(fret) - min(fret)
```

El mismo voicing produce **formas distintas** en `4321` por la 3ra mayor Sol–Si. La dificultad se recalcula por juego de cuerdas; **nunca se hereda**.

### Tests de regresión obligatorios

```
degrees ["9","13","3","7"] (top→bottom), raíz Do  ⇒  Si–Mi–La–Re
  6543 → trastes 7-7-7-7   (span 0)
  4321 → trastes 9-9-10-10 (span 1)

degrees ["1","11","b7","b5"] (top→bottom), raíz Do, locrio  ⇒  Solb–Sib–Fa–Do
  6543 → trastes 2-1-3-5   (span 4, primera posición, alcance hacia atrás)
  con salto a la 2da cuerda para la voz aguda → 2-1-3-1 (span 2)
  ⇒ este voicing debe salir marcado `betterWithStringSkip: true`
```

### Regla de construcción del manuscrito

Base: **3 + 7 + T + T** (bottom-up), donde T = tensión disponible o nota estructural del acorde. Excepciones por modo (abajo). **Sin grados duplicados** en ningún modo.

---

## Modos

| modo | escala de acorde | reglas / excepciones |
|---|---|---|
| **Jónico** | `1 9 3 5 13 7` | `11` = avoid. Se puede reemplazar `7` por `6`. Existen voicings sin 3ra. |
| **Dórico** | `1 9 b3 11 5 13 b7` | Se puede reemplazar la 7ma por tensión disponible → `3 + T + T + T`. |
| **Eólico** | `1 9 b3 11 5 b13 b7` | Idéntico a dórico con `13 → b13`. Los mismos voicings sirven para **−Δ7 (menor mayor)**. |
| **Mixolidio** | `1 9 3 11 5 13 b7` | `(b9)` y `(b13)` disponibles pero no usadas. **Nunca omitir 3ra ni 7ma.** |
| **Lidio** | `1 9 3 #11 5 13 7` | `(#5)` y `(b7)` disponibles. Funcionan los voicings jónicos; aquí solo se listan los que **contienen `#11`**, a veces omitiendo 3ra o 7ma. |
| **Locrio** | `1 b9 b3 11 b5 b13 b7` | `(♮9)` y `(13)` alternativas. Se agregan voicings con `b5`; el resto son voicings dóricos que no contengan 9na ni 5ta justa. |

---

## Colores (resaltados del manuscrito)

**Los colores NO son datos. Son llaves de decodificación.** Existen porque el manuscrito escribe dígitos crudos; una vez que la transcripción produce grados resueltos (`b9` vs `9`), la mayoría de los colores queda redundante y **desaparece del esquema**.

Pero durante la Fase 1 son **obligatorios**: sin ellos, ciertos dígitos son indescifrables. **No se pueden ignorar en la transcripción "porque ya no los necesitamos" — se necesitan para poder no necesitarlos.**

| color | rol | destino en `/data/` |
|---|---|---|
| **azul** (locrio) | **Llave.** Desambigua `9` = `♮9` frente al `b9` por defecto. **Único portador de ese bit.** | ninguno — se absorbe en `degrees` |
| **verde** (lidio) | **Llave (probable).** Desambigua `5` = `♮5` frente a `#5`. Si resulta ser solo una observación de contenido, se descarta igual. | ninguno — se absorbe en `degrees` |
| amarillo | Juicio del autor. Difícil (estiramiento). | `difficulty: "hard"` |
| naranja | Juicio del autor. Muy difícil (estiramiento). | `difficulty: "veryHard"` |
| rojo / rosa | Juicio del autor. Incómodo en cuerdas contiguas; se toca mejor saltando cuerda. **Eje independiente de `difficulty`** — pueden coexistir. | `betterWithStringSkip: true` |

Regla mnemotécnica: **azul y verde se absorben; amarillo, naranja y rojo sobreviven.** Los que sobreviven son juicios humanos que ningún dígito contiene. Los que se absorben son información que sí cabe en `degrees`.

`( )` alrededor de una columna ⇒ `optional: true` ("se puede omitir por su complejidad").

### Si se pierde una llave

Un azul mal leído produce un `b9` donde va un `♮9`. **El validador NO lo detecta** — ambos son voicings legales del locrio. Es el único error de transcripción silencioso de todo el proyecto. Por eso `tools/colors.js` corre **antes** de la pasada de visión y su salida se trata como obligatoria, no como sugerencia.

### NO se transcriben — se computan desde `degrees`

`no3rd`, `no7th`, `has5th`, `hasNatural9`, `has#11`, etc. Son propiedades derivadas. **No crear campos para ellas en `/data/`.** Si la leyenda de una página parece contradecir esto (p. ej. la página del jónico rotula un color como "sin 3ra"), ignórala: el dato ya está en los 4 grados.

`difficulty` y `betterWithStringSkip` son juicios del autor y son **ground truth para calibrar** las heurísticas de `span` y de salto de cuerda, no al revés. Si la heurística contradice el resaltado, gana el resaltado y se ajusta la heurística.

### Locrio ♮9 no es una excepción: es un modo

El locrio ♮9 (6to modo de la menor melódica, `1 9 b3 11 b5 b13 b7`) es una escala de acorde distinta con función armónica propia (m7b5 en II-V menor). Los voicings azules van en el **mismo archivo** que el locrio para preservar `order`, pero la UI los expone como sub-toggle `♮9` dentro de Locrio. Se identifican porque `degrees` contiene `"9"` en vez de `"b9"` — **derivable, sin tag**.

### Arcos de conducción melódica — NO se transcriben

Los arcos del manuscrito conectan **siempre la misma voz entre columnas contiguas** (columna *n* → columna *n+1*). No hay cruces de voces. Por lo tanto son **100% derivables** de `order` + `degrees`:

```js
// voz i de la columna n → voz i de la columna n+1
const motion = (a, b) => { /* "same" | "up" | "down", en semitonos */ };
```

No crear campo `voiceLeading` en `/data/`. Calcularlo en `src/core/`.

---

## Realidad del escaneo (no hay mejor fuente)

(Verificado) `scans/` = 7 páginas, ~1400 × 1650 px, **~170 ppi**, JPEG con compresión fuerte (~2% ratio). **No existe un escaneo de mayor resolución. Esto es lo que hay.**

Consecuencias operativas para la transcripción:
- **La unidad de trabajo es el *sistema* (una fila de columnas), no la página.** Una página completa a 170 ppi es ilegible para una pasada de visión.
- Flujo: recortar el sistema → escalar 3× (LANCZOS) → leer. Un strip de sistema queda ~4300 × 900 px y es legible.
- Total ≈ 25–30 strips en todo el estudio.
- El muestreo de color (`tools/colors.js`) funciona bien pese al JPEG: los resaltados son manchas grandes frente a los artefactos de compresión.
- **Toda lectura de visión pasa por `tools/validate.js` antes de entrar a `/data/`.** Un dígito mal leído casi siempre produce un voicing que no existe en el universo legal generado, y salta solo.

---

## Modelo de datos

`/data/voicings/<mode>.json`:

```json
{
  "mode": "locrian",
  "chordScale": ["1", "b9", "b3", "11", "b5", "b13", "b7"],
  "alternates": { "b9": "9", "b13": "13" },
  "source": "scans/p05-locrio.png",
  "voicings": [
    {
      "id": "loc-001",
      "order": 1,
      "degrees": ["1", "11", "b7", "b5"],
      "intervals": [7, 7, 4],
      "difficulty": "normal",
      "betterWithStringSkip": true,
      "optional": false,
      "system": 1,
      "column": 1,
      "inManuscript": true
    }
  ]
}
```

- `degrees` — top→bottom, **grados resueltos** (no dígitos crudos). **Campo canónico.** Todo lo demás es derivado o metadato.
- `order` — la secuencia del manuscrito. **Es el valor pedagógico del estudio** (la conducción melódica de cada voz). Nunca reordenar por defecto; el orden alterno es opt-in del usuario.
- `intervals` — derivado; se recalcula y valida en CI. Si no coincide con `degrees`, el build falla.
- `system` / `column` — coordenada en el escaneo, para auditar contra la imagen.

---

## Invariantes que valida `tools/validate.js` (corre en CI)

1. Todo `degrees` tiene exactamente 4 elementos, todos pertenecen a `chordScale` o a `alternates` del modo, sin repetidos.
2. `intervals` recalculado === `intervals` guardado.
3. Cada voicing es **físicamente posible**: `span < 8` en al menos un juego de cuerdas. (Antes decía `span <= 5`; DEROGADO — el span **clasifica** la dificultad, no excluye. Ver `src/core/difficulty.js`.)
4. `order` es una permutación de `1..N` sin huecos ni duplicados.
5. No hay voicings duplicados dentro de un modo.
6. Todo voicing cumple la regla del modo (ej.: mixolidio siempre contiene `3` y `b7`).
7. Todo voicing con `inManuscript: true` tiene `system` y `column`.
8. Ningún dígito crudo sin resolver (`"5"` en locrio, `"3"` en dórico, etc.) llega a `/data/`.

---

## Estructura del repo

```
spread4notes/
  index.html
  style.css
  src/
    core/            # teoría pura, CERO DOM. degrees.js voicing.js fretboard.js
                     # difficulty.js stringskip.js voiceleading.js
    ui/              # fretboard-svg.js mode-picker.js voicing-grid.js player.js
    main.js
  data/
    modes.json
    voicings/*.json
  tools/
    transcriber/     # herramienta local de captura (Fase 1)
    validate.js      # invariantes, corre en CI
    generate.js      # enumera el universo legal por modo
    colors.js        # extrae el resaltado por muestreo de píxeles
    slice.js         # recorta y escala los strips de sistema desde scans/
  scans/             # PNG por página, 1400×1650 @170ppi. Fuente de verdad.
  CLAUDE.md
```

## Convenciones de trabajo

- `src/core/` no toca el DOM jamás. Testeable con `node` puro, sin navegador.
- Antes de cualquier cambio en `/data/`: `node tools/validate.js`.
- No agregar dependencias sin preguntar.
- UI y comentarios en español. Identificadores de código en inglés.
- Cuando dudes de una regla musical: **pregunta, no infieras.** Un voicing mal transcrito es peor que un voicing faltante.
