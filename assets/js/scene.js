/* Lore Atlas 3D scenes, built with three.js.
   hero(el, world)                      the rotating centrepiece in the page header
   orbit(el, data, on)                  focus view: one character, their links on a page, as 3D medallions
   starmap(el, data, onPick)            the whole cast as a galaxy of stars; the selected one's links rise as medallions
   focus(id) / pause()                  move the star map camera, or stop it while hidden
   showcase(el, opts, onReady)          a character's art as an interactive 3D stage in the profile
   showcaseStop()                       stop the profile stage when the profile closes */
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const col = (n, fb) => { try { return new THREE.Color(css(n) || fb); } catch { return new THREE.Color(fb); } };
const loader = new THREE.TextureLoader();

function makeRenderer(el, opts = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', ...opts });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, innerWidth < 640 ? 1.5 : 2));
  r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(r.domElement);
  return r;
}
function fit(el, renderer, camera) {
  const w = el.clientWidth || 1, h = el.clientHeight || 1;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
let dotTex;
function discTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return (dotTex = new THREE.CanvasTexture(c));
}
function shell(count, rMin, rMax, seed = 1) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = rMin + rnd() * (rMax - rMin), q = Math.sqrt(1 - u * u);
    p[i * 3] = r * q * Math.cos(t); p[i * 3 + 1] = r * u; p[i * 3 + 2] = r * q * Math.sin(t);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g;
}
function textSprite(text, color, world) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = world === 'wuwa' ? '600 46px "Barlow Condensed", "Arial Narrow", sans-serif' : '400 50px Marcellus, Georgia, serif';
  const label = world === 'wuwa' ? text.toUpperCase() : text;
  const spacing = world === 'wuwa' ? 6 : 0;
  g.font = font; const w = Math.ceil(g.measureText(label).width + label.length * spacing) + 48;
  c.width = w; c.height = 80; g.font = font;
  g.fillStyle = color; g.globalAlpha = 0.95; g.textBaseline = 'middle';
  if (spacing) g.letterSpacing = spacing + 'px';
  g.fillText(label, 20, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85 }));
  s.scale.set(w / 80 * 7, 7, 1);
  return s;
}

// ---------------------------------------------------------------- header centrepiece
function hero(el, world) {
  if (!el || el.dataset.ready) return; el.dataset.ready = '1';
  const renderer = makeRenderer(el);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  const accent = col('--accent', '#e6c98a'), bright = col('--accent2', '#fff0c9');
  const root = new THREE.Group(); scene.add(root);
  const dot = discTexture(), spin = [];
  if (world === 'wuwa') {
    const core = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.5, 1)), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.55 }));
    const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.8, 0)), new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: 0.9 }));
    const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: accent, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    heart.scale.setScalar(2.6);
    root.add(core, inner, heart);
    spin.push([core, 0.12, 0.2, 0], [inner, -0.3, -0.45, 0.2]);
    for (let i = 0; i < 3; i++) {
      const n = 180, r = 2.3 + i * 0.55, p = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, wob = Math.sin(a * (6 + i * 3)) * 0.07; p[k * 3] = Math.cos(a) * (r + wob); p[k * 3 + 1] = Math.sin(a * (6 + i * 3)) * 0.1; p[k * 3 + 2] = Math.sin(a) * (r + wob); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const ring = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.5 - i * 0.12 }));
      ring.rotation.set(0.5 + i * 0.5, 0, 0.3 * i);
      root.add(ring); spin.push([ring, 0, 0.18 * (i % 2 ? -1 : 1) * (1 + i * 0.3), 0.05]);
    }
    const motes = new THREE.Points(shell(260, 2.2, 4.6, 7), new THREE.PointsMaterial({ map: dot, color: accent, size: 0.07, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    root.add(motes); spin.push([motes, 0.02, 0.05, 0]);
  } else {
    const gold = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.85 });
    const pale = new THREE.MeshBasicMaterial({ color: bright });
    [[2.5, 0.014, 1.2, 0.2, 0.10], [2.15, 0.02, 0.3, 1.1, -0.16], [1.8, 0.014, -0.9, 0.5, 0.22], [1.45, 0.02, 1.57, 0, -0.3]].forEach(([r, tube, rx, rz, sp]) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 160), gold);
      t.rotation.set(rx, 0, rz); root.add(t); spin.push([t, sp * 0.4, sp, 0]);
      const bead = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), pale); bead.position.set(r, 0, 0); t.add(bead);
    });
    const star = new THREE.Group();
    [[0.16, 1.15, 0.16], [1.15, 0.16, 0.16], [0.16, 0.16, 1.15]].forEach(s => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), pale); m.scale.set(...s); star.add(m); });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: accent, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(3.2); star.add(halo);
    root.add(star); spin.push([star, 0.1, 0.35, 0.05]);
    const stars = new THREE.Points(shell(420, 2.8, 5.2, 11), new THREE.PointsMaterial({ map: dot, color: 0xdfe6ff, size: 0.06, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    root.add(stars); spin.push([stars, 0.01, 0.03, 0]);
  }
  root.rotation.x = 0.35;
  const target = { x: 0, y: 0 };
  window.addEventListener('pointermove', e => { target.x = (e.clientY / innerHeight - 0.5) * 0.5; target.y = (e.clientX / innerWidth - 0.5) * 0.7; }, { passive: true });
  let visible = true, last = performance.now();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(el);
  new ResizeObserver(() => { fit(el, renderer, camera); renderer.render(scene, camera); }).observe(el);
  fit(el, renderer, camera);
  const frame = t => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (visible && !document.hidden) {
      for (const [o, x, y, z] of spin) { o.rotation.x += x * dt; o.rotation.y += y * dt; o.rotation.z += z * dt; }
      root.rotation.x += (0.35 + target.x - root.rotation.x) * 0.04;
      root.rotation.y += (target.y - root.rotation.y) * 0.04;
      renderer.render(scene, camera);
    }
    if (!reduce) requestAnimationFrame(frame);
  };
  renderer.render(scene, camera);
  if (!reduce) requestAnimationFrame(frame);
  el.classList.add('on');
}

