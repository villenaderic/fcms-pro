'use strict';
const Invoices = (() => {
  const PER = 15;
  let _all = [], _filtered = [], _page = 1;
  let _sel = new Set();
  let _commMap = {}, _clMap = {};

  async function nextNumber() {
    const n = await DB.nextCounter('invoice_seq');
    return 'INV-' + String(n).padStart(5, '0');
  }

  async function render() {
    const [invoices, comms, clients] = await Promise.all([
      DB.getAll('invoices'), DB.getAll('commissions'), DB.getAll('clients')
    ]);
    _all = invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    _sel.clear();
    _commMap = {}; comms.forEach(c => _commMap[c.id] = c);
    _clMap   = {}; clients.forEach(c => _clMap[c.id] = c);

    const totalBilled = invoices.reduce((s, i) => s + H.num(i.total), 0);
    const totalPaid   = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + H.num(i.total), 0);
    const totalDue    = invoices.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled').reduce((s, i) => s + H.num(i.total), 0);

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div>
          <div class="pg-title">Invoices</div>
          <div class="pg-sub">${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Invoices.exportCSV()">↓ CSV</button>
          <button class="btn btn-primary" onclick="Invoices.openForm()">+ New Invoice</button>
        </div>
      </div>
      <div class="kpi-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
        <div class="kpi" style="--kpi-c:var(--a);--kpi-bg:var(--a-d)">
          <div class="kpi-lbl">Total Billed</div>
          <div class="kpi-val sm">${H.peso(totalBilled)}</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--green);--kpi-bg:var(--green-d)">
          <div class="kpi-lbl">Paid</div>
          <div class="kpi-val sm green">${H.peso(totalPaid)}</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--amber);--kpi-bg:var(--amber-d)">
          <div class="kpi-lbl">Outstanding</div>
          <div class="kpi-val sm" style="color:var(--amber)">${H.peso(totalDue)}</div>
        </div>
      </div>
      <div class="toolbar">
        <div class="tb-s">
          <svg viewBox="0 0 24 24" width="14"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input id="inv-q" placeholder="Search invoice #, client…"/>
        </div>
        <select id="inv-status">
          <option value="">All Statuses</option>
          <option>Draft</option><option>Sent</option><option>Paid</option><option>Overdue</option><option>Cancelled</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="Invoices.selAll()">☐ All</button>
      </div>
      <div id="inv-bulk" class="bulk-bar hidden">
        <span class="bulk-n" id="inv-bulk-cnt">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="Invoices.delSel()">Delete Selected</button>
        <button class="btn btn-ghost btn-sm" onclick="Invoices.clearSel()">✕ Cancel</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:36px"><input type="checkbox" class="cb" id="inv-all-cb"/></th>
            <th>Invoice #</th>
            <th>Client</th>
            <th>Commission</th>
            <th>Amount</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="inv-tbody"></tbody>
        </table>
      </div>
      <div id="inv-pager" class="pager"></div>`;

    H.el('inv-q').addEventListener('input', H.debounce(() => { _page = 1; applyFilter(); }, 260));
    H.el('inv-status').addEventListener('change', () => { _page = 1; applyFilter(); });
    H.el('inv-all-cb').addEventListener('change', e => e.target.checked ? selAll() : clearSel());
    applyFilter();
  }

  function applyFilter() {
    const q  = (H.el('inv-q')?.value || '').trim().toLowerCase();
    const st = H.el('inv-status')?.value || '';
    let list = [..._all];
    if (st) list = list.filter(i => i.status === st);
    if (q)  list = list.filter(i =>
      (i.invoiceNumber || '').toLowerCase().includes(q) ||
      (_clMap[i.clientId]?.name || '').toLowerCase().includes(q) ||
      (_commMap[i.commissionId]?.title || '').toLowerCase().includes(q)
    );
    _filtered = list; renderTable();
  }

  function renderTable() {
    const { items, pages } = H.paginate(_filtered, _page, PER);
    const tbody = H.el('inv-tbody'); if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
        <div class="empty-ttl">No invoices yet</div>
        <div class="empty-sub">Create an invoice to bill a client for completed work.</div>
        <div class="empty-cta"><button class="btn btn-primary btn-sm" onclick="Invoices.openForm()">+ New Invoice</button></div>
      </div></td></tr>`;
      H.el('inv-pager').innerHTML = ''; return;
    }
    tbody.innerHTML = items.map(inv => {
      const cl   = _clMap[inv.clientId];
      const co   = _commMap[inv.commissionId];
      const over = inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.dueDate && new Date(inv.dueDate) < new Date();
      const effStatus = over ? 'Overdue' : inv.status;
      return `<tr>
        <td><input type="checkbox" class="cb inv-cb" data-id="${inv.id}" ${_sel.has(inv.id) ? 'checked' : ''}/></td>
        <td class="mono blue" style="font-weight:700;font-size:.82rem">${H.esc(inv.invoiceNumber)}</td>
        <td style="font-size:.83rem"><strong>${H.esc(cl?.name || '-')}</strong></td>
        <td class="semi" style="font-size:.8rem">${H.esc(H.trunc(co?.title || inv.description || '-', 26))}</td>
        <td class="mono green" style="font-weight:700">${H.peso(inv.total)}</td>
        <td style="font-size:.79rem;${over ? 'color:var(--red);font-weight:700' : ''} class="muted">${H.fmtDate(inv.dueDate)}</td>
        <td>${H.chip(effStatus)}</td>
        <td class="td-acts">
          <button class="btn btn-ghost btn-xs" onclick="Invoices.viewDetail('${inv.id}')">View</button>
          <button class="btn btn-ghost btn-xs" onclick="Invoices.openForm('${inv.id}')">Edit</button>
          ${inv.status !== 'Paid' ? `<button class="btn btn-success btn-xs" onclick="Invoices.markPaid('${inv.id}')">Mark Paid</button>` : ''}
          <button class="btn btn-teal btn-xs" onclick="Invoices.printInvoice('${inv.id}')">Print</button>
          <button class="btn btn-danger btn-xs" onclick="Invoices.delOne('${inv.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
    document.querySelectorAll('.inv-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.checked ? _sel.add(cb.dataset.id) : _sel.delete(cb.dataset.id); updateBulk();
      });
    });
    H.renderPager('inv-pager', _page, pages, p => { _page = p; renderTable(); });
  }

  function updateBulk() {
    const b = H.el('inv-bulk'), c = H.el('inv-bulk-cnt'); if (!b) return;
    if (_sel.size > 0) { b.classList.remove('hidden'); c.textContent = `${_sel.size} selected`; }
    else b.classList.add('hidden');
  }
  function selAll()  { _sel = new Set(_filtered.map(i => i.id)); renderTable(); updateBulk(); }
  function clearSel(){ _sel.clear(); renderTable(); updateBulk(); }

  async function openForm(id = null) {
    const [inv, comms, clients] = await Promise.all([
      id ? DB.getById('invoices', id) : Promise.resolve(null),
      DB.getAll('commissions'), DB.getAll('clients')
    ]);
    const clMap = {}; clients.forEach(c => clMap[c.id] = c);
    const s = Settings.getAll();
    const today = new Date().toISOString().split('T')[0];
    const due30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    Modal.open({
      title: inv ? 'Edit Invoice' : 'New Invoice', size: 'lg',
      body: `
        <div class="form-2">
          <div class="field"><label>Client <span class="req">*</span></label>
            <select id="invf-client" onchange="Invoices.onClientChange(this.value)">
              <option value="">-- Select Client --</option>
              ${clients.map(c => `<option value="${c.id}" ${inv?.clientId === c.id ? 'selected' : ''}>${H.esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Linked Commission</label>
            <select id="invf-comm">
              <option value="">-- None / Standalone --</option>
              ${comms.filter(c => !inv || c.clientId === inv.clientId).map(c => `<option value="${c.id}" ${inv?.commissionId === c.id ? 'selected' : ''}>${H.esc(H.trunc(c.title, 30))} (${H.peso(c.price)})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field"><label>Invoice Description <span class="req">*</span></label>
          <textarea id="invf-desc" placeholder="Services rendered, deliverables included…" style="min-height:72px">${H.esc(inv?.description || '')}</textarea>
        </div>
        <div class="form-3">
          <div class="field"><label>Subtotal (₱) <span class="req">*</span></label>
            <input type="number" id="invf-sub" min="0" step="0.01" value="${inv?.subtotal || ''}" oninput="Invoices.recalc()"/></div>
          <div class="field"><label>Discount (₱)</label>
            <input type="number" id="invf-disc" min="0" step="0.01" value="${inv?.discount || 0}" oninput="Invoices.recalc()"/></div>
          <div class="field"><label>Tax / VAT (₱)</label>
            <input type="number" id="invf-tax" min="0" step="0.01" value="${inv?.tax || 0}" oninput="Invoices.recalc()"/></div>
        </div>
        <div class="card" style="padding:12px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="muted" style="font-size:.82rem">Total Amount</span>
            <span class="mono bold" style="font-size:1.1rem" id="invf-total">${H.peso(inv?.total || 0)}</span>
          </div>
        </div>
        <div class="form-2">
          <div class="field"><label>Issue Date</label>
            <input type="date" id="invf-issue" value="${H.toInput(inv?.issueDate || today)}"/></div>
          <div class="field"><label>Due Date</label>
            <input type="date" id="invf-due" value="${H.toInput(inv?.dueDate || due30)}"/></div>
        </div>
        <div class="form-2">
          <div class="field"><label>Status</label>
            <select id="invf-status">
              ${['Draft','Sent','Paid','Overdue','Cancelled'].map(s => `<option ${(inv?.status || 'Draft') === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Payment Terms</label>
            <input id="invf-terms" value="${H.esc(inv?.terms || s.invoiceTerms || 'Due within 30 days of issue.')}" placeholder="Payment terms…"/></div>
        </div>
        <div class="field"><label>Notes to Client</label>
          <textarea id="invf-notes" placeholder="Additional notes or bank details" style="min-height:56px">${H.esc(inv?.notes || s.invoiceNotes || '')}</textarea>
        </div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-ghost" onclick="Invoices.saveForm('${id || ''}','Draft')">Save Draft</button>
             <button class="btn btn-primary" onclick="Invoices.saveForm('${id || ''}','Sent')">Save &amp; Mark Sent</button>`
    });
    setTimeout(() => Invoices.recalc(), 40);
  }

  async function onClientChange(clientId) {
    const sel = H.el('invf-comm'); if (!sel) return;
    const comms = await DB.getAll('commissions');
    const filtered = comms.filter(c => !clientId || c.clientId === clientId);
    sel.innerHTML = `<option value="">-- None / Standalone --</option>` +
      filtered.map(c => `<option value="${c.id}">${H.esc(H.trunc(c.title, 30))} (${H.peso(c.price)})</option>`).join('');
  }

  function recalc() {
    const sub  = H.num(H.el('invf-sub')?.value);
    const disc = H.num(H.el('invf-disc')?.value);
    const tax  = H.num(H.el('invf-tax')?.value);
    const total = Math.max(0, sub - disc + tax);
    const el = H.el('invf-total');
    if (el) el.textContent = H.peso(total);
  }

  async function saveForm(id, forceStatus) {
    const desc    = (H.el('invf-desc')?.value || '').trim();
    const sub     = H.num(H.el('invf-sub')?.value);
    const disc    = H.num(H.el('invf-disc')?.value);
    const tax     = H.num(H.el('invf-tax')?.value);
    const total   = Math.max(0, sub - disc + tax);
    const clientId = H.el('invf-client')?.value;

    if (!clientId) { Notify.err('Select a client.'); return; }
    if (!desc)     { Notify.err('Description is required.'); return; }
    if (sub <= 0)  { Notify.err('Subtotal must be greater than 0.'); return; }

    const isNew    = !id;
    const existing = id ? await DB.getById('invoices', id) : null;
    const rec = {
      id: id || H.uid('inv'),
      invoiceNumber: existing?.invoiceNumber || (await nextNumber()),
      clientId,
      commissionId: H.el('invf-comm')?.value || null,
      description: desc,
      subtotal: sub, discount: disc, tax, total,
      issueDate: H.el('invf-issue')?.value || H.now().split('T')[0],
      dueDate:   H.el('invf-due')?.value   || '',
      status: forceStatus || H.el('invf-status')?.value || 'Draft',
      terms:  (H.el('invf-terms')?.value  || '').trim(),
      notes:  (H.el('invf-notes')?.value  || '').trim(),
      createdAt: existing?.createdAt || H.now(),
      updatedAt: H.now()
    };
    await DB.put('invoices', rec);
    await Logs.add(isNew ? 'create' : 'update', `${isNew ? 'Created' : 'Updated'} invoice: ${rec.invoiceNumber}`);
    Modal.close();
    Notify.ok(`Invoice ${rec.invoiceNumber} ${isNew ? 'created' : 'updated'}.`);
    await render();
  }

  async function markPaid(id) {
    const inv = await DB.getById('invoices', id); if (!inv) return;
    inv.status = 'Paid'; inv.updatedAt = H.now();
    await DB.put('invoices', inv);
    await Logs.add('update', `Invoice ${inv.invoiceNumber} marked as Paid`);
    Notify.ok(`Invoice ${inv.invoiceNumber} marked as Paid.`);
    await render();
  }

  async function viewDetail(id) {
    const inv = await DB.getById('invoices', id); if (!inv) return;
    const cl  = _clMap[inv.clientId];
    const co  = _commMap[inv.commissionId];
    const s   = Settings.getAll();
    Modal.open({
      title: `Invoice ${inv.invoiceNumber}`, size: 'lg',
      body: `
        <div style="background:#fff;color:#111;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15)">
          <div style="background:linear-gradient(135deg,#1a202c,#2d3748);padding:24px 28px;color:#fff">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
              <div>
                <div style="font-size:1.1rem;font-weight:800">${H.esc(s.businessName || 'FCMS Business')}</div>
                ${s.freelancerName ? `<div style="font-size:.83rem;color:#90cdf4">${H.esc(s.freelancerName)}</div>` : ''}
                ${s.contactNumber  ? `<div style="font-size:.79rem;color:#718096">${H.esc(s.contactNumber)}</div>`  : ''}
                ${s.email          ? `<div style="font-size:.79rem;color:#718096">${H.esc(s.email)}</div>`          : ''}
              </div>
              <div style="text-align:right">
                <div style="font-size:.72rem;color:#718096;text-transform:uppercase;letter-spacing:.08em">Invoice</div>
                <div style="font-size:1.1rem;font-weight:800;font-family:monospace;color:#90cdf4">${H.esc(inv.invoiceNumber)}</div>
                <div style="font-size:.79rem;color:#718096">Issue: ${H.fmtDate(inv.issueDate)}</div>
                <div style="font-size:.79rem;color:${inv.status==='Overdue'?'#fc8181':'#718096'}">Due: ${H.fmtDate(inv.dueDate)}</div>
              </div>
            </div>
          </div>
          <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
            <div style="font-size:.69rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:6px">Billed To</div>
            <div style="font-size:.95rem;font-weight:700">${H.esc(cl?.name || '-')}</div>
            ${cl?.phone ? `<div style="font-size:.83rem;color:#4a5568">${H.esc(cl.phone)}</div>` : ''}
            ${cl?.email ? `<div style="font-size:.83rem;color:#4a5568">${H.esc(cl.email)}</div>` : ''}
          </div>
          <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
            <div style="font-size:.69rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:8px">Services</div>
            <div style="font-size:.88rem;color:#374151;line-height:1.6">${H.esc(inv.description)}</div>
            ${co ? `<div style="font-size:.78rem;color:#718096;margin-top:4px">Ref: ${H.esc(co.title)}</div>` : ''}
          </div>
          <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
            <div style="display:flex;justify-content:flex-end">
              <div style="min-width:240px">
                <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.85rem"><span style="color:#718096">Subtotal</span><span style="font-family:monospace">₱${Number(inv.subtotal||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
                ${H.num(inv.discount)>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.85rem"><span style="color:#718096">Discount</span><span style="color:#e53e3e;font-family:monospace">−₱${Number(inv.discount).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>`:''}
                ${H.num(inv.tax)>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.85rem"><span style="color:#718096">Tax/VAT</span><span style="font-family:monospace">₱${Number(inv.tax).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>`:''}
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1a202c;margin-top:6px">
                  <span style="font-weight:800;font-size:.95rem">Total</span>
                  <span style="font-weight:800;font-size:1.1rem;font-family:monospace;color:#1a202c">₱${Number(inv.total||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                </div>
              </div>
            </div>
          </div>
          ${inv.terms || inv.notes ? `<div style="padding:16px 28px;background:#f8fafc;font-size:.82rem;color:#4a5568;line-height:1.6">
            ${inv.terms ? `<div style="margin-bottom:4px"><strong>Terms:</strong> ${H.esc(inv.terms)}</div>` : ''}
            ${inv.notes ? `<div>${H.esc(inv.notes)}</div>` : ''}
          </div>` : ''}
          <div style="padding:12px 28px;background:#1a202c;text-align:center;font-size:.78rem;color:#718096">
            Generated by FCMS Pro · ${H.esc(s.businessName || '')}
          </div>
        </div>`,
      foot: `
        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        <button class="btn btn-ghost" onclick="Invoices.openForm('${id}');Modal.close()">Edit</button>
        ${inv.status !== 'Paid' ? `<button class="btn btn-success" onclick="Invoices.markPaid('${id}');Modal.close()">Mark Paid</button>` : ''}
        <button class="btn btn-primary" onclick="Invoices.printInvoice('${id}')">Print / PDF</button>`
    });
  }

  async function printInvoice(id) {
    const inv = await DB.getById('invoices', id); if (!inv) return;
    const cl  = _clMap[inv.clientId] || {};
    const s   = Settings.getAll();
    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) { Notify.wrn('Allow pop-ups to print invoices.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>${inv.invoiceNumber}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;font-size:13px;color:#1a202c;background:#fff}
    .wrap{max-width:680px;margin:0 auto;padding:32px}
    .hd{background:linear-gradient(135deg,#1a202c,#2d3748);color:#fff;padding:28px 32px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:flex-start}
    .biz{font-size:1.1rem;font-weight:800} .biz-tag{font-size:.8rem;color:#90cdf4;margin-top:2px}
    .inv-no{font-size:.69rem;text-transform:uppercase;letter-spacing:.08em;color:#718096;text-align:right}
    .inv-val{font-size:1rem;font-weight:800;font-family:monospace;color:#90cdf4}
    .sect{padding:18px 32px;border-bottom:1px solid #e2e8f0}
    .lbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:4px;font-weight:700}
    .name{font-size:.95rem;font-weight:700} .meta{font-size:.82rem;color:#4a5568}
    .desc{font-size:.88rem;line-height:1.6;color:#374151}
    .totals{display:flex;justify-content:flex-end;padding:18px 32px;border-bottom:1px solid #e2e8f0}
    .tot-inner{min-width:260px} .tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:.85rem}
    .tot-final{display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1a202c;margin-top:6px;font-size:.95rem;font-weight:800}
    .mono{font-family:monospace} .footer{background:#f8fafc;padding:12px 32px;font-size:.79rem;color:#718096;line-height:1.6;border-radius:0 0 8px 8px}
    @media print{@page{margin:8mm}}</style></head>
    <body><div class="wrap">
      <div class="hd">
        <div><div class="biz">${H.esc(s.businessName||'FCMS Business')}</div>${s.freelancerName?`<div class="biz-tag">${H.esc(s.freelancerName)}</div>`:''}</div>
        <div><div class="inv-no">Invoice</div><div class="inv-val">${H.esc(inv.invoiceNumber)}</div><div style="font-size:.78rem;color:#718096;text-align:right;margin-top:4px">Issue: ${H.fmtDate(inv.issueDate)}<br>Due: ${H.fmtDate(inv.dueDate)}</div></div>
      </div>
      <div class="sect"><div class="lbl">Billed To</div><div class="name">${H.esc(cl.name||'-')}</div>${cl.phone?`<div class="meta">${H.esc(cl.phone)}</div>`:''}${cl.email?`<div class="meta">${H.esc(cl.email)}</div>`:''}</div>
      <div class="sect"><div class="lbl">Description</div><div class="desc">${H.esc(inv.description)}</div></div>
      <div class="totals"><div class="tot-inner">
        <div class="tot-row"><span>Subtotal</span><span class="mono">₱${Number(inv.subtotal||0).toFixed(2)}</span></div>
        ${H.num(inv.discount)>0?`<div class="tot-row"><span>Discount</span><span class="mono" style="color:#e53e3e">−₱${Number(inv.discount).toFixed(2)}</span></div>`:''}
        ${H.num(inv.tax)>0?`<div class="tot-row"><span>Tax/VAT</span><span class="mono">₱${Number(inv.tax).toFixed(2)}</span></div>`:''}
        <div class="tot-final"><span>Total Due</span><span class="mono">₱${Number(inv.total||0).toFixed(2)}</span></div>
      </div></div>
      ${inv.terms||inv.notes?`<div class="footer">${inv.terms?`<strong>Terms:</strong> ${H.esc(inv.terms)}<br>`:''}${inv.notes?H.esc(inv.notes):''}</div>`:''}
    </div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),600)}<\/script></body></html>`);
    win.document.close();
    await Logs.add('update', `Printed invoice: ${inv.invoiceNumber}`);
  }

  async function delOne(id) {
    const inv = await DB.getById('invoices', id); if (!inv) return;
    Modal.confirm({
      title: 'Delete Invoice', danger: true,
      message: `Delete invoice ${inv.invoiceNumber}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await DB.remove('invoices', id);
        await Logs.add('delete', `Deleted invoice: ${inv.invoiceNumber}`);
        Notify.ok('Invoice deleted.');
        await render();
      }
    });
  }

  async function delSel() {
    if (!_sel.size) return;
    Modal.confirm({
      title: 'Delete Selected Invoices', danger: true,
      message: `Delete ${_sel.size} invoice(s)?`,
      confirmLabel: 'Delete Selected',
      onConfirm: async () => {
        await DB.bulkRemove('invoices', [..._sel]);
        await Logs.add('delete', `Deleted ${_sel.size} invoices (bulk)`);
        Notify.ok(`${_sel.size} invoice(s) deleted.`);
        _sel.clear(); await render();
      }
    });
  }

  async function exportCSV() {
    const h = ['Invoice #', 'Client', 'Description', 'Subtotal', 'Discount', 'Tax', 'Total', 'Issue Date', 'Due Date', 'Status'];
    const rows = _filtered.map(i => [
      i.invoiceNumber, _clMap[i.clientId]?.name || '', i.description,
      i.subtotal || 0, i.discount || 0, i.tax || 0, i.total || 0,
      i.issueDate, i.dueDate, i.status
    ]);
    H.dlFile(H.toCSV(rows, h), `FCMS-Invoices-${Date.now()}.csv`, 'text/csv');
    Notify.ok('Invoices exported.');
  }

  return { render, openForm, saveForm, recalc, onClientChange, viewDetail, markPaid, printInvoice, delOne, delSel, selAll, clearSel, exportCSV };
})();
