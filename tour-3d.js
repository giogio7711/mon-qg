// Ma tour en 3D : données des composants et scène (bibliothèque Three.js dans tour-3d-lib.js)

/* ---------- Données ---------- */
const Y=t=>['y',t],N=t=>['n',t],W=t=>['w',t];
const PARTS={
 case:{num:1,cat:"Boîtier",name:"Corsair Crystal 570X RGB",spec:"Moyen tour ATX · 4 vitres trempées · carte graphique 370 mm max",st:"ok",
  ups:[{n:"Garder le 570X",p:"0 €",d:"Il accepte toutes les cartes graphiques que ton alim peut alimenter.",c:[Y("GPU ≤ 370 mm"),Y("ATX")],best:1},
       {n:"Boîtier à façade mesh",p:"prix à vérifier",d:"Meilleur flux d'air que la façade vitrée. Utile seulement si les températures montent avec une nouvelle carte graphique.",c:[Y("ATX"),W("Tout remonter")],no:1}]},
 mobo:{num:2,cat:"Carte mère",name:"ASUS TUF GAMING B760-PLUS WIFI D4",spec:"LGA1700 · 4 × DDR4 · PCIe 5.0 x16 · 3 × M.2 PCIe 4.0 · Wi-Fi 6 · BIOS 1663 (08/2024)",st:"ok",
  ups:[{n:"Garder la carte mère",p:"0 €",d:"Elle supporte toutes les améliorations conseillées : PCIe 5.0, 3 slots NVMe libres, 2 slots RAM libres.",c:[Y("PCIe 5.0 x16"),Y("3 × M.2 libres")],best:1},
       {n:"Mettre à jour le BIOS (plus tard)",p:"gratuit",d:"Ton BIOS 1663 (août 2024) suffit, y compris pour une RTX 5060. Mets-le à jour seulement avant de passer à un Core de 14e génération : ces puces Raptor Lake ont besoin du microcode 0x12B ou plus.",c:[Y("Via EZ Flash"),W("Avant un CPU 14e gén.")]},
       {n:"Changer de plateforme (DDR5)",p:"carte mère + CPU + RAM",d:"Il faudrait tout racheter avec une DDR5 hors de prix en 2026.",c:[N("DDR5 obligatoire"),W("Fixation AIO")],no:1}]},
 cpu:{num:3,cat:"Processeur",name:"Intel Core i5-13400F",spec:"10 cœurs (6P + 4E) / 16 threads · 4,6 GHz · sans iGPU · puce Alder Lake (microcode 0x35), non concernée par l'instabilité des 13e/14e gén.",st:"ok",
  ups:[{n:"Garder l'i5-13400F",p:"0 €",d:"Suffisant pour une carte graphique de niveau RX 9070 / RTX 5070 en 1440p.",c:[Y("Pas de goulot en 1440p")],best:1},
       {n:"Intel Core i7-14700F",p:"dès ~350 €",d:"20 cœurs / 28 threads : gros gain en montage, rendu et multitâche, gain modéré en jeu.",c:[Y("LGA1700"),Y("Alim 650 W"),Y("AIO 240 OK"),W("BIOS à mettre à jour")]},
       {n:"Intel Core i5-14600KF",p:"prix à vérifier",d:"14 cœurs / 20 threads, meilleur à haut FPS. Le « K » est inutile sur une B760.",c:[Y("LGA1700"),Y("Alim 650 W"),W("BIOS à mettre à jour")]}]},
 aio:{num:4,cat:"Watercooling AIO",name:"Corsair H100i Platinum · 240 mm",spec:"Radiateur 240 mm sur le dessus · 2 ventilateurs 120 mm RGB · piloté par iCUE",st:"ok",
  ups:[{n:"Régler les courbes dans iCUE",p:"gratuit",d:"Base la vitesse des ventilateurs sur la température du liquide : plus silencieux au quotidien.",c:[Y("iCUE")],best:1},
       {n:"Garder l'AIO",p:"0 €",d:"Il suffit pour l'i5 actuel comme pour un i7-14700F. Surveille les bruits de pompe : il date de 2018 environ.",c:[Y("LGA1700"),Y("i7-14700F")]},
       {n:"AIO 360 mm en façade",p:"prix à vérifier",d:"Plus de silence sous forte charge, utile seulement avec un i7.",c:[W("Façade uniquement"),N("Remplace les 3 ventilos façade")],no:1}]},
 ram:{num:5,cat:"Mémoire vive",name:"Corsair Vengeance RGB Pro SL · 2 × 16 Go",spec:"DDR4-3600 CL18-22-22-42 · XMP actif · double canal (A2 + B2), vérifié avec CPU-Z",st:"ok",
  ups:[{n:"Garder la configuration actuelle",p:"0 €",d:"32 Go en double canal à 3600 MT/s : c'est la configuration optimale pour ta carte mère. Rien à changer pour jouer.",c:[Y("Double canal"),Y("XMP actif")],best:1},
       {n:"Passer à 64 Go (2e kit identique)",p:"cher en 2026",d:"Seulement pour des VM ou du montage 4K lourd. 32 Go suffisent pour jouer.",c:[Y("DDR4"),W("Peut redescendre à 3200"),N("Prix gonflés")],no:1}]},
 gpu:{num:6,cat:"Carte graphique",name:"Gigabyte GeForce RTX 2060 · 6 Go",spec:"6 Go GDDR6 · sortie en 2019 · slot PCIe 5.0 x16",st:"prio",badge:"Plus gros gain",
  note:"C'est le maillon faible : 6 Go de mémoire vidéo, c'est juste pour les jeux récents. Limites de ta config : 250 W maximum (alim 650 W) et 370 mm de long (boîtier).",
  ups:[{n:"NVIDIA RTX 5060 · 8 Go",p:"dès ~418 €",d:"Le choix dans ton budget d'environ 400 € : environ +70 à 80 % par rapport à ta RTX 2060, avec le DLSS 4 et la génération d'images. Neuve et garantie.",c:[Y("~145 W"),Y("Alim 650 W OK"),Y("Cartes courtes"),W("8 Go de VRAM")],best:1},
       {n:"AMD Radeon RX 9070 · 16 Go",p:"dès ~750 €",d:"Meilleur rapport performances/prix entre 600 et 1 000 €. Environ 2,5 à 3 fois une RTX 2060.",c:[Y("~220 W"),Y("Alim 650 W OK"),W("Longueur ≤ 370 mm")]},
       {n:"NVIDIA RTX 5070 · 12 Go",p:"dès ~880 €",d:"Proche de la RX 9070, avec le DLSS 4 et NVENC. Plus chère, et seulement 12 Go.",c:[Y("250 W"),Y("Alim 650 W OK"),Y("Adaptateur fourni")]},
       {n:"NVIDIA RTX 5060 Ti · 16 Go",p:"dès ~650 €",d:"Environ 2 fois une RTX 2060, consomme peu. Le choix économique.",c:[Y("~180 W"),Y("Cartes courtes")]},
       {n:"AMD Radeon RX 9070 GRE · 12 Go",p:"dès ~630 €",d:"Un cran sous la RX 9070, l'entrée la moins chère à ce niveau.",c:[Y("Alim 650 W OK")]},
       {n:"RX 9070 XT / RTX 5070 Ti et plus",p:"dès ~910 €",d:"Plus puissantes, mais elles demandent une alim de 750 W.",c:[N("Alim trop juste")],no:1}]},
 m2:{num:7,cat:"Slots M.2 NVMe",name:"3 slots PCIe 4.0 x4 · tous libres",spec:"M.2_1 relié au processeur (avec radiateur) · M.2_2 et M.2_3 via le chipset",st:"prio",badge:"Libres",
  note:"Windows tourne sur un SSD SATA de 240 Go. Un NVMe dans le slot M.2_1 est 10 à 13 fois plus rapide.",
  ups:[{n:"WD Black SN7100 · 1 To",p:"dès ~172 €",d:"Très rapide, peu énergivore. Meilleur rapport qualité/prix du moment.",c:[Y("PCIe 4.0"),Y("2280"),Y("Slot M.2_1")],best:1},
       {n:"Samsung 990 Pro · 1 To",p:"dès ~200 €",d:"La référence en PCIe 4.0, très endurant.",c:[Y("PCIe 4.0"),Y("2280")]},
       {n:"Lexar NM790 · 1 To",p:"dès ~197 €",d:"Rapide, 1000 To d'endurance en écriture.",c:[Y("PCIe 4.0"),Y("2280")]}]},
 ssd:{num:8,cat:"SSD SATA",name:"Crucial BX500 · 240 Go",spec:"SATA ~540 Mo/s · entrée de gamme sans DRAM · derrière la carte mère",st:"warn",badge:"À remplacer",
  ups:[{n:"Le remplacer par un SSD NVMe",p:"dès ~172 €",d:"Clone Windows sur un NVMe 1 To (Macrium Reflect ou Clonezilla), ou réinstalle proprement.",c:[Y("3 slots M.2 libres")],best:1,go:"m2"},
       {n:"Le garder en disque d'appoint",p:"0 €",d:"Une fois Windows déplacé, il sert pour des fichiers ou des jeux légers.",c:[Y("SATA")]}]},
 hdd:{num:9,cat:"Disque dur",name:"WD Black 1 To (WD1003FZEX)",spec:"3,5\" · 7200 tr/min · SATA · sous le cache alim",st:"ok",
  ups:[{n:"Vérifier sa santé",p:"gratuit",d:"Lance CrystalDiskInfo : tant qu'il affiche « Bon », garde-le pour le stockage et les sauvegardes.",c:[Y("Gratuit")],best:1},
       {n:"SSD SATA 2 To pour le stockage",p:"prix à vérifier",d:"Plus rapide et silencieux, mais les SSD sont chers en 2026.",c:[Y("Port SATA libre"),N("Prix gonflés")],no:1}]},
 psu:{num:10,cat:"Alimentation",name:"Corsair TX650M · 650 W",spec:"80 Plus Gold · semi-modulaire · PCIe 6+2 broches",st:"ok",
  ups:[{n:"Garder la TX650M",p:"0 €",d:"Compatible avec une RX 9070 ou une RTX 5070 (~450 W en charge au total).",c:[Y("RX 9070"),Y("RTX 5070"),N("9070 XT / 5070 Ti")],best:1},
       {n:"Alim 750–850 W ATX 3.1",p:"prix à vérifier",d:"Seulement pour une carte graphique de 300 W ou plus. Connecteur 12V-2x6 natif.",c:[Y("≤ 225 mm dans le boîtier")],no:1}]},
 frontfans:{num:11,cat:"Ventilateurs façade",name:"3 × Corsair SP120 RGB",spec:"120 mm en entrée d'air · RGB via le contrôleur du boîtier",st:"ok",
  ups:[{n:"Les garder",p:"0 €",d:"Suffisants, avec le SP120 RGB PRO en extraction à l'arrière.",c:[Y("120 mm")],best:1},
       {n:"Ventilateurs haute pression statique",p:"prix à vérifier",d:"Plus efficaces et plus silencieux derrière une façade vitrée.",c:[Y("3 × 120 mm"),W("RGB à vérifier")],no:1}]},
 rearfan:{num:12,cat:"Ventilateur arrière",name:"Corsair iCUE SP120 RGB PRO",spec:"120 mm · 52 CFM · 8 LED RGB adressables · en extraction (CO-9050093-WW)",st:"ok",
  ups:[{n:"Le garder",p:"0 €",d:"Il évacue l'air chaud vers l'arrière. Avec l'entrée d'air en façade et le radiateur en sortie sur le dessus, le flux d'air est complet.",c:[Y("120 mm"),Y("Extraction")],best:1},
       {n:"Piloter son éclairage dans iCUE",p:"prix à vérifier",d:"Il n'apparaît pas dans iCUE : son RGB doit passer par un contrôleur Corsair (Lighting Node CORE ou Commander) branché sur un port USB interne.",c:[Y("USB 2.0 interne libre"),W("Hub Corsair requis")]}]}
};
const ORDER=["case","mobo","cpu","aio","ram","gpu","m2","ssd","hdd","psu","frontfans","rearfan"];
const STC={ok:["b-ok","OK"],warn:["b-warn","À vérifier"],prio:["b-prio","À améliorer"]};
const DOT={ok:"var(--ok)",warn:"var(--warn)",prio:"var(--accent)"};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- Panneau ---------- */
const pbody=document.getElementById('pbody'),plist=document.getElementById('plist');
let shown=null,selected='gpu',hovered=null;
ORDER.forEach(id=>{const p=PARTS[id],b=document.createElement('button');b.dataset.go=id;b.setAttribute('aria-pressed','false');b.innerHTML=`<i class="dot" style="background:${DOT[p.st]}"></i>${esc(p.cat)}`;plist.appendChild(b)});
function show(id){
  if(id===shown) return; shown=id; const p=PARTS[id]; const [cls,lab]=STC[p.st];
  pbody.innerHTML=`<div class="pc1">
   <div class="eyebrow"><span>${String(p.num).padStart(2,'0')} · ${esc(p.cat)}</span><span class="badge ${cls}">${esc(p.badge||lab)}</span></div>
   <div class="cur"><p class="cur-l">Composant actuel</p><h2>${esc(p.name)}</h2><p class="spec">${esc(p.spec)}</p></div>
   ${p.note?`<p class="note">${esc(p.note)}</p>`:''}</div><div class="pc2">
   <h3>Améliorations possibles</h3>
   <ul class="ups">${p.ups.map(u=>`<li class="up${u.best?' best':''}${u.no?' no':''}">
      ${u.best?'<span class="tagbest">Conseillé</span>':''}
      <div class="up-h"><b>${esc(u.n)}</b><span class="price">${esc(u.p)}</span></div>
      <p>${esc(u.d)}</p>
      <div class="chips">${u.c.map(([t,x])=>`<span class="chip ${t}">${t==='y'?'✓':t==='n'?'✕':'!'} ${esc(x)}</span>`).join('')}</div>
      ${u.go?`<div><button class="golink" data-go="${u.go}">Voir ${esc(PARTS[u.go].cat)} →</button></div>`:''}
   </li>`).join('')}</ul></div>`;
  plist.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.go===selected?'true':'false'));
}
document.addEventListener('click',e=>{const t=e.target.closest('[data-go]');if(t){select(t.dataset.go)}});

