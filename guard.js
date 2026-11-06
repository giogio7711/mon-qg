// Mon QG : protection des pages.
// 1. Si un autre site essaie d'afficher Mon QG dans un cadre (pour te faire cliquer à ton insu), la page reste vide.
// 2. Une page d'outil ouverte seule (mangatheque.html…) renvoie vers Mon QG, qui gère la connexion et la synchro.
(() => {
  let framedByStranger = false;
  if (window.top !== window.self) {
    try { framedByStranger = window.top.location.origin !== location.origin; } catch (e) { framedByStranger = true; }
  }
  if (framedByStranger) {
    document.documentElement.style.display = "none";
    try { window.top.location = location.href; } catch (e) { /* le navigateur refuse : la page reste vide */ }
    throw new Error("Mon QG ne s'affiche pas dans le cadre d'un autre site");
  }
  const tab = document.currentScript && document.currentScript.dataset.tab;
  if (tab && /^https?:$/.test(location.protocol) && window.top === window.self) location.replace("index.html#" + tab);
})();
