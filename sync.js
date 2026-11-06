// Mon QG : synchro entre appareils.
// Les pages continuent d'enregistrer dans le navigateur (localStorage) ; le tableau de bord recopie chaque
// changement dans Firebase (Firestore, un document par clé) et applique ceux des autres appareils.
// Chaque compte Google n'accède qu'à ses propres données (règles Firestore : users/{uid}/…).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, getDocs, onSnapshot }
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
const synced = (k) => typeof k === "string" && /^(mtq-|qg-)/.test(k) && !LOCAL_ONLY.has(k);
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
    if (!synced(k)) continue;
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
  keys.forEach((k) => localStorage.removeItem(k));
  location.reload();
}

window.qgSync = { pushAll, changed, logout };
$("loginBtn")?.addEventListener("click", login);

getRedirectResult(auth).catch((e) => {
  const err = $("loginErr");
  if (err) { err.textContent = "Connexion impossible (" + (e.code || e.message) + "). Réessaie."; err.hidden = false; }
});

onAuthStateChanged(auth, async (user) => {
  const gate = $("login");
  if (!user) { if (gate) gate.hidden = false; return; }
  if (gate) gate.hidden = true;
  const me = $("userBtn");
  if (me) {
    me.hidden = false;
    me.title = (user.displayName || user.email || "") + " · cliquer pour se déconnecter";
    me.innerHTML = user.photoURL ? `<img src="${user.photoURL.replace(/"/g, "")}" alt="" referrerpolicy="no-referrer">` : (user.displayName || "?")[0];
  }
  await start(user);
  window.qgBootDone?.();
});
