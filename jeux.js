(() => {
  const STATUSES = { playing: "En cours", backlog: "À jouer", wish: "Envie", done: "Fini", platinum: "Platiné / 100 %", dropped: "Abandonné" };
  const PLATFORMS = ["PC", "PS5", "PS4", "Switch", "Xbox", "Mobile", "Autre"];
  const KEY = "qg-games";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const fmt = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
  const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; } catch (e) { return ""; } };

  let items = [];
  let filter = "all", query = "", sort = "recent", editingId = null, introPlayed = false;
  const bumped = new Set();

  function load() {
    try { items = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); }
    catch (e) { toast("Ce navigateur bloque l'enregistrement"); }
  }
  try { filter = localStorage.getItem("qg-games-filter") || "all"; sort = localStorage.getItem("qg-games-sort") || "recent"; } catch (e) {}
  $("sort").value = sort;

  for (const p of PLATFORMS) $("f-platform").insertAdjacentHTML("beforeend", `<option>${p}</option>`);
  for (const [k, v] of Object.entries(STATUSES)) $("f-status").insertAdjacentHTML("beforeend", `<option value="${k}">${v}</option>`);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 2400);
  }

  function ago(ts) {
    if (!ts) return "";
    const days = Math.floor((new Date(new Date().toDateString()) - new Date(new Date(ts).toDateString())) / 86400000);
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return "hier";
    if (days < 30) return `il y a ${days} j`;
    return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  }

  const EXTRA = { hours: "Avec heures de jeu" };
  function matches(g) {
    if (filter === "all") return true;
    if (filter === "finished") return g.status === "done" || g.status === "platinum";
    if (filter === "hours") return (num(g.hours) ?? 0) > 0;
    return g.status === filter;
  }

  function renderStats() {
    const playing = items.filter((g) => g.status === "playing").length;
    const backlog = items.filter((g) => g.status === "backlog").length;
    const finished = items.filter((g) => g.status === "done" || g.status === "platinum").length;
    const hours = items.reduce((s, g) => s + (num(g.hours) ?? 0), 0);
    $("stats").innerHTML = [
      ["En cours", playing, false, "playing"],
      ["À jouer", backlog, backlog > 0, "backlog"],
      ["Finis", finished, false, "finished"],
      ["Heures de jeu", Math.round(hours).toLocaleString("fr-FR"), false, "hours"]
    ].map(([l, v, hot, f]) => `<button type="button" class="stat${hot ? " hot" : ""}" data-filter="${f}" aria-pressed="${filter === f}"><span class="v">${v}</span><span class="l">${l}</span></button>`).join("");
  }

  function renderTabs() {
    const entries = [["all", "Tous", items.length], ...Object.entries(STATUSES).map(([k, v]) => [k, v, items.filter((g) => g.status === k).length])];
    if (filter === "finished") entries.push(["finished", "Finis + platinés", items.filter(matches).length]);
    if (EXTRA[filter]) entries.push([filter, EXTRA[filter], items.filter(matches).length]);
    $("tabs").innerHTML = entries.map(([k, v, n]) => `<button class="tab" type="button" data-filter="${k}" aria-pressed="${filter === k}">${v}<b>${n}</b></button>`).join("");
  }

  function card(g, i) {
    const h = num(g.hours) ?? 0;
    const metas = [];
    if (num(g.rating) != null) metas.push(`<span>Note <b>${fmt(g.rating)}/10</b></span>`);
    if (g.updatedAt) metas.push(`<span>Joué ${ago(g.updatedAt)}</span>`);
    const cover = safeUrl(g.cover);
    return `<article class="card" data-id="${esc(g.id)}" style="--i:${Math.min(i, 11)}">
      <div class="box">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span aria-hidden="true">？</span>`}</div>
      <div class="info">
        <div class="card-top">
          <span class="plat">${esc(g.platform || "PC")}</span>
          <span class="stamp s-${esc(g.status)}">${STATUSES[g.status] || "En cours"}</span>
        </div>
        <h3>${esc(g.title)}</h3>
        <div class="hours"><span class="num${bumped.has(g.id) ? " bump" : ""}">${fmt(h)}</span><span class="u">H</span></div>
        ${metas.length ? `<div class="meta">${metas.join("")}</div>` : ""}
        ${g.note ? `<p class="note">${esc(g.note)}</p>` : ""}
        <div class="actions">
          <button class="btn ghost" type="button" data-act="minus" aria-label="Retirer une heure à ${esc(g.title)}">−1 h</button>
          <button class="btn" type="button" data-act="plus" aria-label="Ajouter une heure à ${esc(g.title)}">+1 h</button>
          <span class="spacer"></span>
          <button class="btn ghost" type="button" data-act="edit">Modifier</button>
        </div>
      </div>
    </article>`;
  }

  function render() {
    renderStats();
    renderTabs();
    let shown = items.filter(matches);
    const q = query.trim().toLowerCase();
    if (q) shown = shown.filter((g) => String(g.title).toLowerCase().includes(q) || String(g.note || "").toLowerCase().includes(q));
    shown.sort((a, b) => {
      if (sort === "title") return String(a.title).localeCompare(String(b.title), "fr");
      if (sort === "hours") return (num(b.hours) ?? 0) - (num(a.hours) ?? 0);
      if (sort === "rating") return (num(b.rating) ?? -1) - (num(a.rating) ?? -1);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    const grid = $("grid");
    if (!items.length) grid.innerHTML = `<div class="empty"><span class="kana-sm" aria-hidden="true">シーン…</span><h2>Aucun jeu pour l'instant</h2><p>Ajoute ton premier jeu avec « Ajouter un jeu » en haut.</p></div>`;
    else if (!shown.length) grid.innerHTML = `<div class="empty"><span class="kana-sm" aria-hidden="true">？</span><h2>Aucun jeu ici</h2><p>Rien ne correspond à ce filtre ou à cette recherche.</p></div>`;
    else {
      if (!introPlayed) { introPlayed = true; grid.classList.add("intro"); setTimeout(() => grid.classList.remove("intro"), 1200); }
      grid.innerHTML = shown.map(card).join("");
    }
    bumped.clear();
  }

  function update(id, patch) {
    items = items.map((g) => (g.id === id ? { ...g, ...patch } : g));
    save();
    render();
  }

  // ---- Jaquette : image de la page Wikipédia anglaise du jeu ----
  const STOP = new Set(["the", "a", "of", "le", "la", "les", "de", "du", "des", "et", "and", "video", "game", "jeu"]);
  const words = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, " ").split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
  function titleScore(q, c) {
    const a = new Set(words(q)), b = new Set(words(c));
    if (!a.size || !b.size) return 0;
    const common = [...a].filter((w) => b.has(w)).length;
    return Math.min(common / a.size, common / b.size);
  }

  async function findCover(title) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const url = "https://en.wikipedia.org/w/api.php?format=json&origin=*&action=query&prop=pageimages&piprop=thumbnail&pithumbsize=400&pilicense=any&redirects=1&generator=search&gsrlimit=6&gsrsearch="
        + encodeURIComponent(title + " video game");
      const j = await (await fetch(url, { signal: ctrl.signal })).json();
      const pages = Object.values(j.query?.pages || {})
        .filter((p) => p.thumbnail && titleScore(title, p.title) >= 0.5)
        .sort((a, b) => titleScore(title, b.title) - titleScore(title, a.title) || a.index - b.index);
      return pages[0]?.thumbnail.source.replace(/\?.*$/, "") || "";
    } catch (e) {
      return "";
    } finally {
      clearTimeout(timer);
    }
  }

  function showPreview() {
    const u = safeUrl($("f-cover").value.trim());
    $("coverPrev").innerHTML = u ? `<img src="${esc(u)}" alt="" referrerpolicy="no-referrer">` : `<span aria-hidden="true">？</span>`;
  }

  $("coverBtn").addEventListener("click", async () => {
    const title = $("f-title").value.trim();
    if (!title) { $("coverHint").textContent = "Écris d'abord le titre du jeu."; return; }
    $("coverBtn").disabled = true;
    $("coverHint").textContent = "Recherche de la jaquette…";
    const u = await findCover(title);
    $("coverBtn").disabled = false;
    if (u) { $("f-cover").value = u; showPreview(); $("coverHint").textContent = "Jaquette trouvée sur Wikipédia. Colle un autre lien si ce n'est pas la bonne."; }
    else $("coverHint").textContent = "Pas de jaquette trouvée. Colle un lien d'image (clic droit sur une image → Copier l'adresse de l'image).";
  });
  $("f-cover").addEventListener("change", showPreview);

  // ---- Formulaire ----
  function openForm(id) {
    editingId = id || null;
    const g = id ? items.find((x) => x.id === id) : null;
    $("formTitle").textContent = g ? "Modifier le jeu" : "Nouveau jeu";
    $("f-title").value = g?.title || "";
    $("f-platform").value = g?.platform || "PC";
    $("f-status").value = g?.status || "playing";
    $("f-hours").value = num(g?.hours) ?? "";
    $("f-rating").value = num(g?.rating) ?? "";
    $("f-cover").value = g?.cover || "";
    $("f-note").value = g?.note || "";
    $("coverHint").textContent = "La jaquette est cherchée sur Wikipédia à l'enregistrement si ce champ est vide.";
    showPreview();
    $("delBtn").hidden = !g;
    $("delBtn").classList.remove("armed");
    $("delBtn").textContent = "Supprimer";
    $("formErr").hidden = true;
    $("overlay").hidden = false;
    $("f-title").focus();
  }
  const closeForm = () => { $("overlay").hidden = true; editingId = null; };

  function readNum(id, max) {
    const raw = $(id).value.trim();
    if (raw === "") return null;
    const v = Number(raw.replace(",", "."));
    if (!isFinite(v) || v < 0) return undefined;
    return max != null ? Math.min(v, max) : v;
  }

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("formErr");
    const title = $("f-title").value.trim();
    if (!title) { err.textContent = "Donne un titre au jeu."; err.hidden = false; return; }
    const hours = readNum("f-hours"), rating = readNum("f-rating", 10);
    if (hours === undefined || rating === undefined) { err.textContent = "Les nombres doivent être positifs."; err.hidden = false; return; }
    const coverRaw = $("f-cover").value.trim();
    if (coverRaw && !safeUrl(coverRaw)) { err.textContent = "Le lien de la jaquette doit commencer par https://"; err.hidden = false; return; }
    const data = {
      title, platform: $("f-platform").value, status: $("f-status").value,
      hours: hours ?? 0, rating, cover: coverRaw ? safeUrl(coverRaw) : "", note: $("f-note").value.trim(), updatedAt: Date.now()
    };
    const id = editingId || "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (editingId) items = items.map((g) => (g.id === id ? { id, ...data } : g));
    else items = [...items, { id, ...data }];
    save();
    closeForm();
    render();
    toast(editingId ? "Jeu mis à jour" : "Jeu ajouté");
    // Jaquette cherchée après coup, sans faire attendre
    if (!data.cover) {
      const u = await findCover(title);
      if (u && items.some((g) => g.id === id && !g.cover)) update(id, { cover: u });
    }
  });

  $("delBtn").addEventListener("click", () => {
    const b = $("delBtn");
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Confirmer la suppression"; return; }
    items = items.filter((g) => g.id !== editingId);
    save();
    closeForm();
    render();
    toast("Jeu supprimé");
  });
  $("cancelBtn").addEventListener("click", closeForm);
  $("overlay").addEventListener("click", (e) => { if (e.target === $("overlay")) closeForm(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("overlay").hidden) closeForm(); });
  $("addBtn").addEventListener("click", () => openForm(null));

  $("grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.closest(".card").dataset.id;
    const g = items.find((x) => x.id === id);
    if (!g) return;
    if (b.dataset.act === "edit") return openForm(id);
    const h = Math.max(0, (num(g.hours) ?? 0) + (b.dataset.act === "plus" ? 1 : -1));
    const patch = { hours: h, updatedAt: Date.now() };
    if (b.dataset.act === "plus" && (g.status === "backlog" || g.status === "wish")) patch.status = "playing";
    bumped.add(id);
    update(id, patch);
  });

  $("grid").addEventListener("error", (e) => {
    // Image cassée : on remet le point d'interrogation
    if (e.target.tagName === "IMG") e.target.replaceWith(Object.assign(document.createElement("span"), { textContent: "？" }));
  }, true);

  const setFilter = (f) => { filter = f; try { localStorage.setItem("qg-games-filter", f); } catch (e) {} render(); };
  $("stats").addEventListener("click", (e) => { const b = e.target.closest("[data-filter]"); if (b) setFilter(filter === b.dataset.filter ? "all" : b.dataset.filter); });
  $("tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-filter]"); if (b) setFilter(b.dataset.filter); });
  $("search").addEventListener("input", (e) => { query = e.target.value; render(); });
  $("sort").addEventListener("change", (e) => { sort = e.target.value; try { localStorage.setItem("qg-games-sort", sort); } catch (err) {} render(); });

  // Une sauvegarde restaurée depuis le tableau de bord : on relit la liste
  window.addEventListener("storage", (e) => { if (e.key === KEY || e.key === null) { load(); render(); } });

  // Jaquettes manquantes (jeux ajoutés sans réseau, sauvegarde restaurée…) : une seule tentative par jeu
  async function fillCovers() {
    for (const g of items.filter((x) => !x.cover && !x.coverTried)) {
      const u = await findCover(g.title);
      if (items.some((x) => x.id === g.id)) update(g.id, u ? { cover: u } : { coverTried: true });
    }
  }

  load();
  render();
  setTimeout(fillCovers, 800);
})();
