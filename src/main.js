// spread4notes — herramienta de transcripción + estudio.
//
// El borrador (data/draft/*.json) es una lectura por visión con ~8 columnas
// faltantes y errores. El autor lo corrige AQUÍ, mientras estudia. El único
// lector del escaneo es el autor; la app no lee la imagen.
//
// Verdad: el JSON EXPORTADO. localStorage es solo el estado de trabajo.
// Dos estados DISTINTOS: `verified` (transcripción corregida, se exporta) y
// `learned` (estudio personal, NO se exporta). Los grados van top→bottom.

import { LEGEND } from "./core/legend.js";
import { validateVoicing } from "../tools/validate.js";
import { computeIntervals } from "./core/voicing.js";

const CHAPTERS = [
  { slug: "ionian", name: "Jónico", file: "data/draft/p02-jonico.json", declared: 85 },
  { slug: "dorian", name: "Dórico", file: "data/draft/p03-dorico-eolico.json", declared: 104 },
  { slug: "aeolian", name: "Eólico", file: "data/draft/p03-dorico-eolico.json", declared: 104, asMode: "aeolian", mapDegree: { "13": "b13" } },
  { slug: "mixolydian", name: "Mixolidio", file: null },
  { slug: "lydian", name: "Lidio", file: null },
  { slug: "locrian", name: "Locrio", file: null },
];

// ---------- persistencia ----------
const LEARN_KEY = "s4n-learned";                 // personal, NO se exporta
const docKey = (slug) => `s4n-doc-${slug}`;      // estado de trabajo, se exporta
const learned = JSON.parse(localStorage.getItem(LEARN_KEY) || "{}");
const saveLearned = () => localStorage.setItem(LEARN_KEY, JSON.stringify(learned));

const state = { active: "ionian", chapters: {}, intro: null };

let uid = 0;
const newId = () => `ins-${Date.now().toString(36)}-${(uid++).toString(36)}`;

async function loadChapter(ch) {
  if (!ch.file) return { ...ch, voicings: [], meta: null };
  const base = await (await fetch(ch.file)).json();
  // Un capítulo puede reusar el archivo de otro modo con un mapeo de grados
  // (Eólico = Dórico con 13 -> b13): mismos voicings, escala/mode distintos.
  const map = ch.mapDegree || {};
  const mp = (g) => (map[g] ?? g);
  const mode = ch.asMode || base.mode;
  const chordScale = (base.chordScale || []).map(mp);
  const meta = { mode, chordScale, source: base.source };
  const saved = localStorage.getItem(docKey(ch.slug));
  let voicings;
  if (saved) {
    voicings = JSON.parse(saved);
  } else {
    voicings = base.voicings.map((v) => ({
      id: v.id, order: v.order, system: v.system ?? null, column: v.column ?? null,
      degrees: v.degrees.map(mp), highlight: v.highlight ?? null,
      optional: !!v.optional, verified: false, inManuscript: v.inManuscript !== false,
    }));
    localStorage.setItem(docKey(ch.slug), JSON.stringify(voicings));
  }
  return { ...ch, meta, voicings };
}

function saveDoc(slug) {
  localStorage.setItem(docKey(slug), JSON.stringify(state.chapters[slug].voicings));
}
function renumber(voicings) { voicings.sort((a, b) => a.order - b.order).forEach((v, i) => (v.order = i + 1)); }

// ---------- derivados ----------
const reasonsOf = (v, mode) => validateVoicing(v.degrees, mode);
const isReview = (v, mode) => reasonsOf(v, mode).length > 0;
const studiable = (data) => data.voicings.filter((v) => !isReview(v, data.meta.mode));
const countLearned = (data) => studiable(data).filter((v) => learned[v.id]).length;
const countVerified = (data) => data.voicings.filter((v) => v.verified).length;
const firstUnlearned = (data) => studiable(data).find((v) => !learned[v.id]) || null;

function colorAudit(data) {
  const got = {};
  for (const v of data.voicings) if (v.highlight) got[v.highlight] = (got[v.highlight] || 0) + 1;
  return got;
}

