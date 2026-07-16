// spread4notes — app de estudio. CERO teoría musical aquí: la teoría vive en
// src/core/ y el significado del color en src/core/legend.js.
//
// Responde una sola pregunta: "¿por cuál voy?". Los voicings se muestran en el
// orden exacto de `order` (conducción melódica) — NUNCA se reordenan.
// Nada se esconde: las columnas que el validador rechaza salen marcadas
// needsReview y siguen siendo clickeables.

import { LEGEND, LEGEND_KIND } from "./core/legend.js";
import { validateVoicing } from "../tools/validate.js";

// Capítulos = modos. Hoy solo Jónico tiene datos; los demás van visibles y vacíos.
const CHAPTERS = [
  { slug: "ionian", name: "Jónico", file: "data/draft/p02-jonico.json", declared: 85 },
  { slug: "dorian", name: "Dórico", file: null },
  { slug: "aeolian", name: "Eólico", file: null },
  { slug: "mixolydian", name: "Mixolidio", file: null },
  { slug: "lydian", name: "Lidio", file: null },
  { slug: "locrian", name: "Locrio", file: null },
];

const STORE = "s4n-learned"; // { [voicingId]: true }
const learned = JSON.parse(localStorage.getItem(STORE) || "{}");
const persist = () => localStorage.setItem(STORE, JSON.stringify(learned));

const state = { active: "ionian", chapters: {}, intro: null };

// Carga un capítulo: TODAS las columnas entran (nada se esconde), ordenadas por
// `order`. Cada una se marca needsReview si el validador la rechaza (dato en el
// JSON o recalculado aquí, misma regla que CI).
async function loadChapter(ch) {
  if (!ch.file) return { ...ch, voicings: [] };
  const doc = await (await fetch(ch.file)).json();
  const voicings = doc.voicings
    .map((v) => {
      const reasons = validateVoicing(v.degrees, doc.mode);
      const needsReview = v.needsReview || reasons.length > 0;
      return { ...v, needsReview, reviewReason: v.reviewReason || reasons[0] || null };
    })
    .sort((a, b) => a.order - b.order);
  return { ...ch, mode: doc.mode, voicings };
}

// Estudiables = todo lo que no está marcado para revisión.
const studiable = (voicings) => voicings.filter((v) => !v.needsReview);
const countLearned = (voicings) => studiable(voicings).filter((v) => learned[v.id]).length;
const firstUnlearned = (voicings) => studiable(voicings).find((v) => !learned[v.id]) || null;

// ---------- render ----------

const el = {
  chapters: document.getElementById("chapters"),
  intro: document.getElementById("intro"),
  legend: document.getElementById("legend"),
  grid: document.getElementById("grid"),
  global: document.getElementById("global"),
  where: document.getElementById("where"),
  goBtn: document.getElementById("go"),
};

function renderIntro() {
  const it = state.intro;
  if (!it) { el.intro.hidden = true; return; }
  el.intro.hidden = false;
  el.intro.innerHTML =
    `<details>` +
    `<summary><span class="intro-title">${it.title}</span><span class="intro-hint">intro del estudio</span></summary>` +
    it.body.map((p) => `<p>${p}</p>`).join("") +
    `<p class="intro-links">${it.author} · ${it.links.web} · ${it.links.instagram}</p>` +
    `</details>`;
}

function renderLegend() {
  // Recomendaciones (gusto) primero, advertencia después: nunca al revés.
  const order = ["yellow", "orange", "red", "blue"];
  el.legend.innerHTML = order
    .map((color) => {
      const kind = LEGEND_KIND[color];
      const glyph = kind === "warn" ? "⚠ " : "";
      const cls = kind === "warn" ? "lg warn" : "lg";
      return `<span class="${cls}"><span class="sw" style="background:var(--${color})"></span>${glyph}${LEGEND[color]}</span>`;
    })
    .join("");
}

function renderChapters() {
  el.chapters.innerHTML = "";
  for (const ch of CHAPTERS) {
    const data = state.chapters[ch.slug];
    const total = data ? studiable(data.voicings).length : 0;
    const done = data ? countLearned(data.voicings) : 0;
    const empty = total === 0;
    const b = document.createElement("button");
    b.className = "chapter";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(ch.slug === state.active));
    b.innerHTML =
      `<span class="cname">${ch.name}</span>` +
      `<span class="ccount">${empty ? "0" : `${done}/${total}`}</span>`;
    b.addEventListener("click", () => { state.active = ch.slug; render(); });
    el.chapters.appendChild(b);
  }
}

