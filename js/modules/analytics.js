'use strict';
const Analytics = (() => {

  async function render() {
    const [payments, commissions, clients, expenses] = await Promise.all([
      DB.getAll('payments'), DB.getAll('commissions'),
      DB.getAll('clients'), DB.getAll('expenses'),
    ]);

    const now  = new Date();
    const year = now.getFullYear();

    // --- Revenue by month (12 months)
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, i, 1);
      const label = d.toLocaleDateString('en-PH', { month: 'short' });
      const income = payments
        .filter(p => { const pd = new Date(p.date); return pd.getFullYear() === year && pd.getMonth() === i; })
        .reduce((s, p) => s + H.num(p.amount), 0);
      const exp = expenses
        .filter(e => { const ed = new Date(e.date); return ed.getFullYear() === year && ed.getMonth() === i; })
        .reduce((s, e) => s + H.num(e.amount), 0);
      return { label, income, expense: exp, profit: income - exp };
    });

    // --- Top clients
    const clMap = {}; clients.forEach(c => clMap[c.id] = c);
    const clientRevMap = {};
    payments.forEach(p => {
      clientRevMap[p.clientId] = (clientRevMap[p.clientId] || 0) + H.num(p.amount);
    });
    const topClients = Object.entries(clientRevMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, total]) => ({ name: clMap[id]?.name || '-', total }));

    // --- Expense by category
    const expCats = {};
    expenses.forEach(e => { expCats[e.category] = (expCats[e.category] || 0) + H.num(e.amount); });
    const totalExp  = Object.values(expCats).reduce((s, v) => s + v, 0);
    const expList   = Object.entries(expCats).sort((a, b) => b[1] - a[1]);

    // --- Service type revenue
    const svcRevMap = {};
    const commMap = {}; commissions.forEach(c => commMap[c.id] = c);
    payments.forEach(p => {
      const c = commMap[p.commissionId];
      if (!c) return;
      const svc = c.serviceType || 'Other';
      svcRevMap[svc] = (svcRevMap[svc] || 0) + H.num(p.amount);
    });
    const svcList = Object.entries(svcRevMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // --- Summary stats
    const totalIncome  = payments.reduce((s, p) => s + H.num(p.amount), 0);
    const totalExpense = expenses.reduce((s, e) => s + H.num(e.amount), 0);
    const netProfit    = totalIncome - totalExpense;
    const margin       = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;
    const avgComm      = commissions.length ? totalIncome / commissions.length : 0;
    const completionR  = commissions.length
      ? Math.round((commissions.filter(c => ['Completed','Delivered'].includes(c.status)).length / commissions.length) * 100) : 0;

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div class="pg-title-area">
          <div class="pg-title">Analytics</div>
          <div class="pg-sub">Business insights for ${year}</div>
        </div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Analytics.render()">↺ Refresh</button>
          <button class="btn btn-ghost btn-sm" onclick="Analytics.exportReport()" title="Downloads a spreadsheet file you can open in Excel or Google Sheets">Export to Excel</button>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi" style="--kpi-c:var(--green);--kpi-bg:var(--green-d)">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div>
          <div class="kpi-lbl">Total Revenue</div>
          <div class="kpi-val sm">${H.peso(totalIncome)}</div>
          <div class="kpi-foot">Year to date</div>
        </div>
        <div class="kpi" style="--kpi-c:var(--red);--kpi-bg:var(--red-d)">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg></div>
          <div class="kpi-lbl">Total Expenses</div>
          <div class="kpi-val sm" style="color:var(--red)">${H.peso(totalExpense)}</div>
          <div class="kpi-foot">Year to date</div>
        </div>
        <div class="kpi" style="--kpi-c:${netProfit>=0?'var(--a)':'var(--red)'};--kpi-bg:${netProfit>=0?'var(--a-d)':'var(--red-d)'}">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg></div>
          <div class="kpi-lbl">Net Profit</div>
          <div class="kpi-val sm" style="color:${netProfit>=0?'var(--green)':'var(--red)'}">${H.peso(netProfit)}</div>
          <div class="kpi-foot"><span class="kpi-delta ${margin>=0?'up':'dn'}">${margin}% margin</span></div>
        </div>
        <div class="kpi" style="--kpi-c:var(--purple);--kpi-bg:var(--purple-d)">
          <div class="kpi-icon-box"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg></div>
          <div class="kpi-lbl">Avg per Commission</div>
          <div class="kpi-val sm">${H.peso(avgComm)}</div>
          <div class="kpi-foot">${completionR}% completion rate</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:16px;margin-bottom:16px">
        <div class="card">
          <div class="card-label">Monthly Revenue vs Expenses (${year})</div>
          <div class="chart-box" style="height:200px"><canvas id="an-bar" height="200"></canvas></div>
        </div>
        <div class="card">
          <div class="card-label">Top Clients by Revenue</div>
          <div id="an-top-clients"></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div class="card-label">Expense Breakdown</div>
          <div id="an-exp-cats"></div>
        </div>
        <div class="card">
          <div class="card-label">Revenue by Service Type</div>
          <div id="an-svc-chart" style="height:180px;display:flex;align-items:center;justify-content:center">
            <canvas id="an-svc-donut" width="160" height="160"></canvas>
          </div>
          <div id="an-svc-legend" style="margin-top:10px"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Profit Overview (Monthly)</div>
        <div class="chart-box" style="height:140px"><canvas id="an-profit" height="140"></canvas></div>
      </div>`;

    // Render charts
    setTimeout(() => {
      _drawBarChart('an-bar', monthly);
      _drawTopClients('an-top-clients', topClients);
      _drawExpCats('an-exp-cats', expList, totalExp);
      _drawDonut('an-svc-donut', 'an-svc-legend', svcList);
      _drawProfitLine('an-profit', monthly);
    }, 40);
  }

  const COLORS = ['#4f8ef7','#34d399','#a78bfa','#fbbf24','#fb7185','#22d3ee','#f87171','#2dd4bf'];
  const isDark = () => document.documentElement.dataset.theme !== 'light';

  function _ctx(id) { const c = H.el(id); if (!c) return null; return c.getContext('2d'); }

  function _drawBarChart(id, monthly) {
    const canvas = H.el(id); if (!canvas) return;
    const W = canvas.offsetWidth || 500, H2 = 200;
    canvas.width = W; canvas.height = H2;
    const ctx = canvas.getContext('2d');
    const dark = isDark();
    const gridC = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    const textC = dark ? '#3d4a63' : '#adb5d0';
    const maxV  = Math.max(...monthly.flatMap(m => [m.income, m.expense]), 1);
    const pL = 58, pR = 10, pT = 14, pB = 32;
    const cW = W - pL - pR, cH = H2 - pT - pB;
    const bW = Math.max(6, cW / 12 / 3 - 2);
    const gap = cW / 12;

    ctx.clearRect(0, 0, W, H2);

    // Grid
    for (let i = 0; i <= 4; i++) {
      const y = pT + (cH / 4) * i;
      ctx.strokeStyle = gridC; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = textC; ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      const v = maxV * (1 - i / 4);
      ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toString(), pL - 5, y + 3);
    }

    monthly.forEach((m, i) => {
      const x = pL + gap * i + gap / 2;
      const drawBar = (val, color, offset) => {
        if (!val) return;
        const bH = (val / maxV) * cH;
        const bx = x + offset;
        const by = pT + cH - bH;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bW, bH, [3, 3, 0, 0]);
        else ctx.rect(bx, by, bW, bH);
        ctx.fill();
      };
      drawBar(m.income,  dark ? '#4f8ef7' : '#2563eb', -(bW + 1));
      drawBar(m.expense, dark ? '#f87171' : '#dc2626', 1);

      ctx.fillStyle = textC; ctx.font = '8px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(m.label, x, H2 - pB + 12);
    });

    // Legend
    const leg = [['Income','#4f8ef7'], ['Expense','#f87171']];
    leg.forEach(([l, c], i) => {
      ctx.fillStyle = c;
      ctx.fillRect(pL + i * 80, H2 - 6, 8, 8);
      ctx.fillStyle = textC;
      ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(l, pL + i * 80 + 11, H2 - 1);
    });
  }

  function _drawTopClients(id, top) {
    const el = H.el(id); if (!el) return;
    if (!top.length) { el.innerHTML = `<div class="empty"><div class="empty-ttl">No payment data</div></div>`; return; }
    const maxVal = top[0].total;
    el.innerHTML = top.map((c, i) => `
      <div class="top-client-row">
        <div class="top-client-rank">${i + 1}</div>
        <div class="top-client-name">${H.esc(H.trunc(c.name, 22))}</div>
        <div class="top-client-val">${H.peso(c.total)}</div>
      </div>
      <div class="prog" style="margin:-4px 0 8px 32px">
        <div class="prog-fill" style="width:${Math.round((c.total/maxVal)*100)}%;background:${COLORS[i%COLORS.length]}"></div>
      </div>`).join('');
  }

  function _drawExpCats(id, expList, totalExp) {
    const el = H.el(id); if (!el) return;
    if (!expList.length) { el.innerHTML = `<div class="empty"><div class="empty-ttl">No expenses</div></div>`; return; }
    el.innerHTML = expList.map(([cat, val], i) => `
      <div class="exp-cat-row">
        <div class="exp-cat-lbl">${H.esc(H.trunc(cat, 16))}</div>
        <div class="exp-cat-track">
          <div class="exp-cat-fill" style="width:${totalExp > 0 ? Math.round((val/totalExp)*100) : 0}%;background:${COLORS[i%COLORS.length]}"></div>
        </div>
        <div class="exp-cat-val">${H.peso(val)}</div>
      </div>`).join('');
  }

  function _drawDonut(canvasId, legendId, svcList) {
    const canvas = H.el(canvasId); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const total = svcList.reduce((s, [, v]) => s + v, 0);
    const dark  = isDark();
    canvas.width = 160; canvas.height = 160;
    if (!total) {
      ctx.fillStyle = dark ? '#1a1f2e' : '#edf0fb';
      ctx.beginPath(); ctx.arc(80, 80, 64, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark ? '#3d4a63' : '#adb5d0';
      ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('No data', 80, 80);
      return;
    }
    let angle = -Math.PI / 2;
    svcList.forEach(([, v], i) => {
      const slice = (v / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(80, 80); ctx.arc(80, 80, 64, angle, angle + slice); ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
      angle += slice;
    });
    ctx.beginPath(); ctx.arc(80, 80, 38, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#141820' : '#ffffff'; ctx.fill();

    const legend = H.el(legendId); if (!legend) return;
    legend.innerHTML = `<div class="s-legend">${svcList.map(([s, v], i) => `
      <div class="sl-row">
        <div class="sl-dot" style="background:${COLORS[i%COLORS.length]}"></div>
        <span class="sl-name">${H.esc(H.trunc(s,18))}</span>
        <span class="sl-val">${H.peso(v)}</span>
        <span class="sl-pct">${Math.round((v/total)*100)}%</span>
      </div>`).join('')}
    </div>`;
  }

  function _drawProfitLine(id, monthly) {
    const canvas = H.el(id); if (!canvas) return;
    const W = canvas.offsetWidth || 700, H2 = 140;
    canvas.width = W; canvas.height = H2;
    const ctx = canvas.getContext('2d');
    const dark   = isDark();
    const gridC  = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    const textC  = dark ? '#3d4a63' : '#adb5d0';
    const profits = monthly.map(m => m.profit);
    const minV = Math.min(...profits);
    const maxV = Math.max(...profits, 1);
    const range = maxV - minV || 1;
    const pL = 58, pR = 10, pT = 14, pB = 28;
    const cW = W - pL - pR, cH = H2 - pT - pB;

    ctx.clearRect(0, 0, W, H2);
    for (let i = 0; i <= 3; i++) {
      const y = pT + (cH / 3) * i;
      ctx.strokeStyle = gridC; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y); ctx.stroke();
      ctx.setLineDash([]);
      const v = maxV - (range / 3) * i;
      ctx.fillStyle = textC; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'right';
      ctx.fillText(v >= 1000 ? (v/1000).toFixed(1)+'k' : Math.round(v).toString(), pL - 5, y + 3);
    }

    // Zero line
    const zeroY = pT + ((maxV / range) * cH);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(pL, zeroY); ctx.lineTo(W - pR, zeroY); ctx.stroke();

    const pts = profits.map((v, i) => ({
      x: pL + (i / 11) * cW,
      y: pT + ((maxV - v) / range) * cH
    }));

    // Fill area
    ctx.beginPath(); ctx.moveTo(pts[0].x, zeroY);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, zeroY); ctx.closePath();
    const grad = ctx.createLinearGradient(0, pT, 0, pT + cH);
    grad.addColorStop(0, 'rgba(79,142,247,0.25)');
    grad.addColorStop(1, 'rgba(79,142,247,0.01)');
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#4f8ef7'; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.stroke();

    // Dots
    pts.forEach((p, i) => {
      const isPos = profits[i] >= 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = isPos ? '#34d399' : '#f87171'; ctx.fill();
    });

    // Labels
    monthly.forEach((m, i) => {
      ctx.fillStyle = textC; ctx.font = '8px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(m.label, pL + (i / 11) * cW, H2 - pB + 12);
    });
  }

  async function exportReport() {
    const [payments, commissions, clients, expenses] = await Promise.all([
      DB.getAll('payments'), DB.getAll('commissions'),
      DB.getAll('clients'), DB.getAll('expenses'),
    ]);
    const year = new Date().getFullYear();
    const rows = [
      ['FCMS Pro - Analytics Report', year, '', ''],
      ['', '', '', ''],
      ['Metric', 'Value', '', ''],
      ['Total Revenue', payments.reduce((s,p)=>s+H.num(p.amount),0), '', ''],
      ['Total Expenses', expenses.reduce((s,e)=>s+H.num(e.amount),0), '', ''],
      ['Total Clients', clients.length, '', ''],
      ['Total Commissions', commissions.length, '', ''],
      ['', '', '', ''],
      ['Client', 'Total Paid', 'Commissions', ''],
    ];
    const clMap = {}; clients.forEach(c => clMap[c.id] = c);
    const clPay = {};
    payments.forEach(p => { clPay[p.clientId] = (clPay[p.clientId] || 0) + H.num(p.amount); });
    const clComm = {};
    commissions.forEach(c => { clComm[c.clientId] = (clComm[c.clientId] || 0) + 1; });
    clients.forEach(c => rows.push([c.name, clPay[c.id]||0, clComm[c.id]||0, '']));
    H.dlFile(H.toCSV(rows, ['A','B','C','D']), `FCMS-Analytics-${year}.csv`, 'text/csv');
    Notify.ok('Analytics report exported.');
  }

  return { render, exportReport };
})();