// ---------------------------------------------------------------- shared pieces for the connection views
const texCache = new Map();
function portrait(url, mat) {
  let t = texCache.get(url);
  if (t) { mat.map = t; mat.needsUpdate = true; return; }
  loader.load(url, tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; texCache.set(url, tex); mat.map = tex; mat.needsUpdate = true; });
}
const MED = {};
function medGeo() {
  if (MED.face) return MED;
  MED.face = new THREE.CircleGeometry(1, 56);
  MED.back = new THREE.CircleGeometry(1.02, 56);
  MED.rim = new THREE.TorusGeometry(1.03, 0.06, 12, 72);
  MED.edge = new THREE.CylinderGeometry(1.045, 1.045, 0.18, 72, 1, true); MED.edge.rotateX(Math.PI / 2);
  return MED;
}
/** A portrait medallion: face, metal rim in the element colour, dark back and a soft glow. */
function medallion(img, color, accent) {
  const G = medGeo();
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
  portrait(img, mat);
  const face = new THREE.Mesh(G.face, mat); face.position.z = 0.091;
  const back = new THREE.Mesh(G.back, new THREE.MeshStandardMaterial({ color: 0x1a1d24, metalness: 0.6, roughness: 0.5, transparent: true }));
  back.rotation.y = Math.PI; back.position.z = -0.091;
  const rim = new THREE.Mesh(G.rim, new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3, emissive: new THREE.Color(color).multiplyScalar(0.25), transparent: true }));
  const edge = new THREE.Mesh(G.edge, new THREE.MeshStandardMaterial({ color: accent, metalness: 0.85, roughness: 0.3, transparent: true, side: THREE.DoubleSide }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTexture(), color: new THREE.Color(color), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(3.2); glow.position.z = -0.4;
  g.add(glow, back, edge, face, rim);
  const parts = [mat, back.material, rim.material, edge.material];
  return { g, face, mat, glow, parts, setImg(u) { portrait(u, mat); }, setColor(c) { rim.material.color.set(c); rim.material.emissive.set(c).multiplyScalar(0.25); glow.material.color.set(c); }, setOpacity(o) { parts.forEach(p => { p.opacity = o; }); glow.material.opacity = 0.35 * o; } };
}
// what each kind of link looks like: both speak, the centre speaks, or the other one speaks of the centre
const LINK = { mutual: '#f2d48f', out: '#8fd3ff', in: '#d7a6ff' };
function tube(curve, radius, color) {
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
}
function project(v, camera, w, h) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, z: p.z }; }

