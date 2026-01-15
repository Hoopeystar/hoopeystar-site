(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Year
  const y = $('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());

  // Sticky header elevation state
  const topbar = $('[data-elevate]');
  const setScrolled = () => {
    if (!topbar) return;
    topbar.dataset.scrolled = (window.scrollY > 8) ? "true" : "false";
  };
  setScrolled();
  window.addEventListener('scroll', setScrolled, { passive: true });

(function () {
  const carousels = document.querySelectorAll('[data-carousel]');

  carousels.forEach((root) => {
    const track = root.querySelector('.carousel-track');
    if (!track) return;

    const slides = Array.from(track.querySelectorAll('img'));
    if (!slides.length) return;

    const prev = root.querySelector('.carousel-btn.prev');
    const next = root.querySelector('.carousel-btn.next');
    const dotsWrap = root.querySelector('.carousel-dots');

    // ✅ caption element lives outside .carousel (inside the same figure)
    const caption = root.closest('figure')?.querySelector('.carousel-caption');

    let index = 0;

    // Build dots (only if wrapper exists)
    const dots = dotsWrap ? slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'carousel-dot';
      b.setAttribute('aria-label', `Go to image ${i + 1}`);
      b.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(b);
      return b;
    }) : [];

    function render() {
      track.style.transform = `translateX(-${index * 100}%)`;

      if (dots.length) {
        dots.forEach((d, i) =>
          d.setAttribute('aria-current', i === index ? 'true' : 'false')
        );
      }

      // ✅ CAPTION SYNC
      if (caption) caption.textContent = slides[index].dataset.caption || '';

      // buttons might not exist (ex: single-image carousel)
      if (prev && next) {
        prev.disabled = (index === 0);
        next.disabled = (index === slides.length - 1);
        prev.style.opacity = prev.disabled ? 0.45 : 1;
        next.style.opacity = next.disabled ? 0.45 : 1;
      }
    }

    function goTo(i) {
      index = Math.max(0, Math.min(slides.length - 1, i));
      render();
    }

    if (prev) prev.addEventListener('click', () => goTo(index - 1));
    if (next) next.addEventListener('click', () => goTo(index + 1));

    // Swipe support
    const viewport = root.querySelector('.carousel-viewport');
    if (viewport) {
      let startX = null;

      viewport.addEventListener('pointerdown', (e) => {
        startX = e.clientX;
      });

      viewport.addEventListener('pointerup', (e) => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1));
        startX = null;
      });
    }

    render();
  });
})();


  // Mobile nav
  const toggle = $('[data-nav-toggle]');
  const mobileNav = $('[data-mobile-nav]');
  if (toggle && mobileNav) {
    const close = () => {
      toggle.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      mobileNav.hidden = open;
    });
    // Close on link click
    $$('a', mobileNav).forEach(a => a.addEventListener('click', close));
    // Close on escape
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // Reveal on scroll (IntersectionObserver)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = $$('.reveal');

  if (reduceMotion) {
    revealEls.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  }

  // Magnetic buttons (subtle)
  const magnets = $$('[data-magnet]');
  if (!reduceMotion && magnets.length) {
    magnets.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        const dx = x / (r.width / 2);
        const dy = y / (r.height / 2);
        btn.style.transform = `translate(${dx * 4}px, ${dy * 4}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // Tilt cards (lightweight, pointer only)
  const tilts = $$('[data-tilt]');
  if (!reduceMotion && tilts.length) {
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    tilts.forEach(el => {
      let raf = 0;
      const onMove = (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          const rx = clamp((0.5 - py) * 10, -8, 8);
          const ry = clamp((px - 0.5) * 10, -8, 8);
          el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });
      };
      const reset = () => (el.style.transform = '');
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', reset);
      el.addEventListener('blur', reset);
    });
  }

  // Formspree-ready form UX:
  // - If action is still "#", we prevent submission and show a clear status.
  // - Once you add a Formspree endpoint, it submits normally.
  const form = $('[data-form]');
  const status = $('[data-status]');
  if (form && status) {
    form.addEventListener('submit', async (e) => {
      const action = form.getAttribute('action') || '';
      if (action.trim() === '#' || action.trim() === '') {
        e.preventDefault();
        status.className = 'form-status err';
        status.textContent = 'Form not connected yet. Add your Formspree endpoint to the form action in index.html.';
        return;
      }
      // Optional enhancement: AJAX submit to avoid navigation (works with Formspree endpoints).
      // If you prefer standard POST navigation, delete this block.
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = 'Sending…';

      try {
        const fd = new FormData(form);
        const res = await fetch(action, {
          method: 'POST',
          body: fd,
          headers: { 'Accept': 'application/json' }
        });

        if (res.ok) {
          form.reset();
          status.className = 'form-status ok';
          status.textContent = 'Sent. Thank you! I will get back to you soon.';
        } else {
          status.className = 'form-status err';
          status.textContent = 'Something failed sending the form. Try again.';
        }
      } catch {
        status.className = 'form-status err';
        status.textContent = 'Network error. Try again, or submit later.';
      }
    });
  }

  // Ambient Canvas FX (premium motion, low cost)
  const canvas = $('#fx-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });
    let w = 0, h = 0, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let particles = [];
    let running = !reduceMotion;
    let last = performance.now();

    const colors = [
      { r: 146, g: 0, b: 255, a: 0.28 }, // purple
      { r: 255, g: 45, b: 45, a: 0.22 }, // red
      { r: 255, g: 216, b: 74, a: 0.18 } // yellow
    ];

    function resize() {
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Particles scale with area, capped
      const target = Math.max(28, Math.min(70, Math.floor((w * h) / 22000)));
      particles = Array.from({ length: target }, () => makeParticle(true));
    }

    function rand(min, max) { return min + Math.random() * (max - min); }

    function makeParticle(spawnAnywhere = false) {
      const c = colors[(Math.random() * colors.length) | 0];
      return {
        x: spawnAnywhere ? rand(0, w) : rand(-40, w + 40),
        y: spawnAnywhere ? rand(0, h) : rand(-40, h + 40),
        r: rand(1.2, 3.4),
        vx: rand(-0.25, 0.25),
        vy: rand(-0.20, 0.20),
        a: c.a,
        cr: c.r, cg: c.g, cb: c.b,
        tw: rand(0.6, 1.4),
        t: rand(0, Math.PI * 2),
      };
    }

    function draw(dt) {
      ctx.clearRect(0, 0, w, h);

      // soft vignette (subtle)
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 80, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
      grad.addColorStop(0, 'rgba(7,7,13,0)');
      grad.addColorStop(1, 'rgba(7,7,13,0.38)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.t += dt * 0.0006 * p.tw;
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;

        // gentle drift + wrap
        if (p.x < -60) p.x = w + 60;
        if (p.x > w + 60) p.x = -60;
        if (p.y < -60) p.y = h + 60;
        if (p.y > h + 60) p.y = -60;

        const pulse = 0.6 + 0.4 * Math.sin(p.t);
        const rr = p.r * (0.9 + pulse * 0.35);

        // glow dot
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${p.a * (0.55 + pulse * 0.45)})`;
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();

        // bloom
        const bloom = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 10);
        bloom.addColorStop(0, `rgba(${p.cr},${p.cg},${p.cb},${p.a * 0.22})`);
        bloom.addColorStop(1, `rgba(${p.cr},${p.cg},${p.cb},0)`);
        ctx.fillStyle = bloom;
        ctx.fillRect(p.x - rr * 10, p.y - rr * 10, rr * 20, rr * 20);
      }

      // connections (only nearby, capped cost)
      ctx.lineWidth = 1;
      const maxLinks = 140;
      let links = 0;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) {
            const t = 1 - (Math.sqrt(d2) / 140);
            ctx.strokeStyle = `rgba(243,244,255,${0.06 * t})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            if (++links > maxLinks) break;
          }
        }
        if (links > maxLinks) break;
      }
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min(40, now - last);
      last = now;
      draw(dt);
      requestAnimationFrame(loop);
    }

    const onVis = () => {
      const hidden = document.hidden;
      running = !reduceMotion && !hidden;
      if (running) {
        last = performance.now();
        requestAnimationFrame(loop);
      }
    };

    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVis);

    resize();
    onVis();
  }
})();
