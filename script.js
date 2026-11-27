/* Tri Nguyen — a scroll film.
 * One carbon atom on a fixed canvas travels through five scenes:
 *   1 nucleus (headshot) with 6 electrons on two tilted orbits
 *   2 the orbits turn face-on and become SATE's five layers around the recorder
 *   3 two electrons land as the two dates in News
 *   4 one electron pulls a thread down Before UB, lighting each heading it passes
 *   5 the atom forms again, small, beside the email
 * Rule: the film is a pure function of scroll position (compose -> draw). It plays backwards
 * for free and survives jumps. Only the electrons' spin is time-based. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };      // peak speed 1.5x
  const win = (p, a, b) => smooth((p - a) / (b - a));
  const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

  /* ---------------- Spring ---------------- */
  class Spring {
    constructor(value, { damping = 1, response = 0.4 } = {}) {
      this.x = value; this.v = 0; this.target = value;
      this.config(damping, response);
      this.subs = []; this.raf = 0; this.last = 0; this.rest = null;
    }
    config(damping, response) { this.k = Math.pow((2 * Math.PI) / response, 2); this.c = (4 * Math.PI * damping) / response; }
    on(fn) { this.subs.push(fn); return this; }
    emit() { for (const fn of this.subs) fn(this.x); }
    jump(x) { this.stop(); this.x = this.target = x; this.v = 0; this.emit(); }
    stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
    to(target, { velocity, damping, response } = {}) {
      this.target = target;
      if (velocity !== undefined) this.v = velocity;
      if (damping !== undefined || response !== undefined) this.config(damping ?? 1, response ?? 0.4);
      if (reduceMotion.matches) { this.jump(target); this.rest?.(); return; }
      if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.tick(t)); }
    }
    tick(now) {
      let dt = Math.min((now - this.last) / 1000, 1 / 30); this.last = now;
      while (dt > 0) { const s = Math.min(1 / 240, dt); const a = -this.k * (this.x - this.target) - this.c * this.v; this.v += a * s; this.x += this.v * s; dt -= s; }
      if (Math.abs(this.x - this.target) < 0.01 && Math.abs(this.v) < 0.5) { this.x = this.target; this.v = 0; this.raf = 0; this.emit(); this.rest?.(); return; }
      this.emit(); this.raf = requestAnimationFrame(t => this.tick(t));
    }
  }
  const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);
  const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

  /* ---------------- Smooth wheel on laptops only (phones keep native scroll) ---------------- */
  let lenis = null;
  if (window.Lenis && finePointer.matches && !reduceMotion.matches) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true });
    window.__lenis = lenis;
  }

  /* ---------------- Toast ---------------- */
  const toast = $('#toast'); let toastTimer;
  const showToast = (msg) => { toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1800); };

  /* ---------------- Anchor links ---------------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
    e.preventDefault();
    const y = el.id === 'about' ? 0 : el.getBoundingClientRect().top + scrollY - 72;
    if (lenis) lenis.scrollTo(Math.max(0, y), { duration: 1.6 });
    else scrollTo({ top: Math.max(0, y), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + el.id);
  });

  /* ================= THE FILM ================= */
  const canvas = $('#film'), ctx = canvas.getContext('2d');
  const slotA = $('#slot-atom'), slotB = $('#slot-layers'), slotD = $('#slot-mini'), rail = $('#rail');
  const dots = $$('[data-dot]'), stops = $$('[data-stop]');
  const aboutText = $('.about__text'), iris = $('#iris'), bar = $('#progress'), tile = $('#element');
  const ins = $$('[data-in]'), rises = $$('[data-rise]');
  const navLinks = $$('.top__nav a'), navSecs = navLinks.map(a => document.getElementById(a.dataset.section));
  let W = 0, H = 0, dpr = 1, C = {};

  const head = new Image(); let headOK = false;
  head.onload = () => { headOK = true; }; head.src = 'assets/img/headshot.jpg';
  const device = new Image(); device.src = 'assets/img/sate-device.webp';

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const root = document.documentElement;
    applyPalette();
  }
  /* Scene colours: one ink-blue family, from near white to deep ink, plus UB accents.
     A scene's "glow" is the light that follows the atom across the background.
     Colours blend in OKLab, so a light-to-dark change never passes through muddy grey. */
  const KEYS = ['paper', 'surface', 'ink', 'muted', 'rule', 'blue', 'soft', 'spark', 'glow'];
  const PAL = {
    light: [
      ['#f4f6fa', '#ffffff', '#14203a', '#56627a', '#d5dce8', '#005bbb', '#e2ebf7', '#e56a54', '#7fb0ec'],   // about
      ['#0b1630', '#122244', '#eef3fa', '#a8b6cc', '#26385c', '#ffc72c', '#1a3360', '#ffc72c', '#1f6fd1'],   // research
      ['#eef2f9', '#ffffff', '#14203a', '#56627a', '#d0d9e7', '#005bbb', '#dde7f5', '#e56a54', '#8ab6ea'],   // news
      ['#f4f6fa', '#ffffff', '#14203a', '#56627a', '#d5dce8', '#005bbb', '#e2ebf7', '#e56a54', '#9cc1ee'],   // before UB
      ['#0e1d3c', '#15294f', '#ffffff', '#b8c6de', '#2b3f66', '#ffc72c', '#1d3766', '#ffc72c', '#2a7be0'],   // contact
    ],
    dark: [
      ['#0d121c', '#151c29', '#e8edf5', '#9ea9bb', '#252e3d', '#6aaaf0', '#172338', '#f08a74', '#1f4f99'],
      ['#081225', '#0f1d3a', '#eef3fa', '#a8b6cc', '#22365a', '#ffc72c', '#163057', '#ffc72c', '#1f6fd1'],
      ['#0e1626', '#15203a', '#e6edf7', '#9eadc4', '#25324a', '#7ab4f2', '#182a46', '#f08a74', '#1c4a8f'],
      ['#0d121c', '#151c29', '#e8edf5', '#9ea9bb', '#252e3d', '#6aaaf0', '#172338', '#f08a74', '#1a4486'],
      ['#0a1733', '#122449', '#ffffff', '#b8c6de', '#283c63', '#ffc72c', '#1b3463', '#ffc72c', '#2a7be0'],
    ],
  };
  const GLOW_A = { light: [0.34, 0.55, 0.26, 0.22, 0.6], dark: [0.35, 0.55, 0.3, 0.28, 0.6] };
  const scenes = ['about', 'research', 'news', 'before-ub', 'contact'].map(id => document.getElementById(id));
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  // sRGB <-> OKLab (Björn Ottosson)
  const toLin = c => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const toSrgb = c => Math.round(255 * clamp(c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
  const hexToLab = h => {
    const [r, g, b] = [1, 3, 5].map(i => toLin(parseInt(h.slice(i, i + 2), 16)));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  };
  const labToHex = ([L, A, B]) => {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    return '#' + rgb.map(v => toSrgb(v).toString(16).padStart(2, '0')).join('');
  };
  const LAB = {}; for (const k in PAL) LAB[k] = PAL[k].map(row => row.map(hexToLab));
  const themeMeta = $('meta[name="theme-color"]');
  let palKey = '';
  function applyPalette() {
    const mode = document.documentElement.dataset.theme || (darkMq.matches ? 'dark' : 'light');
    const set = LAB[mode], ga = GLOW_A[mode];
    let cur = set[0].map(v => v.slice()), glowA = ga[0];
    for (let i = 1; i < scenes.length; i++) {
      // the next scene takes over while its top travels from 62 % to 30 % of the screen
      const t = smooth((0.62 * (H || innerHeight) - scenes[i].getBoundingClientRect().top) / (0.32 * (H || innerHeight)));
      if (t <= 0) break;
      cur = cur.map((c, k) => c.map((v, j) => v + (set[i][k][j] - v) * t));
      glowA = glowA + (ga[i] - glowA) * t;
    }
    const hexes = cur.map(labToHex);
    C.glowA = glowA;
    const key = hexes.join();
    if (key === palKey) return;
    palKey = key;
    const st = document.documentElement.style;
    KEYS.forEach((k, i) => { st.setProperty('--' + (k === 'soft' ? 'blue-soft' : k), hexes[i]); C[k] = hexes[i]; });
    themeMeta?.setAttribute('content', hexes[0]);
  }
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left }; };

  // electrons: carbon has 2 on the inner shell and 4 on the outer shell
  const E = [
    { si: 0, k: 0 }, { si: 0, k: 1 },
    { si: 1, k: 0 }, { si: 1, k: 1 }, { si: 1, k: 2 }, { si: 1, k: 3 },
  ];
  const SHELL = [
    { hero: 0.40, ring: 0.385, tilt: 70, rot: -24, speed: 0.62, n: 2 },
    { hero: 0.56, ring: 0.435, tilt: 72, rot: 30, speed: -0.4, n: 4 },
  ];
  const RINGS = [0.385, 0.435, 0.475, 0.51, 0.54];
  let spin = 1.4;                                       // time-based angle (the only clock)
  const speed = new Spring(1, { damping: 1, response: 0.6 });

  function orbitPoint(cx, cy, R, a, tiltDeg, rotDeg) {
    const x0 = R * Math.cos(a), y0 = R * Math.sin(a);
    const tl = tiltDeg * Math.PI / 180, rz = rotDeg * Math.PI / 180;
    const y1 = y0 * Math.cos(tl), z = y0 * Math.sin(tl);
    return { x: cx + x0 * Math.cos(rz) - y1 * Math.sin(rz), y: cy + x0 * Math.sin(rz) + y1 * Math.cos(rz), z: z / (R || 1) };
  }

  /* compose(): everything the canvas needs, from the scroll position alone */
  function compose() {
    const A = box(slotA), B = box(slotB), D = box(slotD), Rl = box(rail);
    const N = dots.map(box);
    const q1 = smooth((1.35 * H - B.y) / (0.85 * H));          // hero -> SATE layers
    const q2 = smooth((0.98 * H - N[0].y) / (0.45 * H));       // layers -> the two dates
    const q4 = smooth((1.08 * H - D.y) / (0.55 * H));          // thread -> small atom
    // the atom's place and size: glides from the hero slot to the layers slot
    const cx = lerp(A.x, B.x, q1), cy = lerp(A.y, B.y, q1), s = lerp(A.w, B.w, q1);
    // thread along the rail: from the second date down to the reading line (0.6 of the screen)
    const tx = Rl.x;
    const tipY = clamp(0.6 * H, N[1].y, Rl.bottom);
    return { A, B, D, N, Rl, q1, q2, q4, cx, cy, s, tx, tipY };
  }

  function draw(F) {
    ctx.clearRect(0, 0, W, H);
    const { q1, q2, q4, cx, cy, s, N, D, tx, tipY, Rl } = F;
    const atomA = 1 - win(q2, 0, 0.55);                          // the big atom fades as electrons leave

    // --- light that follows the atom (the background's only light source)
    {
      const g1 = { x: lerp(cx, tx, win(q2, 0.3, 1)), y: lerp(cy, tipY, win(q2, 0.3, 1)) };
      const gx = lerp(g1.x, D.x, q4), gy = lerp(g1.y, D.y, q4);
      const gr = Math.max(W, H) * lerp(0.55, 0.42, win(q2, 0, 1));
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      const rgb = C.glow.slice(1).match(/../g).map(h => parseInt(h, 16)).join(',');
      g.addColorStop(0, `rgba(${rgb},${(C.glowA || 0.3).toFixed(3)})`);
      g.addColorStop(0.45, `rgba(${rgb},${((C.glowA || 0.3) * 0.35).toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // --- graphene: a hexagonal carbon lattice that surfaces around SATE
    const latA = win(q1, 0.25, 0.9) * atomA;
    if (latA > 0.01) {
      const a0 = Math.max(18, s * 0.06), hw = a0 * Math.sqrt(3), reach = s * 1.15;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
      for (let row = -Math.ceil(reach / (1.5 * a0)); row <= Math.ceil(reach / (1.5 * a0)); row++) {
        for (let col = -Math.ceil(reach / hw); col <= Math.ceil(reach / hw); col++) {
          const x = cx + col * hw + (row & 1 ? hw / 2 : 0), y = cy + row * 1.5 * a0;
          const d = Math.hypot(x - cx, y - cy);
          if (d > reach || d < s * 0.3) continue;
          ctx.globalAlpha = latA * 0.16 * (1 - d / reach) * Math.min(1, (d - s * 0.3) / (s * 0.15));
          ctx.beginPath();
          for (let k = 0; k < 6; k++) { const ang = Math.PI / 6 + k * Math.PI / 3; const px = x + a0 * Math.cos(ang), py = y + a0 * Math.sin(ang); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.closePath(); ctx.stroke();
        }
      }
    }
    const transit = W < 860 ? 1 - 0.75 * Math.sin(Math.PI * clamp(q1)) : 1;   // phones: dim while it crosses text

    // --- five layers (scene 2): the outer three rings open out of the second orbit
    if (q1 > 0.02 && atomA > 0.01) {
      const k = 1 - 0.25 * q2;
      ctx.lineWidth = 1;
      for (let i = 2; i < 5; i++) {
        const r = s * lerp(RINGS[1], RINGS[i], win(q1, 0.35, 1)) * k;
        ctx.globalAlpha = win(q1, 0.35, 0.9) * (0.9 - (i - 2) * 0.22) * atomA;
        ctx.strokeStyle = C.rule; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // --- electron positions in the atom
    const pos = E.map((e, i) => {
      const sh = SHELL[e.si];
      const R = s * lerp(sh.hero, sh.ring, q1) * (1 - 0.25 * q2);
      const tilt = lerp(sh.tilt, 0, q1), rot = lerp(sh.rot, 0, q1);
      const a = spin * sh.speed + (e.k / sh.n) * Math.PI * 2 + e.si * 0.7;
      return orbitPoint(cx, cy, R, a, tilt, rot);
    });

    // --- orbit paths (become rings 1 and 2 when face-on); split into behind / in front
    const paths = (front) => {
      SHELL.forEach((sh) => {
        const R = s * lerp(sh.hero, sh.ring, q1) * (1 - 0.25 * q2);
        const tilt = lerp(sh.tilt, 0, q1), rot = lerp(sh.rot, 0, q1);
        let prev = orbitPoint(cx, cy, R, 0, tilt, rot);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
        for (let i = 1; i <= 96; i++) {
          const q = orbitPoint(cx, cy, R, (i / 96) * Math.PI * 2, tilt, rot);
          const behind = prev.z + q.z < 0;
          if (behind !== !front) { prev = q; continue; }
          ctx.globalAlpha = (behind ? 0.14 : 0.3) * atomA;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          prev = q;
        }
      });
    };
    const electrons = (front) => {
      pos.forEach((p, i) => {
        if (i <= 2 && q2 > 0) return;                         // the travellers are drawn later
        if ((p.z < 0) === front) return;
        ctx.globalAlpha = (p.z < 0 ? 0.45 : 1) * atomA;
        ctx.fillStyle = C.spark;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2.2, (s / 95) + p.z * 1.3), 0, Math.PI * 2); ctx.fill();
      });
    };

    const tileA = 1 - win(q1, 0, 0.3);
    if (tileA > 0.01) {
      const t = tile.getBoundingClientRect();
      const nr0 = s * 0.28, ax = t.left + 6, ay = t.bottom - 6;
      const ang = Math.atan2(ay - cy, ax - cx);
      ctx.globalAlpha = 0.5 * tileA; ctx.strokeStyle = C.blue; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx + Math.cos(ang) * (nr0 + 6), cy + Math.sin(ang) * (nr0 + 6)); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (atomA > 0.01) {
      ctx.save(); ctx.globalAlpha = 1;
      const _ga = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalAlpha');
      Object.defineProperty(ctx, 'globalAlpha', { configurable: true, get() { return _ga.get.call(this); }, set(v) { _ga.set.call(this, v * transit); } });
      paths(false); electrons(false);
      // nucleus: headshot cross-fades into the SATE recorder
      const nr = s * 0.28 * (1 - 0.25 * q2);
      const headA = (1 - win(q1, 0.15, 0.6)) * atomA;
      if (headA > 0.01) {
        ctx.save(); ctx.globalAlpha = headA;
        ctx.beginPath(); ctx.arc(cx, cy, nr, 0, Math.PI * 2); ctx.closePath();
        ctx.fillStyle = C.soft; ctx.fill(); ctx.clip();
        if (headOK) {
          const iw = head.naturalWidth, ih = head.naturalHeight, sc = (2 * nr) / Math.min(iw, ih);
          ctx.drawImage(head, cx - iw * sc / 2, cy - ih * sc * 0.42, iw * sc, ih * sc);
        } else {
          ctx.fillStyle = C.blue; ctx.font = `750 ${Math.round(nr * 0.62)}px "Bricolage Grotesque", Arial, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TN', cx, cy + nr * 0.04);
        }
        ctx.restore();
      }
      // ring 1 closes, ring 2 reaches about half: where SATE is today
      if (q1 > 0.5) {
        const r1 = s * RINGS[0] * (1 - 0.25 * q2), r2 = s * RINGS[1] * (1 - 0.25 * q2);
        ctx.lineWidth = 2.2; ctx.strokeStyle = C.blue; ctx.lineCap = 'round';
        ctx.globalAlpha = atomA;
        ctx.beginPath(); ctx.arc(cx, cy, r1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * win(q1, 0.55, 0.95)); ctx.stroke();
        ctx.globalAlpha = 0.6 * atomA;
        ctx.beginPath(); ctx.arc(cx, cy, r2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.55 * win(q1, 0.7, 1)); ctx.stroke();
        ctx.lineCap = 'butt';
      }
      paths(true); electrons(true);
      const devA = win(q1, 0.3, 0.8) * atomA;
      if (devA > 0.01 && device.complete && device.naturalWidth) {
        const dh = s * 0.6 * (1 - 0.25 * q2), dw = dh * device.naturalWidth / device.naturalHeight;
        const lift = (1 - win(q1, 0.3, 1)) * s * 0.12;
        ctx.save(); ctx.globalAlpha = devA;
        ctx.translate(cx, cy + lift); ctx.rotate((1 - win(q1, 0.3, 1)) * -0.18);
        ctx.drawImage(device, -dw * 0.5, -dh * 0.5, dw, dh);
        ctx.restore();
      }
      delete ctx.globalAlpha; ctx.restore();
    }

    // --- scene 3 and 4: three travellers leave the atom
    if (q2 > 0) {
      const er = Math.max(3.5, s / 80);
      const land = [win(q2, 0, 0.8), win(q2, 0.1, 0.9), win(q2, 0.2, 1)];
      const p0 = { x: lerp(pos[0].x, N[0].x, land[0]), y: lerp(pos[0].y, N[0].y, land[0]) };
      const p1 = { x: lerp(pos[1].x, N[1].x, land[1]), y: lerp(pos[1].y, N[1].y, land[1]) };
      // the rider lands on the second date, then rides the thread down
      const riderStart = { x: lerp(pos[2].x, N[1].x, land[2]), y: lerp(pos[2].y, N[1].y, land[2]) };
      const onThread = land[2] >= 1 ? 1 : 0;
      let rider = onThread ? { x: tx, y: tipY } : riderStart;
      // scene 5: the rider leaves the end of the thread for the email
      if (q4 > 0) rider = { x: lerp(tx, D.x, win(q4, 0, 0.6)), y: lerp(Math.min(tipY, Rl.bottom), D.y, win(q4, 0, 0.6)) };

      // thread from the second date to the rider
      if (onThread && tipY > N[1].y + 1) {
        const end = q4 > 0 ? Rl.bottom : tipY;
        ctx.globalAlpha = 1; ctx.strokeStyle = C.blue; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx, Math.max(-10, N[1].y)); ctx.lineTo(tx, Math.min(H + 10, end)); ctx.stroke();
        // stops: one ring per heading; filled once the thread has passed it
        stops.forEach(h => {
          const r = h.getBoundingClientRect(), y = r.top + r.height / 2;
          const passed = end >= y;
          h.classList.toggle('is-lit', passed);
          if (y < -20 || y > H + 20) return;
          ctx.beginPath(); ctx.arc(tx, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = passed ? C.blue : C.paper; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = passed ? C.blue : C.rule; ctx.stroke();
        });
      } else stops.forEach(h => h.classList.remove('is-lit'));

      ctx.fillStyle = C.spark; ctx.globalAlpha = 1;
      for (const p of [p0, p1]) { ctx.beginPath(); ctx.arc(p.x, p.y, er, 0, Math.PI * 2); ctx.fill(); }
      // the rider glows a little so the eye can follow it
      const fadeRider = q4 > 0.6 ? 1 - win(q4, 0.6, 0.9) : 1;
      ctx.globalAlpha = 0.18 * fadeRider; ctx.beginPath(); ctx.arc(rider.x, rider.y, er * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fadeRider; ctx.beginPath(); ctx.arc(rider.x, rider.y, er, 0, Math.PI * 2); ctx.fill();

      // --- scene 5: the small atom forms around the rider's landing point
      if (q4 > 0.4) {
        const f = win(q4, 0.4, 1), ms = D.w;
        const nr = ms * 0.2;
        ctx.globalAlpha = f;
        ctx.save(); ctx.beginPath(); ctx.arc(D.x, D.y, nr * f, 0, Math.PI * 2); ctx.fillStyle = C.soft; ctx.fill(); ctx.clip();
        if (headOK) { const iw = head.naturalWidth, ih = head.naturalHeight, sc = (2 * nr) / Math.min(iw, ih); ctx.drawImage(head, D.x - iw * sc / 2, D.y - ih * sc * 0.42, iw * sc, ih * sc); }
        else { ctx.fillStyle = C.blue; ctx.font = `750 ${Math.round(nr * 0.62)}px "Bricolage Grotesque", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TN', D.x, D.y + nr * 0.04); }
        ctx.restore();
        E.forEach((e, i) => {
          const sh = SHELL[e.si];
          const R = ms * (e.si ? 0.42 : 0.3);
          const a = spin * sh.speed + (e.k / sh.n) * Math.PI * 2 + e.si * 0.7;
          const o = orbitPoint(D.x, D.y, R, a, sh.tilt, sh.rot);
          const p = { x: lerp(rider.x, o.x, f), y: lerp(rider.y, o.y, f) };
          ctx.globalAlpha = f * (o.z < 0 ? 0.5 : 1);
          ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 + o.z, 0, Math.PI * 2); ctx.fill();
        });
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
        SHELL.forEach((sh, si) => {
          const R = ms * (si ? 0.42 : 0.3);
          ctx.globalAlpha = 0.22 * f; ctx.beginPath();
          for (let i = 0; i <= 72; i++) { const q = orbitPoint(D.x, D.y, R, (i / 72) * Math.PI * 2, sh.tilt, sh.rot); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
          ctx.stroke();
        });
      }
    } else stops.forEach(h => h.classList.remove('is-lit'));
    ctx.globalAlpha = 1;
  }

  /* DOM side of the film: text and media, also pure functions of scroll */
  const restTop = el => el.getBoundingClientRect().top - (el._ty || 0);   // measure without our own offset
  function stage(F) {
    applyPalette();
    // scene 1 text steps aside as the atom leaves
    const out = F.q1;
    aboutText.style.transform = `translate3d(0, ${(-out * 90).toFixed(1)}px, 0)`;
    aboutText.style.opacity = String(1 - win(out, 0, 0.55));
    tile.style.opacity = String(1 - win(out, 0, 0.3));
    tile.style.transform = `translate3d(0, ${(-out * 40).toFixed(1)}px, 0)`;
    // every [data-in] arrives while it climbs from the bottom to 78% of the screen
    for (const el of ins) {
      const p = smooth((H * 0.98 - restTop(el)) / (H * 0.2));
      el._ty = (1 - p) * 28;
      el.style.transform = `translate3d(0, ${el._ty.toFixed(1)}px, 0)`;
      el.style.opacity = String(0.08 + 0.92 * p);
    }
    // the video opens out of a small circle, like the nucleus it came from
    const v = iris.getBoundingClientRect();
    const pv = smooth((H * 0.95 - v.top) / (H * 0.6));
    iris.style.clipPath = pv >= 1 ? 'none' : `circle(${(7 + pv * 70).toFixed(2)}% at 50% 50%)`;
    // photos rise one after another
    for (const row of rises) {
      const top = restTop(row.children[0]);
      [...row.children].forEach((c, i) => {
        const p = smooth((H * 1.0 - top) / (H * 0.32) - i * 0.12);
        c._ty = (1 - p) * 70;
        c.style.transform = `translate3d(0, ${c._ty.toFixed(1)}px, 0)`;
        c.style.opacity = String(0.15 + 0.85 * p);
      });
    }
    // progress line and the active section in the bar
    const max = document.documentElement.scrollHeight - H;
    bar.style.transform = `scaleX(${clamp(scrollY / Math.max(1, max)).toFixed(4)})`;
    let cur = null;
    navSecs.forEach(s => { if (s.getBoundingClientRect().top <= H * 0.4) cur = s.id; });
    if (scrollY >= max - 4) cur = 'contact';
    navLinks.forEach(a => a.classList.toggle('is-active', a.dataset.section === cur));
  }

  /* one loop: Lenis (if any), then compose -> stage -> draw.
     The canvas redraws every frame only while an atom is spinning on screen or the page moves. */
  let lastY = -1, lastT = performance.now(), F = null;
  function frame(now) {
    if (lenis) lenis.raf(now);
    const dt = Math.min((now - lastT) / 1000, 1 / 20); lastT = now;
    const moved = scrollY !== lastY; lastY = scrollY;
    if (!reduceMotion.matches) spin += dt * speed.x;
    if (moved || !F) { F = compose(); stage(F); }
    const atomOnScreen = (F.q2 < 1 && F.B.top < H * 1.4) || F.q4 > 0.3 || F.A.bottom > 0;
    if (moved || (atomOnScreen && !reduceMotion.matches)) { if (!moved) F = compose(); draw(F); }
    requestAnimationFrame(frame);
  }
  size(); F = compose(); stage(F); draw(F);
  requestAnimationFrame(frame);
  addEventListener('resize', () => { size(); F = compose(); stage(F); draw(F); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { size(); draw(F); });
  document.fonts?.ready.then(() => { F = compose(); stage(F); draw(F); });
  head.addEventListener('load', () => draw(compose()));
  device.addEventListener('load', () => draw(compose()));
  slotA.addEventListener('pointerenter', () => speed.to(2.4));
  slotA.addEventListener('pointerleave', () => speed.to(1));

  /* ---------------- Video: custom play button ---------------- */
  (() => {
    const v = $('#ls-video'), btn = $('#ls-play'); if (!v || !btn) return;
    const wrap = v.parentElement;
    btn.addEventListener('click', () => { v.controls = true; v.play().catch(() => {}); wrap.classList.add('is-playing'); });
    v.addEventListener('ended', () => wrap.classList.remove('is-playing'));
  })();

  /* ---------------- Awards: certificate follows the pointer ---------------- */
  (() => {
    const peek = $('#peek'), pimg = $('img', peek), rows = $$('.award');
    if (!peek || !rows.length) return;
    const px = new Spring(0, { damping: 1, response: 0.32 }), py = new Spring(0, { damping: 1, response: 0.32 });
    const ps = new Spring(0, { damping: 1, response: 0.3 });
    let rot = 0, lastX = 0, inside = false;
    const render = () => {
      const s = ps.x;
      peek.style.opacity = String(clamp(s));
      peek.style.transform = `translate3d(${px.x + 24}px, ${py.x - 90}px, 0) rotate(${rot.toFixed(2)}deg) scale(${0.85 + 0.15 * s})`;
    };
    px.on(render); py.on(render); ps.on(render);
    rows.forEach(row => {
      row.addEventListener('pointerenter', e => {
        if (!finePointer.matches || e.pointerType !== 'mouse') return;
        const img = $('img', row);
        pimg.src = img.currentSrc || img.src;
        if (!inside) { px.jump(e.clientX); py.jump(e.clientY); }
        inside = true; ps.to(1);
      });
    });
    const list = $('.awards');
    list.addEventListener('pointermove', e => {
      if (!inside) return;
      rot = clamp((e.clientX - lastX) * 0.4, -6, 6); lastX = e.clientX;
      px.to(e.clientX); py.to(e.clientY);
    });
    list.addEventListener('pointerleave', () => { inside = false; ps.to(0); });
    addEventListener('scroll', () => { if (inside) { inside = false; ps.to(0); } }, { passive: true });
    list.addEventListener('click', () => { inside = false; ps.jump(0); });
  })();

  /* ---------------- Lightbox: zooms from the tapped item and back ---------------- */
  (() => {
    const lb = $('#lightbox'); if (!lb) return;
    const img = $('.lightbox__img', lb), scrim = $('.lightbox__scrim', lb), cap = $('.lightbox__cap', lb);
    const btns = $$('.lightbox__btn', lb);
    const prog = new Spring(0, { damping: 1, response: 0.38 });
    const dx = new Spring(0, { damping: 1, response: 0.32 }), dy = new Spring(0, { damping: 1, response: 0.32 });
    let items = [], idx = 0, thumb = null, to = null, from = { x: 0, y: 0, s: 1 }, isOpen = false, lastFocus = null;

    const fit = (el) => {
      const nw = el.naturalWidth || +el.getAttribute('width') || 4, nh = el.naturalHeight || +el.getAttribute('height') || 3;
      const narrow = innerWidth < 760;
      const mw = innerWidth - (narrow ? 24 : 160), mh = innerHeight - (narrow ? 170 : 150);
      const sc = Math.min(mw / nw, mh / nh, 1.6);
      const w = nw * sc, h = nh * sc;
      return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 - (narrow ? 20 : 0), w, h };
    };
    const thumbRect = () => {
      let r = $('img', thumb).getBoundingClientRect();
      if (!r.width) r = thumb.getBoundingClientRect();
      const sc = Math.min(r.width / to.w, r.height / to.h);
      return { x: r.left + (r.width - to.w * sc) / 2, y: r.top + (r.height - to.h * sc) / 2, s: sc };
    };
    function render() {
      if (!to) return;
      const p = prog.x, q = clamp(p);
      const s = from.s + (1 - from.s) * p;
      const x = from.x + (to.x - from.x) * p + dx.x, y = from.y + (to.y - from.y) * p + dy.x;
      const pull = Math.min(1, Math.abs(dy.x) / 420);
      img.style.transform = `translate3d(${x}px,${y}px,0) scale(${s * (1 - pull * 0.25)})`;
      img.style.opacity = String(Math.min(1, q * 3));
      scrim.style.opacity = String(q * (1 - pull));
      const ui = String(Math.max(0, q * 2 - 1) * (1 - pull));
      cap.style.opacity = ui; btns.forEach(b => { b.style.opacity = ui; });
    }
    prog.on(render); dx.on(render); dy.on(render);

    function show(i, dir = 0) {
      idx = (i + items.length) % items.length;
      thumb = items[idx];
      const t = $('img', thumb);
      img.src = t.currentSrc || t.src; img.alt = t.alt; cap.textContent = t.alt;
      to = fit(t);
      img.style.width = to.w + 'px'; img.style.height = to.h + 'px';
      if (dir) { dx.jump(dir * 90); dx.to(0, { damping: 1, response: 0.4 }); }
      render();
    }
    function open(btn) {
      const group = btn.closest('[data-group]');
      items = group ? $$('[data-zoom]', group) : [btn];
      lb.classList.toggle('is-single', items.length < 2);
      lastFocus = btn;
      const wasOpen = isOpen || !lb.hidden;
      show(items.indexOf(btn));
      if (!wasOpen) { from = thumbRect(); prog.jump(0); }
      isOpen = true; prog.rest = null;
      lb.hidden = false; document.documentElement.style.overflow = 'hidden'; lenis?.stop();
      dx.jump(0); dy.jump(0);
      prog.to(1, { damping: 1, response: 0.38 });
      $('.lightbox__close', lb).focus({ preventScroll: true });
    }
    function close() {
      if (!isOpen) return;
      isOpen = false;
      const p = prog.x;
      const curX = from.x + (to.x - from.x) * p + dx.x, curY = from.y + (to.y - from.y) * p + dy.x;
      dx.jump(0); dy.jump(0);
      from = thumbRect();
      to = { ...to, x: p ? (curX - from.x * (1 - p)) / p : to.x, y: p ? (curY - from.y * (1 - p)) / p : to.y };
      prog.rest = () => {
        if (isOpen) return;
        lb.hidden = true; document.documentElement.style.overflow = ''; lenis?.start();
        lastFocus?.focus({ preventScroll: true });
      };
      prog.to(0, { damping: 1, response: 0.34 });
    }
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-zoom]');
      if (btn && !lb.contains(btn)) { e.preventDefault(); open(btn); }
    });
    $('.lightbox__close', lb).addEventListener('click', () => close());
    $('.lightbox__prev', lb).addEventListener('click', () => show(idx - 1, -1));
    $('.lightbox__next', lb).addEventListener('click', () => show(idx + 1, 1));
    scrim.addEventListener('click', () => close());
    addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' && items.length > 1) show(idx + 1, 1);
      if (e.key === 'ArrowLeft' && items.length > 1) show(idx - 1, -1);
    });
    addEventListener('resize', () => { if (isOpen && thumb) { to = fit($('img', thumb)); img.style.width = to.w + 'px'; img.style.height = to.h + 'px'; render(); } });

    let g = null;
    img.addEventListener('pointerdown', e => {
      if (!isOpen) return;
      img.setPointerCapture(e.pointerId);
      dx.stop(); dy.stop();
      g = { sx: e.clientX - dx.x, sy: e.clientY - dy.x, ox: e.clientX, oy: e.clientY, axis: null, hist: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
    });
    img.addEventListener('pointermove', e => {
      if (!g) return;
      const mx = e.clientX - g.ox, my = e.clientY - g.oy;
      if (!g.axis) {
        if (Math.hypot(mx, my) < 8) return;
        g.axis = Math.abs(mx) > Math.abs(my) && items.length > 1 ? 'x' : 'y';
      }
      if (g.axis === 'x') { dx.x = dx.target = e.clientX - g.sx; }
      else { let y = e.clientY - g.sy; if (y < 0) y = -rubberband(-y, innerHeight); dy.x = dy.target = y; }
      render();
      g.hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (g.hist.length > 6) g.hist.shift();
    });
    const end = (e) => {
      if (!g) return;
      const d = g; g = null;
      const a = d.hist[0], b = d.hist[d.hist.length - 1], dt = Math.max(1, b.t - a.t);
      let vx = (b.x - a.x) / dt * 1000, vy = (b.y - a.y) / dt * 1000;
      if (e.timeStamp - b.t > 80) { vx = 0; vy = 0; }
      if (d.axis === 'x') {
        const proj = dx.x + project(vx, 0.99);
        if (proj < -110) show(idx + 1, 1);
        else if (proj > 110) show(idx - 1, -1);
        else dx.to(0, { velocity: vx, damping: 0.85 });
      } else if (d.axis === 'y') {
        const proj = dy.x + project(vy, 0.99);
        if (proj > 160) close();
        else dy.to(0, { velocity: vy, damping: 0.85, response: 0.35 });
      }
    };
    img.addEventListener('pointerup', end);
    img.addEventListener('pointercancel', end);
  })();

  /* ---------------- Contact: copy email ---------------- */
  $('#copy')?.addEventListener('click', async () => {
    const text = $('#email').textContent.trim();
    try { await navigator.clipboard.writeText(text); showToast('Email copied'); }
    catch {
      const r = document.createRange(); r.selectNodeContents($('#email'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      showToast('Email selected. Press Cmd+C to copy');
    }
  });

  $('#year').textContent = new Date().getFullYear();
})();