const DEG = (d) => `<span class="deg">${d}</span>`;

function renderGrid() {
  const data = state.chapters[state.active];
  el.grid.innerHTML = "";
  if (!data || data.voicings.length === 0) {
    el.grid.innerHTML = `<p class="empty">Este capítulo aún no está transcrito.<br>Próximamente.</p>`;
    return;
  }
  const cursor = firstUnlearned(data.voicings);
  for (const v of data.voicings) {
    const isLearned = !!learned[v.id];
    const kind = v.highlight ? LEGEND_KIND[v.highlight] : null;
    const b = document.createElement("button");
    b.className =
      "voicing" +
      (v.highlight ? ` hl-${v.highlight}` : "") +
      (kind === "warn" ? " warn" : "") +
      (v.optional ? " optional" : "") +
      (v.needsReview ? " review" : "") +
      (isLearned ? " learned" : "") +
      (!isLearned && v === cursor ? " cursor" : "");
    b.id = `v-${v.id}`;
    b.setAttribute("aria-pressed", String(isLearned));
    const meaning = v.highlight && LEGEND[v.highlight] ? ` (${LEGEND[v.highlight]})` : "";
    const opt = v.optional ? " opcional" : "";
    const rev = v.needsReview ? ` needsReview: ${v.reviewReason || "revisar"}` : "";
    b.setAttribute(
      "aria-label",
      `Voicing ${v.order}: ${v.degrees.join(", ")}${meaning}${opt}.${rev} ${isLearned ? "Ya me lo sé" : "Sin marcar"}`
    );
    if (v.needsReview) b.title = v.reviewReason || "revisar";
    const badges =
      (v.needsReview ? `<span class="badge review" aria-hidden="true">!</span>` : "") +
      (kind === "warn" && !v.needsReview ? `<span class="badge warn" aria-hidden="true">⚠</span>` : "") +
      (isLearned ? `<span class="badge check" aria-hidden="true">✓</span>` : "");
    const stack = v.degrees.map(DEG).join("");
    b.innerHTML =
      `<span class="ord">${v.order}</span>` + badges +
      (v.optional ? `<span class="paren l">(</span>${stack}<span class="paren r">)</span>` : stack);
    b.addEventListener("click", () => {
      if (learned[v.id]) delete learned[v.id];
      else learned[v.id] = true;
      persist();
      render();
    });
    el.grid.appendChild(b);
  }
}

function renderProgress() {
  const data = state.chapters[state.active];
  const ch = CHAPTERS.find((c) => c.slug === state.active);
  const total = data ? studiable(data.voicings).length : 0;
  const transcribed = data ? data.voicings.length : 0;
  const done = data ? countLearned(data.voicings) : 0;
  const decl = ch.declared ? ` · ${transcribed}/${ch.declared} transcritas` : "";
  el.global.innerHTML = `${ch.name} · <span class="n">${done}</span> / ${total}${decl}`;

  const next = data ? firstUnlearned(data.voicings) : null;
  if (!data || total === 0) {
    el.where.textContent = "";
    el.goBtn.textContent = "Sin voicings";
    el.goBtn.disabled = true;
    el.goBtn.onclick = null;
  } else if (!next) {
    el.where.textContent = "";
    el.goBtn.textContent = "Capítulo completo ✓";
    el.goBtn.disabled = true;
    el.goBtn.onclick = null;
  } else {
    el.where.innerHTML = `vas por el <span class="n">nº ${next.order}</span>`;
    el.goBtn.textContent = "Continuar →";
    el.goBtn.disabled = false;
    el.goBtn.onclick = () => {
      const node = document.getElementById(`v-${next.id}`);
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.focus({ preventScroll: true });
    };
  }
}

function render() {
  renderChapters();
  renderIntro();
  renderGrid();
  renderProgress();
}

// ---------- init ----------
(async () => {
  renderLegend();
  try { state.intro = await (await fetch("data/intro.json")).json(); } catch { state.intro = null; }
  for (const ch of CHAPTERS) state.chapters[ch.slug] = await loadChapter(ch);
  render();
})();
