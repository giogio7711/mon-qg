(() => {
  // Onglet PC : affiche le dernier bilan créé par Etat-PC.ps1 (fichier Documents\Etat PC\etat-pc.json).
  // Le bilan est gardé dans « qg-pc » : il est donc synchronisé et visible aussi sur le téléphone.
  const KEY = "qg-pc";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STATES = ["crit", "warn", "info", "ok"];
  const CATS = ["Stockage", "Santé des disques", "Pilotes et mises à jour", "Performances", "Entretien"];
  let report = null, filter = null;

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), 2800);
  }

  // ---- Lecture stricte du fichier : seulement du texte, tailles limitées, liens sûrs ----
  const str = (v, max = 600) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "");
  const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
  // Boutons autorisés : réglages Windows, dossiers de l'Explorateur, Sécurité Windows, sites web
  const safeLink = (u) => (/^(ms-settings:[\w\-.]*|windowsdefender:|search-ms:[^\s"'<>]*|https:\/\/[^\s"'<>]+)$/i.test(u) ? u : "");

  function clean(raw) {
    if (!raw || raw.app !== "etat-pc" || !Array.isArray(raw.checks)) return null;
    const d = new Date(str(raw.date, 40));
    if (isNaN(d)) return null;
    return {
      date: d.getTime(),
      config: {
        cpu: str(raw.config?.cpu, 200), cm: str(raw.config?.cm, 200), ram: str(raw.config?.ram, 200), gpu: str(raw.config?.gpu, 300),
        disques: list(raw.config?.disques, 12).map((x) => str(x, 200)), bios: str(raw.config?.bios, 100)
      },
      checks: list(raw.checks, 150).map((c) => ({
        cat: str(c?.cat, 80), nom: str(c?.nom, 200), etat: STATES.includes(c?.etat) ? c.etat : "info",
        valeur: str(c?.valeur, 400), conseil: str(c?.conseil, 1200),
        liens: list(c?.liens, 8).map((l) => ({ t: str(l?.t, 80), u: safeLink(str(l?.u, 1000)) })).filter((l) => l.t && l.u),
        details: list(c?.details, 80).map((x) => str(x, 400))
      })).filter((c) => c.nom),
      historique: list(raw.historique, 60).map((h) => ({ date: str(h?.date, 20), libre: str(h?.libre, 12), afaire: str(h?.afaire, 6), urgent: str(h?.urgent, 6) })),
      etapes: list(raw.etapes, 12).map((x) => str(x, 400)).filter(Boolean),
      loadedAt: Date.now()
    };
  }

  function load() {
    try { report = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { report = null; }
    if (report && (typeof report.date !== "number" || !Array.isArray(report.checks))) report = null;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(report)); } catch (e) { toast("Impossible d'enregistrer le bilan"); }
  }

  // ---- Affichage ----
  const fmtDate = (t) => new Date(t).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const num = (s) => { const v = parseFloat(String(s).replace(",", ".")); return isFinite(v) ? v : null; };

  function itemHtml(c) {
    const head = `<i class="dot d-${c.etat}"></i><div><div class="top"><b>${esc(c.nom)}</b><span class="val">${esc(c.valeur)}</span></div><div class="adv">${esc(c.conseil)}</div></div>`;
    if (!c.liens.length && !c.details.length) return `<div class="item ${c.etat}" data-e="${c.etat}"><div class="row">${head}<span></span></div></div>`;
    const det = c.details.length ? `<ul class="det">${c.details.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    const acts = c.liens.length ? `<div class="acts">${c.liens.map((l) => `<a class="btn sm" href="${esc(l.u)}"${/^https:/i.test(l.u) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(l.t)}</a>`).join("")}</div>` : "";
    return `<details class="item ${c.etat}" data-e="${c.etat}"><summary class="row">${head}<span class="chev" aria-hidden="true">▾</span></summary><div class="more">${det}${acts}</div></details>`;
  }

  function spark(rows) {
    const pts = rows.map((h) => num(h.libre)).filter((v) => v != null);
    if (pts.length < 2) return "";
    const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
    const xy = pts.map((v, i) => [(i / (pts.length - 1)) * 100, 40 - ((v - min) / span) * 34 - 3]);
    const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Espace libre sur C: au fil des bilans, de ${min} à ${max} Go"><path class="area" d="${line} L100 40 L0 40 Z"/><path d="${line}"/></svg>`;
  }

  function render() {
    $("empty").hidden = !!report;
    $("report").hidden = !report;
    $("pills").hidden = !report;
    $("pickBtn").hidden = !report;
    if (!report) { $("when").textContent = "Aucun bilan chargé"; $("foot").textContent = ""; return; }
    const r = report;
    const n = (e) => r.checks.filter((c) => c.etat === e).length;
    const crit = n("crit"), warn = n("warn"), ok = n("ok") + n("info");
    $("when").textContent = "Bilan du " + fmtDate(r.date);
    $("nCrit").textContent = crit; $("nWarn").textContent = warn; $("nOk").textContent = ok;
    const v = $("verdict");
    v.className = "verdict " + (crit ? "bad" : warn ? "todo" : "good");
    v.innerHTML = crit ? `<b>${crit} point${crit > 1 ? "s" : ""} urgent${crit > 1 ? "s" : ""}</b> et ${warn} chose${warn > 1 ? "s" : ""} à faire. Commence par les points rouges.`
      : warn ? `<b>${warn} chose${warn > 1 ? "s" : ""} à faire</b>, rien d'urgent. Ouvre les points orange pour savoir quoi faire.`
      : "<b>Tout est en ordre.</b> Rien à faire pour le moment.";
    const days = Math.floor((Date.now() - r.date) / 86400000);
    $("old").hidden = days < 8;
    $("old").textContent = `Ce bilan date de ${days} jours : relance Etat-PC.bat sur ton PC, puis « Mettre à jour le bilan ».`;

    const cats = [...CATS, ...new Set(r.checks.map((c) => c.cat).filter((c) => !CATS.includes(c)))];
    const order = (c) => STATES.indexOf(c.etat);
    $("checks").innerHTML = cats.map((cat) => {
      const items = r.checks.filter((c) => c.cat === cat).sort((a, b) => order(a) - order(b));
      return items.length ? `<section><h2>${esc(cat)}</h2><div class="list">${items.map(itemHtml).join("")}</div></section>` : "";
    }).join("") + `<p class="note" id="none" hidden>Rien dans cette catégorie pour le moment.</p>`;

    const cf = r.config;
    $("config").innerHTML = [["Processeur", cf.cpu], ["Carte mère", cf.cm], ["RAM", cf.ram], ["Carte graphique", cf.gpu], ["Disques", cf.disques.join("\n")], ["BIOS", cf.bios]]
      .filter(([, x]) => x).map(([k, x]) => `<span>${k}</span><span style="white-space:pre-line">${esc(x)}</span>`).join("");
    $("nextBox").hidden = !r.etapes.length;
    $("next").innerHTML = r.etapes.map((x) => {
      const m = x.match(/^([^:]{2,40}) : (.+)$/);
      return m ? `<li><b>${esc(m[1])} :</b> ${esc(m[2])}</li>` : `<li>${esc(x)}</li>`;
    }).join("");
    const rows = r.historique;
    $("spark").innerHTML = spark(rows);
    $("histo").innerHTML = `<tr><th>Bilan</th><th>C: libre</th><th>À faire</th></tr>` + rows.slice(-8).reverse()
      .map((h) => `<tr><td>${esc(h.date)}</td><td>${esc(h.libre)} Go</td><td>${esc(h.afaire)}</td></tr>`).join("");
    $("foot").textContent = `Liens « Ouvrir… » : ils ouvrent les réglages et dossiers de Windows, donc seulement sur ton PC. Bilan chargé le ${new Date(r.loadedAt || r.date).toLocaleDateString("fr-FR")}.`;
    applyFilter();
  }

  function applyFilter() {
    for (const p of document.querySelectorAll(".pill")) p.setAttribute("aria-pressed", String(p.dataset.f === filter));
    const items = [...document.querySelectorAll("#checks .item")];
    for (const it of items) {
      const e = it.dataset.e;
      const keep = !filter || e === filter || (filter === "ok" && e === "info");
      it.hidden = !keep;
      if (filter && filter !== "ok" && keep && it.tagName === "DETAILS") it.open = true;
    }
    for (const s of document.querySelectorAll("#checks section")) s.hidden = ![...s.querySelectorAll(".item")].some((i) => !i.hidden);
    const none = $("none");
    if (none) none.hidden = !filter || items.some((i) => !i.hidden);
    const names = { crit: "urgents", warn: "à faire", ok: "OK" };
    $("filterNote").hidden = !filter;
    $("filterNote").textContent = filter ? `Filtre : ${names[filter]}. Reclique sur le bouton pour tout afficher.` : "";
  }
  $("pills").addEventListener("click", (e) => { const b = e.target.closest(".pill"); if (b) { filter = filter === b.dataset.f ? null : b.dataset.f; applyFilter(); } });

  // ---- Lire etat-pc.json. Chrome peut se souvenir du fichier : ensuite un seul clic suffit ----
  const idb = (mode, fn) => new Promise((res, rej) => {
    const rq = indexedDB.open("qg-pc", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("h");
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => {
      try {
        const tx = rq.result.transaction("h", mode);
        const out = fn(tx.objectStore("h"));
        tx.oncomplete = () => res(out && out.result);
        tx.onerror = tx.onabort = () => rej(tx.error);
      } catch (e) { rej(e); }
    };
  });
  const getHandle = () => idb("readonly", (s) => s.get("file")).catch(() => null);
  const setHandle = (h) => idb("readwrite", (s) => s.put(h, "file")).catch(() => {});

  function pickWithInput() {
    return new Promise((resolve) => {
      const inp = $("fileIn");
      inp.value = "";
      inp.onchange = () => resolve(inp.files[0] || null);
      inp.click();
    });
  }
  async function pickFile() {
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({ id: "etat-pc", startIn: "documents", types: [{ description: "Bilan du PC (etat-pc.json)", accept: { "application/json": [".json"] } }] });
        await setHandle(h);
        return await h.getFile();
      } catch (e) {
        if (e && e.name === "AbortError") return null;
      }
    }
    return pickWithInput();
  }
  async function rememberedFile() {
    const h = await getHandle();
    if (!h || !h.getFile) return null;
    try {
      let p = h.queryPermission ? await h.queryPermission({ mode: "read" }) : "granted";
      if (p !== "granted" && h.requestPermission) p = await h.requestPermission({ mode: "read" });
      return p === "granted" ? await h.getFile() : null;
    } catch (e) { return null; }
  }

  async function readReport(file) {
    if (!file) return;
    if (file.size > 3e6) { toast("Fichier trop gros : ce n'est pas un bilan"); return; }
    let raw;
    try { raw = JSON.parse((await file.text()).replace(/^﻿/, "")); } catch (e) { toast("Ce fichier n'est pas lisible : choisis etat-pc.json"); return; }
    const r = clean(raw);
    if (!r) { toast("Ce n'est pas un bilan Etat-PC : choisis Documents\\Etat PC\\etat-pc.json"); return; }
    const same = report && report.date === r.date;
    report = r;
    save();
    filter = null;
    render();
    toast(same ? "Déjà à jour : relance Etat-PC.bat pour un nouveau bilan" : "Bilan mis à jour");
  }

  $("loadBtn").addEventListener("click", async () => readReport((await rememberedFile()) || (await pickFile())));
  $("pickBtn").addEventListener("click", async () => readReport(await pickFile()));

  // ---- Tour 3D, chargée seulement à la demande (elle est lourde) ----
  $("tourBtn").addEventListener("click", () => {
    const t = $("tour");
    if (!t.querySelector("iframe")) {
      const f = document.createElement("iframe");
      f.src = "tour-3d.html";
      f.title = "Ma tour en 3D";
      t.append(f);
    }
    t.hidden = false;
    $("tourBtn").hidden = true;
    t.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("tourClose").addEventListener("click", () => { $("tour").hidden = true; $("tourBtn").hidden = false; });

  window.addEventListener("storage", (e) => { if (e.key === KEY || e.key === null) { load(); render(); } });
  load();
  render();
})();
