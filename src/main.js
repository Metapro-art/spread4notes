// spread4notes — app de estudio. CERO teoría musical aquí: la teoría vive en
// src/core/ y el significado del color en src/core/legend.js.
//
// Responde una sola pregunta: "¿por cuál voy?". Los voicings se muestran en el
// orden exacto de `order` (conducción melódica) — NUNCA se reordenan.

import { LEGEND } from "./core/legend.js";
import { validateVoicing } from "../tools/validate.js";

// Capítulos = modos. Hoy solo Jónico tiene datos; los demás van visibles y vacíos.
const CHAPTERS = [
  { slug: "ionian", name: "Jónico", file: "data/draft/p02-jonico.json" },
  { slug: "dorian", name: "Dórico", file: null },
  { slug: "aeolian", name: "Eólico", file: null },
  { slug: "mixolydian", name: "Mixolidio", file: null },
  { slug: "lydian", name: "Lidio", file: null },
  { slug: "locrian", name: "Locrio", file: null },
];

const STORE = "s4n-learned"; // { [voicingId]: true }
const learned = JSON.parse(localStorage.getItem(STORE) || "{}");
const persist = () => localStorage.setItem(STORE, JSON.stringify(learned));

const state = { active: "ionian", chapters: {} };

// Carga un capítulo: filtra a los voicings estudiables (los que pasan la MISMA
// validación que CI) y los ordena por `order`. Los que fallan quedan en /data/
// para corregir, pero no se estudian.
async function loadChapter(ch) {
  if (!ch.file) return { ...ch, voicings: [] };
  const doc = await (await fetch(ch.file)).json();
  const voicings = doc.voicings
    .filter((v) => validateVoicing(v.degrees, doc.mode).length === 0)
    .sort((a, b) => a.order - b.order);
  return { ...ch, mode: doc.mode, voicings };
}

const countLearned = (voicings) => voicings.filter((v) => learned[v.id]).length;
const firstUnlearned = (voicings) => voicings.find((v) => !learned[v.id]) || null;

// ---------- render ----------

const el = {
  chapters: document.getElementById("chapters"),
  legend: document.getElementById("legend"),
  grid: document.getElementById("grid"),
  global: document.getElementById("global"),
  where: document.getElementById("where"),
  goBtn: document.getElementById("go"),
};

function renderLegend() {
  el.legend.innerHTML = Object.entries(LEGEND)
    .map(
      ([color, meaning]) =>
        `<span class="lg"><span class="sw" style="background:var(--${color})"></span>${meaning}</span>`
    )
    .join("");
}

function renderChapters() {
  el.chapters.innerHTML = "";
  for (const ch of CHAPTERS) {
    const data = state.chapters[ch.slug];
    const total = data ? data.voicings.length : 0;
    const done = data ? countLearned(data.voicings) : 0;
    const empty = total === 0;
    const b = document.createElement("button");
    b.className = "chapter";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(ch.slug === state.active));
    if (empty && ch.slug !== state.active) {
      // los vacíos siguen visibles y clicables para ver su estado
    }
    b.innerHTML =
      `<span class="cname">${ch.name}</span>` +
      `<span class="ccount">${empty ? "0" : `${done}/${total}`}</span>`;
    b.addEventListener("click", () => {
      state.active = ch.slug;
      render();
    });
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
    const b = document.createElement("button");
    b.className =
      "voicing" +
      (v.highlight ? ` hl-${v.highlight}` : "") +
      (isLearned ? " learned" : "") +
      (!isLearned && v === cursor ? " cursor" : "");
    b.id = `v-${v.id}`;
    b.setAttribute("aria-pressed", String(isLearned));
    const label = LEGEND[v.highlight] ? ` (${LEGEND[v.highlight]})` : "";
    b.setAttribute(
      "aria-label",
      `Voicing ${v.order}: ${v.degrees.join(", ")}${label}. ${isLearned ? "Ya me lo sé" : "Sin marcar"}`
    );
    b.innerHTML =
      `<span class="ord">${v.order}</span>` +
      (isLearned ? `<span class="check">✓</span>` : "") +
      v.degrees.map(DEG).join("");
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
  const total = data ? data.voicings.length : 0;
  const done = data ? countLearned(data.voicings) : 0;
  const chName = CHAPTERS.find((c) => c.slug === state.active).name;
  el.global.innerHTML = `${chName} · <span class="n">${done}</span> / ${total}`;

  const next = data ? firstUnlearned(data.voicings) : null;
  if (!data || total === 0) {
    el.where.textContent = "";
    el.goBtn.textContent = "Sin voicings";
    el.goBtn.disabled = true;
  } else if (!next) {
    el.where.textContent = "";
    el.goBtn.textContent = "Capítulo completo ✓";
    el.goBtn.disabled = true;
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
  renderGrid();
  renderProgress();
}

// ---------- init ----------
(async () => {
  renderLegend();
  for (const ch of CHAPTERS) {
    state.chapters[ch.slug] = await loadChapter(ch);
  }
  render();
})();