/* ---------- 3D ---------- */
const canvas=document.getElementById('c'),stage=canvas.parentElement,tip=document.getElementById('tip');
let select=id=>{selected=id;shown=null;show(id)};
if(!window.THREE||!THREE.OrbitControls){stage.insertAdjacentHTML('beforeend','<div class="err">Le moteur 3D n\'a pas pu se charger. Vérifie ta connexion internet puis recharge la page.</div>');show(selected);}
else init();

function init(){
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,1,700);
const HOME=new THREE.Vector3(104,60,-96),TARGET=new THREE.Vector3(0,24,0);
camera.position.copy(HOME);
const controls=new THREE.OrbitControls(camera,canvas);
controls.target.copy(TARGET);controls.enableDamping=true;controls.dampingFactor=.08;
controls.minDistance=40;controls.maxDistance=260;controls.maxPolarAngle=Math.PI*.9;
controls.autoRotate=!reduce;controls.autoRotateSpeed=.6;controls.update();

/* environnement (reflets doux, studio sombre) */
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t}
{const envScene=new THREE.Scene();
 const sky=canvasTex(512,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#3a4152');gr.addColorStop(.5,'#151820');gr.addColorStop(1,'#07080a');g.fillStyle=gr;g.fillRect(0,0,w,h);
   g.fillStyle='rgba(255,255,255,.9)';g.fillRect(70,40,120,30);g.fillRect(320,50,90,22);g.fillStyle='rgba(255,70,90,.55)';g.fillRect(200,150,160,14)});
 sky.mapping=THREE.EquirectangularReflectionMapping;
 const s=new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.MeshBasicMaterial({map:sky,side:THREE.BackSide}));envScene.add(s);
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(envScene,.02).texture;pm.dispose();}

