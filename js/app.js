'use strict';
/* ═══════════════════════════════════════════════════════════════
   FCMS Pro v3.5 - App Controller
   Full keyboard nav · Notifications · Global search · Idle lock
═══════════════════════════════════════════════════════════════ */
const App = (() => {

  const ROUTES = {
    dashboard:   p => Dashboard.render(p),
    analytics:   p => Analytics.render(p),
    clients:     p => Clients.render(p),
    commissions: p => Commissions.render(p),
    payments:    p => Payments.render(p),
    receipts:    p => Receipts.render(p),
    expenses:    p => Expenses.render(p),
    invoices:    p => Invoices.render(p),
    logs:        p => Logs.render(p),
    backup:      p => Backup.render(p),
    settings:    p => Settings.render(p),
    templates:   p => Templates.render(p),
    goals:       p => Goals.render(p),
    quotes:      p => Quotes.render(p),
  };

  const PAGE_LABELS = {
    dashboard:'Dashboard', analytics:'Analytics', clients:'Clients', commissions:'Commissions',
    payments:'Payments', receipts:'Receipts', expenses:'Expenses', invoices:'Invoices',
    logs:'Activity Logs', backup:'Backup & Restore', settings:'Settings', templates:'Templates',
    goals:'Goals', quotes:'Quotes'
  };

  function setBreadcrumb(parts) {
    const el = H.el('breadcrumb'); if (!el) return;
    el.innerHTML = parts.filter(Boolean).map((p, i, arr) => i === arr.length - 1
      ? `<span class="bc-current">${H.esc(p)}</span>`
      : `<span class="bc-part">${H.esc(p)}</span><span class="bc-sep">/</span>`
    ).join('');
  }
  function setBreadcrumbTail(tail) {
    setBreadcrumb([PAGE_LABELS[_page] || '', tail]);
  }

  let _page    = 'dashboard';
  let _pwa     = null;          // deferred install prompt
  let _kbBuf   = '';            // two-key shortcut buffer
  let _kbTimer = null;
  let _notifOpen = false;
  let _userOpen  = false;

  /* ── BOOT ─────────────────────────────────────────────────── */
  async function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); _pwa = e; _showInstallBanner();
    });

    await DB.open();
    Modal.init();
    _applyTheme();

    const ready = await Auth.isSetupDone();
    if (!ready) { _showSetup(); return; }
    if (!Auth.isLoggedIn()) { _showLogin(); return; }
    await _launch();
  }

  /* ── SETUP ────────────────────────────────────────────────── */
  function _showSetup() {
    H.el('setup-screen').classList.remove('hidden');
    H.el('login-screen').classList.add('hidden');
    H.el('app').classList.add('hidden');

    const passEl = H.el('su-pass');
    if (passEl) passEl.addEventListener('input', () => {
      const str = H.pwdStrength(passEl.value);
      const bar = H.el('su-bar'); const lbl = H.el('su-lbl');
      if (bar) bar.className = 'str-bar' + (passEl.value ? ' '+str : '');
      if (lbl) lbl.textContent = passEl.value ? ({w:'Weak - try longer with symbols',m:'Medium',s:'Strong'}[str]) : '';
    });

    H.el('setup-form').onsubmit = async e => {
      e.preventDefault();
      const biz  = (H.el('su-biz')?.value  || '').trim();
      const free = (H.el('su-free')?.value  || '').trim();
      const cur  = (H.el('su-cur')?.value   || '₱').trim() || '₱';
      const phone= (H.el('su-phone')?.value || '').trim();
      const user = (H.el('su-user')?.value  || '').trim();
      const pass = H.el('su-pass')?.value  || '';
      const conf = H.el('su-conf')?.value  || '';
      if (!biz)            return Notify.err('Business name is required.');
      if (user.length < 3) return Notify.err('Username must be at least 3 characters.');
      if (pass.length < 6) return Notify.err('Password must be at least 6 characters.');
      if (pass !== conf)   return Notify.err('Passwords do not match.');
      if (/[<>&'"]/.test(biz) || /[<>&'"]/.test(user)) {
        Notify.err('Name cannot contain special characters like < > & \' "');
        return;
      }
    await Auth.createAdmin(user, pass, biz);
      Settings.set('freelancerName', free);
      Settings.set('currencySymbol', cur);
      Settings.set('contactNumber', phone);
      Auth.createSession(user);
      await Logs.add('login', `Admin account created: ${user}`);
      H.el('setup-screen').classList.add('hidden');
      await _launch();
    };
  }

  /* ── LOGIN ────────────────────────────────────────────────── */
  function _showLogin() {
    H.el('setup-screen').classList.add('hidden');
    H.el('app').classList.add('hidden');
    H.el('login-screen').classList.remove('hidden');
    const biz = Settings.get('businessName', '');
    if (biz) { const el = H.el('login-biz-name'); if (el) el.textContent = `Welcome back to ${biz}`; }
    _checkLock();

    H.el('login-form').onsubmit = async e => {
      e.preventDefault();
      if (Auth.isLocked()) return;
      const user = (H.el('li-user')?.value || '').trim();
      const pass = H.el('li-pass')?.value  || '';
      const btn  = H.el('li-btn');
      if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
      const ok = await Auth.verifyLogin(user, pass);
      if (ok) {
        Auth.clearLock();
        Auth.createSession(user);
        Auth.resetIdle();
        await Logs.add('login', `Signed in: ${user}`);
        H.el('login-screen').classList.add('hidden');
        await _launch();
      } else {
        Auth.failedAttempt();
        _checkLock();
        Notify.err('Invalid credentials. Check username and password.');
        if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
      }
    };
  }

  function _checkLock() {
    const err = H.el('login-err');
    const btn = H.el('li-btn');
    if (Auth.isLocked()) {
      const left = Auth.lockRemaining();
      if (err) { err.textContent = `Too many failed attempts. Wait ${left}.`; err.classList.remove('hidden'); }
      if (btn) btn.disabled = true;
      setTimeout(_checkLock, 1000);
    } else {
      if (err) err.classList.add('hidden');
      if (btn) btn.disabled = false;
    }
  }

  /* ── LAUNCH ───────────────────────────────────────────────── */
  async function _launch() {
    H.el('setup-screen').classList.add('hidden');
    H.el('login-screen').classList.add('hidden');
    H.el('app').classList.remove('hidden');

    const user = Auth.currentUser() || 'Admin';
    const av   = H.el('user-av');   if (av) av.textContent = user[0].toUpperCase();
    const nm   = H.el('user-name'); if (nm) nm.textContent = user;

    _applyTheme();
    _bindNav();
    _bindTopbar();
    _bindSearch();
    _bindKeyboard();
    _bindNotif();
    _bindIdle();

    await navigate('dashboard');

    // Bind mobile bottom nav
    document.querySelectorAll('.mnav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        navigate(page);
        document.querySelectorAll('.mnav-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
    });
    await _refreshBadge();
    setInterval(_refreshBadge, 60000);
    Backup.checkAutoBackup();
  }

  /* ── NAVIGATION ───────────────────────────────────────────── */
  async function navigate(page, params = {}) {
    if (!ROUTES[page]) page = 'dashboard';
    _page = page;
    setBreadcrumb([PAGE_LABELS[page] || 'Dashboard']);

    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const pc = H.el('page-content');
    if (pc) { pc.style.opacity = '0'; pc.style.transition = 'opacity .1s ease'; }

    try { await ROUTES[page](params); }
    catch (e) {
      if (pc) pc.innerHTML = `<div class="empty">
        <div class="empty-ttl">Page failed to load</div>
        <div class="empty-sub">${H.esc(e.message)}</div>
      </div>`;
      console.error('[FCMS] Navigate error:', e);
    }

    if (pc) { setTimeout(() => pc.style.opacity = '1', 10); }
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Sync mobile nav active state
    document.querySelectorAll('.mnav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }

  /* ── NAV BINDING ──────────────────────────────────────────── */
  function _bindNav() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.page));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(el.dataset.page); });
    });
  }

  /* ── TOPBAR BINDING ───────────────────────────────────────── */
  function _bindTopbar() {
    // Theme
    const themeBtn = H.el('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Shortcut help
    const scBtn = H.el('sc-btn');
    if (scBtn) scBtn.addEventListener('click', openShortcuts);

    // User chip
    const chip = H.el('user-chip');
    const drop = H.el('user-drop');
    if (chip && drop) {
      chip.addEventListener('click', e => {
        e.stopPropagation();
        _userOpen = !_userOpen;
        drop.classList.toggle('hidden', !_userOpen);
        if (_notifOpen) _closeNotif();
      });
    }

    // Logout
    const logoutBtn = H.el('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      Modal.confirm({
        title: 'Sign Out', danger: false,
        message: 'Are you sure you want to sign out?',
        confirmLabel: 'Sign Out',
        onConfirm: async () => {
          await Logs.add('login', 'Signed out');
          Auth.clearIdle(); Auth.logout();
          H.el('app').classList.add('hidden');
          _showLogin();
          Notify.inf('You have been signed out.');
        }
      });
    });

    // Change password
    const cpBtn = H.el('chg-pass-btn');
    if (cpBtn) cpBtn.addEventListener('click', _showChangePass);

    // Close dropdowns on outside click
    document.addEventListener('click', e => {
      if (!H.el('user-chip')?.contains(e.target)) {
        drop?.classList.add('hidden');
        _userOpen = false;
      }
    });
  }

  function _showChangePass() {
    H.el('user-drop')?.classList.add('hidden');
    Modal.open({
      title: 'Change Password', size: 'sm',
      body: `
        <div class="field"><label>Current Password</label>
          <div class="input-wrap">
            <input type="password" id="cp-old" placeholder="Current password"/>
            <span class="input-action" onclick="App.togglePass('cp-old',this)">Show</span>
          </div></div>
        <div class="field"><label>New Password</label>
          <div class="input-wrap">
            <input type="password" id="cp-new" placeholder="Min. 6 characters"/>
            <span class="input-action" onclick="App.togglePass('cp-new',this)">Show</span>
          </div></div>
        <div class="field"><label>Confirm New Password</label>
          <input type="password" id="cp-conf" placeholder="Repeat new password"/></div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-primary" onclick="App.doChangePass()">Update Password</button>`
    });
  }

  async function doChangePass() {
    const oldP = H.el('cp-old')?.value || '';
    const newP = H.el('cp-new')?.value || '';
    const conf = H.el('cp-conf')?.value || '';
    if (!oldP) return Notify.err('Enter current password.');
    if (newP.length < 6) return Notify.err('New password must be at least 6 characters.');
    if (newP !== conf)   return Notify.err('Passwords do not match.');
    try {
      await Auth.changePassword(oldP, newP);
      Modal.close();
      Notify.ok('Password updated successfully.');
      await Logs.add('update', 'Password changed');
    } catch(e) { Notify.err(e.message); }
  }

  /* ── GLOBAL SEARCH ────────────────────────────────────────── */
  function _bindSearch() {
    const inp  = H.el('g-search');
    const drop = H.el('search-drop');
    if (!inp || !drop) return;

    let kbFocus = -1;

    inp.addEventListener('input', H.debounce(async () => {
      const q = inp.value.trim();
      if (q.length < 2) { drop.classList.add('hidden'); return; }
      const results = await _globalSearch(q);
      _renderSearchDrop(results, q, drop);
      kbFocus = -1;
    }, 220));

    inp.addEventListener('focus', () => {
      if (inp.value.trim().length >= 2) drop.classList.remove('hidden');
    });

    inp.addEventListener('keydown', e => {
      const items = drop.querySelectorAll('.s-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        kbFocus = Math.min(kbFocus + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle('kb-focus', i === kbFocus));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        kbFocus = Math.max(kbFocus - 1, -1);
        items.forEach((it, i) => it.classList.toggle('kb-focus', i === kbFocus));
      } else if (e.key === 'Enter' && kbFocus >= 0) {
        e.preventDefault(); items[kbFocus]?.click();
      } else if (e.key === 'Escape') {
        drop.classList.add('hidden'); inp.blur();
      }
    });

    document.addEventListener('click', e => {
      if (!inp.contains(e.target) && !drop.contains(e.target)) drop.classList.add('hidden');
    });
  }

  async function _globalSearch(q) {
    const [clients, commissions, payments, receipts, expenses] = await Promise.all([
      DB.getAll('clients'), DB.getAll('commissions'), DB.getAll('payments'),
      DB.getAll('receipts'), DB.getAll('expenses'),
    ]);
    const ql = q.toLowerCase();
    const res = [];

    clients.filter(c =>
      (c.name||'').toLowerCase().includes(ql) ||
      (c.email||'').toLowerCase().includes(ql) ||
      (c.phone||'').toLowerCase().includes(ql)
    ).slice(0,3).forEach(c => res.push({ type:'Client', label:c.name, sub:c.email||c.phone||'-', page:'clients' }));

    commissions.filter(c =>
      (c.title||'').toLowerCase().includes(ql) ||
      (c.serviceType||'').toLowerCase().includes(ql)
    ).slice(0,3).forEach(c => res.push({ type:'Commission', label:c.title, sub:`${H.peso(c.price)} · ${c.status}`, page:'commissions' }));

    payments.filter(p =>
      (p.referenceNumber||'').toLowerCase().includes(ql) ||
      (p.method||'').toLowerCase().includes(ql)
    ).slice(0,2).forEach(p => res.push({ type:'Payment', label:`${H.peso(p.amount)} via ${p.method||'-'}`, sub:H.fmtDate(p.date), page:'payments' }));

    receipts.filter(r =>
      (r.receiptNumber||'').toLowerCase().includes(ql) ||
      (r.clientName||'').toLowerCase().includes(ql) ||
      (r.verificationCode||'').toLowerCase().includes(ql)
    ).slice(0,2).forEach(r => res.push({ type:'Receipt', label:r.receiptNumber, sub:`${r.clientName} · ${H.peso(r.amountPaid)}`, page:'receipts' }));

    expenses.filter(e =>
      (e.description||'').toLowerCase().includes(ql) ||
      (e.category||'').toLowerCase().includes(ql)
    ).slice(0,2).forEach(e => res.push({ type:'Expense', label:e.description||e.category, sub:`${H.peso(e.amount)} · ${H.fmtDate(e.date)}`, page:'expenses' }));

    return res.slice(0, 10);
  }

  function _renderSearchDrop(results, q, drop) {
    if (!results.length) {
      drop.innerHTML = `<div class="s-empty">No results for "<strong>${H.esc(q)}</strong>"</div>`;
      drop.classList.remove('hidden'); return;
    }
    drop.innerHTML = results.map((r, i) => `
      <div class="s-item" data-idx="${i}" role="option" tabindex="-1">
        <span class="s-tag">${H.esc(r.type)}</span>
        <div style="flex:1;min-width:0">
          <div class="s-lbl">${H.hl(r.label, q)}</div>
          <div class="s-sub">${H.esc(r.sub)}</div>
        </div>
      </div>`).join('');
    drop.classList.remove('hidden');
    drop.querySelectorAll('.s-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        navigate(results[i].page);
        H.el('g-search').value = '';
        drop.classList.add('hidden');
      });
    });
  }

  /* ── KEYBOARD SHORTCUTS ───────────────────────────────────── */
  function _bindKeyboard() {
    document.addEventListener('keydown', e => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const inInput = ['input', 'textarea', 'select'].includes(tag);
      const key = e.key;

      // Esc - always
      if (key === 'Escape') {
        const sc = H.el('sc-overlay');
        const mb = H.el('modal-bg');
        const sd = H.el('search-drop');
        if (sc && !sc.classList.contains('hidden')) { closeShortcuts(); return; }
        if (mb && !mb.classList.contains('hidden')) { Modal.close(); return; }
        if (sd && !sd.classList.contains('hidden')) { sd.classList.add('hidden'); return; }
        const gi = H.el('g-search');
        if (gi && document.activeElement === gi) { gi.blur(); return; }
        return;
      }

      if (inInput) return;

      if (key === '?') { e.preventDefault(); openShortcuts(); return; }
      if (key === '/') { e.preventDefault(); H.el('g-search')?.focus(); return; }
      if (key === '[') { e.preventDefault(); toggleSidebar(); return; }
      if (key === 'T' && e.shiftKey) { e.preventDefault(); toggleTheme(); return; }
      if (key === 'r' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); navigate(_page); return; }

      // Two-key sequences
      clearTimeout(_kbTimer);
      _kbBuf += key.toLowerCase();
      _kbTimer = setTimeout(() => { _kbBuf = ''; }, 900);

      if (_kbBuf.length >= 2) {
        const seq = _kbBuf.slice(-2);
        const navMap = {
          'gd':'dashboard', 'ga':'analytics', 'gc':'clients',
          'gw':'commissions', 'gp':'payments', 'gr':'receipts',
          'ge':'expenses', 'gi':'invoices', 'gs':'settings',
          'gl':'logs', 'gb':'backup', 'gt':'templates',
          'gg':'goals', 'gq':'quotes',
        };
        if (navMap[seq]) { e.preventDefault(); _kbBuf = ''; navigate(navMap[seq]); return; }

        const actMap = {
          'nw': () => { navigate('commissions').then(() => Commissions.openForm()); },
          'nc': () => { navigate('clients').then(() => Clients.openForm()); },
          'np': () => { navigate('payments').then(() => Payments.openForm()); },
          'ne': () => { navigate('expenses').then(() => Expenses.openForm()); },
          'ni': () => { navigate('invoices').then(() => Invoices.openForm()); },
          'nq': () => { navigate('quotes').then(() => Quotes.openForm()); },
        };
        if (actMap[seq]) { e.preventDefault(); _kbBuf = ''; actMap[seq](); return; }
      }
    });
  }

  /* ── NOTIFICATIONS ────────────────────────────────────────── */
  function _bindNotif() {
    const btn   = H.el('notif-btn');
    const panel = H.el('notif-panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', async e => {
      e.stopPropagation();
      _notifOpen = !_notifOpen;
      if (_notifOpen) { await _renderNotifPanel(panel); panel.classList.remove('hidden'); }
      else panel.classList.add('hidden');
      if (_userOpen) { H.el('user-drop')?.classList.add('hidden'); _userOpen = false; }
    });

    document.addEventListener('click', e => {
      if (!btn.contains(e.target) && !panel.contains(e.target)) {
        panel.classList.add('hidden'); _notifOpen = false;
      }
    });
  }

  function _closeNotif() {
    H.el('notif-panel')?.classList.add('hidden'); _notifOpen = false;
  }

  async function _renderNotifPanel(panel) {
    const [comms, clients, invoices] = await Promise.all([DB.getAll('commissions'), DB.getAll('clients'), DB.getAll('invoices')]);
    const clMap = {}; clients.forEach(c => clMap[c.id] = c);
    const notifs = [];

    comms.forEach(c => {
      if (['Delivered', 'Cancelled'].includes(c.status)) return;
      const d = H.daysUntil(c.deadline);
      if (d === null) return;
      const cl = clMap[c.clientId];
      if (d < 0)
        notifs.push({ t:'urg', text:`OVERDUE: ${H.trunc(c.title,28)}`, sub:`${Math.abs(d)}d overdue · ${H.esc(cl?.name||'?')}`, page:'commissions' });
      else if (d === 0)
        notifs.push({ t:'urg', text:`Due TODAY: ${H.trunc(c.title,28)}`, sub:H.esc(cl?.name||'?'), page:'commissions' });
      else if (d <= 2)
        notifs.push({ t:'urg', text:`Due in ${d}d: ${H.trunc(c.title,26)}`, sub:H.fmtDate(c.deadline), page:'commissions' });
      else if (d <= 7)
        notifs.push({ t:'warn', text:`Due in ${d} days: ${H.trunc(c.title,24)}`, sub:H.fmtDate(c.deadline), page:'commissions' });
    });

    // Unpaid balance alerts
    const highBal = comms.filter(c => c.remaining > 5000 && !['Delivered','Cancelled'].includes(c.status));
    if (highBal.length > 0)
      notifs.push({ t:'info', text:`${highBal.length} commission${highBal.length>1?'s':''} with pending balance`, sub:'Click to review payments', page:'payments' });

    // Overdue invoice alerts
    (invoices || []).forEach(inv => {
      if (inv.status === 'Paid' || inv.status === 'Cancelled' || !inv.dueDate) return;
      const d = H.daysUntil(inv.dueDate);
      if (d === null || d >= 0) return;
      const cl = clMap[inv.clientId];
      notifs.push({ t:'urg', text:`Invoice overdue: ${H.esc(inv.invoiceNumber||'')}`, sub:`${Math.abs(d)}d overdue · ${H.esc(cl?.name||'?')}`, page:'invoices' });
    });

    if (!notifs.length) {
      panel.innerHTML = `<div class="np-head"><span>Notifications</span></div><div class="np-empty">All caught up! No alerts.</div>`;
      return;
    }
    panel.innerHTML = `
      <div class="np-head">
        <span>Notifications</span>
        <span class="np-head-count">${notifs.length} alert${notifs.length>1?'s':''}</span>
      </div>
      ${notifs.map(n => `
      <div class="np-item" onclick="App.navigate('${n.page}')">
        <div class="np-dot ${n.t}"></div>
        <div><div class="np-msg">${H.esc(n.text)}</div><div class="np-time">${H.esc(n.sub)}</div></div>
      </div>`).join('')}`;
  }

  async function _refreshBadge() {
    try {
      const [comms, invoices] = await Promise.all([DB.getAll('commissions'), DB.getAll('invoices')]);
      let cnt = 0;
      comms.forEach(c => {
        if (['Delivered','Cancelled'].includes(c.status)) return;
        const d = H.daysUntil(c.deadline);
        if (d !== null && d <= 2) cnt++;
      });
      (invoices || []).forEach(inv => {
        if (inv.status === 'Paid' || inv.status === 'Cancelled' || !inv.dueDate) return;
        const d = H.daysUntil(inv.dueDate);
        if (d !== null && d < 0) cnt++;
      });
      const badge = H.el('notif-badge');
      const pill  = H.el('nav-pill-comm');
      if (badge) { badge.textContent = cnt > 9 ? '9+' : cnt; badge.classList.toggle('hidden', cnt === 0); }
      if (pill)  { pill.textContent  = cnt; pill.classList.toggle('on', cnt > 0); }
    } catch(e) {}
  }

  /* ── IDLE LOCK ────────────────────────────────────────────── */
  function _bindIdle() {
    ['click','keydown','mousemove','touchstart'].forEach(ev =>
      document.addEventListener(ev, () => Auth.resetIdle(), { passive: true })
    );
    Auth.resetIdle();
    window.addEventListener('fcms:idle-lock', () => {
      H.el('app').classList.add('hidden');
      Notify.wrn('Session expired due to inactivity. Please sign in again.');
      _showLogin();
    });
  }

  /* ── THEME ────────────────────────────────────────────────── */
  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.dataset.theme !== 'light';
    html.dataset.theme = isDark ? 'light' : 'dark';
    localStorage.setItem('fcms-theme', html.dataset.theme);
    _updateThemeIcon();
  }

  function _applyTheme() {
    const saved = localStorage.getItem('fcms-theme') || 'dark';
    document.documentElement.dataset.theme = saved;
    _updateThemeIcon();
  }

  function _updateThemeIcon() {
    const btn = H.el('theme-btn'); if (!btn) return;
    const dark = document.documentElement.dataset.theme !== 'light';
    btn.title = dark ? 'Switch to light mode (Shift+T)' : 'Switch to dark mode (Shift+T)';
    btn.innerHTML = dark
      ? `<svg viewBox="0 0 24 24" width="15" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="15" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>`;
  }

  /* ── SIDEBAR ──────────────────────────────────────────────── */
  function openSidebar()   { H.el('sidebar').classList.add('open'); H.el('sb-veil').classList.add('open'); }
  function closeSidebar()  { H.el('sidebar').classList.remove('open'); H.el('sb-veil').classList.remove('open'); }
  function toggleSidebar() { H.el('sidebar').classList.contains('open') ? closeSidebar() : openSidebar(); }

  /* ── SHORTCUTS OVERLAY ────────────────────────────────────── */
  function openShortcuts()  { H.el('sc-overlay')?.classList.remove('hidden'); }
  function closeShortcuts() { H.el('sc-overlay')?.classList.add('hidden'); }

  /* ── PASSWORD TOGGLE ──────────────────────────────────────── */
  function togglePass(id, btn) {
    const inp = H.el(id); if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    if (btn) btn.textContent = inp.type === 'password' ? 'Show' : 'Hide';
  }

  /* ── PWA INSTALL ──────────────────────────────────────────── */
  function _showInstallBanner() {
    if (H.el('install-banner')) return;
    const b = document.createElement('div');
    b.id = 'install-banner';
    b.innerHTML = `
      <span>Install FCMS Pro as a desktop app</span>
      <button class="btn btn-primary btn-sm" id="pwa-install">Install</button>
      <button class="btn btn-ghost btn-sm" id="pwa-dismiss">Later</button>`;
    document.body.appendChild(b);
    H.el('pwa-install')?.addEventListener('click', async () => {
      if (_pwa) { _pwa.prompt(); } b.remove();
    });
    H.el('pwa-dismiss')?.addEventListener('click', () => b.remove());
    setTimeout(() => b?.remove(), 30000);
  }

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('fcms-theme', t);
    _updateThemeIcon();
  }

  return {
    init, navigate,
    doChangePass,
    toggleTheme, togglePass,
    openSidebar, closeSidebar, toggleSidebar,
    openShortcuts, closeShortcuts,
    setTheme,
    setBreadcrumb, setBreadcrumbTail,
    refreshBadge: _refreshBadge,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
