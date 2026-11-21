/* NATS BY NATAN — penyimpanan: preferensi (localStorage) & Perpustakaan Digital (IndexedDB) */
(function (g) {
  const KEY = 'nats.v1';
  const defaults = {
    theme: 'night', fontOrig: 30, fontTr: 16,
    showOrig: true, showTranslit: true, showTr: true, mode: 'parallel',
    bibleTr: ['NATS', 'KJV'], quranTr: ['KEMENAG'], qari: 'Alafasy_128kbps',
    lastBible: { b: 'GEN', c: 1 }, lastQuran: 1, lastHadith: { k: 'bukhari', n: 1 },
    bookmarks: [], notes: [], highlights: {}, history: [], searchHistory: [],
    plans: {}, memorize: [], engine: 'google', compressImg: true, hadithTotals: {}
  };
  let mem = null;
  function load() {
    if (mem) return mem;
    try { mem = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { mem = Object.assign({}, defaults); }
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { console.warn('Gagal menyimpan', e); } }

  const Prefs = {
    get: k => load()[k],
    set(k, v) { load()[k] = v; save(); },
    all: () => load(),
    replace(obj) { mem = Object.assign({}, defaults, obj); save(); },
    reset() { mem = Object.assign({}, defaults); save(); }
  };

  // ---------- IndexedDB ----------
  // v2: metadata pustaka dipisah dari isi file (store "files") agar daftar tetap ringan,
  //     + cache hadits dari API GadingDev untuk baca & cari offline.
  const DB_NAME = 'nats-db', VER = 2;
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!g.indexedDB) return rej(new Error('IndexedDB tidak tersedia'));
      const r = indexedDB.open(DB_NAME, VER);
      r.onupgradeneeded = (ev) => {
        const d = r.result; const t = r.transaction;
        const lib = d.objectStoreNames.contains('library') ? t.objectStore('library') : d.createObjectStore('library', { keyPath: 'id' });
        if (!lib.indexNames.contains('created')) lib.createIndex('created', 'created');
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('datasets')) d.createObjectStore('datasets', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('hadith')) d.createObjectStore('hadith', { keyPath: 'key' }).createIndex('kitab', 'kitab');
        // migrasi v1 → v2: pindahkan blob dari item pustaka ke store "files"
        if (ev.oldVersion === 1) {
          const files = t.objectStore('files');
          lib.openCursor().onsuccess = e => {
            const c = e.target.result; if (!c) return;
            const it = c.value;
            if (it.blob) { files.put({ id: it.id, blob: it.blob }); it.hasFile = true; delete it.blob; c.update(it); }
            c.continue();
          };
        }
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store);
      const out = fn(s); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); t.onerror = () => rej(t.error);
    });
  }
  const DB = {
    put: (store, obj) => tx(store, 'readwrite', s => s.put(obj)),
    get: (store, key) => tx(store, 'readonly', s => s.get(key)),
    del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
    all: (store) => tx(store, 'readonly', s => s.getAll()),
    count: (store) => tx(store, 'readonly', s => s.count()),
    clear: (store) => tx(store, 'readwrite', s => s.clear()),
    putMany: (store, arr) => tx(store, 'readwrite', s => { arr.forEach(o => s.put(o)); return {}; }),
    byIndex: (store, index, value) => tx(store, 'readonly', s => s.index(index).getAll(value)),
    countIndex: (store, index, value) => tx(store, 'readonly', s => s.index(index).count(value)),
    /** Hapus semua record dengan nilai index tertentu dalam satu transaksi */
    delIndex: (store, index, value) => tx(store, 'readwrite', s => {
      s.index(index).openKeyCursor(IDBKeyRange.only(value)).onsuccess = e => { const c = e.target.result; if (c) { s.delete(c.primaryKey); c.continue(); } };
      return {};
    }),
    /** Jelajah dengan kursor tanpa memuat semuanya ke memori; fn(value) → false untuk berhenti */
    async each(store, fn, indexName, direction) {
      const d = await db();
      return new Promise((res, rej) => {
        const t = d.transaction(store, 'readonly'); const s = t.objectStore(store);
        const src = indexName ? s.index(indexName) : s;
        src.openCursor(null, direction || 'next').onsuccess = e => {
          const c = e.target.result; if (!c) return;
          if (fn(c.value) === false) return; c.continue();
        };
        t.oncomplete = () => res(); t.onerror = () => rej(t.error);
      });
    }
  };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  g.Prefs = Prefs; g.DB = DB;
  g.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
})(window);