scene.add(new THREE.HemisphereLight(0xcfd8ff,0x101016,.35));
const key=new THREE.DirectionalLight(0xffffff,1.4);key.position.set(55,95,-70);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-55,right:55,top:60,bottom:-40,near:20,far:260});key.shadow.bias=-.0004;key.shadow.radius=4;scene.add(key);
const rim=new THREE.DirectionalLight(0x9ab4ff,.55);rim.position.set(-70,50,60);scene.add(rim);
const glow=new THREE.PointLight(0xff2338,2.2,42,1.8);glow.position.set(4,26,-16);scene.add(glow);
const glow2=new THREE.PointLight(0x7a6bff,1,28,2);glow2.position.set(-2,44,8);scene.add(glow2);

const floor=new THREE.Mesh(new THREE.CircleGeometry(80,96),new THREE.MeshStandardMaterial({color:0x050608,roughness:1,metalness:0,envMapIntensity:.25}));
floor.rotation.x=-Math.PI/2;floor.position.y=-1.6;floor.receiveShadow=true;scene.add(floor);
const halo=new THREE.Mesh(new THREE.CircleGeometry(40,96),new THREE.MeshBasicMaterial({map:canvasTex(256,256,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(255,40,64,.22)');r.addColorStop(.55,'rgba(255,40,64,.05)');r.addColorStop(1,'rgba(255,40,64,0)');g.fillStyle=r;g.fillRect(0,0,w,h)}),transparent:true,depthWrite:false}));
halo.rotation.x=-Math.PI/2;halo.position.y=-1.55;scene.add(halo);

/* ---- helpers géométrie arrondie ---- */
const M=(color,o={})=>new THREE.MeshStandardMaterial(Object.assign({color,roughness:.45,metalness:.4},o));
function rrShape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.min(r,w/2,h/2);s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}
const gcache={};
function rboxGeo(w,h,d,r){const k=[w,h,d,r].join();if(gcache[k])return gcache[k];
  r=Math.max(.02,Math.min(r,w/2-.01,h/2-.01,d/2-.01));
  const g=new THREE.ExtrudeGeometry(rrShape(w-2*r,h-2*r,r*.35),{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:4,curveSegments:6});
  g.center();return gcache[k]=g}
function rb(w,h,d,r,m,x,y,z,p){const k=new THREE.Mesh(rboxGeo(w,h,d,r),m);k.position.set(x,y,z);k.castShadow=true;k.receiveShadow=true;p.add(k);return k}
function cyl(r,h,m,x,y,z,p,axis='y',seg=32){const k=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),m);k.position.set(x,y,z);if(axis==='x')k.rotation.z=Math.PI/2;if(axis==='z')k.rotation.x=Math.PI/2;k.castShadow=true;p.add(k);return k}
function decal(tex,w,h,x,y,z,ry,p,rx=0){tex.wrapS=THREE.RepeatWrapping;tex.repeat.x=-1;tex.needsUpdate=true;const k=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:.6,metalness:0}));k.position.set(x,y,z);k.rotation.set(rx,ry,0);p.add(k);return k}
function label(text,w,h,{fg='#e8eaee',font='600 64px "Saira Condensed", Arial Narrow, sans-serif',bg=null}={}){
  return canvasTex(w,h,(g)=>{if(bg){g.fillStyle=bg;g.fillRect(0,0,w,h)}g.fillStyle=fg;g.font=font;g.textAlign='center';g.textBaseline='middle';const L=text.split('\n');L.forEach((t,i)=>g.fillText(t,w/2,h/2+(i-(L.length-1)/2)*h/L.length*.85))});
}
const rainbow=canvasTex(512,8,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,0);['#ff2e4d','#ff8a00','#ffe600','#33e07a','#22c7ff','#5b5bff','#d43bff','#ff2e4d'].forEach((c,i,a)=>gr.addColorStop(i/(a.length-1),c));g.fillStyle=gr;g.fillRect(0,0,w,h)});
rainbow.wrapS=THREE.RepeatWrapping;
const rgbMat=(k=1.6)=>new THREE.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:rainbow,emissiveIntensity:k,roughness:.4});
const glowMat=(c,k=2)=>new THREE.MeshStandardMaterial({color:0x000000,emissive:c,emissiveIntensity:k,roughness:.4});

