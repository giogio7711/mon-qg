// Mon QG : synchro entre appareils.
// Les pages continuent d'enregistrer dans le navigateur (localStorage) ; le tableau de bord recopie chaque
// changement dans Firebase (Firestore, un document par clé) et applique ceux des autres appareils.
// Chaque compte Google n'accède qu'à ses propres données (règles Firestore : users/{uid}/…).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-BJd8PNoXp5cbGyzj-9ypVrx3PvI1Km8",
  authDomain: "monqg-3d90a.firebaseapp.com",
  projectId: "monqg-3d90a",
  storageBucket: "monqg-3d90a.firebasestorage.app",
  messagingSenderId: "75291919425",
  appId: "1:75291919425:web:1534541d685d6be4f8b2c0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Réglages propres à chaque appareil (onglet ouvert, filtres, caches) : jamais synchronisés
const LOCAL_ONLY = new Set(["qg-tab", "mtq-filter", "mtq-sort", "qg-games-filter", "qg-games-sort", "qg-streams-view",
  "qg-live", "qg-backup", "mtq-backup", "qg-sync-meta", "qg-device"]);
// Seulement des noms de clés connus de forme (mtq-xxx, qg-xxx) : rien d'autre n'est écrit dans le navigateur
const synced = (k) => typeof k === "string" && /^(mtq|qg)-[a-z0-9-]{1,40}$/.test(k) && !LOCAL_ONLY.has(k);
const MAX = 900000;   // un document Firestore fait 1 Mo au plus

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? f; } catch (e) { return f; } };
let meta = read("qg-sync-meta", {});           // clé -> date de la dernière version connue ici
const saveMeta = () => { try { localStorage.setItem("qg-sync-meta", JSON.stringify(meta)); } catch (e) {} };
let device = localStorage.getItem("qg-device");
if (!device) { device = Math.random().toString(36).slice(2, 10); try { localStorage.setItem("qg-device", device); } catch (e) {} }

let uid = null;
let unsub = null;
const timers = {};
const $ = (id) => document.getElementById(id);

function setStatus(text, bad) {
  const el = $("syncState");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("bad", !!bad);
}

async function push(key) {
  if (!uid) return;
  const v = localStorage.getItem(key);
  if (v && v.length > MAX) { console.warn("Mon QG : trop gros pour la synchro", key); return; }
  try {
    await setDoc(doc(db, "users", uid, "kv", key), { v: v ?? null, t: meta[key] || Date.now(), by: device });
    pushShare(key, v);
    setStatus("Synchronisé");
  } catch (e) {
    console.warn("Mon QG : envoi impossible", key, e);
    setStatus("Hors ligne : la synchro reprendra", true);
  }
}

// Un changement fait sur cet appareil : on le date et on l'envoie (regroupé si plusieurs à la suite)
function changed(key) {
  if (!synced(key)) return;
  meta[key] = Date.now();
  saveMeta();
  clearTimeout(timers[key]);
  setStatus("Synchro…");
  timers[key] = setTimeout(() => push(key), 1200);
}

function pushAll() {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (synced(k)) changed(k);
  }
}

// Une version venue d'un autre appareil : on l'écrit ici ; les pages ouvertes l'apprennent par l'évènement « storage »
function apply(key, data) {
  // Document mal formé (valeur qui n'est pas du texte, date absente) : ignoré
  if (!data || typeof data.t !== "number" || !(data.v == null || (typeof data.v === "string" && data.v.length <= MAX))) return;
  if (data.v == null) localStorage.removeItem(key);
  else localStorage.setItem(key, data.v);
  meta[key] = data.t;
  saveMeta();
}

