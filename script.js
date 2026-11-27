/* Tri Nguyen — site interactions.
 * One ambient motion only: the carbon orbit around the headshot (it tilts away as you scroll).
 * Everything else answers an action: the SATE rings draw once when reached, the certificate
 * follows the pointer, photos open from where they sit. Springs use Apple's damping/response. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

  /* ---------------- Spring ---------------- */
  class Spring {
    constructor(value, { damping = 1, response = 0.4 } = {}) {
      this.x = value; this.v = 0; this.target = value;
      this.config(damping, response);
      this.subs = []; this.raf = 0; this.last = 0; this.rest = null;
    }
    config(damping, response) {
      this.k = Math.pow((2 * Math.PI) / response, 2);
      this.c = (4 * Math.PI * damping) / response;
    }
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
      let dt = Math.min((now - this.last) / 1000, 1 / 30);
      this.last = now;
      while (dt > 0) {
        const s = Math.min(1 / 240, dt);
        const a = -this.k * (this.x - this.target) - this.c * this.v;
        this.v += a * s; this.x += this.v * s; dt -= s;
      }
      if (Math.abs(this.x - this.target) < 0.01 && Math.abs(this.v) < 0.5) {
        this.x = this.target; this.v = 0; this.raf = 0; this.emit(); this.rest?.(); return;
      }
      this.emit();
      this.raf = requestAnimationFrame(t => this.tick(t));
    }
  }
  const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);
  const rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

  /* ---------------- Toast ---------------- */
  const toast = $('#toast'); let toastTimer;
  const showToast = (msg) => {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1800);
  };

  /* ---------------- Anchor links: offset for the sticky bar ---------------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
    e.preventDefault();
    const y = el.id === 'about' ? 0 : el.getBoundingClientRect().top + scrollY - 70;
    scrollTo({ top: Math.max(0, y), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + el.id);
  });

  /* ---------------- Active section in the bar ---------------- */
  (() => {
    const links = $$('.top__nav a');
    const sections = links.map(a => document.getElementById(a.dataset.section));
    const update = () => {
      let cur = null;
      for (const s of sections) if (s.getBoundingClientRect().top <= innerHeight * 0.4) cur = s.id;
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = 'contact';
      links.forEach(a => a.classList.toggle('is-active', a.dataset.section === cur));
    };
    addEventListener('scroll', update, { passive: true });
    update();
  })();

  /* ---------------- Carbon orbit: 6 electrons around the headshot ---------------- */
  (() => {
    const box = $('#orbit'); if (!box) return;
    const back = $('.orbit__back', box), front = $('.orbit__front', box);
    const bctx = back.getContext('2d'), fctx = front.getContext('2d');
    let W = 0, H = 0, dpr = 1, blue = '#005bbb', ink = '#1b1f27', visible = true, raf = 0, t = 1.2, last = performance.now();
    // carbon: 2 electrons on the inner shell, 4 on the outer shell (radii as a share of the box width)
    const shells = [
      { r: 0.40, n: 2, tilt: 70, rotZ: -24, speed: 0.6 },
      { r: 0.56, n: 4, tilt: 72, rotZ: 30, speed: -0.38 },
    ];
    const speed = new Spring(1, { damping: 1, response: 0.6 });
    const rad = d => d * Math.PI / 180;
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = back.clientWidth; H = back.clientHeight;
      for (const c of [back, front]) { c.width = W * dpr; c.height = H * dpr; c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
      blue = cssVar(box, '--blue') || blue; ink = cssVar(box, '--ink') || ink;
    }
    function point(R, a, tiltDeg, rotDeg) {
      const x0 = R * Math.cos(a), y0 = R * Math.sin(a);
      const tl = rad(tiltDeg), rz = rad(rotDeg);
      const y1 = y0 * Math.cos(tl), z = y0 * Math.sin(tl);
      return { x: W / 2 + x0 * Math.cos(rz) - y1 * Math.sin(rz), y: H / 2 + x0 * Math.sin(rz) + y1 * Math.cos(rz), z };
    }
    function draw() {
      bctx.clearRect(0, 0, W, H); fctx.clearRect(0, 0, W, H);
      // leaving the top of the page tilts the orbits flatter and fades them a little
      const h = clamp(scrollY / Math.max(1, box.getBoundingClientRect().bottom + scrollY));
      const w = box.clientWidth;
      shells.forEach((sh, si) => {
        const R = w * sh.r;
        const tilt = sh.tilt + h * 14 * (si ? 1 : -1), rot = sh.rotZ + h * 18 * (si ? 1 : -1);
        const N = 120;
        let prev = point(R, 0, tilt, rot);
        for (let i = 1; i <= N; i++) {
          const q = point(R, (i / N) * Math.PI * 2, tilt, rot);
          const behind = prev.z + q.z < 0;
          const ctx = behind ? bctx : fctx;
          ctx.globalAlpha = (behind ? 0.16 : 0.34) * (1 - h * 0.5);
          ctx.strokeStyle = ink; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          prev = q;
        }
        for (let k = 0; k < sh.n; k++) {
          const a = t * sh.speed + (k / sh.n) * Math.PI * 2 + si * 0.7;
          const e = point(R, a, tilt, rot);
          const depth = e.z / R;
          const behind = e.z < 0;
          const ctx = behind ? bctx : fctx;
          ctx.globalAlpha = behind ? 0.45 : 1;
          ctx.fillStyle = blue;
          ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(2.2, 4.4 + depth * 1.4), 0, Math.PI * 2); ctx.fill();
        }
      });
      bctx.globalAlpha = fctx.globalAlpha = 1;
    }
    function loop(now) {
      t += Math.min((now - last) / 1000, 1 / 20) * speed.x; last = now;
      draw();
      raf = visible && !reduceMotion.matches ? requestAnimationFrame(loop) : 0;
    }
    const start = () => { if (!raf && !reduceMotion.matches) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    size(); draw(); start();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(box);
    addEventListener('resize', () => { size(); draw(); });
    addEventListener('scroll', () => { if (!raf) draw(); }, { passive: true });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { size(); draw(); });
    box.addEventListener('pointerenter', () => speed.to(2.4));
    box.addEventListener('pointerleave', () => speed.to(1));
  })();

  /* ---------------- SATE rings: draw once when they come into view ---------------- */
  (() => {
    const layers = $('#layers'); if (!layers) return;
    if (reduceMotion.matches || !('IntersectionObserver' in window)) { layers.classList.add('is-in'); return; }
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { layers.classList.add('is-in'); o.disconnect(); } }, { threshold: 0.55 }).observe(layers);
  })();

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
      lb.hidden = false; document.documentElement.style.overflow = 'hidden';
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
        lb.hidden = true; document.documentElement.style.overflow = '';
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