/* ventilateur : cadre arrondi percé, pales courbes, moyeu bombé, anneau lumineux */
const spinners=[];
const fanFrameGeo={};
function fanFrame(size){if(fanFrameGeo[size])return fanFrameGeo[size];const s=rrShape(size,size,size*.12);s.holes.push(new THREE.Path().absarc(0,0,size*.465,0,Math.PI*2,true));
  const g=new THREE.ExtrudeGeometry(s,{depth:2,bevelEnabled:true,bevelThickness:.18,bevelSize:.18,bevelSegments:3,curveSegments:40});g.translate(0,0,-1);return fanFrameGeo[size]=g}
function bladeGeo(R){const s=new THREE.Shape(),r0=R*.3;s.moveTo(r0,-R*.12);s.bezierCurveTo(R*.55,-R*.3,R*.85,-R*.26,R*.93,-R*.05);s.bezierCurveTo(R*.95,R*.12,R*.8,R*.24,R*.7,R*.26);s.bezierCurveTo(R*.55,R*.12,R*.4,R*.1,r0,R*.14);s.lineTo(r0,-R*.12);
  return new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:1,curveSegments:12})}
function fan(size,ring,{frame=true,frameColor=0x15171c,bladeColor=0x1c1f26,blades=7,axis='z',hubLed=null}={}){
  const g=new THREE.Group(),R=size*.46;
  if(frame){const f=new THREE.Mesh(fanFrame(size),M(frameColor,{roughness:.6,metalness:.2}));f.castShadow=true;g.add(f);
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>{const st=new THREE.Mesh(new THREE.BoxGeometry(size*.5,.35,.35),M(frameColor));st.position.set(a*size*.28,b*size*.28,-.75);st.rotation.z=a*b>0?Math.PI/4:-Math.PI/4;g.add(st)})}
  else{const sh=new THREE.Mesh(new THREE.TorusGeometry(R*1.02,.28,10,64),M(frameColor,{roughness:.5}));g.add(sh)}
  const rot=new THREE.Group();g.add(rot);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(R*.3,R*.32,1.4,40),M(0x22252c,{roughness:.35,metalness:.5}));hub.rotation.x=Math.PI/2;rot.add(hub);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(R*.3,32,12,0,Math.PI*2,0,Math.PI/2),hubLed||M(0x2a2e36,{roughness:.25,metalness:.6}));dome.rotation.x=Math.PI/2;dome.scale.set(1,.35,1);dome.position.z=.7;rot.add(dome);
  const bm=M(bladeColor,{roughness:.55,metalness:.1,transparent:true,opacity:.95}),bg=bladeGeo(R);
  for(let i=0;i<blades;i++){const piv=new THREE.Group();piv.rotation.z=i/blades*Math.PI*2;const b=new THREE.Mesh(bg,bm);b.rotation.x=-.42;b.castShadow=true;piv.add(b);rot.add(piv)}
  if(ring){const r=new THREE.Mesh(new THREE.TorusGeometry(R*.985,size*.018,10,80),ring);r.position.z=.95;g.add(r);const r2=r.clone();r2.position.z=-.95;g.add(r2)}
  spinners.push(rot);
  if(axis==='y')g.rotation.x=Math.PI/2;if(axis==='x')g.rotation.y=Math.PI/2;
  return g;
}

/* ---- parts ---- */
const root=new THREE.Group();scene.add(root);
const P={};const pickables=[];const noPick=new Set();
function part(id,explode){const g=new THREE.Group();g.userData.id=id;root.add(g);P[id]={g,ex:new THREE.Vector3(...explode)};return g}