// ---------- DOM refs ----------
const el = {
  chapters: document.getElementById("chapters"),
  intro: document.getElementById("intro"),
  legend: document.getElementById("legend"),
  grid: document.getElementById("grid"),
  honesty: document.getElementById("honesty"),
  audit: document.getElementById("audit"),
  where: document.getElementById("where"),
  goBtn: document.getElementById("go"),
  exportBtn: document.getElementById("export"),
  resetBtn: document.getElementById("reset"),
};

// ---------- popover inline (sin modales) ----------
let popover = null;
function closePopover() { if (popover) { popover.remove(); popover = null; } }
document.addEventListener("click", (e) => { if (popover && !popover.contains(e.target) && !e.target.closest("[data-pop]")) closePopover(); });
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
  const r = anchor.getBoundingClientRect();
  const pr = p.getBoundingClientRect();
  let left = r.left + r.width / 2 - pr.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
  let top = r.bottom + 6;
  if (top + pr.height > window.innerHeight - 8) top = r.top - pr.height - 6;
  p.style.left = `${left}px`;
  p.style.top = `${top}px`;
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
  const order = ["yellow", "orange", "purple", "red", "blue"];
  el.legend.innerHTML = order.map((c) =>
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

const MODES_DEGREE_ORDER = ["1", "b9", "9", "b3", "3", "11", "#11", "b5", "5", "#5", "b13", "6", "13", "b7", "7"];

function editDegree(data, v, i, anchor) {
  const scale = data.meta.chordScale;
  const items = scale
    .slice()
    .sort((a, b) => MODES_DEGREE_ORDER.indexOf(a) - MODES_DEGREE_ORDER.indexOf(b))
    .map((g) => ({
      html: g, cls: g === v.degrees[i] ? "sel" : "",
      onPick: () => { v.degrees[i] = g; saveDoc(data.slug); render(); },
    }));
  openPopover(anchor, items);
}

function editColor(data, v, anchor) {
  const opts = [
    { c: "yellow" }, { c: "orange" }, { c: "purple" }, { c: "red" }, { c: "blue" }, { c: null },
  ];
  const items = opts.map((o) => ({
    html: o.c ? `<span class="sw" style="background:var(--${o.c})"></span>${LEGEND[o.c]}` : `<span class="sw none"></span>Ninguno`,
    cls: (v.highlight ?? null) === o.c ? "sel" : "",
    onPick: () => { v.highlight = o.c; saveDoc(data.slug); render(); },
  }));
  openPopover(anchor, items);
}

function insertAfter(data, order) {
  const scale = data.meta?.chordScale || ["1", "7", "3", "5"];
  const nv = {
    id: newId(), order: order + 0.5, system: null, column: null,
    degrees: scale.slice(0, 4), highlight: null, optional: false,
    verified: false, inManuscript: true,
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
  const mode = data.meta.mode;
  const review = isReview(v, mode);
  const reason = review ? reasonsOf(v, mode)[0] : null;
  const isLearned = !!learned[v.id];
  const card = document.createElement("div");
  card.className =
    "voicing" +
    (v.highlight ? ` hl-${v.highlight}` : "") +
    (v.optional ? " optional" : "") +
    (review ? " review" : "") +
    (v.verified ? " verified" : "") +
    (isLearned ? " learned" : "");
  card.id = `v-${v.id}`;

  // fila superior compacta: orden · color · verificado · menú (⋯)
  const top = document.createElement("div");
  top.className = "v-top";
  const ord = document.createElement("span");
  ord.className = "ord"; ord.textContent = v.order;
  const colorBtn = document.createElement("button");
  colorBtn.className = "t t-color"; colorBtn.setAttribute("data-pop", "");
  colorBtn.title = v.highlight ? LEGEND[v.highlight] : "Sin color";
  colorBtn.innerHTML = v.highlight ? `<span class="sw" style="background:var(--${v.highlight})"></span>` : `<span class="sw none"></span>`;
  colorBtn.addEventListener("click", () => editColor(data, v, colorBtn));
  const verBtn = document.createElement("button");
  verBtn.className = "t t-ver" + (v.verified ? " on" : ""); verBtn.setAttribute("data-pop", "");
  verBtn.setAttribute("aria-pressed", String(v.verified)); verBtn.title = "Verificado (transcripción correcta)";
  verBtn.textContent = "✓";
  verBtn.addEventListener("click", () => { v.verified = !v.verified; saveDoc(data.slug); render(); });
  const moreBtn = document.createElement("button");
  moreBtn.className = "t t-more"; moreBtn.setAttribute("data-pop", ""); moreBtn.title = "Más: aprendido, opcional, insertar, borrar";
  moreBtn.textContent = "⋯";
  moreBtn.addEventListener("click", () => moreMenu(data, v, moreBtn));
  top.append(ord, colorBtn, verBtn, moreBtn);

  // grados editables (top→bottom)
  const stack = document.createElement("div");
  stack.className = "deg-stack";
  if (v.optional) stack.classList.add("paren");
  v.degrees.forEach((g, i) => {
    const d = document.createElement("button");
    d.className = "deg";
    d.setAttribute("data-pop", "");
    d.setAttribute("aria-label", `Grado voz ${i + 1}: ${g}. Tocar para cambiar.`);
    d.textContent = g;
    d.addEventListener("click", () => editDegree(data, v, i, d));
    stack.appendChild(d);
  });

  if (isLearned) card.setAttribute("title", "Ya me lo sé");
  if (review) { const tag = document.createElement("span"); tag.className = "review-tag"; tag.title = reason || "revisar"; tag.textContent = "!"; card.appendChild(tag); }

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
  if (!transcribable && (!data || data.voicings.length === 0)) {
    el.grid.innerHTML = `<p class="empty">Este capítulo aún no está transcrito.<br>Próximamente.</p>`;
    return;
  }
  // insertar al inicio (siempre disponible en capítulos transcribibles)
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
  if (!data || (!data.file && data.voicings.length === 0)) { el.honesty.textContent = ""; el.audit.textContent = ""; return; }
  const n = data.voicings.length;
  const decl = ch.declared || n;
  const falta = decl - n;
  const ver = countVerified(data);
  el.honesty.innerHTML =
    `<b>${n}</b> de <b>${decl}</b> transcritos` +
    (falta > 0 ? ` — <span class="miss">faltan ${falta}</span>` : falta < 0 ? ` — <span class="miss">${-falta} de más</span>` : ` ✓`) +
    ` · verificados <b>${ver}</b>/${n}`;

  if (ch.audit) {
    const got = colorAudit(data);
    const cell = (c) => {
      const g = got[c] || 0, ok = g === ch.audit[c];
      return `<span class="au ${ok ? "ok" : "bad"}"><span class="sw" style="background:var(--${c})"></span>${g}/${ch.audit[c]}</span>`;
    };
    el.audit.innerHTML = `auditoría de color: ${Object.keys(ch.audit).map(cell).join(" ")}`;
  } else el.audit.textContent = "";
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
  renderGrid();
  renderHonesty();
  renderContinuar();
}

// ---------- exportar / reimportar ----------
function exportJSON() {
  const data = state.chapters[state.active];
  if (!data || !data.meta) return;
  const mode = data.meta.mode;
  const voicings = data.voicings.slice().sort((a, b) => a.order - b.order).map((v) => {
    const reasons = validateVoicing(v.degrees, mode);
    const out = {
      id: v.id, order: v.order, system: v.system ?? null, column: v.column ?? null,
      degrees: v.degrees, intervals: computeIntervals(v.degrees),
      highlight: v.highlight ?? null, optional: !!v.optional,
      verified: !!v.verified, inManuscript: v.inManuscript !== false,
    };
    if (reasons.length) { out.needsReview = true; out.reviewReason = reasons[0]; }
    return out;
  });
  const doc = {
    mode, chordScale: data.meta.chordScale, source: data.meta.source,
    verified: voicings.every((v) => v.verified),
    voicings,
  };
  const blob = new Blob([JSON.stringify(doc, null, 1) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (data.meta.source || `p02-${mode}`).split("/").pop().replace(/\.png$/, "") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function reimport() {
  const ch = CHAPTERS.find((c) => c.slug === state.active);
  if (!ch || !ch.file) return;
  localStorage.removeItem(docKey(ch.slug));
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
