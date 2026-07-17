// spread4notes — herramienta de transcripción + estudio.
//
// El autor es la AUTORIDAD FINAL sobre su manuscrito: todo voicing es editable
// siempre, sin advertencias. `tools/validate.js` informa por CLI, no toca la UI.
//
// Verdad: el JSON EXPORTADO. localStorage es solo el estado de trabajo.
// `verified` (transcripción confirmada, se exporta) ≠ `learned` (estudio, no).
// Grados top→bottom. `highlights` es un array: varios resaltadores por columna.

import { LEGEND } from "./core/legend.js";
import { computeIntervals } from "./core/voicing.js";

const CHAPTERS = [
  { slug: "ionian", name: "Jónico", file: "data/draft/p02-jonico.json", declared: 85 },
  {
    slug: "dorian", name: "Dórico / Eólico", file: "data/voicings/p03-dorico-eolico.json", declared: 104,
    // Mismo set de voicings; el toggle solo cambia cómo se LEE el grado escrito.
    variants: [
      { key: "dorico", label: "Dórico", scale: ["1", "9", "b3", "11", "5", "13", "b7"], map: {} },
      { key: "eolico", label: "Eólico", scale: ["1", "9", "b3", "11", "5", "b13", "b7"], map: { "13": "b13" } },
      { key: "menormayor", label: "−Δ7", scale: ["1", "9", "b3", "11", "5", "13", "7"], map: { "b7": "7" } },
    ],
  },
  { slug: "mixolydian", name: "Mixolidio", file: "data/draft/p04-mixolidio.json", declared: 51 },
  { slug: "lydian", name: "Lidio", file: null },
  { slug: "locrian", name: "Locrio", file: null },
];

// Colores de resaltador, en ORDEN FIJO para las franjas.
const STRIPE_ORDER = ["yellow", "orange", "purple", "red", "blue"];
// Toggles del editor (juicios por columna; azul es decodificador de modo, aparte).
const TOGGLE_COLORS = ["yellow", "orange", "purple", "red"];

// ---------- persistencia ----------
const LEARN_KEY = "s4n-learned";
const docKey = (slug) => `s4n-doc-${slug}`;
const baseKey = (slug) => `s4n-base-${slug}`;
const learned = JSON.parse(localStorage.getItem(LEARN_KEY) || "{}");
const saveLearned = () => localStorage.setItem(LEARN_KEY, JSON.stringify(learned));

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
    voicings = JSON.parse(saved).map((v) => ({ ...v, highlights: asHighlights(v) }));
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

// ---------- derivados ----------
const countLearned = (data) => data.voicings.filter((v) => learned[v.id]).length;
const countVerified = (data) => data.voicings.filter((v) => v.verified).length;
const firstUnlearned = (data) => data.voicings.find((v) => !learned[v.id]) || null;

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
  variants: document.getElementById("variants"),
  legend: document.getElementById("legend"),
  grid: document.getElementById("grid"),
  honesty: document.getElementById("honesty"),
  where: document.getElementById("where"),
  goBtn: document.getElementById("go"),
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
  el.legend.innerHTML = ["yellow", "orange", "purple", "red", "blue"].map((c) =>
    `<span class="lg"><span class="sw" style="background:var(--${c})"></span>${LEGEND[c]}</span>`
  ).join("");
}

function renderChapters() {
  el.chapters.innerHTML = "";
  for (const ch of CHAPTERS) {
    const data = state.chapters[ch.slug];
    const empty = !data || data.voicings.length === 0;
    const b = document.createElement("button");
    b.className = "chapter";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(ch.slug === state.active));
    const count = empty ? "0" : `${countVerified(data)}/${data.voicings.length} ✓`;
    b.innerHTML = `<span class="cname">${ch.name}</span><span class="ccount">${count}</span>`;
    b.addEventListener("click", () => { state.active = ch.slug; location.hash = ch.slug; closePopover(); render(); });
    el.chapters.appendChild(b);
  }
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
  data.voicings = data.voicings.filter((x) => x !== v);
  renumber(data.voicings);
  delete learned[v.id]; saveLearned();
  saveDoc(data.slug);
  render();
}

