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

      entry.target.animate([
        { opacity: 0, transform: 'translateY(18px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 520,
        easing: 'cubic-bezier(.2,.7,.2,1)',
        fill: 'both'
      });
      obs.unobserve(entry.target);
    });
  }, { threshold: .12 });

  document.querySelectorAll('.card,.stat,.dashboard,.table,.contact-box').forEach((el) => obs.observe(el));
}

(() => {
  const rail = document.querySelector('[data-live-rail]');
  if (!rail) return;

  const $ = (selector) => rail.querySelector(selector);
  const list = $('[data-settlement-list]');
  const metric = (name) => $(`[data-metric="${name}"]`);
  const delta = (name) => $(`[data-delta="${name}"]`);

  const corridors = [
    'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','UAE route','Singapore','Pune','Gurugram','Noida','Ahmedabad','Kochi','Jaipur','Indore'
  ];
  const eventTypes = [
    'PSP batch','Payouts','Rebalance','Allocation','Liquidity sync','Settlement','Reserve top-up','Quote','Payout file','Reconciliation','Prefunding','Ledger check','Instruction','Webhook','Reserve release'
  ];
  const sourceLegs = ['INR Treasury','Client Reserve','PSP Pool','Merchant Rail','Liquidity Desk','INR Rail'];
  const destinationLegs = ['USDT Rail','USDT Wallet','USDT Reserve','Payout Rail','USDT Float','Settlement Rail'];
  const controls = ['Route verified','Quote live','Ledger signed','Audit logged','Reserve checked'];
  const statusByStage = [
    { label: 'Queued', cls: 'neutral' },
    { label: 'Executing', cls: 'pending' },
    { label: 'Confirmed', cls: 'ok' },
    { label: 'Reconciling', cls: 'pending' },
    { label: 'Settled', cls: 'ok' },
    { label: 'Reconciled', cls: 'ok' },
    { label: 'Review', cls: 'review' }
  ];

  const hourlySeed = () => {
    const d = new Date();
    return Number(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}${String(d.getUTCHours()).padStart(2,'0')}${String(Math.floor(d.getUTCMinutes()/10)).padStart(2,'0')}`);
  };
  let seed = hourlySeed() + Math.floor((performance.now() || 1) * 13);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const code = (prefix) => `${prefix}-${Math.floor(4096 + rand() * 61439).toString(16).toUpperCase()}`;
  const ago = () => `${Math.max(3, Math.floor(rand() * 54))}s ago`;
  const batch = () => Math.floor(80 + rand() * 620);
  const hash = () => `0x${Math.floor(rand()*0xffff).toString(16).padStart(4,'0')}···${Math.floor(rand()*0xffff).toString(16).padStart(4,'0')}`;

  let state = {
  inr: 165 + rand() * 45,
  usdt: 3.8 + rand() * 1.2,
  queue: 1 + Math.floor(rand() * 3),
  last: 1 + Math.floor(rand() * 4),
  uptime: 0
};

const format = {
  inr: (v) => `₹${Math.round(v)}k`,
  usdt: (v) => `${v.toFixed(1)}k`,
  queue: (v) => `${Math.round(v)}`
};

  function eventPrefix(type) {
    if (/payout|Payout/.test(type)) return 'PAY';
    if (/Reconciliation|Ledger/.test(type)) return 'REC';
    if (/Liquidity|Reserve|Prefunding/.test(type)) return 'LIQ';
    if (/Webhook/.test(type)) return 'WHK';
    return 'SET';
  }

  function generateEvent() {
    const type = pick(eventTypes);
    const corridor = pick(corridors);
    const status = pick(statusByStage);
    const suffix = /batch|file|instruction/.test(type) ? ` · ${batch()} items` : '';
    return {
      title: `${type} · ${corridor}${suffix}`,
      id: code(eventPrefix(type)),
      status,
      time: ago(),
      route: corridor
    };
  }

  function applyEvent(row, ev, delay = 0) {
    window.setTimeout(() => {
      row.classList.add('updating');
      window.setTimeout(() => {
        const title = row.querySelector('span:first-child');
        const meta = row.querySelector('small');
        const pill = row.querySelector('.pill');
        if (title) title.textContent = ev.title;
        if (meta) meta.textContent = `${ev.id} · ${ev.time}`;
        if (pill) { pill.className = `pill ${ev.status.cls}`; pill.textContent = ev.status.label; }
        row.classList.remove('updating');
        row.classList.add('settled-flash');
        window.setTimeout(() => row.classList.remove('settled-flash'), 520);
      }, 180);
    }, delay);
  }

  function stableRenderInitial() {
    const rows = Array.from(list.querySelectorAll('.settlement-row'));
    rows.forEach((row, i) => applyEvent(row, generateEvent(), i * 70));
  }

  function setTextStable(el, value) {
    if (!el || el.textContent === value) return;
    el.textContent = value;
  }

  function updateMetrics() {
    const old = { ...state };
    state.inr = Math.min(220, Math.max(120, state.inr + (rand() - 0.46) * 8));
state.usdt = Math.min(5.5, Math.max(2.8, state.usdt + (rand() - 0.47) * 0.4));
state.queue = Math.min(4, Math.max(1, state.queue + Math.round((rand() - 0.48) * 1)));
state.last = 1 + Math.floor(rand() * 6);

    setTextStable(metric('inr'), format.inr(state.inr));
    setTextStable(metric('usdt'), format.usdt(state.usdt));
    setTextStable(metric('queue'), format.queue(state.queue));

    setTextStable(delta('inr'), `${state.inr >= old.inr ? '+' : '-'}₹${Math.round(Math.abs(state.inr - old.inr))}k`);
    setTextStable(delta('usdt'), `${state.usdt >= old.usdt ? '+' : '-'}${Math.abs(state.usdt - old.usdt).toFixed(1)}k`);
    setTextStable(delta('queue'), `${Math.max(1, Math.floor(state.queue * 0.22))} executing`);

    setTextStable($('[data-last-settlement]'), `${state.last}s ago`);
    setTextStable($('[data-sync-age]'), `synced ${Math.max(2, Math.floor(rand()*10))}s ago`);
    setTextStable($('[data-uptime]'), `Operational`);
    setTextStable($('[data-ledger-hash]'), hash());

    rail.querySelectorAll('[data-metric-card]').forEach((card) => {
      card.classList.add('value-fade');
      window.setTimeout(() => card.classList.remove('value-fade'), 300);
    });
  }

  function updateFlow(ev) {
    setTextStable($('[data-source-leg]'), pick(sourceLegs));
    setTextStable($('[data-destination-leg]'), pick(destinationLegs));
    setTextStable($('[data-source-meta]'), pick(['Reserve allocated','Bank leg verified','Treasury window open','Source balance locked','Settlement account checked']));
    setTextStable($('[data-destination-meta]'), pick(['Execution window active','Wallet route prepared','Settlement leg pending','Destination confirmed','Webhook delivery ready']));
    setTextStable($('[data-execution-id]'), ev.id);
    setTextStable($('[data-execution-route]'), ev.route);
    setTextStable($('[data-execution-window]'), ev.time);
    setTextStable($('[data-control-state]'), pick(controls));
  }

  let feedIndex = 0;
  function cycle() {
    const ev = generateEvent();
    const rows = Array.from(list.querySelectorAll('.settlement-row'));
    const row = rows[feedIndex % rows.length];
    applyEvent(row, ev);
    feedIndex += 1;
    updateFlow(ev);
    updateMetrics();
  }

  stableRenderInitial();
  const first = generateEvent();
  updateMetrics();
  updateFlow(first);

  if (reducedMotion.matches) return;

  let metricsTimer = window.setInterval(updateMetrics, 5200 + Math.floor(rand() * 2200));
  let feedTimer = window.setInterval(cycle, 7600 + Math.floor(rand() * 3200));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearInterval(metricsTimer);
      window.clearInterval(feedTimer);
    } else {
      updateMetrics();
      updateFlow(generateEvent());
      metricsTimer = window.setInterval(updateMetrics, 5200 + Math.floor(rand() * 2200));
      feedTimer = window.setInterval(cycle, 7600 + Math.floor(rand() * 3200));
    }
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
