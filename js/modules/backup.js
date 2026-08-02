'use strict';
const Backup = (() => {
  const STORES = ['clients','commissions','payments','receipts','expenses','invoices','quotes','templates','goals','logs'];

  async function render() {
    const counts = await Promise.all(STORES.map(async s => {
      const all = await DB.getAll(s).catch(() => []);
      return { store: s, count: all.length };
    }));
    const totalRecords = counts.reduce((t, c) => t + c.count, 0);
    const lastBackup   = localStorage.getItem('fcms_last_backup') || null;
    const autoEnabled  = localStorage.getItem('fcms_auto_backup') === 'true';

    H.el('page-content').innerHTML = `
      <div class="pg-head">
        <div><div class="pg-title">Backup &amp; Restore</div>
          <div class="pg-sub">${totalRecords.toLocaleString()} total records across ${STORES.length} stores</div>
        </div>
        <div class="pg-acts">
          <button class="btn btn-primary" onclick="Backup.exportAll()">↓ Export Full Backup</button>
        </div>
      </div>

      ${lastBackup ? `<div class="note-block" style="margin-bottom:16px">Last backup: <strong>${H.fmtDT(lastBackup)}</strong></div>` : `<div style="background:var(--amber-d);border:1px solid rgba(251,191,36,.3);border-radius:var(--r2);padding:10px 14px;font-size:.82rem;margin-bottom:16px;">⚠ No backup has been made yet. Export a backup now to protect your data.</div>`}

      <div class="bk-grid" style="margin-bottom:20px">
        <div class="bk-tile">
          <h3>📦 Full System Backup</h3>
          <p>Export every record - clients, commissions, payments, receipts, expenses, invoices, quotes, templates, and logs - as a single JSON file. Use this to migrate to a new device.</p>
          <button class="btn btn-primary btn-sm" onclick="Backup.exportAll()">Export Backup (.json)</button>
        </div>
        <div class="bk-tile">
          <h3>📥 Restore from Backup</h3>
          <p>Import a previously exported FCMS backup file (.json). Existing data can be merged or replaced. Always export a backup first before restoring.</p>
          <button class="btn btn-ghost btn-sm" onclick="Backup.importBackup()">Import Backup</button>
        </div>
        <div class="bk-tile">
          <h3>📊 Export Data as CSV</h3>
          <p>Export individual data stores as CSV spreadsheets for use in Excel or Google Sheets. Choose which data to export.</p>
          <button class="btn btn-ghost btn-sm" onclick="Backup.exportCSVMenu()">Export CSV</button>
        </div>
        <div class="bk-tile">
          <h3>🔄 Auto-Backup Reminder</h3>
          <p>Enable a browser reminder to export your backup periodically. FCMS stores data locally - regular exports protect against data loss.</p>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:.83rem">
              <input type="checkbox" id="auto-bk" ${autoEnabled ? 'checked' : ''} onchange="Backup.toggleAuto(this.checked)" style="accent-color:var(--a);width:15px;height:15px"/>
              Remind me every 7 days
            </label>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-label">Data Store Summary</div>
        <div class="tbl-wrap">
          <table class="tbl-compact">
            <thead><tr><th>Store</th><th>Records</th><th>Actions</th></tr></thead>
            <tbody>
              ${counts.map(c => `<tr>
                <td style="font-weight:600;text-transform:capitalize">${c.store}</td>
                <td class="mono" style="color:${c.count > 0 ? 'var(--green)' : 'var(--t3)'}">${c.count.toLocaleString()}</td>
                <td class="td-acts">
                  <button class="btn btn-ghost btn-xs" onclick="Backup.exportStore('${c.store}')">Export CSV</button>
                  ${c.count > 0 ? `<button class="btn btn-danger btn-xs" onclick="Backup.clearStore('${c.store}')">Clear</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td style="font-weight:800">Total</td><td class="mono bold">${totalRecords.toLocaleString()}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  }

  async function exportAll() {
    const btn = document.querySelector('[onclick="Backup.exportAll()"]');
    if (btn) { btn.textContent = 'Exporting…'; btn.disabled = true; }
    try {
      const data = { _meta: { exportedAt: new Date().toISOString(), version: 4, app: 'FCMS Pro' } };
      await Promise.all(STORES.map(async s => { data[s] = await DB.getAll(s).catch(() => []); }));
      data.settings = localStorage.getItem('fcms_settings') || '{}';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      H.dlFile(JSON.stringify(data, null, 2), `FCMS-Backup-${ts}.json`, 'application/json');
      localStorage.setItem('fcms_last_backup', new Date().toISOString());
      await Logs.add('backup', `Full backup exported - ${Object.values(data).filter(Array.isArray).reduce((s, a) => s + a.length, 0)} records`);
      Notify.ok('Backup exported successfully.');
    } catch(e) { Notify.err('Export failed: ' + e.message); }
    finally { if (btn) { btn.textContent = 'Export Backup (.json)'; btn.disabled = false; } }
  }

  async function importBackup() {
    Modal.open({
      title: 'Import Backup', size: 'sm',
      body: `
        <div class="note-block" style="margin-bottom:14px">Select a .json backup file exported from FCMS Pro.</div>
        <div class="upload-zone" onclick="H.el('bk-file').click()" id="bk-drop">
          <div class="upload-zone-ico">📂</div>
          <div class="upload-zone-txt">Click to select backup file</div>
          <div class="upload-zone-sub">.json files only</div>
          <input type="file" id="bk-file" accept=".json" style="display:none" onchange="Backup.previewImport(this)"/>
        </div>
        <div id="bk-preview" style="margin-top:12px"></div>
        <div class="field" style="margin-top:12px">
          <label>Import Mode</label>
          <select id="bk-mode">
            <option value="merge">Merge - add new records, keep existing</option>
            <option value="replace">Replace - overwrite all existing data</option>
          </select>
        </div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-primary" id="bk-do-import" disabled onclick="Backup.doImport()">Import</button>`
    });

    // Drag & drop support
    setTimeout(() => {
      const zone = H.el('bk-drop');
      if (!zone) return;
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('drag');
        const file = e.dataTransfer.files[0];
        if (file) { H.el('bk-file').files = e.dataTransfer.files; Backup.previewImport({ files: [file] }); }
      });
    }, 50);
  }

  let _importData = null;

  async function previewImport(input) {
    const file = input.files?.[0] || input[0]; if (!file) return;
    try {
      const text = await H.readFile(file);
      const data = JSON.parse(text);
      _importData  = data;
      const preview = H.el('bk-preview');
      const btn     = H.el('bk-do-import');
      if (!data._meta) { if (preview) preview.innerHTML = `<div class="auth-alert err">Invalid backup file - missing metadata.</div>`; return; }
      const counts = STORES.map(s => `${s}: ${(data[s]||[]).length}`).join(', ');
      if (preview) preview.innerHTML = `
        <div style="background:var(--green-d);border:1px solid rgba(52,211,153,.3);border-radius:var(--r2);padding:10px 13px;font-size:.8rem">
          <div style="font-weight:700;margin-bottom:4px">✔ Valid backup - v${data._meta.version||'?'}</div>
          <div class="muted">Exported: ${H.fmtDT(data._meta.exportedAt)}</div>
          <div class="muted" style="margin-top:4px;word-break:break-all">${counts}</div>
        </div>`;
      if (btn) btn.disabled = false;
    } catch(e) {
      const preview = H.el('bk-preview');
      if (preview) preview.innerHTML = `<div class="auth-alert err">Invalid or corrupt file: ${H.esc(e.message)}</div>`;
      _importData = null;
    }
  }

  async function doImport() {
    if (!_importData) return;
    const mode = H.el('bk-mode')?.value || 'merge';
    const btn  = H.el('bk-do-import');
    if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }
    try {
      for (const store of STORES) {
        const records = _importData[store] || [];
        if (!records.length) continue;
        if (mode === 'replace') await DB.clear(store);
        await DB.bulkPut(store, records);
      }
      if (_importData.settings && mode === 'replace') {
        localStorage.setItem('fcms_settings', _importData.settings);
      }
      const total = STORES.reduce((s, store) => s + (_importData[store]||[]).length, 0);
      await Logs.add('restore', `Backup imported (${mode}) - ${total} records`);
      Modal.close();
      Notify.ok(`Backup imported (${mode} mode). ${total} records loaded.`);
      _importData = null;
      await render();
    } catch(e) {
      Notify.err('Import failed: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Import'; }
    }
  }

  async function exportCSVMenu() {
    Modal.open({
      title: 'Export Data as CSV', size: 'sm',
      body: `
        <div class="note-block" style="margin-bottom:14px">Choose which data to export as a spreadsheet.</div>
        <div style="display:flex;flex-direction:column;gap:7px">
          ${STORES.filter(s => s !== 'auth').map(s => `
            <label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-size:.84rem">
              <input type="checkbox" class="bk-csv-cb" value="${s}" style="accent-color:var(--a);width:14px;height:14px" checked/>
              <span style="text-transform:capitalize">${s}</span>
            </label>`).join('')}
        </div>`,
      foot: `<button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
             <button class="btn btn-primary" onclick="Backup.exportSelectedCSV()">Export Selected</button>`
    });
  }

  async function exportSelectedCSV() {
    const selected = [...document.querySelectorAll('.bk-csv-cb:checked')].map(cb => cb.value);
    if (!selected.length) { Notify.wrn('Select at least one store.'); return; }
    for (const store of selected) await exportStore(store);
    Modal.close();
  }

  async function exportStore(store) {
    const records = await DB.getAll(store).catch(() => []);
    if (!records.length) { Notify.wrn(`No data in ${store}.`); return; }
    const keys = Object.keys(records[0]);
    const rows  = records.map(r => keys.map(k => r[k]));
    H.dlFile(H.toCSV(rows, keys), `FCMS-${H.sanitizeFile(store)}-${Date.now()}.csv`, 'text/csv');
    Notify.ok(`${store} exported.`);
  }

  async function clearStore(store) {
    Modal.confirm({
      title: `Clear ${store}`, danger: true,
      message: `Delete all records from "${store}"? This cannot be undone.`,
      confirmLabel: 'Clear Store',
      onConfirm: async () => {
        await DB.clear(store);
        await Logs.add('delete', `Cleared store: ${store}`);
        Notify.ok(`"${store}" cleared.`);
        await render();
      }
    });
  }

  function toggleAuto(enabled) {
    localStorage.setItem('fcms_auto_backup', enabled ? 'true' : 'false');
    Notify.ok(enabled ? 'Auto-backup reminder enabled.' : 'Auto-backup reminder disabled.');
  }

  // Check if reminder needed (called at boot)
  function checkAutoBackup() {
    if (localStorage.getItem('fcms_auto_backup') !== 'true') return;
    const last = localStorage.getItem('fcms_last_backup');
    if (!last) return;
    const diff = (Date.now() - new Date(last).getTime()) / 86400000;
    if (diff >= 7) Notify.wrn(`It's been ${Math.floor(diff)} days since your last backup. Export a backup to protect your data.`, 8000);
  }

  return { render, exportAll, importBackup, previewImport, doImport, exportCSVMenu, exportSelectedCSV, exportStore, clearStore, toggleAuto, checkAutoBackup };
})();
