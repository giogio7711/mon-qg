(() => {
  const PAGES = { mangas: "mangatheque.html", jeux: "jeux.html", streams: "streams.html" };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const loadJson = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? f; } catch (e) { return f; } };
  const arr = (v) => (Array.isArray(v) ? v : []);
  const frames = {};
  let current = "";
  let introPlayed = false;
  let pendingImport = null;
  let liveNow = {};    // id -> {live, game, title} vérifié depuis l'accueil

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 2400);
  }

  $("today").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toUpperCase());

  // ---- Onglets : chaque outil est chargé une fois puis gardé ouvert ----
  function show(tab) {
    if (tab !== "accueil" && !PAGES[tab]) tab = "accueil";
    current = tab;
    for (const b of $("nav").querySelectorAll("button")) b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false");
    $("accueil").hidden = tab !== "accueil";
    document.body.classList.toggle("framed", tab !== "accueil");
    if (tab !== "accueil" && !frames[tab]) {
      const f = document.createElement("iframe");
      f.className = "frame";
      f.src = PAGES[tab];
      f.title = tab;
      $("frames").append(f);
      frames[tab] = f;
    }
    for (const [k, f] of Object.entries(frames)) f.hidden = k !== tab;
    if (tab === "accueil") renderHome();
    try { localStorage.setItem("qg-tab", JSON.stringify(tab)); } catch (e) {}
    if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
  }

  $("nav").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));

  // ---- Accueil ----
  function behind(s) { const r = num(s.volumeRead) ?? 0, t = num(s.volumesTotal); return t != null && t > r ? t - r : 0; }

  function fmtRelease(n) {
    const d = new Date(n.date);
    if (n.prec === "year") return `en ${d.getFullYear()}`;
    if (n.prec === "month") return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  function mangaBox() {
    const series = arr(loadJson("mtq-series", []));
    const news = arr(loadJson("mtq-news", [])).filter((n) => series.some((s) => s.id === n.id));
    const rel = loadJson("mtq-releases", {}) || {};
    const reading = series.filter((s) => s.status === "reading");
    const toCatch = reading.filter((s) => behind(s) > 0);
    const upcoming = series.map((s) => ({ s, n: rel[s.id]?.next }))
      .filter(({ s, n }) => n && n.date > Date.now() && !(num(s.volumesTotal) != null && n.vol <= s.volumesTotal))
      .sort((a, b) => a.n.date - b.n.date).slice(0, 4);
    const toRead = toCatch.slice().sort((a, b) => behind(b) - behind(a)).slice(0, 4);
    $("dot-mangas").hidden = !news.length;
    $("dot-mangas").textContent = news.length;
    return `<div class="box" style="--i:0">
      <h2>Mangas <span aria-hidden="true">マンガ</span></h2>
      <div class="nums">
        <div class="n"><b>${reading.length}</b><small>En cours</small></div>
        <div class="n${toCatch.length ? " hot" : ""}"><b>${toCatch.length}</b><small>À rattraper</small></div>
        <div class="n"><b>${series.reduce((t, s) => t + (num(s.volumeRead) ?? 0), 0)}</b><small>Tomes lus</small></div>
      </div>
      ${news.length ? `<h3>Nouveaux tomes</h3><ul class="list">${news.map((n) => `<li><span class="t">${esc(n.title)}</span><span class="r hot">tome ${esc(n.to)}</span></li>`).join("")}</ul>` : ""}
      ${upcoming.length ? `<h3>Prochaines sorties</h3><ul class="list">${upcoming.map(({ s, n }) => `<li><span class="t">${esc(s.title)} · t.${esc(n.vol)}</span><span class="r">${fmtRelease(n)}</span></li>`).join("")}</ul>` : ""}
      ${toRead.length ? `<h3>À lire</h3><ul class="list">${toRead.map((s) => `<li><span class="t">${esc(s.title)}</span><span class="r">${behind(s)} tome${behind(s) > 1 ? "s" : ""}</span></li>`).join("")}</ul>` : ""}
      ${!series.length ? `<p class="muted">Aucune série pour l'instant.</p>` : ""}
      <button class="btn go" type="button" data-tab="mangas">Ouvrir mes mangas →</button>
    </div>`;
  }

  function gameBox() {
    const games = arr(loadJson("qg-games", []));
    const playing = games.filter((g) => g.status === "playing").sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const backlog = games.filter((g) => g.status === "backlog");
    const hours = games.reduce((t, g) => t + (num(g.hours) ?? 0), 0);
    const h = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
    return `<div class="box" style="--i:1">
      <h2>Jeux <span aria-hidden="true">ゲーム</span></h2>
      <div class="nums">
        <div class="n"><b>${playing.length}</b><small>En cours</small></div>
        <div class="n"><b>${backlog.length}</b><small>À jouer</small></div>
        <div class="n"><b>${Math.round(hours)}</b><small>Heures</small></div>
      </div>
      ${playing.length ? `<h3>En ce moment</h3><ul class="list">${playing.slice(0, 5).map((g) => `<li><span class="t">${esc(g.title)}</span><span class="r">${esc(g.platform || "")} · ${h(num(g.hours) ?? 0)} h</span></li>`).join("")}</ul>` : ""}
      ${!playing.length && backlog.length ? `<h3>Prochain à lancer ?</h3><ul class="list">${backlog.slice(0, 4).map((g) => `<li><span class="t">${esc(g.title)}</span><span class="r">${esc(g.platform || "")}</span></li>`).join("")}</ul>` : ""}
      ${!games.length ? `<p class="muted">Aucun jeu pour l'instant.</p>` : ""}
      <button class="btn go" type="button" data-tab="jeux">Ouvrir mes jeux →</button>
    </div>`;
  }

  // Les chaînes en favori sur la page Streams (toutes, si aucune n'est encore en favori)
  function streamChans() {
    const all = arr(loadJson("qg-streams", []));
    return all.some((c) => c.fav) ? all.filter((c) => c.fav) : all;
  }

  function streamBox() {
    const chans = streamChans();
    const cache = loadJson("qg-live", {}) || {};
    // Le plus récent gagne : vérification de l'accueil ou celle de la page Streams
    const st = (c) => { const a = cache[c.id] || {}, b = liveNow[c.id]; return b && b.checked > (a.checked || 0) ? { ...a, ...b } : a; };
    const live = chans.filter((c) => c.platform === "twitch" && st(c).live);
    const vids = chans.filter((c) => c.platform === "youtube" && cache[c.id]?.video).slice(0, 4);
    $("dot-streams").hidden = !live.length;
    $("dot-streams").textContent = live.length;
    return `<div class="box" style="--i:2">
      <h2>Streams <span aria-hidden="true">ライブ</span></h2>
      <div class="nums">
        <div class="n${live.length ? " hot" : ""}"><b>${live.length}</b><small>En live</small></div>
        <div class="n"><b>${chans.filter((c) => c.platform === "twitch").length}</b><small>Twitch</small></div>
        <div class="n"><b>${chans.filter((c) => c.platform === "youtube").length}</b><small>YouTube</small></div>
      </div>
      ${live.length ? `<h3>En live maintenant</h3><ul class="list">${live.map((c) => `<li><a href="https://www.twitch.tv/${esc(encodeURIComponent(c.handle))}" target="_blank" rel="noopener noreferrer" style="display:contents">${/^https:\/\/static-cdn\.jtvnw\.net\//.test(st(c).avatar || "") ? `<img src="${esc(st(c).avatar)}" alt="" referrerpolicy="no-referrer">` : ""}<span class="t">${esc(c.handle)}</span><span class="r">${esc(st(c).game || "")}</span></a></li>`).join("")}</ul>`
        : chans.some((c) => c.platform === "twitch") ? `<p class="muted">Personne en live pour l'instant.</p>` : ""}
      ${vids.length ? `<h3>Dernières vidéos</h3><ul class="list">${vids.map((c) => `<li><a href="https://www.youtube.com/watch?v=${esc(cache[c.id].video.id)}" target="_blank" rel="noopener noreferrer" style="display:contents"><span class="t">${esc(cache[c.id].video.title)}</span><span class="r">${esc(c.handle.replace(/^@/, ""))}</span></a></li>`).join("")}</ul>` : ""}
      ${!chans.length ? `<p class="muted">Aucune chaîne suivie pour l'instant.</p>` : ""}
      <button class="btn go" type="button" data-tab="streams">Ouvrir mes streams →</button>
    </div>`;
  }

  function renderHome() {
    const home = $("home");
    if (!introPlayed) { introPlayed = true; home.classList.add("intro"); setTimeout(() => home.classList.remove("intro"), 1000); }
    home.innerHTML = mangaBox() + gameBox() + streamBox();
    const b = loadJson("qg-backup", 0);
    const has = arr(loadJson("mtq-series", [])).length + arr(loadJson("qg-games", [])).length + arr(loadJson("qg-streams", [])).length > 0;
    const late = has && (!b || Date.now() - b > 30 * 86400000);
    $("backupState").textContent = b ? `Dernière sauvegarde complète : ${new Date(b).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.${late ? " Pense à en refaire une." : ""}` : "Aucune sauvegarde complète pour l'instant.";
    $("backupState").classList.toggle("late", late);
  }
  $("home").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });

  // Qui est en live : vérifié depuis l'accueil toutes les 3 minutes (seulement les chaînes Twitch)
  async function checkLive() {
    if (checkLive.busy || frames.streams) return;   // la page Streams ouverte s'en occupe déjà
    const all = streamChans().filter((c) => c.platform === "twitch");
    const cache = loadJson("qg-live", {}) || {};
    // La page Streams vérifie déjà si elle est ouverte : on ne refait que les chaînes pas vérifiées depuis 3 minutes
    const chans = all.filter((c) => !(Date.now() - (cache[c.id]?.checked || 0) < 170000));
    if (!chans.length) { if (current === "accueil") renderHome(); return; }
    checkLive.busy = true;
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const text = async (url) => {
      // decapi.me refuse les rafales : une requête à la fois, et une nouvelle tentative après une pause
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 9000);
          const r = await fetch(url, { signal: ctrl.signal });
          clearTimeout(timer);
          if (r.ok) return (await r.text()).trim();
        } catch (e) { /* refusé : on réessaie */ }
        await pause(2500 * (attempt + 1));
      }
      throw new Error("decapi");
    };
    for (const c of chans) {
      try {
        const up = await text(`https://decapi.me/twitch/uptime/${encodeURIComponent(c.handle)}`);
        const live = /\b\d+\s+(second|minute|hour|day)/i.test(up);
        let game = "";
        if (live) { await pause(120); game = await text(`https://decapi.me/twitch/game/${encodeURIComponent(c.handle)}`).catch(() => ""); }
        liveNow[c.id] = { live, game: game || cache[c.id]?.game || "", checked: Date.now() };
      } catch (e) { /* on garde le dernier état connu */ }
      await pause(120);
    }
    checkLive.busy = false;
    if (current === "accueil") renderHome();
    else {
      const fresh = loadJson("qg-live", {}) || {};
      const n = all.filter((c) => { const a = fresh[c.id] || {}, b = liveNow[c.id]; return (b && b.checked > (a.checked || 0) ? b : a).live; }).length;
      $("dot-streams").hidden = !n; $("dot-streams").textContent = n;
    }
  }
  setInterval(() => { if (document.visibilityState === "visible") checkLive(); }, 180000);

  // Une autre page (un outil dans son onglet) a changé les données : l'accueil se met à jour
  window.addEventListener("storage", () => { if (current === "accueil") renderHome(); });

  // ---- Sauvegarde complète : toutes les données mtq-* (mangas) et qg-* (jeux, streams) ----
  // Les réglages de synchro de cet appareil (qg-device, qg-sync-meta) ne font pas partie d'une sauvegarde
  const OWN = (k) => /^(mtq|qg)-[a-z0-9-]{1,40}$/.test(k) && !["qg-tab", "qg-device", "qg-sync-meta"].includes(k);

  $("exportBtn").addEventListener("click", () => {
    const keys = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (OWN(k)) keys[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify({ app: "mon-qg", version: 1, exportedAt: new Date().toISOString(), keys }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mon-qg-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    try { localStorage.setItem("qg-backup", JSON.stringify(Date.now())); localStorage.setItem("mtq-backup", JSON.stringify(Date.now())); } catch (e) {}
    renderHome();
    toast("Sauvegarde téléchargée");
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast("Fichier trop gros pour être une sauvegarde"); return; }
    let d;
    try { d = JSON.parse(await file.text()); } catch (err) { toast("Ce fichier n'est pas une sauvegarde"); return; }
    if (d && d.app === "mangatheque") { toast("C'est une sauvegarde de la Mangathèque : restaure-la depuis l'onglet Mangas"); return; }
    if (!d || d.app !== "mon-qg" || !d.keys || typeof d.keys !== "object") { toast("Ce fichier n'est pas une sauvegarde de Mon QG"); return; }
    const keys = Object.fromEntries(Object.entries(d.keys).filter(([k, v]) => OWN(k) && typeof v === "string" && v.length < 5000000));
    const count = (k) => { try { return arr(JSON.parse(keys[k] || "[]")).length; } catch (err) { return 0; } };
    pendingImport = keys;
    $("confirm").innerHTML = `<span>Restaurer « ${esc(file.name)} » : ${count("mtq-series")} séries, ${count("qg-games")} jeux, ${count("qg-streams")} chaînes. Tes données actuelles seront remplacées.</span>
      <span><button class="btn ghost" type="button" id="impNo">Annuler</button> <button class="btn primary" type="button" id="impYes">Tout remplacer</button></span>`;
    $("confirm").hidden = false;
  });

  $("confirm").addEventListener("click", (e) => {
    if (e.target.id === "impNo") { pendingImport = null; $("confirm").hidden = true; }
    if (e.target.id !== "impYes" || !pendingImport) return;
    try {
      const old = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (OWN(k)) old.push(k); }
      for (const k of old) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(pendingImport)) localStorage.setItem(k, v);
    } catch (err) { toast("Restauration impossible : ce navigateur bloque l'enregistrement"); return; }
    pendingImport = null;
    $("confirm").hidden = true;
    // Les outils déjà ouverts sont rechargés pour relire les données
    for (const f of Object.values(frames)) f.remove();
    for (const k of Object.keys(frames)) delete frames[k];
    liveNow = {};
    window.qgSync?.pushAll();   // envoie la sauvegarde restaurée vers ton compte
    renderHome();
    checkLive();
    toast("Tout est restauré");
  });

  // Menu du compte
  $("userBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    $("userName").textContent = $("userBtn").title.split(" · ")[0];
    $("userMenu").hidden = !$("userMenu").hidden;
  });
  document.addEventListener("click", (e) => { if (!$("userMenu").hidden && !e.target.closest("#userMenu")) $("userMenu").hidden = true; });
  $("logoutBtn").addEventListener("click", () => window.qgSync?.logout());

  // Un autre appareil a changé quelque chose : l'accueil se met à jour (les outils ouverts l'apprennent tout seuls)
  window.addEventListener("qg-remote", () => { if (current === "accueil") renderHome(); });

  // En ligne : on attend la connexion et la première synchro avant d'ouvrir les outils. En fichier local : tout de suite.
  const online = location.protocol === "https:" || location.protocol === "http:";
  const boot = online ? new Promise((resolve) => (window.qgBootDone = resolve)) : Promise.resolve();
  renderHome();
  boot.then(() => {
    show(location.hash.slice(1) || loadJson("qg-tab", "accueil"));
    checkLive();
  });

  if (online && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
