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
  const steps = Array.from(rail.querySelectorAll('[data-cr-event]'));
  const caps = Array.from(rail.querySelectorAll('[data-cr-cap]'));
  const sync = rail.querySelector('[data-sync-age]');

  // Map each event-stream row to the state capsule it activates:
  // rows: 0 provider status, 1 proof captured, 2 recon matched,
  //       3 audit updated, 4 finality ready, 5 report generated
  // caps: 0 provider proof, 1 independent recon, 2 audit trail, 3 finality
  const capForStep = [0, 0, 1, 2, 3, 3];

  if (reduce) return; // static scene already reads as complete

  // Sequential stage activation: a pulse travels the chain and lights the
  // matching capsule, looping softly.
  if (steps.length) {
    let i = 0;
    const tick = () => {
      steps.forEach((el) => el.classList.remove('is-pulse'));
      caps.forEach((c) => c.classList.remove('is-live'));
      const el = steps[i % steps.length];
      if (el) el.classList.add('is-pulse');
      const cap = caps[capForStep[i % steps.length]];
      if (cap) cap.classList.add('is-live');
      i += 1;
    };
    tick();
    const loop = window.setInterval(tick, 1500);
    window.addEventListener('pagehide', () => window.clearInterval(loop));
  }

  // Live "synced Ns ago" signal.
  if (sync) {
    let last = Date.now();
    const render = () => {
      const secs = Math.floor((Date.now() - last) / 1000);
      sync.textContent = secs < 3 ? 'synced just now' : `synced ${secs}s ago`;
    };
    const t = window.setInterval(render, 1000);
    window.addEventListener('pagehide', () => window.clearInterval(t));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = Date.now(); render(); } });
  }
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
