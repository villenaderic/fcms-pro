'use strict';
/* Financial Goals - monthly/yearly income targets with progress */
const Goals = (() => {

  async function render() {
    const [payments, expenses, goals] = await Promise.all([
      DB.getAll('payments'), DB.getAll('expenses'), DB.getAll('goals')
    ]);
    const now   = new Date();
    const thisY = now.getFullYear();
    const thisM = now.getMonth();

    const incY = payments.filter(p => new Date(p.date).getFullYear() === thisY).reduce((s, p) => s + H.num(p.amount), 0);
    const incM = payments.filter(p => {
      const d = new Date(p.date); return d.getFullYear() === thisY && d.getMonth() === thisM;
    }).reduce((s, p) => s + H.num(p.amount), 0);
    const expY = expenses.filter(e => new Date(e.date).getFullYear() === thisY).reduce((s, e) => s + H.num(e.amount), 0);
    const expM = expenses.filter(e => {
      const d = new Date(e.date); return d.getFullYear() === thisY && d.getMonth() === thisM;
    }).reduce((s, e) => s + H.num(e.amount), 0);

    const monthlyGoal  = goals.find(g => g.type === 'monthly')?.amount  || 0;
    const yearlyGoal   = goals.find(g => g.type === 'yearly')?.amount   || 0;
    const expBudgetM   = goals.find(g => g.type === 'exp_monthly')?.amount || 0;
    const expBudgetY   = goals.find(g => g.type === 'exp_yearly')?.amount  || 0;

    const mPct = monthlyGoal > 0 ? Math.min(100, Math.round((incM / monthlyGoal) * 100)) : 0;
    const yPct = yearlyGoal  > 0 ? Math.min(100, Math.round((incY / yearlyGoal)  * 100)) : 0;
    const emPct = expBudgetM > 0 ? Math.min(100, Math.round((expM / expBudgetM) * 100)) : 0;
    const eyPct = expBudgetY > 0 ? Math.min(100, Math.round((expY / expBudgetY) * 100)) : 0;

    // Month-by-month income bars (last 6)
    const monthly6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(thisY, thisM - (5 - i), 1);
      const inc = payments.filter(p => {
        const pd = new Date(p.date); return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      }).reduce((s, p) => s + H.num(p.amount), 0);
      return { label: d.toLocaleDateString('en-PH', { month: 'short' }), inc };
    });

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div>
          <div class="pg-title">Financial Goals</div>
          <div class="pg-sub">Track your income targets and expense budgets</div>
        </div>
        <div class="pg-acts">
          <button class="btn btn-primary" onclick="Goals.openForm()">Set Goals</button>
        </div>
      </div>

      <div class="month-goal-wrap" style="margin-bottom:20px">
        <div class="fin-goal">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div class="kpi-lbl">Monthly Income Goal</div>
              <div style="font-size:1.2rem;font-weight:800;font-family:var(--mono)">${H.peso(incM)}</div>
              <div class="muted" style="font-size:.76rem">of ${H.peso(monthlyGoal || 0)} target</div>
            </div>
            <div style="font-size:1.6rem;font-weight:800;font-family:var(--mono);color:${mPct>=100?'var(--green)':mPct>=70?'var(--a)':'var(--amber)'}">${mPct}%</div>
          </div>
          <div class="goal-bar"><div class="goal-fill" style="width:${mPct}%;background:${mPct>=100?'var(--green)':mPct>=70?'var(--a)':'var(--amber)'}"></div></div>
          <div style="font-size:.72rem;color:var(--t3);margin-top:4px">${monthlyGoal > 0 ? H.peso(Math.max(0, monthlyGoal - incM)) + ' remaining this month' : 'No goal set - click "Set Goals"'}</div>
        </div>
        <div class="fin-goal">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div class="kpi-lbl">Yearly Income Goal (${thisY})</div>
              <div style="font-size:1.2rem;font-weight:800;font-family:var(--mono)">${H.peso(incY)}</div>
              <div class="muted" style="font-size:.76rem">of ${H.peso(yearlyGoal || 0)} target</div>
            </div>
            <div style="font-size:1.6rem;font-weight:800;font-family:var(--mono);color:${yPct>=100?'var(--green)':yPct>=70?'var(--a)':'var(--amber)'}">${yPct}%</div>
          </div>
          <div class="goal-bar"><div class="goal-fill" style="width:${yPct}%;background:${yPct>=100?'var(--green)':yPct>=70?'var(--a)':'var(--amber)'}"></div></div>
          <div style="font-size:.72rem;color:var(--t3);margin-top:4px">${yearlyGoal > 0 ? H.peso(Math.max(0, yearlyGoal - incY)) + ' remaining this year' : 'No goal set'}</div>
        </div>
      </div>

      <div class="month-goal-wrap" style="margin-bottom:20px">
        <div class="fin-goal" style="border-top-color:var(--red)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div class="kpi-lbl">Monthly Expense Budget</div>
              <div style="font-size:1.2rem;font-weight:800;font-family:var(--mono);color:var(--red)">${H.peso(expM)}</div>
              <div class="muted" style="font-size:.76rem">of ${H.peso(expBudgetM || 0)} budget</div>
            </div>
            <div style="font-size:1.6rem;font-weight:800;font-family:var(--mono);color:${emPct>=100?'var(--red)':emPct>=80?'var(--amber)':'var(--green)'}">${emPct}%</div>
          </div>
          <div class="goal-bar"><div class="goal-fill" style="width:${emPct}%;background:${emPct>=100?'var(--red)':emPct>=80?'var(--amber)':'var(--green)'}"></div></div>
          <div style="font-size:.72rem;color:var(--t3);margin-top:4px">${expBudgetM > 0 ? (emPct >= 100 ? '⚠ Over budget by ' + H.peso(expM - expBudgetM) : H.peso(Math.max(0, expBudgetM - expM)) + ' left in budget') : 'No budget set'}</div>
        </div>
        <div class="fin-goal" style="border-top-color:var(--purple)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div class="kpi-lbl">Net Profit This Year</div>
              <div style="font-size:1.2rem;font-weight:800;font-family:var(--mono);color:${incY-expY>=0?'var(--green)':'var(--red)'}">${H.peso(incY - expY)}</div>
              <div class="muted" style="font-size:.76rem">${H.peso(incY)} income − ${H.peso(expY)} expenses</div>
            </div>
            <div style="font-size:1.6rem;font-weight:800;font-family:var(--mono);color:var(--purple)">
              ${incY > 0 ? Math.round(((incY - expY) / incY) * 100) : 0}%
            </div>
          </div>
          <div class="goal-bar"><div class="goal-fill" style="width:${incY > 0 ? Math.min(100, Math.round(((incY-expY)/incY)*100)) : 0}%;background:var(--purple)"></div></div>
          <div class="muted" style="font-size:.72rem;margin-top:4px">Profit margin</div>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Monthly Income - Last 6 Months</div>
        <div style="display:flex;align-items:flex-end;gap:8px;height:100px;padding-top:8px" id="goals-mini-chart">
          ${(() => {
            const max = Math.max(...monthly6.map(m => m.inc), 1);
            return monthly6.map((m, i) => {
              const pct = Math.round((m.inc / max) * 100);
              const isLast = i === 5;
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="font-size:.68rem;font-family:var(--mono);color:var(--t3)">${m.inc >= 1000 ? (m.inc/1000).toFixed(1)+'k' : Math.round(m.inc)}</div>
                <div style="flex:1;width:100%;display:flex;align-items:flex-end">
                  <div style="width:100%;height:${pct}%;min-height:3px;background:${isLast ? 'var(--a)' : 'var(--border)'};border-radius:3px 3px 0 0;transition:height .4s"></div>
                </div>
                <div style="font-size:.68rem;color:var(--t3)">${m.label}</div>
              </div>`;
            }).join('');
          })()}
        </div>
      </div>`;
  }

  async function openForm() {
    const goals = await DB.getAll('goals');
    const getGoal = type => goals.find(g => g.type === type)?.amount || '';
    Modal.open({
      title: 'Set Financial Goals', size: 'sm',
      body: `
        <div class="note-block" style="margin-bottom:14px">Set targets to track your freelance income and control expenses.</div>
        <div class="card-label">Income Targets</div>
        <div class="form-2">
          <div class="field"><label>Monthly Income Goal (₱)</label>
            <input type="number" id="g-monthly" min="0" step="100" value="${getGoal('monthly')}" placeholder="30000"/></div>
          <div class="field"><label>Yearly Income Goal (₱)</label>
            <input type="number" id="g-yearly" min="0" step="1000" value="${getGoal('yearly')}" placeholder="360000"/></div>
        </div>
        <div class="card-label" style="margin-top:8px">Expense Budgets</div>
        <div class="form-2">
          <div class="field"><label>Monthly Expense Budget (₱)</label>
            <input type="number" id="g-expm" min="0" step="100" value="${getGoal('exp_monthly')}" placeholder="10000"/></div>
          <div class="field"><label>Yearly Expense Budget (₱)</label>
            <input type="number" id="g-expy" min="0" step="1000" value="${getGoal('exp_yearly')}" placeholder="120000"/></div>
        </div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-primary" onclick="Goals.saveForm()">Save Goals</button>`
    });
  }

  async function saveForm() {
    const goalsToSave = [
      { id: 'goal_monthly',  type: 'monthly',     amount: H.num(H.el('g-monthly')?.value) },
      { id: 'goal_yearly',   type: 'yearly',      amount: H.num(H.el('g-yearly')?.value)  },
      { id: 'goal_expm',     type: 'exp_monthly', amount: H.num(H.el('g-expm')?.value)    },
      { id: 'goal_expy',     type: 'exp_yearly',  amount: H.num(H.el('g-expy')?.value)    },
    ].filter(g => g.amount > 0);
    await DB.bulkPut('goals', goalsToSave);
    await Logs.add('update', 'Financial goals updated');
    Modal.close();
    Notify.ok('Goals saved.');
    await render();
  }

  return { render, openForm, saveForm };
})();
