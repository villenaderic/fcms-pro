'use strict';
const Modal = (() => {
  function init() {
    const bg = H.el('modal-bg');
    const cl = H.el('modal-close');
    if (!bg || !cl) return;
    cl.onclick = close;
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !bg.classList.contains('hidden')) close();
    });
  }

  function open({ title = '', body = '', foot = '', size = '', onClose } = {}) {
    const bg  = H.el('modal-bg');
    const box = H.el('modal-box');
    if (!bg || !box) return;
    H.el('modal-title').textContent = title;
    H.el('modal-body').innerHTML    = body;
    H.el('modal-foot').innerHTML    = foot;
    box.className = 'modal' + (size ? ' ' + size : '');
    bg.classList.remove('hidden');
    document.body.classList.add('modal-open');
    bg._onClose = onClose || null;
    // Focus first interactive element
    setTimeout(() => {
      const f = bg.querySelector('input:not([type=hidden]),select,textarea,button.btn-primary');
      if (f) f.focus();
    }, 80);
  }

  function close() {
    const bg = H.el('modal-bg');
    if (!bg) return;
    bg.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (bg._onClose) { try { bg._onClose(); } catch(e) {} bg._onClose = null; }
  }

  function confirm({ title = 'Confirm', message = '', confirmLabel = 'Confirm', danger = false, onConfirm } = {}) {
    open({
      title, size: 'sm',
      body: `<p style="font-size:.88rem;color:var(--t2);line-height:1.65">${H.esc(message)}</p>
             ${danger ? '<p style="font-size:.8rem;color:var(--red);font-weight:700;margin-top:10px">⚠ This action cannot be undone.</p>' : ''}`,
      foot: `<button class="btn btn-ghost" id="mc-no">Cancel</button>
             <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="mc-yes">${H.esc(confirmLabel)}</button>`
    });
    setTimeout(() => {
      const yes = H.el('mc-yes'), no = H.el('mc-no');
      if (yes) yes.onclick = () => { close(); if (onConfirm) onConfirm(); };
      if (no)  no.onclick  = close;
      if (yes) yes.focus();
    }, 30);
  }

  function setBusy(busy, busyText = 'Saving…') {
    const foot = H.el('modal-foot'); if (!foot) return;
    const buttons = Array.from(foot.querySelectorAll('button'));
    if (!buttons.length) return;
    const active = document.activeElement;
    const target = (active && buttons.includes(active)) ? active : (foot.querySelector('.btn-primary') || buttons[0]);
    buttons.forEach(b => { b.disabled = busy; });
    if (busy) {
      if (!target.dataset.origText) target.dataset.origText = target.textContent;
      target.textContent = busyText;
    } else {
      buttons.forEach(b => {
        if (b.dataset.origText) { b.textContent = b.dataset.origText; delete b.dataset.origText; }
      });
    }
  }

  return { init, open, close, confirm, setBusy };
})();
