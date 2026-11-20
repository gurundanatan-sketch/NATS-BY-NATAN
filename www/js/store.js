/* NATS BY NATAN — penyimpanan: preferensi (localStorage) & Perpustakaan Digital (IndexedDB) */
(function (g) {
  const KEY = 'nats.v1';
  const defaults = {
    theme: 'night', fontOrig: 30, fontTr: 16,
    showOrig: true, showTranslit: true, showTr: true, mode: 'parallel',
    bibleTr: ['NATS', 'KJV'], quranTr: ['KEMENAG'], qari: 'Alafasy_128kbps',
    lastBible: { b: 'GEN', c: 1 }, lastQuran: 1, lastHadith: { k: 'bukhari', n: 1 },
    bookmarks: [], notes: [], highlights: {}, history: [], searchHistory: [],
    plans: {}, memorize: [], engine: 'google'
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
  const DB_NAME = 'nats-db', VER = 1;
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!g.indexedDB) return rej(new Error('IndexedDB tidak tersedia'));
      const r = indexedDB.open(DB_NAME, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('library')) d.createObjectStore('library', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('datasets')) d.createObjectStore('datasets', { keyPath: 'key' });
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store);
      const out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error);
    });
  }
  const DB = {
    put: (store, obj) => tx(store, 'readwrite', s => s.put(obj)),
    get: (store, key) => tx(store, 'readonly', s => s.get(key)),
    del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
    all: (store) => tx(store, 'readonly', s => s.getAll()),
    clear: (store) => tx(store, 'readwrite', s => s.clear())
  };

  g.Prefs = Prefs; g.DB = DB;
  g.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
})(window);
