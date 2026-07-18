// spread4notes — herramienta de transcripción + estudio.
//
// El autor es la AUTORIDAD FINAL sobre su manuscrito: todo voicing es editable
// siempre, sin advertencias. `tools/validate.js` informa por CLI, no toca la UI.
//
// Verdad: el JSON EXPORTADO. localStorage es solo el estado de trabajo.
// `verified` = transcripción confirmada por el autor (se exporta).
// `locked`: los voicings del manuscrito no se borran; los nuevos (locked:false) sí.
// Grados top→bottom. `highlights` es un array: varios resaltadores por columna.

import { LEGEND } from "./core/legend.js";
import { computeIntervals } from "./core/voicing.js";

const CHAPTERS = [
  {
    slug: "ionian", name: "Jónico", file: "data/draft/p02-jonico.json", declared: 85,
    desc: "Acordes en ( ) se pueden omitir por su complejidad. En este modo también se puede reemplazar 7 por 6.",
  },
  {
    slug: "dorian", name: "Dórico / Eólico", file: "data/voicings/p03-dorico-eolico.json", declared: 104,
    desc: "Se puede reemplazar la 7ma por T disponible (3 + T + T + T). Estos voicings también funcionan para un −Δ7 (menor mayor).",
    // Mismo set de voicings; el toggle solo cambia cómo se LEE el grado escrito.
    variants: [
      { key: "dorico", label: "Dórico", scale: ["1", "9", "b3", "11", "5", "13", "b7"], map: {} },
      { key: "eolico", label: "Eólico", scale: ["1", "9", "b3", "11", "5", "b13", "b7"], map: { "13": "b13" } },
      { key: "menormayor", label: "−Δ7", scale: ["1", "9", "b3", "11", "5", "13", "7"], map: { "b7": "7" } },
    ],
  },
  {
    slug: "mixolydian", name: "Mixolidio", file: "data/draft/p04-mixolidio.json", declared: 51,
    desc: "Voicings sin omitir 3ra ni 7ma. (b9) y (b13) disponibles pero no usadas. Se omiten voicings con notas duplicadas.",
  },
  {
    slug: "lydian", name: "Lidio", file: "data/draft/p06-lidio.json", declared: 141,
    desc: "Funcionan los voicings jónicos. Aquí se ponen únicamente voicings con #11, a veces omitiendo 3ra o 7ma. Sin duplicaciones de notas. El verde marca los voicings que tienen la 5ta.",
  },
  {
    slug: "locrian", name: "Locrio", file: "data/voicings/p05-locrio.json", declared: 58,
    desc: "Se agregan voicings con b5; de resto, voicings dóricos que no tengan 9na ni 5ta justa. Se omiten voicings con notas duplicadas. El azul marca los voicings con ♮9 (Locrio ♮9).",
  },
];

// Colores de resaltador, en ORDEN FIJO para las franjas.
const STRIPE_ORDER = ["yellow", "orange", "purple", "green", "red", "blue"];
// Toggles del editor (juicios por columna; azul es decodificador de modo, aparte).
const TOGGLE_COLORS = ["yellow", "orange", "purple", "green", "red"];

// ---------- persistencia ----------
const docKey = (slug) => `s4n-doc-${slug}`;
const baseKey = (slug) => `s4n-base-${slug}`;

const VARIANT_KEY = "s4n-variant";
const state = { active: "ionian", chapters: {}, intro: null, variant: JSON.parse(localStorage.getItem(VARIANT_KEY) || "{}") };
const saveVariant = () => localStorage.setItem(VARIANT_KEY, JSON.stringify(state.variant));

let uid = 0;
const newId = () => `ins-${Date.now().toString(36)}-${(uid++).toString(36)}`;

const asHighlights = (v) => Array.isArray(v.highlights) ? v.highlights : (v.highlight ? [v.highlight] : []);
const sigOf = (base) => base.voicings.length + ":" + base.voicings.map((v) => v.degrees.join("")).join("|");

