/* Lore Atlas connections, built with three.js.
   Two tools share one canvas:
   voices(data)  a fan of cards for one character. Each card is someone they are linked to, with the actual line on it.
                 Swipe, drag, use the arrow keys or the strip below to move through the fan.
   web(data)     the whole cast on one ring, grouped by region. Every voice line is a thread; threads from the same
                 region are bundled together, so the picture stays calm however many lines there are.
   The page (app.js) owns the data and the reading panel; this file only draws and reports what was picked. */
import * as THREE from 'three';

const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const LINK = { mutual: '#f2d48f', out: '#8fd3ff', in: '#d7a6ff' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------ small shared pieces
let dot;
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (dot = new THREE.CanvasTexture(c));
}
const imgs = new Map();
function loadImg(url) {
  if (!imgs.has(url)) imgs.set(url, new Promise(res => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = url; }));
  return imgs.get(url);
}
function fontStack(v, fb) { return cssVar(v) || fb; }
/** The world's portrait shape: clipped corners for Solaris-3, rounded for Teyvat. */
function shapePath(g, x, y, w, h, world, r) {
  g.beginPath();
  if (world === 'wuwa') {
    const c = r * 0.9;
    g.moveTo(x + c, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x, y + h); g.lineTo(x, y + c); g.closePath();
  } else g.roundRect(x, y, w, h, r);
}
/** A round portrait with a coloured rim, drawn once into a canvas texture. */
const discs = new Map();
function portraitDisc(url, rim) {
  const k = url + rim;
  if (discs.has(k)) return discs.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = c.getContext('2d');
  const draw = img => {
    g.clearRect(0, 0, 160, 160);
    g.save(); g.beginPath(); g.arc(80, 80, 70, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#20242c'; g.fillRect(0, 0, 160, 160);
    if (img) g.drawImage(img, 10, 10, 140, 140);
    g.restore();
    g.lineWidth = 8; g.strokeStyle = rim; g.beginPath(); g.arc(80, 80, 72, 0, Math.PI * 2); g.stroke();
    t.needsUpdate = true;
  };
  draw(null); loadImg(url).then(draw);
  discs.set(k, t);
  return t;
}
function wrap(g, text, maxW, maxLines) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (g.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length === maxLines) break; } else cur = next;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  const used = lines.join(' ').length;
  if (used < String(text).replace(/\s+/g, ' ').trim().length - 1) {
    let last = lines[lines.length - 1] || '';
    while (last && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
  }
  return lines;
}
function project(v, camera, w, h) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, z: p.z }; }

// ------------------------------------------------------------ the shared stage
let S = null;
function stage(el) {
  if (S) return S;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, innerWidth < 640 ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  S = { el, renderer, W: 1, H: 1, modes: {}, active: null, running: true, raf: 0 };
  const fit = () => { S.W = el.clientWidth || 1; S.H = el.clientHeight || 1; renderer.setSize(S.W, S.H, false); for (const m of Object.values(S.modes)) m.resize(); };
  new ResizeObserver(fit).observe(el);
  new IntersectionObserver(es => { S.running = es[0].isIntersecting; if (S.running) loop(); }).observe(el);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  let last = performance.now();
  function loop() {
    if (S.raf) return;
    const frame = t => {
      S.raf = 0;
      if (!S.running || document.hidden || !S.active) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      S.active.tick(dt, t / 1000);
      renderer.render(S.active.scene, S.active.camera);
      S.raf = requestAnimationFrame(frame);
    };
    S.raf = requestAnimationFrame(frame);
  }
  S.loop = loop;
  S.fit = fit;
  fit();
  return S;
}
function use(name, make) {
  const s = S;
  if (!s.modes[name]) s.modes[name] = make(s);
  for (const [k, m] of Object.entries(s.modes)) m.overlay.hidden = k !== name;
  s.active = s.modes[name];
  s.el.dataset.mode = name;
  s.active.resize();
  s.loop();
  return s.active;
}
function camFor(s, fov) {
  const camera = new THREE.PerspectiveCamera(fov, 1, 1, 4000);
  // the plane through the origin is exactly 100 units tall
  camera.userData.fit = () => { camera.aspect = s.W / s.H; camera.position.set(0, 0, 50 / Math.tan(THREE.MathUtils.degToRad(fov / 2))); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); };
  return camera;
}
function backdrop(scene, count) {
  const p = new Float32Array(count * 3);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) { p[i * 3] = (r() - 0.5) * 420; p[i * 3 + 1] = (r() - 0.5) * 300; p[i * 3 + 2] = -60 - r() * 260; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), color: 0xd8def5, size: 2.2, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(pts);
  return pts;
}

