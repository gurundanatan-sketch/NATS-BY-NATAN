/* =====================================================================
   NATS BY NATAN — aplikasi Android studi Alkitab, Al-Qur'an & Hadits
   Satu berkas logika: data, router, pembaca interlinear, hadits,
   perpustakaan digital, pencarian (aplikasi + Chrome), leksikon, dll.
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');
  const D = { bible: null, quran: null, hadith: null, lexicon: null, topics: null };
  const WORDS = {}; // registry kata per ayat untuk sheet leksikon
  let audio = null, audioQueue = [];

  // ---------------------------------------------------------- util UI
  window.toast = function (msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  };
  function openSheet(html, onMount) {
    $('#sheetBody').innerHTML = html; $('#sheet').classList.add('open'); $('#scrim').classList.add('show');
    $('#sheet').setAttribute('aria-hidden', 'false'); $('#sheetBody').scrollTop = 0;
    if (onMount) onMount($('#sheetBody'));
  }
  function closeSheet() { $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true'); if (!$('#drawer').classList.contains('open')) $('#scrim').classList.remove('show'); }
  function openDrawer() { $('#drawer').classList.add('open'); $('#scrim').classList.add('show'); }
  function closeDrawer() { $('#drawer').classList.remove('open'); if (!$('#sheet').classList.contains('open')) $('#scrim').classList.remove('show'); }
  const isOpen = () => $('#sheet').classList.contains('open') || $('#drawer').classList.contains('open');
  function setTitle(sub, tab) {
    const t = $('.appbar-title');
    if (t.classList.contains('center')) { t.classList.remove('center'); t.innerHTML = '<span class="brand-mark">NATS</span><span class="appbar-sub" id="appbarSub"></span>'; }
    $('#btnSearch').onclick = () => go('#/search');
    $('#appbarSub').textContent = sub || 'BY NATAN';
    $$('.bottomnav a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    $$('.drawer-nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === location.hash));
  }
  const go = h => { location.hash = h; };
  const fmtDate = t => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const hlText = (txt, q) => { const s = esc(txt); if (!q) return s; const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); return s.replace(re, '<mark>$1</mark>'); };

  function applyPrefs() {
    const p = Prefs.all();
    document.documentElement.dataset.theme = p.theme;
    document.documentElement.style.setProperty('--fs-orig', p.fontOrig + 'px');
    document.documentElement.style.setProperty('--fs-tr', p.fontTr + 'px');
    const tc = { night: '#121a36', light: '#ffffff', sepia: '#f7eedb', amoled: '#07070b' }[p.theme];
    $('meta[name="theme-color"]').setAttribute('content', tc);
  }

  // ---------------------------------------------------------- data
  async function fetchJSON(path) { const r = await fetch(path); if (!r.ok) throw new Error(path); return r.json(); }
  function mergeDataset(type, ds) {
    if (type === 'bible') {
      (ds.translations || []).forEach(t => { if (!D.bible.translations.find(x => x.id === t.id)) D.bible.translations.push(t); });
      Object.entries(ds.verses || {}).forEach(([ch, arr]) => {
        const cur = D.bible.verses[ch] || (D.bible.verses[ch] = []);
        arr.forEach(v => { const ex = cur.find(x => x.v === v.v); if (ex) { Object.assign(ex, v, { tr: Object.assign({}, ex.tr, v.tr) }); } else cur.push(v); });
        cur.sort((a, b) => a.v - b.v);
      });
    } else if (type === 'quran') {
      (ds.translations || []).forEach(t => { if (!D.quran.translations.find(x => x.id === t.id)) D.quran.translations.push(t); });
      Object.entries(ds.surah || {}).forEach(([s, arr]) => {
        const cur = D.quran.surah[s] || (D.quran.surah[s] = []);
        arr.forEach(v => { const ex = cur.find(x => x.v === v.v); if (ex) Object.assign(ex, v, { tr: Object.assign({}, ex.tr, v.tr) }); else cur.push(v); });
        cur.sort((a, b) => a.v - b.v);
      });
    } else if (type === 'hadith') {
      Object.entries(ds.items || {}).forEach(([k, arr]) => {
        const cur = D.hadith.items[k] || (D.hadith.items[k] = []);
        arr.forEach(hd => { const i = cur.findIndex(x => x.no === hd.no); if (i >= 0) cur[i] = Object.assign(cur[i], hd); else cur.push(hd); });
        cur.sort((a, b) => a.no - b.no);
      });
      (ds.themes || []).forEach(t => { if (!D.hadith.themes.includes(t)) D.hadith.themes.push(t); });
    } else if (type === 'lexicon') {
      Object.assign(D.lexicon.strong, ds.strong || {}); Object.assign(D.lexicon.roots, ds.roots || {});
    }
  }
  async function loadData() {
    const [bible, quran, hadith, lexicon, topics] = await Promise.all(['bible', 'quran', 'hadith', 'lexicon', 'topics'].map(n => fetchJSON('data/' + n + '.json')));
    Object.assign(D, { bible, quran, hadith, lexicon, topics });
    try { (await DB.all('datasets')).forEach(d => mergeDataset(d.type, d.data)); } catch (e) { console.warn('dataset impor', e); }
  }
  const chapter = (b, c) => D.bible.verses[b + '.' + c] || [];
  const surah = s => D.quran.surah[s] || [];
  const kitab = k => D.hadith.kitab.find(x => x.id === k);
  const hadithList = k => D.hadith.items[k] || [];
  const hadithGet = (k, n) => hadithList(k).find(x => x.no === +n);
  // rumus takhrij klasik: خ=Bukhari م=Muslim د=Abu Dawud ت=Tirmidzi ن=Nasa'i ه=Ibnu Majah حم=Ahmad ط=Malik مي=Darimi
  const SYM = { bukhari: 'خ', muslim: 'م', abudawud: 'د', tirmidzi: 'ت', nasai: 'ن', ibnumajah: 'ه', ahmad: 'حم', malik: 'ط', darimi: 'مي' };
  const derajatClass = d => /shahih/i.test(d) ? 'shahih' : /hasan/i.test(d) ? 'hasan' : 'other';

  /** resolve kunci universal: B:GEN.1.1 | Q:1.1 | H:bukhari:1 */
  function resolve(key) {
    const [t, rest] = [key.slice(0, 1), key.slice(2)];
    if (t === 'B') {
      const [b, c, v] = rest.split('.'); const vv = chapter(b, c).find(x => x.v === +v);
      const trId = Prefs.get('bibleTr')[0] || 'NATS';
      return { key, kind: 'bible', label: CANON.refLabel(rest), orig: vv && vv.orig, translit: vv && vv.translit, tr: vv ? (vv.tr[trId] || Object.values(vv.tr)[0]) : '', script: CANON.book(b) ? CANON.book(b).lang : 'he', route: `#/bible?b=${b}&c=${c}&v=${v}`, ok: !!vv };
    }
    if (t === 'Q') {
      const [s, v] = rest.split('.'); const vv = surah(s).find(x => x.v === +v);
      const trId = Prefs.get('quranTr')[0] || 'KEMENAG';
      return { key, kind: 'quran', label: CANON.qLabel(rest), orig: vv && vv.orig, translit: vv && vv.translit, tr: vv ? (vv.tr[trId] || Object.values(vv.tr)[0]) : '', script: 'ar', route: `#/quran/${s}?v=${v}`, ok: !!vv };
    }
    if (t === 'H') {
      const [k, n] = rest.split(':'); const hd = HMEM[k + ':' + n] || hadithGet(k, n); const kb = kitab(k);
      return { key, kind: 'hadith', label: `HR ${kb ? kb.name.replace(/^(Shahih|Sunan|Musnad|Muwatha') /, '') : k} no. ${n}`, orig: hd && hd.arab, translit: hd && hd.translit, tr: hd ? hd.terjemah : '', script: 'ar', route: `#/hadith/${k}/${n}`, ok: !!hd };
    }
    return { key, label: key, ok: false };
  }

  // ---------------------------------------------------------- koleksi pengguna
  const isBookmarked = key => Prefs.get('bookmarks').includes(key);
  function toggleBookmark(key) {
    const b = Prefs.get('bookmarks'); const i = b.indexOf(key);
    if (i >= 0) b.splice(i, 1); else b.unshift(key);
    Prefs.set('bookmarks', b); toast(i >= 0 ? 'Penanda dihapus' : 'Ditambahkan ke penanda'); return i < 0;
  }
  function pushHistory(label, route) {
    const h = Prefs.get('history').filter(x => x.route !== route); h.unshift({ label, route, t: Date.now() });
    Prefs.set('history', h.slice(0, 40));
  }
  function noteSheet(key, label) {
    const notes = Prefs.get('notes'); const ex = notes.find(n => n.key === key);
    openSheet(`<h3>Catatan — ${esc(label)}</h3>
      <textarea id="noteTxt" rows="7" placeholder="Tulis renungan, pertanyaan, atau ringkasan…">${esc(ex ? ex.text : '')}</textarea>
      <div class="row" style="margin-top:12px"><button class="btn primary grow" id="noteSave">Simpan</button>${ex ? '<button class="btn" id="noteDel">Hapus</button>' : ''}</div>`, el => {
      $('#noteSave', el).onclick = () => {
        const txt = $('#noteTxt', el).value.trim(); const arr = Prefs.get('notes').filter(n => n.key !== key);
        if (txt) arr.unshift({ id: uid(), key, label, text: txt, t: Date.now() });
        Prefs.set('notes', arr); closeSheet(); toast('Catatan tersimpan'); rerender();
      };
      const del = $('#noteDel', el); if (del) del.onclick = () => { Prefs.set('notes', Prefs.get('notes').filter(n => n.key !== key)); closeSheet(); rerender(); };
    });
  }
  function highlightSheet(key) {
    const colors = [['yellow', '#f5c84c'], ['green', '#39c58e'], ['blue', '#5b8cff'], ['pink', '#f06aa6']];
    openSheet(`<h3>Stabilo ayat</h3><div class="row" style="gap:14px;margin:14px 0">
      ${colors.map(([n, c]) => `<button data-c="${n}" style="width:52px;height:52px;border-radius:50%;background:${c}"></button>`).join('')}
      <button data-c="" class="btn">Hapus</button></div>`, el => {
      $$('[data-c]', el).forEach(b => b.onclick = () => {
        const h = Prefs.get('highlights'); if (b.dataset.c) h[key] = b.dataset.c; else delete h[key];
        Prefs.set('highlights', h); closeSheet(); rerender();
      });
    });
  }
  function addMemorize(key) {
    const m = Prefs.get('memorize'); if (!m.find(x => x.key === key)) { m.unshift({ key, level: 0, t: Date.now() }); Prefs.set('memorize', m); }
    toast('Ditambahkan ke daftar hafalan');
  }

  // ---------------------------------------------------------- tampilan ayat (dipakai Alkitab & Al-Qur'an)
  function verseCard(o) {
    const p = Prefs.all();
    WORDS[o.key] = { words: o.words || [], kind: o.kind, script: o.script, label: o.label };
    const hl = p.highlights[o.key]; const bm = isBookmarked(o.key); const hasNote = p.notes.some(n => n.key === o.key);
    const rtl = o.script !== 'grc';
    let origHtml = '';
    if (p.showOrig && o.orig) {
      if (p.mode === 'interlinear' && o.words && o.words.length) {
        origHtml = `<div class="interlinear ${rtl ? 'rtl' : ''}">${o.words.map((w, i) => `
          <div class="il-word" data-key="${o.key}" data-w="${i}">
            <div class="il-strong">${esc(o.kind === 'bible' ? w[3] : w[3] !== '—' ? w[3] : '')}</div>
            <div class="il-orig ${o.script}">${esc(w[0])}</div>
            ${p.showTranslit ? `<div class="il-tl">${esc(w[1])}</div>` : ''}
            <div class="il-gloss">${esc(w[2])}</div>
            <div class="il-morph">${esc(w[4] || '')}</div></div>`).join('')}</div>`;
      } else if (o.words && o.words.length) {
        origHtml = `<div class="v-orig ${o.script}">${o.words.map((w, i) => `<span class="w" data-key="${o.key}" data-w="${i}">${esc(w[0])}</span>`).join(' ')}</div>`;
      } else origHtml = `<div class="v-orig ${o.script}">${esc(o.orig)}</div>`;
    }
    const tl = p.showTranslit && o.translit ? `<div class="v-translit">${esc(o.translit)}</div>` : '';
    const trs = p.showTr ? o.trs.map(([lab, txt]) => `<div class="v-tr"><span class="tr-label">${esc(lab)}</span>${esc(txt)}</div>`).join('') : '';
    const xref = o.xref && o.xref.length ? `<div class="v-xref">${o.xref.map(r => `<a href="#/bible?b=${r.split('.')[0]}&c=${r.split('.')[1]}&v=${r.split('.')[2] || 1}">↗ ${esc(CANON.refLabel(r))}</a>`).join('')}</div>` : '';
    return `<article class="verse ${hl ? 'hl-' + hl : ''}" id="v-${o.num}" data-key="${o.key}">
      <div class="v-head"><span class="v-num ${o.kind === 'quran' ? 'ar' : ''}">${o.num}</span><span class="v-ref">${esc(o.label)}</span>
        <button class="v-more" data-act="more" data-key="${o.key}" aria-label="Lainnya">⋯</button></div>
      ${origHtml}${tl}${trs}${o.extra || ''}${xref}
      <div class="v-actions">
        <button data-act="bm" data-key="${o.key}" class="${bm ? 'on' : ''}" title="Penanda">${bm ? '★' : '☆'}</button>
        <button data-act="hl" data-key="${o.key}" class="${hl ? 'on' : ''}" title="Stabilo">🖍</button>
        <button data-act="note" data-key="${o.key}" class="${hasNote ? 'on' : ''}" title="Catatan">✎</button>
        <button data-act="copy" data-key="${o.key}" title="Salin">⧉</button>
        <button data-act="share" data-key="${o.key}" title="Bagikan">⤴</button>
        <button data-act="play" data-key="${o.key}" title="Dengarkan">▶</button>
      </div></article>`;
  }
  function readerControls(kind, opts) {
    opts = opts || {};
    const p = Prefs.all(); const trs = kind === 'bible' ? D.bible.translations : D.quran.translations; const sel = kind === 'bible' ? p.bibleTr : p.quranTr;
    return `<div class="row between"><div class="seg" style="flex:1;max-width:260px">
        <button data-mode="parallel" class="${p.mode === 'parallel' ? 'on' : ''}">Paralel</button>
        <button data-mode="interlinear" class="${p.mode === 'interlinear' ? 'on' : ''}">Interlinear</button></div>
        <button class="chip" data-act="display">Aa Tampilan</button></div>
      ${opts.chips === false ? '' : `<div class="chips" style="margin-top:8px">${trs.map(t => `<button class="chip ${sel.includes(t.id) ? 'on' : ''}" data-tr="${t.id}" data-kind="${kind}" title="${esc(t.name)}">${esc(t.id)}</button>`).join('')}</div>`}`;
  }
  function displaySheet() {
    const p = Prefs.all();
    const sw = (k, label) => `<div class="toggle"><span>${label}</span><button class="switch ${p[k] ? 'on' : ''}" data-sw="${k}"></button></div>`;
    openSheet(`<h3>Tampilan bacaan</h3>
      ${sw('showOrig', 'Teks asli (Ibrani / Yunani / Arab)')}${sw('showTranslit', 'Transliterasi Latin')}${sw('showTr', 'Terjemahan')}
      <div style="margin-top:14px"><small>Ukuran teks asli: <b id="fo">${p.fontOrig}</b>px</small><input type="range" min="20" max="48" value="${p.fontOrig}" id="rngO"></div>
      <div style="margin-top:8px"><small>Ukuran terjemahan: <b id="ft">${p.fontTr}</b>px</small><input type="range" min="13" max="24" value="${p.fontTr}" id="rngT"></div>
      <div class="seg" style="margin-top:14px">${['night', 'light', 'sepia', 'amoled'].map(t => `<button data-theme-set="${t}" class="${p.theme === t ? 'on' : ''}">${{ night: 'Malam', light: 'Terang', sepia: 'Sepia', amoled: 'Hitam' }[t]}</button>`).join('')}</div>`, el => {
      $$('[data-sw]', el).forEach(b => b.onclick = () => { Prefs.set(b.dataset.sw, !Prefs.get(b.dataset.sw)); b.classList.toggle('on'); rerender(); });
      $('#rngO', el).oninput = e => { Prefs.set('fontOrig', +e.target.value); $('#fo', el).textContent = e.target.value; applyPrefs(); };
      $('#rngT', el).oninput = e => { Prefs.set('fontTr', +e.target.value); $('#ft', el).textContent = e.target.value; applyPrefs(); };
      $$('[data-theme-set]', el).forEach(b => b.onclick = () => { Prefs.set('theme', b.dataset.themeSet); applyPrefs(); $$('[data-theme-set]', el).forEach(x => x.classList.toggle('on', x === b)); });
    });
  }

  // ---------------------------------------------------------- sheet leksikon kata (gaya Bible Hub)
  function wordSheet(key, idx) {
    const reg = WORDS[key]; if (!reg) return; const w = reg.words[idx]; if (!w) return;
    if (reg.kind === 'bible') {
      const lex = D.lexicon.strong[w[3]] || {}; const isH = w[3][0] === 'H'; const num = w[3].slice(1);
      const occ = concordance('strong', w[3]);
      openSheet(`<div class="lex-head"><div class="lex-lemma ${isH ? 'he' : 'grc'}">${esc(w[0])}</div>
          <div><b>${esc(w[1])}</b> · <span class="muted">“${esc(w[2])}”</span></div></div>
        <dl class="kv">
          <dt>Strong</dt><dd><b style="color:var(--c-bible)">${esc(w[3])}</b> (${isH ? 'Ibrani' : 'Yunani'})</dd>
          <dt>Lema</dt><dd><span class="${isH ? 'he' : 'grc'}" style="font-family:var(--font-${isH ? 'he' : 'grc'});font-size:20px">${esc(lex.lemma || '—')}</span> ${lex.translit ? '· ' + esc(lex.translit) : ''}</dd>
          <dt>Pelafalan</dt><dd>${esc(lex.pron || '—')}</dd>
          <dt>Kelas kata</dt><dd>${esc(lex.pos || '—')}</dd>
          <dt>Morfologi</dt><dd>${esc(w[4] || '—')}</dd>
          <dt>Definisi</dt><dd>${esc(lex.def || 'Belum ada di leksikon lokal.')}</dd>
          ${lex.root ? `<dt>Akar</dt><dd>${esc(lex.root)}</dd>` : ''}
          <dt>Ayat ini</dt><dd>${esc(reg.label)}</dd></dl>
        <div class="section-title"><h3>Konkordansi (${occ.length})</h3></div>
        ${occ.map(o => `<a class="list-item" href="${o.route}" data-close><span class="grow"><b>${esc(o.label)}</b><br><small>${esc(o.word)} — ${esc(o.gloss)}</small></span>›</a>`).join('')}
        <div class="row wrap" style="margin-top:14px">
          <button class="btn sm" data-url="https://biblehub.com/${isH ? 'hebrew' : 'greek'}/${num}.htm">Bible Hub ${esc(w[3])}</button>
          <button class="btn sm" data-url="https://biblehub.com/${isH ? 'hebrew' : 'greek'}/strongs_${num}.htm">Konkordansi Bible Hub</button>
          <button class="btn sm" data-url="https://www.google.com/search?q=${encodeURIComponent('Strong ' + w[3] + ' ' + (lex.translit || w[1]))}">Cari di Chrome</button>
          <button class="btn sm" data-copy="${esc(w[0] + ' (' + w[1] + ') ' + w[3] + ': ' + (lex.def || w[2]))}">Salin</button></div>`);
    } else {
      const root = D.lexicon.roots[w[3]]; const occ = w[3] && w[3] !== '—' ? concordance('root', w[3]) : [];
      const [s, v] = key.slice(2).split('.');
      openSheet(`<div class="lex-head"><div class="lex-lemma ar">${esc(w[0])}</div><div><b>${esc(w[1])}</b> · <span class="muted">“${esc(w[2])}”</span></div></div>
        <dl class="kv"><dt>Akar kata</dt><dd><span style="font-family:var(--font-ar);font-size:22px">${esc(w[3] || '—')}</span></dd>
          <dt>Makna akar</dt><dd>${esc(root ? root.meaning : '—')}</dd>
          <dt>Turunan</dt><dd style="font-family:var(--font-ar);font-size:18px">${esc(root ? root.derived.join(' · ') : '—')}</dd>
          <dt>I'rab / ket.</dt><dd>${esc(w[4] || '—')}</dd><dt>Ayat ini</dt><dd>${esc(reg.label)}</dd></dl>
        <div class="section-title"><h3>Kemunculan akar (${occ.length})</h3></div>
        ${occ.map(o => `<a class="list-item" href="${o.route}" data-close><span class="grow"><b>${esc(o.label)}</b><br><small><span style="font-family:var(--font-ar);font-size:17px">${esc(o.word)}</span> — ${esc(o.gloss)}</small></span>›</a>`).join('')}
        <div class="row wrap" style="margin-top:14px">
          <button class="btn sm" data-url="https://corpus.quran.com/wordbyword.jsp?chapter=${s}&verse=${v}">Quranic Corpus</button>
          <button class="btn sm" data-url="https://quran.com/${s}/${v}">Quran.com</button>
          <button class="btn sm" data-url="https://quran.kemenag.go.id/">Qur'an Kemenag</button></div>`);
    }
  }
  function concordance(type, id) {
    const out = [];
    if (type === 'strong') Object.entries(D.bible.verses).forEach(([ch, arr]) => arr.forEach(v => (v.words || []).forEach(w => {
      if (w[3] === id) out.push({ label: CANON.refLabel(ch + '.' + v.v), word: w[0], gloss: w[2], route: `#/bible?b=${ch.split('.')[0]}&c=${ch.split('.')[1]}&v=${v.v}` });
    })));
    else Object.entries(D.quran.surah).forEach(([s, arr]) => arr.forEach(v => (v.words || []).forEach(w => {
      if (w[3] === id) out.push({ label: CANON.qLabel(s + '.' + v.v), word: w[0], gloss: w[2], route: `#/quran/${s}?v=${v.v}` });
    })));
    return out;
  }

  // ---------------------------------------------------------- aksi ayat
  function moreSheet(key) {
    const r = resolve(key); const links = [];
    if (r.kind === 'bible') {
      const [b, c, v] = key.slice(2).split('.'); const bk = CANON.book(b);
      links.push(['Bible Hub Interlinear', `https://biblehub.com/interlinear/${bk.slug}/${c}-${v}.htm`], ['Bible Hub Paralel', `https://biblehub.com/${bk.slug}/${c}-${v}.htm`], ['Alkitab SABDA', `https://alkitab.sabda.org/passage.php?passage=${encodeURIComponent(bk.abbr + ' ' + c + ':' + v)}`]);
    } else if (r.kind === 'quran') {
      const [s, v] = key.slice(2).split('.'); links.push(['Quran.com', `https://quran.com/${s}/${v}`], ["Qur'an Kemenag", `https://quran.kemenag.go.id/`], ['Tafsir (Google)', `https://www.google.com/search?q=${encodeURIComponent('tafsir surah ' + CANON.surahs[s - 1].name + ' ayat ' + v)}`]);
    } else if (r.kind === 'hadith') {
      links.push(['Cari hadits di web', `https://www.google.com/search?q=${encodeURIComponent(r.label + ' ' + (r.tr || '').slice(0, 60))}`]);
    }
    let compare = '';
    if (r.kind === 'bible') { const [b, c, v] = key.slice(2).split('.'); const vv = chapter(b, c).find(x => x.v === +v); compare = vv ? D.bible.translations.filter(t => vv.tr[t.id]).map(t => `<div class="v-tr"><span class="tr-label">${t.id}</span>${esc(vv.tr[t.id])}</div>`).join('') : ''; }
    if (r.kind === 'quran') { const [s, v] = key.slice(2).split('.'); const vv = surah(s).find(x => x.v === +v); compare = vv ? D.quran.translations.filter(t => vv.tr[t.id]).map(t => `<div class="v-tr"><span class="tr-label">${t.id}</span>${esc(vv.tr[t.id])}</div>`).join('') : ''; }
    openSheet(`<h3>${esc(r.label)}</h3>
      ${compare ? `<div class="section-title"><h3>Bandingkan semua terjemahan</h3></div>${compare}` : ''}
      <div class="section-title"><h3>Aksi</h3></div>
      <div class="row wrap"><button class="btn sm" data-mem="${key}">♲ Hafalkan</button><button class="btn sm" data-savelib="${key}">▤ Simpan ke Pustaka</button></div>
      <div class="section-title"><h3>Buka di web (Chrome)</h3></div>
      <div class="row wrap">${links.map(([n, u]) => `<button class="btn sm" data-url="${esc(u)}">${esc(n)} ↗</button>`).join('')}</div>`);
  }
  function verseText(key) { const r = resolve(key); return [r.label, r.orig, r.translit, r.tr, '— via NATS BY NATAN'].filter(Boolean).join('\n'); }
  async function playKey(key) {
    if (key.startsWith('Q:')) { const [s, v] = key.slice(2).split('.'); return playQuran([[+s, +v]]); }
    const r = resolve(key); speak(r.tr, 'id-ID');
  }
  function speak(text, lang) {
    if (!('speechSynthesis' in window)) return toast('Suara (TTS) belum didukung perangkat ini');
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = .95; speechSynthesis.speak(u);
  }
  function playQuran(list) {
    stopAudio(); audioQueue = list.slice();
    const next = () => {
      const it = audioQueue.shift(); if (!it) return stopAudio();
      const [s, v] = it; const url = `https://everyayah.com/data/${Prefs.get('qari')}/${String(s).padStart(3, '0')}${String(v).padStart(3, '0')}.mp3`;
      audio = new Audio(url); audio.onended = next; audio.onerror = () => { toast('Audio murottal butuh koneksi internet'); stopAudio(); };
      audio.play().catch(() => toast('Gagal memutar audio'));
      const el = document.getElementById('v-' + v); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    };
    next(); toast('Memutar murottal…');
  }
  function stopAudio() { if (audio) { audio.pause(); audio = null; } audioQueue = []; }

  // delegasi klik global di view & sheet
  function onClick(e) {
    const t = e.target.closest('[data-act],[data-w],[data-tr],[data-mode],[data-url],[data-copy],[data-mem],[data-savelib],[data-close]');
    if (!t) return;
    if (t.dataset.close !== undefined && t.tagName === 'A') { closeSheet(); return; }
    if (t.dataset.w !== undefined) return wordSheet(t.dataset.key, +t.dataset.w);
    if (t.dataset.url) return Native.openUrl(t.dataset.url);
    if (t.dataset.copy) { Native.copy(t.dataset.copy); return toast('Disalin'); }
    if (t.dataset.mem) { addMemorize(t.dataset.mem); return closeSheet(); }
    if (t.dataset.savelib) { const r = resolve(t.dataset.savelib); saveNoteToLib(r.label, verseText(t.dataset.savelib), 'Ayat & Hadits'); return closeSheet(); }
    if (t.dataset.mode) { Prefs.set('mode', t.dataset.mode); return rerender(); }
    if (t.dataset.tr) {
      const k = t.dataset.kind === 'bible' ? 'bibleTr' : 'quranTr'; let sel = Prefs.get(k).slice();
      sel = sel.includes(t.dataset.tr) ? sel.filter(x => x !== t.dataset.tr) : sel.concat(t.dataset.tr);
      if (!sel.length) return toast('Pilih minimal satu terjemahan');
      Prefs.set(k, sel); return rerender();
    }
    const key = t.dataset.key;
    switch (t.dataset.act) {
      case 'bm': { const on = toggleBookmark(key); t.classList.toggle('on', on); t.textContent = on ? '★' : '☆'; break; }
      case 'hl': highlightSheet(key); break;
      case 'note': noteSheet(key, resolve(key).label); break;
      case 'copy': Native.copy(verseText(key)); toast('Ayat disalin'); break;
      case 'share': Native.share({ title: resolve(key).label, text: verseText(key) }); break;
      case 'play': playKey(key); break;
      case 'more': moreSheet(key); break;
      case 'mem': addMemorize(key); break;
      case 'display': displaySheet(); break;
    }
  }

  // =================================================================== VIEWS
  const routes = [];
  const route = (re, fn) => routes.push([re, fn]);
  let current = null;
  function rerender() { if (current) current(); }
  function router() {
    closeDrawer(); if ($('#sheet').classList.contains('open')) closeSheet();
    revokeURLs(); if (thumbObs) { thumbObs.disconnect(); thumbObs = null; }
    const hash = location.hash || '#/home'; const [path, qs] = hash.slice(1).split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const [re, fn] of routes) {
      const m = path.match(re);
      if (m) { current = () => fn(m.slice(1), params); current(); if (!params.v) window.scrollTo(0, 0); return; }
    }
    go('#/home');
  }

  // ---------- Beranda
  route(/^\/home$/, () => {
    setTitle('BY NATAN', 'home');
    const hr = new Date().getHours(); const greet = hr < 11 ? 'Selamat pagi' : hr < 15 ? 'Selamat siang' : hr < 18 ? 'Selamat sore' : 'Selamat malam';
    const pool = [];
    Object.entries(D.bible.verses).forEach(([ch, a]) => a.forEach(v => pool.push('B:' + ch + '.' + v.v)));
    Object.entries(D.quran.surah).forEach(([s, a]) => a.forEach(v => pool.push('Q:' + s + '.' + v.v)));
    Object.entries(D.hadith.items).forEach(([k, a]) => a.forEach(h => pool.push('H:' + k + ':' + h.no)));
    const day = Math.floor(Date.now() / 864e5); const daily = resolve(pool[day % pool.length]);
    const p = Prefs.all(); const lb = CANON.book(p.lastBible.b);
    const planHtml = D.topics.plans.map(pl => { const done = (p.plans[pl.id] || []).length; const pct = Math.round(done / pl.days.length * 100);
      return `<a class="card" href="#/plans/${pl.id}" style="display:block"><div class="row between"><b>${esc(pl.name)}</b><small>${done}/${pl.days.length}</small></div><div class="progress" style="margin-top:8px"><span style="width:${pct}%"></span></div></a>`; }).join('');
    view.innerHTML = `
      <section class="hero"><small>${greet} 👋</small><h1>NATS BY NATAN</h1><small>Belajar kitab suci dari bahasa aslinya</small>
        <a class="daily" href="${daily.route}" style="display:block"><small>✦ BACAAN HARI INI · ${esc(daily.label)}</small>
          <div class="orig" style="font-family:var(--font-${daily.script === 'grc' ? 'grc' : daily.script});direction:${daily.script === 'grc' ? 'ltr' : 'rtl'};margin:6px 0">${esc(daily.orig || '')}</div>
          <div style="font-style:italic;color:rgba(255,255,255,.7);font-size:13px">${esc(daily.translit || '')}</div>
          <div style="margin-top:6px">${esc(daily.tr || '')}</div></a></section>
      <div class="big-cards">
        <a class="big-card bc-pl" href="#/bible?b=GEN&c=1"><span class="glyph">א</span><b>Perjanjian Lama</b><small>Ibrani · translit · terjemahan</small></a>
        <a class="big-card bc-pb" href="#/bible?b=JHN&c=1"><span class="glyph">Ω</span><b>Perjanjian Baru</b><small>Yunani · translit · terjemahan</small></a>
        <a class="big-card bc-q" href="#/quran"><span class="glyph">ق</span><b>Al-Qur'an</b><small>Arab · latin · Kemenag · tafsir</small></a>
        <a class="big-card bc-h" href="#/hadith"><span class="glyph">❖</span><b>Hadits 9 Imam</b><small>Cari nomor & tema</small></a></div>
      <div class="section-title"><h3>Lanjutkan</h3></div>
      <div class="chips"><a class="chip" href="#/bible?b=${p.lastBible.b}&c=${p.lastBible.c}">✝ ${esc(lb ? lb.name : '')} ${p.lastBible.c}</a>
        <a class="chip" href="#/quran/${p.lastQuran}">☪ QS ${esc(CANON.surahs[p.lastQuran - 1].name)}</a>
        <a class="chip" href="#/hadith/${p.lastHadith.k}/${p.lastHadith.n}">❖ ${esc(kitab(p.lastHadith.k).name)} ${p.lastHadith.n}</a></div>
      <div class="section-title"><h3>Semua fitur</h3></div>
      <div class="tiles">
        ${[['#/lexicon', 'Ａ', 'Leksikon'], ['#/topics', '◎', 'Studi Tema'], ['#/plans', '☑', 'Rencana'], ['#/memorize', '♲', 'Hafalan'], ['#/notes', '✎', 'Catatan'], ['#/library', '▤', 'Pustaka'], ['#/search', '⌕', 'Cari Web'], ['#/settings', '⚙', 'Pengaturan']]
          .map(([h, i, n]) => `<a class="tile" href="${h}"><i>${i}</i>${n}</a>`).join('')}</div>
      <div class="section-title"><h3>Rencana bacaan</h3><a href="#/plans" class="muted">Semua ›</a></div>${planHtml}
      ${p.history.length ? `<div class="section-title"><h3>Riwayat</h3></div><div class="card">${p.history.slice(0, 5).map(h => `<a class="list-item" href="${h.route}"><span class="grow">${esc(h.label)}</span><small>${fmtDate(h.t)}</small></a>`).join('')}</div>` : ''}`;
  });

  // ---------- Alkitab
  // Bilah atas khusus Alkitab: [☰]  [Nama Kitab Pasal ▾] [Terjemahan ▾]  [🔍]
  const trLabel = () => { const s = Prefs.get('bibleTr'); return s.length > 2 ? s[0] + ' +' + (s.length - 1) : s.join(' · '); };
  function bibleAppbar(bk, c) {
    const t = $('.appbar-title'); t.classList.add('center');
    t.innerHTML = `<button class="ab-ref" id="abRef" aria-label="Pilih kitab, pasal, ayat"><span>${esc(bk.name)} ${c}</span><i>▾</i></button>
      <button class="ab-tr" id="abTr" aria-label="Pilih terjemahan">${esc(trLabel())}<i>▾</i></button>`;
    $('#abRef').onclick = () => refPicker(bk, c);
    $('#abTr').onclick = translationSheet;
    $('#btnSearch').onclick = () => bibleSearchSheet('');
  }
  route(/^\/bible$/, (m, q) => {
    const p = Prefs.all(); const b = q.b || p.lastBible.b; const c = +(q.c || p.lastBible.c); const bk = CANON.book(b) || CANON.books[0];
    Prefs.set('lastBible', { b: bk.id, c }); pushHistory(bk.name + ' ' + c, `#/bible?b=${bk.id}&c=${c}`);
    setTitle('', 'bible'); bibleAppbar(bk, c);
    const vs = chapter(bk.id, c);
    const body = vs.length ? vs.map(v => verseCard({
      key: `B:${bk.id}.${c}.${v.v}`, num: v.v, kind: 'bible', script: bk.lang, label: `${bk.name} ${c}:${v.v}`,
      orig: v.orig, translit: v.translit, words: v.words, xref: v.xref,
      trs: p.bibleTr.filter(id => v.tr[id]).map(id => [id, v.tr[id]]),
      extra: v.note ? `<details class="v-extra"><summary>Catatan studi</summary>${esc(v.note)}</details>` : ''
    })).join('') : `<div class="card empty"><span class="big">📜</span><b>${esc(bk.name)} ${c} belum ada di data lokal</b>
        <p>Impor dataset Alkitab lengkap (format JSON) di Pengaturan, atau buka pasal ini di web.</p>
        <div class="row wrap" style="justify-content:center"><a class="btn primary sm" href="#/settings">Impor data</a>
        <button class="btn sm" data-url="https://biblehub.com/interlinear/${bk.slug}/${c}.htm">Bible Hub ↗</button>
        <button class="btn sm" data-url="https://alkitab.sabda.org/passage.php?passage=${encodeURIComponent(bk.abbr + ' ' + c)}">SABDA ↗</button></div></div>`;
    view.innerHTML = `<div class="reader-bar slim">${readerControls('bible', { chips: false })}</div>
      <div class="chapter-head"><div class="kicker">${bk.testament === 'PL' ? 'Perjanjian Lama · Tanakh · עִבְרִית' : 'Perjanjian Baru · Kainē Diathēkē · Ἑλληνική'}</div>
        <h2 id="chHead" role="button">${esc(bk.name)} ${c}</h2>
        <small>Ketuk kata asli untuk arti, Strong, morfologi & konkordansi</small></div>
      ${body}
      <div class="row between" style="margin-top:16px">${navBtn(bk, c, -1)}${navBtn(bk, c, 1)}</div>`;
    $('#chHead').onclick = () => refPicker(bk, c, 'ch');
    if (q.v) flashVerse(q.v);
  });
  function navBtn(bk, c, d) {
    let b = bk, nc = c + d;
    if (nc < 1) { b = CANON.books[bk.index - 1]; if (!b) return '<span></span>'; nc = b.chapters; }
    if (nc > bk.chapters) { b = CANON.books[bk.index + 1]; if (!b) return '<span></span>'; nc = 1; }
    return `<a class="btn" href="#/bible?b=${b.id}&c=${nc}">${d < 0 ? '‹ ' : ''}${esc(b.name)} ${nc}${d > 0 ? ' ›' : ''}</a>`;
  }
  function flashVerse(v) { setTimeout(() => { const el = document.getElementById('v-' + v); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }, 80); }
  function openRef(b, c, v) {
    const h = `#/bible?b=${b}&c=${c}${v ? '&v=' + v : ''}`; closeSheet();
    if (location.hash === h) { if (v) flashVerse(v); } else go(h);
  }

  /** Pemilih bertahap: Kitab → Pasal → Ayat (gaya Alkitab SABDA) */
  function refPicker(bk, cur, start) {
    const st = { b: bk, c: start === 'ch' || start === 'v' ? cur : cur, tab: start || 'book', test: bk.testament, f: '' };
    const hasBook = id => Object.keys(D.bible.verses).some(k => k.startsWith(id + '.'));
    openSheet(`<div class="tabs" id="rpTabs"><button data-tab="book"></button><button data-tab="ch"></button><button data-tab="v"></button></div><div id="rpBody"></div>`, el => {
      const body = $('#rpBody', el);
      const draw = () => {
        $$('#rpTabs button', el).forEach(b => {
          b.classList.toggle('on', b.dataset.tab === st.tab);
          b.textContent = { book: '📖 ' + st.b.name, ch: 'Pasal ' + (st.c || '–'), v: 'Ayat' }[b.dataset.tab];
        });
        if (st.tab === 'book') {
          body.innerHTML = `<div class="seg" style="margin-top:6px"><button data-t="PL" class="${st.test === 'PL' ? 'on' : ''}">Perjanjian Lama (39)</button><button data-t="PB" class="${st.test === 'PB' ? 'on' : ''}">Perjanjian Baru (27)</button></div>
            <input id="rpF" placeholder="Cari kitab… (mis. Yoh, Mazmur)" value="${esc(st.f)}" style="margin:10px 0">
            <div class="book-list">${CANON.books.filter(b => (st.f ? true : b.testament === st.test) && (b.name.toLowerCase().includes(st.f) || b.abbr.toLowerCase().startsWith(st.f)))
              .map(b => `<button data-book="${b.id}" class="${hasBook(b.id) ? 'has' : ''} ${b.id === st.b.id ? 'cur' : ''}">${esc(b.name)}<small class="muted">${b.chapters} pasal${hasBook(b.id) ? ' · ✓ data' : ''}</small></button>`).join('')}</div>`;
          $$('[data-t]', body).forEach(b => b.onclick = () => { st.test = b.dataset.t; st.f = ''; draw(); });
          const f = $('#rpF', body); f.oninput = () => { st.f = f.value.toLowerCase().trim(); const pos = f.selectionStart; draw(); const nf = $('#rpF', body); nf.focus(); nf.setSelectionRange(pos, pos); };
          $$('[data-book]', body).forEach(b => b.onclick = () => { st.b = CANON.book(b.dataset.book); st.c = 0; st.f = ''; st.tab = 'ch'; draw(); });
        } else if (st.tab === 'ch') {
          body.innerHTML = `<p class="muted" style="margin:8px 0">${esc(st.b.name)} — pilih pasal</p><div class="grid-pick">${Array.from({ length: st.b.chapters }, (_, i) => i + 1)
            .map(n => `<button class="${chapter(st.b.id, n).length ? 'has' : ''} ${n === st.c ? 'cur' : ''}" data-ch="${n}">${n}</button>`).join('')}</div>`;
          $$('[data-ch]', body).forEach(b => b.onclick = () => { st.c = +b.dataset.ch; st.tab = 'v'; draw(); });
        } else {
          if (!st.c) { st.tab = 'ch'; return draw(); }
          const vs = chapter(st.b.id, st.c);
          body.innerHTML = `<p class="muted" style="margin:8px 0">${esc(st.b.name)} ${st.c} — pilih ayat</p>
            ${vs.length ? `<div class="grid-pick">${vs.map(v => `<button class="has" data-v="${v.v}">${v.v}</button>`).join('')}</div>`
              : `<div class="empty">Ayat pasal ini belum ada di data lokal.</div>`}
            <button class="btn primary block" id="rpOpen" style="margin-top:14px">Buka ${esc(st.b.name)} ${st.c}</button>`;
          $$('[data-v]', body).forEach(b => b.onclick = () => openRef(st.b.id, st.c, b.dataset.v));
          $('#rpOpen', body).onclick = () => openRef(st.b.id, st.c);
        }
      };
      $$('#rpTabs button', el).forEach(b => b.onclick = () => { st.tab = b.dataset.tab; draw(); });
      draw();
    });
  }

  /** Pilih banyak terjemahan sekaligus (urutan tampil mengikuti urutan dicentang) */
  function translationSheet() {
    const p = Prefs.all();
    const draw = el => {
      const sel = Prefs.get('bibleTr');
      $('#trList', el).innerHTML = D.bible.translations.map(t => {
        const i = sel.indexOf(t.id);
        return `<div class="toggle" data-trid="${t.id}"><span><b>${esc(t.id)}</b> ${i >= 0 ? `<span class="badge">#${i + 1}</span>` : ''}<br><small class="muted">${esc(t.name)} · ${t.lang === 'id' ? 'Indonesia' : t.lang === 'en' ? 'Inggris' : esc(t.lang)}</small></span>
          <button class="switch ${i >= 0 ? 'on' : ''}"></button></div>`;
      }).join('');
      $$('[data-trid]', el).forEach(r => r.onclick = () => {
        let s = Prefs.get('bibleTr').slice(); const id = r.dataset.trid;
        s = s.includes(id) ? s.filter(x => x !== id) : s.concat(id);
        if (!s.length) return toast('Pilih minimal satu terjemahan');
        Prefs.set('bibleTr', s); draw(el);
      });
    };
    openSheet(`<h3>Pilih terjemahan</h3><p class="muted" style="margin-top:0">Centang beberapa terjemahan untuk ditampilkan berdampingan di setiap ayat.</p>
      <div id="trList"></div>
      <div class="toggle"><span>Teks asli (Ibrani / Yunani)</span><button class="switch ${p.showOrig ? 'on' : ''}" data-sw="showOrig"></button></div>
      <div class="toggle"><span>Transliterasi Latin</span><button class="switch ${p.showTranslit ? 'on' : ''}" data-sw="showTranslit"></button></div>
      <small class="muted">Terjemahan lain (mis. AYT, TB) dapat ditambahkan lewat Pengaturan ▸ Impor dataset.</small>
      <button class="btn primary block" id="trDone" style="margin-top:14px">Terapkan</button>`, el => {
      draw(el);
      $$('[data-sw]', el).forEach(b => b.onclick = () => { Prefs.set(b.dataset.sw, !Prefs.get(b.dataset.sw)); b.classList.toggle('on'); });
      $('#trDone', el).onclick = () => { closeSheet(); rerender(); };
    });
  }

  /** Cari Alkitab: referensi ayat ("Yoh 3:16", "kej 1") atau kata kunci di semua terjemahan */
  function findBook(s) {
    const n = s.toLowerCase().replace(/[\s.]/g, '');
    if (!n) return null;
    return CANON.books.find(b => b.abbr.toLowerCase() === n || b.id.toLowerCase() === n || b.name.toLowerCase().replace(/\s/g, '') === n)
      || CANON.books.find(b => b.name.toLowerCase().replace(/\s/g, '').startsWith(n) || b.slug.replace(/_/g, '').startsWith(n));
  }
  function parseRef(s) {
    const m = s.trim().match(/^(\d?\s*[a-zA-Z][a-zA-Z.\- ]*?)\s*(\d+)?(?:\s*[:.,]\s*(\d+)(?:\s*-\s*\d+)?)?$/);
    if (!m) return null; const bk = findBook(m[1]); if (!bk) return null;
    const c = m[2] ? Math.min(+m[2], bk.chapters) : 0; return { bk, c, v: m[3] ? +m[3] : 0 };
  }
  function bibleSearchSheet(initial) {
    let scope = 'all';
    openSheet(`<h3>🔍 Cari di Alkitab</h3>
      <div class="search-box"><input id="bsQ" type="search" placeholder="Ayat (Yoh 3:16) atau kata kunci (kasih)" value="${esc(initial || '')}" enterkeyhint="search"></div>
      <div class="chips" style="margin:10px 0"><button class="chip on" data-sc="all">Semua</button><button class="chip" data-sc="PL">Perjanjian Lama</button><button class="chip" data-sc="PB">Perjanjian Baru</button></div>
      <div id="bsRes"><small class="muted">Contoh: <b>Kej 1:1</b>, <b>Mazmur 23</b>, <b>Yohanes 3:16</b>, <b>terang</b>, <b>logos</b>, <b>G25</b></small></div>`, el => {
      const qEl = $('#bsQ', el); setTimeout(() => qEl.focus(), 250);
      const run = () => {
        const s = qEl.value.trim(); const box = $('#bsRes', el); if (!s) return;
        const out = []; const ref = parseRef(s);
        if (ref) {
          if (ref.c) out.push(`<a class="result" style="display:block" data-goref="${ref.bk.id}|${ref.c}|${ref.v || ''}"><span class="src bible">Buka referensi</span><br><b>${esc(ref.bk.name)} ${ref.c}${ref.v ? ':' + ref.v : ''}</b></a>`);
          else out.push(`<a class="result" style="display:block" data-pickbook="${ref.bk.id}"><span class="src bible">Kitab</span><br><b>${esc(ref.bk.name)}</b> — pilih pasal</a>`);
        }
        const L = s.toLowerCase(); let n = 0;
        Object.entries(D.bible.verses).forEach(([ch, arr]) => {
          const [b, c] = ch.split('.'); const bk = CANON.book(b); if (!bk || (scope !== 'all' && bk.testament !== scope)) return;
          arr.forEach(v => {
            if (n >= 150) return;
            const trs = Object.entries(v.tr);
            const hitTr = trs.find(([, t]) => t.toLowerCase().includes(L));
            const hitWord = (v.words || []).find(w => [w[0], w[1], w[2], w[3]].join(' ').toLowerCase().includes(L));
            if (hitTr || hitWord || (v.translit || '').toLowerCase().includes(L) || (v.orig || '').includes(s)) {
              n++; const show = hitTr ? hitTr : [Prefs.get('bibleTr')[0], v.tr[Prefs.get('bibleTr')[0]] || trs[0][1]];
              out.push(`<a class="result" style="display:block" data-goref="${b}|${c}|${v.v}"><span class="src bible">${esc(bk.name)} ${c}:${v.v} · ${esc(show[0])}</span><br>${hlText(show[1], s)}${hitWord && !hitTr ? `<br><small class="muted">${esc(hitWord[0])} · ${esc(hitWord[1])} · ${esc(hitWord[3])} — “${esc(hitWord[2])}”</small>` : ''}</a>`);
            }
          });
        });
        box.innerHTML = out.length ? (n ? `<small class="muted">${n} ayat ditemukan${n >= 150 ? ' (150 pertama)' : ''}</small>` : '') + out.join('')
          : `<div class="empty">Tidak ditemukan “${esc(s)}”.<br><button class="btn sm" style="margin-top:10px" data-url="https://alkitab.sabda.org/search.php?search=${encodeURIComponent(s)}">Cari di SABDA ↗</button></div>`;
        $$('[data-goref]', box).forEach(a => a.onclick = () => { const [b, c, v] = a.dataset.goref.split('|'); openRef(b, c, v); });
        $$('[data-pickbook]', box).forEach(a => a.onclick = () => refPicker(CANON.book(a.dataset.pickbook), 0, 'ch'));
      };
      let tmr; qEl.oninput = () => { clearTimeout(tmr); tmr = setTimeout(run, 250); };
      qEl.onkeydown = e => { if (e.key === 'Enter') run(); };
      $$('[data-sc]', el).forEach(b => b.onclick = () => { scope = b.dataset.sc; $$('[data-sc]', el).forEach(x => x.classList.toggle('on', x === b)); run(); });
      if (initial) run();
    });
  }

  // ---------- Al-Qur'an
  route(/^\/quran$/, (m, q) => {
    setTitle("Al-Qur'an · 114 Surah", 'quran');
    const list = f => CANON.surahs.filter(s => !f || s.name.toLowerCase().includes(f) || String(s.no) === f).map(s => `
      <a class="list-item" href="#/quran/${s.no}"><span class="list-num">${s.no}</span><span class="grow"><b>${esc(s.name)}</b><br><small>${s.ayat} ayat ${surah(s.no).length ? '· <span style="color:var(--c-quran)">✓ tersedia offline</span>' : ''}</small></span>›</a>`).join('');
    view.innerHTML = `<div class="card" style="background:linear-gradient(150deg,#19a37a,#0d5b4a);color:#fff;border:0">
        <div class="bismillah" style="color:#fff;margin:0">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
        <div class="row between"><small style="color:rgba(255,255,255,.8)">Terakhir dibaca</small><a class="btn sm" href="#/quran/${Prefs.get('lastQuran')}">QS ${esc(CANON.surahs[Prefs.get('lastQuran') - 1].name)} ›</a></div></div>
      <input id="sf" placeholder="Cari surah (nama atau nomor)…"><div class="card" style="margin-top:12px;padding:4px 14px" id="sl">${list('')}</div>`;
    $('#sf').oninput = e => { $('#sl').innerHTML = list(e.target.value.toLowerCase().trim()); };
  });
  route(/^\/quran\/(\d+)$/, ([s], q) => {
    const su = CANON.surahs[+s - 1]; if (!su) return go('#/quran');
    Prefs.set('lastQuran', su.no); pushHistory('QS ' + su.name, '#/quran/' + su.no); setTitle("Al-Qur'an · " + su.name, 'quran');
    const p = Prefs.all(); const ay = surah(su.no);
    const body = ay.length ? ay.map(v => verseCard({
      key: `Q:${su.no}.${v.v}`, num: v.v, kind: 'quran', script: 'ar', label: `QS ${su.name} ${su.no}:${v.v}`,
      orig: v.orig, translit: v.translit, words: v.words, trs: p.quranTr.filter(id => v.tr[id]).map(id => [id, v.tr[id]]),
      extra: v.tafsir ? `<details class="v-extra"><summary>Tafsir ringkas</summary>${esc(v.tafsir)}</details>` : ''
    })).join('') : `<div class="card empty"><span class="big">📖</span><b>Surah ${esc(su.name)} belum ada di data lokal</b><p>Impor dataset Al-Qur'an lengkap di Pengaturan, atau dengarkan murottal & baca di web.</p>
        <div class="row wrap" style="justify-content:center"><a class="btn primary sm" href="#/settings">Impor data</a><button class="btn sm" data-url="https://quran.com/${su.no}">Quran.com ↗</button><button class="btn sm" data-url="https://quran.kemenag.go.id/">Kemenag ↗</button></div></div>`;
    view.innerHTML = `<div class="reader-bar"><div class="row"><button class="ref-btn" id="pickS">${su.no}. ${esc(su.name)} ▾</button><span class="grow"></span>
        <button class="chip" id="playAll">▶ Murottal</button></div>${readerControls('quran')}</div>
      <div class="chapter-head"><div class="kicker">Surah ke-${su.no} · ${su.ayat} ayat</div><h2>${esc(su.name)}</h2><small>Ketuk kata Arab untuk arti per kata & akar kata</small></div>
      ${su.no !== 1 && su.no !== 9 ? '<div class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>' : ''}${body}
      <div class="row between" style="margin-top:16px">${su.no > 1 ? `<a class="btn" href="#/quran/${su.no - 1}">‹ ${esc(CANON.surahs[su.no - 2].name)}</a>` : '<span></span>'}${su.no < 114 ? `<a class="btn" href="#/quran/${su.no + 1}">${esc(CANON.surahs[su.no].name)} ›</a>` : ''}</div>`;
    $('#pickS').onclick = () => go('#/quran');
    $('#playAll').onclick = () => playQuran(Array.from({ length: su.ayat }, (_, i) => [su.no, i + 1]));
    if (q.v) flashVerse(q.v);
  });

  // ---------- Hadits — sumber: Hadith API GadingDev (api.hadith.gading.dev, tanpa API key)
  //            + cache IndexedDB agar bisa dibaca & dicari offline, + catatan studi NATS (syarah/faidah) bila cocok
  const HAPI = 'https://api.hadith.gading.dev';
  const API_ID = { bukhari: 'bukhari', muslim: 'muslim', abudawud: 'abu-daud', tirmidzi: 'tirmidzi', nasai: 'nasai', ibnumajah: 'ibnu-majah', ahmad: 'ahmad', malik: 'malik', darimi: 'darimi' };
  const THEMES = {
    'Niat & Ikhlas': ['niat', 'ikhlas'], 'Iman': ['iman', 'beriman'], 'Akhlak': ['akhlak', 'budi pekerti', 'perangai'], 'Ilmu': ['ilmu', 'menuntut ilmu'],
    'Shalat': ['shalat', 'salat', 'sembahyang'], 'Puasa': ['puasa', 'ramadhan'], 'Zakat & Sedekah': ['zakat', 'sedekah', 'infak'], 'Haji & Umrah': ['haji', 'umrah'],
    'Doa & Dzikir': ['doa', 'berdoa', 'dzikir', 'zikir'], 'Thaharah & Wudhu': ['wudhu', 'bersuci', 'mandi junub', 'tayamum'], 'Taubat': ['taubat', 'tobat', 'ampunan'],
    'Sabar & Syukur': ['sabar', 'syukur', 'bersyukur'], 'Orang Tua': ['ibu', 'bapak', 'orang tua', 'kedua orang tua'], 'Pernikahan': ['menikah', 'nikah', 'istri', 'suami'],
    'Persaudaraan': ['saudara', 'saudaranya'], 'Lisan': ['lisan', 'lidah', 'berdusta', 'ghibah'], 'Jual Beli & Riba': ['jual beli', 'riba', 'berdagang'], 'Takwa': ['takwa', 'bertakwa'],
    'Surga & Neraka': ['surga', 'neraka'], 'Kiamat': ['kiamat', 'hari akhir']
  };
  const HMEM = {}; // cache memori untuk resolve() (penanda, catatan, riwayat)
  let H_TOTALS = Object.assign({}, Prefs.get('hadithTotals') || {});
  const hTotal = k => H_TOTALS[k] || (kitab(k) || {}).total || 0;
  const normAr = s => String(s || '').replace(/[ً-ٰٟۖ-ۭـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^ء-ي]/g, '');

  async function apiGet(path, ms) {
    const j = await Native.getJSON(HAPI + path, ms);
    if (!j || j.error) throw new Error((j && j.message) || 'API error'); return j;
  }
  const toRec = (k, h) => ({ key: k + ':' + h.number, kitab: k, no: +h.number, arab: h.arab || '', terjemah: h.id || h.translation || '', t: Date.now() });
  /** Catatan studi NATS (derajat, perawi, syarah...) ditempelkan hanya bila teks Arabnya benar-benar sama */
  function withNotes(rec) {
    const s = hadithList(rec.kitab).find(x => x.no === rec.no) || hadithList(rec.kitab).find(x => { const a = normAr(x.arab).slice(0, 18); return a.length > 10 && normAr(rec.arab).includes(a); });
    if (s && normAr(rec.arab).includes(normAr(s.arab).slice(0, 18))) return Object.assign({}, s, { no: rec.no, arab: rec.arab, terjemah: rec.terjemah, notes: true, src: rec.src });
    return rec;
  }
  async function loadTotals() {
    try {
      const j = await apiGet('/books', 10000);
      (j.data || []).forEach(b => { const k = Object.keys(API_ID).find(x => API_ID[x] === b.id); if (k) H_TOTALS[k] = +b.available; });
      Prefs.set('hadithTotals', H_TOTALS); return true;
    } catch (e) { return false; }
  }
  async function getHadith(k, n) {
    const key = k + ':' + n; let rec = null;
    try { rec = await DB.get('hadith', key); } catch (e) { }
    if (rec) rec.src = 'offline';
    else {
      try {
        const j = await apiGet(`/books/${API_ID[k]}/${n}`);
        const c = j.data && (j.data.contents || (j.data.hadiths || [])[0]);
        if (c) { rec = toRec(k, c); DB.put('hadith', rec).catch(() => {}); rec.src = 'api'; if (j.data.available) H_TOTALS[k] = +j.data.available; }
      } catch (e) { rec = null; }
    }
    if (!rec) { const s = hadithGet(k, n); if (s) rec = Object.assign({}, s, { kitab: k, src: 'contoh', notes: true }); }
    if (rec && rec.src !== 'contoh') rec = withNotes(rec);
    if (rec) HMEM[key] = rec;
    return rec;
  }
  async function getRange(k, from, to) {
    // pakai cache bila lengkap, selain itu ambil dari API (maks 300/permintaan)
    let cached = [];
    try { cached = (await DB.byIndex('hadith', 'kitab', k)).filter(h => h.no >= from && h.no <= to); } catch (e) { }
    if (cached.length >= to - from + 1) return cached.sort((a, b) => a.no - b.no);
    const j = await apiGet(`/books/${API_ID[k]}?range=${from}-${to}`);
    const recs = ((j.data && j.data.hadiths) || []).map(h => toRec(k, h));
    if (j.data && j.data.available) H_TOTALS[k] = +j.data.available;
    if (recs.length) DB.putMany('hadith', recs).catch(() => {});
    return recs;
  }
  let dlCancel = false;
  async function downloadKitab(k, onProg) {
    dlCancel = false; const total = hTotal(k); let done = 0;
    for (let a = 1; a <= total && !dlCancel; a += 300) {
      const b = Math.min(total, a + 299);
      let tries = 0;
      while (true) { try { await getRange(k, a, b); break; } catch (e) { if (++tries >= 3) throw e; await new Promise(r => setTimeout(r, 1500)); } }
      done = b; onProg && onProg(done, total);
    }
    Prefs.set('hadithTotals', H_TOTALS);
    return !dlCancel;
  }
  /** Cari di cache offline tanpa memuat semuanya ke memori sekaligus */
  async function searchHadith(words, max) {
    const W = words.map(w => w.toLowerCase()); const out = [];
    try {
      await DB.each('hadith', h => {
        const t = (h.terjemah || '').toLowerCase();
        if (W.some(w => t.includes(w)) || W.some(w => w.length > 2 && normAr(h.arab).includes(normAr(w)) && /[؀-ۿ]/.test(w))) out.push(h);
        return out.length < (max || 200);
      });
    } catch (e) { }
    // tambahkan hadits contoh bertema/berkata kunci yang belum ada
    Object.entries(D.hadith.items).forEach(([k, arr]) => arr.forEach(s => {
      if (out.find(o => o.kitab === k && o.no === s.no)) return;
      if (W.some(w => [s.terjemah, s.perawi, s.bab, (s.tema || []).join(' ')].join(' ').toLowerCase().includes(w))) out.push(Object.assign({ kitab: k }, s));
    }));
    return out;
  }
  async function offlineCounts() {
    const c = {}; for (const k of Object.keys(API_ID)) { try { c[k] = await DB.countIndex('hadith', 'kitab', k); } catch (e) { c[k] = 0; } } return c;
  }
  const hShort = k => kitab(k).name.replace(/^(Shahih|Sunan|Musnad|Muwatha') /, '');
  function hadithRow(k, hd, q) {
    const t = hd.terjemah || ''; return `<a class="list-item" href="#/hadith/${k}/${hd.no}"><span class="list-num">${hd.no}</span><span class="grow"><small class="src hadith">${esc(kitab(k).name)}</small><br><span class="hadith-preview">${hlText(t.slice(0, 160), q)}</span></span>›</a>`;
  }

  route(/^\/hadith$/, async () => {
    setTitle('Ensiklopedia Hadits · 9 Imam', 'hadith');
    const counts = await offlineCounts();
    const render = (online) => {
      view.innerHTML = `<div class="card"><div class="row between"><h3 style="margin:0">🔎 Cari berdasarkan nomor hadits</h3><small><span class="online-dot ${online === false ? 'off' : ''}"></span>${online === false ? 'Offline' : 'API GadingDev'}</small></div>
          <div class="num-pad" style="margin-top:10px"><select id="hk">${D.hadith.kitab.map(k => `<option value="${k.id}" ${Prefs.get('lastHadith').k === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select><input id="hn" type="number" inputmode="numeric" min="1" placeholder="No."></div>
          <small class="muted" id="hkInfo"></small>
          <button class="btn primary block" id="hgo" style="margin-top:10px">Buka hadits</button></div>
        <div class="card"><h3>🏷️ Cari berdasarkan tema</h3><div class="row wrap">${Object.keys(THEMES).map(t => `<a class="chip" href="#/hadith-tema/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div></div>
        <div class="card"><h3>🔤 Cari kata kunci</h3><div class="search-box"><input id="hq" type="search" placeholder="mis. niat, sabar, ibu, شهر" enterkeyhint="search"><button class="btn primary" id="hqb">Cari</button></div>
          <small class="muted">Mencari di hadits yang sudah tersimpan offline. Unduh kitab di bawah agar pencarian mencakup seluruh hadits.</small><div id="hres"></div></div>
        <div class="section-title"><h3>Kitab 9 Imam</h3></div>
        ${D.hadith.kitab.map(k => `<a class="kitab-card" href="#/hadith/${k.id}"><div class="kitab-icon">${SYM[k.id] || 'ح'}</div>
          <div class="grow"><b>${esc(k.name)}</b><div class="ar-name">${esc(k.ar)}</div><small>${esc(k.imam)} · ${hTotal(k.id).toLocaleString('id-ID')} hadits · ${counts[k.id] ? '⬇ ' + counts[k.id].toLocaleString('id-ID') + ' offline' : 'online'}</small></div>›</a>`).join('')}
        <p class="muted" style="text-align:center;font-size:12px">Teks hadits & terjemahan: Hadith API GadingDev (open-source, MIT) — api.hadith.gading.dev</p>`;
      const info = () => { const k = $('#hk').value; $('#hkInfo').textContent = `Nomor 1–${hTotal(k).toLocaleString('id-ID')}`; };
      $('#hk').onchange = info; info();
      const goNum = () => { const n = +$('#hn').value; const k = $('#hk').value; if (!n) return toast('Masukkan nomor hadits'); if (hTotal(k) && n > hTotal(k)) return toast(`${kitab(k).name} hanya sampai nomor ${hTotal(k)}`); go(`#/hadith/${k}/${n}`); };
      $('#hgo').onclick = goNum; $('#hn').onkeydown = e => { if (e.key === 'Enter') goNum(); };
      const doSearch = async () => {
        const s = $('#hq').value.trim(); if (!s) return; $('#hres').innerHTML = '<p class="prog">Mencari…</p>';
        const res = await searchHadith([s], 100);
        $('#hres').innerHTML = res.length ? `<small class="muted">${res.length}${res.length >= 100 ? '+' : ''} hasil</small>` + res.map(h => hadithRow(h.kitab, h, s)).join('') : '<p class="muted">Tidak ditemukan di hadits offline.</p>';
      };
      $('#hqb').onclick = doSearch; $('#hq').onkeydown = e => { if (e.key === 'Enter') doSearch(); };
    };
    render(); const ok = await loadTotals(); if (location.hash === '#/hadith') render(ok);
  });

  route(/^\/hadith-tema\/(.+)$/, async ([t]) => {
    t = decodeURIComponent(t); setTitle('Tema: ' + t, 'hadith');
    view.innerHTML = `<h2>🏷️ ${esc(t)}</h2><p class="prog">Mencari hadits bertema ${esc(t)}…</p>`;
    const words = THEMES[t] || [t]; const res = await searchHadith(words, 300); const counts = await offlineCounts();
    const dl = Object.keys(API_ID).filter(k => counts[k] < hTotal(k));
    const byK = {}; res.forEach(h => (byK[h.kitab] = byK[h.kitab] || []).push(h));
    view.innerHTML = `<h2>🏷️ ${esc(t)}</h2><p class="muted">${res.length}${res.length >= 300 ? '+' : ''} hadits ditemukan · kata kunci: ${words.map(esc).join(', ')}</p>
      ${dl.length ? `<div class="card"><small>Hasil tema berasal dari hadits yang tersimpan offline. Untuk hasil lengkap, unduh kitab: ${dl.map(k => `<a href="#/hadith/${k}" style="color:var(--accent);font-weight:700">${esc(hShort(k))}</a>`).join(' · ')}</small></div>` : ''}
      ${Object.entries(byK).map(([k, arr]) => `<div class="section-title"><h3>${esc(kitab(k).name)} (${arr.length})</h3></div><div class="card" style="padding:4px 14px">${arr.slice(0, 50).map(h => hadithRow(k, h, words[0])).join('')}</div>`).join('') || '<div class="empty">Belum ada hasil.</div>'}
      <div class="chips">${Object.keys(THEMES).map(x => `<a class="chip ${x === t ? 'on' : ''}" href="#/hadith-tema/${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}</div>`;
  });

  route(/^\/hadith\/(\w+)$/, async ([k], q) => {
    const kb = kitab(k); if (!kb) return go('#/hadith'); setTitle(kb.name, 'hadith');
    const PAGE = 30; let next = 1; const total = () => hTotal(k);
    let off = 0; try { off = await DB.countIndex('hadith', 'kitab', k); } catch (e) { }
    view.innerHTML = `<div class="kitab-card"><div class="kitab-icon">${SYM[k] || 'ح'}</div><div class="grow"><b>${esc(kb.name)}</b><div class="ar-name">${esc(kb.ar)}</div><small>${esc(kb.imam)} · ${total().toLocaleString('id-ID')} hadits</small></div></div>
      <div class="card"><div class="search-box"><input id="jn" type="number" inputmode="numeric" placeholder="Lompat ke nomor 1–${total()}"><button class="btn primary" id="jb">Buka</button></div></div>
      <div class="card"><div class="row between"><b>⬇ Simpan offline</b><small id="dlInfo">${off.toLocaleString('id-ID')} / ${total().toLocaleString('id-ID')}</small></div>
        <div class="progress" style="margin:10px 0"><span id="dlBar" style="width:${total() ? Math.min(100, off / total() * 100) : 0}%"></span></div>
        <div class="row"><button class="btn primary sm grow" id="dlGo">${off >= total() && off ? '✓ Tersimpan lengkap' : 'Unduh seluruh kitab'}</button><button class="btn sm" id="dlDel">Hapus offline</button></div>
        <small class="muted">Teks saja (tanpa gambar), ringan: ±1–4 MB per kitab. Setelah diunduh, kitab bisa dibaca & dicari tanpa internet.</small></div>
      <div class="section-title"><h3>Daftar hadits</h3></div><div class="card" style="padding:4px 14px" id="hl"></div>
      <button class="btn load-more" id="more">Muat ${PAGE} berikutnya</button>`;
    const load = async () => {
      const a = next, b = Math.min(total() || a + PAGE - 1, a + PAGE - 1); if (total() && a > total()) { $('#more').classList.add('hidden'); return; }
      $('#more').textContent = 'Memuat…';
      try {
        const arr = await getRange(k, a, b); arr.forEach(h => { HMEM[k + ':' + h.no] = h; });
        $('#hl').insertAdjacentHTML('beforeend', arr.map(h => hadithRow(k, h)).join('')); next = b + 1;
        $('#more').textContent = `Muat ${PAGE} berikutnya`; if (total() && next > total()) $('#more').classList.add('hidden');
      } catch (e) {
        const samples = hadithList(k); if (a === 1 && samples.length) $('#hl').innerHTML = samples.map(h => hadithRow(k, h)).join('');
        $('#more').textContent = '⟳ Coba lagi (perlu internet)';
      }
    };
    $('#more').onclick = load; load();
    $('#jb').onclick = () => { const n = +$('#jn').value; if (n) go(`#/hadith/${k}/${n}`); };
    $('#dlGo').onclick = async () => {
      const btn = $('#dlGo'); if (btn.dataset.run) { dlCancel = true; return; }
      btn.dataset.run = 1; btn.textContent = '⏸ Batalkan';
      try {
        const ok = await downloadKitab(k, (d, t) => { if (!$('#dlInfo')) return; $('#dlInfo').textContent = `${d.toLocaleString('id-ID')} / ${t.toLocaleString('id-ID')}`; $('#dlBar').style.width = (d / t * 100) + '%'; });
        toast(ok ? kb.name + ' tersimpan offline' : 'Unduhan dibatalkan');
      } catch (e) { toast('Unduhan terhenti: periksa koneksi internet'); }
      if ($('#dlGo')) { delete btn.dataset.run; btn.textContent = 'Lanjutkan / perbarui unduhan'; }
    };
    $('#dlDel').onclick = () => confirmSheet(`Hapus ${kb.name} dari penyimpanan offline?`, async () => {
      await DB.delIndex('hadith', 'kitab', k);
      toast('Data offline dihapus'); rerender();
    });
  });

  route(/^\/hadith\/(\w+)\/(\d+)$/, async ([k, n]) => {
    const kb = kitab(k); if (!kb) return go('#/hadith'); n = +n; const key = `H:${k}:${n}`;
    Prefs.set('lastHadith', { k, n }); pushHistory(`${kb.name} no. ${n}`, `#/hadith/${k}/${n}`); setTitle(kb.name + ' · No. ' + n, 'hadith');
    view.innerHTML = `<div class="hadith-card"><div class="hadith-top"><small>${esc(kb.name)}</small><div class="no">Hadits No. ${n}</div></div><div class="empty prog">Memuat hadits…</div></div>`;
    const hd = await getHadith(k, n);
    if (location.hash.split('?')[0] !== `#/hadith/${k}/${n}`) return; // pengguna sudah pindah halaman
    const T = hTotal(k); const prev = n > 1 ? n - 1 : null; const next = !T || n < T ? n + 1 : null;
    const nav = `<div class="row between">${prev ? `<a class="btn" href="#/hadith/${k}/${prev}">‹ No. ${prev}</a>` : '<span></span>'}${next ? `<a class="btn" href="#/hadith/${k}/${next}">No. ${next} ›</a>` : ''}</div>`;
    if (!hd) {
      view.innerHTML = `<div class="hadith-card"><div class="hadith-top"><small>${esc(kb.name)}</small><div class="no">Hadits No. ${n}</div></div>
        <div class="empty"><span class="big">📡</span>Hadits ini belum tersimpan offline dan tidak dapat dimuat.<p>Periksa koneksi internet, lalu coba lagi. Unduh kitab ini agar bisa dibaca tanpa internet.</p>
        <div class="row wrap" style="justify-content:center"><button class="btn primary sm" onclick="location.reload()">⟳ Coba lagi</button><a class="btn sm" href="#/hadith/${k}">⬇ Unduh kitab</a></div></div></div>${nav}`;
      return;
    }
    if (next) getHadith(k, next).catch(() => {}); // pramuat hadits berikutnya
    const p = Prefs.all(); const bm = isBookmarked(key);
    const srcBadge = { api: '🌐 API GadingDev', offline: '⬇ Offline', contoh: '📦 Data contoh' }[hd.src] || '';
    const tk = (hd.takhrij || []).map(([kk, nn]) => `<a class="list-item" href="#/hadith/${kk}/${nn}"><span class="grow">${esc(kitab(kk) ? kitab(kk).name : kk)} no. ${nn}</span>›</a>`).join('');
    view.innerHTML = `<article class="hadith-card">
      <div class="hadith-top"><div class="row between"><small>${esc(kb.name)} · ${esc(kb.ar)}</small>${hd.derajat ? `<span class="badge ${derajatClass(hd.derajat)}">${esc(hd.derajat)}</span>` : ''}</div>
        <div class="no">Hadits No. ${n}</div>${hd.bab ? `<small>📂 ${esc(hd.bab)}</small><br>` : ''}${hd.perawi ? `<small>👤 Perawi: <b>${esc(hd.perawi)}</b></small><br>` : ''}<small class="muted">${srcBadge}</small></div>
      ${p.showOrig ? `<div class="hadith-arab">${esc(hd.arab)}</div>` : ''}
      <div class="hadith-body">${p.showTranslit && hd.translit ? `<div class="v-translit">${esc(hd.translit)}</div>` : ''}
        <div class="tr"><span class="tr-label" style="font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px;background:var(--surface-2);color:var(--muted)">TERJEMAH</span> ${esc(hd.terjemah)}</div>
        <div class="tabs" id="htabs">${hd.notes ? '<button data-tab="syarah">Syarah</button><button data-tab="faidah">Faidah</button>' : ''}<button data-tab="takhrij">Takhrij</button><button data-tab="tema">Tema</button><button data-tab="catatan">Catatan</button></div>
        <div id="hpanel"></div>
        <div class="v-actions"><button data-act="bm" data-key="${key}" class="${bm ? 'on' : ''}">${bm ? '★' : '☆'}</button><button data-act="note" data-key="${key}">✎</button><button data-act="copy" data-key="${key}">⧉</button><button data-act="share" data-key="${key}">⤴</button><button data-act="mem" data-key="${key}" title="Hafalkan">♲</button><button data-act="more" data-key="${key}">⋯</button></div></div></article>${nav}`;
    const note = p.notes.find(x => x.key === key);
    const themesOf = Object.entries(THEMES).filter(([, ws]) => ws.some(w => (hd.terjemah || '').toLowerCase().includes(w))).map(([t]) => t);
    const panels = {
      syarah: `<p>${esc(hd.syarah || 'Belum ada syarah.')}</p>`,
      faidah: `<ol>${(hd.faidah || []).map(f => `<li>${esc(f)}</li>`).join('') || '<li>Belum ada.</li>'}</ol>`,
      takhrij: (tk || '<p class="muted">Takhrij belum tersedia untuk hadits ini.</p>') + `<button class="btn sm" data-url="https://www.google.com/search?q=${encodeURIComponent('takhrij hadits ' + kb.name + ' nomor ' + n)}">Cari takhrij di Chrome ↗</button>`,
      tema: `<div class="row wrap">${[...new Set((hd.tema || []).concat(themesOf))].map(t => `<a class="chip" href="#/hadith-tema/${encodeURIComponent(t)}">${esc(t)}</a>`).join('') || '<span class="muted">Tidak ada tema yang cocok.</span>'}</div>`,
      catatan: note ? `<p>${esc(note.text)}</p>` : '<p class="muted">Belum ada catatan. Ketuk ✎ untuk menulis.</p>'
    };
    const show = t => { $('#hpanel').innerHTML = panels[t]; $$('#htabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); };
    $$('#htabs button').forEach(b => b.onclick = () => show(b.dataset.tab)); show(hd.notes ? 'syarah' : 'tema');
  });

  // ---------- Perpustakaan Digital (ringan: metadata terpisah dari file, thumbnail kecil, muat bertahap)
  const typeOf = f => /pdf/.test(f.type) || /\.pdf$/i.test(f.name) ? 'pdf' : /^image\//.test(f.type) ? 'image' : /^video\//.test(f.type) ? 'video' : /^audio\//.test(f.type) ? 'audio'
    : /^text\/|\.(txt|md|html?|csv)$/i.test(f.name) ? 'text' : 'file';
  const typeLabel = { pdf: 'PDF', web: 'WEB', note: 'CATATAN', image: 'GAMBAR', video: 'VIDEO', audio: 'AUDIO', text: 'TEKS', file: 'FILE' };
  const typeThumb = { pdf: ['t-pdf', 'PDF'], web: ['t-web', '🌐'], note: ['t-note', '✎'], image: ['t-image', '🖼'], video: ['t-image', '🎞'], audio: ['t-file', '🎵'], text: ['t-file', 'TXT'], file: ['t-file', '📎'] };
  const fmtSize = b => !b ? '0 KB' : b > 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  let URLS = [];
  const objURL = b => { const u = URL.createObjectURL(b); URLS.push(u); return u; };
  function revokeURLs() { URLS.forEach(u => URL.revokeObjectURL(u)); URLS = []; }
  let thumbObs = null;

  async function saveNoteToLib(title, text, folder) {
    await DB.put('library', { id: uid(), type: 'note', title, text, folder: folder || 'Umum', tags: [], created: Date.now() }); toast('Disimpan ke Perpustakaan');
  }
  function loadImg(blob) {
    return new Promise((res, rej) => { const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('gambar')); }; im.src = u; });
  }
  function canvasBlob(src, w, h, q) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h);
    return new Promise(r => c.toBlob(b => r(b), 'image/jpeg', q));
  }
  /** Kompres foto besar (sisi terpanjang maks 2048 px, JPEG 85%) — hemat memori HP hingga 70–90% */
  async function compressImage(file) {
    if (!Prefs.get('compressImg') || !/^image\/(jpeg|jpg|webp|png)$/.test(file.type) || file.size < 700 * 1024) return file;
    try {
      const im = await loadImg(file); const max = 2048; const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const b = await canvasBlob(im, Math.round(im.naturalWidth * s), Math.round(im.naturalHeight * s), 0.85);
      return b && b.size < file.size ? b : file;
    } catch (e) { return file; }
  }
  /** Thumbnail 320 px untuk grid (gambar, video, halaman pertama PDF) */
  async function makeThumb(blob, type) {
    try {
      if (type === 'image') { const im = await loadImg(blob); const s = 320 / Math.max(im.naturalWidth, im.naturalHeight); return await canvasBlob(im, Math.max(1, Math.round(im.naturalWidth * s)), Math.max(1, Math.round(im.naturalHeight * s)), 0.7); }
      if (type === 'video') {
        const v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; const u = URL.createObjectURL(blob); v.src = u;
        await new Promise((r, j) => { v.onloadeddata = r; v.onerror = j; setTimeout(j, 5000); });
        v.currentTime = Math.min(1, (v.duration || 2) / 2); await new Promise(r => { v.onseeked = r; setTimeout(r, 2000); });
        const s = 320 / Math.max(v.videoWidth, v.videoHeight); const t = await canvasBlob(v, Math.round(v.videoWidth * s), Math.round(v.videoHeight * s), 0.7); URL.revokeObjectURL(u); return t;
      }
      if (type === 'pdf') {
        const lib = await ensurePdfJs(); const doc = await lib.getDocument({ data: await blob.arrayBuffer() }).promise; const pg = await doc.getPage(1);
        const vp0 = pg.getViewport({ scale: 1 }); const vp = pg.getViewport({ scale: 320 / vp0.width }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; doc.destroy(); return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.7));
      }
    } catch (e) { }
    return null;
  }
  /** Simpan banyak file: kompres → thumbnail → metadata (kecil) + isi file (store terpisah) */
  async function saveFiles(files, folder) {
    files = Array.from(files || []); if (!files.length) return 0;
    closeSheet(); let n = 0;
    for (const f of files) {
      n++; toast(`Menyimpan ${n}/${files.length}…`);
      const type = typeOf(f); const blob = type === 'image' ? await compressImage(f) : f;
      const id = uid(); const thumb = await makeThumb(blob, type);
      await DB.put('files', { id, blob });
      if (thumb) await DB.put('files', { id: 't:' + id, blob: thumb });
      await DB.put('library', { id, type, title: (f.name || 'file').replace(/\.[^.]+$/, ''), fileName: f.name, mime: blob.type || f.type, size: blob.size, origSize: f.size, hasFile: true, hasThumb: !!thumb, folder: folder || 'Umum', tags: [], created: Date.now() + n });
    }
    toast(`✓ ${files.length} item disimpan ke Perpustakaan`);
    if (location.hash.startsWith('#/library')) rerender(); return files.length;
  }
  async function deleteItem(id) { await DB.del('library', id); await DB.del('files', id); await DB.del('files', 't:' + id); }

  route(/^\/library$/, async (m, q) => {
    setTitle('Perpustakaan Digital', 'library');
    const filter = q.t || 'all'; const folder = q.f || ''; const PAGE = 40;
    const metas = []; const folderSet = new Set(); let total = 0, bytes = 0;
    try { await DB.each('library', it => { total++; bytes += it.size || 0; folderSet.add(it.folder || 'Umum'); metas.push(it); }, 'created', 'prev'); } catch (e) { }
    const match = (i, s) => (filter === 'all' || i.type === filter || (filter === 'file' && /text|file|audio/.test(i.type))) && (!folder || (i.folder || 'Umum') === folder)
      && (!s || [i.title, i.url, i.text, (i.tags || []).join(' '), i.folder].join(' ').toLowerCase().includes(s));
    let est = ''; try { const e = await navigator.storage.estimate(); est = `${fmtSize(e.usage)} dari ${fmtSize(e.quota)}`; } catch (e) { }
    view.innerHTML = `<div class="row between"><h2>▤ Perpustakaan</h2><button class="chip" id="lMng">☑ Kelola</button></div>
      <small class="muted">${total.toLocaleString('id-ID')} item · ${fmtSize(bytes)} file${est ? ' · penyimpanan ' + est : ''}</small>
      <input id="lq" type="search" placeholder="Cari judul, tag, isi catatan…" style="margin:8px 0 10px">
      <div class="chips">${[['all', 'Semua'], ['image', 'Foto'], ['video', 'Video'], ['pdf', 'PDF'], ['web', 'Website'], ['note', 'Catatan'], ['file', 'File']].map(([t, n]) => `<a class="chip ${filter === t ? 'on' : ''}" href="#/library?t=${t}${folder ? '&f=' + encodeURIComponent(folder) : ''}">${n}</a>`).join('')}</div>
      ${folderSet.size ? `<div class="chips" style="margin-top:6px"><a class="chip ${!folder ? 'on' : ''}" href="#/library?t=${filter}">📁 Semua folder</a>${[...folderSet].map(f => `<a class="chip ${folder === f ? 'on' : ''}" href="#/library?t=${filter}&f=${encodeURIComponent(f)}">📁 ${esc(f)}</a>`).join('')}</div>` : ''}
      <div class="row hidden" id="mngBar" style="margin-top:10px"><small class="grow" id="selInfo">0 dipilih</small><button class="btn sm" id="selMove">📁 Pindah</button><button class="btn sm" id="selDel" style="color:#e5484d">🗑 Hapus</button></div>
      <div class="lib-grid" id="lg" style="margin-top:12px"></div><div id="lSentinel" style="height:40px"></div>
      <div id="lEmpty"></div>
      <button class="fab" id="fab" aria-label="Tambah">＋</button>`;
    let shown = [], page = 0, manage = false; const sel = new Set();
    const renderMore = () => {
      const slice = shown.slice(page * PAGE, (page + 1) * PAGE); page++;
      $('#lg').insertAdjacentHTML('beforeend', slice.map(libCard).join(''));
      $$('#lg .lib-item[data-thumb]:not([data-obs])').forEach(el => { el.dataset.obs = 1; thumbObs.observe(el); });
    };
    const apply = () => {
      const s = $('#lq').value.toLowerCase().trim(); shown = metas.filter(i => match(i, s)); page = 0; $('#lg').innerHTML = ''; renderMore();
      $('#lEmpty').innerHTML = shown.length ? '' : (total ? '<div class="empty">Tidak ada item yang cocok.</div>' : `<div class="empty"><span class="big">🗂️</span><b>Pustaka masih kosong</b><p>Ketuk ＋ untuk mengimpor foto & video dari galeri, memotret catatan, menyimpan PDF/e-book, link website, atau menulis catatan. Semua tersimpan di HP dan bisa dibuka offline.</p></div>`);
    };
    if (thumbObs) thumbObs.disconnect();
    thumbObs = new IntersectionObserver(ents => ents.forEach(async en => {
      if (!en.isIntersecting) return; const el = en.target; thumbObs.unobserve(el);
      try { const t = await DB.get('files', 't:' + el.dataset.thumb); if (t && t.blob) { const box = el.querySelector('.lib-thumb'); box.innerHTML = `<img src="${objURL(t.blob)}" alt="" loading="lazy">`; } } catch (e) { }
    }), { rootMargin: '300px' });
    new IntersectionObserver(ents => { if (ents[0].isIntersecting && page * PAGE < shown.length) renderMore(); }, { rootMargin: '400px' }).observe($('#lSentinel'));
    let tm; $('#lq').oninput = () => { clearTimeout(tm); tm = setTimeout(apply, 200); };
    $('#fab').onclick = () => addLibSheet(folder);
    // mode kelola: pilih banyak untuk hapus / pindah folder
    $('#lMng').onclick = () => { manage = !manage; sel.clear(); $('#mngBar').classList.toggle('hidden', !manage); $('#lMng').classList.toggle('on', manage); $$('#lg .sel-box').forEach(b => b.remove()); $('#selInfo').textContent = '0 dipilih'; };
    $('#lg').addEventListener('click', e => {
      if (!manage) return; const a = e.target.closest('.lib-item'); if (!a) return; e.preventDefault();
      const id = a.dataset.id; if (sel.has(id)) { sel.delete(id); a.querySelector('.sel-box') && a.querySelector('.sel-box').remove(); } else { sel.add(id); a.insertAdjacentHTML('beforeend', '<span class="sel-box" style="background:var(--accent)"></span>'); }
      $('#selInfo').textContent = sel.size + ' dipilih';
    });
    $('#selDel').onclick = () => sel.size && confirmSheet(`Hapus ${sel.size} item terpilih?`, async () => { for (const id of sel) await deleteItem(id); toast('Item dihapus'); rerender(); });
    $('#selMove').onclick = () => sel.size && openSheet(`<h3>Pindah ${sel.size} item ke folder</h3><input id="mvF" placeholder="Nama folder" list="fl"><datalist id="fl">${[...folderSet].map(f => `<option value="${esc(f)}">`).join('')}</datalist><button class="btn primary block" id="mvGo" style="margin-top:10px">Pindahkan</button>`, el => {
      $('#mvGo', el).onclick = async () => { const f = $('#mvF', el).value.trim() || 'Umum'; for (const id of sel) { const it = await DB.get('library', id); if (it) { it.folder = f; await DB.put('library', it); } } closeSheet(); toast('Dipindahkan ke ' + f); rerender(); };
    });
    apply();
  });
  function libCard(i) {
    const [cls, g] = typeThumb[i.type] || typeThumb.file;
    return `<a class="lib-item" href="#/library/${i.id}" data-id="${i.id}" ${i.hasThumb ? `data-thumb="${i.id}"` : ''}><div class="lib-thumb ${cls}">${g}</div><b>${esc(i.title)}</b><small class="muted">${typeLabel[i.type]}${i.size ? ' · ' + fmtSize(i.size) : ''} · ${esc(i.folder || 'Umum')}</small></a>`;
  }
  function addLibSheet(folder) {
    const f = folder || '';
    openSheet(`<h3>Tambah ke Perpustakaan</h3>
      <a class="list-item" id="addGal"><span class="list-num t-image" style="color:#fff">🖼</span><span class="grow"><b>Impor foto dari Galeri</b><br><small>Pilih banyak foto sekaligus · otomatis dikompres</small></span>›</a>
      <a class="list-item" id="addVid"><span class="list-num t-image" style="color:#fff">🎞</span><span class="grow"><b>Foto & video dari Galeri</b><br><small>Rekaman kajian, khotbah, video belajar</small></span>›</a>
      <a class="list-item" id="addCam"><span class="list-num t-note" style="color:#fff">📷</span><span class="grow"><b>Ambil foto dengan kamera</b><br><small>Potret catatan, papan tulis, halaman buku</small></span>›</a>
      <a class="list-item" id="addFile"><span class="list-num t-pdf" style="color:#fff">📄</span><span class="grow"><b>File & dokumen</b><br><small>PDF, e-book, Word, PowerPoint, audio, teks</small></span>›</a>
      <a class="list-item" id="addWeb"><span class="list-num t-web" style="color:#fff">🌐</span><span class="grow"><b>Simpan website / link</b><br><small>Artikel, video, halaman studi</small></span>›</a>
      <a class="list-item" href="#/library/new-note"><span class="list-num t-note" style="color:#fff">✎</span><span class="grow"><b>Tulis catatan</b><br><small>Ringkasan, khotbah, kajian</small></span>›</a>
      <input id="addFolder" placeholder="Simpan ke folder (opsional)" value="${esc(f)}" style="margin-top:10px">`, el => {
      const fold = () => $('#addFolder', el).value.trim();
      const run = async (fn, def) => { const fo = fold() || def; try { const files = await fn(); if (files && files.length) await saveFiles(files, fo); } catch (e) { if (!/cancel/i.test(e.message || '')) toast(e.message || 'Gagal mengimpor'); } };
      $('#addGal', el).onclick = () => run(() => Native.pickFromGallery({ limit: 0 }), 'Galeri');
      $('#addVid', el).onclick = () => run(() => Native.pickFromGallery({ video: true }), 'Galeri');
      $('#addCam', el).onclick = () => run(() => Native.takePhoto(), 'Foto Kamera');
      $('#addFile', el).onclick = () => run(() => Native.pickViaInput('.pdf,.epub,.txt,.md,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,audio/*,image/*,video/*', true), 'Umum');
      $('#addWeb', el).onclick = () => webForm();
    });
  }
  function webForm(prefill) {
    openSheet(`<h3>Simpan website</h3><div class="stack"><input id="wu" type="url" placeholder="https://…" value="${esc(prefill || '')}"><input id="wt" placeholder="Judul"><input id="wf" placeholder="Folder (mis. Kajian, Khotbah)" value="Umum">
      <input id="wg" placeholder="Tag, pisahkan koma"><textarea id="wn" rows="3" placeholder="Ringkasan / kutipan penting (opsional)"></textarea>
      <button class="btn sm" id="wpaste">📋 Tempel dari papan klip</button><button class="btn primary block" id="ws">Simpan</button></div>`, el => {
      $('#wpaste', el).onclick = async () => { try { $('#wu', el).value = await navigator.clipboard.readText(); } catch (e) { toast('Tempel manual dengan tekan lama'); } };
      $('#ws', el).onclick = async () => {
        let u = $('#wu', el).value.trim(); if (!u) return toast('Isi URL'); if (!/^https?:\/\//.test(u)) u = 'https://' + u;
        let host = u; try { host = new URL(u).hostname; } catch (e) { }
        await DB.put('library', { id: uid(), type: 'web', url: u, title: $('#wt', el).value.trim() || host, text: $('#wn', el).value, folder: $('#wf', el).value.trim() || 'Umum', tags: $('#wg', el).value.split(',').map(s => s.trim()).filter(Boolean), created: Date.now() });
        closeSheet(); toast('Website disimpan'); if (location.hash.startsWith('#/library')) rerender();
      };
    });
  }
  route(/^\/library\/new-note$/, () => noteEditor(null));
  route(/^\/library\/edit\/(\w+)$/, async ([id]) => noteEditor(await DB.get('library', id)));
  function noteEditor(item) {
    setTitle(item ? 'Edit catatan' : 'Catatan baru', 'library');
    view.innerHTML = `<div class="stack"><input id="nt" placeholder="Judul catatan" value="${esc(item ? item.title : '')}"><input id="nf" placeholder="Folder" value="${esc(item ? item.folder : 'Catatan Kajian')}">
      <textarea id="nb" class="note-area" placeholder="Tulis catatan… (bisa menyalin ayat/hadits dari pembaca)">${esc(item ? item.text : '')}</textarea>
      <div class="row"><button class="btn primary grow" id="ns">Simpan</button><a class="btn" href="#/library">Batal</a></div></div>`;
    $('#ns').onclick = async () => {
      const obj = Object.assign(item || { id: uid(), type: 'note', created: Date.now(), tags: [] }, { title: $('#nt').value.trim() || 'Tanpa judul', folder: $('#nf').value.trim() || 'Umum', text: $('#nb').value, updated: Date.now() });
      await DB.put('library', obj); toast('Tersimpan'); go('#/library/' + obj.id);
    };
  }
  route(/^\/library\/(\w+)$/, async ([id]) => {
    const it = await DB.get('library', id); if (!it) return go('#/library');
    setTitle(typeLabel[it.type], 'library');
    let blob = null; if (it.hasFile || it.blob) { const f = await DB.get('files', id); blob = (f && f.blob) || it.blob || null; }
    let body = '';
    if (it.type === 'note' || it.type === 'web') body = `${it.url ? `<button class="btn primary block" data-url="${esc(it.url)}">Buka di Chrome ↗</button><p class="muted" style="word-break:break-all">${esc(it.url)}</p>` : ''}<div style="white-space:pre-wrap;line-height:1.7">${esc(it.text || '')}</div>`;
    else if (!blob) body = `<div class="empty">File tidak ditemukan.</div>`;
    else if (it.type === 'image') body = `<img class="viewer-img" src="${objURL(blob)}" alt="" decoding="async">`;
    else if (it.type === 'video') body = `<video src="${objURL(blob)}" controls playsinline preload="metadata" style="width:100%;border-radius:14px;background:#000"></video>`;
    else if (it.type === 'audio') body = `<audio src="${objURL(blob)}" controls preload="metadata" style="width:100%"></audio>`;
    else if (it.type === 'text') body = `<div style="white-space:pre-wrap;line-height:1.7" id="txt">Memuat…</div>`;
    else if (it.type === 'pdf') body = `<div class="row between" style="margin-bottom:8px"><small id="pinfo">Memuat PDF…</small><div class="row"><button class="chip" id="zm">−</button><button class="chip" id="zp">＋</button></div></div><div class="pdf-wrap" id="pdf"></div>`;
    else body = `<div class="empty"><span class="big">📎</span>${esc(it.fileName)}<br><small>${fmtSize(it.size)}</small><p>Simpan ke folder Documents untuk dibuka dengan aplikasi lain.</p></div>`;
    view.innerHTML = `<div class="card"><small class="muted">${typeLabel[it.type]} · 📁 ${esc(it.folder || 'Umum')} · ${fmtDate(it.created)}${it.size ? ' · ' + fmtSize(it.size) : ''}${it.origSize && it.origSize > it.size ? ` (hemat ${fmtSize(it.origSize - it.size)})` : ''}</small><h2 style="margin-top:6px">${esc(it.title)}</h2>
        ${(it.tags || []).length ? `<div class="row wrap">${it.tags.map(t => `<span class="chip">#${esc(t)}</span>`).join('')}</div>` : ''}</div>
      <div class="card">${body}</div>
      <div class="row wrap">${it.type === 'note' ? `<a class="btn sm" href="#/library/edit/${it.id}">✎ Edit</a>` : ''}<button class="btn sm" id="lmeta">🏷 Folder & tag</button>
        ${blob ? '<button class="btn sm" id="lexp">⬇ Simpan ke HP</button>' : ''}<button class="btn sm" id="lsh">⤴ Bagikan</button><button class="btn sm" id="ldel" style="color:#e5484d">🗑 Hapus</button></div>`;
    if (it.type === 'text' && blob) $('#txt').textContent = (await blob.text()).slice(0, 500000);
    if (it.type === 'pdf' && blob) renderPdf(blob);
    $('#ldel').onclick = () => confirmSheet('Hapus item ini?', async () => { await deleteItem(id); go('#/library'); });
    $('#lsh').onclick = () => Native.share({ title: it.title, text: it.text || it.title, url: it.url });
    const ex = $('#lexp'); if (ex) ex.onclick = async () => { try { const path = await Native.saveFile(it.fileName || it.title, blob); toast('Tersimpan: ' + path); } catch (e) { toast('Gagal menyimpan: ' + e.message); } };
    $('#lmeta').onclick = () => openSheet(`<h3>Folder & tag</h3><div class="stack"><input id="mt" value="${esc(it.title)}" placeholder="Judul"><input id="mf" value="${esc(it.folder || 'Umum')}" placeholder="Folder"><input id="mg" value="${esc((it.tags || []).join(', '))}" placeholder="Tag"><button class="btn primary block" id="ms">Simpan</button></div>`, el => {
      $('#ms', el).onclick = async () => { Object.assign(it, { title: $('#mt', el).value, folder: $('#mf', el).value || 'Umum', tags: $('#mg', el).value.split(',').map(s => s.trim()).filter(Boolean) }); await DB.put('library', it); closeSheet(); rerender(); };
    });
  });
  function confirmSheet(msg, yes) {
    openSheet(`<h3>${esc(msg)}</h3><div class="row" style="margin-top:12px"><button class="btn primary grow" id="cy">Ya</button><button class="btn grow" id="cn">Batal</button></div>`, el => {
      $('#cy', el).onclick = () => { closeSheet(); yes(); }; $('#cn', el).onclick = closeSheet;
    });
  }
  // PDF via pdf.js (lokal di vendor/, fallback CDN) — halaman dirender hanya saat terlihat
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  async function ensurePdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    const sources = [['vendor/pdf.min.js', 'vendor/pdf.worker.min.js'], ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js']];
    for (const [lib, worker] of sources) { try { await loadScript(lib); window.pdfjsLib.GlobalWorkerOptions.workerSrc = worker; return window.pdfjsLib; } catch (e) { } }
    throw new Error('pdf.js tidak tersedia');
  }
  async function renderPdf(blob) {
    const box = $('#pdf'); let scale = 1;
    try {
      const lib = await ensurePdfJs(); const doc = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
      const first = await doc.getPage(1); const ratio = first.getViewport({ scale: 1 }).height / first.getViewport({ scale: 1 }).width;
      let obs = null;
      const draw = () => {
        if (obs) obs.disconnect(); box.innerHTML = ''; $('#pinfo').textContent = doc.numPages + ' halaman';
        const w = box.clientWidth - 16;
        for (let i = 1; i <= doc.numPages; i++) box.insertAdjacentHTML('beforeend', `<div class="pdf-page" data-p="${i}" style="height:${Math.round(w * scale * ratio)}px;width:${Math.round(w * scale)}px"></div>`);
        obs = new IntersectionObserver(ents => ents.forEach(async en => {
          const el = en.target;
          if (en.isIntersecting && !el.firstChild) {
            const page = await doc.getPage(+el.dataset.p); const base = page.getViewport({ scale: 1 });
            const dpr = Math.min(2, window.devicePixelRatio || 1); const vp = page.getViewport({ scale: (w * scale / base.width) * dpr });
            const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = '100%'; el.style.height = 'auto'; el.appendChild(c);
            await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          } else if (!en.isIntersecting && el.firstChild && Math.abs(en.boundingClientRect.top) > 4000) {
            const h = el.offsetHeight; el.innerHTML = ''; el.style.height = h + 'px'; // lepas memori halaman yang jauh
          }
        }), { rootMargin: '800px' });
        $$('.pdf-page', box).forEach(el => obs.observe(el));
      };
      $('#zm').onclick = () => { scale = Math.max(.6, scale - .2); draw(); }; $('#zp').onclick = () => { scale = Math.min(2.5, scale + .2); draw(); };
      draw();
    } catch (e) {
      $('#pinfo').textContent = 'Penampil internal tidak tersedia';
      box.innerHTML = `<iframe src="${objURL(blob)}" style="width:100%;height:70vh;border:0;background:#fff;border-radius:8px"></iframe>`;
    }
  }

  // ---------- Pencarian (di aplikasi + Chrome)
  const ENGINES = { google: ['Google', 'https://www.google.com/search?q='], bing: ['Bing', 'https://www.bing.com/search?q='], ddg: ['DuckDuckGo', 'https://duckduckgo.com/?q='], scholar: ['Scholar', 'https://scholar.google.com/scholar?q='], youtube: ['YouTube', 'https://www.youtube.com/results?search_query='], wiki: ['Wikipedia', 'https://id.wikipedia.org/w/index.php?search='] };
  const SITES = [['', 'Seluruh web'], ['sabda.org', 'SABDA'], ['biblehub.com', 'Bible Hub'], ['quran.kemenag.go.id', "Qur'an Kemenag"], ['quran.com', 'Quran.com'], ['hadits.id', 'Hadits.id'], ['sunnah.com', 'Sunnah.com'], ['id.wikipedia.org', 'Wikipedia ID']];
  route(/^\/search$/, (m, q) => {
    setTitle('Pencarian', '');
    const p = Prefs.all(); let site = q.site || '';
    view.innerHTML = `<div class="search-box"><input id="sq" type="search" placeholder="Cari ayat, kata, hadits, topik, atau di web…" value="${esc(q.q || '')}" autofocus><button class="btn primary" id="sgo">Cari</button></div>
      <div class="section-title"><h3>Hasil di aplikasi</h3></div><div class="card" id="local"><small class="muted">Ketik kata kunci lalu tekan Cari.</small></div>
      <div class="section-title"><h3>Cari di browser (Chrome)</h3></div>
      <div class="engine-grid">${Object.entries(ENGINES).map(([k, [n]]) => `<button data-eng="${k}" class="${p.engine === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="chips" style="margin-top:10px">${SITES.map(([s, n]) => `<button class="chip ${site === s ? 'on' : ''}" data-site="${s}">${n}</button>`).join('')}</div>
      <button class="btn primary block" id="sweb" style="margin-top:12px">🌐 Buka pencarian di Chrome</button>
      <button class="btn block" id="ssave" style="margin-top:8px">▤ Simpan link dari Chrome ke Pustaka</button>
      <div class="section-title"><h3>Sumber belajar</h3></div>
      <div class="chips">${[['https://alkitab.sabda.org', 'Alkitab SABDA'], ['https://biblehub.com', 'Bible Hub'], ['https://quran.kemenag.go.id', "Qur'an Kemenag"], ['https://quran.com', 'Quran.com'], ['https://corpus.quran.com', 'Quranic Corpus'], ['https://sunnah.com', 'Sunnah.com']].map(([u, n]) => `<button class="chip" data-url="${u}">${n} ↗</button>`).join('')}</div>
      ${p.searchHistory.length ? `<div class="section-title"><h3>Riwayat pencarian</h3><button class="muted" id="sclr">Hapus</button></div><div class="chips">${p.searchHistory.map(s => `<button class="chip" data-hist="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}`;
    const qEl = $('#sq');
    const record = s => { const h = Prefs.get('searchHistory').filter(x => x !== s); h.unshift(s); Prefs.set('searchHistory', h.slice(0, 15)); };
    const runLocal = () => { const s = qEl.value.trim(); if (!s) return; record(s); localSearch(s).then(html => $('#local').innerHTML = html); };
    $('#sgo').onclick = runLocal; qEl.onkeydown = e => { if (e.key === 'Enter') runLocal(); };
    $$('[data-eng]').forEach(b => b.onclick = () => { Prefs.set('engine', b.dataset.eng); $$('[data-eng]').forEach(x => x.classList.toggle('on', x === b)); });
    $$('[data-site]').forEach(b => b.onclick = () => { site = b.dataset.site; $$('[data-site]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#sweb').onclick = () => { const s = qEl.value.trim(); if (!s) return toast('Ketik kata kunci'); record(s); const [, base] = ENGINES[Prefs.get('engine')]; Native.openUrl(base + encodeURIComponent(s + (site ? ' site:' + site : ''))); };
    $('#ssave').onclick = () => webForm('');
    $$('[data-hist]').forEach(b => b.onclick = () => { qEl.value = b.dataset.hist; runLocal(); });
    const clr = $('#sclr'); if (clr) clr.onclick = () => { Prefs.set('searchHistory', []); rerender(); };
    if (q.q) runLocal();
  });
  async function localSearch(s) {
    const L = s.toLowerCase(); const out = [];
    const refM = s.match(/^(\d?\s?[a-z\- ]+?)\s+(\d+)(?::(\d+))?$/i);
    if (refM) { const bk = CANON.books.find(b => b.name.toLowerCase().replace(/\s/g, '') === refM[1].toLowerCase().replace(/\s/g, '') || b.abbr.toLowerCase() === refM[1].toLowerCase().replace(/\s/g, '')); if (bk) out.push(`<a class="result" style="display:block" href="#/bible?b=${bk.id}&c=${refM[2]}${refM[3] ? '&v=' + refM[3] : ''}"><span class="src bible">Buka referensi</span><br><b>${esc(bk.name)} ${refM[2]}${refM[3] ? ':' + refM[3] : ''}</b></a>`); }
    Object.entries(D.bible.verses).forEach(([ch, arr]) => arr.forEach(v => {
      const hay = [v.orig, v.translit, Object.values(v.tr).join(' '), (v.words || []).map(w => w[2] + ' ' + w[3]).join(' ')].join(' ').toLowerCase();
      if (hay.includes(L)) { const t = Object.values(v.tr).find(x => x.toLowerCase().includes(L)) || v.tr.NATS || Object.values(v.tr)[0]; out.push(`<a class="result" style="display:block" href="#/bible?b=${ch.split('.')[0]}&c=${ch.split('.')[1]}&v=${v.v}"><span class="src bible">Alkitab · ${esc(CANON.refLabel(ch + '.' + v.v))}</span><br>${hlText(t, s)}</a>`); }
    }));
    Object.entries(D.quran.surah).forEach(([su, arr]) => arr.forEach(v => {
      const hay = [v.orig, v.translit, Object.values(v.tr).join(' '), v.tafsir, (v.words || []).map(w => w[2]).join(' ')].join(' ').toLowerCase();
      if (hay.includes(L)) { const t = Object.values(v.tr).find(x => x.toLowerCase().includes(L)) || v.tr.KEMENAG; out.push(`<a class="result" style="display:block" href="#/quran/${su}?v=${v.v}"><span class="src quran">Al-Qur'an · ${esc(CANON.qLabel(su + '.' + v.v))}</span><br>${hlText(t, s)}</a>`); }
    }));
    (await searchHadith([s], 60)).forEach(hd => out.push(`<a class="result" style="display:block" href="#/hadith/${hd.kitab}/${hd.no}"><span class="src hadith">Hadits · ${esc(kitab(hd.kitab).name)} no. ${hd.no}</span><br>${hlText((hd.terjemah || '').slice(0, 140), s)}</a>`));
    Object.entries(D.lexicon.strong).forEach(([id, e]) => { if ([id, e.lemma, e.translit, e.def].join(' ').toLowerCase().includes(L)) out.push(`<a class="result" style="display:block" href="#/lexicon?q=${id}"><span class="src bible">Leksikon · ${id}</span><br><b>${esc(e.lemma)}</b> ${esc(e.translit)} — ${hlText(e.def, s)}</a>`); });
    try { (await DB.all('library')).forEach(i => { if ([i.title, i.text, i.url, (i.tags || []).join(' ')].join(' ').toLowerCase().includes(L)) out.push(`<a class="result" style="display:block" href="#/library/${i.id}"><span class="src lib">Pustaka · ${typeLabel[i.type]}</span><br>${hlText(i.title, s)}</a>`); }); } catch (e) { }
    Prefs.get('notes').forEach(n => { if (n.text.toLowerCase().includes(L)) out.push(`<a class="result" style="display:block" href="${resolve(n.key).route}"><span class="src lib">Catatan · ${esc(n.label)}</span><br>${hlText(n.text.slice(0, 120), s)}</a>`); });
    return out.length ? `<small class="muted">${out.length} hasil</small>` + out.join('') : `<div class="empty">Tidak ada hasil lokal untuk “${esc(s)}”. Coba cari di Chrome ↓</div>`;
  }

  // ---------- Leksikon
  route(/^\/lexicon$/, (m, q) => {
    setTitle('Leksikon Kata Asli', ''); let tab = q.tab || 'H';
    const list = f => {
      if (tab === 'AR') return Object.entries(D.lexicon.roots).filter(([r, e]) => !f || (r + e.meaning + e.derived.join(' ')).toLowerCase().includes(f)).map(([r, e]) => `<div class="list-item"><span class="list-num" style="font-family:var(--font-ar);font-size:15px;width:64px">${esc(r)}</span><span class="grow"><b>${esc(e.meaning)}</b><br><small style="font-family:var(--font-ar);font-size:16px">${esc(e.derived.join(' · '))}</small></span><small>${concordance('root', r).length}×</small></div>`).join('');
      return Object.entries(D.lexicon.strong).filter(([id]) => id[0] === tab).filter(([id, e]) => !f || [id, e.lemma, e.translit, e.def].join(' ').toLowerCase().includes(f)).map(([id, e]) => `<a class="list-item" data-lex="${id}"><span class="list-num" style="width:58px;font-size:11.5px;color:var(--c-bible)">${id}</span><span class="grow"><span style="font-family:var(--font-${tab === 'H' ? 'he' : 'grc'});font-size:22px;color:var(--orig)">${esc(e.lemma)}</span> <i class="muted">${esc(e.translit)}</i><br><small>${esc(e.def)}</small></span><small>${concordance('strong', id).length}×</small></a>`).join('');
    };
    view.innerHTML = `<h2>Ａ Leksikon</h2><p class="muted">Kamus kata asli bergaya Strong's (Ibrani & Yunani) dan akar kata Arab, lengkap dengan konkordansi.</p>
      <div class="seg" id="lt"><button data-t="H" class="${tab === 'H' ? 'on' : ''}">Ibrani</button><button data-t="G" class="${tab === 'G' ? 'on' : ''}">Yunani</button><button data-t="AR" class="${tab === 'AR' ? 'on' : ''}">Akar Arab</button></div>
      <input id="lf" placeholder="Cari nomor Strong, lema, atau arti…" style="margin:10px 0" value="${esc(q.q || '')}"><div class="card" style="padding:4px 14px" id="ll"></div>`;
    const draw = () => { $('#ll').innerHTML = list($('#lf').value.toLowerCase()) || '<div class="empty">Tidak ditemukan</div>'; bindLex(); };
    const bindLex = () => $$('[data-lex]').forEach(a => a.onclick = () => lexEntrySheet(a.dataset.lex));
    if (q.q && /^[HG]\d+$/i.test(q.q)) tab = q.q[0].toUpperCase();
    $$('#lt button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    $$('#lt button').forEach(b => b.onclick = () => { tab = b.dataset.t; $$('#lt button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $('#lf').oninput = draw; draw();
  });
  function lexEntrySheet(id) {
    const occ = concordance('strong', id); if (!occ.length) { const e = D.lexicon.strong[id]; return openSheet(`<h3>${id} ${esc(e.lemma)}</h3><p>${esc(e.def)}</p><button class="btn sm" data-url="https://biblehub.com/${id[0] === 'H' ? 'hebrew' : 'greek'}/${id.slice(1)}.htm">Bible Hub ↗</button>`); }
    const o = occ[0]; const [, b, c, v] = o.route.match(/b=(\w+)&c=(\d+)&v=(\d+)/); const vv = chapter(b, c).find(x => x.v === +v); const key = `B:${b}.${c}.${v}`;
    WORDS[key] = { words: vv.words, kind: 'bible', label: CANON.refLabel(`${b}.${c}.${v}`) };
    wordSheet(key, vv.words.findIndex(w => w[3] === id));
  }

  // ---------- Studi Tema
  route(/^\/topics$/, () => {
    setTitle('Studi Tema', '');
    view.innerHTML = `<h2>◎ Studi Tema</h2><p class="muted">Pelajari satu tema dari Alkitab, Al-Qur'an, dan Hadits dalam satu halaman, masing-masing dengan teks aslinya.</p>
      ${D.topics.topics.map(t => `<a class="card" href="#/topics/${t.id}" style="display:flex;gap:14px;align-items:center"><span style="font-size:30px">${t.icon}</span><span class="grow"><b>${esc(t.name)}</b><br><small>${esc(t.desc)}</small><br><small class="muted">${t.bible.length} ayat Alkitab · ${t.quran.length} ayat Qur'an · ${t.hadith.length} hadits</small></span>›</a>`).join('')}`;
  });
  route(/^\/topics\/(\w+)$/, ([id]) => {
    const t = D.topics.topics.find(x => x.id === id); if (!t) return go('#/topics'); setTitle('Tema: ' + t.name, '');
    const block = (title, cls, keys) => keys.length ? `<div class="section-title"><h3 class="src ${cls}">${title}</h3></div>` + keys.map(k => { const r = resolve(k); return `<a class="card" href="${r.route}" style="display:block"><small class="src ${cls}">${esc(r.label)}</small>
        <div class="v-orig ${r.script}" style="font-size:22px">${esc(r.orig || '')}</div><div class="v-translit">${esc(r.translit || '')}</div><div>${esc(r.tr || '')}</div></a>`; }).join('') : '';
    view.innerHTML = `<h2>${t.icon} ${esc(t.name)}</h2><p class="muted">${esc(t.desc)}</p>
      ${block('Alkitab', 'bible', t.bible.map(r => 'B:' + r))}${block("Al-Qur'an", 'quran', t.quran.map(r => 'Q:' + r))}${block('Hadits', 'hadith', t.hadith.map(r => 'H:' + r))}
      <button class="btn block" data-url="https://www.google.com/search?q=${encodeURIComponent('kajian tema ' + t.name)}">Kajian lebih lanjut di Chrome ↗</button>`;
  });

  // ---------- Rencana bacaan
  function planItem(s) {
    if (s.startsWith('Q:')) { const n = +s.slice(2); return { label: 'QS ' + CANON.surahs[n - 1].name, route: '#/quran/' + n }; }
    if (s.startsWith('H:')) { const r = resolve(s); return { label: r.label, route: r.route }; }
    const [b, c, vr] = s.split('.'); return { label: CANON.refLabel(b + '.' + c) + (vr ? ':' + vr : ''), route: `#/bible?b=${b}&c=${c}&v=${String(vr || 1).split('-')[0]}` };
  }
  route(/^\/plans$/, () => {
    setTitle('Rencana Bacaan', ''); const st = Prefs.get('plans');
    view.innerHTML = `<h2>☑ Rencana Bacaan</h2>${D.topics.plans.map(pl => { const d = (st[pl.id] || []).length; return `<a class="card" href="#/plans/${pl.id}" style="display:block"><div class="row between"><b>${esc(pl.name)}</b><small>${d}/${pl.days.length} hari</small></div><div class="progress" style="margin-top:8px"><span style="width:${d / pl.days.length * 100}%"></span></div></a>`; }).join('')}`;
  });
  route(/^\/plans\/([\w-]+)$/, ([id]) => {
    const pl = D.topics.plans.find(x => x.id === id); if (!pl) return go('#/plans'); setTitle(pl.name, '');
    const st = Prefs.get('plans'); const done = st[id] || [];
    view.innerHTML = `<h2>${esc(pl.name)}</h2><div class="card" style="padding:4px 14px">${pl.days.map((items, i) => `<div class="list-item"><button class="switch ${done.includes(i) ? 'on' : ''}" data-day="${i}"></button>
      <span class="grow"><b>Hari ${i + 1}</b><br>${items.map(s => { const it = planItem(s); return `<a href="${it.route}" style="color:var(--accent);font-weight:600">${esc(it.label)}</a>`; }).join(', ')}</span></div>`).join('')}</div>`;
    $$('[data-day]').forEach(b => b.onclick = () => { const d = +b.dataset.day; const s = Prefs.get('plans'); const arr = s[id] || []; s[id] = arr.includes(d) ? arr.filter(x => x !== d) : arr.concat(d); Prefs.set('plans', s); b.classList.toggle('on'); });
  });

  // ---------- Hafalan (flashcard)
  route(/^\/memorize$/, () => {
    setTitle('Hafalan', ''); const list = Prefs.get('memorize').filter(m => resolve(m.key).ok);
    if (!list.length) { view.innerHTML = `<h2>♲ Hafalan</h2><div class="empty"><span class="big">🧠</span>Belum ada ayat/hadits untuk dihafal.<p>Buka ayat, ketuk ⋯ lalu pilih “Hafalkan”.</p></div>`; return; }
    list.sort((a, b) => a.level - b.level || a.t - b.t); let i = 0, reveal = 0;
    const draw = () => {
      const m = list[i]; const r = resolve(m.key);
      view.innerHTML = `<div class="row between"><h2>♲ Hafalan</h2><small>${i + 1}/${list.length} · level ${m.level}</small></div>
        <div class="flash-card" id="fc"><small class="muted">${esc(r.label)}</small>
          <div class="orig" style="font-family:var(--font-${r.script === 'grc' ? 'grc' : r.script});direction:${r.script === 'grc' ? 'ltr' : 'rtl'}">${esc(r.orig)}</div>
          ${reveal > 0 ? `<div class="v-translit" style="border:0">${esc(r.translit || '')}</div>` : ''}${reveal > 1 ? `<div>${esc(r.tr)}</div>` : ''}
          ${reveal < 2 ? '<small class="muted" style="margin-top:14px">Ketuk kartu untuk membuka ' + (reveal ? 'terjemahan' : 'transliterasi') + '</small>' : ''}</div>
        <div class="row" style="margin-top:14px"><button class="btn grow" id="mAgain">↺ Ulangi</button><button class="btn primary grow" id="mOk">✓ Hafal</button></div>
        <button class="btn block" style="margin-top:8px" id="mDel">Hapus dari hafalan</button>`;
      $('#fc').onclick = () => { reveal = Math.min(2, reveal + 1); draw(); };
      const step = d => { const all = Prefs.get('memorize'); const it = all.find(x => x.key === m.key); it.level = Math.max(0, it.level + d); m.level = it.level; Prefs.set('memorize', all); i = (i + 1) % list.length; reveal = 0; draw(); };
      $('#mOk').onclick = () => step(1); $('#mAgain').onclick = () => step(-1);
      $('#mDel').onclick = () => { Prefs.set('memorize', Prefs.get('memorize').filter(x => x.key !== m.key)); rerender(); };
    };
    draw();
  });

  // ---------- Catatan, penanda, stabilo, riwayat
  route(/^\/notes$/, (m, q) => {
    setTitle('Catatan & Penanda', ''); const p = Prefs.all(); const tab = q.tab || 'bm';
    const row = (key, sub) => { const r = resolve(key); return `<a class="list-item" href="${r.route}"><span class="grow"><b>${esc(r.label)}</b><br><small>${esc((sub || r.tr || '').slice(0, 120))}</small></span>›</a>`; };
    const content = {
      bm: p.bookmarks.map(k => row(k)).join(''),
      notes: p.notes.map(n => row(n.key, n.text)).join(''),
      hl: Object.entries(p.highlights).map(([k, c]) => row(k, '● ' + c)).join(''),
      hist: p.history.map(h => `<a class="list-item" href="${h.route}"><span class="grow">${esc(h.label)}</span><small>${fmtDate(h.t)}</small></a>`).join('')
    }[tab];
    view.innerHTML = `<h2>✎ Catatan & Penanda</h2><div class="tabs">${[['bm', 'Penanda (' + p.bookmarks.length + ')'], ['notes', 'Catatan (' + p.notes.length + ')'], ['hl', 'Stabilo'], ['hist', 'Riwayat']].map(([t, n]) => `<button class="${tab === t ? 'on' : ''}" onclick="location.hash='#/notes?tab=${t}'">${n}</button>`).join('')}</div>
      <div class="card" style="padding:4px 14px">${content || '<div class="empty">Masih kosong</div>'}</div>`;
  });

  // ---------- Pengaturan & backup
  route(/^\/settings$/, async () => {
    setTitle('Pengaturan', ''); const p = Prefs.all(); let ds = []; try { ds = await DB.all('datasets'); } catch (e) { }
    const qari = [['Alafasy_128kbps', 'Mishary Rashid Alafasy'], ['Abdul_Basit_Murattal_192kbps', 'Abdul Basit (Murattal)'], ['Husary_128kbps', 'Mahmoud Khalil Al-Husary'], ['Minshawy_Murattal_128kbps', 'Al-Minshawi (Murattal)'], ['Abdurrahmaan_As-Sudais_192kbps', 'Abdurrahman As-Sudais']];
    view.innerHTML = `<h2>⚙ Pengaturan</h2>
      <div class="card"><h3>Tampilan</h3><div class="seg">${['night', 'light', 'sepia', 'amoled'].map(t => `<button data-th="${t}" class="${p.theme === t ? 'on' : ''}">${{ night: 'Malam', light: 'Terang', sepia: 'Sepia', amoled: 'Hitam' }[t]}</button>`).join('')}</div>
        <button class="btn block" style="margin-top:10px" id="disp">Aa Ukuran huruf & elemen ayat</button></div>
      <div class="card"><h3>Audio murottal</h3><select id="qari">${qari.map(([v, n]) => `<option value="${v}" ${p.qari === v ? 'selected' : ''}>${n}</option>`).join('')}</select><small class="muted">Audio diputar dari everyayah.com (perlu internet).</small></div>
      <div class="card"><h3>Perpustakaan & galeri</h3>
        <div class="toggle"><span>Kompres foto saat impor<br><small class="muted">Maks 2048 px, kualitas 85% — hemat 70–90% ruang</small></span><button class="switch ${p.compressImg ? 'on' : ''}" id="swCmp"></button></div>
        <button class="btn block" id="permGal" style="margin-top:10px">🔐 Periksa izin galeri & foto</button></div>
      <div class="card"><h3>Hadits offline</h3><p class="muted" style="margin-top:0" id="hStat">Menghitung…</p><button class="btn block" id="hClr">Hapus semua hadits offline</button></div>
      <div class="card"><h3>Impor data kitab (JSON)</h3><p class="muted" style="margin-top:0">Tambahkan Alkitab, Al-Qur'an, hadits 9 imam, atau leksikon lengkap dari file JSON berformat NATS (lihat docs/FORMAT-DATA.md). Data disimpan offline.</p>
        <button class="btn primary block" id="impDs">⬆ Impor dataset</button>
        ${ds.map(d => `<div class="list-item"><span class="grow"><b>${esc(d.name)}</b><br><small>${d.type} · ${fmtDate(d.t)}</small></span><button class="btn sm" data-dsdel="${esc(d.key)}">Hapus</button></div>`).join('')}</div>
      <div class="card"><h3>Backup & pemulihan</h3><p class="muted" style="margin-top:0">Ekspor semua penanda, catatan, stabilo, hafalan, rencana, Perpustakaan (termasuk file), dan dataset ke satu file.</p>
        <div class="row"><button class="btn grow" id="exp">⬇ Ekspor backup</button><button class="btn grow" id="imp">⬆ Pulihkan</button></div></div>
      <div class="card"><h3>Zona bahaya</h3><button class="btn block" id="rst" style="color:#e5484d">Atur ulang preferensi</button></div>
      <p class="muted" style="text-align:center">NATS BY NATAN v1.1.0 · ${Native.isNative() ? 'Android' : 'Pratinjau web'}</p>`;
    $$('[data-th]').forEach(b => b.onclick = () => { Prefs.set('theme', b.dataset.th); applyPrefs(); rerender(); });
    $('#disp').onclick = displaySheet; $('#qari').onchange = e => Prefs.set('qari', e.target.value);
    $('#swCmp').onclick = e => { Prefs.set('compressImg', !Prefs.get('compressImg')); e.currentTarget.classList.toggle('on'); };
    $('#permGal').onclick = async () => { const st = await Native.requestGalleryPermission(); toast({ granted: '✓ Izin galeri diberikan', limited: '✓ Izin galeri: foto terpilih saja', denied: 'Izin ditolak — aktifkan di Pengaturan HP ▸ Aplikasi ▸ NATS ▸ Izin' }[st] || 'Status izin: ' + st); };
    DB.count('hadith').then(n => { if ($('#hStat')) $('#hStat').textContent = n.toLocaleString('id-ID') + ' hadits tersimpan offline (sumber: API GadingDev).'; }).catch(() => {});
    $('#hClr').onclick = () => confirmSheet('Hapus semua hadits offline?', async () => { await DB.clear('hadith'); toast('Hadits offline dihapus'); rerender(); });
    $('#impDs').onclick = () => pickFile('.json,application/json', async f => {
      try { const data = JSON.parse(await f.text()); const type = data.type || (data.verses ? 'bible' : data.surah ? 'quran' : data.items ? 'hadith' : data.strong ? 'lexicon' : null);
        if (!type) throw new Error('Format tidak dikenali'); await DB.put('datasets', { key: type + ':' + f.name, type, name: f.name, data, t: Date.now() }); mergeDataset(type, data); toast('Dataset ' + type + ' diimpor'); rerender();
      } catch (e) { toast('Gagal impor: ' + e.message); }
    });
    $$('[data-dsdel]').forEach(b => b.onclick = async () => { await DB.del('datasets', b.dataset.dsdel); toast('Dihapus — muat ulang aplikasi'); location.reload(); });
    $('#exp').onclick = exportBackup; $('#imp').onclick = () => pickFile('.json,.nats', importBackup);
    $('#rst').onclick = () => confirmSheet('Atur ulang semua preferensi, penanda & catatan?', () => { Prefs.reset(); applyPrefs(); rerender(); });
  });
  function pickFile(accept, cb) { const fp = $('#filePicker'); fp.accept = accept; fp.multiple = false; fp.value = ''; fp.onchange = e => { const f = e.target.files[0]; if (f) cb(f); }; fp.click(); }
  async function exportBackup() {
    toast('Menyiapkan backup…');
    const lib = await DB.all('library').catch(() => []); const datasets = await DB.all('datasets').catch(() => []);
    // disusun per bagian (Blob parts) agar tidak membuat satu string raksasa di memori
    const parts = ['{"app":"NATS BY NATAN","version":2,"exported":' + JSON.stringify(new Date().toISOString()) + ',"prefs":' + JSON.stringify(Prefs.all()) + ',"library":' + JSON.stringify(lib) + ',"datasets":' + JSON.stringify(datasets) + ',"files":['];
    const fl = []; await DB.each('files', f => { if (!String(f.id).startsWith('t:')) fl.push(f); });
    for (let i = 0; i < fl.length; i++) parts.push((i ? ',' : '') + JSON.stringify({ id: fl[i].id, type: fl[i].blob.type, b64: await Native.blobToBase64(fl[i].blob) }));
    parts.push(']}');
    const name = 'nats-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    try { const path = await Native.saveFile(name, new Blob(parts, { type: 'application/json' })); toast('Backup tersimpan: ' + path); } catch (e) { toast('Gagal: ' + e.message); }
  }
  const b64ToBlob = (b64, type) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: type || '' }); };
  async function importBackup(f) {
    try {
      const data = JSON.parse(await f.text()); if (data.app !== 'NATS BY NATAN') throw new Error('Bukan file backup NATS');
      Prefs.replace(data.prefs || {});
      for (const it of data.library || []) {
        if (it.blob64) { await DB.put('files', { id: it.id, blob: b64ToBlob(it.blob64, it.blobType) }); it.hasFile = true; delete it.blob64; } // format v1
        await DB.put('library', it);
      }
      for (const x of data.files || []) {
        const blob = b64ToBlob(x.b64, x.type); await DB.put('files', { id: x.id, blob });
        const it = await DB.get('library', x.id); if (it && !it.hasThumb && /image|video|pdf/.test(it.type)) { const t = await makeThumb(blob, it.type); if (t) { await DB.put('files', { id: 't:' + x.id, blob: t }); it.hasThumb = true; await DB.put('library', it); } }
      }
      for (const d of data.datasets || []) await DB.put('datasets', d);
      toast('Backup dipulihkan'); setTimeout(() => location.reload(), 800);
    } catch (e) { toast('Gagal memulihkan: ' + e.message); }
  }

  // ---------- Tentang
  route(/^\/about$/, () => {
    setTitle('Tentang', '');
    view.innerHTML = `<div class="card" style="text-align:center"><img src="assets/icon.svg" style="width:88px;border-radius:24px" alt=""><h2 style="margin-top:10px">NATS BY NATAN</h2><p class="muted">Aplikasi Android untuk belajar Alkitab (Ibrani & Yunani), Al-Qur'an, dan Hadits 9 Imam dari teks aslinya — dengan transliterasi, terjemahan, leksikon kata per kata, perpustakaan digital, dan pencarian terhubung ke Chrome.</p><small>Versi 1.1.0</small></div>
      <div class="card"><h3>Sumber & lisensi data bawaan</h3><ul style="padding-left:18px;margin:0">
        <li>Teks Ibrani: Westminster Leningrad Codex (domain publik)</li><li>Nomor Strong's (domain publik); definisi ditulis ulang NATS</li><li>KJV & World English Bible (domain publik)</li>
        <li>Terjemahan Al-Qur'an Kemenag RI (data contoh)</li><li>Hadits 9 Imam: Hadith API GadingDev — api.hadith.gading.dev (open-source, MIT), teks Arab + terjemahan Indonesia; catatan studi contoh oleh NATS</li><li>Audio murottal: everyayah.com</li></ul></div>`;
  });

  // =================================================================== init
  async function init() {
    applyPrefs();
    $('#btnMenu').onclick = openDrawer; $('#scrim').onclick = () => { closeSheet(); closeDrawer(); };
    $('#btnSearch').onclick = () => go('#/search');
    view.addEventListener('click', onClick); $('#sheet').addEventListener('click', onClick);
    // geser ke bawah untuk menutup sheet
    let sy = null; $('#sheet').addEventListener('touchstart', e => { if ($('#sheetBody').scrollTop <= 0) sy = e.touches[0].clientY; }, { passive: true });
    $('#sheet').addEventListener('touchend', e => { if (sy != null && e.changedTouches[0].clientY - sy > 90) closeSheet(); sy = null; });
    Native.onBack(() => { if (isOpen()) { closeSheet(); closeDrawer(); } else if (location.hash && location.hash !== '#/home') history.back(); else Native.exitApp(); });
    window.addEventListener('hashchange', router);
    try { await loadData(); } catch (e) { view.innerHTML = `<div class="empty"><span class="big">⚠️</span>Gagal memuat data: ${esc(e.message)}</div>`; return; }
    router();
    // "Bagikan ke NATS" dari Chrome (link) atau aplikasi lain (PDF) → Perpustakaan Digital
    window.addEventListener('natsShare', async e => {
      const d = e.detail || {};
      if (d.kind === 'text') { const url = (d.text.match(/https?:\/\/\S+/) || [''])[0]; go('#/library'); setTimeout(() => { webForm(url || ''); if (!url) toast('Teks dibagikan — simpan sebagai catatan'); const t = $('#wt'); if (t) t.value = d.title || ''; const n = $('#wn'); if (n && !url) n.value = d.text; }, 300); }
      if (d.kind === 'pdf') {
        const blob = b64ToBlob(d.data, 'application/pdf');
        await saveFiles([new File([blob], d.name || 'dokumen.pdf', { type: 'application/pdf' })], 'Dibagikan'); go('#/library');
      }
    });
    window.natsReady = true;
  }
  init();
})();
