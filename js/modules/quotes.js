'use strict';
/* Quotes / Proposals - send before commission is confirmed */
const Quotes = (() => {
  const PER = 15;
  let _all = [], _filtered = [], _page = 1;
  let _clMap = {};

  async function nextNumber() {
    const n = await DB.nextCounter('quote_seq');
    return 'QUO-' + String(n).padStart(5, '0');
  }

  async function render() {
    const [quotes, clients] = await Promise.all([DB.getAll('quotes'), DB.getAll('clients')]);
    _all = quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    _clMap = {}; clients.forEach(c => _clMap[c.id] = c);

    const pending   = quotes.filter(q => q.status === 'Sent').length;
    const accepted  = quotes.filter(q => q.status === 'Accepted').length;
    const totalVal  = quotes.filter(q => q.status === 'Accepted').reduce((s, q) => s + H.num(q.total), 0);

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div>
          <div class="pg-title">Quotes &amp; Proposals</div>
          <div class="pg-sub">${quotes.length} quote${quotes.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Quotes.exportCSV()" title="Downloads a spreadsheet file you can open in Excel or Google Sheets">Export to Excel</button>
          <button class="btn btn-primary" onclick="Quotes.openForm()">+ New Quote</button>
        </div>
      </div>
      <div class="kpi-row" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
        <div class="kpi" style="--kpi-c:var(--a);--kpi-bg:var(--a-d)"><div class="kpi-lbl">Total Quotes</div><div class="kpi-val">${quotes.length}</div></div>
        <div class="kpi" style="--kpi-c:var(--amber);--kpi-bg:var(--amber-d)"><div class="kpi-lbl">Awaiting Reply</div><div class="kpi-val">${pending}</div></div>
        <div class="kpi" style="--kpi-c:var(--green);--kpi-bg:var(--green-d)"><div class="kpi-lbl">Accepted</div><div class="kpi-val">${accepted}</div></div>
        <div class="kpi" style="--kpi-c:var(--purple);--kpi-bg:var(--purple-d)"><div class="kpi-lbl">Won Value</div><div class="kpi-val sm">${H.peso(totalVal)}</div></div>
      </div>
      <div class="toolbar">
        <div class="tb-s"><input id="quo-q" placeholder="Search quote #, client…"/></div>
        <select id="quo-status">
          <option value="">All Statuses</option>
          ${['Draft','Sent','Accepted','Declined','Expired'].map(s => `<option>${s}</option>`).join('')}
        </select>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Quote #</th><th>Client</th><th>Service</th><th>Amount</th>
            <th>Valid Until</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody id="quo-tbody"></tbody>
        </table>
      </div>
      <div id="quo-pager" class="pager"></div>`;

    H.el('quo-q').addEventListener('input', H.debounce(() => { _page = 1; applyFilter(); }, 260));
    H.el('quo-status').addEventListener('change', () => { _page = 1; applyFilter(); });
    applyFilter();
  }

  function applyFilter() {
    const q  = (H.el('quo-q')?.value || '').trim().toLowerCase();
    const st = H.el('quo-status')?.value || '';
    let list = [..._all];
    if (st) list = list.filter(x => x.status === st);
    if (q)  list = list.filter(x =>
      (x.quoteNumber || '').toLowerCase().includes(q) ||
      (_clMap[x.clientId]?.name || '').toLowerCase().includes(q) ||
      (x.serviceType || '').toLowerCase().includes(q)
    );
    _filtered = list; renderTable();
  }

  function renderTable() {
    const { items, pages } = H.paginate(_filtered, _page, PER);
    const tbody = H.el('quo-tbody'); if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty">
        <div class="empty-ttl">No quotes yet</div>
        <div class="empty-sub">Create a proposal to send to potential clients before starting a commission.</div>
        <div class="empty-cta"><button class="btn btn-primary btn-sm" onclick="Quotes.openForm()">+ New Quote</button></div>
      </div></td></tr>`;
      H.el('quo-pager').innerHTML = ''; return;
    }
    tbody.innerHTML = items.map(q => {
      const cl      = _clMap[q.clientId];
      const expired = q.status !== 'Accepted' && q.status !== 'Declined' && q.validUntil && new Date(q.validUntil) < new Date();
      const eff     = expired ? 'Expired' : q.status;
      return `<tr>
        <td class="mono blue" style="font-weight:700;font-size:.82rem">${H.esc(q.quoteNumber)}</td>
        <td style="font-weight:600;font-size:.83rem">${H.esc(cl?.name || '-')}</td>
        <td class="muted" style="font-size:.8rem">${H.esc(q.serviceType || '-')}</td>
        <td class="mono green" style="font-weight:700">${H.peso(q.total)}</td>
        <td class="muted" style="font-size:.79rem;${expired ? 'color:var(--red);font-weight:600' : ''}">${H.fmtDate(q.validUntil)}</td>
        <td>${H.chip(eff)}</td>
        <td class="td-acts">
          <button class="btn btn-ghost btn-xs" onclick="Quotes.viewDetail('${q.id}')">View</button>
          <button class="btn btn-ghost btn-xs" onclick="Quotes.openForm('${q.id}')">Edit</button>
          ${q.status !== 'Accepted' && q.status !== 'Declined' ? `
            <button class="btn btn-success btn-xs" onclick="Quotes.setStatus('${q.id}','Accepted')">Accept</button>
            <button class="btn btn-danger btn-xs" onclick="Quotes.setStatus('${q.id}','Declined')">Decline</button>` : ''}
          ${q.status === 'Accepted' ? `<button class="btn btn-purple btn-xs" onclick="Quotes.convertToComm('${q.id}')">→ Commission</button>` : ''}
          <button class="btn btn-danger btn-xs" onclick="Quotes.delOne('${q.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
    H.renderPager('quo-pager', _page, pages, p => { _page = p; renderTable(); });
  }

  async function openForm(id = null) {
    const [q, clients] = await Promise.all([
      id ? DB.getById('quotes', id) : Promise.resolve(null),
      DB.getAll('clients')
    ]);
    const today  = new Date().toISOString().split('T')[0];
    const valid7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    Modal.open({
      title: q ? 'Edit Quote' : 'New Quote / Proposal', size: 'lg',
      body: `
        <div class="form-2">
          <div class="field"><label>Client <span class="req">*</span></label>
            <select id="qf-client">
              <option value="">-- Select Client --</option>
              ${clients.map(c => `<option value="${c.id}" ${q?.clientId === c.id ? 'selected' : ''}>${H.esc(c.name)}</option>`).join('')}
            </select></div>
          <div class="field"><label>Service Type</label>
            <input id="qf-svc" value="${H.esc(q?.serviceType || '')}" list="qf-svc-list" placeholder="Logo Design"/>
            <datalist id="qf-svc-list">${Settings.get('serviceTypes', []).map(s => `<option value="${H.esc(s)}">`).join('')}</datalist>
          </div>
        </div>
        <div class="field"><label>Scope of Work <span class="req">*</span></label>
          <textarea id="qf-scope" placeholder="Describe the deliverables, timeline, and what's included…" style="min-height:90px">${H.esc(q?.scope || '')}</textarea></div>
        <div class="form-3">
          <div class="field"><label>Amount (₱) <span class="req">*</span></label>
            <input type="number" id="qf-total" min="0" step="0.01" value="${q?.total || ''}" oninput="Quotes.recalcDown()"/></div>
          <div class="field"><label>Down Payment (₱)</label>
            <input type="number" id="qf-down" min="0" step="0.01" value="${q?.downPayment || ''}" placeholder="Optional"/></div>
          <div class="field"><label>Revision Rounds</label>
            <input type="number" id="qf-revisions" min="0" value="${q?.revisions ?? 2}" placeholder="2"/></div>
        </div>
        <div class="form-2">
          <div class="field"><label>Issue Date</label>
            <input type="date" id="qf-issue" value="${H.toInput(q?.issueDate || today)}"/></div>
          <div class="field"><label>Valid Until</label>
            <input type="date" id="qf-valid" value="${H.toInput(q?.validUntil || valid7)}"/></div>
        </div>
        <div class="field"><label>Terms &amp; Conditions</label>
          <textarea id="qf-terms" placeholder="Payment terms, revision policy, cancellation terms…" style="min-height:64px">${H.esc(q?.terms || Settings.get('quoteTerms', '50% down payment required before work begins. Remaining balance due upon delivery.'))}</textarea></div>
        <div class="field"><label>Status</label>
          <select id="qf-status">
            ${['Draft','Sent','Accepted','Declined','Expired'].map(s => `<option ${(q?.status || 'Draft') === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select></div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-ghost" onclick="Quotes.saveForm('${id || ''}','Draft')">Save Draft</button>
             <button class="btn btn-teal" onclick="Quotes.printQuote('${id || ''}')">Preview &amp; Print</button>
             <button class="btn btn-primary" onclick="Quotes.saveForm('${id || ''}')">Save Quote</button>`
    });
  }

  function recalcDown() {
    const total = H.num(H.el('qf-total')?.value);
    const downEl = H.el('qf-down');
    if (downEl && !downEl.value) downEl.placeholder = H.peso(total * 0.5) + ' (50%)';
  }

  async function saveForm(id, forceStatus) {
    const clientId = H.el('qf-client')?.value;
    const scope    = (H.el('qf-scope')?.value || '').trim();
    const total    = H.num(H.el('qf-total')?.value);
    if (!clientId) { Notify.err('Select a client.'); return; }
    if (!scope)    { Notify.err('Scope of work is required.'); return; }
    if (total <= 0){ Notify.err('Amount must be greater than 0.'); return; }
    const isNew    = !id;
    const existing = id ? await DB.getById('quotes', id) : null;
    const rec = {
      id: id || H.uid('quo'),
      quoteNumber: existing?.quoteNumber || (await nextNumber()),
      clientId,
      serviceType: (H.el('qf-svc')?.value || '').trim(),
      scope,
      total,
      downPayment: H.num(H.el('qf-down')?.value),
      revisions:   parseInt(H.el('qf-revisions')?.value || '2'),
      issueDate:   H.el('qf-issue')?.value || H.now().split('T')[0],
      validUntil:  H.el('qf-valid')?.value || '',
      terms:       (H.el('qf-terms')?.value || '').trim(),
      status:      forceStatus || H.el('qf-status')?.value || 'Draft',
      createdAt:   existing?.createdAt || H.now(),
      updatedAt:   H.now()
    };
    await DB.put('quotes', rec);
    await Logs.add(isNew ? 'create' : 'update', `${isNew ? 'Created' : 'Updated'} quote: ${rec.quoteNumber}`);
    Modal.close();
    Notify.ok(`Quote ${rec.quoteNumber} ${isNew ? 'created' : 'updated'}.`);
    await render();
  }

  async function setStatus(id, status) {
    const q = await DB.getById('quotes', id); if (!q) return;
    q.status = status; q.updatedAt = H.now();
    await DB.put('quotes', q);
    await Logs.add('update', `Quote ${q.quoteNumber} marked as ${status}`);
    Notify.ok(`Quote marked as ${status}.`);
    await render();
  }

  async function convertToComm(id) {
    const q  = await DB.getById('quotes', id); if (!q) return;
    const cl = _clMap[q.clientId];
    Modal.confirm({
      title: 'Convert to Commission',
      message: `Convert quote ${q.quoteNumber} for ${cl?.name || 'client'} (${H.peso(q.total)}) into a new commission?`,
      confirmLabel: 'Convert',
      onConfirm: async () => {
        Modal.close();
        App.navigate('commissions').then(() => Commissions.openFormWithData({
          title:       q.serviceType || q.quoteNumber,
          serviceType: q.serviceType,
          price:       q.total,
          downPayment: q.downPayment,
          clientId:    q.clientId,
          description: q.scope
        }));
        q.status = 'Accepted'; q.updatedAt = H.now();
        await DB.put('quotes', q);
        await Logs.add('update', `Quote ${q.quoteNumber} converted to commission`);
        Notify.ok('Commission form opened from quote.');
      }
    });
  }

  async function viewDetail(id) {
    const q  = await DB.getById('quotes', id); if (!q) return;
    const cl = _clMap[q.clientId];
    const s  = Settings.getAll();
    Modal.open({
      title: `Quote ${q.quoteNumber}`, size: 'lg',
      body: `
        <div style="background:#fff;color:#111;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15)">
          <div style="background:linear-gradient(135deg,#1a202c,#2d3748);padding:22px 26px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
            <div><div style="font-size:1rem;font-weight:800">${H.esc(s.businessName || 'FCMS Business')}</div>${s.freelancerName ? `<div style="font-size:.79rem;color:#90cdf4">${H.esc(s.freelancerName)}</div>` : ''}</div>
            <div style="text-align:right">
              <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:#718096">Proposal / Quote</div>
              <div style="font-size:1rem;font-weight:800;font-family:monospace;color:#90cdf4">${H.esc(q.quoteNumber)}</div>
              <div style="font-size:.75rem;color:#718096">Issued: ${H.fmtDate(q.issueDate)} · Valid: ${H.fmtDate(q.validUntil)}</div>
            </div>
          </div>
          <div style="padding:16px 26px;border-bottom:1px solid #e2e8f0">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#718096;margin-bottom:5px">Prepared For</div>
            <div style="font-size:.93rem;font-weight:700">${H.esc(cl?.name || '-')}</div>
            ${cl?.phone ? `<div style="font-size:.8rem;color:#4a5568">${H.esc(cl.phone)}</div>` : ''}
            ${cl?.email ? `<div style="font-size:.8rem;color:#4a5568">${H.esc(cl.email)}</div>` : ''}
          </div>
          <div style="padding:16px 26px;border-bottom:1px solid #e2e8f0">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#718096;margin-bottom:5px">Scope of Work - ${H.esc(q.serviceType || '')}</div>
            <div style="font-size:.86rem;line-height:1.65;color:#374151;white-space:pre-line">${H.esc(q.scope)}</div>
            ${q.revisions >= 0 ? `<div style="font-size:.78rem;color:#718096;margin-top:8px">Includes ${q.revisions} revision round${q.revisions !== 1 ? 's' : ''}</div>` : ''}
          </div>
          <div style="padding:16px 26px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:flex-end">
            <div style="min-width:220px">
              <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.85rem"><span style="color:#718096">Service Total</span><span style="font-family:monospace;font-weight:700">₱${Number(q.total).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>
              ${q.downPayment > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.85rem"><span style="color:#718096">Down Payment Required</span><span style="font-family:monospace">₱${Number(q.downPayment).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>` : ''}
            </div>
          </div>
          ${q.terms ? `<div style="padding:14px 26px;background:#f8fafc;font-size:.8rem;color:#4a5568;line-height:1.6"><strong>Terms:</strong> ${H.esc(q.terms)}</div>` : ''}
          <div style="padding:10px 26px;background:#1a202c;text-align:center;font-size:.75rem;color:#718096">
            Generated by FCMS Pro · Quote valid until ${H.fmtDate(q.validUntil)}
          </div>
        </div>`,
      foot: `
        <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        <button class="btn btn-ghost" onclick="Quotes.openForm('${id}');Modal.close()">Edit</button>
        ${q.status === 'Accepted' ? `<button class="btn btn-purple" onclick="Quotes.convertToComm('${id}');Modal.close()">→ Convert to Commission</button>` : ''}
        <button class="btn btn-primary" onclick="Quotes.printQuoteDirect('${id}')">Print / PDF</button>`
    });
  }

  async function printQuoteDirect(id) {
    const q  = await DB.getById('quotes', id); if (!q) return;
    const cl = _clMap[q.clientId] || {};
    const s  = Settings.getAll();
    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) { Notify.wrn('Allow pop-ups to print.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>${q.quoteNumber}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;font-size:13px;color:#1a202c;background:#fff}
    .wrap{max-width:680px;margin:0 auto;padding:32px}
    .hd{background:linear-gradient(135deg,#1a202c,#2d3748);color:#fff;padding:26px 32px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:flex-start}
    .biz{font-size:1rem;font-weight:800} .tag{font-size:.75rem;color:#90cdf4}
    .qno{font-size:.67rem;text-transform:uppercase;letter-spacing:.08em;color:#718096;text-align:right}
    .qval{font-size:.95rem;font-weight:800;font-family:monospace;color:#90cdf4}
    .sect{padding:16px 32px;border-bottom:1px solid #e2e8f0}
    .lbl{font-size:.67rem;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:4px;font-weight:700}
    .scope{font-size:.85rem;line-height:1.7;color:#374151;white-space:pre-line}
    .tot{display:flex;justify-content:space-between;padding:4px 0;font-size:.85rem}
    .footer{padding:10px 32px;background:#f8fafc;font-size:.79rem;color:#4a5568;line-height:1.6;border-radius:0 0 8px 8px}
    @media print{@page{margin:8mm}}</style></head>
    <body><div class="wrap">
      <div class="hd">
        <div><div class="biz">${H.esc(s.businessName||'Business')}</div>${s.freelancerName?`<div class="tag">${H.esc(s.freelancerName)}</div>`:''}</div>
        <div><div class="qno">Proposal / Quote</div><div class="qval">${H.esc(q.quoteNumber)}</div><div style="font-size:.72rem;color:#718096;text-align:right;margin-top:3px">Issued: ${H.fmtDate(q.issueDate)}<br>Valid until: ${H.fmtDate(q.validUntil)}</div></div>
      </div>
      <div class="sect"><div class="lbl">Prepared For</div><div style="font-size:.9rem;font-weight:700">${H.esc(cl.name||'-')}</div>${cl.phone?`<div style="font-size:.8rem;color:#4a5568">${H.esc(cl.phone)}</div>`:''}${cl.email?`<div style="font-size:.8rem;color:#4a5568">${H.esc(cl.email)}</div>`:''}</div>
      <div class="sect"><div class="lbl">Scope of Work${q.serviceType?'-'+H.esc(q.serviceType):''}</div><div class="scope">${H.esc(q.scope)}</div>${q.revisions>=0?`<div style="font-size:.76rem;color:#718096;margin-top:8px">${q.revisions} revision round${q.revisions!==1?'s':''} included</div>`:''}</div>
      <div class="sect" style="display:flex;justify-content:flex-end"><div style="min-width:220px">
        <div class="tot"><span>Service Total</span><span style="font-family:monospace;font-weight:700">₱${Number(q.total).toFixed(2)}</span></div>
        ${q.downPayment>0?`<div class="tot"><span>Down Payment Required</span><span style="font-family:monospace">₱${Number(q.downPayment).toFixed(2)}</span></div>`:''}
      </div></div>
      ${q.terms?`<div class="footer"><strong>Terms:</strong> ${H.esc(q.terms)}</div>`:''}
      <div style="padding:10px 32px;background:#1a202c;text-align:center;font-size:.73rem;color:#718096;border-radius:0 0 8px 8px">Generated by FCMS Pro · ${H.esc(s.businessName||'')}</div>
    </div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),600)}<\/script></body></html>`);
    win.document.close();
  }

  async function delOne(id) {
    const q = await DB.getById('quotes', id); if (!q) return;
    Modal.confirm({
      title: 'Delete Quote', danger: true,
      message: `Delete quote ${q.quoteNumber}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await DB.remove('quotes', id);
        await Logs.add('delete', `Deleted quote: ${q.quoteNumber}`);
        Notify.ok('Quote deleted.');
        await render();
      }
    });
  }

  async function exportCSV() {
    const h = ['Quote #', 'Client', 'Service', 'Total', 'Down Payment', 'Issue Date', 'Valid Until', 'Status'];
    const rows = _filtered.map(q => [
      q.quoteNumber, _clMap[q.clientId]?.name || '', q.serviceType || '',
      q.total, q.downPayment || 0, q.issueDate, q.validUntil, q.status
    ]);
    H.dlFile(H.toCSV(rows, h), `FCMS-Quotes-${Date.now()}.csv`, 'text/csv');
    Notify.ok('Quotes exported.');
  }

  return { render, openForm, saveForm, recalcDown, setStatus, convertToComm, viewDetail, printQuoteDirect, delOne, exportCSV };
})();
