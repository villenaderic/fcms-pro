'use strict';
const Settings = (() => {
  const KEY    = 'fcms_settings';
  const getAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const saveAll= d  => localStorage.setItem(KEY, JSON.stringify(d));
  const get    = (k, fb='') => { const v = getAll()[k]; return (v !== undefined && v !== null) ? v : fb; };
  const set    = (k, v) => { const s = getAll(); s[k] = v; saveAll(s); };

  let _activeTab = 'business';

  async function render() {
    const s     = getAll();
    const admin = await Auth.getAdminInfo();
    const svcs  = get('serviceTypes', ['Logo Design','UI/UX Design','Web Development','Illustration','Animation','Video Editing','Copywriting','Social Media','Branding','Print Design','Other']);

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div><div class="pg-title">Settings</div><div class="pg-sub">Configure your business, account, and preferences</div></div>
        <div class="pg-acts"><button class="btn btn-primary" onclick="Settings.saveActive()">Save Changes</button></div>
      </div>
      <div class="settings-grid">
        <div class="settings-nav" id="settings-nav">
          ${[
            ['business',   '🏢', 'Business Info'],
            ['account',    '👤', 'Account'],
            ['appearance', '🎨', 'Appearance'],
            ['services',   '🔧', 'Services'],
            ['documents',  '📄', 'Documents'],
            ['danger',     '⚠',  'Danger Zone'],
          ].map(([id, ico, lbl]) => `
            <div class="settings-nav-item ${_activeTab===id?'active':''}" onclick="Settings.switchTab('${id}')">
              ${ico} ${lbl}
            </div>`).join('')}
        </div>
        <div id="settings-panels">
          <!-- Business Info -->
          <div class="settings-panel ${_activeTab==='business'?'active':''}" id="sp-business">
            <div class="card">
              <div class="card-label">Business Information</div>
              <div class="form-2">
                <div class="field"><label>Business Name</label><input id="s-biz" value="${H.esc(s.businessName||'')}" placeholder="Your business name"/></div>
                <div class="field"><label>Freelancer / Your Name</label><input id="s-name" value="${H.esc(s.freelancerName||'')}" placeholder="Full name"/></div>
              </div>
              <div class="field"><label>Business Address</label><input id="s-addr" value="${H.esc(s.address||'')}" placeholder="Full address"/></div>
              <div class="form-2">
                <div class="field"><label>Contact Number</label><input id="s-phone" value="${H.esc(s.contactNumber||'')}" placeholder="+63 9XX XXX XXXX"/></div>
                <div class="field"><label>Email</label><input type="email" id="s-email" value="${H.esc(s.email||'')}" placeholder="email@domain.com"/></div>
              </div>
              <div class="form-2">
                <div class="field"><label>Website / Portfolio</label><input id="s-website" value="${H.esc(s.website||'')}" placeholder="https://yoursite.com"/></div>
                <div class="field"><label>Tax ID / BIR TIN</label><input id="s-tin" value="${H.esc(s.tin||'')}" placeholder="000-000-000"/></div>
              </div>
              <div class="form-2">
                <div class="field"><label>Currency Symbol</label><input id="s-currency" value="${H.esc(s.currencySymbol||'₱')}" placeholder="₱" maxlength="3"/></div>
                <div class="field"><label>Default Payment Methods</label><input id="s-methods" value="${H.esc((s.paymentMethods||[]).join(', '))}" placeholder="GCash, Bank Transfer, PayMaya"/></div>
              </div>
            </div>
          </div>

          <!-- Account -->
          <div class="settings-panel ${_activeTab==='account'?'active':''}" id="sp-account">
            <div class="card" style="margin-bottom:14px">
              <div class="card-label">Admin Account</div>
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
                <div class="user-av" style="width:48px;height:48px;font-size:1.2rem;flex-shrink:0">${(admin?.username||'A').charAt(0).toUpperCase()}</div>
                <div>
                  <div style="font-size:.95rem;font-weight:800">${H.esc(admin?.username||'admin')}</div>
                  <div class="muted" style="font-size:.79rem">Administrator · Full access</div>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-label">Change Password</div>
              <div class="field"><label>Current Password</label>
                <div class="input-wrap"><input type="password" id="s-old" placeholder="Current password"/>
                  <span class="input-action" onclick="App.togglePass('s-old',this)">Show</span></div></div>
              <div class="field"><label>New Password</label>
                <div class="input-wrap"><input type="password" id="s-new" placeholder="Min. 6 characters" oninput="Settings.pwdBar(this.value)"/>
                  <span class="input-action" onclick="App.togglePass('s-new',this)">Show</span></div>
                <div class="str-bar" id="s-bar"></div><div class="str-lbl" id="s-lbl"></div></div>
              <div class="field"><label>Confirm New Password</label>
                <div class="input-wrap"><input type="password" id="s-conf" placeholder="Repeat new password"/>
                  <span class="input-action" onclick="App.togglePass('s-conf',this)">Show</span></div></div>
              <button class="btn btn-primary btn-sm" onclick="Settings.changePassword()">Update Password</button>
            </div>
          </div>

          <!-- Appearance -->
          <div class="settings-panel ${_activeTab==='appearance'?'active':''}" id="sp-appearance">
            <div class="card">
              <div class="card-label">Theme</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
                <div onclick="App.setTheme('dark')" style="width:120px;height:72px;border-radius:8px;border:2px solid ${document.documentElement.dataset.theme==='light'?'var(--border)':'var(--a)'};background:#080a0f;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.82rem;color:#eef2ff;font-weight:700">Dark</div>
                <div onclick="App.setTheme('light')" style="width:120px;height:72px;border-radius:8px;border:2px solid ${document.documentElement.dataset.theme==='light'?'var(--a)':'var(--border)'};background:#f1f4fb;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.82rem;color:#111827;font-weight:700">Light</div>
              </div>
              <div class="note-block">Theme preference is saved automatically per browser.</div>
            </div>
          </div>

          <!-- Services -->
          <div class="settings-panel ${_activeTab==='services'?'active':''}" id="sp-services">
            <div class="card">
              <div class="card-label">Service Types</div>
              <div class="note-block" style="margin-bottom:14px">These appear as options when creating commissions, quotes, and templates.</div>
              <div class="tag-cloud" id="s-svc-list">
                ${svcs.map(sv => `<span class="tag">${H.esc(sv)}<span class="tag-x" onclick="Settings.delService('${H.esc(sv)}')">✕</span></span>`).join('')}
              </div>
              <div style="display:flex;gap:7px;margin-top:12px">
                <input id="s-new-svc" placeholder="New service type…" style="flex:1;padding:7px 10px;background:var(--elev);border:1px solid var(--border);border-radius:var(--r2);font-size:.83rem;color:var(--t1);outline:none"/>
                <button class="btn btn-primary btn-sm" onclick="Settings.addService()">Add</button>
              </div>
            </div>
          </div>

          <!-- Documents -->
          <div class="settings-panel ${_activeTab==='documents'?'active':''}" id="sp-documents">
            <div class="card" style="margin-bottom:14px">
              <div class="card-label">Receipt Settings</div>
              <div class="field"><label>Receipt Footer Message</label>
                <input id="s-footer" value="${H.esc(s.receiptFooter||'Thank you for your business. We appreciate your trust.')}" placeholder="Footer message on receipts"/></div>
            </div>
            <div class="card" style="margin-bottom:14px">
              <div class="card-label">Invoice Settings</div>
              <div class="field"><label>Default Invoice Terms</label>
                <textarea id="s-inv-terms" style="min-height:64px" placeholder="Due within 30 days of issue.">${H.esc(s.invoiceTerms||'Payment is due within 30 days of the invoice date.')}</textarea></div>
              <div class="field"><label>Default Invoice Notes</label>
                <textarea id="s-inv-notes" style="min-height:56px" placeholder="Bank transfer details">${H.esc(s.invoiceNotes||'')}</textarea></div>
            </div>
            <div class="card">
              <div class="card-label">Quote / Proposal Settings</div>
              <div class="field"><label>Default Quote Terms</label>
                <textarea id="s-quo-terms" style="min-height:64px" placeholder="50% down payment required before work begins.">${H.esc(s.quoteTerms||'50% down payment required before work begins. Remaining balance due upon delivery.')}</textarea></div>
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="settings-panel ${_activeTab==='danger'?'active':''}" id="sp-danger">
            <div class="card" style="border-color:rgba(248,113,113,.3)">
              <div class="card-label" style="color:var(--red)">Danger Zone</div>
              <div style="display:flex;flex-direction:column;gap:14px">
                <div style="padding:14px;background:var(--red-d);border:1px solid rgba(248,113,113,.2);border-radius:var(--r2)">
                  <div style="font-weight:700;font-size:.88rem;margin-bottom:4px">Clear All Data</div>
                  <div class="muted" style="font-size:.8rem;margin-bottom:10px">Deletes all clients, commissions, payments, and more. Settings are preserved.</div>
                  <button class="btn btn-danger btn-sm" onclick="Settings.clearData()">Clear All Data</button>
                </div>
                <div style="padding:14px;background:var(--red-d);border:1px solid rgba(248,113,113,.2);border-radius:var(--r2)">
                  <div style="font-weight:700;font-size:.88rem;margin-bottom:4px">Full System Reset</div>
                  <div class="muted" style="font-size:.8rem;margin-bottom:10px">Wipes everything including your account, settings, and all data. Cannot be undone.</div>
                  <button class="btn btn-danger btn-sm" onclick="Settings.fullReset()">Full Reset</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.settings-nav-item').forEach(el => {
      el.classList.toggle('active', el.textContent.toLowerCase().includes(tab) || el.onclick?.toString().includes(tab));
    });
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    const panel = H.el(`sp-${tab}`);
    if (panel) panel.classList.add('active');
    document.querySelectorAll('.settings-nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('onclick')?.includes(`'${tab}'`));
    });
  }

  function saveActive() {
    const s = getAll();
    // Business tab
    if (H.el('s-biz'))       s.businessName   = H.el('s-biz').value.trim();
    if (H.el('s-name'))      s.freelancerName  = H.el('s-name').value.trim();
    if (H.el('s-addr'))      s.address         = H.el('s-addr').value.trim();
    if (H.el('s-phone'))     s.contactNumber   = H.el('s-phone').value.trim();
    if (H.el('s-email'))     s.email           = H.el('s-email').value.trim();
    if (H.el('s-website'))   s.website         = H.el('s-website').value.trim();
    if (H.el('s-tin'))       s.tin             = H.el('s-tin').value.trim();
    if (H.el('s-currency'))  s.currencySymbol  = H.el('s-currency').value.trim() || '₱';
    if (H.el('s-methods'))   s.paymentMethods  = H.el('s-methods').value.split(',').map(x => x.trim()).filter(Boolean);
    // Documents tab
    if (H.el('s-footer'))    s.receiptFooter   = H.el('s-footer').value.trim();
    if (H.el('s-inv-terms')) s.invoiceTerms    = H.el('s-inv-terms').value.trim();
    if (H.el('s-inv-notes')) s.invoiceNotes    = H.el('s-inv-notes').value.trim();
    if (H.el('s-quo-terms')) s.quoteTerms      = H.el('s-quo-terms').value.trim();
    saveAll(s);
    Notify.ok('Settings saved.');
    Logs.add('update', 'Settings updated');
  }

  // Legacy alias
  function save() { saveActive(); }

  function pwdBar(v) {
    const str = H.pwdStrength(v);
    const bar = H.el('s-bar'), lbl = H.el('s-lbl');
    if (bar) bar.className = 'str-bar' + (v ? ' ' + str : '');
    if (lbl) lbl.textContent = v ? ({w:'Weak',m:'Medium',s:'Strong'}[str]) : '';
  }

  async function changePassword() {
    const oldP = H.el('s-old')?.value || '';
    const newP = H.el('s-new')?.value || '';
    const conf = H.el('s-conf')?.value || '';
    if (!oldP) { Notify.err('Enter your current password.'); return; }
    if (newP.length < 6) { Notify.err('New password must be at least 6 characters.'); return; }
    if (newP !== conf)   { Notify.err('Passwords do not match.'); return; }
    try {
      await Auth.changePassword(oldP, newP);
      ['s-old','s-new','s-conf'].forEach(id => { const el = H.el(id); if (el) el.value = ''; });
      pwdBar('');
      Notify.ok('Password updated.');
      await Logs.add('update', 'Password changed via Settings');
    } catch(e) { Notify.err(e.message); }
  }

  function addService() {
    const inp = H.el('s-new-svc'); if (!inp) return;
    const name = inp.value.trim();
    if (!name) return;
    const svcs = get('serviceTypes', []);
    if (svcs.includes(name)) { Notify.wrn('Service already exists.'); return; }
    svcs.push(name); set('serviceTypes', svcs);
    inp.value = '';
    Notify.ok(`"${name}" added.`);
    render();
  }

  function delService(name) {
    const svcs = get('serviceTypes', []).filter(s => s !== name);
    set('serviceTypes', svcs);
    render();
  }

  function clearData() {
    Modal.confirm({
      title: 'Clear All Data', danger: true,
      message: 'This will permanently delete all clients, commissions, payments, receipts, expenses, invoices, quotes, and logs. Your account and settings are kept.',
      confirmLabel: 'Clear All Data',
      onConfirm: async () => {
        const stores = ['clients','commissions','payments','receipts','expenses','invoices','quotes','templates','goals','logs'];
        await Promise.all(stores.map(s => DB.clear(s)));
        await DB.resetCounters();
        Notify.ok('All data cleared.');
        await Logs.add('delete','All business data cleared');
        App.navigate('dashboard');
      }
    });
  }

  function fullReset() {
    Modal.confirm({
      title: 'Full System Reset', danger: true,
      message: 'This will delete EVERYTHING - your account, all data, and all settings. The system will return to initial setup. This cannot be undone.',
      confirmLabel: 'Full Reset - I Understand',
      onConfirm: async () => {
        const stores = ['clients','commissions','payments','receipts','expenses','invoices','quotes','templates','goals','logs','auth'];
        await Promise.all(stores.map(s => DB.clear(s)));
        await DB.resetCounters();
        localStorage.clear();
        location.reload();
      }
    });
  }

  return { getAll, saveAll, get, set, render, switchTab, saveActive, save, pwdBar, changePassword, addService, delService, clearData, fullReset };
})();
