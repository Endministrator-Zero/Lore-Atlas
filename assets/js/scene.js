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
  pause() { if (M) M.running = false; },
  showcase(el, o, onReady) { try { showcase(el, o, onReady); } catch (e) { console.warn('3D showcase unavailable', e); } },
  showcaseStop() { if (S) S.running = false; },
};
document.dispatchEvent(new Event('lorescene'));