function fromBase(base) {
  return base.voicings.map((v) => ({
    id: v.id, order: v.order, system: v.system ?? null, column: v.column ?? null,
    degrees: [...v.degrees], highlights: [...asHighlights(v)],
    optional: !!v.optional, verified: !!v.verified, inManuscript: v.inManuscript !== false,
    locked: v.locked !== false,
  }));
}

async function loadChapter(ch) {
  if (!ch.file) return { ...ch, voicings: [], meta: null };
  const base = await (await fetch(ch.file)).json();
  const meta = { mode: base.mode, chordScale: base.chordScale || [], source: base.source };
  const sig = sigOf(base);
  const saved = localStorage.getItem(docKey(ch.slug));
  const savedSig = localStorage.getItem(baseKey(ch.slug));
  let voicings;
  if (saved && savedSig === sig) {
    voicings = JSON.parse(saved).map((v) => ({ ...v, locked: v.locked !== false, highlights: asHighlights(v) }));
  } else {
    voicings = fromBase(base);
    localStorage.setItem(docKey(ch.slug), JSON.stringify(voicings));
    localStorage.setItem(baseKey(ch.slug), sig);
  }
  return { ...ch, meta, voicings };
}

function saveDoc(slug) {
  localStorage.setItem(docKey(slug), JSON.stringify(state.chapters[slug].voicings));
}
function renumber(voicings) { voicings.sort((a, b) => a.order - b.order).forEach((v, i) => (v.order = i + 1)); }

// ---------- variantes (Dórico / Eólico / −Δ7): solo relabelan el grado escrito ----------
function activeVariant(ch) {
  if (!ch || !ch.variants) return null;
  const key = state.variant[ch.slug] || ch.variants[0].key;
  return ch.variants.find((v) => v.key === key) || ch.variants[0];
}
const variantMap = (ch) => { const av = activeVariant(ch); return av ? av.map : {}; };
const variantInv = (ch) => { const av = activeVariant(ch); return av ? Object.fromEntries(Object.entries(av.map).map(([k, w]) => [w, k])) : {}; };
const editScale = (ch, data) => { const av = activeVariant(ch); return av ? av.scale : (data.meta ? data.meta.chordScale : []); };

// ---------- resaltados: fondo en franjas verticales ----------
const orderedHls = (hls) => STRIPE_ORDER.filter((c) => hls.includes(c));
function highlightBg(hls) {
  const cs = orderedHls(hls);
  if (!cs.length) return "";
  if (cs.length === 1) return `var(--${cs[0]})`;
  const step = 100 / cs.length;
  return `linear-gradient(90deg, ${cs.map((c, i) => `var(--${c}) ${(i * step).toFixed(3)}% ${((i + 1) * step).toFixed(3)}%`).join(", ")})`;
}
const swatchHtml = (hls) => { const bg = highlightBg(hls); return bg ? `<span class="sw" style="background:${bg}"></span>` : `<span class="sw none"></span>`; };
function applyHighlights(card, hls) {
  const bg = highlightBg(hls);
  card.style.background = bg || "";
  card.classList.toggle("colored", !!bg);
}

// ---------- DOM refs ----------
const el = {
  chapters: document.getElementById("chapters"),
  intro: document.getElementById("intro"),
  chapterDesc: document.getElementById("chapter-desc"),
  variants: document.getElementById("variants"),
  legend: document.getElementById("legend"),
  grid: document.getElementById("grid"),
  exportBtn: document.getElementById("export"),
  resetBtn: document.getElementById("reset"),
};

// ---------- popover inline (sin modales) ----------
let popover = null;
function closePopover() { if (popover) { popover.remove(); popover = null; } }
document.addEventListener("click", (e) => { if (popover && !popover.contains(e.target) && !e.target.closest("[data-pop]")) closePopover(); });
function positionPopover(p, anchor) {
  const r = anchor.getBoundingClientRect(), pr = p.getBoundingClientRect();
  let left = Math.max(8, Math.min(r.left + r.width / 2 - pr.width / 2, window.innerWidth - pr.width - 8));
  let top = r.bottom + 6;
  if (top + pr.height > window.innerHeight - 8) top = r.top - pr.height - 6;
  p.style.left = `${left}px`; p.style.top = `${top}px`;
}
function openPopover(anchor, items) {
  closePopover();
  const p = document.createElement("div");
  p.className = "popover";
  for (const it of items) {
    const b = document.createElement("button");
    b.className = "pop-item" + (it.cls ? ` ${it.cls}` : "");
    b.innerHTML = it.html;
    b.addEventListener("click", (ev) => { ev.stopPropagation(); closePopover(); it.onPick(); });
    p.appendChild(b);
  }
  document.body.appendChild(p);
  positionPopover(p, anchor);
  popover = p;
}

