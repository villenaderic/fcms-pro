'use strict';
const Logs = (() => {
  const TYPES = ['create','update','delete','login','backup','restore'];
  const PER = 30;
  let _all=[], _filtered=[], _page=1;

  async function add(type, message) {
    await DB.put('logs', { id: H.uid('log'), type: TYPES.includes(type)?type:'update', message, timestamp: H.now() });
  }

  async function render() {
    _all = await DB.getAll('logs');
    _all.sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp));
    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div><div class="pg-title">Activity Logs</div><div class="pg-sub">${_all.length} entries</div></div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Logs.exportCSV()" title="Downloads a spreadsheet file you can open in Excel or Google Sheets">Export to Excel</button>
          <button class="btn btn-danger btn-sm" onclick="Logs.clearAll()">Clear Logs</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="tb-s"><input id="log-q" placeholder="Search messages…"/></div>
        <select id="log-type">
          <option value="">All Types</option>
          ${TYPES.map(t=>`<option>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div id="log-list"></div>
      </div>
      <div id="log-pager" class="pager"></div>`;
    H.el('log-q').addEventListener('input', H.debounce(()=>{_page=1;applyFilter()},250));
    H.el('log-type').addEventListener('change', ()=>{_page=1;applyFilter()});
    applyFilter();
  }

  function applyFilter() {
    const q=(H.el('log-q')?.value||'').trim().toLowerCase();
    const t=(H.el('log-type')?.value||'').toLowerCase();
    let list=[..._all];
    if(t) list=list.filter(l=>l.type===t);
    if(q) list=list.filter(l=>(l.message||'').toLowerCase().includes(q));
    _filtered=list; renderList();
  }

  function renderList() {
    const {items,pages}=H.paginate(_filtered,_page,PER);
    const el=H.el('log-list'); if(!el) return;
    if(!items.length){el.innerHTML=`<div class="empty"><svg class="empty-ico" viewBox="0 0 24 24"><path d="M13 2.05V4.07c3.39.49 6 3.39 6 6.93 0 3.21-1.81 6-4.72 7.28L13 17v2.95c4.01-.5 7-3.85 7-7.88 0-4.1-2.91-7.56-7-8.02zM11 2.06C6.87 2.51 4 5.98 4 10c0 4.04 2.99 7.44 7 7.94V15.9c-2.84-.48-5-2.95-5-5.9 0-2.94 2.16-5.42 5-5.9V2.06z"/></svg><div class="empty-ttl">No logs found</div></div>`;return;}
    el.innerHTML=items.map(l=>`
      <div class="dr">
        <span class="chip ch-${l.type}">${l.type}</span>
        <span class="semi" style="font-size:.83rem;flex:1">${H.esc(l.message)}</span>
        <span class="muted mono" style="font-size:.71rem;flex-shrink:0">${H.fmtDT(l.timestamp)}</span>
      </div>`).join('');
    H.renderPager('log-pager',_page,pages,p=>{_page=p;renderList()});
  }

  function clearAll() {
    Modal.confirm({
      title:'Clear All Logs', danger:true,
      message:'Delete all activity log entries permanently?',
      confirmLabel:'Clear All Logs',
      onConfirm: async()=>{
        await DB.clear('logs');
        await add('update','Activity logs cleared');
        Notify.ok('Logs cleared.');
        await render();
      }
    });
  }

  async function exportCSV() {
    const h=['Type','Message','Timestamp'];
    const r=_filtered.map(l=>[l.type,l.message,H.fmtDT(l.timestamp)]);
    H.dlFile(H.toCSV(r,h),`FCMS-Logs-${Date.now()}.csv`,'text/csv');
    Notify.ok('Logs exported.');
  }

  return {add,render,clearAll,exportCSV};
})();
