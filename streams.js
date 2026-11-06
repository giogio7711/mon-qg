(() => {
  const KEY = "qg-streams";
  const LIVE_KEY = "qg-live";     // dernier état connu, lu aussi par le tableau de bord
  const API = "https://decapi.me";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const loadJson = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? f; } catch (e) { return f; } };
  const saveJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const pad = (n) => String(n).padStart(2, "0");

  // On ne garde que des chaînes bien formées (une sauvegarde ou une synchro abîmée ne doit rien casser ni injecter)
  const cleanItems = (v) => (Array.isArray(v) ? v : []).filter((i) => i && typeof i.id === "string" && /^[\w-]{1,60}$/.test(i.id)
    && (i.platform === "twitch" || i.platform === "youtube") && typeof i.handle === "string" && parseHandle(i.platform, i.handle) !== "");
  let items = cleanItems(loadJson(KEY, []));
  let state = loadJson(LIVE_KEY, {});   // id -> {live, uptime, title, game, avatar, video:{id,title}, checked, error}
  if (!state || typeof state !== "object") state = {};
  let filter = "all", busy = false, lastRefresh = 0, search = "";
  // « fav » : l'écran d'accueil, seulement tes favoris ; « all » : toutes les chaînes importées, pour choisir les favoris
  let view = loadJson("qg-streams-view", "fav");
  const favs = () => items.filter((i) => i.fav);
  if (!favs().length && items.length) view = "all";
  const wasLive = {};
  for (const [id, s] of Object.entries(state)) wasLive[id] = !!s.live;

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 2400);
  }

  // Horloge de régie
  function tick() { const d = new Date(); $("clock").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
  tick();
  setInterval(tick, 1000);

  // « https://www.twitch.tv/zerator » → zerator ; « youtube.com/@Squeezie » → @Squeezie ; « youtube.com/channel/UC… » → UC…
  function parseHandle(plat, raw) {
    let s = raw.trim();
    if (!s) return "";
    if (plat === "twitch") {
      const m = s.match(/twitch\.tv\/([A-Za-z0-9_]{2,25})/i);
      s = m ? m[1] : s.replace(/^@/, "");
      return /^[A-Za-z0-9_]{2,25}$/.test(s) ? s.toLowerCase() : "";
    }
    const ch = s.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i);
    if (ch) return ch[1];
    // Les @pseudos YouTube peuvent contenir des accents (@Léo) : tout sauf espace, / ? # et virgule
    const h = s.match(/youtube\.com\/(@[^\s/?#,]{2,})/i);
    if (h) { try { return decodeURIComponent(h[1]); } catch (e) { return h[1]; } }
    if (/^UC[\w-]{20,}$/.test(s)) return s;
    s = s.replace(/^@?/, "@");
    return /^@[^\s/?#,]{2,}$/.test(s) ? s : "";
  }

  const pageUrl = (it) => it.platform === "twitch" ? `https://www.twitch.tv/${it.handle}`
    : it.handle.startsWith("UC") ? `https://www.youtube.com/channel/${it.handle}` : `https://www.youtube.com/${it.handle}`;

  // decapi.me bloque les rafales de requêtes simultanées : une requête à la fois, petite pause, et une nouvelle tentative si refus
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let chain = Promise.resolve();
  function get(path) {
    const run = chain.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 9000);
        try {
          const r = await fetch(API + path, { signal: ctrl.signal });
          if (r.status === 429 || r.status >= 500) throw new Error(String(r.status));
          if (!r.ok) throw Object.assign(new Error(String(r.status)), { final: true });
          return (await r.text()).trim();
        } catch (e) {
          if (e.final || attempt === 2) throw e;
          await wait(2500 * (attempt + 1));   // refusé ou coupé : on patiente puis on réessaie
        } finally {
          clearTimeout(timer);
          await wait(120);
        }
      }
    });
    chain = run.catch(() => {});
    return run;
  }

  async function checkOne(it) {
    const prev = state[it.id] || {};
    const s = { ...prev, checked: Date.now(), error: false };
    try {
      if (it.platform === "twitch") {
        const up = await get(`/twitch/uptime/${it.handle}`);
        s.live = /\b\d+\s+(second|minute|hour|day)/i.test(up);
        // « 13 hours, 15 minutes, 6 seconds » → minutes écoulées, affichées en minutage 13:15
        if (s.live) {
          const part = (re) => +((up.match(re) || [])[1] || 0);
          s.mins = part(/(\d+)\s+day/) * 1440 + part(/(\d+)\s+hour/) * 60 + part(/(\d+)\s+minute/);
          s.since = Date.now() - s.mins * 60000;
          s.title = await get(`/twitch/title/${it.handle}`).catch(() => prev.title || "");
          s.game = await get(`/twitch/game/${it.handle}`).catch(() => prev.game || "");
        } else { s.title = ""; s.game = ""; s.since = 0; }
        if (!s.avatar) {
          const av = await get(`/twitch/avatar/${it.handle}`).catch(() => "");
          if (/^https:\/\/static-cdn\.jtvnw\.net\//.test(av)) s.avatar = av;
        }
      } else {
        const param = it.handle.startsWith("UC") ? `id=${encodeURIComponent(it.handle)}` : `handle=${encodeURIComponent(it.handle)}`;
        const txt = await get(`/youtube/latest_video?${param}`);
        const m = txt.match(/^(.*)\s+-\s+https:\/\/youtu\.be\/([\w-]{6,})\s*$/);
        if (m) s.video = { title: m[1], id: m[2] };
        else s.error = true;
      }
    } catch (e) {
      // Pas de réponse : on garde le dernier état connu (un live reste affiché en live) au lieu de « signal inconnu »
      Object.assign(s, { live: prev.live, since: prev.since, title: prev.title, game: prev.game, video: prev.video, error: !prev.checked });
    }
    state[it.id] = s;
  }

  async function refresh(manual) {
    if (busy || !favs().length) { render(); return; }
    busy = true;
    $("refreshBtn").disabled = true;
    $("refreshState").textContent = "SYNCHRO…";
    // Seulement les favoris, une chaîne après l'autre, en commençant par celles déjà en live
    const queue = favs().sort((a, b) => (state[b.id]?.live ? 1 : 0) - (state[a.id]?.live ? 1 : 0));
    let done = 0;
    for (const it of queue) {
      if (!items.some((i) => i.id === it.id)) continue;
      await checkOne(it);
      done++;
      $("refreshState").textContent = `SYNCHRO ${done}/${queue.length}…`;
      if (done % 4 === 0 || state[it.id]?.live !== wasLive[it.id]) { render(); $("refreshState").textContent = `SYNCHRO ${done}/${queue.length}…`; }
    }
    for (const id of Object.keys(state)) if (!items.some((i) => i.id === id)) delete state[id];
    saveJson(LIVE_KEY, state);
    lastRefresh = Date.now();
    busy = false;
    $("refreshBtn").disabled = false;
    render();
    if (manual) {
      const n = favs().filter((i) => state[i.id]?.live).length;
      toast(n ? `${n} EN DIRECT` : "AUCUN DIRECT");
    }
  }

  // Minutage du live (heures:minutes depuis le début), recalculé à chaque affichage
  function timecode(s) {
    if (!s.since) return "";
    const m = Math.max(0, Math.floor((Date.now() - s.since) / 60000));
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  function renderStats() {
    const base = favs();
    const live = base.filter((i) => state[i.id]?.live).length;
    const tw = base.filter((i) => i.platform === "twitch").length;
    const yt = base.filter((i) => i.platform === "youtube").length;
    $("nFav").textContent = base.length;
    $("nAll").textContent = items.length;
    $("viewFav").setAttribute("aria-pressed", view === "fav");
    $("viewAll").setAttribute("aria-pressed", view === "all");
    $("chSearch").hidden = view !== "all";
    $("stats").innerHTML = [["Favoris en direct", live, live > 0, "live"], ["Favoris Twitch", tw, false, "twitch"], ["Favoris YouTube", yt, false, "youtube"]]
      .map(([l, v, hot, f]) => `<button type="button" class="stat${hot ? " hot" : ""}" data-filter="${f}" aria-pressed="${filter === f}"><span class="led"></span><span><span class="v">${pad(v)}</span><br><span class="l">${l}</span></span></button>`).join("");
    $("onair").classList.toggle("lit", live > 0);
    $("onair").textContent = live > 0 ? "ON AIR" : "OFF AIR";
  }

  function renderTicker() {
    const live = favs().filter((i) => state[i.id]?.live);
    const vids = favs().filter((i) => i.platform === "youtube" && state[i.id]?.video);
    let parts = live.map((i) => `<span><b>●</b> ${esc(i.handle.toUpperCase())} EN DIRECT${state[i.id].game ? " — " + esc(state[i.id].game.toUpperCase()) : ""}</span>`);
    parts = parts.concat(vids.map((i) => `<span>▶ ${esc(i.handle.replace(/^@/, "").toUpperCase())} : ${esc(state[i.id].video.title)}</span>`));
    if (!parts.length) parts = [`<span>${items.length ? "AUCUN DIRECT POUR LE MOMENT · LA RÉGIE SURVEILLE TES CHAÎNES TOUTES LES 3 MINUTES" : "AUCUNE CHAÎNE BRANCHÉE · AJOUTE UN STREAMER TWITCH OU UNE CHAÎNE YOUTUBE CI-DESSOUS"}</span>`];
    const once = parts.join("");
    const run = $("ticker");
    if (run.dataset.src === once) return;   // même contenu : on ne relance pas le défilement
    run.dataset.src = once;
    run.innerHTML = once + once;            // deux fois, pour boucler sans saut
    run.style.setProperty("--dur", Math.max(18, run.textContent.length / 2 * 0.22) + "s");
  }

  function twitchCard(it, n) {
    const s = state[it.id] || {};
    const fresh = s.live && !wasLive[it.id];
    const preview = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${it.handle}-640x360.jpg?t=${Math.floor((s.checked || 0) / 1000)}`;
    const screen = s.live
      ? `<a class="screen" href="${esc(pageUrl(it))}" target="_blank" rel="noopener noreferrer" aria-label="Regarder ${esc(it.handle)}"><span class="tag rec">LIVE</span><span class="tag tc">${timecode(s)}</span><img src="${esc(preview)}" alt="" loading="lazy"></a>`
      : `<div class="screen"><span class="tag src">TWITCH</span><div class="nosig"><div class="av">${/^https:\/\/static-cdn\.jtvnw\.net\//.test(s.avatar || "") ? `<img src="${esc(s.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : esc(it.handle[0].toUpperCase())}</div>${s.checked ? (s.error ? "SIGNAL INCONNU" : "PAS DE SIGNAL") : "RECHERCHE…"}</div></div>`;
    return `<article class="monitor${s.live ? " live" : ""}${fresh ? " fresh" : ""}" data-id="${esc(it.id)}">
      ${screen}
      <div class="label"><span class="cam">CAM ${pad(n + 1)}</span><h3>${esc(it.handle)}</h3><span class="tally" aria-label="${s.live ? "En direct" : "Hors ligne"}"></span></div>
      ${s.live ? `<p class="what">${esc(s.title || "Live en cours")}</p>${s.game ? `<p class="sub">JEU <b>${esc(s.game)}</b></p>` : ""}` : ""}
      <div class="controls">
        <a class="btn${s.live ? " primary" : ""}" href="${esc(pageUrl(it))}" target="_blank" rel="noopener noreferrer">${s.live ? "Regarder ↗" : "Chaîne ↗"}</a>
        <span class="spacer"></span>
        <button class="star on" type="button" data-act="fav" title="Retirer des favoris" aria-label="Retirer ${esc(it.handle)} des favoris">★</button>
      </div>
    </article>`;
  }

  function youtubeCard(it, n) {
    const s = state[it.id] || {};
    const v = s.video && /^[\w-]{6,20}$/.test(s.video.id || "") ? s.video : null;
    const name = it.handle.replace(/^@/, "");
    const screen = v
      ? `<a class="screen" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener noreferrer" aria-label="Voir la vidéo"><span class="tag src">REPLAY</span><img src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" loading="lazy"></a>`
      : `<div class="screen"><span class="tag src">YOUTUBE</span><div class="nosig"><div class="av">${esc(name[0].toUpperCase())}</div>${s.error ? "CHAÎNE INTROUVABLE" : "RECHERCHE…"}</div></div>`;
    return `<article class="monitor" data-id="${esc(it.id)}">
      ${screen}
      <div class="label"><span class="cam">VTR ${pad(n + 1)}</span><h3>${esc(name)}</h3></div>
      ${v ? `<p class="what">${esc(v.title)}</p>` : s.error ? `<p class="sub">Vérifie le pseudo : celui qui commence par @ dans l'adresse de la chaîne.</p>` : ""}
      <div class="controls">
        ${v ? `<a class="btn primary" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener noreferrer">Voir ↗</a>` : ""}
        <a class="btn" href="${esc(pageUrl(it))}" target="_blank" rel="noopener noreferrer">Chaîne ↗</a>
        <span class="spacer"></span>
        <button class="star on" type="button" data-act="fav" title="Retirer des favoris" aria-label="Retirer ${esc(name)} des favoris">★</button>
      </div>
    </article>`;
  }

  function render() {
    renderStats();
    renderTicker();
    const show = (it) => filter === "all" || (filter === "live" ? state[it.id]?.live : it.platform === filter);
    const byName = (a, b) => a.handle.replace(/^@/, "").localeCompare(b.handle.replace(/^@/, ""), "fr", { sensitivity: "base" });
    const isLive = (i) => (state[i.id]?.live ? 1 : 0);
    let html = "";
    if (!items.length) html = `<div class="wall"><div class="empty"><span class="big">— PAS DE SIGNAL —</span><h2>Aucune chaîne branchée</h2><p>Ajoute un streamer Twitch ou une chaîne YouTube avec le champ juste au-dessus (pseudo ou lien), ou importe-les d'un coup.</p></div></div>`;
    else if (view === "all") {
      // Toutes les chaînes en liste compacte : l'étoile les met en favoris
      const q = search.trim().toLowerCase().replace(/^@/, "");
      const list = items.filter((i) => !q || i.handle.toLowerCase().replace(/^@/, "").includes(q));
      const row = (i) => {
        const s = state[i.id] || {};
        const name = i.handle.replace(/^@/, "");
        return `<div class="ch${s.live ? " live" : ""}${i.fav ? " is-fav" : ""}" data-id="${esc(i.id)}">
          <button class="star${i.fav ? " on" : ""}" type="button" data-act="fav" aria-pressed="${!!i.fav}" title="${i.fav ? "Retirer des favoris" : "Ajouter aux favoris"}" aria-label="${i.fav ? "Retirer" : "Ajouter"} ${esc(name)} ${i.fav ? "des" : "aux"} favoris">★</button>
          <span class="tally"></span><a class="nm" href="${esc(pageUrl(i))}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${esc(name)}</a>
          ${s.live && s.game ? `<span class="lv">${esc(s.game)}</span>` : `<span class="sp"></span>`}
          <button class="btn danger" type="button" data-act="del">Débrancher</button>
        </div>`;
      };
      const tw = list.filter((i) => i.platform === "twitch").sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || byName(a, b));
      const yt = list.filter((i) => i.platform === "youtube").sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || byName(a, b));
      if (!favs().length) html += `<p class="hint-bar">Clique sur l'étoile <b>★</b> des chaînes que tu veux voir en premier : elles s'afficheront en grand dans « Mes favoris », avec le direct et les dernières vidéos.</p>`;
      if (tw.length) html += `<h2 class="section-title">Twitch · ${tw.length} chaînes</h2><div class="chlist">${tw.map(row).join("")}</div>`;
      if (yt.length) html += `<h2 class="section-title">YouTube · ${yt.length} chaînes</h2><div class="chlist">${yt.map(row).join("")}</div>`;
      if (!list.length) html = `<div class="wall"><div class="empty"><span class="big">— ? —</span><h2>Aucune chaîne trouvée</h2><p>Aucune chaîne ne correspond à « ${esc(search)} ».</p></div></div>`;
    } else if (!favs().length) {
      html = `<div class="wall"><div class="empty"><span class="big">— AUCUN FAVORI —</span><h2>Choisis tes chaînes favorites</h2><p>Va dans « Toutes mes chaînes » et clique sur l'étoile ★ de celles que tu veux voir ici.</p></div></div>`;
    } else {
      const tw = favs().filter((i) => i.platform === "twitch" && show(i)).sort((a, b) => isLive(b) - isLive(a) || byName(a, b));
      const yt = favs().filter((i) => i.platform === "youtube" && show(i)).sort(byName);
      if (tw.length) html += `<h2 class="section-title">Twitch · direct</h2><div class="wall">${tw.map(twitchCard).join("")}</div>`;
      if (yt.length) html += `<h2 class="section-title">YouTube · dernières vidéos</h2><div class="wall">${yt.map(youtubeCard).join("")}</div>`;
      if (!tw.length && !yt.length) html = `<div class="wall"><div class="empty"><span class="big">— OFF AIR —</span><h2>Personne ici</h2><p>${filter === "live" ? "Aucune de tes chaînes Twitch n'est en direct en ce moment." : "Rien ne correspond à ce filtre."}</p></div></div>`;
    }
    $("sections").innerHTML = html;
    for (const it of items) wasLive[it.id] = !!state[it.id]?.live;
    $("refreshState").textContent = busy ? "SYNCHRO…" : lastRefresh ? `DERNIÈRE SYNCHRO ${new Date(lastRefresh).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "";
  }

  // Une ou plusieurs chaînes : « zerator, squeezie, @Inoxtag, https://youtube.com/@x ».
  // Un lien YouTube, un @pseudo ou un identifiant UC… va vers YouTube ; un lien Twitch vers Twitch ; un pseudo seul vers la plateforme choisie.
  $("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const chosen = $("a-plat").value;
    const raw = $("a-handle").value;
    let tokens = raw.split(/[\s,;•·]+/).map((s) => s.trim()).filter(Boolean);
    if (!tokens.length) { toast("Écris un pseudo ou colle une liste"); return; }
    // Toute une page collée (Ctrl+A, Ctrl+C sur la liste des abonnements YouTube) : on ne garde que les @pseudos et les liens
    const pageMode = tokens.length > 20 && (raw.match(/(^|[\s•·(])@[^\s,;•·/?#@]{2,}/g) || []).length >= 2;
    if (pageMode) {
      tokens = (raw.match(/(?:^|[\s•·(])(@[^\s,;•·/?#@)]{2,})|(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/@[^\s,;•·/?#]+|twitch\.tv\/\w+)/g) || [])
        .map((t) => t.trim().replace(/^[•·(]/, "").replace(/[.:!]+$/, ""));
    }
    const added = [];
    let dup = 0, bad = 0;
    for (const tok of tokens) {
      const plat = /youtube\.com|youtu\.be/i.test(tok) || /^UC[\w-]{20,}$/.test(tok) || (tok.startsWith("@") && (chosen === "youtube" || pageMode)) ? "youtube"
        : /twitch\.tv/i.test(tok) ? "twitch" : chosen;
      const handle = parseHandle(plat, tok);
      if (!handle) { bad++; continue; }
      if ([...items, ...added].some((i) => i.platform === plat && i.handle.toLowerCase() === handle.toLowerCase())) { dup++; continue; }
      added.push({ id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), platform: plat, handle, addedAt: Date.now() });
    }
    if (!added.length) { toast(dup ? "Déjà branchée" + (dup > 1 ? "s" : "") : "Pseudo invalide"); return; }
    // Quelques chaînes tapées à la main : ce sont sûrement des favorites. Un gros import : à trier avec l'étoile.
    const bulk = added.length > 3;
    if (!bulk) added.forEach((a) => (a.fav = true));
    else if (view === "fav") view = "all";
    items = [...items, ...added];
    saveJson(KEY, items);
    $("a-handle").value = "";
    $("importBox").open = false;
    render();
    let msg = added.length === 1 ? "Chaîne branchée" : `${added.length} chaînes branchées`;
    if (dup) msg += ` · ${dup} déjà là`;
    if (bad) msg += ` · ${bad} ignorée${bad > 1 ? "s" : ""}`;
    toast(bulk ? msg + " · clique sur ★ pour tes favoris" : msg + " en favori");
    if (added.length === 1) {
      await checkOne(added[0]);
      saveJson(LIVE_KEY, state);
      render();
      if (state[added[0].id]?.error) toast("Branchée, mais pas de réponse : vérifie le pseudo");
    } else if (!bulk) {
      lastRefresh = 0;
      refresh(false);
    }
  });

  // Entrée = Brancher, comme dans un champ normal (la zone de texte garde les retours à la ligne d'une page collée)
  $("a-handle").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("addForm").requestSubmit(); }
  });

  // ---- Favori à glisser : lit les pseudos de la page « Chaînes suivies » de Twitch et les copie ----
  // Marche sur twitch.tv (page « Chaînes suivies ») et sur youtube.com (page « Abonnements » → liste des chaînes).
  // Copie des liens complets (twitch.tv/x, youtube.com/@x) : la page reconnaît la plateforme toute seule au collage.
  const BOOKMARKLET = `(async () => {
    const tw = /(^|\\.)twitch\\.tv$/.test(location.hostname), yt = /(^|\\.)youtube\\.com$/.test(location.hostname);
    if (!tw && !yt) { alert("Ouvre d'abord twitch.tv ou youtube.com, connecté à ton compte, puis clique de nouveau sur ce favori."); return; }
    const page = tw ? "/directory/following/channels" : "/feed/channels";
    if (!location.pathname.startsWith(page)) {
      alert(tw ? "Je t'ouvre ta page « Chaînes suivies ». Quand elle est chargée, reclique sur ce favori." : "Je t'ouvre la liste de tes abonnements. Quand elle est chargée, reclique sur ce favori.");
      location.href = location.origin + page;
      return;
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const zone = tw ? "main" : "ytd-browse, #contents, #content";
    const skip = new Set("directory settings videos search subscriptions wallet inventory drops friends turbo prime store jobs p u downloads following moderator broadcast login signup messages notifications".split(" "));
    const found = new Set();
    const anchors = () => [...document.querySelectorAll(zone)].flatMap((z) => [...z.querySelectorAll("a[href]")]);
    const collect = () => {
      for (const a of anchors()) {
        const h = a.getAttribute("href");
        if (tw) {
          const n = (h.match(/^\\/([A-Za-z0-9_]{2,25})\\/?(?:[?#].*)?$/) || [])[1];
          if (n && !skip.has(n.toLowerCase())) found.add("twitch.tv/" + n.toLowerCase());
        } else {
          let n = (h.match(/^(?:https:\\/\\/www\\.youtube\\.com)?\\/(@[^/?#]+)\\/?(?:[?#].*)?$/) || [])[1];
          if (n) { try { n = decodeURIComponent(n); } catch (e) {} found.add("youtube.com/" + n); }
        }
      }
    };
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;z-index:999999;top:16px;right:16px;background:#000;color:#fff;border:2px solid #ff2a2a;padding:10px 14px;font:600 14px monospace;border-radius:6px";
    document.body.append(box);
    let still = 0, last = -1, scrollers = [];
    for (let i = 0; i < 300 && still < 10; i++) {
      collect();
      box.textContent = "Mon QG : " + found.size + " chaînes trouvées… (défilement en cours)";
      const list = anchors();
      if (list.length) list[list.length - 1].scrollIntoView({ block: "end" });
      if (i % 10 === 0) scrollers = [...document.querySelectorAll("main, main *")].filter((el) => el.scrollHeight > el.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(el).overflowY));
      scrollers.forEach((el) => (el.scrollTop = el.scrollHeight));
      window.scrollTo(0, document.documentElement.scrollHeight);
      await wait(700);
      if (found.size === last) still++; else { still = 0; last = found.size; }
    }
    collect();
    box.remove();
    const links = [...found];
    if (!links.length) { alert("Aucune chaîne trouvée sur cette page. Vérifie que tu es bien connecté et que la liste est affichée."); return; }
    const list = links.join(", ");
    try { await navigator.clipboard.writeText(list); alert(links.length + " chaînes copiées ! Reviens sur Mon QG et colle-les (Ctrl+V) dans le champ, puis « Brancher »."); }
    catch (e) { prompt(links.length + " chaînes trouvées. Copie cette liste (Ctrl+C), puis colle-la dans Mon QG :", list); }
  })();`;
  const bm = $("bookmarklet");
  bm.href = "javascript:" + encodeURIComponent(BOOKMARKLET.replace(/\n\s*/g, " "));
  bm.addEventListener("click", (e) => { e.preventDefault(); toast("Glisse ce bouton dans ta barre de favoris, puis utilise-le sur twitch.tv"); });
  if (!items.length) $("importBox").open = true;

  $("sections").addEventListener("click", async (e) => {
    const star = e.target.closest("[data-act=fav]");
    if (star) {
      const id = star.closest("[data-id]").dataset.id;
      const it = items.find((i) => i.id === id);
      if (!it) return;
      it.fav = !it.fav;
      items = items.slice();
      saveJson(KEY, items);
      render();
      toast(it.fav ? "★ Ajoutée aux favoris" : "Retirée des favoris");
      // Nouveau favori : on va chercher tout de suite son direct ou sa dernière vidéo
      if (it.fav && !(Date.now() - (state[id]?.checked || 0) < 170000)) { await checkOne(it); saveJson(LIVE_KEY, state); render(); }
      return;
    }
    const b = e.target.closest("[data-act=del]");
    if (!b) return;
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Confirmer"; return; }
    const id = b.closest("[data-id]").dataset.id;
    items = items.filter((i) => i.id !== id);
    delete state[id];
    saveJson(KEY, items);
    saveJson(LIVE_KEY, state);
    render();
    toast("Chaîne débranchée");
  });
  function setView(v) {
    view = v;
    saveJson("qg-streams-view", v);
    filter = "all";
    render();
    if (v === "all") $("chSearch").focus();
  }
  $("viewFav").addEventListener("click", () => setView("fav"));
  $("viewAll").addEventListener("click", () => setView("all"));
  $("chSearch").addEventListener("input", (e) => { search = e.target.value; render(); });

  // Aperçu du live indisponible : on garde l'écran noir avec le minutage
  $("sections").addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.remove(); }, true);

  $("stats").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filter = filter === b.dataset.filter ? "all" : b.dataset.filter;
    render();
  });
  $("refreshBtn").addEventListener("click", () => refresh(true));

  // Actualisation toutes les 3 minutes, seulement quand la page est visible
  setInterval(() => { if (document.visibilityState === "visible" && Date.now() - lastRefresh > 170000) refresh(false); }, 30000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - lastRefresh > 170000) refresh(false); });
  window.addEventListener("storage", (e) => {
    if (e.key === KEY || e.key === null) { items = cleanItems(loadJson(KEY, [])); render(); refresh(false); }
  });

  render();
  refresh(false);
})();