// ---------- render ----------
function renderIntro() {
  const it = state.intro;
  if (!it) { el.intro.hidden = true; return; }
  el.intro.hidden = false;
  el.intro.innerHTML =
    `<details><summary><span class="intro-title">${it.title}</span><span class="intro-hint">intro del estudio</span></summary>` +
    it.body.map((p) => `<p>${p}</p>`).join("") +
    `<p class="intro-links">${it.author} · ${it.links.web} · ${it.links.instagram}</p></details>`;
}

function renderLegend() {
  el.legend.innerHTML = ["yellow", "orange", "purple", "green", "red", "blue"].map((c) =>
    `<span class="lg"><span class="sw" style="background:var(--${c})"></span>${LEGEND[c]}</span>`
  ).join("");
}

function renderChapters() {
  el.chapters.innerHTML = "";
  for (const ch of CHAPTERS) {
    const b = document.createElement("button");
    b.className = "chapter";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(ch.slug === state.active));
    b.innerHTML = `<span class="cname">${ch.name}</span>`;
    b.addEventListener("click", () => { state.active = ch.slug; location.hash = ch.slug; closePopover(); render(); });
    el.chapters.appendChild(b);
  }
}

function renderChapterDesc() {
  const ch = CHAPTERS.find((c) => c.slug === state.active);
  if (!ch || !ch.desc) { el.chapterDesc.hidden = true; el.chapterDesc.textContent = ""; return; }
  el.chapterDesc.hidden = false;
  el.chapterDesc.textContent = ch.desc;
}

function renderVariants() {
  const ch = CHAPTERS.find((c) => c.slug === state.active);
  const data = state.chapters[state.active];
  if (!ch || !ch.variants || !data || !data.voicings.length) { el.variants.hidden = true; el.variants.innerHTML = ""; return; }
  el.variants.hidden = false;
  const cur = activeVariant(ch);
  el.variants.innerHTML =
    `<div class="seg" role="group" aria-label="Lectura del acorde">` +
    ch.variants.map((v) => `<button class="seg-btn${v.key === cur.key ? " on" : ""}" data-pop data-vk="${v.key}">${v.label}</button>`).join("") +
    `</div><span class="seg-scale">${cur.scale.join(" ")}</span>`;
  el.variants.querySelectorAll(".seg-btn").forEach((b) =>
    b.addEventListener("click", () => { state.variant[state.active] = b.dataset.vk; saveVariant(); closePopover(); render(); }));
}

const MODES_DEGREE_ORDER = ["1", "b9", "9", "b3", "3", "11", "#11", "b5", "5", "#5", "b13", "6", "13", "b7", "7"];

function editDegree(data, v, i, anchor) {
  const inv = variantInv(data);            // lo mostrado (variante) -> canónico (dórico)
  const items = editScale(data, data)
    .slice()
    .sort((a, b) => MODES_DEGREE_ORDER.indexOf(a) - MODES_DEGREE_ORDER.indexOf(b))
    .map((g) => ({
      html: g, cls: g === (variantMap(data)[v.degrees[i]] ?? v.degrees[i]) ? "sel" : "",
      onPick: () => { v.degrees[i] = inv[g] ?? g; saveDoc(data.slug); render(); },
    }));
  openPopover(anchor, items);
}