// ------------------------------------------------------------ Voices: a fan of cards for one character
function makeVoices(s) {
  const scene = new THREE.Scene(), camera = camFor(s, 34);
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const stars = backdrop(scene, innerWidth < 640 ? 140 : 260);
  const overlay = document.createElement('div'); overlay.className = 'vx-ov'; s.el.appendChild(overlay);
  const world = document.documentElement.dataset.world;
  const accent = cssVar('--accent') || '#e6c98a';
  const M = { scene, camera, overlay, data: null, cards: [], cur: 0, target: 0, vel: 0, meshes: new Map(), front: -1, onFront: null, onOpen: null };

  // the centre character: a glowing portrait disc with slow halo rings
  const centre = new THREE.Group(); scene.add(centre);
  const cFace = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ transparent: true }));
  const cGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(accent), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  cGlow.scale.setScalar(4.2); cGlow.position.z = -0.2;
  const halo = new THREE.Group();
  [1.22, 1.42, 1.66].forEach((r, i) => halo.add(new THREE.Mesh(new THREE.TorusGeometry(r, i === 0 ? 0.02 : 0.012, 6, 140), new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: [0.7, 0.35, 0.18][i], depthWrite: false }))));
  centre.add(cGlow, halo, cFace);
  const cName = document.createElement('div'); cName.className = 'vx-centre'; overlay.appendChild(cName);

  // the thread from the centre to the card in front, plus fainter ones to its neighbours
  const threadMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const thread = new THREE.Mesh(new THREE.BufferGeometry(), threadMat); scene.add(thread);
  const sideLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.22, depthWrite: false }));
  scene.add(sideLines);
  const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: dotTexture(), size: 3.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(sparks);

  // prev and next buttons, and an empty message
  const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'vx-nav prev'; prev.setAttribute('aria-label', 'Previous'); prev.textContent = '‹';
  const next = document.createElement('button'); next.type = 'button'; next.className = 'vx-nav next'; next.setAttribute('aria-label', 'Next'); next.textContent = '›';
  const empty = document.createElement('p'); empty.className = 'vx-empty'; empty.hidden = true;
  overlay.append(prev, next, empty);
  prev.addEventListener('click', () => M.go(Math.round(M.target) - 1));
  next.addEventListener('click', () => M.go(Math.round(M.target) + 1));

  let G = {};   // geometry of the layout, in world units
  M.resize = () => {
    camera.userData.fit();
    const aspect = s.W / s.H, phone = s.W < 560, hw = 50 * aspect;
    const cr = phone ? 7.5 : 9.5;
    const cY = 50 - cr - (phone ? 4 : 6);
    const top = cY - cr - (phone ? 5 : 6), bottom = -50 + (phone ? 4 : 5);
    const shape = phone ? 0.9 : 0.74;                   // card width / height
    let ch = top - bottom, cw = Math.min(ch * shape, hw * (phone ? 1.56 : 0.78));
    ch = cw / shape;
    const was = G.shape;
    G = { aspect, phone, hw, cw, ch, cr, cY, cardY: (top + bottom) / 2 + (top - bottom - ch) / 2, shape };
    centre.position.set(0, cY, -4);
    if (was && was !== shape) { for (const m of M.meshes.values()) { m.material.map.dispose(); m.material.dispose(); scene.remove(m); } M.meshes.clear(); }
    for (const m of M.meshes.values()) m.scale.set(G.cw, G.ch, 1);
  };

  // a card is drawn into a canvas: portrait, name, region, how they are linked, and the line itself
  const CW = 540;
  function cardTexture(card, centreName) {
    const CH = Math.round(CW / G.shape), short = G.shape > 0.8;
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const panel = cssVar('--panel') || '#161a24', panel2 = cssVar('--panel2') || '#1d2230', ink = cssVar('--ink') || '#ece8de', mute = cssVar('--mute') || '#9a9eac';
    const fDisp = fontStack('--f-display', 'Georgia, serif'), fUi = fontStack('--f-ui', 'sans-serif'), fQuote = fontStack('--f-quote', 'Georgia, serif');
    const hue = card.hue || accent, link = LINK[card.dir] || accent;
    const draw = img => {
      g.clearRect(0, 0, CW, CH);
      // body
      shapePath(g, 6, 6, CW - 12, CH - 12, world, 34);
      const bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, panel2); bg.addColorStop(1, panel);
      g.fillStyle = bg; g.fill();
      g.save(); g.clip();
      const glow = g.createRadialGradient(CW / 2, 0, 10, CW / 2, 0, CW * 0.9);
      glow.addColorStop(0, hue + '55'); glow.addColorStop(1, 'transparent');
      g.fillStyle = glow; g.fillRect(0, 0, CW, CH);
      g.restore();
      g.lineWidth = 3; g.strokeStyle = hue + 'aa'; shapePath(g, 6, 6, CW - 12, CH - 12, world, 34); g.stroke();
      // portrait
      const P = short ? 150 : 200, px = (CW - P) / 2, py = short ? 30 : 38;
      g.save(); shapePath(g, px, py, P, P, world, world === 'wuwa' ? 30 : 46); g.clip();
      g.fillStyle = world === 'wuwa' ? '#262a33' : '#9c7340'; g.fillRect(px, py, P, P);
      if (img) g.drawImage(img, px, py, P, P);
      g.restore();
      g.lineWidth = 4; g.strokeStyle = card.color || hue; shapePath(g, px, py, P, P, world, world === 'wuwa' ? 30 : 46); g.stroke();
      // name and region
      g.textAlign = 'center'; g.fillStyle = ink;
      let name = world === 'wuwa' ? card.name.toUpperCase() : card.name;
      let size = 50; g.font = `600 ${size}px ${fDisp}`;
      while (g.measureText(name).width > CW - 60 && size > 26) { size -= 2; g.font = `600 ${size}px ${fDisp}`; }
      g.fillText(name, CW / 2, py + P + 60);
      g.font = `700 20px ${fUi}`; g.fillStyle = hue;
      if (g.letterSpacing !== undefined) g.letterSpacing = '3px';
      g.fillText((card.sub || '').toUpperCase(), CW / 2, py + P + 92);
      if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
      // how they are linked
      const label = card.dir === 'mutual' ? 'They speak of each other' : card.dir === 'out' ? centreName + ' speaks of them' : 'Speaks of ' + centreName;
      g.font = `700 20px ${fUi}`;
      const lw = g.measureText(label).width + 40, ly = py + P + 112;
      g.fillStyle = link + '26'; g.strokeStyle = link + 'cc'; g.lineWidth = 2;
      g.beginPath(); g.roundRect((CW - lw) / 2, ly, lw, 40, 20); g.fill(); g.stroke();
      g.fillStyle = link; g.fillText(label, CW / 2, ly + 27);
      // the line
      const q = card.quote;
      if (q) {
        g.textAlign = 'left';
        g.font = `600 19px ${fUi}`; g.fillStyle = mute;
        g.fillText(q.who + ' on ' + q.about, 40, ly + 84);
        g.font = `italic 400 29px ${fQuote}`; g.fillStyle = ink;
        const room = Math.max(1, Math.floor((CH - 64 - (ly + 96)) / 38));
        const lines = wrap(g, '“' + q.text.replace(/^["“]|["”]$/g, '') + '”', CW - 80, room);
        lines.forEach((l, i) => g.fillText(l, 40, ly + 126 + i * 38));
      }
      g.textAlign = 'center'; g.font = `600 17px ${fUi}`; g.fillStyle = mute;
      g.fillText(q ? 'Tap the front card to read every line' : '', CW / 2, CH - 28);
      tex.needsUpdate = true;
    };
    draw(null);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => loadImg(card.img)).then(draw);
    return tex;
  }
  const cardGeo = new THREE.PlaneGeometry(1, 1);
  function mesh(i) {
    let m = M.meshes.get(i);
    if (m) return m;
    const mat = new THREE.MeshBasicMaterial({ map: cardTexture(M.cards[i], M.data.center.short), transparent: true, alphaTest: 0.4 });
    m = new THREE.Mesh(cardGeo, mat); m.scale.set(G.cw, G.ch, 1); m.userData.i = i;
    scene.add(m); M.meshes.set(i, m);
    return m;
  }
  function dropFar() {
    for (const [i, m] of M.meshes) if (Math.abs(i - M.cur) > 9) { m.material.map.dispose(); m.material.dispose(); scene.remove(m); M.meshes.delete(i); }
  }

  // where a card sits for a given distance from the front
  const tmpV = new THREE.Vector3();
  function place(m, o) {
    const a = clamp(o, -1, 1), ao = Math.abs(o), sx = Math.sign(o);
    const near = G.cw * (G.phone ? 0.86 : 0.8), far = G.cw * (G.phone ? 0.12 : 0.3);
    const x = sx * (ao <= 1 ? ao * near : near + (ao - 1) * far);
    m.position.set(x, G.cardY + (ao < 1 ? (1 - ao) * 1.5 : 0), -Math.abs(a) * 16 - Math.max(0, ao - 1) * 7);
    m.rotation.y = -a * 0.78;
    const shade = 1 - Math.min(1, ao) * 0.45 - Math.max(0, ao - 1) * 0.08;
    m.material.color.setScalar(clamp(shade, 0.25, 1));
    m.material.opacity = ao > 4 ? Math.max(0, 5 - ao) : 1;
    m.visible = ao < 5;
    m.renderOrder = 100 - Math.round(ao * 10);
  }
  // the thread: a glowing tube that bends from the centre down to the front card
  function curveTo(m) {
    const a = new THREE.Vector3(0, G.cY - G.cr * 1.05, -3);
    const b = m.position.clone().add(new THREE.Vector3(0, G.ch / 2 - 0.5, 0.5));
    const mid = a.clone().lerp(b, 0.5); mid.z += 10; mid.x += (b.x - a.x) * 0.2;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }

  M.set = (data, on) => {
    M.onFront = on.front; M.onOpen = on.open;
    const same = M.data && M.data.key === data.key;
    M.data = data;
    if (!same) {
      for (const m of M.meshes.values()) { m.material.map.dispose(); m.material.dispose(); scene.remove(m); }
      M.meshes.clear();
      M.cards = data.cards;
      const start = clamp(data.index || 0, 0, Math.max(0, M.cards.length - 1));
      M.cur = start + (reduce ? 0 : 2.5); M.target = start; M.front = -1;
      new THREE.TextureLoader().load(data.center.img, t => { t.colorSpace = THREE.SRGBColorSpace; cFace.material.map = t; cFace.material.needsUpdate = true; });
      cName.innerHTML = '<b></b><small></small>';
      cName.firstChild.textContent = data.center.name; cName.lastChild.textContent = data.center.sub || '';
      empty.hidden = M.cards.length > 0;
      empty.textContent = 'No voice lines link ' + data.center.name + ' to anyone in this group.';
      prev.hidden = next.hidden = M.cards.length < 2;
      centre.scale.setScalar(0.01);
    } else if (typeof data.index === 'number' && data.index !== Math.round(M.target)) M.go(data.index);
  };
  M.go = i => { if (!M.cards.length) return; M.target = clamp(i, 0, M.cards.length - 1); };

  // input: drag or swipe sideways, tap a side card to bring it forward, tap the front card to read it
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let drag = null;
  const pxPerCard = () => G.cw * (G.phone ? 0.86 : 0.8) / (G.aspect * 100) * s.W;
  s.renderer.domElement.addEventListener('pointerdown', e => {
    if (S.active !== M) return;
    drag = { x: e.clientX, y: e.clientY, cur: M.cur, t: performance.now(), lastX: e.clientX, lastT: performance.now(), v: 0, moved: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - drag.y)) { drag.moved = true; try { s.renderer.domElement.setPointerCapture(e.pointerId); } catch (err) {} }
    if (!drag.moved) return;
    const now = performance.now();
    drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT); drag.lastX = e.clientX; drag.lastT = now;
    M.cur = M.target = clamp(drag.cur - dx / pxPerCard(), -0.4, M.cards.length - 0.6);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.moved) { M.go(Math.round(M.cur - d.v * 6)); return; }
    if (e.type === 'pointercancel') return;
    const r = s.renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects([...M.meshes.values()].filter(m => m.visible), false).sort((a, b) => b.object.renderOrder - a.object.renderOrder)[0];
    if (!hit) return;
    const i = hit.object.userData.i;
    if (i === Math.round(M.target) && M.onOpen) M.onOpen(M.cards[i].id); else M.go(i);
  };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  s.renderer.domElement.addEventListener('wheel', e => {
    if (S.active !== M || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault(); M.target = clamp(M.target + e.deltaX / 160, 0, M.cards.length - 1); clearTimeout(M.wt); M.wt = setTimeout(() => M.go(Math.round(M.target)), 140);
  }, { passive: false });
  s.el.addEventListener('keydown', e => {
    if (S.active !== M) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); M.go(Math.round(M.target) - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); M.go(Math.round(M.target) + 1); }
    if ((e.key === 'Enter' || e.key === ' ') && M.cards.length && e.target === s.el) { e.preventDefault(); M.onOpen && M.onOpen(M.cards[Math.round(M.target)].id); }
  });

  let px = 0, py = 0;
  s.el.addEventListener('pointermove', e => { const r = s.el.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - 0.5; py = (e.clientY - r.top) / r.height - 0.5; });
  s.el.addEventListener('pointerleave', () => { px = py = 0; });

  M.tick = (dt, time) => {
    if (!drag) { const k = reduce ? 1 : 1 - Math.pow(0.0004, dt); M.cur += (M.target - M.cur) * k; }
    const n = M.cards.length;
    // camera drifts a little with the pointer for depth
    camera.position.x += (px * 6 - camera.position.x) * 0.05; camera.position.y += (-py * 4 - camera.position.y) * 0.05; camera.lookAt(0, 0, 0);
    stars.rotation.z = time * 0.004;
    const cs = centre.scale.x; centre.scale.setScalar(cs + (G.cr - cs) * 0.08);
    if (!M.cards.length) { thread.visible = sparks.visible = sideLines.visible = false; }
    halo.rotation.z = time * 0.1; halo.children[1].rotation.x = Math.sin(time * 0.4) * 0.5; halo.children[2].rotation.y = Math.cos(time * 0.3) * 0.5;
    centre.position.y = G.cY + (reduce ? 0 : Math.sin(time * 0.8) * 0.3);
    const lo = Math.max(0, Math.floor(M.cur) - 5), hi = Math.min(n - 1, Math.ceil(M.cur) + 5);
    for (let i = lo; i <= hi; i++) place(mesh(i), i - M.cur);
    for (const [i, m] of M.meshes) if (i < lo || i > hi) m.visible = false;
    if (Math.random() < 0.02) dropFar();
    const f = Math.round(M.cur);
    // threads
    const fm = M.meshes.get(f);
    if (fm && n) {
      const c = curveTo(fm);
      thread.geometry.dispose(); thread.geometry = new THREE.TubeGeometry(c, 40, 0.28, 6, false);
      const dir = M.cards[f].dir;
      threadMat.color.set(LINK[dir] || accent); threadMat.opacity = 0.9 - Math.min(1, Math.abs(f - M.cur) * 2) * 0.7;
      const arr = sparkGeo.attributes.position.array;
      for (let j = 0; j < 4; j++) { let u = (time * 0.42 + j / 4) % 1; if (dir === 'in' || (dir === 'mutual' && j % 2)) u = 1 - u; c.getPoint(u, tmpV).toArray(arr, j * 3); }
      sparkGeo.attributes.position.needsUpdate = true; sparks.material.color.set(LINK[dir] || accent); sparks.material.opacity = threadMat.opacity;
      const sp = [];
      for (const k of [f - 2, f - 1, f + 1, f + 2]) { const m = M.meshes.get(k); if (!m || !m.visible) continue; const pts = curveTo(m).getPoints(16); for (let q = 0; q < 16; q++) sp.push(...pts[q].toArray(), ...pts[q + 1].toArray()); }
      sideLines.geometry.dispose(); sideLines.geometry = new THREE.BufferGeometry(); sideLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      thread.visible = sparks.visible = sideLines.visible = true;
    } else thread.visible = sparks.visible = sideLines.visible = false;
    // report the card that has settled in front
    if (n && Math.abs(M.cur - M.target) < 0.02 && !drag && f !== M.front) { M.front = f; M.onFront && M.onFront(M.cards[f].id, f); }
    prev.disabled = Math.round(M.target) <= 0; next.disabled = Math.round(M.target) >= n - 1;
    // the centre's name sits under its portrait
    const p = project(new THREE.Vector3(centre.position.x + G.cr * 1.85, centre.position.y, centre.position.z), camera, s.W, s.H);
    cName.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(0,-50%)`;
  };
  return M;
}

// ------------------------------------------------------------ Web: the whole cast on one woven ring
function makeWeb(s) {
  const scene = new THREE.Scene(), camera = camFor(s, 34);
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const stars = backdrop(scene, innerWidth < 640 ? 140 : 260);
  const overlay = document.createElement('div'); overlay.className = 'wx-ov'; s.el.appendChild(overlay);
  const tip = document.createElement('div'); tip.className = 'wx-tip'; tip.hidden = true; overlay.appendChild(tip);
  const accent = cssVar('--accent') || '#e6c98a';
  const W = { scene, camera, overlay, data: null, focus: null, sel: null, hover: -1 };
  const ring = new THREE.Group(); scene.add(ring);
  let R = 38, nodes = [], at = {}, pairs = [], curves = [], base = null, nodeMesh = null, arcs = [], regionEls = [], hot = [], pulses = null, pulseData = [], preview = null, plane = null, portraits = [], nameEls = [];

  function build(data) {
    // clear
    for (const o of [...ring.children]) { ring.remove(o); o.geometry && o.geometry.dispose(); }
    regionEls.forEach(e => e.el.remove()); regionEls = [];
    nodes = data.nodes; at = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
    const regs = [];
    nodes.forEach(n => { if (!regs.length || regs[regs.length - 1].name !== n.region) regs.push({ name: n.region, hue: n.hue, from: 0, items: [] }); regs[regs.length - 1].items.push(n); });
    const gap = regs.length > 1 ? 2.2 : 0, slots = nodes.length + gap * regs.length;
    let slot = gap / 2;
    for (const r of regs) {
      r.a0 = (slot / slots) * Math.PI * 2;
      for (const n of r.items) { n.a = ((slot + 0.5) / slots) * Math.PI * 2; slot++; }
      r.a1 = (slot / slots) * Math.PI * 2; r.mid = (r.a0 + r.a1) / 2; slot += gap;
    }
    W.regs = regs;
    const ang = a => a - Math.PI / 2;   // start at the top, go clockwise
    const onRing = (a, rad, z = 0) => new THREE.Vector3(Math.cos(-ang(a)) * rad, Math.sin(-ang(a)) * rad, z);
    for (const n of nodes) n.p = onRing(n.a, R);
    const hub = {}; for (const r of regs) hub[r.name] = onRing(r.mid, R * 0.52, -R * 0.2);
    const root = new THREE.Vector3(0, 0, -R * 0.34);
    // one curve per pair; mutual when both speak
    const seen = new Map();
    for (const [a, b] of data.edges) {
      if (!(a in at) || !(b in at) || a === b) continue;
      const k = a < b ? a + '|' + b : b + '|' + a;
      const e = seen.get(k) || { a: at[a], b: at[b], ab: false, ba: false };
      if (at[a] === e.a) e.ab = true; else e.ba = true;
      seen.set(k, e);
    }
    pairs = [...seen.values()];
    const beta = 0.84;
    curves = pairs.map(e => {
      const A = nodes[e.a], B = nodes[e.b];
      const ctrl = [A.p, hub[A.region]];
      if (A.region !== B.region) ctrl.push(root);
      ctrl.push(hub[B.region], B.p);
      if (A.region === B.region) ctrl.splice(1, 1, hub[A.region].clone().lerp(A.p.clone().lerp(B.p, 0.5), 0.35));
      const last = ctrl.length - 1;
      const pts = ctrl.map((p, i) => i === 0 || i === last ? p.clone() : p.clone().multiplyScalar(beta).add(A.p.clone().lerp(B.p, i / last).multiplyScalar(1 - beta)));
      return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    });
    // all threads in one draw call, fading from one region's colour to the other's
    const SEG = 22, pos = new Float32Array(pairs.length * SEG * 6), col = new Float32Array(pairs.length * SEG * 6);
    const ca = new THREE.Color(), cb = new THREE.Color(), cm = new THREE.Color();
    pairs.forEach((e, k) => {
      const pts = curves[k].getPoints(SEG); ca.set(nodes[e.a].hue); cb.set(nodes[e.b].hue);
      for (let i = 0; i < SEG; i++) {
        pts[i].toArray(pos, (k * SEG + i) * 6); pts[i + 1].toArray(pos, (k * SEG + i) * 6 + 3);
        cm.copy(ca).lerp(cb, i / SEG).toArray(col, (k * SEG + i) * 6); cm.copy(ca).lerp(cb, (i + 1) / SEG).toArray(col, (k * SEG + i) * 6 + 3);
      }
    });
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    base = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.add(base);
    // characters: small discs on the rim, sized by how many lines they have
    const deg = nodes.map(() => 0); pairs.forEach(e => { deg[e.a]++; deg[e.b]++; });
    nodeMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ transparent: true }), nodes.length);
    const mtx = new THREE.Matrix4(), c = new THREE.Color();
    nodes.forEach((n, i) => { n.deg = deg[i]; n.size = 0.55 + Math.min(1, Math.sqrt(deg[i]) / 9) * 0.75; mtx.compose(n.p, new THREE.Quaternion(), new THREE.Vector3(n.size, n.size, 1)); nodeMesh.setMatrixAt(i, mtx); nodeMesh.setColorAt(i, c.set(n.color)); });
    ring.add(nodeMesh);
    // a coloured arc under each region, and its name outside the ring
    arcs = regs.map(r => {
      const pts = []; for (let k = 0; k <= 48; k++) { const a = r.a0 + (r.a1 - r.a0) * k / 48; pts.push(onRing(a, R + 2.4)); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: r.hue, transparent: true, opacity: 0.8 }));
      ring.add(l); return l;
    });
    regs.forEach(r => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wx-region'; b.style.setProperty('--rh', r.hue);
      b.innerHTML = '<span></span><small></small>'; b.firstChild.textContent = r.name; b.lastChild.textContent = String(r.items.length);
      b.addEventListener('click', () => W.on && W.on.region(r.name));
      overlay.appendChild(b); regionEls.push({ el: b, p: onRing(r.mid, R + 7), a: r.mid, r });
    });
    // an invisible disc to turn pointer positions into ring angles
    plane = new THREE.Mesh(new THREE.CircleGeometry(R * 1.25, 64), new THREE.MeshBasicMaterial({ visible: false }));
    ring.add(plane);
    W.onRing = onRing;
  }

  function clearHot() {
    hot.forEach(h => { ring.remove(h); h.geometry.dispose(); h.material.dispose(); }); hot = [];
    portraits.forEach(p => { ring.remove(p); p.material.dispose(); }); portraits = [];
    nameEls.forEach(e => e.el.remove()); nameEls = [];
    if (pulses) { ring.remove(pulses); pulses.geometry.dispose(); pulses = null; }
    pulseData = [];
  }
  // light up one character: their threads become thick and coloured by who speaks, with pulses travelling along
  function light(focus, sel, region) {
    clearHot();
    const c = new THREE.Color(), mtx = new THREE.Matrix4();
    const fi = focus != null ? at[focus] : -1, si = sel != null ? at[sel] : -1;
    const near = new Map();
    const count = fi >= 0 ? pairs.filter(e => e.a === fi || e.b === fi).length : 0;
    const rad = count > 40 ? 0.07 : count > 15 ? 0.11 : 0.17, op = count > 40 ? 0.55 : count > 15 ? 0.7 : 0.85;
    pairs.forEach((e, k) => {
      let kind = null, from = e.a;
      if (fi >= 0 && (e.a === fi || e.b === fi)) {
        const other = e.a === fi ? e.b : e.a, fSpeaks = e.a === fi ? e.ab : e.ba, oSpeaks = e.a === fi ? e.ba : e.ab;
        kind = fSpeaks && oSpeaks ? 'mutual' : fSpeaks ? 'out' : 'in'; near.set(other, kind); from = fSpeaks ? fi : other;
      } else if (region && (nodes[e.a].region === region || nodes[e.b].region === region)) kind = 'region';
      if (!kind) return;
      const isSel = si >= 0 && (e.a === si || e.b === si) && fi >= 0;
      const color = kind === 'region' ? (nodes[e.a].region === region ? nodes[e.a].hue : nodes[e.b].hue) : LINK[kind];
      const m = new THREE.Mesh(new THREE.TubeGeometry(curves[k], 48, isSel ? 0.3 : kind === 'region' ? 0.08 : rad, 5, false),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isSel ? 1 : si >= 0 ? 0.2 : kind === 'region' ? 0.45 : op, depthWrite: false, blending: isSel ? THREE.AdditiveBlending : THREE.NormalBlending }));
      if (isSel) m.renderOrder = 5;
      ring.add(m); hot.push(m);
      if (kind !== 'region' && (si < 0 || isSel)) pulseData.push({ curve: curves[k], back: from !== e.a, color: new THREE.Color(color), both: kind === 'mutual' });
    });
    if (pulseData.length) {
      const g = new THREE.BufferGeometry(), per = 2;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pulseData.length * per * 3), 3));
      const cols = new Float32Array(pulseData.length * per * 3); pulseData.forEach((p, i) => { for (let j = 0; j < per; j++) p.color.toArray(cols, (i * per + j) * 3); });
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      pulses = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), size: pulseData.length > 40 ? 2.2 : 3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.add(pulses);
    }
    base.material.opacity = fi >= 0 || region ? 0.07 : 0.3;
    nodes.forEach((n, i) => {
      const lit = fi < 0 && !region || i === fi || near.has(i) || (region && n.region === region);
      const k = i === fi ? 0 : near.has(i) ? 1.45 : 1;
      mtx.compose(n.p, new THREE.Quaternion(), new THREE.Vector3(n.size * k, n.size * k, 1)); nodeMesh.setMatrixAt(i, mtx);
      c.set(n.color); if (!lit) c.multiplyScalar(0.25);
      nodeMesh.setColorAt(i, c);
    });
    nodeMesh.instanceMatrix.needsUpdate = true; nodeMesh.instanceColor.needsUpdate = true;
    arcs.forEach((a, i) => { a.material.opacity = !region || W.regs[i].name === region ? 0.8 : 0.25; });
    regionEls.forEach(e => e.el.classList.toggle('on', e.r.name === region));
    // portraits for the focus and the selected person, names for everyone lit when there are few
    const pic = (i, size, push, main) => {
      const n = nodes[i];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: portraitDisc(n.img, main ? accent : n.color), transparent: true, depthWrite: false }));
      sp.position.copy(W.onRing(n.a, R - push, 2)); sp.scale.setScalar(size); sp.userData.i = i; ring.add(sp); portraits.push(sp);
      addName(i, main ? 'main' : 'sel', R - push - size * 0.55, true);
    };
    if (fi >= 0) pic(fi, s.W < 560 ? 8 : 7.5, s.W < 560 ? 6 : 6.5, true);
    if (si >= 0 && fi >= 0) pic(si, s.W < 560 ? 6.5 : 6, s.W < 560 ? 5.5 : 6, false);
    if (fi >= 0 && near.size <= 16) for (const i of near.keys()) if (i !== si) addName(i, 'nb', R + 3.5);
  }
  function addName(i, cls, rad, inward) {
    const el = document.createElement('span'); el.className = 'wx-name ' + cls; el.textContent = nodes[i].name; overlay.appendChild(el);
    nameEls.push({ el, p: W.onRing(nodes[i].a, rad, 2), a: nodes[i].a + (inward ? Math.PI : 0) });
  }

  W.resize = () => {
    camera.userData.fit();
    const aspect = s.W / s.H, phone = s.W < 560;
    const hw = 50 * aspect;
    R = Math.min(hw - (phone ? 13 : 17), 50 - (phone ? 13 : 12));
    if (W.data) { const d = W.data; W.data = null; W.set(d, W.on); }
  };
  W.set = (data, on) => {
    W.on = on;
    const rebuild = !W.data || W.data.key !== data.key || W.R !== R;
    W.data = data;
    if (rebuild) { W.R = R; build(data); }
    W.focus = data.focus; W.sel = data.sel; W.region = data.region;
    light(data.focus, data.sel, data.region);
  };

  // input: hovering the rim previews a character's threads; selecting picks them; dragging tilts the ring
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tmp = new THREE.Vector3();
  const nodeAt = e => {
    const r = s.renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const ph = ray.intersectObjects(portraits, false)[0]; if (ph) return ph.object.userData.i;
    const hit = plane && ray.intersectObject(plane, false)[0]; if (!hit) return -1;
    const lp = ring.worldToLocal(hit.point.clone()), d = lp.length();
    if (d < R * 0.84 || d > R * 1.2) return -1;
    let a = Math.PI / 2 - Math.atan2(lp.y, lp.x); a = (a + Math.PI * 4) % (Math.PI * 2);
    let best = -1, bd = 1e9;
    nodes.forEach((n, i) => { let x = Math.abs(n.a - a); x = Math.min(x, Math.PI * 2 - x); if (x < bd) { bd = x; best = i; } });
    return bd * R < 3.2 ? best : -1;
  };
  let tiltX = -0.32, tiltY = 0, drag = null;
  s.renderer.domElement.addEventListener('pointerdown', e => { if (S.active === W) drag = { x: e.clientX, y: e.clientY, tx: tiltX, ty: tiltY, moved: false, id: e.pointerId }; });
  window.addEventListener('pointermove', e => {
    if (S.active !== W) return;
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6 && Math.abs(dx) > Math.abs(dy) * 0.8) { drag.moved = true; try { s.renderer.domElement.setPointerCapture(e.pointerId); } catch (err) {} }
      if (drag.moved) { tiltY = clamp(drag.ty + dx / 260, -0.75, 0.75); tiltX = clamp(drag.tx + dy / 300, -0.8, 0.3); }
      return;
    }
    if (e.target !== s.renderer.domElement) return;
    const i = nodeAt(e);
    if (i !== W.hover) { W.hover = i; showPreview(i); }
    s.renderer.domElement.style.cursor = i >= 0 ? 'pointer' : 'grab';
    if (i >= 0) { const r = s.el.getBoundingClientRect(); tip.innerHTML = '<b></b><small></small>'; tip.firstChild.textContent = nodes[i].name; tip.lastChild.textContent = nodes[i].region + ' · ' + nodes[i].deg + (nodes[i].deg === 1 ? ' link' : ' links'); tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.hidden = false; }
    else tip.hidden = true;
  });
  s.renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; W.hover = -1; showPreview(-1); });
  const up = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.moved || e.type === 'pointercancel') return;
    const i = nodeAt(e);
    W.on && W.on.pick(i >= 0 ? nodes[i].id : null);
  };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  function showPreview(i) {
    if (preview) { ring.remove(preview); preview.geometry.dispose(); preview = null; }
    if (i < 0 || nodes[i].id === W.focus) return;
    const pts = [];
    pairs.forEach((e, k) => { if (e.a !== i && e.b !== i) return; const p = curves[k].getPoints(22); for (let q = 0; q < 22; q++) pts.push(...p[q].toArray(), ...p[q + 1].toArray()); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    preview = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(nodes[i].color), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.add(preview);
  }

  let px = 0, py = 0;
  s.el.addEventListener('pointermove', e => { const r = s.el.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - 0.5; py = (e.clientY - r.top) / r.height - 0.5; });
  s.el.addEventListener('pointerleave', () => { px = py = 0; });
  W.tick = (dt, time) => {
    const wob = reduce ? 0 : Math.sin(time * 0.23) * 0.08;
    const tx = drag ? tiltX : tiltX + py * 0.12, ty = drag ? tiltY : tiltY + wob + px * 0.18;
    ring.rotation.x += (tx - ring.rotation.x) * 0.08; ring.rotation.y += (ty - ring.rotation.y) * 0.08;
    if (!drag) { tiltX += (-0.32 - tiltX) * 0.01; tiltY += (0 - tiltY) * 0.01; }
    stars.rotation.z = time * 0.004;
    if (pulses) {
      const arr = pulses.geometry.attributes.position.array;
      pulseData.forEach((p, i) => { for (let j = 0; j < 2; j++) { let u = (time * 0.24 + j * 0.5 + i * 0.173) % 1; if (p.back || (p.both && j === 1)) u = 1 - u; p.curve.getPoint(u, tmp).toArray(arr, (i * 2 + j) * 3); } });
      pulses.geometry.attributes.position.needsUpdate = true;
    }
    portraits.forEach((p, k) => { p.position.z = 2 + Math.sin(time * 1.2 + k) * 0.4; });
    ring.updateMatrixWorld();
    let boxes = [];
    const place = (o, avoid) => {
      tmp.copy(o.p).applyMatrix4(ring.matrixWorld);
      const q = project(tmp, camera, s.W, s.H), sx = Math.sin(o.a), cy = -Math.cos(o.a);
      const w = o.w || (o.w = o.el.offsetWidth), h = o.h || (o.h = o.el.offsetHeight);
      let x = q.x - (sx > 0.3 ? 0 : sx < -0.3 ? w : w / 2), y = q.y - (cy > 0.3 ? 0 : cy < -0.3 ? h : h / 2);
      x = clamp(x, 4, s.W - w - 4); y = clamp(y, 4, s.H - h - 4);
      if (avoid) { for (let k = 0; k < 6 && boxes.some(b => x < b[2] + 3 && x + w > b[0] - 3 && y < b[3] + 3 && y + h > b[1] - 3); k++) y += h + 4; boxes.push([x, y, x + w, y + h]); }
      o.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    };
    regionEls.forEach(o => place(o, false)); boxes = []; nameEls.forEach(o => place(o, true));
  };
  return W;
}

window.LoreConnect = {
  /** Show the fan of cards. on = { front(id, index), open(id) } */
  voices(el, data, on) { stage(el); const m = use('voices', makeVoices); m.set(data, on); },
  /** Show the woven ring. on = { pick(id or null), region(name) } */
  web(el, data, on) { stage(el); const m = use('web', makeWeb); m.set(data, on); },
  go(i) { if (S && S.modes.voices) S.modes.voices.go(i); },
};
document.dispatchEvent(new Event('loreconnect'));
