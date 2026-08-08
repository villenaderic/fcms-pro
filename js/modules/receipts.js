'use strict';
const Receipts = (() => {
  const PER=20;
  let _all=[], _filtered=[], _page=1;
  let _sel=new Set();

  async function nextNumber() {
    const n = await DB.nextCounter('receipt_seq');
    return 'RCT-' + String(n).padStart(5, '0');
  }

  async function autoGenerate(payment, commission) {
    const clients=await DB.getAll('clients');
    const cl=clients.find(c=>c.id===payment.clientId);
    const allPays=await DB.getAll('payments');
    const prevPaid=allPays.filter(p=>p.commissionId===payment.commissionId&&p.id!==payment.id).reduce((s,p)=>s+H.num(p.amount),0);
    const rct={
      id:H.uid('rct'),
      receiptNumber: await nextNumber(),
      paymentId: payment.id,
      commissionId: payment.commissionId,
      clientId: payment.clientId,
      clientName: cl?.name||'-',
      clientPhone: cl?.phone||'',
      clientEmail: cl?.email||'',
      clientNotes: cl?.notes||'',
      commissionTitle: commission.title,
      commissionStatus: commission.status,
      commissionPrice: commission.price,
      serviceType: commission.serviceType,
      clientNote: commission.clientNote||'',
      downPayment: commission.downPayment,
      previousPayments: prevPaid,
      amountPaid: payment.amount,
      remainingBalance: commission.remaining,
      paymentMethod: payment.method,
      referenceNumber: payment.referenceNumber||'',
      notes: payment.notes||'',
      verificationCode: H.rctCode(),
      date: payment.date||H.now(),
      createdAt: H.now()
    };
    await DB.put('receipts',rct);
    return rct.id;
  }

  async function render() {
    _all=await DB.getAll('receipts');
    _all.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    _sel.clear();
    H.el('page-content').innerHTML=`
      <div class="pg-head">
        <div><div class="pg-title">Receipts</div><div class="pg-sub">${_all.length} receipt${_all.length!==1?'s':''} - auto-generated on payment</div></div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Receipts.exportCSV()" title="Downloads a spreadsheet file you can open in Excel or Google Sheets">Export to Excel</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="tb-s"><input id="rc-q" placeholder="Search receipt #, client, commission…"/></div>
        <button class="btn btn-ghost btn-sm" onclick="Receipts.selAll()">☐ All</button>
      </div>
      <div id="rc-bulk" class="bulk-bar hidden">
        <span class="bulk-n" id="rc-bulk-cnt">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="Receipts.delSel()">Delete Selected Items</button>
        <button class="btn btn-ghost btn-sm" onclick="Receipts.clearSel()">✕ Cancel</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:36px"><input type="checkbox" class="cb" id="rc-all-cb"/></th>
            <th>Receipt #</th>
            <th>Client</th>
            <th>Commission</th>
            <th>Amount Paid</th>
            <th>Remaining</th>
            <th>Method</th>
            <th>Date</th>
            <th>Verification</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="rc-tbody"></tbody>
        </table>
      </div>
      <div id="rc-pager" class="pager"></div>`;

    H.el('rc-q').addEventListener('input',H.debounce(()=>{_page=1;applyFilter()},260));
    H.el('rc-all-cb').addEventListener('change',e=>e.target.checked?selAll():clearSel());
    applyFilter();
  }

  function applyFilter() {
    const q=(H.el('rc-q')?.value||'').trim().toLowerCase();
    let list=[..._all];
    if(q) list=list.filter(r=>(r.receiptNumber||'').toLowerCase().includes(q)||(r.clientName||'').toLowerCase().includes(q)||(r.commissionTitle||'').toLowerCase().includes(q)||(r.verificationCode||'').toLowerCase().includes(q));
    _filtered=list; renderTable();
  }

  function renderTable() {
    const {items,pages}=H.paginate(_filtered,_page,PER);
    const tbody=H.el('rc-tbody'); if(!tbody) return;
    if(!items.length){
      tbody.innerHTML=`<tr><td colspan="10"><div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z"/></svg>
        <div class="empty-ttl">No receipts yet</div>
        <div class="empty-sub">Receipts are generated automatically when you record a payment.</div>
      </div></td></tr>`;
      H.el('rc-pager').innerHTML=''; return;
    }
    tbody.innerHTML=items.map(r=>`<tr>
      <td><input type="checkbox" class="cb rc-cb" data-id="${r.id}" ${_sel.has(r.id)?'checked':''}/></td>
      <td><strong class="mono" style="color:var(--a)">${H.esc(r.receiptNumber)}</strong></td>
      <td>${H.esc(r.clientName)}</td>
      <td class="semi" style="font-size:0.82rem">${H.esc(H.trunc(r.commissionTitle,22))}</td>
      <td class="mono green" style="font-weight:700">${H.peso(r.amountPaid)}</td>
      <td class="mono" style="${r.remainingBalance>0?'color:var(--amber)':'color:var(--green)'}">${H.peso(r.remainingBalance)}</td>
      <td><span class="chip ch-blue">${H.esc(r.paymentMethod||'-')}</span></td>
      <td class="muted" style="font-size:0.8rem">${H.fmtDate(r.date)}</td>
      <td class="mono muted" style="font-size:0.72rem;letter-spacing:1px">${H.esc(r.verificationCode||'-')}</td>
      <td class="td-acts">
        <button class="btn btn-ghost btn-xs" onclick="Receipts.preview('${r.id}')">Preview</button>
        <button class="btn btn-primary btn-xs" onclick="Receipts.saveImg('${r.id}')">Save as Image</button>
        <button class="btn btn-ghost btn-xs" onclick="Receipts.savePDF('${r.id}')">Save as PDF</button>
        <button class="btn btn-ghost btn-xs" onclick="Receipts.printImg('${r.id}')" title="Print this receipt">🖨</button>
      </td>
    </tr>`).join('');
    document.querySelectorAll('.rc-cb').forEach(cb=>{
      cb.addEventListener('change',()=>{cb.checked?_sel.add(cb.dataset.id):_sel.delete(cb.dataset.id);updateBulk();});
    });
    H.renderPager('rc-pager',_page,pages,p=>{_page=p;renderTable()});
  }

  function updateBulk(){const b=H.el('rc-bulk'),c=H.el('rc-bulk-cnt');if(!b)return;if(_sel.size>0){b.classList.remove('hidden');c.textContent=`${_sel.size} selected`;}else b.classList.add('hidden');}
  function selAll(){_sel=new Set(_filtered.map(r=>r.id));renderTable();updateBulk();}
  function clearSel(){_sel.clear();renderTable();updateBulk();}

  async function preview(id) {
    const r=await DB.getById('receipts',id); if(!r) return;
    await ReceiptImg.showPreviewModal(r);
  }

  async function saveImg(id) {
    const r=await DB.getById('receipts',id); if(!r){Notify.err('Receipt not found.');return;}
    try { await ReceiptImg.downloadPNG(r); Notify.ok(`Receipt ${r.receiptNumber} saved as image.`); }
    catch(e) { Notify.err('Image generation failed: '+e.message); }
  }

  async function savePDF(id) {
    const r=await DB.getById('receipts',id); if(!r){Notify.err('Receipt not found.');return;}
    try {
      const {jsPDF}=window.jspdf; if(!jsPDF){Notify.err('PDF library not loaded.');return;}
      const canvas=await ReceiptImg.generate(r);
      const imgData=canvas.toDataURL('image/png');
      const doc=new jsPDF({unit:'mm',format:'a5'});
      const pw=doc.internal.pageSize.getWidth();
      const ph=doc.internal.pageSize.getHeight();
      // Fit canvas aspect ratio into page
      const ratio=canvas.height/canvas.width;
      const imgW=pw-20;
      const imgH=imgW*ratio;
      doc.addImage(imgData,'PNG',10,10,imgW,Math.min(imgH,ph-20));
      doc.save(`Receipt-${r.receiptNumber}.pdf`);
      Notify.ok(`Receipt ${r.receiptNumber} saved as PDF.`);
    } catch(e){Notify.err('PDF failed: '+e.message);}
  }

  async function printImg(id) {
    const r=await DB.getById('receipts',id); if(!r) return;
    try { const canvas=await ReceiptImg.generate(r); ReceiptImg.printCanvas(canvas); }
    catch(e) { Notify.err('Print failed: '+e.message); }
  }

  async function viewByPayment(paymentId) {
    const all=await DB.getAll('receipts');
    const r=all.find(r=>r.paymentId===paymentId);
    if(!r){Notify.wrn('Receipt not found for this payment.');return;}
    await ReceiptImg.showPreviewModal(r);
  }

  async function delSel() {
    if(!_sel.size) return;
    Modal.confirm({
      title:'Delete Selected Items', danger:true,
      message:`Delete ${_sel.size} receipt(s)?`,
      confirmLabel:'Delete Selected Items',
      onConfirm: async()=>{
        await DB.bulkRemove('receipts',[..._sel]);
        await Logs.add('delete',`Deleted ${_sel.size} receipts (bulk)`);
        Notify.ok(`${_sel.size} receipt(s) deleted.`);
        _sel.clear(); await render();
      }
    });
  }

  async function exportCSV() {
    const h=['Receipt #','Client','Commission','Amount Paid','Remaining','Method','Reference','Date','Verification Code'];
    const r=_filtered.map(r=>[r.receiptNumber,r.clientName,r.commissionTitle,r.amountPaid,r.remainingBalance,r.paymentMethod,r.referenceNumber||'',r.date,r.verificationCode]);
    H.dlFile(H.toCSV(r,h),`FCMS-Receipts-${Date.now()}.csv`,'text/csv');
    Notify.ok('Receipts exported.');
  }

  return {render,autoGenerate,preview,saveImg,savePDF,printImg,viewByPayment,delSel,selAll,clearSel,exportCSV};
})();