// Editor de color = toggles INDEPENDIENTES (varios a la vez). NO selector único.
function editColor(data, v, anchor) {
  closePopover();
  const p = document.createElement("div");
  p.className = "popover";
  TOGGLE_COLORS.forEach((c) => {
    const b = document.createElement("button");
    const on = () => v.highlights.includes(c);
    b.className = "pop-item toggle" + (on() ? " sel" : "");
    b.innerHTML = `<span class="chk">${on() ? "✓" : ""}</span><span class="sw" style="background:var(--${c})"></span>${LEGEND[c]}`;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const idx = v.highlights.indexOf(c);
      if (idx >= 0) v.highlights.splice(idx, 1); else v.highlights.push(c);
      b.classList.toggle("sel", on());
      b.querySelector(".chk").textContent = on() ? "✓" : "";
      saveDoc(data.slug);
      const card = document.getElementById(`v-${v.id}`);
      if (card) { applyHighlights(card, v.highlights); const cb = card.querySelector(".t-color"); if (cb) cb.innerHTML = swatchHtml(v.highlights); }
    });
    p.appendChild(b);
  });
  document.body.appendChild(p);
  positionPopover(p, anchor);
  popover = p;
}

function insertAfter(data, order) {
  const scale = data.meta?.chordScale || ["1", "b7", "b3", "5"];
  const nv = {
    id: newId(), order: order + 0.5, system: null, column: null,
    degrees: scale.slice(0, 4), highlights: [], optional: false, verified: false, inManuscript: true,
    locked: false,
  };
  data.voicings.push(nv);
  renumber(data.voicings);
  saveDoc(data.slug);
  render();
  requestAnimationFrame(() => {
    const node = document.getElementById(`v-${nv.id}`);
    if (node) { node.scrollIntoView({ behavior: "smooth", block: "center" }); node.querySelector(".deg")?.focus(); }
  });
}

function deleteVoicing(data, v) {
  if (v.locked !== false) return; // los del manuscrito (locked) no se borran, nunca
  data.voicings = data.voicings.filter((x) => x !== v);
  renumber(data.voicings);
  saveDoc(data.slug);
  render();
}

function makeCard(data, v) {
  const dmap = variantMap(data);
  const card = document.createElement("div");
  card.className = "voicing" + (highlightBg(v.highlights) ? " colored" : "") +
    (v.optional ? " optional" : "");
  card.id = `v-${v.id}`;
  card.style.background = highlightBg(v.highlights) || "";

  // fila superior: orden · color (editable siempre) · borrar (solo voicings nuevos)
  const top = document.createElement("div");
  top.className = "v-top";
  const ord = document.createElement("span");
  ord.className = "ord"; ord.textContent = v.order;
  top.append(ord);
  // Color: EDITABLE siempre (base y nuevos).
  const colorBtn = document.createElement("button");
  colorBtn.className = "t t-color"; colorBtn.setAttribute("data-pop", "");
  colorBtn.title = "Colores (varios posibles)";
  colorBtn.innerHTML = swatchHtml(v.highlights);
  colorBtn.addEventListener("click", () => editColor(data, v, colorBtn));
  top.append(colorBtn);
  // Borrar: SOLO voicings nuevos. La base (locked) no se borra ni se editan sus grados.
  const editable = v.locked === false;
  if (editable) {
    const delBtn = document.createElement("button");
    delBtn.className = "t t-del"; delBtn.title = "Borrar voicing";
    delBtn.textContent = "🗑";
    delBtn.addEventListener("click", () => deleteVoicing(data, v));
    top.append(delBtn);
  }

  // grados (top→bottom, relabelados según la variante). Editables solo si el
  // voicing es nuevo; los de la base se muestran como texto fijo, sin tocar.
  const stack = document.createElement("div");
  stack.className = "deg-stack" + (v.optional ? " paren" : "");
  v.degrees.forEach((g, i) => {
    const shown = dmap[g] ?? g;
    if (editable) {
      const d = document.createElement("button");
      d.className = "deg"; d.setAttribute("data-pop", "");
      d.setAttribute("aria-label", `Grado voz ${i + 1}: ${shown}. Tocar para cambiar.`);
      d.textContent = shown;
      d.addEventListener("click", () => editDegree(data, v, i, d));
      stack.appendChild(d);
    } else {
      const d = document.createElement("div");
      d.className = "deg-ro";
      d.textContent = shown;
      stack.appendChild(d);
    }
  });

  card.append(top, stack);
  return card;
}