// ---------------------------------------------------------------- focus: one character and their links, a page at a time
let O = null;
function orbit(el, data, on) {
  if (!O) O = makeOrbit(el, on);
  O.on = on;
  O.set(data);
  O.running = true; O.loop();
}
function makeOrbit(el, on) {
  const renderer = makeRenderer(el);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 1, 2000);
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(30, 40, 60); camera.add(key);
  const accent = col('--accent', '#e6c98a');
  const stage = new THREE.Group(); scene.add(stage);
  const small = () => (el.clientWidth || 600) < 560;
  // a few far stars and two faint orbit guides
  scene.add(new THREE.Points(shell(small() ? 160 : 320, 260, 520, 9), new THREE.PointsMaterial({ map: discTexture(), color: 0xcfd6ee, size: 2.4, transparent: true, opacity: 0.5, depthWrite: false })));
  const guideMat = () => new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.0, depthWrite: false });
  const guides = [0, 1].map(() => { const l = new THREE.LineLoop(new THREE.BufferGeometry(), guideMat()); stage.add(l); return l; });
  const halo = new THREE.Group(); stage.add(halo);
  [1.45, 1.75].forEach((r, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 120), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: i ? 0.25 : 0.5, depthWrite: false })); halo.add(m); });

  const labels = document.createElement('div'); labels.className = 'o-labels'; el.appendChild(labels);
  const items = new Map();   // id -> { m, label, pos, target, scale, targetScale, data }
  let center = null, sel = null, hover = null, edges = [], sparks = null, sparkData = [], fade = 0, layoutKey = '', W = 1, H = 1;

  function entity(d) {
    let it = items.get(d.id);
    if (it) return it;
    const m = medallion(d.img, d.color, accent);
    m.g.scale.setScalar(0.001);
    m.face.userData.id = d.id;
    stage.add(m.g);
    const label = document.createElement('button');
    label.type = 'button'; label.className = 'o-label';
    label.innerHTML = '<b></b><small></small>';
    label.addEventListener('click', () => O.on.select(label.dataset.id === center ? null : label.dataset.id));
    label.addEventListener('pointerenter', () => { hover = label.dataset.id; });
    label.addEventListener('pointerleave', () => { hover = null; });
    labels.appendChild(label);
    it = { m, label, pos: new THREE.Vector3(), target: new THREE.Vector3(), targetScale: 1, alive: true };
    items.set(d.id, it);
    return it;
  }
  function fit() {
    W = el.clientWidth || 1; H = el.clientHeight || 1;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    // the scene is 100 units tall at the centre plane
    camera.position.set(0, 0, 50 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.lookAt(0, 0, 0);
  }

  function layout(data) {
    const n = data.nodes.length, aspect = W / H, phone = small();
    const hx = 50 * aspect, hy = 50;
    const R = Math.min(hx, hy);
    // the biggest medallion that leaves clear space around every portrait and its name
    const two = !phone && n > 10;
    const ox = hx - (phone ? 9 : 10), oy = hy - (phone ? 15 : 12);
    const ix = ox * 0.56, iy = oy * 0.56;
    const per = (rx, ry, k) => (Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))) / Math.max(k, 1);
    const kOut = two ? Math.ceil(n / 2) : n, kIn = two ? Math.floor(n / 2) : 0;
    const gap = Math.min(per(ox, oy, kOut), kIn ? per(ix, iy, kIn) : 1e9);
    // a portrait, its name underneath and clear space: along the ring, between the rings, and around the centre
    let nodeR = Math.min(phone ? 7 : 6.4, gap / 3.2);
    if (two) nodeR = Math.min(nodeR, (Math.min(ox - ix, oy - iy) - 8) / 2);
    nodeR = Math.max(3, nodeR);
    const innerMin = two ? Math.min(ix, iy) : Math.min(ox, oy);
    const centreR = Math.max(5, Math.min(R * 0.2, innerMin - nodeR - 9, 14));
    center = data.center.id;
    const all = [data.center, ...data.nodes];
    for (const it of items.values()) it.alive = false;
    const c = entity(data.center); c.alive = true; c.target.set(0, phone ? 1.5 : 0, 4); c.targetScale = centreR; c.isCenter = true; c.dir = null; c.d = data.center;
    data.nodes.forEach((d, i) => {
      const it = entity(d); it.alive = true; it.isCenter = false; it.d = d; it.dir = d.dir;
      const inner = two && i % 2 === 1, k = inner ? Math.floor(i / 2) : two ? Math.floor(i / 2) : i, cnt = inner ? kIn : kOut;
      const a = -Math.PI / 2 + (k + (inner ? 0.5 : 0)) / cnt * Math.PI * 2;
      const rx = inner ? ix : ox, ry = inner ? iy : oy;
      it.target.set(Math.cos(a) * rx, -Math.sin(a) * ry * 0.98 + (phone ? 1.5 : 0), Math.sin(a) * 4);
      it.targetScale = nodeR;
    });
    for (const d of all) { const it = items.get(d.id); it.m.setImg(d.img); it.m.setColor(d.color); it.label.dataset.id = d.id; it.label.querySelector('b').textContent = d.name; it.label.querySelector('small').textContent = d.sub || ''; it.label.classList.toggle('centre', d.id === center); it.label.style.setProperty('--rh', d.hue || ''); it.label.setAttribute('aria-label', d.id === center ? d.name + ', centre' : d.name + ', ' + (d.sub || '') + '. Select to read their lines.'); }
    for (const [id, it] of items) if (!it.alive) { it.targetScale = 0.001; it.target.copy(it.pos).multiplyScalar(1.15); it.label.classList.add('gone'); }
    for (const it of items.values()) if (it.alive) it.label.classList.remove('gone');
    // orbit guides
    guides.forEach((g, gi) => {
      const rx = gi ? ix : ox, ry = gi ? iy : oy, pts = [];
      for (let k = 0; k < 96; k++) { const a = k / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry * 0.98 + (phone ? 1.5 : 0), Math.sin(a) * -4)); }
      g.geometry.dispose(); g.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      g.material.opacity = gi && !two ? 0 : 0.14;
    });
    halo.scale.setScalar(centreR); halo.position.set(0, phone ? 1.5 : 0, 3.5);
    O.geom = { nodeR, centreR };
    rebuildEdges();
  }
  function rebuildEdges() {
    edges.forEach(e => { e.mesh.geometry.dispose(); stage.remove(e.mesh); });
    edges = []; sparkData = [];
    const c = items.get(center); if (!c) return;
    for (const [id, it] of items) {
      if (!it.alive || it.isCenter) continue;
      const a = c.target.clone(), b = it.target.clone();
      const dirv = b.clone().sub(a), len = dirv.length(); dirv.normalize();
      const start = a.clone().add(dirv.clone().multiplyScalar(c.targetScale * 1.08));
      const end = b.clone().sub(dirv.clone().multiplyScalar(it.targetScale * 1.12));
      const side = new THREE.Vector3(-dirv.y, dirv.x, 0).multiplyScalar(len * 0.1);
      const mid = start.clone().add(end).multiplyScalar(0.5).add(side).add(new THREE.Vector3(0, 0, 6));
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const color = LINK[it.dir] || LINK.out;
      const mesh = tube(curve, it.dir === 'mutual' ? 0.2 : 0.14, color);
      mesh.userData.id = id; stage.add(mesh);
      edges.push({ id, mesh, curve, dir: it.dir });
      sparkData.push({ curve, dir: it.dir, id, color: new THREE.Color(color) });
    }
    if (sparks) { sparks.geometry.dispose(); stage.remove(sparks); }
    const per = 2, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sparkData.length * per * 3), 3));
    const cols = new Float32Array(sparkData.length * per * 3);
    sparkData.forEach((s, k) => { for (let j = 0; j < per; j++) s.color.toArray(cols, (k * per + j) * 3); });
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    sparks = new THREE.Points(g, new THREE.PointsMaterial({ map: discTexture(), size: 2.6, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    stage.add(sparks);
    fade = 0;
  }

  // picking
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const pick = e => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const faces = [...items.values()].filter(i => i.alive).map(i => i.m.face);
    const hit = ray.intersectObjects(faces, false)[0];
    return hit ? hit.object.userData.id : null;
  };
  let px = 0, py = 0;
  renderer.domElement.addEventListener('pointermove', e => {
    hover = pick(e); renderer.domElement.style.cursor = hover ? 'pointer' : 'default';
    const r = el.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - 0.5; py = (e.clientY - r.top) / r.height - 0.5;
  });
  renderer.domElement.addEventListener('pointerleave', () => { hover = null; px = py = 0; });
  renderer.domElement.addEventListener('click', e => { const id = pick(e); O.on.select(!id || id === center ? null : id); });

  let last = performance.now();
  const tmpV = new THREE.Vector3();
  const api = {
    running: true, on,
    set(data) {
      api.lastData = data;
      sel = data.sel || null;
      const key = data.key;
      fit();
      if (key !== layoutKey) { layoutKey = key; layout(data); }
      else { for (const it of items.values()) if (it.alive) it.label.classList.toggle('sel', it.label.dataset.id === sel); }
    },
    select(id) { sel = id; },
    loop() {
      if (api._on) return; api._on = true;
      const frame = t => {
        if (!api.running) { api._on = false; return; }
        const dt = Math.min(0.05, (t - last) / 1000); last = t;
        const time = t / 1000, k = reduce ? 1 : 1 - Math.pow(0.0009, dt);
        // gentle sway and pointer parallax give depth without moving anything out of place
        stage.rotation.y += ((reduce ? 0 : Math.sin(time * 0.25) * 0.05 + px * 0.16) - stage.rotation.y) * 0.05;
        stage.rotation.x += ((reduce ? 0 : py * 0.1) - stage.rotation.x) * 0.05;
        let moving = false;
        for (const [id, it] of items) {
          it.pos.lerp(it.target, k);
          if (it.pos.distanceToSquared(it.target) > 0.01) moving = true;
          const s = it.m.g.scale.x, ts = it.targetScale * (id === sel ? 1.18 : id === hover && !it.isCenter ? 1.08 : 1);
          it.m.g.scale.setScalar(s + (ts - s) * k);
          const bob = it.isCenter || reduce ? 0 : Math.sin(time * 0.9 + it.pos.x * 0.3) * 0.25;
          it.m.g.position.set(it.pos.x, it.pos.y + bob, it.pos.z);
          it.m.g.quaternion.copy(stage.quaternion).invert();
          const dim = sel && id !== sel && !it.isCenter ? 0.45 : 1;
          it.m.setOpacity(it.alive ? dim : Math.max(0, it.m.parts[0].opacity - dt * 3));
          if (!it.alive && it.m.g.scale.x < 0.05) { stage.remove(it.m.g); it.label.remove(); items.delete(id); }
        }
        halo.rotation.z += dt * 0.15; halo.children[1].rotation.x = Math.sin(time * 0.5) * 0.3;
        // links fade in once everything has settled
        fade = moving ? Math.max(0, fade - dt * 4) : Math.min(1, fade + dt * 1.6);
        for (const e of edges) {
          const on = !sel || e.id === sel, hot = e.id === hover;
          e.mesh.material.opacity = fade * (on ? (hot || e.id === sel ? 1 : e.dir === 'mutual' ? 0.75 : 0.55) : 0.12);
        }
        if (sparks) {
          const arr = sparks.geometry.attributes.position.array;
          sparkData.forEach((s, i) => {
            for (let j = 0; j < 2; j++) {
              let u = (time * 0.32 + j * 0.5 + i * 0.137) % 1;
              if (s.dir === 'in' || (s.dir === 'mutual' && j === 1)) u = 1 - u;
              s.curve.getPoint(u, tmpV).toArray(arr, (i * 2 + j) * 3);
            }
          });
          sparks.geometry.attributes.position.needsUpdate = true;
          sparks.material.opacity = fade * (sel ? 0.5 : 0.9);
        }
        // names sit under each portrait
        stage.updateMatrixWorld();
        for (const [id, it] of items) {
          const p = it.m.g.getWorldPosition(tmpV); p.y -= it.m.g.scale.x * 1.14;
          const s = project(p, camera, W, H);
          it.label.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px) translate(-50%, 0)';
          it.label.classList.toggle('sel', id === sel); it.label.classList.toggle('hot', id === hover);
          it.label.classList.toggle('dim', !!sel && id !== sel && !it.isCenter);
        }
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
  };
  let lastW = 0;
  new ResizeObserver(() => { if (!el.clientWidth || el.clientWidth === lastW) return; lastW = el.clientWidth; if (api.lastData) { layoutKey = ''; api.set(api.lastData); } else fit(); }).observe(el);
  new IntersectionObserver(es => { if (es[0].isIntersecting && !el.hidden) { api.running = true; api.loop(); } else api.running = false; }).observe(el);
  fit();
  return api;
}

// ---------------------------------------------------------------- 3D map: the whole cast as a calm galaxy of stars
// Everyone is a small star in their region. Selecting someone raises them and the people they talk about
// as portrait medallions, joined by arcs.
let M = null;
function starmap(el, data, onPick) {
  if (M) { M.running = true; M.loop(); return; }
  const world = data.world;
  const renderer = makeRenderer(el);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 1, 3000);
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(30, 50, 40); camera.add(key);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.25;
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.2;
  const accent = col('--accent', '#e6c98a');
  const small = innerWidth < 640 || matchMedia('(pointer: coarse)').matches;

  // graph
  const order = data.regionOrder || [];
  const regions = [...new Set(data.nodes.map(n => n.region))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const N = data.nodes.map(n => ({ ...n, p: new THREE.Vector3(), links: new Map() }));
  const at = Object.fromEntries(N.map((n, i) => [n.id, i]));
  for (const [a, b] of data.edges) {
    if (!(a in at) || !(b in at) || a === b) continue;
    const A = N[at[a]], B = N[at[b]];
    A.links.set(at[b], (A.links.get(at[b]) || '') + 'o'); B.links.set(at[a], (B.links.get(at[a]) || '') + 'i');
  }
  const hubCut = Math.max(40, N.length * 0.45);
  N.forEach(n => { n.hub = n.links.size > hubCut; });

  // layout: each region a flat disc of stars (sunflower spiral), discs spaced around a ring, hubs in the middle
  const SP = 7.5, C = SP / Math.sqrt(Math.PI) * 1.05;
  const groups = regions.map(r => ({ r, m: N.filter(n => n.region === r && !n.hub).sort((a, b) => b.links.size - a.links.size) })).filter(g => g.m.length);
  groups.forEach(g => { g.rad = Math.max(SP * 0.8, C * Math.sqrt(g.m.length) + 2); });
  const GAP = SP * 2.4;
  const total = groups.reduce((a, g) => a + g.rad * 2 + GAP, 0);
  const RING = Math.max(total / (Math.PI * 2), Math.max(...groups.map(g => g.rad)) + 26);
  let ang = -Math.PI / 2;
  groups.forEach(g => {
    const share = (g.rad * 2 + GAP) / total * Math.PI * 2, a = ang + share / 2; ang += share;
    g.c = new THREE.Vector3(Math.cos(a) * RING, 0, Math.sin(a) * RING);
    g.m.forEach((n, k) => { const r = C * Math.sqrt(k + 0.5), t = k * 2.39996; n.p.set(g.c.x + Math.cos(t) * r, 0, g.c.z + Math.sin(t) * r); });
  });
  const hubs = N.filter(n => n.hub);
  hubs.forEach((n, k) => n.p.set((k - (hubs.length - 1) / 2) * 10, 0, 0));
  const BOUND = RING + Math.max(...groups.map(g => g.rad)) + 8;

  // stars
  const pos = new Float32Array(N.length * 3), colr = new Float32Array(N.length * 3);
  N.forEach((n, i) => { n.p.toArray(pos, i * 3); new THREE.Color(n.color || '#e6c98a').toArray(colr, i * 3); });
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ map: discTexture(), size: 6.5, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(stars);
  const cores = new THREE.Points(sg, new THREE.PointsMaterial({ map: discTexture(), size: 2.2, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(cores);
  // region rings and names
  const regionLabels = [];
  const overlay = document.createElement('div'); overlay.className = 'm-labels'; el.appendChild(overlay);
  for (const g of groups) {
    const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; pts.push(new THREE.Vector3(g.c.x + Math.cos(a) * (g.rad + 3), 0, g.c.z + Math.sin(a) * (g.rad + 3))); }
    const hue = (data.regionHue || {})[g.r] || '#e6c98a';
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: hue, transparent: true, opacity: 0.35, depthWrite: false })));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(g.rad + 3, 64), new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.copy(g.c); disc.position.y = -0.2; scene.add(disc);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'm-region'; b.style.setProperty('--rh', hue);
    b.innerHTML = '<span></span><small></small>'; b.firstChild.textContent = g.r; b.lastChild.textContent = String(g.m.length);
    b.addEventListener('click', () => flyTo(g.c.clone(), BOUND * 0.55));
    overlay.appendChild(b); regionLabels.push({ el: b, p: new THREE.Vector3(g.c.x, 0, g.c.z - g.rad - 6) });
  }
  scene.add(new THREE.Points(shell(small ? 300 : 700, BOUND * 2.2, BOUND * 3.6, 5), new THREE.PointsMaterial({ map: discTexture(), color: 0xcfd6ee, size: 2.6, transparent: true, opacity: 0.45, depthWrite: false })));

  // medallions, created when someone lights up
  const meds = new Map();
  function med(i) {
    let m = meds.get(i); if (m) return m;
    m = medallion(N[i].img, N[i].color || '#e6c98a', accent);
    m.g.position.copy(N[i].p); m.g.scale.setScalar(0.001); m.face.userData.i = i; m.ts = 0.001;
    scene.add(m.g); meds.set(i, m); return m;
  }
  let arcs = [], sparkCurves = [], focused = -1, hover = -1;
  const sparkGeo = new THREE.BufferGeometry();
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: discTexture(), size: 3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(sparks);
  const names = document.createElement('div'); names.className = 'm-names'; el.appendChild(names);
  let nameEls = [];

  const tip = document.createElement('div'); tip.className = 'map-tip'; tip.hidden = true; el.appendChild(tip);
  const hint = document.createElement('div'); hint.className = 'map-hint'; hint.textContent = small ? 'Drag to turn · pinch to zoom · tap a star' : 'Drag to turn · scroll to zoom · select a star or a region name'; el.appendChild(hint);

  function fitDistance() {
    const v = THREE.MathUtils.degToRad(camera.fov / 2), aspect = Math.max(0.3, (el.clientWidth || 1) / (el.clientHeight || 1));
    return BOUND / Math.min(Math.tan(v), Math.tan(v) * aspect) * 0.95;
  }
  const ELEV = 0.95;
  function home() { const d0 = fitDistance(); controls.target.set(0, 0, 0); camera.position.set(0, Math.sin(ELEV) * d0, Math.cos(ELEV) * d0); }
  controls.minDistance = 25; controls.maxDistance = BOUND * 5;
  let tween = null;
  function flyTo(target, dist) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    tween = { t: 0, fromT: controls.target.clone(), toT: target, fromC: camera.position.clone(), toC: target.clone().add(dir.multiplyScalar(dist)) };
    controls.autoRotate = false;
  }

  function focusIndex(i) {
    focused = i; const n = N[i];
    arcs.forEach(a => { a.mesh.geometry.dispose(); scene.remove(a.mesh); });
    arcs = []; sparkCurves = [];
    for (const m of meds.values()) m.ts = 0.001;
    const lit = new Set([i, ...n.links.keys()]);
    const big = n.links.size > 24;
    med(i).ts = n.hub ? 5.2 : 4.2;
    const cols = [];
    for (const [j, how] of n.links) {
      const m = med(j); m.ts = big ? 1.9 : 2.5;
      const kind = how.includes('o') && how.includes('i') ? 'mutual' : how.includes('o') ? 'out' : 'in';
      const a = n.p.clone().add(new THREE.Vector3(0, 3, 0)), b = N[j].p.clone().add(new THREE.Vector3(0, 3, 0));
      const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 4 + a.distanceTo(b) * 0.28;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const mesh = tube(curve, kind === 'mutual' ? 0.22 : 0.15, LINK[kind]); mesh.material.opacity = kind === 'mutual' ? 0.8 : 0.55;
      scene.add(mesh); arcs.push({ mesh, j });
      sparkCurves.push({ curve, back: kind === 'in' });
      new THREE.Color(LINK[kind]).toArray(cols, cols.length);
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sparkCurves.length * 3), 3));
    sparkGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    // dim stars that are not part of this
    const c = sg.attributes.color.array;
    N.forEach((m, k) => { const base = new THREE.Color(m.color || '#e6c98a'); if (!lit.has(k)) base.multiplyScalar(0.28); base.toArray(c, k * 3); });
    sg.attributes.color.needsUpdate = true;
    names.replaceChildren(); nameEls = [];
    const show = [i, ...(n.links.size <= 18 ? n.links.keys() : [])];
    for (const k of show) { const d = document.createElement('span'); d.className = 'm-name' + (k === i ? ' main' : ''); d.textContent = N[k].name; names.appendChild(d); nameEls.push({ el: d, k }); }
    const target = n.hub ? new THREE.Vector3() : n.p.clone().multiplyScalar(0.5);
    flyTo(target, fitDistance() * (n.hub ? 1 : 0.78));
  }

  const ray = new THREE.Raycaster(); ray.params.Points.threshold = 3.2;
  const mouse = new THREE.Vector2();
  const pickAt = e => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const faces = [...meds.values()].filter(m => m.ts > 0.01).map(m => m.face);
    const hf = ray.intersectObjects(faces, false)[0]; if (hf) return hf.object.userData.i;
    const hs = ray.intersectObject(stars, false)[0]; return hs ? hs.index : -1;
  };
  let down = null;
  renderer.domElement.addEventListener('pointermove', e => {
    hover = pickAt(e); renderer.domElement.style.cursor = hover >= 0 ? 'pointer' : 'grab';
    if (hover >= 0) { const r = el.getBoundingClientRect(); tip.textContent = N[hover].name + ' · ' + N[hover].region; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.hidden = false; } else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; hover = -1; });
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; controls.autoRotate = false; hint.hidden = true; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const i = pickAt(e); if (i >= 0) { focusIndex(i); onPick(N[i].id); }
  });

  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let last = performance.now(); const tmp = new THREE.Vector3();
  const api = {
    running: true,
    focus(id) { if (id in at && at[id] !== focused) focusIndex(at[id]); },
    loop() {
      if (api._on) return; api._on = true;
      const frame = t => {
        if (!api.running) { api._on = false; return; }
        const dt = Math.min(0.05, (t - last) / 1000); last = t; const time = t / 1000;
        if (tween) { tween.t = Math.min(1, tween.t + dt / (reduce ? 0.01 : 1.1)); const k = ease(tween.t); controls.target.lerpVectors(tween.fromT, tween.toT, k); camera.position.lerpVectors(tween.fromC, tween.toC, k); if (tween.t >= 1) tween = null; }
        controls.update();
        for (const [i, m] of meds) {
          const s = m.g.scale.x, ts = m.ts * (i === hover && m.ts > 0.01 ? 1.15 : 1);
          m.g.scale.setScalar(s + (ts - s) * 0.12);
          m.g.position.set(N[i].p.x, N[i].p.y + 3 + (i === focused ? 2 : 0) + Math.sin(time + i) * 0.3, N[i].p.z);
          m.g.quaternion.copy(camera.quaternion);
          m.g.visible = m.g.scale.x > 0.01;
        }
        if (sparkCurves.length) {
          const arr = sparkGeo.attributes.position.array;
          sparkCurves.forEach((c, k) => { let u = (time * 0.3 + k * 0.131) % 1; if (c.back) u = 1 - u; c.curve.getPoint(u, tmp).toArray(arr, k * 3); });
          sparkGeo.attributes.position.needsUpdate = true;
        }
        const w = el.clientWidth, h = el.clientHeight;
        for (const L of regionLabels) { const s = project(L.p, camera, w, h); L.el.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px) translate(-50%,-50%)'; L.el.style.opacity = s.z < 1 ? '' : '0'; }
        for (const L of nameEls) { const m = meds.get(L.k); if (!m) continue; tmp.copy(m.g.position); tmp.y -= m.g.scale.x * 1.2; const s = project(tmp, camera, w, h); L.el.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px) translate(-50%,0)'; L.el.style.opacity = m.g.scale.x > 0.6 && s.z < 1 ? '' : '0'; }
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
  };
  let fitted = false;
  new ResizeObserver(() => { fit(el, renderer, camera); if (!fitted && el.clientWidth) { fitted = true; if (focused < 0) home(); } }).observe(el);
  new IntersectionObserver(es => { if (es[0].isIntersecting && !el.hidden) { api.running = true; api.loop(); } else api.running = false; }).observe(el);
  fit(el, renderer, camera); home();
  M = api; api.loop();
}

// ---------------------------------------------------------------- profile showcase
// The art stays steady and faces you. Depth comes from parallax: the camera drifts a little with the pointer
// (or a finger drag), so the halo, light beams and particles behind and in front of the art move at different speeds.
let S = null;
function haloTexture(world) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.translate(256, 256); g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 236, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 214, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, l = i % 10 ? 7 : 18; g.lineWidth = i % 10 ? 1 : 2.5; g.beginPath(); g.moveTo(Math.cos(a) * 214, Math.sin(a) * 214); g.lineTo(Math.cos(a) * (214 - l), Math.sin(a) * (214 - l)); g.stroke(); }
  g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 160, 0, Math.PI * 2); g.stroke();
  const sides = world === 'wuwa' ? 4 : 8;
  for (const rot of [0, Math.PI / sides]) { g.beginPath(); for (let i = 0; i <= sides; i++) { const a = rot + i / sides * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 160, Math.sin(a) * 160); } g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.save(); g.rotate(a); g.translate(0, -190); if (world === 'wuwa') { g.rotate(Math.PI / 4); g.strokeRect(-5, -5, 10, 10); } else { g.beginPath(); g.moveTo(0, -8); g.lineTo(3, 0); g.lineTo(0, 8); g.lineTo(-3, 0); g.closePath(); g.fill(); } g.restore(); }
  return new THREE.CanvasTexture(c);
}
function beamTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.45, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}
function motes(count, zMin, zMax, size) {
  const p = new Float32Array(count * 3), seeds = [];
  for (let i = 0; i < count; i++) seeds.push([Math.random() * 2 - 1, Math.random() * 2 - 1, zMin + Math.random() * (zMax - zMin), 0.08 + Math.random() * 0.22, Math.random() * Math.PI * 2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: discTexture(), size, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.userData.seeds = seeds;
  return pts;
}
function showcase(el, o, onReady) {
  if (!el) return;
  if (!S) {
    const renderer = makeRenderer(el, { powerPreference: 'default' });
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    camera.position.set(0, 0, 8);
    const dot = discTexture(), add = THREE.AdditiveBlending;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, transparent: true, opacity: 0.6, depthWrite: false, blending: add }));
    glow.position.z = -3.2;
    const haloA = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, depthWrite: false, blending: add }));
    const haloB = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false, blending: add }));
    haloA.position.z = -1.6; haloB.position.z = -2.4;
    const beamTex = beamTexture(), beams = [];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.55 + i * 0.12, 7), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.1, depthWrite: false, blending: add }));
      b.position.z = -2 - i * 0.25; b.userData.phase = i * 1.7; beams.push(b);
    }
    // the art: a basic material with a soft light sheen that follows the pointer
    const uSheen = { value: 0.2 };
    const artMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.03 });
    artMat.onBeforeCompile = sh => {
      sh.uniforms.uSheen = uSheen;
      sh.fragmentShader = 'uniform float uSheen;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n  float sheenBand = exp(-pow((vMapUv.x * 0.8 + (1.0 - vMapUv.y) * 0.45 - uSheen) * 6.5, 2.0));\n  diffuseColor.rgb += sheenBand * 0.13 * diffuseColor.a;');
    };
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), artMat);
    const back = motes(70, -2.6, -0.6, 0.06), front = motes(26, 0.6, 2.2, 0.1);
    scene.add(glow, haloB, haloA, ...beams, back, art, front);
    const st = { renderer, scene, camera, glow, haloA, haloB, beams, art, back, front, uSheen, p: { x: 0, y: 0 }, t: { x: 0, y: 0 }, running: false };
    // pointer and touch: hover moves the view on a desktop, a drag moves it on a phone, and it eases back when you let go
    const host = () => st.host;
    const onMove = e => {
      const r = host().getBoundingClientRect();
      if (e.pointerType === 'mouse' || st.drag) { st.t.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)); st.t.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2)); }
    };
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') st.drag = true; });
    dom.addEventListener('pointermove', onMove);
    const rest = () => { st.drag = false; st.t.x = 0; st.t.y = 0; };
    dom.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') rest(); });
    dom.addEventListener('pointercancel', rest);
    dom.addEventListener('pointerleave', rest);
    let last = performance.now();
    st.frame = now => {
      if (!st.running) { st._on = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const time = now / 1000;
      const idleX = reduce ? 0 : Math.sin(time * 0.35) * 0.18, idleY = reduce ? 0 : Math.sin(time * 0.27) * 0.1;
      const k = 1 - Math.pow(0.002, dt);
      st.p.x += (st.t.x + idleX - st.p.x) * k; st.p.y += (st.t.y + idleY - st.p.y) * k;
      const c = st.center || { x: 0, y: 0 };
      st.camera.position.set(c.x + st.p.x * 0.75, c.y - st.p.y * 0.4, 8);
      st.camera.lookAt(c.x + st.p.x * 0.12, c.y - st.p.y * 0.06, 0);
      st.art.rotation.y = st.p.x * 0.06; st.art.rotation.x = st.p.y * 0.03;
      st.art.position.y = st.baseY + (reduce ? 0 : Math.sin(time * 1.1) * 0.02);
      st.haloA.rotation.z += dt * 0.12; st.haloB.rotation.z -= dt * 0.07;
      st.beams.forEach(b => { b.rotation.z = Math.sin(time * 0.3 + b.userData.phase) * 0.18 + (b.userData.phase % 2 ? 0.22 : -0.22); b.material.opacity = 0.07 + Math.sin(time * 0.6 + b.userData.phase) * 0.035; });
      st.uSheen.value = 0.55 + st.p.x * 0.55 + Math.sin(time * 0.25) * 0.08;
      for (const pts of [st.back, st.front]) {
        const a = pts.geometry.attributes.position.array, w = st.vw || 4, h = st.vh || 4;
        pts.userData.seeds.forEach((s, i) => {
          const y = ((s[1] * 0.5 + 0.5 + time * s[3] * 0.25) % 1) * h * 1.1 - h * 0.55;
          a[i * 3] = c.x * 0.5 + s[0] * w * 0.55 + Math.sin(time * 0.5 + s[4]) * 0.08; a[i * 3 + 1] = y; a[i * 3 + 2] = s[2];
        });
        pts.geometry.attributes.position.needsUpdate = true;
      }
      st.renderer.render(st.scene, st.camera);
      requestAnimationFrame(st.frame);
    };
    new ResizeObserver(() => { if (st.host && st.host.isConnected) { fit(st.host, renderer, camera); place(st); } }).observe(document.body);
    S = st;
  }
  const st = S;
  st.host = el; el.appendChild(st.renderer.domElement);
  fit(el, st.renderer, st.camera);
  const c = new THREE.Color(o.color || '#e6c98a');
  for (const m of [st.glow.material, st.haloA.material, st.haloB.material, st.back.material, st.front.material, ...st.beams.map(b => b.material)]) m.color = c;
  if (st.haloWorld !== o.world) { st.haloTex = haloTexture(o.world); st.haloWorld = o.world; }
  st.haloA.material.map = st.haloTex; st.haloB.material.map = st.haloTex; st.haloA.material.needsUpdate = st.haloB.material.needsUpdate = true;
  st.world = o.world; st.isIcon = o.isIcon; st.t.x = st.t.y = 0;
  const token = (st.token = (st.token || 0) + 1);
  loader.load(o.art, tex => {
    if (token !== st.token) { tex.dispose(); return; }
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    if (st.tex) st.tex.dispose();
    st.tex = tex; st.aspect = tex.image.width / tex.image.height;
    st.art.material.map = tex; st.art.material.needsUpdate = true;
    place(st);
    st.p.x = -0.6;
    st.running = true; if (!st._on) { st._on = true; requestAnimationFrame(st.frame); }
    if (onReady) onReady();
  });
}
function place(st) {
  if (!st.aspect) return;
  const cam = st.camera, vh = 2 * Math.tan(cam.fov * Math.PI / 360) * cam.position.z, vw = vh * cam.aspect;
  st.vw = vw; st.vh = vh;
  let H = st.isIcon ? vh * 0.55 : st.world === 'wuwa' ? vh * 1.42 : vh * 1.02, W = H * st.aspect;
  if (W > vw * 1.1) { W = vw * 1.1; H = W / st.aspect; }
  const x = Math.max(0, vw / 2 - W / 2 - vw * 0.03);
  const y = st.isIcon ? vh * 0.12 : st.world === 'wuwa' ? vh / 2 - H / 2 + vh * 0.04 : vh * 0.06;
  st.art.scale.set(W, H, 1); st.art.position.set(x, y, 0); st.baseY = y;
  // halo sits behind the head and shoulders
  const hy = st.isIcon ? y : st.world === 'wuwa' ? y + H * 0.2 : y + H * 0.06;
  const hs = Math.min(vw, vh) * (st.isIcon ? 0.7 : 0.82);
  st.haloA.scale.setScalar(hs); st.haloA.position.set(x, hy, -1.6);
  st.haloB.scale.setScalar(hs * 1.45); st.haloB.position.set(x, hy, -2.4);
  st.glow.scale.set(hs * 2.2, hs * 2.2, 1); st.glow.position.set(x, hy, -3.2);
  st.beams.forEach((b, i) => b.position.set(x + (i - 1.5) * hs * 0.32, hy - vh * 0.05, b.position.z));
  st.center = { x: 0, y: 0 };
}

window.LoreScene = {
  hero(el, world) { try { hero(el, world); } catch (e) { console.warn('3D hero unavailable', e); } },
  starmap(el, data, onPick) { try { starmap(el, data, onPick); } catch (e) { console.warn('3D map unavailable', e); el.textContent = '3D view is not available in this browser.'; } },
  focus(id) { if (M) M.focus(id); },
  orbit(el, data, on) { orbit(el, data, on); },
  orbitPause() { if (O) O.running = false; },
  pause() { if (M) M.running = false; },
  showcase(el, o, onReady) { try { showcase(el, o, onReady); } catch (e) { console.warn('3D showcase unavailable', e); } },
  showcaseStop() { if (S) S.running = false; },
};
document.dispatchEvent(new Event('lorescene'));
