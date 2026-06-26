const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menuBtn = document.querySelector('[data-menu]');
const mobile = document.querySelector('[data-mobile]');

function setMobileMenu(open) {
  if (!menuBtn || !mobile) return;
  mobile.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
}

if (menuBtn && mobile) {
  menuBtn.addEventListener('click', () => {
    setMobileMenu(!mobile.classList.contains('open'));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMobileMenu(false);
  });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    const id = anchor.getAttribute('href');
    if (!id || id.length <= 1) return;

    const el = document.querySelector(id);
    if (!el) return;

    event.preventDefault();
    el.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    setMobileMenu(false);
  });
});

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const parent = entry.target.parentElement;
      const siblings = parent ? Array.from(parent.children) : [];
      const stagger = Math.min(Math.max(siblings.indexOf(entry.target), 0), 5) * 80;

      entry.target.classList.add('revealed');

      entry.target.animate([
        { opacity: 0, transform: 'translateY(18px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 520,
        delay: stagger,
        easing: 'cubic-bezier(.2,.7,.2,1)',
        fill: 'both'
      });
      obs.unobserve(entry.target);
    });
  }, { threshold: .12 });

  document
    .querySelectorAll('.card,.stat,.dashboard,.table,.contact-box,.panel,.endpoint,.code-panel')
    .forEach((el) => obs.observe(el));
}

(() => {
  const rail = document.querySelector('[data-live-rail]');
  if (!rail) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const events = Array.from(rail.querySelectorAll('[data-cr-event]'));
  const recon = rail.querySelector('[data-recon-status]');
  const sync = rail.querySelector('[data-sync-age]');
  const total = events.length;

  function setRecon(matched) {
    if (!recon) return;
    recon.textContent = matched ? 'Matched' : 'Pending';
    recon.classList.toggle('cr-ok', matched);
    recon.classList.toggle('cr-amber', !matched);
  }

  // Reduced motion: show the settled, all-revealed state.
  if (reduce) {
    events.forEach((el) => el.classList.add('is-on'));
    setRecon(true);
    return;
  }

  // 1) Reveal the evidence stream once, staggered (the "wow" on load).
  events.forEach((el, i) => window.setTimeout(() => el.classList.add('is-on'), 180 + i * 260));

  // 2) Then loop a calm pulse through the stream; recon flips Pending -> Matched
  //    on the "Independent record matched" step (index 2) and resets each cycle.
  let i = 0;
  const tick = () => {
    events.forEach((e) => e.classList.remove('is-active'));
    const el = events[i % total];
    if (el) el.classList.add('is-active');
    setRecon((i % total) >= 2);
    i += 1;
  };
  let loopTimer = null;
  const startTimer = window.setTimeout(() => {
    tick();
    loopTimer = window.setInterval(tick, 2200);
  }, 180 + total * 260);

  // 3) Live "synced Ns ago" signal.
  let last = Date.now();
  const renderSync = () => {
    if (!sync) return;
    const secs = Math.floor((Date.now() - last) / 1000);
    sync.textContent = secs < 3 ? 'synced just now' : `synced ${secs}s ago`;
  };
  const syncTimer = window.setInterval(renderSync, 1000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { last = Date.now(); renderSync(); }
  });
  window.addEventListener('pagehide', () => {
    window.clearTimeout(startTimer);
    if (loopTimer) window.clearInterval(loopTimer);
    window.clearInterval(syncTimer);
  });
})();

(() => {
  const el = document.querySelector('[data-proof-status]');
  if (!el) return;
  const states = [
    'Treasury sync operational',
    'Settlement notices active',
    'Liquidity desk online',
    'Infrastructure channels live',
    'Corridor updates monitored'
  ];
  let i = Math.floor(Date.now() / 600000) % states.length;
  const set = () => {
    el.style.opacity = '0';
    window.setTimeout(() => {
      el.textContent = states[i % states.length];
      el.style.opacity = '1';
      i += 1;
    }, 160);
  };
  if (!reducedMotion.matches) el.style.transition = 'opacity .18s ease';
  el.textContent = states[i % states.length];
  i += 1;
  if (!reducedMotion.matches) window.setInterval(set, 9000);
})();