function renderGrid() {
  const data = state.chapters[state.active];
  el.grid.innerHTML = "";
  const transcribable = data && data.file;
  if (!data || (data.voicings.length === 0 && !transcribable)) {
    el.grid.innerHTML = `<p class="empty">Este capítulo aún no está transcrito.<br>Próximamente.</p>`;
    return;
  }
  const head = document.createElement("button");
  head.className = "insert-head";
  head.title = "Insertar columna al inicio";
  head.textContent = "+";
  head.addEventListener("click", () => insertAfter(data, 0));
  el.grid.appendChild(head);
  if (data.voicings.length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty";
    hint.innerHTML = `Capítulo vacío. Toca <b>+</b> para empezar a transcribir desde el manuscrito.`;
    el.grid.appendChild(hint);
    return;
  }
  // Separadores por TOP NOTE (voz más AGUDA, degrees[0]): rachas CONSECUTIVAS que
  // comparten degrees[0], recorriendo la lista en el orden que YA tiene. NO se agrupa
  // por todo el capítulo — una misma top note puede dar varios grupos separados y no
  // se juntan. La línea melódica de la voz superior desciende por la escala del modo:
  // los encabezados, de arriba a abajo, deben BAJAR. Solo VISTA: no toca /data/ ni `order`.
  const vs = data.voicings.slice().sort((a, b) => a.order - b.order);
  const dmap = variantMap(data);
  let i = 0;
  while (i < vs.length) {
    const top = vs[i].degrees[0];
    let j = i;
    while (j < vs.length && vs[j].degrees[0] === top) j++;
    const n = j - i;
    const hd = document.createElement("div");
    hd.className = "top-group";
    hd.innerHTML = `<span class="bg-label">top</span><span class="bg-deg">${dmap[top] ?? top}</span><span class="bg-n">${n} voicing${n === 1 ? "" : "s"}</span>`;
    el.grid.appendChild(hd);
    for (let k = i; k < j; k++) el.grid.appendChild(makeCard(data, vs[k]));
    i = j;
  }
}

function render() {
  renderChapters();
  renderIntro();
  renderChapterDesc();
  renderVariants();
  renderGrid();
}

// ---------- exportar / reimportar ----------
function exportJSON() {
  const data = state.chapters[state.active];
  if (!data || !data.meta) return;
  const mode = data.meta.mode;
  const voicings = data.voicings.slice().sort((a, b) => a.order - b.order).map((v) => ({
    id: v.id, order: v.order, system: v.system ?? null, column: v.column ?? null,
    degrees: v.degrees, intervals: computeIntervals(v.degrees),
    highlights: v.highlights || [], optional: !!v.optional,
    verified: !!v.verified, inManuscript: v.inManuscript !== false,
    locked: v.locked !== false,
  }));
  const doc = { mode, chordScale: data.meta.chordScale, source: data.meta.source, verified: voicings.every((v) => v.verified), voicings };
  const blob = new Blob([JSON.stringify(doc, null, 1) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (data.meta.source || `p-${mode}`).split("/").pop().replace(/\.png$/, "") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function reimport() {
  const ch = CHAPTERS.find((c) => c.slug === state.active);
  if (!ch || !ch.file) return;
  localStorage.removeItem(docKey(ch.slug));
  localStorage.removeItem(baseKey(ch.slug));
  loadChapter(ch).then((d) => { state.chapters[ch.slug] = d; render(); });
}

el.exportBtn.addEventListener("click", exportJSON);
el.resetBtn.addEventListener("click", reimport);

// ---------- init ----------
(async () => {
  const h = location.hash.slice(1);
  if (CHAPTERS.some((c) => c.slug === h)) state.active = h;
  renderLegend();
  try { state.intro = await (await fetch("data/intro.json")).json(); } catch { state.intro = null; }
  for (const ch of CHAPTERS) state.chapters[ch.slug] = await loadChapter(ch);
  render();
})();