/* 1 · Boîtier */
const Wc=23.4,Hc=51.2,Dc=48,hx=Wc/2,hz=Dc/2;
const gc=part('case',[0,0,0]);
const frameM=M(0x101115,{roughness:.32,metalness:.75});
[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>rb(1.7,Hc-2.4,1.7,.75,frameM,sx*(hx-.85),Hc/2,sz*(hz-.85),gc));
rb(Wc+.6,2,Dc+.6,.9,frameM,0,1,0,gc);
rb(Wc+.6,2,Dc+.6,.9,frameM,0,Hc-1,0,gc);
const trayM=M(0x16171c,{roughness:.55,metalness:.5});
rb(.4,Hc-4,Dc-3.4,.15,trayM,-10.7,Hc/2,0,gc);
rb(Wc-3.2,Hc-4,.3,.12,trayM,0,Hc/2,-hz+.6,gc);
const slotM=M(0x2b2e35,{metalness:.8,roughness:.3});for(let i=0;i<7;i++)rb(10.5,.95,.25,.1,slotM,-3.8,28.6-i*2,-hz+.45,gc);
const feetM=M(0x0b0c0f,{roughness:.8,metalness:.1});[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz])=>{const f=cyl(1.8,1.4,feetM,sx*(hx-3.2),-.7,sz*(hz-4.2),gc);});
rb(9.5,.5,4.4,.22,M(0x0c0d10,{roughness:.4}),3,Hc+.2,hz-4.6,gc);
cyl(.55,.4,glowMat(0x3b82ff,3),6.6,Hc+.5,hz-4.6,gc);
cyl(.35,.4,M(0x1a1b20),4.5,Hc+.5,hz-4.6,gc);
[0,1].forEach(i=>rb(1.4,.3,.6,.1,M(0x1f3a7a),.2-i*2.2,Hc+.5,hz-4.6,gc));
// vitres (déco, non sélectionnables)
const glassG=new THREE.Group();scene.add(glassG);
const hexTex=canvasTex(480,416,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='rgba(16,16,20,.34)';g.fillRect(0,0,w,h);g.strokeStyle='rgba(212,24,44,.95)';g.lineWidth=6;g.lineJoin='round';const r=40,hh=Math.sqrt(3)*r;
  for(let col=-1;col<=9;col++)for(let row=-1;row<=4;row++){const cx=col*r*1.5,cy=row*hh+(col%2?hh/2:0);g.beginPath();for(let k=0;k<6;k++){const a=Math.PI/3*k;g.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a))}g.closePath();g.stroke()}});
hexTex.wrapS=hexTex.wrapT=THREE.RepeatWrapping;hexTex.repeat.set(1/16,1/13.9);
function glassPanel(w,h,mat,pos,rot){const geo=new THREE.ExtrudeGeometry(rrShape(w,h,1.4),{depth:.35,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:2,curveSegments:8});geo.translate(0,0,-.175);const k=new THREE.Mesh(geo,mat);k.position.set(...pos);k.rotation.set(...rot);k.renderOrder=2;glassG.add(k);return k}
const smoke=new THREE.MeshStandardMaterial({color:0x1d2029,transparent:true,opacity:.18,roughness:.04,metalness:.1,envMapIntensity:1.6,depthWrite:false});
const hexM=new THREE.MeshStandardMaterial({map:hexTex,transparent:true,roughness:.06,metalness:.1,envMapIntensity:1.4,depthWrite:false});
glassPanel(Dc-1.2,Hc-1.4,smoke,[hx+.45,Hc/2,0],[0,Math.PI/2,0]);
glassPanel(Dc-1.2,Hc-1.4,smoke,[-hx-.45,Hc/2,0],[0,Math.PI/2,0]);
glassPanel(Wc+.4,Hc+.2,hexM,[0,Hc/2,hz+1.2],[0,0,0]);
glassPanel(Wc+.4,Dc+.4,hexM,[0,Hc+1.25,0],[-Math.PI/2,0,0]);
const screwM=M(0xcf1630,{roughness:.28,metalness:.7});
function screw(x,y,z,axis){const s=new THREE.Group();const head=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.7,28),screwM);const post=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,1,16),screwM);post.position.y=-.6;s.add(head,post);s.position.set(x,y,z);if(axis==='z')s.rotation.x=Math.PI/2;if(axis==='x')s.rotation.z=x>0?-Math.PI/2:Math.PI/2;if(axis==='y'){}glassG.add(s)}
[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>{screw(a*(hx-1.8),Hc/2+b*(Hc/2-2.2),hz+1.75,'z');screw(a*(hx-1.8),Hc+1.8,b*(hz-2.2),'y');screw(hx+.95,Hc/2+a*(Hc/2-2.6),b*(hz-2.6),'x');screw(-hx-.95,Hc/2+a*(Hc/2-2.6),b*(hz-2.6),'x')});
// cache alim (déco)
const shroudM=M(0x15161b,{roughness:.5,metalness:.55});
const shTop=rb(Wc-3.4,.4,42.6,.18,shroudM,-.2,10.7,-1.8,scene);
const shSide=rb(.4,10.4,42.6,.18,new THREE.MeshStandardMaterial({color:0x4a0f18,transparent:true,opacity:.5,roughness:.35,metalness:.3,depthWrite:false}),hx-1.9,5.5,-1.8,scene);
const cl=decal(label('CORSAIR',512,80,{fg:'#f2f2f2',font:'600 60px "Saira Condensed", Arial Narrow, sans-serif'}),11,1.7,hx-1.65,5.5,8,Math.PI/2,scene);
[shTop,shSide,cl].forEach(m=>noPick.add(m));

/* 2 · Carte mère */
const gm=part('mobo',[0,0,0]);
const pcbTex=canvasTex(512,640,(g,w,h)=>{g.fillStyle='#17191d';g.fillRect(0,0,w,h);g.strokeStyle='rgba(120,128,140,.16)';g.lineWidth=2;for(let i=0;i<60;i++){g.beginPath();const x=Math.random()*w,y=Math.random()*h;g.moveTo(x,y);g.lineTo(x+(Math.random()-.5)*160,y);g.lineTo(x+(Math.random()-.5)*160,y+(Math.random()-.5)*160);g.stroke()}
  g.strokeStyle='rgba(241,194,50,.5)';g.lineWidth=5;g.beginPath();g.moveTo(40,600);g.lineTo(200,600);g.lineTo(240,560);g.stroke();g.beginPath();g.moveTo(470,120);g.lineTo(470,300);g.stroke()});
