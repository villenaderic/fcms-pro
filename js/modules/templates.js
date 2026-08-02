'use strict';
/* Commission Templates - save reusable work packages */
const Templates = (() => {
  const DEFAULT_TEMPLATES = [
    { name:'Logo Package',   serviceType:'Logo Design',      price:3500,  deadline:7,  description:'Primary logo + variations + brand guidelines' },
    { name:'UI Design',      serviceType:'UI/UX Design',     price:8000,  deadline:14, description:'Wireframes, mockups, and interactive prototype' },
    { name:'Website (5pg)', serviceType:'Web Development',  price:15000, deadline:21, description:'5-page responsive website with CMS' },
    { name:'Illustration',   serviceType:'Illustration',     price:2500,  deadline:5,  description:'Single digital illustration with revisions' },
    { name:'Social Pack',    serviceType:'Social Media',     price:4000,  deadline:7,  description:'10 social media posts + cover designs' },
    { name:'Brand Identity', serviceType:'Branding',         price:12000, deadline:21, description:'Full brand identity: logo, colors, typography, usage guide' },
    { name:'Short Video',    serviceType:'Video Editing',    price:5000,  deadline:10, description:'60–90 second edited video with transitions and audio' },
    { name:'Copywriting',    serviceType:'Copywriting',      price:3000,  deadline:5,  description:'Website copy (5 pages) with SEO optimization' },
  ];

  async function render() {
    const all = await DB.getAll('templates');
    const templates = all.length ? all : DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: `tmpl_default_${i}`, isDefault: true, createdAt: H.now() }));

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div>
          <div class="pg-title">Commission Templates</div>
          <div class="pg-sub">${templates.length} template${templates.length !== 1 ? 's' : ''} · Quickly start new commissions</div>
        </div>
        <div class="pg-acts">
          <button class="btn btn-ghost btn-sm" onclick="Templates.resetDefaults()">↺ Reset Defaults</button>
          <button class="btn btn-primary" onclick="Templates.openForm()">+ New Template</button>
        </div>
      </div>
      <div class="tmpl-grid" id="tmpl-grid"></div>`;

    const grid = H.el('tmpl-grid'); if (!grid) return;
    grid.innerHTML = templates.map(t => `
      <div class="tmpl-card" onclick="Templates.useTemplate('${t.id}')">
        <div class="tmpl-card-name">${H.esc(t.name)}</div>
        <div class="tmpl-card-svc">${H.esc(t.serviceType)}</div>
        ${t.description ? `<div style="font-size:.77rem;color:var(--t3);margin-bottom:8px;line-height:1.4">${H.esc(H.trunc(t.description, 60))}</div>` : ''}
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
          <span class="tmpl-card-price">${H.peso(t.price)}</span>
          <span style="font-size:.72rem;color:var(--t3);font-family:var(--mono)">${t.deadline}d deadline</span>
        </div>
        <div style="display:flex;gap:5px;margin-top:10px" onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-xs" onclick="Templates.useTemplate('${t.id}')">Use</button>
          <button class="btn btn-ghost btn-xs" onclick="Templates.openForm('${t.id}')">Edit</button>
          ${!t.isDefault ? `<button class="btn btn-danger btn-xs" onclick="Templates.delOne('${t.id}')">Delete</button>` : ''}
        </div>
      </div>`).join('');
  }

  async function openForm(id = null) {
    const t = id ? (await DB.getAll('templates')).find(x => x.id === id) : null;
    Modal.open({
      title: t ? 'Edit Template' : 'New Template',
      body: `
        <div class="form-2">
          <div class="field"><label>Template Name <span class="req">*</span></label>
            <input id="tf-name" value="${H.esc(t?.name || '')}" placeholder="Logo Package"/></div>
          <div class="field"><label>Service Type</label>
            <input id="tf-svc" value="${H.esc(t?.serviceType || '')}" list="tf-svc-list" placeholder="Logo Design"/>
            <datalist id="tf-svc-list">${Settings.get('serviceTypes', []).map(s => `<option value="${H.esc(s)}">`).join('')}</datalist>
          </div>
        </div>
        <div class="form-2">
          <div class="field"><label>Default Price (₱)</label>
            <input type="number" id="tf-price" min="0" step="0.01" value="${t?.price || ''}"/></div>
          <div class="field"><label>Default Deadline (days from today)</label>
            <input type="number" id="tf-deadline" min="1" value="${t?.deadline || 7}"/></div>
        </div>
        <div class="field"><label>Description / Scope</label>
          <textarea id="tf-desc" style="min-height:72px" placeholder="What's included in this service package…">${H.esc(t?.description || '')}</textarea></div>
        <div class="field"><label>Default Down Payment (₱)</label>
          <input type="number" id="tf-down" min="0" step="0.01" value="${t?.downPayment || ''}"/></div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-primary" onclick="Templates.saveForm('${id || ''}')">Save Template</button>`
    });
  }

  async function saveForm(id) {
    const name = (H.el('tf-name')?.value || '').trim();
    if (!name) { Notify.err('Template name is required.'); return; }
    const all    = await DB.getAll('templates');
    const existing = id ? all.find(t => t.id === id) : null;
    const rec = {
      id: id || H.uid('tmpl'), name,
      serviceType: (H.el('tf-svc')?.value || '').trim(),
      price:       H.num(H.el('tf-price')?.value),
      deadline:    Math.max(1, parseInt(H.el('tf-deadline')?.value || '7')),
      description: (H.el('tf-desc')?.value || '').trim(),
      downPayment: H.num(H.el('tf-down')?.value),
      createdAt:   existing?.createdAt || H.now(),
      updatedAt:   H.now()
    };
    await DB.put('templates', rec);
    await Logs.add('create', `${id ? 'Updated' : 'Created'} template: ${name}`);
    Modal.close();
    Notify.ok(`Template "${name}" saved.`);
    await render();
  }

  async function useTemplate(id) {
    const all = await DB.getAll('templates');
    const t   = all.find(x => x.id === id);
    if (!t) { Notify.err('Template not found.'); return; }
    const deadline = t.deadline ? new Date(Date.now() + t.deadline * 86400000).toISOString().split('T')[0] : '';
    Modal.close();
    App.navigate('commissions').then(() => Commissions.openFormWithData({
      title:       t.name,
      serviceType: t.serviceType,
      price:       t.price,
      downPayment: t.downPayment,
      deadline,
      description: t.description
    }));
  }

  async function delOne(id) {
    Modal.confirm({
      title: 'Delete Template', danger: true,
      message: 'Delete this template? It cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await DB.remove('templates', id);
        Notify.ok('Template deleted.');
        await render();
      }
    });
  }

  async function resetDefaults() {
    Modal.confirm({
      title: 'Reset Default Templates',
      message: 'This will restore all default templates. Your custom templates will remain.',
      confirmLabel: 'Reset Defaults',
      onConfirm: async () => {
        const all     = await DB.getAll('templates');
        const customs = all.filter(t => !t.isDefault);
        const defaults = DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: `tmpl_default_${i}`, isDefault: true, createdAt: H.now() }));
        await DB.clear('templates');
        await DB.bulkPut('templates', [...defaults, ...customs]);
        Notify.ok('Default templates restored.');
        await render();
      }
    });
  }

  return { render, openForm, saveForm, useTemplate, delOne, resetDefaults };
})();
