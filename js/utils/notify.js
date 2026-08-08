'use strict';
const Notify = (() => {
  const ICO = { ok: '✔', err: '✖', wrn: '⚠', inf: 'ℹ' };
  const DUR = { ok: 3500, err: 5500, wrn: 4000, inf: 3500 };

  function _sanitize(s) {
    if (typeof s !== 'string') s = String(s || '');
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function show(type, msg, ms) {
    const c = H.el('toasts'); if (!c) return;
    // Deduplicate: don't stack same message
    const existing = c.querySelectorAll('.toast-msg');
    for (const el of existing) {
      if (el.textContent === msg) return;
    }
    const d = document.createElement('div');
    d.className = `toast t-${type}`;
    d.setAttribute('role', 'alert');
    d.innerHTML = `
      <span class="toast-ico" aria-hidden="true">${ICO[type] || 'ℹ'}</span>
      <div class="toast-body">
        <div class="toast-msg">${_sanitize(msg)}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss notification" title="Dismiss">✕</button>`;
    c.appendChild(d);
    d.querySelector('.toast-close').onclick = () => _dismiss(d);
    const timer = setTimeout(() => _dismiss(d), ms || DUR[type] || 4000);
    d.querySelector('.toast-close').addEventListener('click', () => clearTimeout(timer));
  }

  function _dismiss(d) {
    if (!d?.parentNode) return;
    d.style.cssText = 'opacity:0;transform:translateY(10px);transition:all .18s ease;pointer-events:none';
    setTimeout(() => d.parentNode?.removeChild(d), 200);
  }

  return {
    ok:  (m, t) => show('ok',  m, t),
    err: (m, t) => show('err', m, t),
    wrn: (m, t) => show('wrn', m, t),
    inf: (m, t) => show('inf', m, t),
  };
})();
