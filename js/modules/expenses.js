'use strict';
const Expenses = (() => {
  const PER=20;
  let _all=[], _filtered=[], _page=1;
  let _sel=new Set();
  const CATEGORIES=['Software/Tools','Equipment','Marketing','Training','Internet/Utilities','Office Supplies','Taxes/Fees','Other'];

  async function render() {
    _all=await DB.getAll('expenses');
    _all.sort((a,b)=>new Date(b.date)-new Date(a.date));
    _sel.clear();

    const now=new Date();
    const thisMonth=_all.filter(e=>{const d=new Date(e.date);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();}).reduce((s,e)=>s+H.num(e.amount),0);
    const thisYear=_all.filter(e=>new Date(e.date).getFullYear()===now.getFullYear()).reduce((s,e)=>s+H.num(e.amount),0);
    const [payments]=await Promise.all([DB.getAll('payments')]);
    const totalIncome=payments.filter(p=>new Date(p.date).getFullYear()===now.getFullYear()).reduce((s,p)=>s+H.num(p.amount),0);
    const netProfit=totalIncome-thisYear;

    H.el('page-content').innerHTML=`
      <div class="pg-head">
        <div><div class="pg-title">Expenses</div><div class="pg-sub">${_all.length} expense record${_all.length!==1?'s':''}</div></div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Expenses.exportCSV()">↓ CSV</button>
          <button class="btn btn-primary" onclick="Expenses.openForm()">+ Add Expense</button>
        </div>
      </div>
      <div class="analytics-stat" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
        <div class="kpi"><div class="kpi-lbl">This Month</div><div class="kpi-val sm" style="color:var(--red)">${H.peso(thisMonth)}</div></div>
        <div class="kpi"><div class="kpi-lbl">This Year</div><div class="kpi-val sm" style="color:var(--red)">${H.peso(thisYear)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Net Profit (Year)</div><div class="kpi-val sm" style="${netProfit>=0?'color:var(--green)':'color:var(--red)'}">${H.peso(netProfit)}</div></div>
      </div>
      <div class="toolbar">
        <div class="tb-s"><input id="ex-q" placeholder="Search description, category…"/></div>
        <select id="ex-cat">
          <option value="">All Categories</option>
          ${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="Expenses.selAll()">☐ All</button>
      </div>
      <div id="ex-bulk" class="bulk-bar hidden">
        <span class="bulk-n" id="ex-bulk-cnt">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="Expenses.delSel()">Delete Selected Items</button>
        <button class="btn btn-ghost btn-sm" onclick="Expenses.clearSel()">✕ Cancel</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:36px"><input type="checkbox" class="cb" id="ex-all-cb"/></th>
            <th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Notes</th><th>Actions</th>
          </tr></thead>
          <tbody id="ex-tbody"></tbody>
        </table>
      </div>
      <div id="ex-pager" class="pager"></div>`;

    H.el('ex-q').addEventListener('input',H.debounce(()=>{_page=1;applyFilter()},260));
    H.el('ex-cat').addEventListener('change',()=>{_page=1;applyFilter()});
    H.el('ex-all-cb').addEventListener('change',e=>e.target.checked?selAll():clearSel());
    applyFilter();
  }

  function applyFilter() {
    const q=(H.el('ex-q')?.value||'').trim().toLowerCase();
    const cat=H.el('ex-cat')?.value||'';
    let list=[..._all];
    if(cat) list=list.filter(e=>e.category===cat);
    if(q) list=list.filter(e=>(e.description||'').toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q));
    _filtered=list; renderTable();
  }

  function renderTable() {
    const {items,pages}=H.paginate(_filtered,_page,PER);
    const tbody=H.el('ex-tbody'); if(!tbody) return;
    if(!items.length){
      tbody.innerHTML=`<tr><td colspan="7"><div class="empty">
        <svg class="empty-ico" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
        <div class="empty-ttl">No expenses yet</div>
        <div class="empty-sub">Track your business expenses to see net profit.</div>
      </div></td></tr>`;
      H.el('ex-pager').innerHTML=''; return;
    }
    tbody.innerHTML=items.map(e=>`<tr>
      <td><input type="checkbox" class="cb ex-cb" data-id="${e.id}" ${_sel.has(e.id)?'checked':''}/></td>
      <td><strong>${H.esc(e.description||'-')}</strong></td>
      <td><span class="chip ch-blue">${H.esc(e.category||'Other')}</span></td>
      <td class="mono" style="color:var(--red);font-weight:700">${H.peso(e.amount)}</td>
      <td class="muted" style="font-size:0.8rem">${H.fmtDate(e.date)}</td>
      <td class="muted" style="font-size:0.8rem">${H.esc(H.trunc(e.notes||'-',30))}</td>
      <td class="td-acts">
        <button class="btn btn-ghost btn-xs" onclick="Expenses.openForm('${e.id}')">Edit</button>
        <button class="btn btn-danger btn-xs" onclick="Expenses.delOne('${e.id}')">Delete</button>
      </td>
    </tr>`).join('');
    document.querySelectorAll('.ex-cb').forEach(cb=>{
      cb.addEventListener('change',()=>{cb.checked?_sel.add(cb.dataset.id):_sel.delete(cb.dataset.id);updateBulk();});
    });
    H.renderPager('ex-pager',_page,pages,p=>{_page=p;renderTable()});
  }

  function updateBulk(){const b=H.el('ex-bulk'),c=H.el('ex-bulk-cnt');if(!b)return;if(_sel.size>0){b.classList.remove('hidden');c.textContent=`${_sel.size} selected`;}else b.classList.add('hidden');}
  function selAll(){_sel=new Set(_filtered.map(e=>e.id));renderTable();updateBulk();}
  function clearSel(){_sel.clear();renderTable();updateBulk();}

  async function openForm(id=null) {
    const e=id?await DB.getById('expenses',id):null;
    Modal.open({
      title:e?'Edit Expense':'Add Expense', size:'sm',
      body:`
        <div class="field"><label>Description *</label><input id="ef-desc" value="${H.esc(e?.description||'')}" placeholder="What was this expense for?"/></div>
        <div class="form-2">
          <div class="field"><label>Category *</label>
            <select id="ef-cat">${CATEGORIES.map(c=>`<option ${(e?.category||'Other')===c?'selected':''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Amount (₱) *</label><input type="number" id="ef-amt" min="0" step="0.01" value="${e?.amount||''}"/></div>
        </div>
        <div class="field"><label>Date *</label><input type="date" id="ef-date" value="${H.toInput(e?.date||H.now())}"/></div>
        <div class="field"><label>Notes</label><textarea id="ef-notes" style="min-height:56px">${H.esc(e?.notes||'')}</textarea></div>`,
      foot:`<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
            <button class="btn btn-primary" onclick="Expenses.saveForm('${id||''}')">
              ${e?'Save Changes':'Add Expense'}</button>`
    });
  }

  async function saveForm(id) {
    const desc=(H.el('ef-desc')?.value||'').trim();
    const amt=H.num(H.el('ef-amt')?.value);
    const date=H.el('ef-date')?.value;
    if(!desc){Notify.err('Description is required.');return;}
    if(amt<=0){Notify.err('Amount must be greater than 0.');return;}
    if(!date){Notify.err('Date is required.');return;}
    const isNew=!id;
    const existing=id?await DB.getById('expenses',id):null;
    const rec={
      id:id||H.uid('exp'), description:desc,
      category:H.el('ef-cat')?.value||'Other',
      amount:amt, date, notes:(H.el('ef-notes')?.value||'').trim(),
      createdAt:existing?.createdAt||H.now(), updatedAt:H.now()
    };
    await DB.put('expenses',rec);
    await Logs.add(isNew?'create':'update',`${isNew?'Added':'Updated'} expense: ${desc}`);
    Modal.close();
    Notify.ok(`Expense "${desc}" ${isNew?'added':'updated'}.`);
    await render();
  }

  async function delOne(id) {
    const e=await DB.getById('expenses',id); if(!e) return;
    Modal.confirm({title:'Delete Expense',danger:true,message:`Delete "${e.description}"?`,confirmLabel:'Delete',
      onConfirm:async()=>{await DB.remove('expenses',id);await Logs.add('delete',`Deleted expense: ${e.description}`);Notify.ok('Expense deleted.');await render();}
    });
  }

  async function delSel() {
    if(!_sel.size) return;
    Modal.confirm({title:'Delete Selected Items',danger:true,message:`Delete ${_sel.size} expense(s)?`,confirmLabel:'Delete Selected Items',
      onConfirm:async()=>{await DB.bulkRemove('expenses',[..._sel]);Notify.ok(`${_sel.size} deleted.`);_sel.clear();await render();}
    });
  }

  async function exportCSV() {
    const h=['Description','Category','Amount','Date','Notes'];
    const r=_filtered.map(e=>[e.description,e.category,e.amount,e.date,e.notes||'']);
    H.dlFile(H.toCSV(r,h),`FCMS-Expenses-${Date.now()}.csv`,'text/csv');
    Notify.ok('Expenses exported.');
  }

  return {render,openForm,saveForm,delOne,delSel,selAll,clearSel,exportCSV};
})();
