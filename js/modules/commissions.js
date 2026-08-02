'use strict';
const Commissions = (() => {
  const PER=15;
  let _all=[], _filtered=[], _page=1, _sort={k:'dateAdded',d:'desc'};
  let _sel=new Set(), _filterClientId=null;
  let _cMap={}; // client lookup map, shared by selAll/clearSel/render
  let _view = localStorage.getItem('fcms-comm-view') || 'table';
  const STATUSES=['Pending','In Progress','Revision','Completed','Delivered','Cancelled'];
  const DEFAULT_SERVICES=['Logo Design','UI/UX Design','Web Development','Illustration','Animation','Video Editing','Copywriting','Social Media','Photography','Branding','Print Design','Other'];
  const getServices=()=>Settings.get('serviceTypes',DEFAULT_SERVICES);

  async function render(params={}) {
    if(params.filterClientId) _filterClientId=params.filterClientId;
    const [all,clients]=await Promise.all([DB.getAll('commissions'),DB.getAll('clients')]);
    _all=all; _sel.clear();
    _cMap={}; clients.forEach(c=>_cMap[c.id]=c);

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div>
          <div class="pg-title">Commissions${_filterClientId?` - ${H.esc(params.filterClientName||'Filtered')}`:''}</div>
          <div class="pg-sub">${_all.length} total commission${_all.length!==1?'s':''}</div>
        </div>
        <div class="pg-acts">
          <div class="view-toggle">
            <button class="view-btn ${_view==='table'?'active':''}" onclick="Commissions.setView('table')">
              <svg viewBox="0 0 24 24" width="13"><path d="M3 5v14h18V5H3zm8 12H5v-4h6v4zm0-6H5V7h6v4zm8 6h-6v-4h6v4zm0-6h-6V7h6v4z"/></svg> Table
            </button>
            <button class="view-btn ${_view==='kanban'?'active':''}" onclick="Commissions.setView('kanban')">
              <svg viewBox="0 0 24 24" width="13"><path d="M4 4h6v16H4V4zm10 0h6v9h-6V4z"/></svg> Board
            </button>
          </div>
          ${_filterClientId?`<button class="btn btn-ghost btn-sm" onclick="Commissions.clearFilter()">✕ Clear Filter</button>`:''}
          <button class="btn btn-ghost btn-sm" onclick="Commissions.exportCSV()">↓ CSV</button>
          <button class="btn btn-primary" onclick="Commissions.openForm()">+ New Commission</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="tb-s"><input id="cm-q" placeholder="Search title, service…"/></div>
        <select id="cm-status">
          <option value="">All Statuses</option>
          ${STATUSES.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
        <select id="cm-sort">
          <option value="dateAdded-desc">Newest First</option>
          <option value="dateAdded-asc">Oldest First</option>
          <option value="deadline-asc">Deadline ↑</option>
          <option value="price-desc">Price ↓</option>
          <option value="price-asc">Price ↑</option>
        </select>
        ${_view==='table'?`<button class="btn btn-ghost btn-sm" onclick="Commissions.selAll()">☐ All</button>`:''}
      </div>
      <div id="cm-bulk" class="bulk-bar hidden">
        <span class="bulk-n" id="cm-bulk-cnt">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="Commissions.delSel()">Delete Selected Items</button>
        <button class="btn btn-ghost btn-sm" onclick="Commissions.clearSel()">✕ Cancel</button>
      </div>
      <div id="cm-view-area"></div>`;

    H.el('cm-q').addEventListener('input', H.debounce(()=>{_page=1;applyFilter(_cMap)},260));
    H.el('cm-status').addEventListener('change', ()=>{_page=1;applyFilter(_cMap)});
    H.el('cm-sort').addEventListener('change', ()=>{const[k,d]=H.el('cm-sort').value.split('-');_sort={k,d};_page=1;applyFilter(_cMap)});
    applyFilter(_cMap);
  }

  function setView(v) {
    _view = v;
    localStorage.setItem('fcms-comm-view', v);
    render({filterClientId:_filterClientId});
  }

  function applyFilter(cMap) {
    const q=(H.el('cm-q')?.value||'').trim().toLowerCase();
    const st=H.el('cm-status')?.value||'';
    let list=[..._all];
    if(_filterClientId) list=list.filter(c=>c.clientId===_filterClientId);
    if(st) list=list.filter(c=>c.status===st);
    if(q) list=list.filter(c=>{
      const cl=cMap?cMap[c.clientId]:null;
      return (c.title||'').toLowerCase().includes(q)||(c.serviceType||'').toLowerCase().includes(q)||(cl?.name||'').toLowerCase().includes(q);
    });
    list=H.sortArr(list,_sort.k,_sort.d);
    _filtered=list;
    if (_view === 'kanban') renderKanban(cMap);
    else renderTable(cMap);
  }

  function renderKanban(cMap={}) {
    const area = H.el('cm-view-area'); if (!area) return;
    if (!_filtered.length) {
      const filtering = (H.el('cm-q')?.value||'').trim().length>0 || (H.el('cm-status')?.value||'')!=='' || !!_filterClientId;
      area.innerHTML = filtering ? `<div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <div class="empty-ttl">No matches found</div>
        <div class="empty-sub">Try a different search term or status filter.</div>
      </div>` : `<div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
        <div class="empty-ttl">No commissions found</div><div class="empty-sub">Create your first commission.</div>
      </div>`;
      return;
    }
    area.innerHTML = `<div class="kanban-board">
      ${STATUSES.map(status => {
        const items = _filtered.filter(c => c.status === status);
        return `<div class="kanban-col">
          <div class="kanban-col-head">
            <span class="kanban-col-title">${status}</span>
            <span class="kanban-col-count">${items.length}</span>
          </div>
          <div class="kanban-col-body">
            ${items.length ? items.map(c => {
              const cl = cMap[c.clientId];
              const d = H.daysUntil(c.deadline);
              const overdue = d !== null && d < 0 && !['Delivered','Cancelled'].includes(status);
              return `<div class="kanban-card" onclick="Commissions.openForm('${c.id}')">
                <div class="kc-title">${H.esc(H.trunc(c.title, 32))}${c.recurFrequency&&c.recurFrequency!=='none'?` <span title="Repeats ${c.recurFrequency}" style="font-size:0.68rem">🔁</span>`:''}</div>
                <div class="kc-client">${H.esc(cl?.name || '-')} · ${H.esc(c.serviceType||'')}</div>
                <div class="kc-footer">
                  <span class="kc-price">${H.peso(c.price)}</span>
                  <span class="kc-deadline" style="${overdue?'color:var(--red);font-weight:700':''}">${c.deadline ? H.fmtDate(c.deadline) : '-'}</span>
                </div>
              </div>`;
            }).join('') : `<div style="text-align:center;padding:20px 0;font-size:0.76rem;color:var(--t3)">No items</div>`}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderTable(cMap={}) {
    const area = H.el('cm-view-area'); if (!area) return;
    area.innerHTML = `
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:36px"><input type="checkbox" class="cb" id="cm-all-cb"/></th>
            <th class="srt" data-c="title">Title</th>
            <th>Client</th>
            <th>Service</th>
            <th class="srt" data-c="price">Price</th>
            <th>Down Pmt</th>
            <th>Remaining</th>
            <th class="srt" data-c="deadline">Deadline</th>
            <th>Status</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="cm-tbody"></tbody>
        </table>
      </div>
      <div id="cm-pager" class="pager"></div>`;
    H.el('cm-all-cb').addEventListener('change', e=>e.target.checked?selAll():clearSel());
    document.querySelectorAll('thead th.srt').forEach(th=>th.addEventListener('click',()=>{
      const c=th.dataset.c;_sort={k:c,d:_sort.k===c&&_sort.d==='asc'?'desc':'asc'};_page=1;applyFilter(cMap);
    }));
    const {items,pages}=H.paginate(_filtered,_page,PER);
    const tbody=H.el('cm-tbody'); if(!tbody) return;
    if(!items.length){
      const filtering = (H.el('cm-q')?.value||'').trim().length>0 || (H.el('cm-status')?.value||'')!=='' || !!_filterClientId;
      tbody.innerHTML = filtering ? `<tr><td colspan="10"><div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <div class="empty-ttl">No matches found</div>
        <div class="empty-sub">Try a different search term or status filter.</div>
        <div class="empty-cta"><button class="btn btn-ghost btn-sm" onclick="Commissions.clearFilter()">Clear filters</button></div>
      </div></td></tr>` : `<tr><td colspan="10"><div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
        <div class="empty-ttl">No commissions found</div><div class="empty-sub">Create your first commission.</div>
      </div></td></tr>`;
      H.el('cm-pager').innerHTML=''; return;
    }
    tbody.innerHTML=items.map(c=>{
      const cl=cMap[c.clientId];
      const d=H.daysUntil(c.deadline);
      const dlStyle=(d!==null&&d<=3&&!['Delivered','Cancelled'].includes(c.status))?'color:var(--red);font-weight:600':'';
      return `<tr>
        <td><input type="checkbox" class="cb cm-cb" data-id="${c.id}" ${_sel.has(c.id)?'checked':''}/></td>
        <td><strong>${H.esc(H.trunc(c.title,26))}</strong>${c.recurFrequency&&c.recurFrequency!=='none'?` <span title="Repeats ${c.recurFrequency}" style="font-size:0.68rem;color:var(--a)">🔁</span>`:''}${c.clientNote?`<div style="font-size:0.72rem;color:var(--t3)">${H.esc(H.trunc(c.clientNote,30))}</div>`:''}</td>
        <td class="semi" style="font-size:0.82rem">${H.esc(cl?.name||'-')}</td>
        <td class="muted" style="font-size:0.8rem">${H.esc(c.serviceType||'-')}</td>
        <td class="mono" style="font-size:0.82rem">${H.peso(c.price)}</td>
        <td class="mono" style="font-size:0.82rem">${H.peso(c.downPayment)}</td>
        <td class="mono" style="font-size:0.82rem;${c.remaining>0?'color:var(--amber)':'color:var(--green)'}">${H.peso(c.remaining)}</td>
        <td style="font-size:0.8rem;${dlStyle}">${H.fmtDate(c.deadline)}</td>
        <td><select class="chip-sel chip-sel-${c.status.toLowerCase().replace(/\s+/g,'-')}" data-id="${c.id}" onchange="Commissions.quickStatus('${c.id}',this.value)" title="Change status">
          ${STATUSES.map(s=>`<option value="${s}" ${c.status===s?'selected':''}>${s}</option>`).join('')}
        </select></td>
        <td class="td-acts">
          <button class="btn btn-ghost btn-xs" onclick="Commissions.openForm('${c.id}')">Edit</button>
          <button class="btn btn-ghost btn-xs" onclick="Commissions.duplicate('${c.id}')">Copy</button>
          <button class="btn btn-success btn-xs" onclick="Payments.openForm('${c.id}')">Pay</button>
          <button class="btn btn-danger btn-xs" onclick="Commissions.delOne('${c.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
    document.querySelectorAll('.cm-cb').forEach(cb=>{
      cb.addEventListener('change',()=>{cb.checked?_sel.add(cb.dataset.id):_sel.delete(cb.dataset.id);updateBulk();});
    });
    H.renderPager('cm-pager',_page,pages,p=>{_page=p;renderTable(cMap)});
  }

  function updateBulk(){const bar=H.el('cm-bulk'),cnt=H.el('cm-bulk-cnt');if(!bar)return;if(_sel.size>0){bar.classList.remove('hidden');cnt.textContent=`${_sel.size} selected`;}else bar.classList.add('hidden');}
  // Uses the shared _cMap so re-rendering after selection stays consistent
  function selAll(){_sel=new Set(_filtered.map(c=>c.id));renderTable(_cMap);updateBulk();}
  function clearSel(){_sel.clear();renderTable(_cMap);updateBulk();}
  function clearFilter(){_filterClientId=null;render();}

  async function openForm(id=null) {
    const [comm,clients]=await Promise.all([id?DB.getById('commissions',id):Promise.resolve(null),DB.getAll('clients')]);
    Modal.open({
      title: comm?'Edit Commission':'New Commission', size:'lg',
      body: `
        <div class="field"><label>Project Title *</label><input id="cmf-title" value="${H.esc(comm?.title||'')}" placeholder="Commission title"/></div>
        <div class="form-2">
          <div class="field"><label>Client *</label>
            <select id="cmf-client">
              <option value="">-- Select Client --</option>
              ${clients.map(c=>`<option value="${c.id}" ${comm?.clientId===c.id?'selected':''}>${H.esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Service Type *</label>
            <select id="cmf-service">${getServices().map(s=>`<option ${comm?.serviceType===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
        </div>
        <div class="field"><label>Description</label><textarea id="cmf-desc" placeholder="Project details, requirements…">${H.esc(comm?.description||'')}</textarea></div>
        <div class="field"><label>Client-Facing Note</label><textarea id="cmf-clientnote" placeholder="Short note shown on receipts/invoices, such as: Revision 2 included" style="min-height:56px">${H.esc(comm?.clientNote||'')}</textarea></div>
        <div class="form-3">
          <div class="field"><label>Total Price (₱) *</label><input type="number" id="cmf-price" min="0" step="0.01" value="${comm?.price||''}" placeholder="0.00"/></div>
          <div class="field"><label>Down Payment (₱)</label><input type="number" id="cmf-down" min="0" step="0.01" value="${comm?.downPayment||0}" placeholder="0.00"/></div>
          <div class="field"><label>Deadline</label><input type="date" id="cmf-deadline" value="${H.toInput(comm?.deadline||'')}"/></div>
        </div>
        <div class="form-2">
          <div class="field"><label>Status</label>
            <select id="cmf-status">${STATUSES.map(s=>`<option ${(comm?.status||'Pending')===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Repeats</label>
            <select id="cmf-recur">
              ${[['none','Does not repeat'],['weekly','Weekly'],['biweekly','Every 2 weeks'],['monthly','Monthly']].map(([v,lbl])=>`<option value="${v}" ${(comm?.recurFrequency||'none')===v?'selected':''}>${lbl}</option>`).join('')}
            </select>
            <div class="field-hint">Auto-creates the next commission once this one is marked Delivered.</div>
          </div>
        </div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-primary" onclick="Commissions.saveForm('${id||''}')">
               ${comm?'Save Changes':'Create Commission'}</button>`
    });
  }

  async function saveForm(id) {
    const title=(H.el('cmf-title')?.value||'').trim();
    const clientId=H.el('cmf-client')?.value;
    const price=H.num(H.el('cmf-price')?.value);
    const down=H.num(H.el('cmf-down')?.value);
    if(!title){Notify.err('Title is required.');return;}
    if(!clientId){Notify.err('Please select a client.');return;}
    if(price<=0){Notify.err('Price must be greater than 0.');return;}
    if(down>price){Notify.err('Down payment cannot exceed total price.');return;}
    Modal.setBusy(true);
    try {
      const isNew=!id;
      const existing=id?await DB.getById('commissions',id):null;
      let extraPaid=0;
      if(existing){
        const pays=await DB.getAll('payments');
        extraPaid=pays.filter(p=>p.commissionId===id).reduce((s,p)=>s+H.num(p.amount),0);
      }
      // Remaining balance accounts for the down payment plus any payments already logged
      const totalPaid=down+extraPaid;
      const remaining=Math.max(0,price-totalPaid);
      const newStatus = H.el('cmf-status')?.value||'Pending';
      const rec={
        id: id||H.uid('com'), title, clientId,
        serviceType: H.el('cmf-service')?.value||'Other',
        description: H.el('cmf-desc')?.value.trim()||'',
        clientNote: (H.el('cmf-clientnote')?.value||'').trim(),
        price, downPayment: down, remaining,
        deadline: H.el('cmf-deadline')?.value||null,
        status: newStatus,
        recurFrequency: H.el('cmf-recur')?.value||'none',
        dateAdded: existing?.dateAdded||H.now(),
        updatedAt: H.now()
      };
      await DB.put('commissions',rec);
      await Logs.add(isNew?'create':'update',`${isNew?'Created':'Updated'} commission: ${title}`);
      if (newStatus==='Delivered' && existing?.status!=='Delivered' && rec.recurFrequency!=='none') {
        await _spawnRecurring(rec);
      }
      Modal.close();
      Notify.ok(`Commission "${title}" ${isNew?'created':'updated'}.`);
      await render();
    } finally {
      Modal.setBusy(false);
    }
  }

  async function _spawnRecurring(prev) {
    const nextDeadline = H.addInterval(prev.deadline || prev.dateAdded, prev.recurFrequency);
    const next = {
      ...prev,
      id: H.uid('com'),
      status: 'Pending',
      deadline: nextDeadline,
      remaining: prev.price,
      dateAdded: H.now(),
      updatedAt: H.now()
    };
    await DB.put('commissions', next);
    await Logs.add('create', `Auto-created recurring commission: ${next.title}`);
    Notify.ok(`Next occurrence of "${next.title}" was created automatically.`);
  }

  async function duplicate(id) {
    const orig=await DB.getById('commissions',id); if(!orig) return;
    const copy={...orig,id:H.uid('com'),title:orig.title+' (Copy)',dateAdded:H.now(),updatedAt:H.now(),status:'Pending',remaining:orig.price};
    await DB.put('commissions',copy);
    await Logs.add('create',`Duplicated: ${orig.title}`);
    Notify.ok('Commission duplicated.');
    await render();
  }

  async function delOne(id) {
    const c=await DB.getById('commissions',id); if(!c) return;
    Modal.confirm({
      title:'Delete Commission', danger:true,
      message:`Delete "${c.title}"?`,
      confirmLabel:'Delete',
      onConfirm: async()=>{
        await DB.remove('commissions',id);
        await Logs.add('delete',`Deleted commission: ${c.title}`);
        Notify.ok('Commission deleted.');
        await render();
      }
    });
  }

  async function delSel() {
    if(!_sel.size) return;
    Modal.confirm({
      title:'Delete Selected Items', danger:true,
      message:`Delete ${_sel.size} commission(s)?`,
      confirmLabel:'Delete Selected Items',
      onConfirm: async()=>{
        await DB.bulkRemove('commissions',[..._sel]);
        await Logs.add('delete',`Deleted ${_sel.size} commissions (bulk)`);
        Notify.ok(`${_sel.size} deleted.`);
        _sel.clear(); await render();
      }
    });
  }

  async function exportCSV() {
    const clients=await DB.getAll('clients'); const cMap={}; clients.forEach(c=>cMap[c.id]=c);
    const h=['ID','Title','Client','Service','Price','Down Payment','Remaining','Deadline','Status'];
    const r=_filtered.map(c=>[c.id,c.title,cMap[c.clientId]?.name||'',c.serviceType,c.price,c.downPayment,c.remaining,c.deadline||'',c.status]);
    H.dlFile(H.toCSV(r,h),`FCMS-Commissions-${Date.now()}.csv`,'text/csv');
    Notify.ok('Commissions exported.');
  }

  // Inline status update from the table dropdown, without a full page re-render
  async function quickStatus(id, status) {
    const c = await DB.getById('commissions', id);
    if (!c) return;
    const wasDelivered = c.status === 'Delivered';
    c.status = status;
    c.updatedAt = H.now();
    await DB.put('commissions', c);
    await Logs.add('update', `Status → ${status}: ${c.title}`);
    if (status==='Delivered' && !wasDelivered && c.recurFrequency && c.recurFrequency!=='none') {
      await _spawnRecurring(c);
    }
    // Update only the chip cell in the row (no full re-render)
    const sel = document.querySelector(`select.chip-sel[data-id="${id}"]`);
    if (sel) {
      sel.className = 'chip-sel chip-sel-' + status.toLowerCase().replace(/\s+/g,'-');
    }
    // Update remaining if Delivered/Cancelled
    applyFilter(_cMap);
  }

  // Called from Templates and Quotes to pre-fill the form
  async function openFormWithData(data = {}) {
  const clients = await DB.getAll('clients');
  const s = Settings.getAll();
  const services = Settings.get('serviceTypes', ['Logo Design','Web Development','Illustration','Other']);
  const today = new Date().toISOString().split('T')[0];
  Modal.open({
    title: 'New Commission', size: 'lg',
    body: _buildForm(null, data, clients, services, today, s),
    foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
           <button class="btn btn-primary" onclick="Commissions.saveForm('')">Create Commission</button>`
  });
}

  function _buildForm(existing, prefill, clients, services, today, s) {
  const d = existing || prefill || {};
  return `
    <div class="form-2">
      <div class="field"><label>Client <span class="req">*</span></label>
        <select id="cmf-client">
          <option value="">-- Select Client --</option>
          ${clients.map(c => `<option value="${c.id}" ${(d.clientId || '') === c.id ? 'selected' : ''}>${H.esc(c.name)}</option>`).join('')}
        </select>
        <div class="field-hint"><a style="color:var(--a);cursor:pointer" onclick="Clients.openForm()">+ Add new client</a></div>
      </div>
      <div class="field"><label>Commission Title <span class="req">*</span></label>
        <input id="cmf-title" value="${H.esc(d.title || '')}" placeholder="Logo Design for Startup"/></div>
    </div>
    <div class="form-2">
      <div class="field"><label>Service Type</label>
        <input id="cmf-svc" value="${H.esc(d.serviceType || '')}" list="cmf-svc-list" placeholder="Select or type…"/>
        <datalist id="cmf-svc-list">${services.map(sv => `<option value="${H.esc(sv)}">`).join('')}</datalist>
      </div>
      <div class="field"><label>Status</label>
        <select id="cmf-status">
          ${['Pending','In Progress','Revision','Completed','Delivered','Cancelled'].map(st => `<option ${(d.status||'Pending')===st?'selected':''}>${st}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-3">
      <div class="field"><label>Full Price (₱) <span class="req">*</span></label>
        <input type="number" id="cmf-price" min="0" step="0.01" value="${d.price||''}" oninput="Commissions.calcRemain()"/></div>
      <div class="field"><label>Down Payment (₱)</label>
        <input type="number" id="cmf-down" min="0" step="0.01" value="${d.downPayment||''}" oninput="Commissions.calcRemain()"/>
        <div class="field-hint" id="cmf-remain-hint"></div>
      </div>
      <div class="field"><label>Deadline</label>
        <input type="date" id="cmf-deadline" value="${H.toInput(d.deadline||'')}"/></div>
    </div>
    <div class="field"><label>Description / Notes</label>
      <textarea id="cmf-desc" placeholder="Project scope, requirements, client instructions…" style="min-height:72px">${H.esc(d.description||d.notes||'')}</textarea></div>
    <div class="field"><label>Priority</label>
      <select id="cmf-priority">
        ${['Normal','High','Urgent'].map(p => `<option ${(d.priority||'Normal')===p?'selected':''}>${p}</option>`).join('')}
      </select>
    </div>`;
}


  function calcRemain() {
    const price = H.num(H.el('cmf-price')?.value);
    const down  = H.num(H.el('cmf-down')?.value);
    const hint  = H.el('cmf-remain-hint');
    if (hint && price > 0) {
      const rem = Math.max(0, price - down);
      hint.textContent = `Remaining after down payment: ${H.peso(rem)}`;
    }
  }

  return {render,openForm,openFormWithData,saveForm,duplicate,delOne,delSel,selAll,clearSel,clearFilter,quickStatus,exportCSV,setView,calcRemain};
})();