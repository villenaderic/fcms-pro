'use strict';
/* ═══════════════════════════════════════════════════
   db.js - FCMS Pro v4 IndexedDB Layer
   Stores: 12 data stores + counters + auth
   Version: 4 (adds quotes, templates, goals)
═══════════════════════════════════════════════════ */
const DB = (() => {
  const NAME = 'fcms_v4', VER = 4;
  let _db = null;

  const STORES = {
    clients:     { idx: ['name','dateAdded'] },
    commissions: { idx: ['clientId','status','deadline','dateAdded'] },
    payments:    { idx: ['commissionId','clientId','date'] },
    receipts:    { idx: ['commissionId','clientId','date'] },
    invoices:    { idx: ['clientId','status','createdAt'] },
    expenses:    { idx: ['date','category'] },
    quotes:      { idx: ['clientId','status','createdAt'] },
    templates:   { idx: ['serviceType','name'] },
    goals:       { idx: ['type'] },
    counters:    { idx: [] },
    logs:        { idx: ['type','timestamp'] },
    auth:        { idx: [] },
  };

  function open() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      if (navigator.storage?.persist) {
        navigator.storage.persist().catch(() => {});
      }
      const req = indexedDB.open(NAME, VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        for (const [name, cfg] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            cfg.idx.forEach(ix => store.createIndex(ix, ix, { unique: false }));
          }
        }
      };
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror   = e => rej(e.target.error);
      req.onblocked = () => rej(new Error('Database is blocked. Close other tabs of FCMS and reload.'));
    });
  }

  const _tx = (store, mode = 'readonly') =>
    _db.transaction(store, mode).objectStore(store);

  async function getAll(store) {
    await open();
    return new Promise((res, rej) => {
      const r = _tx(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = e => rej(e.target.error);
    });
  }

  async function getById(store, id) {
    await open();
    return new Promise((res, rej) => {
      const r = _tx(store).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror   = e => rej(e.target.error);
    });
  }

  async function put(store, record) {
    await open();
    return new Promise((res, rej) => {
      const r = _tx(store, 'readwrite').put(record);
      r.onsuccess = () => res(r.result);
      r.onerror   = e => rej(e.target.error);
    });
  }

  async function remove(store, id) {
    await open();
    return new Promise((res, rej) => {
      const r = _tx(store, 'readwrite').delete(id);
      r.onsuccess = () => res();
      r.onerror   = e => rej(e.target.error);
    });
  }

  async function clear(store) {
    await open();
    return new Promise((res, rej) => {
      const r = _tx(store, 'readwrite').clear();
      r.onsuccess = () => res();
      r.onerror   = e => rej(e.target.error);
    });
  }

  async function count(store) {
    await open();
    return new Promise((res, rej) => {
      const r = _tx(store).count();
      r.onsuccess = () => res(r.result);
      r.onerror   = e => rej(e.target.error);
    });
  }

  async function bulkPut(store, records) {
    if (!records?.length) return;
    await open();
    return new Promise((res, rej) => {
      const t = _db.transaction(store, 'readwrite');
      const s = t.objectStore(store);
      records.forEach(r => s.put(r));
      t.oncomplete = () => res();
      t.onerror    = e => rej(e.target.error);
    });
  }

  async function bulkRemove(store, ids) {
    if (!ids?.length) return;
    await open();
    return new Promise((res, rej) => {
      const t = _db.transaction(store, 'readwrite');
      const s = t.objectStore(store);
      ids.forEach(id => s.delete(id));
      t.oncomplete = () => res();
      t.onerror    = e => rej(e.target.error);
    });
  }

  async function nextCounter(name) {
    await open();
    return new Promise((res, rej) => {
      const t = _db.transaction('counters', 'readwrite');
      const s = t.objectStore('counters');
      const r = s.get(name);
      r.onsuccess = () => {
        const next = (r.result?.value || 0) + 1;
        s.put({ id: name, value: next });
        res(next);
      };
      r.onerror = e => rej(e.target.error);
    });
  }

  async function resetCounters() {
    await open();
    return new Promise((res, rej) => {
      const r = _tx('counters', 'readwrite').clear();
      r.onsuccess = () => res();
      r.onerror   = e => rej(e.target.error);
    });
  }

  async function exportAll() {
    await open();
    const data = { _meta: { exportedAt: new Date().toISOString(), version: VER, app: 'FCMS Pro v4' } };
    for (const name of Object.keys(STORES)) {
      data[name] = await getAll(name).catch(() => []);
    }
    return data;
  }

  async function importAll(data, overwrite = true) {
    await open();
    const skip = ['auth', '_meta', 'counters'];
    for (const [name, records] of Object.entries(data)) {
      if (skip.includes(name) || !STORES[name] || !Array.isArray(records)) continue;
      if (overwrite) await clear(name);
      if (records.length) await bulkPut(name, records);
    }
  }

  return {
    open, getAll, getById, put, remove, clear, count,
    bulkPut, bulkRemove, nextCounter, resetCounters,
    exportAll, importAll,
    storeNames: () => Object.keys(STORES),
  };
})();