const pcb=rb(.22,30.5,24.4,.08,new THREE.MeshStandardMaterial({color:0xffffff,map:pcbTex,roughness:.6,metalness:.25}),-10.4,33.25,-10.3,gm);
pcb.geometry=new THREE.BoxGeometry(.22,30.5,24.4);
// sur BoxGeometry, la face +x reçoit la texture
const hsM=M(0x55595f,{roughness:.3,metalness:.9}),hsD=M(0x2a2d33,{roughness:.35,metalness:.8});
const vrm1=rb(2.4,2.8,11,.5,hsM,-9.15,46.3,-13.2,gm);
for(let i=0;i<6;i++)rb(.5,2.9,.35,.12,hsD,-8.05,46.3,-17.6+i*1.75,gm);
const vrm2=rb(2.4,10,2.8,.5,hsM,-9.15,39.5,-17.4,gm);
rb(3.4,11.5,3.8,.7,hsD,-8.75,41.5,-20.6,gm);
decal(label('TUF',256,80,{fg:'#f1c232',font:'800 64px "Saira Condensed", Arial Narrow, sans-serif'}),2.6,.8,-7.04,44.5,-20.6,Math.PI/2,gm);
for(let i=0;i<4;i++)rb(.08,9,.12,.03,M(0xf1c232,{emissive:0x5a4510,emissiveIntensity:.4}),-7.03,40.5,-21.9+i*.9,gm);
rb(1.2,7,7,.9,hsM,-9.75,21.2,-4,gm);
decal(label('TUF GAMING',512,110,{fg:'#f1c232',font:'700 80px "Saira Condensed", Arial Narrow, sans-serif'}),5.2,1.1,-9.12,21.6,-4,Math.PI/2,gm);
decal(label('B760',256,80,{fg:'#c8ccd3',font:'600 56px "IBM Plex Mono", monospace'}),2.4,.75,-9.12,20.2,-4,Math.PI/2,gm);
rb(.45,5.8,5.8,.2,M(0x2c2f35,{metalness:.85,roughness:.3}),-10.12,40,-12.5,gm);
const dimmM=M(0x2b2e35,{roughness:.45,metalness:.3});[-7.2,-6.2,-5,-4].forEach(z=>rb(.9,13.6,.55,.2,dimmM,-9.85,40.5,z,gm));
const pciM=M(0x2f3239,{roughness:.45,metalness:.3}),pciS=M(0xb7bcc4,{roughness:.25,metalness:.95});
rb(.95,.85,9,.25,pciS,-9.85,30,-17.5,gm);rb(.95,.85,9,.25,pciM,-9.85,22.3,-17.5,gm);rb(.95,.65,3,.2,pciM,-9.85,26.2,-20.5,gm);rb(.95,.65,3,.2,pciM,-9.85,18.9,-20.5,gm);
const capM=M(0x2a2d33,{roughness:.3,metalness:.8});for(let i=0;i<6;i++)cyl(.32,.9,capM,-9.85,43.2,-16.5+i*.9,gm,'x',16);
rb(.9,2.2,2.2,.3,M(0x1c1e23),-9.8,20,-20.4,gm);
rb(1,1.2,5,.3,hsD,-9.8,20.4,-.3,gm);

/* 3 · CPU */
const gcpu=part('cpu',[10,3,0]);
rb(.22,4.5,3.75,.06,M(0x1d6a3c,{roughness:.6,metalness:.2}),-9.85,40,-12.5,gcpu);
rb(.5,3.9,3.3,.18,M(0xc4c8cf,{roughness:.2,metalness:1}),-9.55,40,-12.5,gcpu);
decal(label('intel\nCORE i5 13400F',256,128,{fg:'#20232a',font:'600 34px "IBM Plex Sans", Arial, sans-serif'}),2.8,1.4,-9.28,40,-12.5,Math.PI/2,gcpu);

/* 4 · AIO */
const ga=part('aio',[17,9,0]);
rb(3,6.8,6.8,1.6,M(0x8f949c,{roughness:.18,metalness:1}),-7.75,40,-12.5,ga);
const capG=new THREE.Mesh(new THREE.CylinderGeometry(2.7,2.85,.5,64),M(0x07080a,{roughness:.05,metalness:.4,envMapIntensity:2}));capG.rotation.z=Math.PI/2;capG.position.set(-6.1,40,-12.5);ga.add(capG);
const pr=new THREE.Mesh(new THREE.TorusGeometry(2.62,.2,12,72),rgbMat(2));pr.rotation.y=Math.PI/2;pr.position.set(-5.86,40,-12.5);ga.add(pr);
decal(label('CORSAIR',256,64,{fg:'#e9e9e9',font:'600 44px "Saira Condensed", Arial Narrow, sans-serif'}),2.8,.7,-5.82,39.6,-12.5,Math.PI/2,ga);
for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.BoxGeometry(.05,.18,.9-i*.18),glowMat(0xffffff,2.5));l.position.set(-5.82,40.6+i*.22,-12.5);ga.add(l)}
const radM=M(0x111216,{roughness:.55,metalness:.6});
rb(12,2.8,24.6,.5,radM,.5,49.6,-4.2,ga);
const finTex=canvasTex(512,64,(g,w,h)=>{g.fillStyle='#16171c';g.fillRect(0,0,w,h);g.fillStyle='#2b2d33';for(let x=0;x<w;x+=6)g.fillRect(x,0,2,h)});
decal(finTex,24,2.2,6.52,49.6,-4.2,Math.PI/2,ga);
rb(12.6,3.2,2,.8,M(0x1b1c21,{roughness:.4,metalness:.6}),.5,49.6,-17.6,ga);
rb(12.6,3.2,1.4,.6,M(0x1b1c21,{roughness:.4,metalness:.6}),.5,49.6,9.2,ga);
[-10,2].forEach(z=>{const f=fan(12,rgbMat(1.7),{axis:'y',blades:9,hubLed:rgbMat(.8)});f.position.set(.5,47,z);ga.add(f)});
const tubeM=M(0x0b0c0f,{roughness:.9,metalness:0});
const fitM=M(0x1e2026,{roughness:.3,metalness:.9});
[[-11.2,-1.6],[-13.8,2.6]].forEach(([z0,x1])=>{const c=new THREE.CatmullRomCurve3([new THREE.Vector3(-6.4,43.4,z0),new THREE.Vector3(-4.6,46.6,z0-2.6),new THREE.Vector3(x1,48.4,-16.2),new THREE.Vector3(x1,48.6,-17.6)]);const t=new THREE.Mesh(new THREE.TubeGeometry(c,48,.55,14),tubeM);t.castShadow=true;ga.add(t);cyl(.75,1,fitM,x1,48.6,-18.1,ga,'z',20)});

