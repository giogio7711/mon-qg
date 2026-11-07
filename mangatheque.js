(() => {
  const STATUSES = {
    reading: "En cours",
    plan: "À lire",
    paused: "En pause",
    done: "Terminé",
    dropped: "Abandonné"
  };
  const TYPES = ["Manga", "Manhwa", "Manhua", "Webtoon", "Light novel", "Comics"];

  let db = null;
  let sampleNs = null;   // Claude, pour retrouver le nombre de tomes parus
  let lookupSeq = 0;
  let mode = "cloud";   // "cloud" (claude.ai) ou "local" (ce navigateur)
  let localOk = true;
  let canWrite = true;
  let readOnlyReason = "";
  let loaded = false;
  let stale = false;
  let items = [];
  const pending = {};   // id -> patch en attente d'écriture
  const writing = {};
  const timers = {};
  let filter = "all";
  let query = "";
  let sort = "recent";
  let editingId = null;
  const seen = {};        // id -> {r, status} au dernier affichage
  let prevStats = null;
  let introPlayed = false;
  let importDraft = null;     // sauvegarde choisie, en attente de confirmation
  let autoCheckStarted = false;
  let checking = null;        // {done, total} pendant la vérification des nouveaux tomes

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const fmt = (v) => (v == null ? "—" : String(Math.round(v * 10) / 10).replace(".", ","));

  try { const s = localStorage.getItem("mtq-filter"); if (s) filter = s; } catch (e) {}
  try { const s = localStorage.getItem("mtq-sort"); if (s) sort = s; } catch (e) {}
  $("sort").value = sort;

  for (const t of TYPES) $("f-type").insertAdjacentHTML("beforeend", `<option>${t}</option>`);
  for (const [k, v] of Object.entries(STATUSES)) $("f-status").insertAdjacentHTML("beforeend", `<option value="${k}">${v}</option>`);

  function view() {
    return items.map((it) => (pending[it.id] ? { ...it, ...pending[it.id] } : it));
  }

  function behindBy(it) {
    const r = num(it.volumeRead) ?? 0, t = num(it.volumesTotal);
    return t != null && t > r ? t - r : 0;
  }

  // Tout lu, tout paru, tout possédé et pas de marque-page → Terminé ; un marque-page → En cours
  function autoStatus(it) {
    if (it.status === "dropped") return it.status;
    if (num(it.page) != null) return "reading";
    const r = num(it.volumeRead), t = num(it.volumesTotal), o = num(it.volumesOwned);
    if (r != null && r > 0 && r === t && r === o) return "done";
    return it.status;
  }

  function ago(ts) {
    if (!ts) return "";
    const d = new Date(ts), now = new Date();
    const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return "hier";
    if (days < 30) return `il y a ${days} j`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  }

  function safeUrl(u) {
    try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; } catch (e) { return ""; }
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 2400);
  }

  function renderStats(list) {
    const reading = list.filter((i) => i.status === "reading").length;
    const read = list.reduce((s, i) => s + (num(i.volumeRead) ?? 0), 0);
    const toCatch = list.filter((i) => i.status === "reading" && behindBy(i) > 0).length;
    const vols = list.reduce((s, i) => s + (num(i.volumesOwned) ?? 0), 0);
    const values = [reading, toCatch, read, vols];
    $("stats").innerHTML = [
      ["En cours", reading, false, "reading"],
      ["À rattraper", toCatch, toCatch > 0, "catchup"],
      ["Tomes lus", read.toLocaleString("fr-FR"), false, "hasRead"],
      ["Tomes possédés", vols.toLocaleString("fr-FR"), false, "owned"]
    ].map(([l, v, hot, f], i) => {
      const pop = prevStats && prevStats[i] !== values[i] ? " pop" : "";
      return `<button type="button" class="stat${hot ? " hot" : ""}${pop}" data-filter="${f}" aria-pressed="${filter === f}" title="Afficher : ${l.toLowerCase()}"><span class="v">${v}</span><span class="l">${l}</span></button>`;
    }).join("");
    if (loaded) prevStats = values;
  }

  // Filtres ouverts depuis les compteurs du haut
  const EXTRA = { catchup: "À rattraper", hasRead: "Avec tomes lus", owned: "Tomes possédés" };

  // ---- Sorties à venir et nouveaux tomes (gardés dans ce navigateur) ----
  const loadJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch (e) { return fallback; } };
  const saveJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} };
  let releases = loadJson("mtq-releases", {});   // id -> {checked, fr, next: {vol, date, prec}}
  let news = loadJson("mtq-news", []);            // [{id, title, from, to}]
  if (!releases || typeof releases !== "object") releases = {};
  if (!Array.isArray(news)) news = [];

  function upcoming(it) {
    const n = releases[it.id]?.next;
    if (!n || !(n.date > Date.now())) return null;
    if (num(it.volumesTotal) != null && n.vol <= it.volumesTotal) return null;
    return n;
  }

  function fmtRelease(n) {
    const d = new Date(n.date);
    if (n.prec === "year") return `en ${d.getFullYear()}`;
    if (n.prec === "month") return `en ${d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
    return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  function matches(i) {
    if (filter === "all") return true;
    if (filter === "soon") return !!upcoming(i);
    if (filter === "catchup") return i.status === "reading" && behindBy(i) > 0;
    if (filter === "hasRead") return (num(i.volumeRead) ?? 0) > 0;
    if (filter === "owned") return (num(i.volumesOwned) ?? 0) > 0;
    return i.status === filter;
  }

  function renderTabs(list) {
    const counts = { all: list.length };
    for (const k of Object.keys(STATUSES)) counts[k] = list.filter((i) => i.status === k).length;
    const entries = [["all", "Toutes"], ...Object.entries(STATUSES)];
    counts.soon = list.filter((i) => upcoming(i)).length;
    if (counts.soon || filter === "soon") entries.push(["soon", "Sorties à venir"]);
    $("tabs").innerHTML = entries.map(([k, v]) =>
      `<button class="tab" type="button" data-filter="${k}" aria-pressed="${filter === k}">${v}<b>${counts[k]}</b></button>`).join("") +
      (EXTRA[filter] ? `<button class="tab extra" type="button" data-filter="all" aria-pressed="true" title="Retirer ce filtre">${EXTRA[filter]}<b>${list.filter(matches).length}</b> ✕</button>` : "");
  }

  function renderNotices(list) {
    const parts = [];
    if (mode === "local" && loaded && !localOk) parts.push(`<div class="notice warn">Ce navigateur bloque l'enregistrement : tes modifications seront perdues à la fermeture de la page.</div>`);
    if (stale) parts.push(`<div class="notice">Tes données ne répondent pas encore. Ce qui est affiché peut ne pas être à jour.</div>`);
    if (readOnlyReason) parts.push(`<div class="notice">${esc(readOnlyReason)}</div>`);
    if (importDraft) {
      parts.push(`<div class="notice warn"><span>Restaurer « ${esc(importDraft.name)} » : ${importDraft.series.length} série${importDraft.series.length > 1 ? "s" : ""}. Ta liste actuelle (${list.length} série${list.length > 1 ? "s" : ""}) sera remplacée.</span>
        <span><button class="btn ghost" type="button" id="importCancel">Annuler</button> <button class="btn primary" type="button" id="importOk">Remplacer ma liste</button></span></div>`);
    }
    const fresh = news.filter((n) => list.some((i) => i.id === n.id));
    if (fresh.length) {
      parts.push(`<div class="notice"><span>Nouveau${fresh.length > 1 ? "x" : ""} tome${fresh.length > 1 ? "s" : ""} sorti${fresh.length > 1 ? "s" : ""} en France : ${fresh.map((n) => `${esc(n.title)} tome ${esc(n.to)}`).join(", ")}.</span><button class="btn ghost" type="button" id="newsOk">Vu</button></div>`);
    }
    if (canWrite && list.some((i) => i.example)) {
      parts.push(`<div class="notice info"><span>Les fiches marquées « exemple » sont là pour te montrer l'outil. Remplace-les par tes séries.</span><button class="btn ghost" type="button" id="clearEx">Retirer les exemples</button></div>`);
    }
    $("notices").innerHTML = parts.join("");
  }

  // Marque-page : page atteinte dans le tome en cours (le tome qui suit le dernier tome lu)
  function bookmark(it, r, t) {
    if (it.status === "done" || it.status === "dropped") return "";
    if (t != null && r >= t && num(it.page) == null) return "";
    const page = num(it.page);
    const label = `Tome ${r + 1}`;
    if (!canWrite) return page != null ? `<div class="bookmark"><span class="mark">Marque-page</span> ${label}, page ${page}</div>` : "";
    return `<div class="bookmark"><span class="mark">Marque-page</span>
      <label>${label}, page <input type="number" min="0" step="1" inputmode="numeric" data-act="page" id="page-${esc(it.id)}" value="${page ?? ""}" placeholder="—" aria-label="Page atteinte dans le tome ${r + 1} de ${esc(it.title)}"></label></div>`;
  }

  // Une tranche par tome : noire = lu, tramée = possédé pas lu, pointillés = pas encore acheté
  function shelf(it, r, t, owned, pct, newRead) {
    const n = Math.max(t ?? 0, owned ?? 0, r);
    if (n === 0) return "";
    if (n > 60) return `<div class="bar${it.status === "done" ? " s-done-bar" : ""}" data-max="${n}" title="Clique pour voir un tome (1 à ${n})"><i style="width:${pct.toFixed(1)}%"></i></div>`;
    let spines = "";
    for (let i = 1; i <= n; i++) {
      const state = i <= r ? "read" : owned != null && i <= owned ? "own" : "miss";
      const tip = `Tome ${i} · ${state === "read" ? "lu" : state === "own" ? "possédé, à lire" : owned != null ? "à acheter" : "pas encore lu"}`;
      spines += `<i class="${state}${newRead && i === r ? " new" : ""}" data-vol="${i}" data-tip="${tip}"></i>`;
    }
    const hasOwn = owned != null && owned > r, hasMiss = owned != null ? n > Math.max(owned, r) : n > r;
    return `<div class="shelf${it.status === "done" ? " s-done-shelf" : ""}" role="img" aria-label="${r} tomes lus sur ${n}">${spines}</div>
      <div class="legend"><span class="l-read">lus</span>${hasOwn ? `<span class="l-own">possédés à lire</span>` : ""}${hasMiss ? `<span class="l-miss">${owned != null ? "à acheter" : "pas encore lus"}</span>` : ""}</div>`;
  }

  function card(it, index) {
    const r = num(it.volumeRead) ?? 0, t = num(it.volumesTotal);
    // Ce qui vient de changer depuis l'affichage précédent, pour l'animer une seule fois
    const before = seen[it.id];
    const newRead = !!before && r > before.r;
    const newStatus = !!before && before.status !== it.status;
    const pct = t ? Math.min(100, (r / t) * 100) : (it.status === "done" ? 100 : 0);
    const behind = behindBy(it);
    const owned = num(it.volumesOwned);
    const url = safeUrl(it.url);
    const metas = [];
    if (owned != null) {
      metas.push(`<span>Possédés <b>${owned}${t != null ? "/" + t : ""}</b></span>`);
      if (t != null && t > owned && it.status !== "dropped") metas.push(`<span class="buy">${t - owned} à acheter</span>`);
    }
    if (num(it.rating) != null) metas.push(`<span>Note <b>${fmt(it.rating)}/10</b></span>`);
    if (it.updatedAt) metas.push(`<span>Lu ${ago(it.updatedAt)}</span>`);
    return `<article class="card" data-id="${esc(it.id)}" style="--i:${Math.min(index, 11)}">
      <div class="card-top">
        <span class="type">${esc(it.type || "Manga")}</span>
        ${it.example ? `<span class="ex">exemple</span>` : ""}
        ${news.some((n) => n.id === it.id) ? `<span class="fresh">Nouveau tome !</span>` : ""}
        <span class="stamp s-${esc(it.status)}${newStatus ? " slam" : ""}">${STATUSES[it.status] || "En cours"}</span>
      </div>
      <h3>${esc(it.title)}</h3>
      <div class="prog">
        <div class="vol">
          <span class="vl">VOL.</span><span class="num${newRead ? " bump" : ""}">${r}</span>
          <span class="of">${t != null ? "/ " + t + " parus" : "/ ? parus"}</span>
          ${behind > 0 && it.status !== "done" ? `<span class="behind">${behind} à lire !</span>` : ""}
        </div>
        ${shelf(it, r, t, owned, pct, newRead)}
      </div>
      ${(() => { const n = upcoming(it); return n ? `<div class="next"><span class="next-l">Prochain</span><span>Tome <b>${esc(n.vol)}</b> ${fmtRelease(n)}</span></div>` : ""; })()}
      ${bookmark(it, r, t)}
      ${metas.length ? `<div class="meta">${metas.join("")}</div>` : ""}
      ${it.note ? `<p class="note">${esc(it.note)}</p>` : ""}
      <div class="actions">
        ${canWrite ? `<button class="btn ghost" type="button" data-act="minus" aria-label="Retirer un tome lu à ${esc(it.title)}">−1</button>
        <button class="btn" type="button" data-act="plus" aria-label="Ajouter un tome lu à ${esc(it.title)}">+1 tome lu</button>` : ""}
        <span class="spacer"></span>
        ${url ? `<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Lien ↗</a>` : ""}
        ${canWrite ? `<button class="btn ghost" type="button" data-act="edit">Modifier</button>` : ""}
      </div>
    </article>`;
  }

  function render() {
    const list = view();
    renderStats(list);
    renderTabs(list);
    renderNotices(list);
    $("addBtn").hidden = !canWrite;

    if (!loaded) return;
    let shown = list.filter(matches);
    const q = query.trim().toLowerCase();
    if (q) shown = shown.filter((i) => String(i.title).toLowerCase().includes(q) || String(i.note || "").toLowerCase().includes(q));
    shown = shown.slice().sort((a, b) => {
      if (sort === "title") return String(a.title).localeCompare(String(b.title), "fr");
      if (sort === "rating") return (num(b.rating) ?? -1) - (num(a.rating) ?? -1);
      if (sort === "behind") return behindBy(b) - behindBy(a) || (b.updatedAt || 0) - (a.updatedAt || 0);
      if (sort === "soon") return (upcoming(a)?.date ?? Infinity) - (upcoming(b)?.date ?? Infinity) || (b.updatedAt || 0) - (a.updatedAt || 0);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    if (!list.length) {
      $("grid").innerHTML = `<div class="empty"><span class="kana-sm" aria-hidden="true">シーン…</span><h2>Ta pile est vide</h2><p>${canWrite ? "Ajoute ta première série avec le bouton « Ajouter une série » en haut." : "Aucune série enregistrée pour l'instant."}</p></div>`;
    } else if (!shown.length) {
      $("grid").innerHTML = `<div class="empty"><span class="kana-sm" aria-hidden="true">？</span><h2>Aucune série ici</h2><p>Rien ne correspond à ce filtre ou à cette recherche.</p></div>`;
    } else {
      const grid = $("grid");
      // Entrée en cascade des cases seulement au premier affichage
      if (!introPlayed) {
        introPlayed = true;
        grid.classList.add("intro");
        setTimeout(() => grid.classList.remove("intro"), 1200);
      }
      grid.innerHTML = shown.map(card).join("");
    }
    for (const it of list) seen[it.id] = { r: num(it.volumeRead) ?? 0, status: it.status };
    renderTools();
    if (!autoCheckStarted && canWrite) {
      autoCheckStarted = true;
      setTimeout(() => runChecks(false), 2500);   // après l'affichage, pour ne pas ralentir l'ouverture
    }
  }

  // ---- Stockage : claude.ai si disponible, sinon ce navigateur ----
  const LOCAL_KEY = "mtq-series";

  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); localOk = true; } catch (e) { localOk = false; }
  }

  function loadLocal() {
    try { const raw = localStorage.getItem(LOCAL_KEY); items = raw ? JSON.parse(raw) : []; }
    catch (e) { items = []; localOk = false; }
    if (!Array.isArray(items)) items = [];
  }

  const store = {
    async update(id, patch) {
      if (mode === "cloud") return db.collection("series").doc(id).update(patch);
      items = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
      saveLocal();
    },
    async set(id, data) {
      if (mode === "cloud") return db.collection("series").doc(id).set(data);
      items = items.map((i) => (i.id === id ? { id, ...data } : i));
      saveLocal();
    },
    async add(data) {
      if (mode === "cloud") return db.collection("series").add(data);
      items = [...items, { id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data }];
      saveLocal();
    },
    async remove(id) {
      if (mode === "cloud") return db.collection("series").doc(id).delete();
      items = items.filter((i) => i.id !== id);
      saveLocal();
    }
  };

  function startLocal() {
    mode = "local";
    db = null;
    // Lien de partage (mode visite) : on regarde, on ne modifie pas
    canWrite = !document.documentElement.classList.contains("visite");
    readOnlyReason = "";
    loadLocal();
    loaded = true;
    render();
  }

  // ---- Écritures ----
  function handleWriteError(e) {
    if (e && (e.code === "invalid_argument" || e.code === "transform_error")) {
      canWrite = false;
      readOnlyReason = "Tu peux consulter cette liste, mais pas la modifier.";
    } else if (e && e.code === "quota_exceeded") {
      toast("La mangathèque est pleine. Supprime quelques séries.");
    } else {
      toast("Enregistrement impossible pour l'instant. Réessaie dans un moment.");
    }
    render();
  }

  async function flush(id) {
    if (writing[id]) { schedule(id); return; }
    const patch = pending[id];
    if (!patch) return;
    writing[id] = true;
    try {
      await store.update(id, patch);
    } catch (e) {
      delete pending[id];
      handleWriteError(e);
    } finally {
      writing[id] = false;
      if (pending[id] === patch) delete pending[id];
      render();
    }
  }

  function schedule(id) {
    clearTimeout(timers[id]);
    timers[id] = setTimeout(() => flush(id), 700);
  }

  function bump(id, delta) {
    const it = view().find((i) => i.id === id);
    if (!it) return;
    const next = Math.max(0, Math.floor((num(it.volumeRead) ?? 0) + delta));
    const patch = { ...(pending[id] || {}), volumeRead: next, updatedAt: Date.now() };
    if (delta > 0) patch.page = null;   // nouveau tome : le marque-page repart de zéro
    if (delta > 0 && it.status === "plan") patch.status = "reading";
    if (delta > 0 && num(it.volumesTotal) != null && next > it.volumesTotal) patch.volumesTotal = next;
    const st = autoStatus({ ...it, ...patch });
    if (st !== it.status) patch.status = st;
    pending[id] = patch;
    render();
    schedule(id);
  }

  // ---- Formulaire ----
  function openForm(id) {
    editingId = id || null;
    const it = id ? view().find((i) => i.id === id) : null;
    $("formTitle").textContent = it ? "Modifier la série" : "Nouvelle série";
    $("f-title").value = it?.title || "";
    $("f-type").value = it?.type || "Manga";
    $("f-status").value = it?.status || "reading";
    $("f-read").value = num(it?.volumeRead) ?? "";
    $("f-page").value = num(it?.page) ?? "";
    $("f-total").value = num(it?.volumesTotal) ?? "";
    $("f-owned").value = num(it?.volumesOwned) ?? "";
    $("f-rating").value = num(it?.rating) ?? "";
    $("f-url").value = it?.url || "";
    $("f-wiki").value = it?.wiki || "";
    $("f-author").value = it?.author || "";
    $("f-note").value = it?.note || "";
    lookupSeq++;
    $("lookupHint").hidden = true;
    $("lookupBtn").disabled = false;
    $("delBtn").hidden = !it;
    $("delBtn").classList.remove("armed");
    $("delBtn").textContent = "Supprimer";
    $("formErr").hidden = true;
    $("overlay").hidden = false;
    $("f-title").focus();
  }

  function closeForm() {
    $("overlay").hidden = true;
    editingId = null;
  }

  // ---- Remplissage auto du nombre de tomes ----
  async function askClaude(title) {
    const d = await sampleNs.json(
      `Série : « ${title} ».\n` +
      `Donne le nombre de tomes parus en édition française (et en édition japonaise) pour cette série manga, manhwa, manhua, webtoon ou light novel.\n` +
      `Réponds uniquement en JSON : {"found": boolean, "title": string, "type": "Manga"|"Manhwa"|"Manhua"|"Webtoon"|"Light novel"|"Comics", "volumesFr": number|null, "volumesJp": number|null}.\n` +
      `Si tu ne reconnais pas la série avec certitude, réponds {"found": false}.`,
      { modelTier: "quick" }
    );
    if (!d || !d.found) return null;
    const fr = num(d.volumesFr), jp = num(d.volumesJp);
    return { volumes: fr, jp, type: d.type, label: "d'après Claude, peut dater de quelques mois" };
  }

  // Wikipédia FR : les fiches manga listent chaque tome avec {{TomeBD}}, sortie_2 = date de sortie française
  const WIKI = "https://fr.wikipedia.org/w/api.php?format=json&origin=*&";
  const MOIS = { janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11 };

  async function wikiGet(params, signal) {
    const res = await fetch(WIKI + params, { signal });
    if (!res.ok) throw new Error("wiki " + res.status);
    return res.json();
  }

  async function wikiPage(title, signal) {
    const j = await wikiGet("action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=" + encodeURIComponent(title), signal);
    const p = Object.values(j.query?.pages || {})[0];
    if (!p || "missing" in p) return null;
    return { title: p.title, text: p.revisions?.[0]?.slots?.main?.["*"] || "" };
  }

  // Date française avec sa précision : jour, mois seul (« février 2027 ») ou année seule
  function parseFrDateP(raw) {
    const s = raw.replace(/[{}|]/g, " ").toLowerCase();
    const m = s.match(/(?:(\d{1,2})(?:er)?\s+)?(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})/);
    if (m) return { t: new Date(+m[3], MOIS[m[2]], m[1] ? +m[1] : 1).getTime(), p: m[1] ? "day" : "month" };
    const y = s.match(/\b(\d{4})\b/);
    return y ? { t: new Date(+y[1], 0, 1).getTime(), p: "year" } : null;
  }
  const parseFrDate = (raw) => parseFrDateP(raw)?.t ?? null;
  const cleanRefs = (s) => s.replace(/<ref[^>]*\/>/gi, "").replace(/<ref[^>]*>.*?<\/ref>/gi, "").trim();

  // Premier tome annoncé en France avec une date à venir
  function nextRelease(texts) {
    const now = Date.now();
    let best = null;
    for (const text of texts) {
      for (const block of text.split(/\{\{\s*TomeBD/i).slice(1)) {
        const vol = block.match(/\|\s*volume\s*=\s*(\d+)/i);
        const s2 = block.match(/\|[ \t]*sortie_2[ \t]*=[ \t]*([^\n]*)/i);
        if (!vol || !s2) continue;
        const d = parseFrDateP(cleanRefs(s2[1]));
        if (!d || d.t <= now) continue;
        if (!best || d.t < best.date || (d.t === best.date && +vol[1] < best.vol)) best = { vol: +vol[1], date: d.t, prec: d.p };
      }
    }
    return best;
  }

  // Plus haut numéro de tome déjà sorti en France
  function frVolumes(text) {
    const now = Date.now();
    let max = 0;
    for (const block of text.split(/\{\{\s*TomeBD/i).slice(1)) {
      const vol = block.match(/\|\s*volume\s*=\s*(\d+)/i);
      // [ \t]* et pas \s* : une date vide ne doit pas lire la ligne suivante
      const s2 = block.match(/\|[ \t]*sortie_2[ \t]*=[ \t]*([^\n]*)/i);
      if (!vol || !s2) continue;
      const raw = cleanRefs(s2[1]);
      if (!raw || /^[—–-]$/.test(raw)) continue;
      const d = parseFrDate(raw);
      if (d == null || d > now) continue;   // pas de date française lisible : tome pas encore sorti
      max = Math.max(max, +vol[1]);
    }
    if (max) return max;
    const inf = text.match(/(\d+)\s*<small>\s*\(\s*version fran[çc]aise\s*\)/i) || text.match(/\|\s*nb_volumes_(?:fr|francophone)\s*=\s*(\d+)/i);
    return inf ? +inf[1] : null;
  }

  // Ne garder qu'une page dont le titre correspond vraiment à la série (évite « Requiem » → une autre série)
  const STOP = new Set(["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "et", "the", "a", "of", "manga", "tome", "serie"]);
  const words = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, " ").split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));

  function titleScore(query, candidate) {
    const q = new Set(words(query)), c = new Set(words(candidate));
    if (!q.size || !c.size) return 0;
    const common = [...q].filter((w) => c.has(w)).length;
    return Math.min(common / q.size, common / c.size);
  }

  // Accepte un titre de page ou un lien https://fr.wikipedia.org/wiki/...
  function wikiTitle(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/wikipedia\.org\/wiki\/([^?#]+)/i);
    if (!m) return s;
    try { return decodeURIComponent(m[1]).replace(/_/g, " "); } catch (e) { return m[1].replace(/_/g, " "); }
  }

  async function findWikiPage(title, forced, signal) {
    if (forced) {
      const p = await wikiPage(forced, signal);
      if (p) return p;
    }
    const s = await wikiGet("action=query&list=search&srlimit=8&srsearch=" + encodeURIComponent(title), signal);
    const hits = (s.query?.search || [])
      .map((h) => ({ title: h.title, score: titleScore(title, h.title) }))
      .filter((h) => h.score >= 0.5)
      .sort((a, b) => b.score - a.score);
    return hits.length ? wikiPage(hits[0].title, signal) : null;
  }

  async function askWiki(title, forced) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const page = await findWikiPage(title, forced, ctrl.signal);
      if (!page) return null;
      let fr = frVolumes(page.text);
      if (fr == null) {
        // Séries longues : les tomes sont sur une page « Liste des chapitres / volumes de … »
        const list = page.text.match(/liste_volumes\s*=\s*\[*([^\]\n|<]+)/i) || page.text.match(/\[\[(Liste des (?:volumes|chapitres|tomes) d[^\]|]+)/i);
        if (list) {
          const lp = await wikiPage(list[1].trim(), ctrl.signal);
          if (lp) fr = frVolumes(lp.text);
          if (lp && fr == null) {
            // Liste découpée en parties « … (1-20) », « … (21-40) » : les derniers tomes sont dans les dernières
            const parts = [...new Set([...lp.text.matchAll(/\[\[(Liste des [^\]|]+\(\s*\d+[^)]*\))/gi)].map((m) => m[1].trim()))];
            for (const part of parts.slice(-2)) {
              const pp = await wikiPage(part, ctrl.signal);
              const v = pp ? frVolumes(pp.text) : null;
              if (v != null) fr = Math.max(fr ?? 0, v);
            }
          }
        }
      }
      const jp = page.text.match(/\|\s*nb_volumes\s*=\s*(\d+)/i);
      return { volumes: fr, jp: jp ? +jp[1] : null, label: `d'après Wikipédia, page « ${page.title} »`, wiki: fr != null || jp ? page.title : "" };
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- Couvertures : ISBN français par tome sur Wikipédia ({{TomeBD}} isbn_2), image via Google Books ----
  const COVER_KEY = "mtq-covers2";
  try { localStorage.removeItem("mtq-covers"); } catch (e) {}   // ancien cache, parfois sur la mauvaise série
  let covers = {};
  try { covers = JSON.parse(localStorage.getItem(COVER_KEY) || "{}") || {}; } catch (e) { covers = {}; }
  const saveCovers = () => { try { localStorage.setItem(COVER_KEY, JSON.stringify(covers)); } catch (e) {} };
  const seriesKey = (it) => (it.wiki ? "wiki:" + it.wiki : String(it.title)).trim().toLowerCase();

  // Toutes les pages Wikipédia qui contiennent les tomes de la série (page principale, liste, parties de liste)
  // lastOnly : seulement les dernières parties d'une longue liste (assez pour les nouveaux tomes)
  async function wikiTomeTexts(it, lastOnly) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const hasTomes = (t) => /\{\{\s*TomeBD/i.test(t);
    try {
      const page = await findWikiPage(it.title, it.wiki, ctrl.signal);
      if (!page) return [];
      const texts = Object.assign([], { page: page.title });
      if (hasTomes(page.text)) { texts.push(page.text); return texts; }
      const list = page.text.match(/liste_volumes\s*=\s*\[*([^\]\n|<#]+)/i) || page.text.match(/\[\[(Liste des (?:volumes|chapitres|tomes) d[^\]|]+)/i);
      if (!list) return texts;
      const lp = await wikiPage(list[1].trim(), ctrl.signal);
      if (!lp) return texts;
      if (hasTomes(lp.text)) { texts.push(lp.text); return texts; }
      let parts = [...new Set([...lp.text.matchAll(/\[\[(Liste des [^\]|]+\(\s*\d+[^)]*\))/gi)].map((m) => m[1].trim()))];
      if (lastOnly) parts = parts.slice(-2);
      for (const part of parts) {
        const pp = await wikiPage(part, ctrl.signal);
        if (pp) texts.push(pp.text);
      }
      return texts;
    } finally {
      clearTimeout(timer);
    }
  }

  async function isbnMap(it, n) {
    const k = seriesKey(it);
    if (covers[k]?.isbn?.[n]) return covers[k].isbn;   // sinon on relit Wikipédia (nouveau tome sorti depuis)
    const map = {};
    const texts = await wikiTomeTexts(it);
    for (const text of texts) {
      for (const block of text.split(/\{\{\s*TomeBD/i).slice(1)) {
        const vol = block.match(/\|\s*volume\s*=\s*(\d+)/i);
        const isbn = block.match(/\|\s*isbn_2\s*=\s*([0-9Xx][0-9Xx\- ]{8,})/);
        if (vol && isbn) map[vol[1]] = isbn[1].replace(/[^0-9Xx]/g, "");
      }
    }
    if (Object.keys(map).length) { covers[k] = { ...covers[k], isbn: { ...covers[k]?.isbn, ...map }, img: covers[k]?.img || {}, wiki: texts.page || "" }; saveCovers(); }
    return covers[k]?.isbn || map;
  }

  // Catalogue de la BnF (tous les livres publiés en France) : ISBN d'un tome quand Wikipédia ne l'a pas
  const MANGA_PUB = /gl[ée]nat|kana|pika|ki-oon|kurokawa|delcourt|tonkam|kaz[ée]|panini|akata|soleil|michel lafon|mangetsu|noeve|meian|vega|kbooks|ototo|doki|naban|kotoba|casterman|crunchyroll|nobi|ankama|hachette|black box|dupuis|dargaud|rue de s[èe]vres|ynnis|imho|komikku|omake|sakka|bamboo|dynamite|taifu/i;

  // Tomes d'une série au catalogue BnF ; n = un tome précis, sinon tous les tomes trouvés
  async function bnfTomes(it, n, publisher) {
    const k = seriesKey(it);
    const key = words(it.title).join(" ") || it.title;
    let q = `bib.title all "${key.replace(/"/g, "")}${n ? " " + n : ""}"`;
    if (it.author) q += ` and bib.author all "${it.author.replace(/"/g, "")}"`;
    if (publisher) q += ` and bib.publisher all "${publisher.replace(/"/g, "")}"`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let xml;
    try {
      const res = await fetch(`https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&recordSchema=dublincore&maximumRecords=${n ? 50 : 200}&query=` + encodeURIComponent(q), { signal: ctrl.signal });
      if (!res.ok) throw new Error("bnf " + res.status);
      xml = new DOMParser().parseFromString(await res.text(), "application/xml");
    } finally {
      clearTimeout(timer);
    }
    const qWords = new Set(words(it.title));
    const prefPub = covers[k]?.publisher;
    const found = [];
    for (const dc of xml.getElementsByTagNameNS("*", "dc")) {
      const field = (name) => [...dc.getElementsByTagNameNS("*", name)].map((e) => e.textContent);
      const main = (field("title")[0] || "").split(" / ")[0];
      // « Instinct. 1 », « Requiem : chevalier vampire. 1 », « Killer instinct. 01 »
      const m = main.match(/^(.*?)[.,]\s*(?:t(?:ome)?\.?|vol(?:ume)?\.?)?\s*0*(\d+)\s*$/i);
      if (!m || (n && +m[2] !== n)) continue;
      const cWords = new Set(words(m[1]));
      const common = [...qWords].filter((w) => cWords.has(w)).length;
      if (!qWords.size || common < qWords.size) continue;
      const isbn = field("identifier").map((x) => x.match(/ISBN\s*([0-9Xx-]{10,17})/)).find(Boolean);
      if (!isbn) continue;
      const pub = (field("publisher")[0] || "").replace(/\s*\(.*$/, "").trim();
      found.push({
        n: +m[2], isbn: isbn[1].replace(/[^0-9Xx]/g, ""), publisher: pub,
        score: common / cWords.size,
        pref: prefPub && pub === prefPub ? 2 : MANGA_PUB.test(pub) ? 1 : 0,
        date: +(field("date")[0] || "0").slice(0, 4) || 0
      });
    }
    // Titre exact d'abord, puis éditeur manga (ou celui déjà retenu pour la série), puis le plus récent
    found.sort((a, b) => b.score - a.score || b.pref - a.pref || b.date - a.date);
    return found;
  }

  // Un tome précis, chez l'éditeur de la série (celui du tome 1) : évite qu'un roman homonyme serve de tome 2
  async function bnfIsbn(it, n) {
    const k = seriesKey(it);
    let publisher = covers[k]?.publisher;
    if (!publisher && n !== 1) publisher = (await bnfTomes(it, 1))[0]?.publisher;
    if (publisher) {
      covers[k] = covers[k] || { isbn: {}, img: {} };
      covers[k].publisher = publisher;
    }
    const found = await bnfTomes(it, n, publisher);
    return found.find((t) => !publisher || t.publisher === publisher) || null;
  }

  // Nombre de tomes parus en France d'après la BnF : on garde l'éditeur et la série du tome 1 le mieux classé
  async function bnfCount(it) {
    const all = await bnfTomes(it, 0);
    const first = all.find((t) => t.n === 1) || all[0];
    if (!first) return null;
    // Un titre courant (« Instinct ») renvoie des centaines de livres : on refait la recherche chez le bon éditeur
    const again = await bnfTomes(it, 0, first.publisher).catch(() => []);
    const same = [...all, ...again].filter((t) => t.publisher === first.publisher && t.score === first.score);
    return { volumes: Math.max(...same.map((t) => t.n)), publisher: first.publisher };
  }

  // Images de couverture par ISBN : Decitre (librairie française) d'abord, Google Livres en secours
  const coverUrls = (isbn) => [
    `https://products-images.di-static.com/image/x/${isbn}-475x500-1.jpg`,
    `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=1`
  ];

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      const timer = setTimeout(() => reject(new Error("timeout")), 8000);
      img.onload = () => {
        clearTimeout(timer);
        // Google Livres renvoie une vignette « image indisponible » de 128×170 quand il n'a pas la couverture
        if (url.includes("books.google") && img.naturalWidth <= 128 && img.naturalHeight === 170) reject(new Error("placeholder"));
        else resolve(img);
      };
      img.onerror = () => { clearTimeout(timer); reject(new Error("error")); };
      img.src = url;
    });
  }

  // ---- Fiche d'un tome ----
  let tomeCtx = null;
  let coverSeq = 0;
  const noCover = (msg) => `<div class="ph"><b>？</b>${esc(msg)}</div>`;

  function openTome(id, n) {
    const it = view().find((i) => i.id === id);
    if (!it) return;
    const r = num(it.volumeRead) ?? 0, t = num(it.volumesTotal), o = num(it.volumesOwned);
    const max = Math.max(t ?? 0, o ?? 0, r, 1);
    n = Math.min(Math.max(1, n), max);
    const sameTome = tomeCtx && tomeCtx.id === id && tomeCtx.n === n && !$("tomeOverlay").hidden;
    tomeCtx = { id, n, max };
    const state = n <= r ? "read" : o != null && n <= o ? "own" : "miss";
    $("tomeSeries").textContent = it.title;
    $("tomeTitle").textContent = `Tome ${n}`;
    const st = $("tomeState");
    st.className = "stamp " + (state === "read" ? "s-done" : state === "own" ? "s-reading" : "s-plan");
    st.textContent = state === "read" ? "Lu" : state === "own" ? "Possédé, à lire" : o != null ? "À acheter" : "Pas encore lu";
    $("tomeRead").hidden = !canWrite || n === r;
    $("tomeRead").textContent = `Lu jusqu'au tome ${n}`;
    $("tomeOwn").hidden = !canWrite || o === n;
    $("tomeOwn").textContent = `Possédé jusqu'au tome ${n}`;
    $("tomePrev").disabled = n <= 1;
    $("tomeNext").disabled = n >= max;
    $("tomeOverlay").hidden = false;
    if (!sameTome) showCover(it, n);
  }

  async function showCover(it, n) {
    const seq = ++coverSeq;
    const box = $("tomeCover");
    const k = seriesKey(it);
    $("tomeIsbn").textContent = "";
    box.innerHTML = `<div class="ph"><b>チラッ</b>Recherche de la couverture…</div>`;
    try {
      let isbn = null;
      let src = "";
      try {
        const map = await isbnMap(it, n);
        isbn = map[n];
        if (isbn) src = covers[k]?.manual?.[n] ? "saisi à la main" : covers[k]?.bnf?.[n] ? `trouvé via le catalogue BnF, ${covers[k].bnf[n]}` : covers[k]?.wiki ? `trouvé via Wikipédia « ${covers[k].wiki} »` : "";
      } catch (e) { /* Wikipédia indisponible : on tente la BnF */ }
      if (seq !== coverSeq) return;
      if (!isbn) {
        const b = await bnfIsbn(it, n);
        if (seq !== coverSeq) return;
        if (b) {
          isbn = b.isbn;
          covers[k] = covers[k] || { isbn: {}, img: {} };
          covers[k].isbn = { ...covers[k].isbn, [n]: isbn };
          covers[k].bnf = { ...covers[k].bnf, [n]: b.publisher };
          covers[k].publisher = covers[k].publisher || b.publisher;
          saveCovers();
          src = `trouvé via le catalogue BnF, ${b.publisher}`;
        }
      }
      if (!isbn) {
        box.innerHTML = noCover("Tome introuvable sur Wikipédia et à la BnF (souvent le cas des tout derniers tomes). Entre son ISBN juste à côté.");
        return;
      }
      $("tomeIsbn").textContent = "ISBN " + isbn + (src ? ` · ${src}` : "");
      const cached = covers[k]?.img?.[n];
      for (const url of cached ? [cached, ...coverUrls(isbn)] : coverUrls(isbn)) {
        try {
          const img = await loadImage(url);
          if (seq !== coverSeq) return;
          img.alt = `Couverture du tome ${n} de ${it.title}`;
          box.replaceChildren(img);
          if (covers[k] && url !== cached) { covers[k].img[n] = url; saveCovers(); }
          return;
        } catch (e) {
          if (seq !== coverSeq) return;
        }
      }
      box.innerHTML = noCover("Pas d'image trouvée pour ce tome.");
    } catch (e) {
      if (seq === coverSeq) box.innerHTML = noCover("Recherche impossible pour le moment.");
    }
  }

  function closeTome() { $("tomeOverlay").hidden = true; coverSeq++; tomeCtx = null; }

  function applyPatch(id, patch) {
    const it = view().find((i) => i.id === id);
    if (!it) return;
    const next = { ...(pending[id] || {}), ...patch, updatedAt: Date.now() };
    const st = autoStatus({ ...it, ...next });
    if (st !== it.status) next.status = st;
    pending[id] = next;
    render();
    schedule(id);
  }

  $("tomeRead").addEventListener("click", () => {
    const { id, n } = tomeCtx;
    const it = view().find((i) => i.id === id);
    const patch = { volumeRead: n, page: null };
    if (it && it.status === "plan") patch.status = "reading";
    applyPatch(id, patch);
    toast(`Lu jusqu'au tome ${n}`);
    openTome(id, n);
  });
  $("tomeOwn").addEventListener("click", () => {
    const { id, n } = tomeCtx;
    applyPatch(id, { volumesOwned: n });
    toast(`Possédé jusqu'au tome ${n}`);
    openTome(id, n);
  });
  $("isbnForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!tomeCtx) return;
    const isbn = $("isbnInput").value.replace(/[^0-9Xx]/g, "");
    if (isbn.length !== 10 && isbn.length !== 13) { toast("Un ISBN fait 10 ou 13 chiffres"); return; }
    const it = view().find((i) => i.id === tomeCtx.id);
    if (!it) return;
    const k = seriesKey(it), n = tomeCtx.n;
    covers[k] = covers[k] || { isbn: {}, img: {} };
    covers[k].isbn = { ...covers[k].isbn, [n]: isbn };
    covers[k].manual = { ...covers[k].manual, [n]: true };
    if (covers[k].img) delete covers[k].img[n];
    saveCovers();
    $("isbnInput").value = "";
    showCover(it, n);
  });
  $("tomePrev").addEventListener("click", () => tomeCtx && openTome(tomeCtx.id, tomeCtx.n - 1));
  $("tomeNext").addEventListener("click", () => tomeCtx && openTome(tomeCtx.id, tomeCtx.n + 1));
  $("tomeClose").addEventListener("click", closeTome);
  $("tomeOverlay").addEventListener("click", (e) => { if (e.target === $("tomeOverlay")) closeTome(); });
  document.addEventListener("keydown", (e) => {
    if ($("tomeOverlay").hidden || !tomeCtx) return;
    if (e.key === "Escape") closeTome();
    else if (e.key === "ArrowLeft" && tomeCtx.n > 1) openTome(tomeCtx.id, tomeCtx.n - 1);
    else if (e.key === "ArrowRight" && tomeCtx.n < tomeCtx.max) openTome(tomeCtx.id, tomeCtx.n + 1);
  });

  async function lookup(auto) {
    const title = $("f-title").value.trim();
    if (title.length < 2) return;
    if (auto && (editingId || $("f-total").value.trim() !== "")) return;
    const hint = $("lookupHint");
    const seq = ++lookupSeq;
    hint.hidden = false;
    hint.textContent = "Recherche du nombre de tomes…";
    $("lookupBtn").disabled = true;
    try {
      let r = null;
      if (sampleNs) r = await askClaude(title);
      else {
        try { r = await askWiki(title, wikiTitle($("f-wiki").value)); } catch (e) { r = null; }
        if (!r || r.volumes == null) {
          // Pas sur Wikipédia (ex. Instinct d'Inoxtag) : on compte les tomes au catalogue de la BnF
          const b = await bnfCount({ title, author: $("f-author").value.trim() }).catch(() => null);
          if (b) r = { ...r, volumes: b.volumes, label: `d'après le catalogue de la BnF, éditeur ${b.publisher} ; les tout derniers tomes peuvent y manquer` };
        }
      }
      if (seq !== lookupSeq) return;
      if (r && r.wiki) $("f-wiki").value = r.wiki;
      if (r && r.type && TYPES.includes(r.type)) $("f-type").value = r.type;
      if (!r || r.volumes == null) {
        hint.textContent = r && num(r.jp) != null
          ? `Nombre de tomes en France inconnu. Pour info, ${Math.floor(r.jp)} tomes au Japon. Remplis le chiffre français à la main.`
          : "Nombre de tomes en France introuvable pour ce titre. Remplis-le à la main.";
        return;
      }
      $("f-total").value = Math.floor(r.volumes);
      if (r.type && TYPES.includes(r.type)) $("f-type").value = r.type;
      hint.textContent = `${Math.floor(r.volumes)} tomes parus en France (${r.label}). Corrige si besoin.`;
      const jp = num(r.jp);
      if (jp != null && jp > r.volumes) {
        // Wikipédia note souvent la sortie japonaise avant la française
        hint.textContent = `${Math.floor(r.volumes)} tomes en France d'après Wikipédia, mais ${Math.floor(jp)} au Japon : la fiche n'est peut-être pas à jour. `;
        const use = document.createElement("button");
        use.type = "button";
        use.className = "btn ghost";
        use.style.cssText = "padding:2px 8px;font-size:12px;margin-left:4px";
        use.textContent = `Mettre ${Math.floor(jp)}`;
        use.addEventListener("click", () => { $("f-total").value = Math.floor(jp); hint.textContent = `${Math.floor(jp)} tomes parus (chiffre japonais, à vérifier).`; });
        hint.append(use);
      }
    } catch (e) {
      if (seq === lookupSeq) hint.textContent = e && e.code === "not_granted"
        ? "Recherche refusée : autorise la page à interroger Claude, ou remplis le nombre de tomes à la main."
        : `Recherche impossible pour le moment${e && e.code ? " (" + e.code + ")" : ""}. Remplis le nombre de tomes à la main.`;
    } finally {
      if (seq === lookupSeq) $("lookupBtn").disabled = false;
    }
  }

  $("lookupBtn").addEventListener("click", () => lookup(false));
  $("f-title").addEventListener("change", () => lookup(true));

  function readNum(id, max) {
    const raw = $(id).value.trim();
    if (raw === "") return null;
    const v = Number(raw.replace(",", "."));
    if (!isFinite(v) || v < 0) return undefined;
    return max != null ? Math.min(v, max) : v;
  }

  $("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const err = $("formErr");
    const title = $("f-title").value.trim();
    if (!title) { err.textContent = "Donne un titre à la série."; err.hidden = false; $("f-title").focus(); return; }
    const fields = { volumeRead: readNum("f-read"), page: readNum("f-page"),volumesTotal: readNum("f-total"), volumesOwned: readNum("f-owned"), rating: readNum("f-rating", 10) };
    const bad = Object.entries(fields).find(([, v]) => v === undefined);
    if (bad) { err.textContent = "Les nombres doivent être positifs."; err.hidden = false; return; }
    const url = $("f-url").value.trim();
    if (url && !safeUrl(url)) { err.textContent = "Le lien doit commencer par https://"; err.hidden = false; return; }

    const data = {
      title, type: $("f-type").value, status: $("f-status").value,
      volumeRead: Math.floor(fields.volumeRead ?? 0),
      page: fields.page == null ? null : Math.floor(fields.page),
      volumesTotal: fields.volumesTotal == null ? null : Math.floor(fields.volumesTotal),
      volumesOwned: fields.volumesOwned == null ? null : Math.floor(fields.volumesOwned),
      rating: fields.rating, url: url ? safeUrl(url) : "", note: $("f-note").value.trim(),
      wiki: wikiTitle($("f-wiki").value),
      author: $("f-author").value.trim(),
      updatedAt: Date.now()
    };
    data.status = autoStatus(data);
    $("saveBtn").disabled = true;
    try {
      if (editingId) {
        clearTimeout(timers[editingId]);
        delete pending[editingId];
        await store.set(editingId, { ...data, example: false });
        toast("Série mise à jour");
      } else {
        await store.add(data);
        toast("Série ajoutée");
      }
      closeForm();
      render();
    } catch (e) {
      handleWriteError(e);
      err.textContent = "L'enregistrement a échoué. Réessaie dans un moment."; err.hidden = false;
    } finally {
      $("saveBtn").disabled = false;
    }
  });

  $("delBtn").addEventListener("click", async () => {
    const b = $("delBtn");
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Confirmer la suppression"; return; }
    const id = editingId;
    b.disabled = true;
    try {
      clearTimeout(timers[id]); delete pending[id];
      await store.remove(id);
      toast("Série supprimée");
      closeForm();
      render();
    } catch (e) { handleWriteError(e); }
    finally { b.disabled = false; }
  });

  $("cancelBtn").addEventListener("click", closeForm);
  $("overlay").addEventListener("click", (e) => { if (e.target === $("overlay")) closeForm(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("overlay").hidden) closeForm(); });
  $("addBtn").addEventListener("click", () => openForm(null));

  $("grid").addEventListener("click", (e) => {
    const spine = e.target.closest(".shelf i");
    if (spine) { openTome(spine.closest(".card").dataset.id, +spine.dataset.vol); return; }
    const bar = e.target.closest(".bar[data-max]");
    if (bar) {
      // Barre des longues séries : la position du clic donne le numéro du tome
      const box = bar.getBoundingClientRect();
      const n = Math.ceil(((e.clientX - box.left) / box.width) * +bar.dataset.max);
      openTome(bar.closest(".card").dataset.id, n);
      return;
    }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.closest(".card").dataset.id;
    if (b.dataset.act === "plus") {
      bump(id, 1);
      const btn = document.querySelector(`.card[data-id="${CSS.escape(id)}"] [data-act="plus"]`);
      if (btn) {
        const s = document.createElement("span");
        s.className = "sfx";
        s.setAttribute("aria-hidden", "true");
        s.textContent = "ドン!";
        btn.append(s);
        setTimeout(() => s.remove(), 800);
      }
    }
    else if (b.dataset.act === "minus") bump(id, -1);
    else if (b.dataset.act === "edit") openForm(id);
  });

  $("grid").addEventListener("change", (e) => {
    if (e.target.dataset.act !== "page") return;
    const id = e.target.closest(".card").dataset.id;
    const raw = e.target.value.trim();
    const v = raw === "" ? null : Math.floor(Number(raw));
    if (v != null && (!isFinite(v) || v < 0)) { e.target.value = ""; return; }
    const it = view().find((i) => i.id === id);
    const patch = { ...(pending[id] || {}), page: v, updatedAt: Date.now() };
    const st = it ? autoStatus({ ...it, ...patch }) : null;
    if (st && st !== it.status) patch.status = st;
    pending[id] = patch;
    render();
    schedule(id);
    toast(v == null ? "Marque-page retiré" : `Marque-page posé à la page ${v}`);
  });
  $("grid").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset.act === "page") e.target.blur();
  });

  $("stats").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filter = filter === b.dataset.filter ? "all" : b.dataset.filter;
    try { localStorage.setItem("mtq-filter", filter); } catch (err) {}
    render();
  });

  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filter = b.dataset.filter;
    try { localStorage.setItem("mtq-filter", filter); } catch (err) {}
    render();
  });

  $("notices").addEventListener("click", async (e) => {
    if (e.target.id !== "clearEx") return;
    e.target.disabled = true;
    try {
      for (const it of items.filter((i) => i.example)) await store.remove(it.id);
      toast("Exemples retirés");
      render();
    } catch (err) { handleWriteError(err); }
  });

  $("search").addEventListener("input", (e) => { query = e.target.value; render(); });
  $("sort").addEventListener("change", (e) => {
    sort = e.target.value;
    try { localStorage.setItem("mtq-sort", sort); } catch (err) {}
    render();
  });

  // ---- Nouveaux tomes : vérification une fois par jour ----
  const DAY = 86400000;

  async function checkSeries(it) {
    const info = { checked: Date.now(), fr: null, next: null };
    let texts;
    try { texts = await wikiTomeTexts(it, true); } catch (e) { return null; }   // réseau indisponible : on réessaiera
    if (texts.length) {
      info.fr = Math.max(0, ...texts.map((t) => frVolumes(t) ?? 0)) || null;
      info.next = nextRelease(texts);
    }
    // Pas de page Wikipédia : catalogue BnF, seulement si l'auteur ou l'éditeur est connu (évite un homonyme)
    if (info.fr == null && (it.author || covers[seriesKey(it)]?.publisher)) {
      const b = await bnfCount(it).catch(() => null);
      if (b) info.fr = b.volumes;
    }
    return info;
  }

  async function runChecks(force) {
    if (checking) return;
    const now = Date.now();
    const todo = view().filter((i) => i.status !== "dropped" && !i.example && (force || !(now - (releases[i.id]?.checked || 0) < DAY * 0.8)));
    if (!todo.length) { if (force) toast("Rien à vérifier"); renderTools(); return; }
    checking = { done: 0, total: todo.length };
    renderTools();
    let found = 0;
    for (const it0 of todo) {
      const info = await checkSeries(it0);
      checking.done++;
      renderTools();
      if (!info) continue;
      releases[it0.id] = info;
      const it = view().find((i) => i.id === it0.id);
      const t = it ? num(it.volumesTotal) : null;
      // On ne fait que monter : Wikipédia et la BnF ont parfois un tome de retard sur ce que tu as saisi
      if (it && info.fr != null && t != null && info.fr > t) {
        const patch = { ...(pending[it.id] || {}), volumesTotal: info.fr };
        if (it.status === "done" && info.fr > (num(it.volumeRead) ?? 0)) patch.status = "reading";
        pending[it.id] = patch;
        schedule(it.id);
        news = [...news.filter((n) => n.id !== it.id), { id: it.id, title: it.title, from: t, to: info.fr }];
        found++;
      }
    }
    saveJson("mtq-releases", releases);
    saveJson("mtq-news", news);
    saveJson("mtq-checked", Date.now());
    checking = null;
    render();
    if (force || found) toast(found ? `${found} série${found > 1 ? "s ont" : " a"} un nouveau tome !` : "Aucun nouveau tome pour l'instant");
  }

  function renderTools() {
    const st = $("checkState");
    if (checking) st.textContent = `Vérification en cours… ${checking.done}/${checking.total}`;
    else {
      const last = loadJson("mtq-checked", 0);
      st.textContent = last ? `Dernière vérification : ${ago(last)} à ${new Date(last).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.` : "Pas encore vérifié.";
    }
    $("checkBtn").disabled = !!checking || !canWrite;
    const b = loadJson("mtq-backup", 0);
    const late = items.length > 0 && (!b || Date.now() - b > 30 * DAY);
    const bs = $("backupState");
    bs.textContent = b ? `Dernière sauvegarde : ${ago(b)}.` : "Aucune sauvegarde pour l'instant.";
    if (late && b) bs.textContent += " Pense à en refaire une.";
    bs.classList.toggle("late", late);
    $("importBtn").disabled = !canWrite;
  }

  $("checkBtn").addEventListener("click", () => runChecks(true));

  // ---- Sauvegarde : un fichier .json avec les séries, les couvertures retrouvées et les sorties ----
  $("exportBtn").addEventListener("click", () => {
    const data = { app: "mangatheque", version: 1, exportedAt: new Date().toISOString(), series: view(), covers, releases };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mangatheque-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    saveJson("mtq-backup", Date.now());
    renderTools();
    toast("Sauvegarde téléchargée");
  });

  function cleanSeries(s, i, used) {
    if (!s || typeof s.title !== "string" || !s.title.trim()) return null;
    const n = (v) => num(v);
    let id = typeof s.id === "string" && /^[\w-]{1,60}$/.test(s.id) ? s.id : "";
    if (!id || used.has(id)) id = "s" + Date.now().toString(36) + i;
    used.add(id);
    return {
      id, title: s.title.trim().slice(0, 140),
      type: TYPES.includes(s.type) ? s.type : "Manga",
      status: STATUSES[s.status] ? s.status : "reading",
      volumeRead: Math.max(0, Math.floor(n(s.volumeRead) ?? 0)),
      page: n(s.page), volumesTotal: n(s.volumesTotal), volumesOwned: n(s.volumesOwned), rating: n(s.rating),
      url: s.url ? safeUrl(String(s.url)) : "", note: String(s.note || "").slice(0, 600),
      wiki: String(s.wiki || "").slice(0, 200), author: String(s.author || "").slice(0, 80),
      updatedAt: n(s.updatedAt), example: !!s.example
    };
  }

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      const raw = Array.isArray(d) ? d : d && Array.isArray(d.series) ? d.series : null;
      if (!raw) throw new Error("format");
      const used = new Set();
      const series = raw.map((s, i) => cleanSeries(s, i, used)).filter(Boolean);
      if (!series.length) throw new Error("vide");
      importDraft = { name: file.name, series, covers: d.covers && typeof d.covers === "object" ? d.covers : {}, releases: d.releases && typeof d.releases === "object" ? d.releases : {} };
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast("Ce fichier n'est pas une sauvegarde de la Mangathèque");
    }
  });

  async function doImport() {
    const d = importDraft;
    if (!d) return;
    for (const id of Object.keys(pending)) { clearTimeout(timers[id]); delete pending[id]; }
    if (mode === "local") {
      items = d.series;
      saveLocal();
    } else {
      for (const it of items) if (!d.series.some((s) => s.id === it.id)) await store.remove(it.id);
      for (const { id, ...rest } of d.series) await store.set(id, rest);
    }
    covers = { ...covers, ...d.covers };
    saveCovers();
    releases = d.releases;
    news = [];
    saveJson("mtq-releases", releases);
    saveJson("mtq-news", news);
    importDraft = null;
    render();
    toast(`${d.series.length} série${d.series.length > 1 ? "s" : ""} restaurée${d.series.length > 1 ? "s" : ""}`);
  }

  $("notices").addEventListener("click", (e) => {
    if (e.target.id === "importCancel") { importDraft = null; render(); }
    else if (e.target.id === "importOk") { e.target.disabled = true; doImport().catch(handleWriteError); }
    else if (e.target.id === "newsOk") { news = []; saveJson("mtq-news", news); render(); }
  });

  // ---- Démarrage ----
  async function start() {
    if (!window.claude || typeof window.claude.use !== "function") { startLocal(); return; }
    window.claude.use("sample").then((s) => { sampleNs = s; }, () => {});
    const [dbNs, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!dbNs) { startLocal(); return; }
    db = dbNs;
    if (user) {
      try { canWrite = !!(await user.isOwner()); } catch (e) { canWrite = true; }
    }
    const timer = setTimeout(() => { stale = true; loaded = true; render(); }, 10000);
    db.collection("series").onSnapshot((snap) => {
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      loaded = true;
      if (!snap.metadata.fromCache) { clearTimeout(timer); stale = false; }
      render();
    }, (e) => {
      clearTimeout(timer);
      if (e && (e.code === "not_granted" || e.code === "capability_disabled" || e.code === "capability_removed")) { startLocal(); return; }
      loaded = true;
      stale = false;
      readOnlyReason = e && e.code === "revoked" ? "" : "Impossible de charger tes séries pour le moment. Recharge la page plus tard.";
      render();
    });
  }

  // Synchro : un autre appareil (via Mon QG) a modifié la liste, on la relit
  window.addEventListener("storage", (e) => {
    if (mode !== "local") return;
    if (e.key === LOCAL_KEY || e.key === null) { loadLocal(); render(); }
    if (e.key === "mtq-releases" || e.key === null) { releases = loadJson("mtq-releases", {}) || {}; render(); }
    if (e.key === "mtq-news" || e.key === null) { news = loadJson("mtq-news", []); if (!Array.isArray(news)) news = []; render(); }
    if (e.key === COVER_KEY || e.key === null) { try { covers = JSON.parse(localStorage.getItem(COVER_KEY) || "{}") || {}; } catch (err) { covers = {}; } }
  });

  render();
  start();
})();