async function start(user) {
  uid = user.uid;
  setStatus("Synchro…");
  const cloud = {};
  try {
    const snap = await getDocs(collection(db, "users", uid, "kv"));
    snap.forEach((d) => (cloud[d.id] = d.data()));
  } catch (e) {
    console.warn("Mon QG : lecture impossible", e);
    setStatus("Hors ligne : affichage des données de cet appareil", true);
  }
  // La version la plus récente gagne, clé par clé
  for (const [k, c] of Object.entries(cloud)) {
    if (!synced(k) || typeof c?.t !== "number") continue;
    const mine = meta[k] || 0;
    if (c.t > mine) apply(k, c);
    else if (mine > c.t) push(k);
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (synced(k) && !cloud[k] && localStorage.getItem(k) != null) { meta[k] = meta[k] || Date.now(); push(k); }
  }
  saveMeta();
  // En direct : les changements des autres appareils
  unsub = onSnapshot(collection(db, "users", uid, "kv"), (snap) => {
    let any = false;
    for (const ch of snap.docChanges()) {
      if (ch.type === "removed") continue;
      const c = ch.doc.data();
      if (!synced(ch.doc.id) || c.by === device || !(c.t > (meta[ch.doc.id] || 0))) continue;
      apply(ch.doc.id, c);
      any = true;
    }
    if (any) window.dispatchEvent(new CustomEvent("qg-remote"));
    if (!snap.metadata.fromCache) setStatus("Synchronisé");
  }, (e) => { console.warn("Mon QG : écoute coupée", e); setStatus("Synchro coupée : recharge la page", true); });
  setStatus("Synchronisé");
}

// Les pages (dans les cadres) écrivent dans le navigateur : on l'apprend ici et on envoie
window.addEventListener("storage", (e) => {
  if (!uid) return;
  if (e.key === null) pushAll();
  else changed(e.key);
});

async function login() {
  const err = $("loginErr");
  if (err) err.hidden = true;
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment" || e.code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, provider);
    } else if (e.code !== "auth/popup-closed-by-user" && err) {
      err.textContent = e.code === "auth/unauthorized-domain"
        ? "Ce site n'est pas autorisé dans Firebase : ajoute son adresse dans Authentication → Paramètres → Domaines autorisés."
        : "Connexion impossible (" + (e.code || e.message) + "). Réessaie.";
      err.hidden = false;
    }
  }
}

async function logout() {
  if (unsub) unsub();
  await signOut(auth);
  // On efface les données de cet appareil : elles restent dans ton compte et reviendront à la prochaine connexion
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^(mtq-|qg-)/.test(k) && k !== "qg-device") keys.push(k); }
  try { sessionStorage.clear(); } catch (e) {}
  keys.forEach((k) => localStorage.removeItem(k));
  location.reload();
}

/* ---------- Partage en lecture seule ----------
   shares/{id}            : { owner, tabs, cles, name, t }  — lisible par qui a le lien (id de 32 caractères au hasard)
   shares/{id}/kv/{clé}   : { v }                           — seulement les clés des onglets choisis
   Le réglage (id + onglets) est dans la clé synchronisée « qg-share » : ton téléphone publie aussi ses changements. */
const SHARE_KEYS = {
  mangas: ["mtq-series", "mtq-releases", "mtq-news", "mtq-covers", "mtq-covers2"],
  jeux: ["qg-games"],
  streams: ["qg-streams", "qg-live"],
  pc: ["qg-pc"]
};
const cleanTabs = (t) => (Array.isArray(t) ? Object.keys(SHARE_KEYS).filter((k) => t.includes(k)) : []);
const keysFor = (tabs) => cleanTabs(tabs).flatMap((t) => SHARE_KEYS[t]);
const shareCfg = () => { const s = read("qg-share", null); return s && /^[a-f0-9]{32}$/.test(s.id) && cleanTabs(s.tabs).length ? { id: s.id, tabs: cleanTabs(s.tabs) } : null; };
let myName = "";

async function pushShare(key, v) {
  const s = shareCfg();
  if (!uid || !s || !keysFor(s.tabs).includes(key) || (v && v.length > MAX)) return;
  try { await setDoc(doc(db, "shares", s.id, "kv", key), { v: v ?? null }); }
  catch (e) { console.warn("Mon QG : partage non mis à jour", key, e); }
}

