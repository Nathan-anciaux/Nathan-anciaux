/* Fond 3D du site : recuit simulé sur un paysage d'énergie.

   Des chaînes de Metropolis explorent une fonction E(x, y) à plusieurs minima.
   Un pas proposé x' est accepté avec probabilité min(1, exp(-(E(x') - E(x)) / T)).
   La température T suit le défilement, selon un refroidissement géométrique :
     haut de page  : T élevée, les chaînes acceptent presque tout et explorent ;
     bas de page   : T faible, elles ne font plus que descendre et se figent dans un minimum.
   Remonter la page réchauffe le système. La caméra tourne autour du paysage et
   finit sur le meilleur point trouvé. */
import * as THREE from 'three';

const canvas = document.getElementById('scene');
if (canvas) init();

function init() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = window.innerWidth < 700;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none'; // pas de WebGL : la page reste lisible sans fond
    return;
  }

  const BG = 0x0b0c0f;     // noir d'origine, identique à --bg du CSS
  const ACCENT = 0x9ec5ff; // bleu glacier des minima et du meilleur point, identique à --accent
  renderer.setClearColor(BG, 1);
  // résolution plafonnée : sur écran Retina, le rendu à pleine densité coûte cher pour peu de gain
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  // brouillard un peu plus léger que sur fond noir : il garde les couleurs du paysage lisibles
  scene.fog = new THREE.FogExp2(BG, 0.11);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
  const world = new THREE.Group();
  scene.add(world);

  /* =========================================================
     Paysage d'énergie sur [-1, 1]²
     ========================================================= */
  const SIZE = 1.7;   // demi-côté du domaine, en unités de scène
  const HEIGHT = 0.6; // exagération verticale

  const WELLS = [
    { x: 0.52, y: -0.38, a: 1.25, s: 0.16 },
    { x: -0.55, y: 0.42, a: 0.95, s: 0.2 },
    { x: -0.35, y: -0.55, a: 0.8, s: 0.14 },
    { x: 0.3, y: 0.55, a: 0.85, s: 0.17 },
    { x: -0.05, y: 0.02, a: 0.55, s: 0.12 },
    { x: 0.75, y: 0.25, a: 0.6, s: 0.12 },
    { x: -0.78, y: -0.05, a: 0.65, s: 0.13 }
  ];

  // cuvette et ondulation, sans les puits
  function base(x, y) {
    return 0.35 * (x * x + y * y) + 0.06 * Math.sin(7 * x) * Math.cos(6 * y);
  }

  function wells(x, y) {
    let e = 0;
    for (const w of WELLS) {
      const dx = x - w.x;
      const dy = y - w.y;
      e -= w.a * Math.exp(-(dx * dx + dy * dy) / (2 * w.s * w.s));
    }
    return e;
  }

  // l'énergie explorée par les chaînes, sur [-1, 1]²
  function energy(x, y) {
    return base(x, y) + wells(x, y);
  }

  /* Prolongement du plan jusqu'aux bords de l'écran, sans aucun nouveau minimum.
     Hors de [-1, 1]², on part du point du bord le plus proche avec la même pente sortante
     (raccord sans pli), puis on rejoint un plateau plat de hauteur PLATEAU sur une bande
     de largeur BAND. Vérifié sur grille : aucun minimum strict hors du domaine. Les chaînes,
     réfléchies au bord, ne quittent jamais [-1, 1]². */
  const EXT = 6;        // demi-côté du plan affiché, en unités du domaine
  const BAND = 0.8;     // largeur de la bande de raccord
  const PLATEAU = 1.0;  // hauteur du plateau, juste au-dessus des crêtes du domaine

  const smooth01 = (t) => {
    const u = Math.min(1, Math.max(0, t));
    return u * u * (3 - 2 * u);
  };

  function surface(x, y) {
    const cx = Math.max(-1, Math.min(1, x));
    const cy = Math.max(-1, Math.min(1, y));
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return energy(x, y);
    const b = base(cx, cy);
    // dérivée de la cuvette au bord, dans la direction sortante
    const bx = 0.7 * cx + 0.42 * Math.cos(7 * cx) * Math.cos(6 * cy);
    const by = 0.7 * cy - 0.36 * Math.sin(7 * cx) * Math.sin(6 * cy);
    const slope = (bx * dx + by * dy) / dist;
    const s = smooth01(dist / BAND);
    return wells(x, y) + (1 - s) * (b + slope * dist) + s * PLATEAU;
  }

  // bornes de E et minimum global, par recherche sur grille fine
  let eMin = Infinity;
  let eMax = -Infinity;
  let gx = 0;
  let gy = 0;
  const GS = 220;
  for (let i = 0; i <= GS; i++) {
    for (let j = 0; j <= GS; j++) {
      const x = -1 + (2 * i) / GS;
      const y = -1 + (2 * j) / GS;
      const e = energy(x, y);
      if (e < eMin) { eMin = e; gx = x; gy = y; }
      if (e > eMax) eMax = e;
    }
  }

  /* ---------- Lignes du paysage, colorées par la hauteur ---------- */
  const LINES = compact ? 34 : 56;
  const RES = compact ? 70 : 120;
  // Carte de couleurs divergente « coolwarm » : l'énergie basse en froid, l'énergie haute en chaud.
  // Bleu glacier lumineux au fond des puits, gris neutre vers la médiane des hauteurs (h ≈ 0,61),
  // rouge sur le haut de la cuvette, rouge sombre sur les crêtes et le plateau, qui se fondent
  // dans le fond. Les puits n'occupent que 10 % de la surface (h < 0,37), d'où des paliers
  // resserrés vers le bas.
  const RAMP = [
    [0.0, new THREE.Color(0xb5d3ff)],
    [0.15, new THREE.Color(0x7ea9ff)],
    [0.32, new THREE.Color(0x6f8fe0)],
    [0.52, new THREE.Color(0x8a8f9e)],
    [0.68, new THREE.Color(0xc4614c)],
    [0.85, new THREE.Color(0x9c4038)],
    [1.0, new THREE.Color(0x6a2f33)]
  ];

  function heightColor(e, out) {
    const h = Math.min(1, Math.max(0, (e - eMin) / (eMax - eMin)));
    for (let i = 1; i < RAMP.length; i++) {
      if (h <= RAMP[i][0]) {
        const [h0, c0] = RAMP[i - 1];
        const [h1, c1] = RAMP[i];
        return out.copy(c0).lerp(c1, (h - h0) / (h1 - h0));
      }
    }
    return out.copy(RAMP[RAMP.length - 1][1]);
  }

  // Abscisses d'échantillonnage le long d'une ligne : fines sur le domaine et la bande de raccord,
  // un seul segment sur le plateau, qui est plat
  const SAMPLES = (() => {
    const bandN = compact ? 10 : 16;
    const t = [-EXT];
    for (let i = 0; i < bandN; i++) t.push(-1 - BAND + (BAND * i) / bandN);
    for (let i = 0; i < RES; i++) t.push(-1 + (2 * i) / (RES - 1));
    for (let i = 1; i <= bandN; i++) t.push(1 + (BAND * i) / bandN);
    t.push(EXT);
    return t;
  })();

  {
    // lignes au même pas que sur le domaine, prolongées sur tout le plan
    const STEP = 2 / (LINES - 1);
    const kMin = Math.ceil((1 - EXT) / STEP);
    const kMax = Math.floor((1 + EXT) / STEP);
    const positions = [];
    const colors = [];
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    for (let dir = 0; dir < 2; dir++) {
      for (let k = kMin; k <= kMax; k++) {
        const fixed = -1 + k * STEP;
        // une ligne entièrement sur le plateau est droite : un seul segment suffit
        const ts = Math.abs(fixed) >= 1 + BAND ? [-EXT, EXT] : SAMPLES;
        for (let r = 0; r < ts.length - 1; r++) {
          const t0 = ts[r];
          const t1 = ts[r + 1];
          const x0 = dir ? fixed : t0;
          const y0 = dir ? t0 : fixed;
          const x1 = dir ? fixed : t1;
          const y1 = dir ? t1 : fixed;
          const e0 = surface(x0, y0);
          const e1 = surface(x1, y1);
          positions.push(x0 * SIZE, e0 * HEIGHT, y0 * SIZE, x1 * SIZE, e1 * HEIGHT, y1 * SIZE);
          heightColor(e0, cA);
          heightColor(e1, cB);
          colors.push(cA.r, cA.g, cA.b, cB.r, cB.g, cB.b);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    world.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true })));
  }

  /* ---------- Surface opaque sous les lignes : cache les lignes de l'arrière ---------- */
  {
    // grille non uniforme sur les mêmes abscisses que les lignes
    const n = SAMPLES.length;
    const pos = new Float32Array(n * n * 3);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = SAMPLES[i];
        const y = SAMPLES[j];
        const p = (i * n + j) * 3;
        pos[p] = x * SIZE;
        pos[p + 1] = surface(x, y) * HEIGHT;
        pos[p + 2] = y * SIZE;
      }
    }
    const index = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const a = i * n + j;
        index.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(index);
    const mat = new THREE.MeshBasicMaterial({
      color: BG,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    });
    world.add(new THREE.Mesh(geo, mat));
  }

  // niveau de départ du repère du meilleur point ; le plan prolongé recouvre désormais tout le sol
  const floorY = eMin * HEIGHT - 0.28;

  /* =========================================================
     Chaînes de Metropolis
     ========================================================= */
  const N = compact ? 14 : 26;   // nombre de chaînes
  const K = compact ? 18 : 24;   // longueur des traînées, en images
  const STEPS = 2;               // pas de Metropolis par chaîne et par image
  const T0 = 0.9;
  const TMIN = 0.003;
  const LIFT = 0.018;            // décolle les points de la surface

  function gauss() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // réflexion sur les bords du domaine
  const reflect = (v) => (v > 1 ? 2 - v : v < -1 ? -2 - v : v);

  const chains = [];
  for (let i = 0; i < N; i++) {
    const x = Math.random() * 1.9 - 0.95;
    const y = Math.random() * 1.9 - 0.95;
    chains.push({ x, y, e: energy(x, y) });
  }

  let T = T0;
  let logT = Math.log(T0);
  let proposals = 0;
  let accRate = 1;
  let bestE = Infinity;
  let bx = 0;
  let by = 0;

  function metropolis() {
    // écart-type de la proposition : large à chaud, fin à froid
    const step = 0.007 + 0.026 * Math.sqrt(T / T0);
    let acc = 0;
    let tot = 0;
    for (const c of chains) {
      for (let s = 0; s < STEPS; s++) {
        const nx = reflect(c.x + step * gauss());
        const ny = reflect(c.y + step * gauss());
        const ne = energy(nx, ny);
        const dE = ne - c.e;
        tot++;
        if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
          c.x = nx;
          c.y = ny;
          c.e = ne;
          acc++;
        }
        if (c.e < bestE) {
          bestE = c.e;
          bx = c.x;
          by = c.y;
        }
      }
    }
    proposals += tot;
    accRate = accRate * 0.96 + (acc / tot) * 0.04;
  }

  /* ---------- Points lumineux ---------- */
  const ptPos = new Float32Array(N * 3);
  const ptGlow = new Float32Array(N);
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
  ptGeo.setAttribute('aGlow', new THREE.BufferAttribute(ptGlow, 1));
  const ptMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xd6e4ff) },
      uSize: { value: compact ? 44 : 60 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uPixelRatio;
      attribute float aGlow;
      varying float vGlow;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPixelRatio * (0.55 + 0.45 * aGlow) / -mv.z;
        vGlow = aGlow;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.5, 0.0, d);
        float a = pow(core, 2.4) + 0.6 * smoothstep(0.12, 0.0, d);
        gl_FragColor = vec4(uColor * (0.55 + 0.75 * vGlow), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  world.add(new THREE.Points(ptGeo, ptMat));

  /* ---------- Traînées ---------- */
  const trail = new Float32Array(N * K * 3); // tampon circulaire des K dernières positions
  let head = 0;
  let trailFilled = 0;
  const trPos = new Float32Array(N * (K - 1) * 6);
  const trCol = new Float32Array(N * (K - 1) * 6);
  const trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
  trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3));
  world.add(
    new THREE.LineSegments(
      trGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    )
  );
  const TRAIL_RGB = [0.55, 0.72, 1.0];

  function worldOf(c, out, i) {
    out[i] = c.x * SIZE;
    out[i + 1] = c.e * HEIGHT + LIFT;
    out[i + 2] = c.y * SIZE;
  }

  function updateChainsGeometry() {
    head = (head + 1) % K;
    trailFilled = Math.min(K, trailFilled + 1);
    for (let n = 0; n < N; n++) {
      const c = chains[n];
      worldOf(c, ptPos, n * 3);
      worldOf(c, trail, (n * K + head) * 3);
      ptGlow[n] = 1 - (c.e - eMin) / (eMax - eMin);
    }
    let v = 0;
    for (let n = 0; n < N; n++) {
      for (let s = 0; s < K - 1; s++) {
        const visible = s + 1 < trailFilled;
        const a = (((head - s) % K) + K) % K;
        const b = (((head - s - 1) % K) + K) % K;
        const ia = (n * K + a) * 3;
        const ib = (n * K + b) * 3;
        const fa = visible ? Math.pow(1 - s / K, 1.6) * 0.8 : 0;
        const fb = visible ? Math.pow(1 - (s + 1) / K, 1.6) * 0.8 : 0;
        trPos[v] = trail[ia]; trPos[v + 1] = trail[ia + 1]; trPos[v + 2] = trail[ia + 2];
        trPos[v + 3] = trail[ib]; trPos[v + 4] = trail[ib + 1]; trPos[v + 5] = trail[ib + 2];
        trCol[v] = TRAIL_RGB[0] * fa; trCol[v + 1] = TRAIL_RGB[1] * fa; trCol[v + 2] = TRAIL_RGB[2] * fa;
        trCol[v + 3] = TRAIL_RGB[0] * fb; trCol[v + 4] = TRAIL_RGB[1] * fb; trCol[v + 5] = TRAIL_RGB[2] * fb;
        v += 6;
      }
    }
    ptGeo.attributes.position.needsUpdate = true;
    ptGeo.attributes.aGlow.needsUpdate = true;
    trGeo.attributes.position.needsUpdate = true;
    trGeo.attributes.color.needsUpdate = true;
  }

  /* ---------- Repère du meilleur point trouvé ---------- */
  const marker = new THREE.Group();
  world.add(marker);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.055, 0.066, 64),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  marker.add(ring);
  const dropGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
  const drop = new THREE.Line(
    dropGeo,
    new THREE.LineDashedMaterial({ color: ACCENT, dashSize: 0.025, gapSize: 0.025, transparent: true, opacity: 0.7 })
  );
  marker.add(drop);
  {
    const cross = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.16, 0, 0), new THREE.Vector3(0.16, 0, 0),
      new THREE.Vector3(0, 0, -0.16), new THREE.Vector3(0, 0, 0.16)
    ]);
    marker.add(new THREE.LineSegments(cross, new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.6 })));
  }

  function updateMarker(time) {
    if (!Number.isFinite(bestE)) return;
    const h = bestE * HEIGHT + LIFT - floorY;
    marker.position.set(bx * SIZE, floorY, by * SIZE);
    ring.position.y = h;
    const pulse = 1 + 0.12 * Math.sin(time * 0.004);
    ring.scale.set(pulse, pulse, pulse);
    const p = dropGeo.attributes.position;
    p.setY(1, h);
    p.needsUpdate = true;
    drop.computeLineDistances();
  }

  /* =========================================================
     Caméra, cadrage et opacité, pilotés par le défilement
     ========================================================= */
  const gWorld = new THREE.Vector3(gx * SIZE, eMin * HEIGHT, gy * SIZE);
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const view = { x: 0, y: 0 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let opacity = 1;
  let W = 1;
  let H = 1;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smoothstep = (a, b, v) => {
    const t = clamp01((v - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // Hauteur défilable mise en cache : la relire à chaque image forcerait un recalcul de mise en page
  let maxScroll = 1;
  const measureScroll = () => {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  };
  measureScroll();
  if ('ResizeObserver' in window) new ResizeObserver(measureScroll).observe(document.body);

  function progress() {
    return clamp01(window.scrollY / maxScroll);
  }

  function computeWant(p) {
    const e = easeInOut(p);
    // orbite d'un peu plus d'un demi-tour, qui se resserre sans jamais descendre dans le relief
    const theta = -0.7 + e * Math.PI * 1.1;
    const radius = 4.2 - 1.4 * e;
    const height = 2.5 - 0.3 * e; // reste haute : on voit le fond des puits où les chaînes se figent
    wantLook.set(0, -0.15, 0).lerp(gWorld, 0.55 * smoothstep(0.5, 1, p));
    wantPos.set(Math.sin(theta) * radius, height, Math.cos(theta) * radius).add(wantLook);
    wantPos.x += mouse.x * 0.3;
    wantPos.y += mouse.y * 0.18;
  }

  // Dans le hero et au contact, la scène est décalée pour laisser la place au texte :
  // à droite sur écran large, en haut sur mobile (hero seulement).
  function wantView(p) {
    const start = 1 - smoothstep(0, 0.12, p);
    const end = smoothstep(0.86, 1, p);
    return compact ? { x: 0, y: 0.18 * start } : { x: -0.2 * Math.max(start, end), y: 0.03 * start };
  }

  // Pleine intensité dans le hero et en fin de page, atténuée derrière le contenu
  function wantOpacity() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = maxScroll;
    const base = 0.6;
    if (y < vh * 0.6) return 1 - (1 - base) * (y / (vh * 0.6));
    return base + (0.8 - base) * smoothstep(max - vh * 0.9, max, y);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    ptMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    measureScroll();
  }

  function applyView() {
    camera.setViewOffset(W, H, view.x * W, view.y * H, W, H);
  }

  /* =========================================================
     Tableau de bord (barre du bas)
     ========================================================= */
  const hud = {
    T: document.getElementById('hudT'),
    iter: document.getElementById('hudIter'),
    acc: document.getElementById('hudAcc'),
    best: document.getElementById('hudBest'),
    bar: document.getElementById('hudBar'),
    phase: document.getElementById('hudPhase')
  };

  const numberFormats = {
    en: new Intl.NumberFormat('en-GB'),
    fr: new Intl.NumberFormat('fr-FR')
  };

  function updateHud(p) {
    const lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';
    const dict = (window.I18N && window.I18N[lang]) || {};
    const nf = numberFormats[lang];
    if (hud.T) hud.T.textContent = T >= 0.01 ? T.toFixed(3) : T.toExponential(1);
    if (hud.iter) hud.iter.textContent = nf.format(Math.round(proposals / N));
    if (hud.acc) hud.acc.textContent = Math.round(accRate * 100) + (lang === 'fr' ? ' %' : '%');
    if (hud.best && Number.isFinite(bestE)) hud.best.textContent = bestE.toFixed(3).replace('-', '−');
    if (hud.bar) hud.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (hud.phase) {
      const key = T > 0.15 ? 'hud.phase.explore' : T > 0.015 ? 'hud.phase.cool' : 'hud.phase.converge';
      if (dict[key]) hud.phase.textContent = dict[key];
    }
  }

  /* =========================================================
     Boucle
     ========================================================= */
  const targetLogT = (p) => Math.log(T0) + p * (Math.log(TMIN) - Math.log(T0));
  let frame = 0;

  function step(now, damping) {
    const p = progress();

    logT += (targetLogT(p) - logT) * damping.temp;
    T = Math.exp(logT);
    if (!reduceMotion) metropolis();
    updateChainsGeometry();
    updateMarker(now);

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    computeWant(p);
    camPos.lerp(wantPos, damping.cam);
    camLook.lerp(wantLook, damping.cam);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    const v = wantView(p);
    view.x += (v.x - view.x) * damping.cam;
    view.y += (v.y - view.y) * damping.cam;
    applyView();

    // n'écrire l'opacité que si elle change visiblement : chaque écriture relance la composition
    const nextOpacity = opacity + (wantOpacity() - opacity) * damping.cam;
    if (Math.abs(nextOpacity - opacity) > 0.002 || damping.cam === 1) {
      opacity = nextOpacity;
      canvas.style.opacity = opacity.toFixed(3);
    }

    renderer.render(scene, camera);
    if (frame++ % 6 === 0) updateHud(p);
  }

  /* Qualité adaptative : si les images dépassent en moyenne 20 ms (moins de 50 i/s),
     on repasse en résolution 1x, une seule fois. */
  let slowFrames = 0;
  let lastFrame = 0;
  function watchPerformance(now) {
    if (lastFrame && pixelRatio > 1) {
      const dt = now - lastFrame;
      if (dt < 100) slowFrames = dt > 20 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 45) {
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        resize();
      }
    }
    lastFrame = now;
  }

  resize();
  window.addEventListener('resize', resize);

  // état de départ : la caméra part directement de sa position cible
  computeWant(progress());
  camPos.copy(wantPos);
  camLook.copy(wantLook);
  Object.assign(view, wantView(progress()));
  opacity = wantOpacity();
  canvas.style.opacity = opacity.toFixed(3);

  if (reduceMotion) {
    // pas d'animation continue : on refroidit une fois hors écran, puis on ne redessine qu'au défilement
    for (let i = 0; i < 900; i++) {
      T = T0 * Math.pow(TMIN / T0, i / 899);
      metropolis();
    }
    logT = targetLogT(progress());
    T = Math.exp(logT);
    const instant = { temp: 1, cam: 1 };
    const redraw = () => requestAnimationFrame((now) => step(now, instant));
    window.addEventListener('scroll', redraw, { passive: true });
    window.addEventListener('resize', redraw);
    redraw();
    return;
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true }
  );

  const smooth = { temp: 0.03, cam: 0.06 };
  const loop = (now) => {
    watchPerformance(now);
    step(now, smooth);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
