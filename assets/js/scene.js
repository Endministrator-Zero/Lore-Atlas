/* Lore Atlas 3D scenes, built with three.js.
   hero(el, world)                      the rotating centrepiece in the page header
   starmap(el, data, onPick)            the whole cast as 3D medallions you can orbit and click
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
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

// ---------------------------------------------------------------- star map of medallions
let M = null;
function starmap(el, data, onPick) {
  if (M) { M.running = true; M.loop(); return; }
  const world = data.world;
  const renderer = makeRenderer(el);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1400);
  camera.position.set(0, 40, 250);
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(30, 50, 40); camera.add(key);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.35;
  controls.minDistance = 18; controls.maxDistance = 460; controls.enablePan = false;
  const accent = col('--accent', '#e6c98a'), bright = col('--accent2', '#fff0c9');
  const dot = discTexture();

  // layout: regions on a sphere, characters clustered around their region, then a short relaxation
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const regions = [...new Set(data.nodes.map(n => n.region))];
  const centre = {};
  regions.forEach((r, i) => { const y = 1 - (i + 0.5) / regions.length * 2, q = Math.sqrt(1 - y * y), a = i * 2.39996; centre[r] = new THREE.Vector3(Math.cos(a) * q, y * 0.7, Math.sin(a) * q).multiplyScalar(70 + data.nodes.length * 0.42); });
  const N = data.nodes.map(n => ({ ...n, p: centre[n.region].clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(46)), links: new Set() }));
  const at = Object.fromEntries(N.map((n, i) => [n.id, i]));
  const pairs = new Map();
  for (const [a, b] of data.edges) { if (!(a in at) || !(b in at) || a === b) continue; const k = a < b ? a + '|' + b : b + '|' + a; if (!pairs.has(k)) pairs.set(k, [at[a], at[b]]); N[at[a]].links.add(at[b]); N[at[b]].links.add(at[a]); }
  const E = [...pairs.values()];
  const hubCut = Math.max(40, N.length * 0.45);
  const d = new THREE.Vector3();
  for (let it = 0; it < 140; it++) {
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      d.subVectors(N[i].p, N[j].p); const len = d.length() || 0.01;
      if (len < 19) { d.multiplyScalar((19 - len) / len * 0.5); N[i].p.add(d); N[j].p.sub(d); }
    }
    for (const [i, j] of E) {
      if (N[i].links.size > hubCut || N[j].links.size > hubCut) continue;
      d.subVectors(N[j].p, N[i].p); const len = d.length() || 0.01;
      if (len > 26) { d.multiplyScalar((len - 26) / len * 0.03); N[i].p.add(d); N[j].p.sub(d); }
    }
    for (const n of N) n.p.lerp(n.links.size > hubCut ? new THREE.Vector3(0, 0, 0) : centre[n.region], n.links.size > hubCut ? 0.08 : 0.012);
  }

  // medallions: portrait face, metal rim in the element colour, dark back, all lit so they read as objects
  const faceGeo = new THREE.CircleGeometry(1, 48), backGeo = new THREE.CircleGeometry(1.02, 48);
  const rimGeo = new THREE.TorusGeometry(1.03, 0.055, 10, 64), edgeGeo = new THREE.CylinderGeometry(1.04, 1.04, 0.16, 64, 1, true);
  edgeGeo.rotateX(Math.PI / 2);
  const rimMat = hex => new THREE.MeshStandardMaterial({ color: hex, metalness: 0.7, roughness: 0.32, emissive: new THREE.Color(hex).multiplyScalar(0.2), transparent: true });
  const backMat = () => new THREE.MeshStandardMaterial({ color: 0x1a1d24, metalness: 0.6, roughness: 0.5, transparent: true });
  const edgeMat = () => new THREE.MeshStandardMaterial({ color: accent, metalness: 0.85, roughness: 0.3, transparent: true, side: THREE.DoubleSide });
  const group = new THREE.Group(); scene.add(group);
  const faces = [];
  N.forEach((n, i) => {
    const size = 2.5 + Math.min(n.links.size, 30) * 0.05;
    const g = new THREE.Group(); g.position.copy(n.p); g.scale.setScalar(size);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    loader.load(n.img, tex => { tex.colorSpace = THREE.SRGBColorSpace; mat.map = tex; mat.needsUpdate = true; });
    const face = new THREE.Mesh(faceGeo, mat); face.position.z = 0.081; face.userData.i = i;
    const back = new THREE.Mesh(backGeo, backMat()); back.rotation.y = Math.PI; back.position.z = -0.081;
    const rim = new THREE.Mesh(rimGeo, rimMat(n.color || '#e6c98a'));
    const edge = new THREE.Mesh(edgeGeo, edgeMat());
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: new THREE.Color(n.color || '#e6c98a'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(3.4); glow.position.z = -0.3;
    g.add(glow, back, edge, face, rim);
    g.userData.phase = rnd() * Math.PI * 2;
    group.add(g); faces.push(face);
    Object.assign(n, { g, face, mat, rim, glow, size, parts: [rim.material, back.material, edge.material] });
  });

  // links: curved arcs, plus a brighter set with travelling sparks for the selected character
  const curveOf = (a, b) => {
    const mid = a.clone().add(b).multiplyScalar(0.5), lift = mid.length() < 1 ? new THREE.Vector3(0, 1, 0) : mid.clone().normalize();
    return new THREE.QuadraticBezierCurve3(a, mid.add(lift.multiplyScalar(a.distanceTo(b) * 0.22)), b);
  };
  const SEG = 12;
  const lp = new Float32Array(E.length * SEG * 6);
  E.forEach(([i, j], k) => {
    const pts = curveOf(N[i].p, N[j].p).getPoints(SEG);
    for (let s = 0; s < SEG; s++) { pts[s].toArray(lp, (k * SEG + s) * 6); pts[s + 1].toArray(lp, (k * SEG + s) * 6 + 3); }
  });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const web = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.08, depthWrite: false }));
  group.add(web);
  const hot = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: 0.75, depthWrite: false }));
  group.add(hot);
  let sparkCurves = [];
  const SPARKS = 3;
  const sparkGeo = new THREE.BufferGeometry();
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: dot, color: bright, size: 3.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(sparks);

  // region names floating over each cluster
  const labels = [];
  for (const r of regions) {
    const members = N.filter(n => n.region === r && n.links.size <= hubCut);
    if (!members.length) continue;
    const c = members.reduce((v, n) => v.add(n.p), new THREE.Vector3()).multiplyScalar(1 / members.length);
    const s = textSprite(r, (data.regionHue || {})[r] || '#e6c98a', world);
    s.position.copy(c.multiplyScalar(1.18)); s.position.y += 16; group.add(s); labels.push(s);
  }
  scene.add(new THREE.Points(shell(900, 300, 600, 5), new THREE.PointsMaterial({ map: dot, color: 0xcfd6ee, size: 2.2, transparent: true, opacity: 0.55, depthWrite: false })));

  const tip = document.createElement('div'); tip.className = 'map-tip'; tip.hidden = true; el.appendChild(tip);
  const hint = document.createElement('div'); hint.className = 'map-hint'; hint.textContent = 'Drag to orbit · scroll to zoom · select a medallion'; el.appendChild(hint);
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hover = -1, focused = -1, down = null, tween = null;
  const pickAt = e => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(faces, false)[0];
    return hit ? hit.object.userData.i : -1;
  };
  renderer.domElement.addEventListener('pointermove', e => {
    hover = pickAt(e); renderer.domElement.style.cursor = hover >= 0 ? 'pointer' : 'grab';
    if (hover >= 0) { const r = el.getBoundingClientRect(); tip.textContent = N[hover].name; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.hidden = false; } else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; hover = -1; });
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; controls.autoRotate = false; hint.hidden = true; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const i = pickAt(e); if (i >= 0) { focusIndex(i); onPick(N[i].id); }
  });

  function focusIndex(i) {
    focused = i; const n = N[i];
    const hp = []; sparkCurves = [];
    N.forEach((m, k) => {
      const near = k === i || n.links.has(k);
      const op = near ? 1 : 0.1;
      m.mat.opacity = op; m.parts.forEach(p => { p.opacity = near ? 1 : 0.08; }); m.glow.material.opacity = k === i ? 0.95 : near ? 0.45 : 0.04;
      m.g.userData.target = k === i ? m.size * 1.7 : near ? m.size * 1.1 : m.size * 0.8;
      m.g.userData.dim = !near;
      if (k !== i && near) {
        const c = curveOf(n.p, m.p); sparkCurves.push(c);
        const pts = c.getPoints(SEG); for (let s = 0; s < SEG; s++) hp.push(...pts[s].toArray(), ...pts[s + 1].toArray());
      }
    });
    hot.geometry.dispose(); hot.geometry = new THREE.BufferGeometry(); hot.geometry.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sparkCurves.length * SPARKS * 3), 3));
    web.material.opacity = 0.035;
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = Math.min(260, 110 + n.links.size * 1.4);
    tween = { t: 0, fromT: controls.target.clone(), toT: n.p.clone(), fromC: camera.position.clone(), toC: n.p.clone().add(dir.multiplyScalar(dist)) };
  }
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const q = new THREE.Quaternion(), tmp = new THREE.Object3D();
  let last = performance.now();
  const api = {
    running: true,
    focus(id) { if (id in at && at[id] !== focused) focusIndex(at[id]); },
    loop() {
      if (api._on) return; api._on = true;
      const frame = t => {
        if (!api.running) { api._on = false; return; }
        const dt = Math.min(0.05, (t - last) / 1000); last = t;
        const time = t / 1000;
        if (tween) { tween.t = Math.min(1, tween.t + dt / (reduce ? 0.01 : 0.9)); const k = ease(tween.t); controls.target.lerpVectors(tween.fromT, tween.toT, k); camera.position.lerpVectors(tween.fromC, tween.toC, k); if (tween.t >= 1) tween = null; }
        controls.update();
        // medallions turn towards the camera with a little lag, so orbiting shows their metal edge
        for (const n of N) {
          tmp.position.copy(n.g.position); tmp.lookAt(camera.position);
          q.copy(tmp.quaternion);
          const wob = Math.sin(time * 0.8 + n.g.userData.phase) * 0.18;
          q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(wob * 0.4, wob, 0)));
          n.g.quaternion.slerp(q, reduce ? 1 : 0.06);
          const ts = n.g.userData.target || n.size; n.g.scale.setScalar(n.g.scale.x + (ts - n.g.scale.x) * 0.12);
        }
        if (sparkCurves.length) {
          const arr = sparkGeo.attributes.position.array;
          sparkCurves.forEach((c, k) => { for (let s = 0; s < SPARKS; s++) { const u = (time * 0.35 + s / SPARKS + k * 0.137) % 1; c.getPoint(u).toArray(arr, (k * SPARKS + s) * 3); } });
          sparkGeo.attributes.position.needsUpdate = true;
        }
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
  };
  new ResizeObserver(() => fit(el, renderer, camera)).observe(el);
  new IntersectionObserver(es => { if (es[0].isIntersecting && !el.hidden) { api.running = true; api.loop(); } else api.running = false; }).observe(el);
  fit(el, renderer, camera);
  M = api; api.loop();
}

// ---------------------------------------------------------------- profile showcase
let S = null;
function runeTexture(world) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.translate(256, 256); g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 240, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 206, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 150, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, l = i % 6 ? 10 : 24; g.lineWidth = i % 6 ? 1.5 : 3; g.beginPath(); g.moveTo(Math.cos(a) * 206, Math.sin(a) * 206); g.lineTo(Math.cos(a) * (206 + l), Math.sin(a) * (206 + l)); g.stroke(); }
  const sides = world === 'wuwa' ? 4 : 8;
  for (const rot of [0, Math.PI / sides]) { g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i <= sides; i++) { const a = rot + i / sides * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 150, Math.sin(a) * 150); } g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.save(); g.rotate(a); g.translate(0, -178); if (world === 'wuwa') { g.rotate(Math.PI / 4); g.strokeRect(-6, -6, 12, 12); } else { g.beginPath(); g.moveTo(0, -9); g.lineTo(3, 0); g.lineTo(0, 9); g.lineTo(-3, 0); g.closePath(); g.fill(); } g.restore(); }
  const t = new THREE.CanvasTexture(c); return t;
}
function showcase(el, o, onReady) {
  if (!el) return;
  if (!S) {
    const renderer = makeRenderer(el, { powerPreference: 'default' });
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 7);
    const rig = new THREE.Group(); scene.add(rig);
    const dot = discTexture();
    const back = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    back.scale.set(7, 7, 1); back.position.z = -1.6; rig.add(back);
    const ringA = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ringB = ringA.clone(); ringB.material = ringA.material.clone(); ringB.scale.setScalar(0.62);
    ringA.rotation.x = ringB.rotation.x = -Math.PI / 2 + 0.12; rig.add(ringA, ringB);
    const sil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.03 }));
    sil.position.z = -0.25; rig.add(sil, art);
    const P = 170, pp = new Float32Array(P * 3), seeds = [];
    for (let i = 0; i < P; i++) seeds.push([Math.random() * Math.PI * 2, 1.2 + Math.random() * 1.6, Math.random() * 5 - 2.5, 0.15 + Math.random() * 0.45]);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const motes = new THREE.Points(pg, new THREE.PointsMaterial({ map: dot, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    rig.add(motes);
    const st = { renderer, scene, camera, rig, back, ringA, ringB, sil, art, motes, seeds, pp, yaw: 0, pitch: 0, ty: 0, tp: 0, drag: null, running: false, tex: null };
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', e => { st.drag = [e.clientX, e.clientY, st.ty, st.tp]; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => {
      if (st.drag) { st.ty = Math.max(-0.75, Math.min(0.75, st.drag[2] + (e.clientX - st.drag[0]) * 0.006)); st.tp = Math.max(-0.22, Math.min(0.22, st.drag[3] + (e.clientY - st.drag[1]) * 0.003)); }
      else { const r = dom.getBoundingClientRect(); st.hx = ((e.clientX - r.left) / r.width - 0.5) * 0.25; st.hy = ((e.clientY - r.top) / r.height - 0.5) * 0.1; }
    });
    const end = () => { st.drag = null; };
    dom.addEventListener('pointerup', end); dom.addEventListener('pointercancel', end);
    dom.addEventListener('pointerleave', () => { st.hx = st.hy = 0; });
    let last = performance.now();
    st.frame = t => {
      if (!st.running) { st._on = false; return; }
      const dt = Math.min(0.05, (t - last) / 1000); last = t; const time = t / 1000;
      if (!st.drag) { st.ty += ((reduce ? 0 : Math.sin(time * 0.45) * 0.14) + (st.hx || 0) - st.ty) * 0.05; st.tp += ((st.hy || 0) - st.tp) * 0.05; }
      st.yaw += (st.ty - st.yaw) * 0.12; st.sil.position.z = -0.5; st.pitch += (st.tp - st.pitch) * 0.12;
      st.rig.rotation.y = st.yaw; st.rig.rotation.x = st.pitch;
      st.sil.position.x = st.art.position.x - st.yaw * 0.35;
      st.ringA.rotation.z += dt * 0.15; st.ringB.rotation.z -= dt * 0.3;
      const a = st.pp;
      st.seeds.forEach((s, i) => { const y = ((s[2] + time * s[3] + 2.5) % 5) - 2.5; const ang = s[0] + time * 0.2; a[i * 3] = Math.cos(ang) * s[1] + st.art.position.x * 0.6; a[i * 3 + 1] = y; a[i * 3 + 2] = Math.sin(ang) * s[1] * 0.6; });
      st.motes.geometry.attributes.position.needsUpdate = true;
      st.renderer.render(st.scene, st.camera);
      requestAnimationFrame(st.frame);
    };
    new ResizeObserver(() => { if (st.host) { fit(st.host, renderer, camera); place(st); } }).observe(document.body);
    S = st;
  }
  const st = S;
  st.host = el; el.appendChild(st.renderer.domElement);
  fit(el, st.renderer, st.camera);
  const c = new THREE.Color(o.color || '#e6c98a');
  st.back.material.color = c; st.sil.material.color = c; st.motes.material.color = c;
  if (!st.runes || st.runesWorld !== o.world) { st.runes = runeTexture(o.world); st.runesWorld = o.world; }
  for (const r of [st.ringA, st.ringB]) { r.material.map = st.runes; r.material.color = c; r.material.needsUpdate = true; }
  st.world = o.world; st.isIcon = o.isIcon;
  const token = (st.token = (st.token || 0) + 1);
  loader.load(o.art, tex => {
    if (token !== st.token) { tex.dispose(); return; }
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    if (st.tex) st.tex.dispose();
    st.tex = tex; st.aspect = tex.image.width / tex.image.height;
    st.art.material.map = tex; st.art.material.needsUpdate = true;
    st.sil.material.map = tex; st.sil.material.needsUpdate = true;
    place(st);
    st.yaw = -0.35; st.ty = 0;
    st.running = true; if (!st._on) { st._on = true; requestAnimationFrame(st.frame); }
    if (onReady) onReady();
  });
}
function place(st) {
  if (!st.aspect) return;
  const cam = st.camera, vh = 2 * Math.tan(cam.fov * Math.PI / 360) * cam.position.z, vw = vh * cam.aspect;
  let H = st.isIcon ? vh * 0.55 : st.world === 'wuwa' ? vh * 1.42 : vh * 1.0, W = H * st.aspect;
  if (W > vw * 1.15) { W = vw * 1.15; H = W / st.aspect; }
  const x = Math.max(0, vw / 2 - W / 2 - vw * 0.02), y = st.isIcon ? vh * 0.12 : st.world === 'wuwa' ? vh / 2 - H / 2 + vh * 0.04 : vh * 0.06;
  st.art.scale.set(W, H, 1); st.art.position.set(x, y, 0);
  st.sil.scale.set(W * 1.04, H * 1.04, 1); st.sil.position.set(x, y, -0.25);
  st.back.position.set(x, y + vh * 0.05, -1.6);
  const floor = -vh * 0.36;
  st.ringA.position.set(x, floor, 0.4); st.ringB.position.set(x, floor + 0.01, 0.4);
}

window.LoreScene = {
  hero(el, world) { try { hero(el, world); } catch (e) { console.warn('3D hero unavailable', e); } },
  starmap(el, data, onPick) { try { starmap(el, data, onPick); } catch (e) { console.warn('3D map unavailable', e); el.textContent = '3D view is not available in this browser.'; } },
  focus(id) { if (M) M.focus(id); },
  pause() { if (M) M.running = false; },
  showcase(el, o, onReady) { try { showcase(el, o, onReady); } catch (e) { console.warn('3D showcase unavailable', e); } },
  showcaseStop() { if (S) S.running = false; },
};
document.dispatchEvent(new Event('lorescene'));
