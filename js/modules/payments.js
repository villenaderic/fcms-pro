'use strict';
const Payments = (() => {
  const PER=20;
  let _all=[], _filtered=[], _page=1, _sort={k:'date',d:'desc'};
  let _sel=new Set();
  let _commMap={}, _clMap={}, _receiptMap={}; // Module-level maps for closure
  const METHODS=['Cash','GCash','Maya','Bank Transfer','PayPal','Wise','Cheque','Other'];

  async function render() {
    const [payments,comms,clients]=await Promise.all([DB.getAll('payments'),DB.getAll('commissions'),DB.getAll('clients')]);
    _all=payments; _sel.clear();
    _commMap={}; comms.forEach(c=>_commMap[c.id]=c);
    _clMap={}; clients.forEach(c=>_clMap[c.id]=c);
    const totalIn=payments.reduce((s,p)=>s+H.num(p.amount),0);
    const totalPend=comms.reduce((s,c)=>s+H.num(c.remaining),0);

    // Load receipt map for receipt # column (Feature 6.5)
    const allReceipts=await DB.getAll('receipts');
    const receiptMap={};
    allReceipts.forEach(r=>{if(r.paymentId)receiptMap[r.paymentId]=r;});
    _receiptMap=receiptMap;

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div><div class="pg-title">Payments</div><div class="pg-sub">${payments.length} transaction${payments.length!==1?'s':''}</div></div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Payments.exportCSV()" title="Downloads a spreadsheet file you can open in Excel or Google Sheets">Export to Excel</button>
          <button class="btn btn-primary" onclick="Payments.openForm()">+ Record Payment</button>
        </div>
      </div>
      <div class="analytics-stat" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
        <div class="kpi"><div class="kpi-lbl">Total Received</div><div class="kpi-val sm">${H.peso(totalIn)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Total Pending</div><div class="kpi-val sm" style="color:var(--amber)">${H.peso(totalPend)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Transactions</div><div class="kpi-val">${payments.length}</div></div>
      </div>
      <div class="toolbar">
        <div class="tb-s"><input id="py-q" placeholder="Search client, commission, reference…"/></div>
        <select id="py-method">
          <option value="">All Methods</option>
          ${METHODS.map(m=>`<option>${m}</option>`).join('')}
        </select>
        <select id="py-sort">
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="amount-desc">Amount ↓</option>
          <option value="amount-asc">Amount ↑</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="Payments.selAll()">☐ All</button>
      </div>
      <div id="py-bulk" class="bulk-bar hidden">
        <span class="bulk-n" id="py-bulk-cnt">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="Payments.delSel()">Delete Selected Items</button>
        <button class="btn btn-ghost btn-sm" onclick="Payments.clearSel()">✕ Cancel</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:36px"><input type="checkbox" class="cb" id="py-all-cb"/></th>
            <th>Client</th>
            <th>Commission</th>
            <th class="srt" data-c="amount">Amount</th>
            <th>Method</th>
            <th>Reference #</th>
            <th>Receipt #</th>
            <th class="srt" data-c="date">Date</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="py-tbody"></tbody>
        </table>
      </div>
      <div id="py-pager" class="pager"></div>`;

    H.el('py-q').addEventListener('input',H.debounce(()=>{_page=1;applyFilter(_commMap,_clMap,_receiptMap)},260));
    H.el('py-method').addEventListener('change',()=>{_page=1;applyFilter(_commMap,_clMap,_receiptMap)});
    H.el('py-sort').addEventListener('change',()=>{const[k,d]=H.el('py-sort').value.split('-');_sort={k,d};_page=1;applyFilter(_commMap,_clMap,_receiptMap)});
    H.el('py-all-cb').addEventListener('change',e=>e.target.checked?selAll():clearSel());
    document.querySelectorAll('thead th.srt').forEach(th=>th.addEventListener('click',()=>{
      const c=th.dataset.c;_sort={k:c,d:_sort.k===c&&_sort.d==='asc'?'desc':'asc'};_page=1;applyFilter(_commMap,_clMap,_receiptMap);
    }));
    applyFilter(_commMap,_clMap,receiptMap);
  }

  function applyFilter(commMap,clMap,receiptMap) {
    const q=(H.el('py-q')?.value||'').trim().toLowerCase();
    const mf=H.el('py-method')?.value||'';
    let list=[..._all];
    if(mf) list=list.filter(p=>p.method===mf);
    if(q) list=list.filter(p=>{
      const cl=clMap[p.clientId]; const co=commMap[p.commissionId];
      return (cl?.name||'').toLowerCase().includes(q)||(co?.title||'').toLowerCase().includes(q)||(p.referenceNumber||'').toLowerCase().includes(q);
    });
    list=H.sortArr(list,_sort.k,_sort.d);
    _filtered=list; renderTable(commMap,clMap,receiptMap||{}); _syncSortHeaders();
  }

  function _syncSortHeaders() {
    document.querySelectorAll('#page-content thead th.srt').forEach(th => {
      th.classList.remove('asc', 'desc');
      if (th.dataset.c === _sort.k) th.classList.add(_sort.d === 'asc' ? 'asc' : 'desc');
    });
  }

  function renderTable(commMap={},clMap={},receiptMap={}) {
    const {items,pages}=H.paginate(_filtered,_page,PER);
    const tbody=H.el('py-tbody'); if(!tbody) return;
    if(!items.length){
      const filtering = (H.el('py-q')?.value||'').trim().length>0 || (H.el('py-method')?.value||'')!=='';
      tbody.innerHTML = filtering ? `<tr><td colspan="9"><div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <div class="empty-ttl">No matches found</div>
        <div class="empty-sub">Try a different search term or payment method filter.</div>
      </div></td></tr>` : `<tr><td colspan="9"><div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
        <div class="empty-ttl">No payments recorded</div>
      </div></td></tr>`;
      H.el('py-pager').innerHTML=''; return;
    }
    tbody.innerHTML=items.map(p=>{
      const cl=clMap[p.clientId]; const co=commMap[p.commissionId];
      const rct=receiptMap[p.id];
      return `<tr>
        <td><input type="checkbox" class="cb py-cb" data-id="${p.id}" ${_sel.has(p.id)?'checked':''}/></td>
        <td><div class="avatar-row">${H.avatar(cl?.name||'-',22)}<strong>${H.esc(cl?.name||'-')}</strong></div></td>
        <td class="semi" style="font-size:0.82rem">${H.esc(H.trunc(co?.title||'-',24))}</td>
        <td class="mono green" style="font-weight:700">${H.peso(p.amount)}</td>
        <td><span class="chip ch-blue">${H.esc(p.method||'-')}</span></td>
        <td class="mono muted" style="font-size:0.8rem">${H.esc(p.referenceNumber||'-')}</td>
        <td class="mono" style="font-size:0.8rem;color:var(--a)">${rct?H.esc(rct.receiptNumber):'-'}</td>
        <td class="muted" style="font-size:0.8rem">${H.fmtDate(p.date)}</td>
        <td class="td-acts">
          <button class="btn btn-ghost btn-xs" onclick="Payments.viewDetail('${p.id}')">View</button>
          <button class="btn btn-success btn-xs" onclick="Receipts.viewByPayment('${p.id}')">Receipt</button>
          <button class="btn btn-danger btn-xs" onclick="Payments.refund('${p.id}')">Refund</button>
        </td>
      </tr>`;
    }).join('');
    document.querySelectorAll('.py-cb').forEach(cb=>{
      cb.addEventListener('change',()=>{cb.checked?_sel.add(cb.dataset.id):_sel.delete(cb.dataset.id);updateBulk();});
    });
    H.renderPager('py-pager',_page,pages,p=>{_page=p;renderTable(commMap,clMap,receiptMap)});
  }

  function updateBulk(){const b=H.el('py-bulk'),c=H.el('py-bulk-cnt');if(!b)return;if(_sel.size>0){b.classList.remove('hidden');c.textContent=`${_sel.size} selected`;}else b.classList.add('hidden');}
  // Uses the module-level _commMap and _clMap so lookups stay in sync with the current list
  function selAll(){_sel=new Set(_filtered.map(p=>p.id));renderTable(_commMap,_clMap,_receiptMap);updateBulk();}
  function clearSel(){_sel.clear();renderTable(_commMap,_clMap,_receiptMap);updateBulk();}

  async function openForm(commissionId=null) {
    const [comms,clients]=await Promise.all([DB.getAll('commissions'),DB.getAll('clients')]);
    const clMap={}; clients.forEach(c=>clMap[c.id]=c);
    const active=comms.filter(c=>!['Delivered','Cancelled'].includes(c.status)||c.id===commissionId);
    const presel=commissionId?comms.find(c=>c.id===commissionId):null;

    Modal.open({
      title:'Record Payment', size:'lg',
      body: `
        <div class="field"><label>Commission *</label>
          <select id="pf-comm" onchange="Payments.onCommChange(this.value)">
            <option value="">-- Select Commission --</option>
            ${active.map(c=>`<option value="${c.id}" ${c.id===commissionId?'selected':''}>${H.esc(c.title)} - ${H.esc(clMap[c.clientId]?.name||'?')} (Remaining: ${H.peso(c.remaining)})</option>`).join('')}
          </select>
        </div>
        <div id="pf-info" class="card" style="padding:12px;margin-bottom:14px;display:${presel?'block':'none'}">
          <div id="pf-info-body"></div>
        </div>
        <div class="form-2">
          <div class="field"><label>Amount Paid (₱) *</label>
            <input type="number" id="pf-amt" min="0.01" step="0.01" placeholder="0.00"/>
          </div>
          <div class="field"><label>Payment Method *</label>
            <select id="pf-method">${METHODS.map(m=>`<option>${m}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-2">
          <div class="field"><label>Payment Date *</label>
            <input type="date" id="pf-date" value="${new Date().toISOString().split('T')[0]}"/>
          </div>
          <div class="field"><label>Reference Number</label>
            <input type="text" id="pf-ref" placeholder="Transaction / reference number"/>
          </div>
        </div>
        <div class="field"><label>Notes</label>
          <textarea id="pf-notes" placeholder="Optional payment notes…" style="min-height:56px"></textarea>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-ghost btn-sm" onclick="Payments.fillFull()">Set Full Payment</button>
          <button class="btn btn-ghost btn-sm" onclick="Payments.fillDown()">Set Down Payment Amount</button>
        </div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-primary" onclick="Payments.saveForm()">Record Payment</button>`
    });
    if(presel) setTimeout(()=>showCommInfo(presel,clMap),40);
  }

  async function onCommChange(id) {
    if(!id){const i=H.el('pf-info');if(i)i.style.display='none';return;}
    const [comm,clients]=await Promise.all([DB.getById('commissions',id),DB.getAll('clients')]);
    if(!comm) return;
    const clMap={}; clients.forEach(c=>clMap[c.id]=c);
    showCommInfo(comm,clMap);
  }

  function showCommInfo(comm,clMap) {
    const box=H.el('pf-info'), body=H.el('pf-info-body'); if(!box||!body) return;
    const cl=clMap[comm.clientId];
    box.style.display='block';
    body.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:0.83rem">
      <div><span class="muted">Client</span><br><strong>${H.esc(cl?.name||'-')}</strong></div>
      <div><span class="muted">Total Price</span><br><strong class="mono">${H.peso(comm.price)}</strong></div>
      <div><span class="muted">Remaining</span><br><strong class="mono amber">${H.peso(comm.remaining)}</strong></div>
    </div>`;
  }

  async function fillFull() {
    const sel=H.el('pf-comm'); if(!sel?.value){Notify.wrn('Select a commission first.');return;}
    const comm=await DB.getById('commissions',sel.value);
    if(comm){const i=H.el('pf-amt');if(i)i.value=H.num(comm.remaining).toFixed(2);}
  }

  async function fillDown() {
    const sel=H.el('pf-comm'); if(!sel?.value){Notify.wrn('Select a commission first.');return;}
    const comm=await DB.getById('commissions',sel.value);
    if(comm){const i=H.el('pf-amt');if(i)i.value=H.num(comm.downPayment).toFixed(2);}
  }

  async function saveForm() {
    const commId=H.el('pf-comm')?.value;
    const amount=H.num(H.el('pf-amt')?.value);
    const method=H.el('pf-method')?.value;
    const date=H.el('pf-date')?.value;
    const ref=(H.el('pf-ref')?.value||'').trim();
    const notes=(H.el('pf-notes')?.value||'').trim();

    if(!commId){Notify.err('Select a commission.');return;}
    if(amount<=0){Notify.err('Amount must be greater than 0.');return;}
    if(!date){Notify.err('Date is required.');return;}

    const comm=await DB.getById('commissions',commId);
    if(!comm){Notify.err('Commission not found.');return;}
    if(amount>comm.remaining+0.005){Notify.err(`Amount exceeds remaining balance of ${H.peso(comm.remaining)}.`);return;}

    Modal.setBusy(true);
    try {
      const payment={
        id:H.uid('pay'), commissionId:commId, clientId:comm.clientId,
        amount, method, date, referenceNumber:ref, notes, createdAt:H.now()
      };

      comm.remaining=Math.max(0,comm.remaining-amount);
      comm.updatedAt=H.now();

      await DB.put('payments',payment);
      await DB.put('commissions',comm);

      await Receipts.autoGenerate(payment,comm);

      await Logs.add('create',`Payment: ${H.peso(amount)} for "${comm.title}"`);
      Modal.close();
      Notify.ok(`Payment of ${H.peso(amount)} recorded. Receipt generated.`);
      await render();
    } finally {
      Modal.setBusy(false);
    }
  }

  async function viewDetail(id) {
    const [pay,comms,clients]=await Promise.all([DB.getById('payments',id),DB.getAll('commissions'),DB.getAll('clients')]);
    if(!pay) return;
    const co=comms.find(c=>c.id===pay.commissionId);
    const cl=clients.find(c=>c.id===pay.clientId);
    Modal.open({
      title:'Payment Detail', size:'sm',
      body: `<div>
        ${dr('Payment ID',`<span class="mono muted" style="font-size:0.78rem">${pay.id}</span>`)}
        ${dr('Client',cl?.name||'-')}
        ${dr('Commission',H.trunc(co?.title||'-',30))}
        ${dr('Amount',`<strong class="mono green">${H.peso(pay.amount)}</strong>`)}
        ${dr('Method',pay.method||'-')}
        ${dr('Date',H.fmtDate(pay.date))}
        ${dr('Reference #',pay.referenceNumber||'-')}
        ${pay.notes?dr('Notes',H.esc(pay.notes)):''}
      </div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Close</button>
             <button class="btn btn-primary" onclick="Receipts.viewByPayment('${id}');Modal.close()">View Receipt</button>`
    });
  }

  function dr(l,v){return `<div class="dr"><span class="dr-l">${l}</span><span class="dr-v">${v}</span></div>`;}

  async function refund(id) {
    const pay=await DB.getById('payments',id); if(!pay) return;
    Modal.confirm({
      title:'Mark as Refund', danger:true,
      message:`Record a refund of ${H.peso(pay.amount)}? The commission balance will be restored.`,
      confirmLabel:'Record Refund',
      onConfirm: async()=>{
        const comm=await DB.getById('commissions',pay.commissionId);
        if(comm){
          // Recalculate from all remaining payments so totals stay accurate
          const allPays=await DB.getAll('payments');
          const totalStillPaid=allPays
            .filter(p=>p.commissionId===pay.commissionId&&p.id!==id)
            .reduce((s,p)=>s+H.num(p.amount),0);
          comm.remaining=Math.max(0,comm.price-H.num(comm.downPayment)-totalStillPaid);
          comm.updatedAt=H.now();
          await DB.put('commissions',comm);
        }
        await DB.remove('payments',id);
        const receipts=await DB.getAll('receipts');
        const linked=receipts.find(r=>r.paymentId===id);
        if(linked) await DB.remove('receipts',linked.id);
        await Logs.add('update',`Refund: ${H.peso(pay.amount)}`);
        Notify.inf('Refund recorded. Balance restored.');
        await render();
      }
    });
  }

  async function delSel() {
    if(!_sel.size) return;
    Modal.confirm({
      title:'Delete Selected Items', danger:true,
      message:`Delete ${_sel.size} payment record(s)? Balances will NOT be automatically restored.`,
      confirmLabel:'Delete Selected Items',
      onConfirm: async()=>{
        await DB.bulkRemove('payments',[..._sel]);
        await Logs.add('delete',`Deleted ${_sel.size} payments (bulk)`);
        Notify.ok(`${_sel.size} payment(s) deleted.`);
        _sel.clear(); await render();
      }
    });
  }

  async function exportCSV() {
    const [comms,clients]=await Promise.all([DB.getAll('commissions'),DB.getAll('clients')]);
    const cMap={}; comms.forEach(c=>cMap[c.id]=c);
    const clMap={}; clients.forEach(c=>clMap[c.id]=c);
    const h=['Payment ID','Client','Commission','Amount','Method','Reference','Date','Notes'];
    const r=_filtered.map(p=>[p.id,clMap[p.clientId]?.name||'',cMap[p.commissionId]?.title||'',p.amount,p.method,p.referenceNumber||'',p.date,p.notes||'']);
    H.dlFile(H.toCSV(r,h),`FCMS-Payments-${Date.now()}.csv`,'text/csv');
    Notify.ok('Payments exported.');
  }

  return {render,openForm,onCommChange,fillFull,fillDown,saveForm,viewDetail,refund,delSel,selAll,clearSel,exportCSV};
})();
