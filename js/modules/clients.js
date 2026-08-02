'use strict';
const Clients = (() => {
  const PER = 20;
  let _all = [], _filtered = [], _page = 1, _sort = { k: 'dateAdded', d: 'desc' };
  let _sel = new Set();
  let _commsByClient = {}, _paidByClient = {}, _remainByClient = {};

  async function render() {
    const [clients, comms, pays] = await Promise.all([
      DB.getAll('clients'), DB.getAll('commissions'), DB.getAll('payments')
    ]);
    _all = clients; _sel.clear();
    _commsByClient = {}; _paidByClient = {}; _remainByClient = {};
    comms.forEach(c => {
      if (!_commsByClient[c.clientId]) _commsByClient[c.clientId] = [];
      _commsByClient[c.clientId].push(c);
      _remainByClient[c.clientId] = (_remainByClient[c.clientId] || 0) + H.num(c.remaining);
    });
    pays.forEach(p => { _paidByClient[p.clientId] = (_paidByClient[p.clientId] || 0) + H.num(p.amount); });

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div>
          <div class="pg-title">Clients</div>
          <div class="pg-sub">${_all.length} registered client${_all.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Clients.exportCSV()">↓ CSV</button>
          <button class="btn btn-primary" onclick="Clients.openForm()">+ Add Client</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="tb-s">
          <svg viewBox="0 0 24 24" width="14"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input id="cl-q" placeholder="Search by name, phone, email…"/>
        </div>
        <select id="cl-sort">
          <option value="dateAdded-desc">Newest First</option>
          <option value="dateAdded-asc">Oldest First</option>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="Clients.selAll()">☐ All</button>
      </div>
      <div id="cl-bulk" class="bulk-bar hidden">
        <span class="bulk-n" id="cl-bulk-cnt">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="Clients.delSel()">Delete Selected</button>
        <button class="btn btn-ghost btn-sm" onclick="Clients.clearSel()">✕ Cancel</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:36px"><input type="checkbox" class="cb" id="cl-all-cb"/></th>
            <th class="srt" data-c="name">Client</th>
            <th>Contact</th>
            <th class="srt" data-c="dateAdded">Added</th>
            <th>Commissions</th>
            <th>Total Paid</th>
            <th>Outstanding</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="cl-tbody"></tbody>
        </table>
      </div>
      <div id="cl-pager" class="pager"></div>`;

    H.el('cl-q').addEventListener('input', H.debounce(() => { _page = 1; applyFilter(); }, 260));
    H.el('cl-sort').addEventListener('change', () => {
      const [k, d] = H.el('cl-sort').value.split('-');
      _sort = { k, d }; _page = 1; applyFilter();
    });
    H.el('cl-all-cb').addEventListener('change', e => e.target.checked ? selAll() : clearSel());
    document.querySelectorAll('thead th.srt').forEach(th => th.addEventListener('click', () => {
      const c = th.dataset.c;
      _sort = { k: c, d: _sort.k === c && _sort.d === 'asc' ? 'desc' : 'asc' };
      _page = 1; applyFilter();
    }));
    applyFilter();
  }

  function applyFilter() {
    const q = (H.el('cl-q')?.value || '').trim().toLowerCase();
    let list = [..._all];
    if (q) list = list.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
    list = H.sortArr(list, _sort.k, _sort.d);
    _filtered = list; renderTable();
  }

  function renderTable() {
    const { items, pages } = H.paginate(_filtered, _page, PER);
    const tbody = H.el('cl-tbody'); if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        <div class="empty-ttl">No clients yet</div>
        <div class="empty-sub">Click "+ Add Client" to add your first client.</div>
        <div class="empty-cta"><button class="btn btn-primary btn-sm" onclick="Clients.openForm()">+ Add Client</button></div>
      </div></td></tr>`;
      H.el('cl-pager').innerHTML = ''; return;
    }
    tbody.innerHTML = items.map(c => {
      const numComms = (_commsByClient[c.id] || []).length;
      const paid     = _paidByClient[c.id] || 0;
      const remain   = _remainByClient[c.id] || 0;
      const initials = (c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const hasActive = (_commsByClient[c.id] || []).some(cm => ['Pending','In Progress','Revision'].includes(cm.status));
      return `<tr>
        <td><input type="checkbox" class="cb cl-cb" data-id="${c.id}" ${_sel.has(c.id) ? 'checked' : ''}/></td>
        <td>
          <div style="display:flex;align-items:center;gap:9px">
            <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--a),var(--purple));display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;color:#fff;flex-shrink:0">${H.esc(initials)}</div>
            <div>
              <div style="font-weight:700;font-size:.85rem">${H.esc(c.name)}</div>
              ${hasActive ? '<div style="font-size:.68rem;color:var(--green)">● Active work</div>' : ''}
            </div>
          </div>
        </td>
        <td style="font-size:.8rem">
          ${c.phone ? `<div class="muted">📞 ${H.esc(c.phone)}</div>` : ''}
          ${c.email ? `<div class="muted">✉ ${H.esc(c.email)}</div>` : ''}
          ${!c.phone && !c.email ? '<span class="muted"> - </span>' : ''}
        </td>
        <td class="muted" style="font-size:.79rem">${H.fmtDate(c.dateAdded)}</td>
        <td class="mono" style="font-size:.82rem">${numComms}</td>
        <td class="mono green" style="font-weight:700;font-size:.82rem">${H.peso(paid)}</td>
        <td class="mono" style="font-size:.82rem;color:${remain > 0 ? 'var(--amber)' : 'var(--t3)'}">${H.peso(remain)}</td>
        <td class="td-acts">
          <button class="btn btn-ghost btn-xs" onclick="Clients.viewProfile('${c.id}')">Profile</button>
          <button class="btn btn-ghost btn-xs" onclick="Clients.openForm('${c.id}')">Edit</button>
          <button class="btn btn-ghost btn-xs" onclick="Clients.viewComm('${c.id}','${H.esc(c.name)}')">Work</button>
          <button class="btn btn-danger btn-xs" onclick="Clients.delOne('${c.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
    document.querySelectorAll('.cl-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.checked ? _sel.add(cb.dataset.id) : _sel.delete(cb.dataset.id); updateBulk();
      });
    });
    H.renderPager('cl-pager', _page, pages, p => { _page = p; renderTable(); });
  }

  function updateBulk() {
    const bar = H.el('cl-bulk'), cnt = H.el('cl-bulk-cnt'); if (!bar) return;
    if (_sel.size > 0) { bar.classList.remove('hidden'); cnt.textContent = `${_sel.size} selected`; }
    else bar.classList.add('hidden');
  }
  function selAll()  { _sel = new Set(_filtered.map(c => c.id)); renderTable(); updateBulk(); }
  function clearSel(){ _sel.clear(); renderTable(); updateBulk(); }

  async function viewProfile(id) {
    const [c, comms, pays, invs] = await Promise.all([
      DB.getById('clients', id), DB.getAll('commissions'), DB.getAll('payments'), DB.getAll('invoices')
    ]);
    if (!c) return;
    const clientComms = comms.filter(cm => cm.clientId === id);
    const clientPays  = pays.filter(p => p.clientId === id);
    const clientInvs  = invs.filter(i => i.clientId === id);
    const totalPaid   = clientPays.reduce((s, p) => s + H.num(p.amount), 0);
    const totalOut    = clientComms.reduce((s, cm) => s + H.num(cm.remaining), 0);
    const timeline = [
      ...clientComms.map(cm => ({ date: cm.dateAdded, type: 'Commission', dot: 'blue', label: cm.title, sub: cm.status, amount: cm.price })),
      ...clientPays.map(p  => ({ date: p.date,      type: 'Payment',    dot: 'green', label: 'Payment received', sub: p.method || '', amount: p.amount })),
      ...clientInvs.map(i  => ({ date: i.issueDate || i.createdAt, type: 'Invoice', dot: 'amber', label: `Invoice ${i.invoiceNumber || ''}`, sub: i.status, amount: i.total })),
    ].filter(t => t.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);
    const initials    = (c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    Modal.open({
      title: 'Client Profile', size: 'lg',
      body: `
        <div style="display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap">
          <div style="text-align:center;flex-shrink:0">
            <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--a),var(--purple));display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:#fff;margin:0 auto 8px">${H.esc(initials)}</div>
            <div style="font-size:.72rem;color:var(--t3)">Client ID</div>
            <div style="font-size:.68rem;font-family:var(--mono);color:var(--t3)">${c.id.slice(-8)}</div>
          </div>
          <div style="flex:1;min-width:180px">
            <div style="font-size:1.1rem;font-weight:800;margin-bottom:4px">${H.esc(c.name)}</div>
            ${c.phone ? `<div style="font-size:.83rem;color:var(--t2);margin-bottom:2px">📞 ${H.esc(c.phone)}</div>` : ''}
            ${c.email ? `<div style="font-size:.83rem;color:var(--t2);margin-bottom:2px">✉ ${H.esc(c.email)}</div>` : ''}
            ${c.notes ? `<div style="font-size:.8rem;color:var(--t3);margin-top:6px;font-style:italic">${H.esc(c.notes)}</div>` : ''}
            <div style="font-size:.72rem;color:var(--t3);margin-top:6px">Client since ${H.fmtDate(c.dateAdded)}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-self:flex-start">
            <div class="card" style="padding:12px;text-align:center">
              <div class="kpi-lbl">Total Paid</div>
              <div class="kpi-val sm green">${H.peso(totalPaid)}</div>
            </div>
            <div class="card" style="padding:12px;text-align:center">
              <div class="kpi-lbl">Outstanding</div>
              <div class="kpi-val sm" style="color:${totalOut > 0 ? 'var(--amber)' : 'var(--t3)'}">${H.peso(totalOut)}</div>
            </div>
            <div class="card" style="padding:12px;text-align:center">
              <div class="kpi-lbl">Commissions</div>
              <div class="kpi-val">${clientComms.length}</div>
            </div>
            <div class="card" style="padding:12px;text-align:center">
              <div class="kpi-lbl">Payments</div>
              <div class="kpi-val">${clientPays.length}</div>
            </div>
          </div>
        </div>
        <div class="card-label">Commission History</div>
        ${clientComms.length ? `<div class="tbl-wrap" style="max-height:220px;overflow-y:auto"><table>
          <thead><tr><th>Title</th><th>Service</th><th>Price</th><th>Remaining</th><th>Status</th><th>Deadline</th></tr></thead>
          <tbody>${clientComms.map(cm => `<tr>
            <td style="font-size:.82rem"><strong>${H.esc(H.trunc(cm.title, 24))}</strong></td>
            <td style="font-size:.79rem" class="muted">${H.esc(cm.serviceType || '-')}</td>
            <td class="mono" style="font-size:.8rem">${H.peso(cm.price)}</td>
            <td class="mono" style="font-size:.8rem;color:${cm.remaining > 0 ? 'var(--amber)' : 'var(--green)'}">${H.peso(cm.remaining)}</td>
            <td>${H.chip(cm.status)}</td>
            <td style="font-size:.79rem" class="muted">${H.fmtDate(cm.deadline)}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<div class="empty"><div class="empty-ttl">No commissions yet</div></div>'}
        <div class="card-label" style="margin-top:16px">Recent Activity</div>
        ${timeline.length ? `<div style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:2px">
          ${timeline.map(t => `<div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid var(--border)">
            <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--${t.dot === 'blue' ? 'a' : t.dot === 'green' ? 'green' : 'amber'})"></span>
            <div style="flex:1;min-width:0">
              <div style="font-size:.81rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${H.esc(t.type)}: ${H.esc(H.trunc(t.label, 32))}</div>
              <div style="font-size:.71rem;color:var(--t3)">${H.fmtDate(t.date)}${t.sub ? ' · ' + H.esc(t.sub) : ''}</div>
            </div>
            <div class="mono" style="font-size:.8rem;flex-shrink:0">${H.peso(t.amount)}</div>
          </div>`).join('')}
        </div>` : '<div class="empty"><div class="empty-ttl">No activity yet</div></div>'}`,
      foot: `
        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        <button class="btn btn-ghost" onclick="Clients.openForm('${id}');Modal.close()">Edit Client</button>
        <button class="btn btn-primary" onclick="Clients.viewComm('${id}','${H.esc(c.name)}');Modal.close()">View All Work</button>`
    });
  }

  async function openForm(id = null) {
    const c = id ? await DB.getById('clients', id) : null;
    Modal.open({
      title: c ? 'Edit Client' : 'Add Client', size: 'sm',
      body: `
        <div class="field"><label>Full Name <span class="req">*</span></label>
          <input id="cf-name" value="${H.esc(c?.name || '')}" placeholder="Client full name" autocomplete="off"/></div>
        <div class="form-2">
          <div class="field"><label>Phone Number</label>
            <input id="cf-phone" value="${H.esc(c?.phone || '')}" placeholder="+63 9XX XXX XXXX"/></div>
          <div class="field"><label>Email Address</label>
            <input type="email" id="cf-email" value="${H.esc(c?.email || '')}" placeholder="email@domain.com"/></div>
        </div>
        <div class="field"><label>Social / Platform Handle</label>
          <input id="cf-social" value="${H.esc(c?.social || '')}" placeholder="@username or platform link"/></div>
        <div class="field"><label>Notes</label>
          <textarea id="cf-notes" placeholder="Internal notes about this client…" style="min-height:72px">${H.esc(c?.notes || '')}</textarea></div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-primary" onclick="Clients.saveForm('${id || ''}')">${c ? 'Save Changes' : 'Add Client'}</button>`
    });
  }

  async function saveForm(id) {
    const name  = (H.el('cf-name')?.value  || '').trim();
    const phone = (H.el('cf-phone')?.value || '').trim();
    const email = (H.el('cf-email')?.value || '').trim();
    if (!name) { Notify.err('Name is required.'); return; }
    if (email && !H.validEmail(email)) { Notify.err('Invalid email address.'); return; }
    const isNew    = !id;
    const existing = id ? await DB.getById('clients', id) : null;
    const rec = {
      id: id || H.uid('cli'), name, phone, email,
      social: (H.el('cf-social')?.value || '').trim(),
      notes:  (H.el('cf-notes')?.value  || '').trim(),
      dateAdded: existing?.dateAdded || H.now(),
      updatedAt: H.now()
    };
    await DB.put('clients', rec);
    await Logs.add(isNew ? 'create' : 'update', `${isNew ? 'Added' : 'Updated'} client: ${name}`);
    Modal.close();
    Notify.ok(`Client "${name}" ${isNew ? 'added' : 'updated'}.`);
    await render();
  }

  async function delOne(id) {
    const c = await DB.getById('clients', id); if (!c) return;
    const numComms = (_commsByClient[id] || []).length;
    Modal.confirm({
      title: 'Delete Client', danger: true,
      message: `Delete "${c.name}"?${numComms > 0 ? ` They have ${numComms} commission(s) which will remain but show no client.` : ''}`,
      confirmLabel: 'Delete Client',
      onConfirm: async () => {
        await DB.remove('clients', id);
        await Logs.add('delete', `Deleted client: ${c.name}`);
        Notify.ok(`"${c.name}" deleted.`);
        await render();
      }
    });
  }

  async function delSel() {
    if (!_sel.size) return;
    Modal.confirm({
      title: 'Delete Selected Clients', danger: true,
      message: `Delete ${_sel.size} client(s)? Their commissions will remain.`,
      confirmLabel: 'Delete Selected',
      onConfirm: async () => {
        await DB.bulkRemove('clients', [..._sel]);
        await Logs.add('delete', `Deleted ${_sel.size} clients (bulk)`);
        Notify.ok(`${_sel.size} client(s) deleted.`);
        _sel.clear(); await render();
      }
    });
  }

  function viewComm(clientId, clientName) {
    App.navigate('commissions', { filterClientId: clientId, filterClientName: clientName });
  }

  async function exportCSV() {
    const h = ['ID', 'Name', 'Phone', 'Email', 'Social', 'Notes', 'Date Added',
               'Total Commissions', 'Total Paid', 'Outstanding Balance'];
    const rows = _filtered.map(c => [
      c.id, c.name, c.phone || '', c.email || '', c.social || '', c.notes || '',
      H.fmtDate(c.dateAdded),
      (_commsByClient[c.id] || []).length,
      _paidByClient[c.id] || 0,
      _remainByClient[c.id] || 0
    ]);
    H.dlFile(H.toCSV(rows, h), `FCMS-Clients-${Date.now()}.csv`, 'text/csv');
    Notify.ok('Clients exported to CSV.');
  }

  return { render, openForm, saveForm, viewProfile, delOne, delSel, selAll, clearSel, viewComm, exportCSV };
})();
