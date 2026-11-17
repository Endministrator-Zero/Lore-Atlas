/* Lore Atlas 3D scenes (three.js).
   hero(el, world)            : the rotating centrepiece in the page header.
   starmap(el, data, onPick)  : the whole cast as a 3D constellation you can orbit and click.
   focus(id) / pause()        : move the star map camera, or stop rendering when it is hidden. */
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const col = (n, fb) => { try { return new THREE.Color(css(n) || fb); } catch { return new THREE.Color(fb); } };

function makeRenderer(el) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setClearColor(0x000000, 0);
  el.appendChild(r.domElement);
  return r;
}
function fit(el, renderer, camera) {
  const w = el.clientWidth || 1, h = el.clientHeight || 1;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
function discTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
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

// ---------------------------------------------------------------- hero
function hero(el, world) {
  if (!el || el.dataset.ready) return; el.dataset.ready = '1';
  const renderer = makeRenderer(el);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  const accent = col('--accent', '#e6c98a'), bright = col('--accent2', '#fff0c9');
  const root = new THREE.Group(); scene.add(root);
  const dot = discTexture();
  const spin = [];
  if (world === 'wuwa') {
    // a tacet core: nested wireframe solids, orbiting frequency rings and drifting motes
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
    // an armillary sphere: golden rings turning around a four-pointed star
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

// ---------------------------------------------------------------- star map
let M = null;
function starmap(el, data, onPick) {
  if (M) { M.running = true; M.loop(); return; }
  const renderer = makeRenderer(el);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1200);
  camera.position.set(0, 40, 250);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.35;
  controls.minDistance = 18; controls.maxDistance = 420; controls.enablePan = false;
  const accent = col('--accent', '#e6c98a'), bright = col('--accent2', '#fff0c9');
  const dot = discTexture();

  // layout: regions sit on a sphere, characters cluster around their region, then a short relaxation
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
      if (N[i].links.size > hubCut || N[j].links.size > hubCut) continue; // hubs linked to everyone would collapse the map
      d.subVectors(N[j].p, N[i].p); const len = d.length() || 0.01;
      if (len > 26) { d.multiplyScalar((len - 26) / len * 0.03); N[i].p.add(d); N[j].p.sub(d); }
    }
    for (const n of N) n.p.lerp(n.links.size > hubCut ? new THREE.Vector3(0, 0, 0) : centre[n.region], n.links.size > hubCut ? 0.08 : 0.012);
  }

  const loader = new THREE.TextureLoader();
  const group = new THREE.Group(); scene.add(group);
  const sprites = [];
  N.forEach((n, i) => {
    const size = 6.5 + Math.min(n.links.size, 24) * 0.16;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: accent, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(size * 2.1); glow.position.copy(n.p); group.add(glow);
    const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
    loader.load(n.img, tex => { tex.colorSpace = THREE.SRGBColorSpace; mat.map = tex; mat.needsUpdate = true; });
    const sp = new THREE.Sprite(mat); sp.scale.setScalar(size); sp.position.copy(n.p); sp.userData.i = i; sp.renderOrder = 2;
    group.add(sp); sprites.push(sp); n.sprite = sp; n.glow = glow; n.size = size;
  });
  const linePos = new Float32Array(E.length * 6);
  E.forEach(([i, j], k) => { N[i].p.toArray(linePos, k * 6); N[j].p.toArray(linePos, k * 6 + 3); });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const web = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.07, depthWrite: false }));
  group.add(web);
  const hot = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: 0.85, depthWrite: false }));
  group.add(hot);
  scene.add(new THREE.Points(shell(900, 260, 520, 5), new THREE.PointsMaterial({ map: dot, color: 0xcfd6ee, size: 2.2, transparent: true, opacity: 0.55, depthWrite: false })));

  const tip = document.createElement('div'); tip.className = 'map-tip'; tip.hidden = true; el.appendChild(tip);
  const hint = document.createElement('div'); hint.className = 'map-hint'; hint.textContent = 'Drag to orbit · scroll to zoom · select a portrait'; el.appendChild(hint);
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hover = -1, focused = -1, down = null, tween = null;
  const pickAt = e => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(sprites, false)[0];
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
    const hp = [];
    N.forEach((m, k) => {
      const near = k === i || n.links.has(k);
      m.sprite.material.opacity = near ? 1 : 0.16; m.glow.material.opacity = k === i ? 0.95 : near ? 0.4 : 0.05;
      m.glow.material.color.copy(k === i ? bright : accent);
      const s = k === i ? m.size * 1.5 : m.size; m.sprite.scale.setScalar(s); m.glow.scale.setScalar(s * 2.1);
      if (k !== i && near) { hp.push(n.p.x, n.p.y, n.p.z, m.p.x, m.p.y, m.p.z); }
    });
    hot.geometry.dispose(); hot.geometry = new THREE.BufferGeometry(); hot.geometry.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    web.material.opacity = 0.03;
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = Math.min(230, 95 + n.links.size * 1.3);
    tween = { t: 0, fromT: controls.target.clone(), toT: n.p.clone(), fromC: camera.position.clone(), toC: n.p.clone().add(dir.multiplyScalar(dist)) };
  }
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let last = performance.now();
  const api = {
    running: true,
    focus(id) { if (id in at && at[id] !== focused) focusIndex(at[id]); },
    loop() {
      if (api._on) return; api._on = true;
      const frame = t => {
        if (!api.running) { api._on = false; return; }
        const dt = Math.min(0.05, (t - last) / 1000); last = t;
        if (tween) { tween.t = Math.min(1, tween.t + dt / (reduce ? 0.01 : 0.9)); const k = ease(tween.t); controls.target.lerpVectors(tween.fromT, tween.toT, k); camera.position.lerpVectors(tween.fromC, tween.toC, k); if (tween.t >= 1) tween = null; }
        controls.update(); renderer.render(scene, camera);
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

window.LoreScene = {
  hero(el, world) { try { hero(el, world); } catch (e) { console.warn('3D hero unavailable', e); } },
  starmap(el, data, onPick) { try { starmap(el, data, onPick); } catch (e) { console.warn('3D map unavailable', e); el.textContent = '3D view is not available in this browser.'; } },
  focus(id) { if (M) M.focus(id); },
  pause() { if (M) M.running = false; },
};
document.dispatchEvent(new Event('lorescene'));