/* 5 · RAM */
const gr=part('ram',[14,7,0]);
const ramM=M(0x0f1013,{roughness:.32,metalness:.75}),ramD=new THREE.MeshStandardMaterial({color:0xd0d4da,roughness:.25,metalness:1});
const vgTex=label('VENGEANCE',512,64,{fg:'#c9cdd4',font:'600 52px "Saira Condensed", Arial Narrow, sans-serif'});
[-6.2,-4].forEach(z=>{rb(4,13.3,.7,.22,ramM,-7.6,40.5,z,gr);const lb=new THREE.Mesh(rboxGeo(.9,13.3,.86,.3),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveMap:rainbow,emissiveIntensity:1.6,transparent:true,opacity:.92,roughness:.3}));lb.position.set(-5.2,40.5,z);gr.add(lb);
  decal(vgTex,8,1,-8.1,40.5,z+.37,0,gr);rb(.5,12.6,.75,.2,ramD,-6.2,40.5,z,gr)});

/* 6 · GPU */
const gg=part('gpu',[23,-6,6]);
const gx0=-10.1,gx1=1.5,gcx=(gx0+gx1)/2,gw=gx1-gx0;
rb(gw,.25,23,.1,M(0x173020,{roughness:.6}),gcx,30.25,-11,gg);
rb(gw,.35,23,.15,M(0x2b2e34,{roughness:.3,metalness:.85}),gcx,30.6,-11,gg);
rb(gw-.3,3.4,22.6,1,M(0x202227,{roughness:.38,metalness:.55}),gcx,28.25,-11,gg);
rb(.25,.5,15,.12,M(0xb7bcc4,{metalness:1,roughness:.2}),gx1-.05,29.6,-10,gg);
rb(.25,.35,8,.12,glowMat(0x76b900,1.2),gx1-.05,26.8,-14,gg);
rb(gw-.3,.9,1.3,.25,M(0xaab0b8,{metalness:1,roughness:.25}),gcx,28.4,-22.7,gg);
[-16.1,-5.7].forEach(z=>{const f=fan(9.6,null,{frame:false,axis:'y',frameColor:0x2a2c32,bladeColor:0x101114,blades:11});f.position.set(gcx,26.45,z);gg.add(f)});
decal(label('GEFORCE RTX 2060',700,120,{fg:'#76b900',font:'700 92px "Saira Condensed", Arial Narrow, sans-serif'}),12.5,2.1,gx1+.02,28.3,-7.5,Math.PI/2,gg);

decal(label('GIGABYTE',512,90,{fg:'#d9dce2',font:'700 70px "Saira Condensed", Arial Narrow, sans-serif'}),8,1.4,gcx,30.8,-16,0,gg,-Math.PI/2);

/* 7 · M.2 */
const gn=part('m2',[6,0,0]);
const freeM=new THREE.MeshStandardMaterial({color:0x000000,emissive:0x4fd394,emissiveIntensity:1.1,transparent:true,opacity:.5,depthWrite:false});
rb(.35,2.4,8.2,.15,freeM,-10.08,34.6,-11.6,gn);
rb(.35,2.4,8.2,.15,freeM,-10.08,24.4,-14,gn);
rb(.35,2.4,8.2,.15,freeM,-10.08,20,-15,gn);
rb(.6,2.9,8.8,.25,new THREE.MeshStandardMaterial({color:0x5a5e66,metalness:.9,roughness:.3,transparent:true,opacity:.35,depthWrite:false}),-9.7,34.6,-11.6,gn);

/* 8 · SSD (derrière la carte mère) */
const gs=part('ssd',[-16,0,0]);
rb(.7,10,7,.25,M(0x1c2232,{roughness:.45,metalness:.5}),-11.3,30,8,gs);
decal(label('Crucial\nBX500 · 240GB',256,160,{fg:'#8fc6ff',font:'600 36px "IBM Plex Sans", Arial, sans-serif'}),5.6,3.5,-11.67,30,8,-Math.PI/2,gs);

/* 9 · HDD */
const gh=part('hdd',[0,0,26]);
rb(10.2,2.6,14.7,.35,M(0x40444c,{roughness:.3,metalness:.9}),1.5,2.3,12.6,gh);
decal(label('WD\nBLACK',256,320,{fg:'#f2f2f2',font:'700 80px "Saira Condensed", Arial Narrow, sans-serif',bg:'#111216'}),7.6,10.4,1.5,3.62,12.6,0,gh,-Math.PI/2);

/* 10 · Alimentation */
const gp=part('psu',[6,0,-24]);
rb(15,8.6,14,.7,M(0x141519,{roughness:.45,metalness:.55}),-2,5.1,-16.2,gp);
decal(label('CORSAIR\nTX650M',420,180,{fg:'#f1f1f1',font:'600 60px "Saira Condensed", Arial Narrow, sans-serif'}),9,4,5.52,5.4,-16.2,Math.PI/2,gp);
rb(.12,.5,9,.1,M(0xf1c232,{metalness:.6,roughness:.3}),5.52,2.6,-16.2,gp);
const pf=fan(11,null,{frame:false,axis:'y',frameColor:0x141519,bladeColor:0x0c0d0f});pf.position.set(-2,9.45,-16.2);pf.scale.set(1,.4,1);gp.add(pf);

/* câbles (déco, masqués en vue éclatée) */
const cables=new THREE.Group();scene.add(cables);
const cabM=M(0x0d0e11,{roughness:.85,metalness:0});
function cable(pts,r=.45,n=1,spread=.9){for(let i=0;i<n;i++){const off=(i-(n-1)/2)*spread;const c=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2]+off)));const t=new THREE.Mesh(new THREE.TubeGeometry(c,40,r,8),cabM);t.castShadow=true;cables.add(t);noPick.add(t)}}
cable([[-6,10.8,4],[-8.6,14,4.6],[-9.6,22,4],[-9.6,30,2.6],[-9.6,38,2.2]],.42,3,.95);
cable([[2,10.8,-4],[1.4,16,-2.5],[1.2,23,-1.8],[1.3,27,-1]],.4,2,.9);
cable([[-9.9,48,4],[-9.6,49.6,-4],[-9.4,49.4,-12],[-9.2,48,-16]],.38,2,.85);

