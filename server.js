/**
 * NATS BY NATAN — server pengembangan & API data (Node.js, tanpa dependensi)
 *
 * Aplikasi Android TIDAK membutuhkan server ini: semua data dibundel offline di APK.
 * Server ini dipakai untuk:
 *   1. Pratinjau cepat UI di komputer/HP (live reload sederhana) saat mengembangkan
 *   2. API JSON untuk data kitab (bisa dipakai sinkronisasi/ekstensi di masa depan)
 *   3. Menyimpan & membagikan berkas Perpustakaan Digital ke beberapa perangkat (opsional)
 *
 * Jalankan:  node server.js            (default port 8080)
 *            PORT=3000 node server.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = +process.env.PORT || 8080;
const ROOT = path.join(__dirname, 'www');
const DATA = path.join(ROOT, 'data');
const STORAGE = path.join(__dirname, 'storage');
const MAX_UPLOAD = 50 * 1024 * 1024; // 50 MB

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg'
};

fs.mkdirSync(STORAGE, { recursive: true });
const cache = {};
function data(name) {
  const file = path.join(DATA, name + '.json');
  const mtime = fs.statSync(file).mtimeMs;
  if (!cache[name] || cache[name].mtime !== mtime) cache[name] = { mtime, json: JSON.parse(fs.readFileSync(file, 'utf8')) };
  return cache[name].json;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Filename', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const notFound = (res, msg = 'Tidak ditemukan') => send(res, 404, { error: msg });

// ------------------------------------------------------------------ API
const api = {
  'GET /api/health': () => ({ ok: true, app: 'NATS BY NATAN', time: new Date().toISOString() }),

  // Alkitab: /api/bible/GEN/1  → ayat pasal + terjemahan
  'GET /api/bible/:book/:chapter': ({ book, chapter }) => {
    const b = data('bible'); const verses = b.verses[`${book.toUpperCase()}.${chapter}`];
    return verses ? { book: book.toUpperCase(), chapter: +chapter, translations: b.translations, verses } : null;
  },
  'GET /api/bible/translations': () => data('bible').translations,

  // Al-Qur'an: /api/quran/1
  'GET /api/quran/:surah': ({ surah }) => {
    const q = data('quran'); const ayat = q.surah[surah];
    return ayat ? { surah: +surah, translations: q.translations, ayat } : null;
  },

  // Hadits: /api/hadith/kitab, /api/hadith/bukhari/1, /api/hadith/tema/Ilmu
  'GET /api/hadith/kitab': () => data('hadith').kitab.map(k => ({ ...k, offline: (data('hadith').items[k.id] || []).length })),
  'GET /api/hadith/tema/:tema': ({ tema }) => {
    const h = data('hadith'); const out = [];
    Object.entries(h.items).forEach(([k, arr]) => arr.forEach(x => { if ((x.tema || []).includes(tema)) out.push({ kitab: k, ...x }); }));
    return { tema, total: out.length, items: out };
  },
  'GET /api/hadith/:kitab/:no': ({ kitab, no }) => {
    const h = data('hadith'); const item = (h.items[kitab] || []).find(x => x.no === +no);
    return item ? { kitab: h.kitab.find(k => k.id === kitab), ...item } : null;
  },

  // Leksikon Strong: /api/lexicon/H7225
  'GET /api/lexicon/:id': ({ id }) => {
    const l = data('lexicon'); const e = l.strong[id.toUpperCase()];
    return e ? { id: id.toUpperCase(), ...e } : null;
  },

  // Pencarian gabungan: /api/search?q=kasih
  'GET /api/search': (_, url) => {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    if (!q) return { q, results: [] };
    const results = [];
    const b = data('bible');
    Object.entries(b.verses).forEach(([ch, arr]) => arr.forEach(v => {
      if ([v.orig, v.translit, ...Object.values(v.tr)].join(' ').toLowerCase().includes(q)) results.push({ type: 'bible', ref: `${ch}.${v.v}`, text: v.tr.NATS || Object.values(v.tr)[0] });
    }));
    const qu = data('quran');
    Object.entries(qu.surah).forEach(([s, arr]) => arr.forEach(v => {
      if ([v.orig, v.translit, ...Object.values(v.tr)].join(' ').toLowerCase().includes(q)) results.push({ type: 'quran', ref: `${s}.${v.v}`, text: v.tr.KEMENAG });
    }));
    const h = data('hadith');
    Object.entries(h.items).forEach(([k, arr]) => arr.forEach(x => {
      if ([x.arab, x.terjemah, x.perawi, (x.tema || []).join(' ')].join(' ').toLowerCase().includes(q)) results.push({ type: 'hadith', ref: `${k}:${x.no}`, text: x.terjemah });
    }));
    return { q, total: results.length, results };
  },

  // Perpustakaan bersama (opsional): unggah, daftar, unduh, hapus
  'GET /api/library': () => fs.readdirSync(STORAGE).filter(f => !f.endsWith('.meta.json')).map(f => {
    const metaFile = path.join(STORAGE, f + '.meta.json');
    const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
    return { file: f, size: fs.statSync(path.join(STORAGE, f)).size, ...meta };
  })
};

function matchRoute(method, pathname) {
  for (const key of Object.keys(api)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const pp = pattern.split('/'), up = pathname.split('/');
    if (pp.length !== up.length) continue;
    const params = {}; let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(up[i]);
      else if (pp[i] !== up[i]) { ok = false; break; }
    }
    if (ok) return { fn: api[key], params };
  }
  return null;
}

const safeName = n => String(n || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 120);

function handleUpload(req, res) {
  const name = Date.now() + '-' + safeName(decodeURIComponent(req.headers['x-filename'] || 'file'));
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > MAX_UPLOAD) { req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    fs.writeFileSync(path.join(STORAGE, name), Buffer.concat(chunks));
    fs.writeFileSync(path.join(STORAGE, name + '.meta.json'), JSON.stringify({ title: req.headers['x-title'] || name, type: req.headers['content-type'], created: Date.now() }));
    send(res, 201, { ok: true, file: name });
  });
}

function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(ROOT, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(ROOT)) return notFound(res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (path.extname(pathname)) return notFound(res); // aset tidak ada → 404 (bukan index.html)
      file = path.join(ROOT, 'index.html'); // fallback SPA
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, '');
  try {
    if (p === '/api/library' && req.method === 'POST') return handleUpload(req, res);
    if (p.startsWith('/api/library/file/')) {
      const f = path.join(STORAGE, safeName(decodeURIComponent(p.split('/').pop())));
      if (!fs.existsSync(f)) return notFound(res);
      if (req.method === 'DELETE') { fs.unlinkSync(f); if (fs.existsSync(f + '.meta.json')) fs.unlinkSync(f + '.meta.json'); return send(res, 200, { ok: true }); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
      return fs.createReadStream(f).pipe(res);
    }
    if (p.startsWith('/api/')) {
      const m = matchRoute(req.method, p);
      if (!m) return notFound(res, 'Endpoint tidak dikenal');
      const out = m.fn(m.params, url);
      return out == null ? notFound(res) : send(res, 200, out);
    }
    serveStatic(req, res, p);
  } catch (e) {
    console.error(e); send(res, 500, { error: e.message });
  }
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  NATS BY NATAN — server berjalan`);
    console.log(`  ▸ Aplikasi : http://localhost:${PORT}`);
    console.log(`  ▸ API      : http://localhost:${PORT}/api/health\n`);
  });
}
module.exports = server;
