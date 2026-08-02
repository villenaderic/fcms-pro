'use strict';
const Dashboard = (() => {

  async function render() {
    const [clients, commissions, payments, expenses, logs] = await Promise.all([
      DB.getAll('clients'), DB.getAll('commissions'), DB.getAll('payments'),
      DB.getAll('expenses'), DB.getAll('logs'),
    ]);

    const now        = new Date();
    const thisM      = now.getMonth(), thisY = now.getFullYear();
    const totalInc   = payments.reduce((s,p)=>s+H.num(p.amount),0);
    const totalExp   = expenses.reduce((s,e)=>s+H.num(e.amount),0);
    const netProfit  = totalInc - totalExp;
    const pending    = commissions.reduce((s,c)=>s+H.num(c.remaining),0);
    const active     = commissions.filter(c=>['Pending','In Progress','Revision'].includes(c.status)).length;
    const completed  = commissions.filter(c=>['Delivered','Completed'].includes(c.status)).length;
    const monthly    = _monthly(payments, now);
    const statusData = _statusData(commissions);
    const clMap      = {}; clients.forEach(c=>clMap[c.id]=c);
    const deadlines  = _deadlines(commissions, clMap);
    const recentLogs = [...logs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,12);
    const overdue    = commissions.filter(c=>{
      const d=H.daysUntil(c.deadline);
      return d!==null && d<0 && !['Delivered','Cancelled'].includes(c.status);
    });
    const convRate   = commissions.length ? Math.round((completed/commissions.length)*100) : 0;
    const thisMonPay = payments.filter(p=>{ const d=new Date(p.date); return d.getMonth()===thisM && d.getFullYear()===thisY; });
    const thisMonInc = thisMonPay.reduce((s,p)=>s+H.num(p.amount),0);

    const greet = now.getHours()<12?'Good morning':now.getHours()<17?'Good afternoon':'Good evening';
    const biz   = Settings.get('businessName','');

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div class="pg-title-area">
          <div class="pg-title">${H.esc(greet)}${biz ? ', '+H.esc(biz) : ''}</div>
          <div class="pg-sub">${now.toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div>
        </div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Dashboard.render()">
            <svg viewBox="0 0 24 24" width="13" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            Refresh
          </button>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('analytics')">View Analytics →</button>
        </div>
      </div>

      ${overdue.length ? `
      <div class="overdue-alert">
        <span class="overdue-alert-ico">⚠</span>
        <div class="overdue-alert-txt">
          <strong>${overdue.length} overdue commission${overdue.length>1?'s':''}</strong>
          <span class="muted" style="margin-left:8px;font-size:.79rem">${overdue.slice(0,3).map(c=>H.esc(H.trunc(c.title,20))).join(', ')}${overdue.length>3?' …':''}</span>
        </div>
        <button class="btn btn-sm" style="border-color:var(--red);color:var(--red);margin-left:auto" onclick="App.navigate('commissions')">View All</button>
      </div>` : ''}

      <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi" style="--kpi-c:var(--a);--kpi-bg:var(--a-d)" onclick="App.navigate('clients')" style="cursor:pointer">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></div>
          <div class="kpi-lbl">Clients</div>
          <div class="kpi-val">${clients.length}</div>
          <div class="kpi-foot">${active} active work${active!==1?'s':''}</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--green);--kpi-bg:var(--green-d)" onclick="App.navigate('payments')" style="cursor:pointer">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div>
          <div class="kpi-lbl">Total Income</div>
          <div class="kpi-val sm">${H.peso(totalInc)}</div>
          <div class="kpi-foot"><span class="kpi-delta ${monthly.delta>=0?'up':'dn'}">${monthly.delta>=0?'▲':'▼'} ${H.peso(Math.abs(monthly.delta))}</span> vs last month</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--amber);--kpi-bg:var(--amber-d)" onclick="App.navigate('commissions')" style="cursor:pointer">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg></div>
          <div class="kpi-lbl">Pending Balance</div>
          <div class="kpi-val sm" style="color:var(--amber)">${H.peso(pending)}</div>
          <div class="kpi-foot">${commissions.filter(c=>c.remaining>0).length} unpaid</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--purple);--kpi-bg:var(--purple-d)">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg></div>
          <div class="kpi-lbl">This Month</div>
          <div class="kpi-val sm">${H.peso(thisMonInc)}</div>
          <div class="kpi-foot">${thisMonPay.length} payment${thisMonPay.length!==1?'s':''}</div>
        </div>
        <div class="kpi" style="--kpi-c:${netProfit>=0?'var(--green)':'var(--red)'};--kpi-bg:${netProfit>=0?'var(--green-d)':'var(--red-d)'}">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg></div>
          <div class="kpi-lbl">Net Profit</div>
          <div class="kpi-val sm" style="color:${netProfit>=0?'var(--green)':'var(--red)'}">${H.peso(netProfit)}</div>
          <div class="kpi-foot">${convRate}% completion rate</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--rose);--kpi-bg:var(--rose-d)" onclick="App.navigate('expenses')" style="cursor:pointer">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg></div>
          <div class="kpi-lbl">Total Expenses</div>
          <div class="kpi-val sm" style="color:var(--rose)">${H.peso(totalExp)}</div>
          <div class="kpi-foot">${expenses.length} record${expenses.length!==1?'s':''}</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--cyan);--kpi-bg:var(--cyan-d)" onclick="App.navigate('commissions')" style="cursor:pointer">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg></div>
          <div class="kpi-lbl">Completed</div>
          <div class="kpi-val">${completed}</div>
          <div class="kpi-foot">of ${commissions.length} total</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--red);--kpi-bg:var(--red-d)">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg></div>
          <div class="kpi-lbl">Overdue</div>
          <div class="kpi-val" style="color:${overdue.length>0?'var(--red)':'var(--green)'}">${overdue.length}</div>
          <div class="kpi-foot">${overdue.length>0?'Needs attention':'All on track ✔'}</div>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <div class="card-label">Quick Actions</div>
        <div class="qa-grid">
          <button class="qa-btn" onclick="App.navigate('commissions').then(()=>Commissions.openForm())">
            <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
            New Commission <span style="font-size:.69rem;opacity:.5;margin-left:auto;font-family:var(--mono)">NW</span>
          </button>
          <button class="qa-btn" onclick="App.navigate('clients').then(()=>Clients.openForm())">
            <svg viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            Add Client <span style="font-size:.69rem;opacity:.5;margin-left:auto;font-family:var(--mono)">NC</span>
          </button>
          <button class="qa-btn" onclick="App.navigate('payments').then(()=>Payments.openForm())">
            <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
            Record Payment <span style="font-size:.69rem;opacity:.5;margin-left:auto;font-family:var(--mono)">NP</span>
          </button>
          <button class="qa-btn" onclick="App.navigate('expenses').then(()=>Expenses.openForm())">
            <svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
            Log Expense <span style="font-size:.69rem;opacity:.5;margin-left:auto;font-family:var(--mono)">NE</span>
          </button>
        </div>
      </div>

      <div class="dash-grid">
        <div class="dash-col">
          <div class="card">
            <div class="card-label">Revenue - Last 6 Months</div>
            <div class="chart-box" style="height:190px"><canvas id="db-bar" height="190"></canvas></div>
          </div>
          <div class="card">
            <div class="card-label">Commission Status</div>
            <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
              <div style="flex-shrink:0"><canvas id="db-donut" width="130" height="130"></canvas></div>
              <div class="s-legend" id="db-legend" style="flex:1;min-width:120px"></div>
            </div>
          </div>
        </div>
        <div class="dash-col">
          <div class="card" style="max-height:300px;overflow-y:auto">
            <div class="card-label">Upcoming Deadlines</div>
            <div id="db-deadlines"></div>
          </div>
          <div class="card" style="max-height:260px;overflow-y:auto">
            <div class="card-label">Recent Activity</div>
            <div id="db-activity"></div>
          </div>
        </div>
      </div>`;

    setTimeout(() => {
      _drawBar(monthly);
      _drawDonut(statusData);
      _renderDeadlines(deadlines, clMap);
      _renderActivity(recentLogs);
    }, 30);
  }

  function _monthly(payments, now) {
    const labels = [], values = [];
    let thisMonth = 0, lastMonth = 0;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' }));
      const t = payments.filter(p => {
        const pd = new Date(p.date);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      }).reduce((s, p) => s + H.num(p.amount), 0);
      values.push(t);
      if (i === 0) thisMonth = t;
      if (i === 1) lastMonth = t;
    }
    return { labels, values, thisMonth, lastMonth, delta: thisMonth - lastMonth };
  }

  function _statusData(comms) {
    const colors = { 'Pending':'#fbbf24','In Progress':'#4f8ef7','Revision':'#a78bfa','Completed':'#34d399','Delivered':'#22d3ee','Cancelled':'#f87171' };
    const counts = {}; Object.keys(colors).forEach(s => counts[s] = 0);
    comms.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
    return { counts, colors };
  }

  function _deadlines(comms, clMap) {
    return comms
      .filter(c => c.deadline && !['Delivered','Cancelled'].includes(c.status))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 8)
      .map(c => ({ ...c, clientName: clMap[c.clientId]?.name || '-' }));
  }

  function _drawBar(monthly) {
    const canvas = H.el('db-bar'); if (!canvas) return;
    const W = canvas.offsetWidth || 460, H2 = 190;
    canvas.width = W; canvas.height = H2;
    const ctx = canvas.getContext('2d');
    const dark  = document.documentElement.dataset.theme !== 'light';
    const gridC = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    const textC = dark ? '#3d4a63' : '#adb5d0';
    const vals  = monthly.values;
    const max   = Math.max(...vals, 1);
    const pL = 54, pR = 10, pT = 14, pB = 30;
    const cW = W - pL - pR, cH = H2 - pT - pB;
    const bW = Math.min(30, cW / vals.length - 10);
    const gap = cW / vals.length;

    ctx.clearRect(0, 0, W, H2);
    for (let i = 0; i <= 4; i++) {
      const y = pT + (cH / 4) * i;
      ctx.strokeStyle = gridC; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = textC; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'right';
      const v = max * (1 - i / 4);
      ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v), pL - 5, y + 3);
    }

    vals.forEach((val, i) => {
      const bH = val > 0 ? (val / max) * cH : 3;
      const x  = pL + gap * i + gap / 2 - bW / 2;
      const y  = pT + cH - bH;
      const isThis = i === vals.length - 1;
      const grad = ctx.createLinearGradient(0, y, 0, y + bH);
      grad.addColorStop(0, isThis ? '#4f8ef7' : (dark ? 'rgba(79,142,247,0.6)' : 'rgba(37,99,235,0.5)'));
      grad.addColorStop(1, dark ? 'rgba(79,142,247,0.15)' : 'rgba(37,99,235,0.12)');
      ctx.fillStyle = isThis ? '#4f8ef7' : grad;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, bW, bH, [3, 3, 0, 0]);
      else ctx.rect(x, y, bW, bH);
      ctx.fill();
      ctx.fillStyle = textC; ctx.font = '8px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(monthly.labels[i], x + bW / 2, H2 - pB + 12);
      if (val > 0) {
        ctx.fillStyle = isThis ? '#4f8ef7' : textC;
        ctx.font = `${isThis ? 'bold ' : ''}8px JetBrains Mono, monospace`;
        ctx.fillText(val >= 1000 ? (val/1000).toFixed(1)+'k' : Math.round(val), x + bW/2, y - 3);
      }
    });
  }

  function _drawDonut(sd) {
    const canvas = H.el('db-donut'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 130; canvas.height = 130;
    const entries = Object.entries(sd.counts).filter(([,v])=>v>0);
    const total   = entries.reduce((s,[,v])=>s+v,0);
    const dark    = document.documentElement.dataset.theme !== 'light';

    if (!total) {
      ctx.fillStyle = dark ? '#1a1f2e' : '#edf0fb';
      ctx.beginPath(); ctx.arc(65,65,52,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = dark ? '#3d4a63' : '#adb5d0';
      ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('No data', 65, 65); return;
    }

    let angle = -Math.PI / 2;
    entries.forEach(([s, v]) => {
      const slice = (v / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(65,65); ctx.arc(65,65,52,angle,angle+slice); ctx.closePath();
      ctx.fillStyle = sd.colors[s] || '#888'; ctx.fill();
      angle += slice;
    });
    ctx.beginPath(); ctx.arc(65,65,30,0,Math.PI*2);
    ctx.fillStyle = dark ? '#141820' : '#ffffff'; ctx.fill();
    ctx.fillStyle = dark ? '#eef2ff' : '#111827';
    ctx.font = 'bold 14px JetBrains Mono, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(total, 65, 65);

    const legend = H.el('db-legend'); if (!legend) return;
    legend.innerHTML = entries.map(([s,v]) => `
      <div class="sl-row">
        <div class="sl-dot" style="background:${sd.colors[s]}"></div>
        <span class="sl-name">${H.esc(s)}</span>
        <span class="sl-val">${v}</span>
        <span class="sl-pct">${Math.round(v/total*100)}%</span>
      </div>`).join('');
  }

  function _renderDeadlines(deadlines, clMap) {
    const el = H.el('db-deadlines'); if (!el) return;
    if (!deadlines.length) {
      el.innerHTML = `<div class="empty"><div class="empty-ttl">No deadlines</div><div class="empty-sub">All clear!</div></div>`;
      return;
    }
    el.innerHTML = deadlines.map(c => {
      const d   = H.daysUntil(c.deadline);
      const cls = d !== null && d < 0 ? 'u' : d !== null && d <= 3 ? 'u' : d !== null && d <= 7 ? 'w' : 'n';
      const lbl = d === null ? '?' : d < 0 ? 'OVR' : d === 0 ? 'NOW' : d;
      return `<div class="dl-item" onclick="App.navigate('commissions')" title="Click to view commissions">
        <div class="dl-badge ${cls}">
          <span class="dl-n">${lbl}</span>
          ${typeof lbl === 'number' ? '<span class="dl-u">days</span>' : ''}
        </div>
        <div class="dl-info">
          <div class="dl-title">${H.esc(H.trunc(c.title,28))}</div>
          <div class="dl-client">${H.esc(c.clientName)} · ${H.fmtDate(c.deadline)}</div>
        </div>
        ${H.chip(c.status)}
      </div>`;
    }).join('');
  }

  function _renderActivity(logs) {
    const el = H.el('db-activity'); if (!el) return;
    if (!logs.length) {
      el.innerHTML = `<div class="empty"><div class="empty-ttl">No activity yet</div></div>`;
      return;
    }
    el.innerHTML = logs.map(l => `
      <div class="act-item">
        <div class="act-dot ${l.type}"></div>
        <div style="flex:1">
          <div class="act-text">${H.esc(l.message)}</div>
          <div class="act-time">${H.fmtDT(l.timestamp)}</div>
        </div>
      </div>`).join('');
  }

  return { render };
})();
