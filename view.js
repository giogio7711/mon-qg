// Mon QG : mode visite (lien de partage « ?voir=… »).
// La personne qui ouvre le lien ne se connecte pas. Les données partagées sont gardées en mémoire seulement :
// rien n'est écrit dans son navigateur (ses propres données Mon QG restent intactes) ni renvoyé vers ton compte.
(() => {
  const id = new URLSearchParams(location.search).get("voir");
  if (!id || !/^[a-f0-9]{32}$/.test(id)) return;

  const data = new Map();
  const mem = {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => (data.has(String(k)) ? data.get(String(k)) : null),
    setItem: (k, v) => { data.set(String(k), String(v)); },
    removeItem: (k) => { data.delete(String(k)); },
    clear: () => data.clear()
  };
  let ok = false;
  try {
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => mem });
    ok = window.localStorage === mem;
  } catch (e) { ok = false; }

  // Prévient l'accueil et les onglets ouverts qu'une donnée a changé (comme le fait le navigateur entre onglets)
  function notify(key) {
    const wins = [window];
    for (const f of document.querySelectorAll("iframe")) { try { if (f.contentWindow) wins.push(f.contentWindow); } catch (e) {} }
    for (const w of wins) { try { w.dispatchEvent(new w.StorageEvent("storage", { key })); } catch (e) {} }
  }

  window.qgView = {
    id, ok, mem,
    tabs: [],
    name: "",
    // Une donnée partagée arrive (au chargement ou en direct)
    fill(key, value, quiet) {
      if (value == null) data.delete(key); else data.set(key, value);
      if (!quiet) notify(key);
    }
  };
  document.documentElement.classList.add("visite");
})();