function newId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function shareSave(tabs, fresh) {
  if (!uid) throw new Error("Connecte-toi d'abord");
  tabs = cleanTabs(tabs);
  if (!tabs.length) throw new Error("Coche au moins un onglet");
  const old = shareCfg();
  if (old && fresh) await shareStop();
  const id = old && !fresh ? old.id : newId();
  const cles = keysFor(tabs);
  // Les clés retirées du partage sont effacées avant de mettre la liste à jour
  if (old && !fresh) for (const k of keysFor(old.tabs)) if (!cles.includes(k)) await deleteDoc(doc(db, "shares", id, "kv", k)).catch(() => {});
  await setDoc(doc(db, "shares", id), { owner: uid, tabs, cles, name: myName, t: Date.now() });
  for (const k of cles) {
    const v = localStorage.getItem(k);
    if (v != null && v.length <= MAX) await setDoc(doc(db, "shares", id, "kv", k), { v });
  }
  localStorage.setItem("qg-share", JSON.stringify({ id, tabs }));
  changed("qg-share");
  return id;
}

async function shareStop() {
  const s = shareCfg();
  if (!uid || !s) return;
  // D'abord les données (les règles vérifient le propriétaire sur la fiche du partage), puis la fiche
  for (const k of Object.values(SHARE_KEYS).flat()) await deleteDoc(doc(db, "shares", s.id, "kv", k)).catch(() => {});
  await deleteDoc(doc(db, "shares", s.id));
  localStorage.removeItem("qg-share");
  changed("qg-share");
}

window.qgSync = { pushAll, changed, logout, share: { get: shareCfg, save: shareSave, stop: shareStop } };

/* ---------- Mode visite : on lit le partage, sans compte ---------- */
async function startView(view) {
  const fail = (msg) => { setStatus(msg, true); window.qgViewFail?.(msg); };
  if (!view.ok) return fail("Ce navigateur ne permet pas d'ouvrir le partage");
  setStatus("Chargement…");
  let m;
  try { m = await getDoc(doc(db, "shares", view.id)); }
  catch (e) { console.warn("Mon QG : partage illisible", e); return fail("Partage inaccessible pour l'instant"); }
  if (!m.exists()) return fail("Ce lien de partage n'existe plus");
  const d = m.data() || {};
  view.tabs = cleanTabs(d.tabs);
  view.name = typeof d.name === "string" ? d.name.slice(0, 40) : "";
  const cles = keysFor(view.tabs);
  const ok = (v) => typeof v === "string" && v.length <= MAX;
  await Promise.all(cles.map((k) => getDoc(doc(db, "shares", view.id, "kv", k))
    .then((s) => { const v = s.data()?.v; if (ok(v)) view.fill(k, v, true); }).catch(() => {})));
  setStatus("En direct");
  window.qgBootDone?.();
  // En direct : les changements du propriétaire arrivent tout seuls
  for (const k of cles) {
    onSnapshot(doc(db, "shares", view.id, "kv", k), (s) => {
      const v = s.data()?.v;
      if (ok(v) && v !== view.mem.getItem(k)) view.fill(k, v);
    }, () => {});
  }
  onSnapshot(doc(db, "shares", view.id), (s) => {
    if (!s.exists()) return fail("Le partage a été arrêté");
    if (cleanTabs(s.data()?.tabs).join() !== view.tabs.join()) location.reload();   // onglets partagés changés
  }, () => {});
}

const view = window.qgView;
if (view) startView(view);
else {
$("loginBtn")?.addEventListener("click", login);

getRedirectResult(auth).catch((e) => {
  const err = $("loginErr");
  if (err) { err.textContent = "Connexion impossible (" + (e.code || e.message) + "). Réessaie."; err.hidden = false; }
});

onAuthStateChanged(auth, async (user) => {
  if (user) myName = String(user.displayName || "").trim().split(/\s+/)[0].slice(0, 40);
  const gate = $("login");
  if (!user) { if (gate) gate.hidden = false; return; }
  if (gate) gate.hidden = true;
  const me = $("userBtn");
  if (me) {
    me.hidden = false;
    me.title = (user.displayName || user.email || "") + " · cliquer pour se déconnecter";
    // Construit sans HTML : la photo n'est acceptée que si c'est une adresse https
    if (/^https:\/\//.test(user.photoURL || "")) {
      const img = document.createElement("img");
      img.alt = ""; img.referrerPolicy = "no-referrer"; img.src = user.photoURL;
      me.replaceChildren(img);
    } else me.textContent = (user.displayName || "?")[0];
  }
  await start(user);
  window.qgBootDone?.();
});
}