/* 11 · Ventilateurs façade */
const gf=part('frontfans',[0,0,17]);
[16.6,28.8,41].forEach(y=>{const f=fan(12,glowMat(0xff1f36,2.6),{hubLed:glowMat(0xff1f36,.9)});f.position.set(0,y,21.4);gf.add(f)});

/* 12 · Ventilateur arrière */
const gq=part('rearfan',[0,0,-15]);
const rf=fan(12,rgbMat(1.7),{hubLed:rgbMat(.9)});rf.position.set(1.5,41,-22);gq.add(rf);

/* miroir : vitre côté gauche du boîtier, façade à droite quand on regarde la vitre */
const world=new THREE.Group();world.scale.z=-1;scene.add(world);[root,glassG,shTop,shSide,cl,cables].forEach(o=>world.add(o));

/* registre de sélection */
Object.entries(P).forEach(([id,o])=>{o.base=o.g.position.clone();o.g.traverse(m=>{if(m.isMesh&&!noPick.has(m)){m.userData.id=id;pickables.push(m);
  [].concat(m.material).forEach(mt=>{if(mt.emissive&&!mt.userData.saved)mt.userData.saved={c:mt.emissive.clone(),i:mt.emissiveIntensity}})}})});
const matsOf={};Object.keys(P).forEach(id=>{const s=new Set();P[id].g.traverse(m=>{if(m.isMesh)[].concat(m.material).forEach(x=>s.add(x))});matsOf[id]=[...s]});
const ACC=new THREE.Color(0xff3b4e);
function tint(id,on,k=.22){if(!id)return;matsOf[id].forEach(mt=>{const s=mt.userData.saved;if(!s)return;if(s.c.getHex()!==0&&s.i>.3)return;if(on){mt.emissive.copy(ACC);mt.emissiveIntensity=k}else{mt.emissive.copy(s.c);mt.emissiveIntensity=s.i}})}

select=id=>{const prev=selected;selected=id;if(prev&&prev!==id&&prev!==hovered)tint(prev,false);tint(id,true,.16);shown=null;show(hovered||id)};
function setHover(id){if(id===hovered)return;const prev=hovered;hovered=id;if(prev&&prev!==selected)tint(prev,false);if(prev===selected)tint(selected,true,.16);if(id)tint(id,true,.32);show(id||selected);canvas.classList.toggle('hov',!!id)}

/* interactions */
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null,dragging=false;
function pick(e){const r=canvas.getBoundingClientRect();mouse.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(pickables,false)[0];return hit?hit.object.userData.id:null}
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};dragging=false});
canvas.addEventListener('pointermove',e=>{
  if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)dragging=true;
  if(dragging||e.pointerType==='touch'){tip.hidden=true;return}
  const id=pick(e);setHover(id);
  if(id){const r=stage.getBoundingClientRect();tip.hidden=false;tip.innerHTML=`<b>${esc(PARTS[id].cat)}</b>${esc(PARTS[id].name)}`;let x=e.clientX-r.left,y=e.clientY-r.top;if(x>r.width-300)x-=320;tip.style.left=x+'px';tip.style.top=y+'px'}else tip.hidden=true;
});
canvas.addEventListener('pointerleave',()=>{tip.hidden=true;setHover(null)});
canvas.addEventListener('pointerup',e=>{if(!dragging){const id=pick(e);if(id){select(id);controls.autoRotate=false;bSpin.setAttribute('aria-pressed','false')}}down=null;dragging=false});
controls.addEventListener('start',()=>{if(controls.autoRotate){controls.autoRotate=false;bSpin.setAttribute('aria-pressed','false')}});

/* boutons */
const bExplode=document.getElementById('bExplode'),bGlass=document.getElementById('bGlass'),bSpin=document.getElementById('bSpin'),bReset=document.getElementById('bReset');
let exploded=0,exTarget=0,camTween=null;
function tweenCam(toPos,toTarget){camTween={t:0,fp:camera.position.clone(),ft:controls.target.clone(),tp:toPos,tt:toTarget}}
bExplode.onclick=()=>{exTarget=exTarget?0:1;bExplode.setAttribute('aria-pressed',String(!!exTarget));if(exTarget)cables.visible=false;
  const dir=camera.position.clone().sub(controls.target).normalize();tweenCam(TARGET.clone().add(dir.multiplyScalar(exTarget?180:140)),TARGET.clone())};
bGlass.onclick=()=>{glassG.visible=!glassG.visible;bGlass.setAttribute('aria-pressed',String(glassG.visible))};
bSpin.onclick=()=>{controls.autoRotate=!controls.autoRotate;bSpin.setAttribute('aria-pressed',String(controls.autoRotate))};
bSpin.setAttribute('aria-pressed',String(controls.autoRotate));
bReset.onclick=()=>tweenCam(HOME.clone(),TARGET.clone());

/* rendu */
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  const wide=w>900;camera.setViewOffset(w,h,wide?Math.round(w*.14):0,0,w,h);camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(stage);resize();
const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
let last=performance.now(),tt=0;
function loop(now){const dt=Math.min((now-last)/1000,.05);last=now;tt+=dt;
  if(exploded!==exTarget){exploded+=Math.sign(exTarget-exploded)*dt*2;exploded=Math.max(0,Math.min(1,exploded));const k=ease(exploded);Object.values(P).forEach(o=>o.g.position.copy(o.base).addScaledVector(o.ex,k));if(exploded===0)cables.visible=true}
  if(camTween){camTween.t=Math.min(1,camTween.t+dt*1.6);const k=ease(camTween.t);camera.position.lerpVectors(camTween.fp,camTween.tp,k);controls.target.lerpVectors(camTween.ft,camTween.tt,k);if(camTween.t>=1)camTween=null}
  if(!reduce){spinners.forEach((s,i)=>s.rotation.z+=dt*(5+i%3));rainbow.offset.x=(tt*.08)%1}
  controls.update();renderer.render(scene,camera);requestAnimationFrame(loop)}
requestAnimationFrame(loop);
select(selected);
}