function makeCard(data, v) {
  const isLearned = !!learned[v.id];
  const dmap = variantMap(data);
  const card = document.createElement("div");
  card.className = "voicing" + (highlightBg(v.highlights) ? " colored" : "") +
    (v.optional ? " optional" : "") + (v.verified ? " verified" : "") + (isLearned ? " learned" : "");
  card.id = `v-${v.id}`;
  card.style.background = highlightBg(v.highlights) || "";

  // fila superior: orden · color (multi) · verificado · menú (⋯)
  const top = document.createElement("div");
  top.className = "v-top";
  const ord = document.createElement("span");
  ord.className = "ord"; ord.textContent = v.order;
  const colorBtn = document.createElement("button");
  colorBtn.className = "t t-color"; colorBtn.setAttribute("data-pop", "");
  colorBtn.title = "Colores (varios posibles)";
  colorBtn.innerHTML = swatchHtml(v.highlights);
  colorBtn.addEventListener("click", () => editColor(data, v, colorBtn));
  const verBtn = document.createElement("button");
  verBtn.className = "t t-ver" + (v.verified ? " on" : ""); verBtn.setAttribute("data-pop", "");
  verBtn.setAttribute("aria-pressed", String(v.verified)); verBtn.title = "Verificado";
  verBtn.textContent = "✓";
  verBtn.addEventListener("click", () => { v.verified = !v.verified; saveDoc(data.slug); render(); });
  const moreBtn = document.createElement("button");
  moreBtn.className = "t t-more"; moreBtn.setAttribute("data-pop", ""); moreBtn.title = "Más: aprendido, opcional, insertar, borrar";
  moreBtn.textContent = "⋯";
  moreBtn.addEventListener("click", () => moreMenu(data, v, moreBtn));
  top.append(ord, colorBtn, verBtn, moreBtn);

  // grados editables (top→bottom), con el grado RELABELADO según la variante
  const stack = document.createElement("div");
  stack.className = "deg-stack" + (v.optional ? " paren" : "");
  v.degrees.forEach((g, i) => {
    const shown = dmap[g] ?? g;
    const d = document.createElement("button");
    d.className = "deg"; d.setAttribute("data-pop", "");
    d.setAttribute("aria-label", `Grado voz ${i + 1}: ${shown}. Tocar para cambiar.`);
    d.textContent = shown;
    d.addEventListener("click", () => editDegree(data, v, i, d));
    stack.appendChild(d);
  });

  if (isLearned) card.setAttribute("title", "Ya me lo sé");
  card.append(top, stack);
  return card;
}

// Menú "⋯": acciones menos frecuentes, en popover (sin modal).
function moreMenu(data, v, anchor) {
  const isLearned = !!learned[v.id];
  openPopover(anchor, [
    { html: `${isLearned ? "✓" : "○"}&nbsp; Ya me lo sé`, onPick: () => { if (learned[v.id]) delete learned[v.id]; else learned[v.id] = true; saveLearned(); render(); } },
    { html: `${v.optional ? "✓" : "○"}&nbsp; Opcional ( )`, onPick: () => { v.optional = !v.optional; saveDoc(data.slug); render(); } },
    { html: `＋&nbsp; Insertar columna después`, onPick: () => insertAfter(data, v.order) },
    { html: `🗑&nbsp; Borrar columna`, cls: "danger", onPick: () => deleteVoicing(data, v) },
  ]);
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
  data.voicings.sort((a, b) => a.order - b.order);
  for (const v of data.voicings) el.grid.appendChild(makeCard(data, v));
}

function renderHonesty() {
  const data = state.chapters[state.active];
  const ch = CHAPTERS.find((c) => c.slug === state.active);
  if (!data || (!data.file && data.voicings.length === 0)) { el.honesty.textContent = ""; return; }
  const n = data.voicings.length;
  const decl = ch.declared || n;
  const falta = decl - n;
  const ver = countVerified(data);
  el.honesty.innerHTML =
    `<b>${n}</b> de <b>${decl}</b> transcritos` +
    (falta > 0 ? ` — <span class="miss">faltan ${falta}</span>` : falta < 0 ? ` — <span class="miss">${-falta} de más</span>` : ` ✓`) +
    ` · verificados <b>${ver}</b>/${n}`;
}

function renderContinuar() {
  const data = state.chapters[state.active];
  const next = data && data.voicings.length ? firstUnlearned(data) : null;
  if (!data || data.voicings.length === 0) {
    el.where.textContent = ""; el.goBtn.textContent = "Sin voicings"; el.goBtn.disabled = true; el.goBtn.onclick = null;
  } else if (!next) {
    el.where.textContent = ""; el.goBtn.textContent = "Todo aprendido ✓"; el.goBtn.disabled = true; el.goBtn.onclick = null;
  } else {
    el.where.innerHTML = `vas por el <span class="n">nº ${next.order}</span>`;
    el.goBtn.textContent = "Continuar →"; el.goBtn.disabled = false;
    el.goBtn.onclick = () => { const node = document.getElementById(`v-${next.id}`); node.scrollIntoView({ behavior: "smooth", block: "center" }); node.querySelector(".deg")?.focus(); };
  }
}

function render() {
  renderChapters();
  renderIntro();
  renderVariants();
  renderGrid();
  renderHonesty();
  renderContinuar();
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
