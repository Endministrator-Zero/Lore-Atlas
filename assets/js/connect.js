/* Lore Atlas connections, built with three.js.
   voices(data)  a fan of cards for one character. Each card is someone they are linked to, with the actual line on it.
                 Swipe, drag, use the arrow keys or the strip below to move through the fan.
   hide()        put the canvas away while the Circle view (drawn by app.js) uses the same frame.
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
  s.renderer.domElement.hidden = false;
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

window.LoreConnect = {
  /** Show the fan of cards. on = { front(id, index), open(id) } */
  voices(el, data, on) { stage(el); const m = use('voices', makeVoices); m.set(data, on); },
  /** Put the canvas away while the page shows something else in the same frame (the Circle view). */
  hide() { if (!S) return; S.active = null; S.renderer.domElement.hidden = true; for (const m of Object.values(S.modes)) m.overlay.hidden = true; },
  go(i) { if (S && S.modes.voices) S.modes.voices.go(i); },
};
document.dispatchEvent(new Event('loreconnect'));
