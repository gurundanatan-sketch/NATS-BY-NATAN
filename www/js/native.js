/* NATS BY NATAN — jembatan ke fitur native Android via Capacitor (dengan fallback web) */
(function (g) {
  const cap = () => g.Capacitor;
  const reg = {};
  const P = name => {
    const c = cap(); if (!c || !(c.isNativePlatform && c.isNativePlatform())) return null;
    if (c.Plugins && c.Plugins[name]) return c.Plugins[name];
    if (c.registerPlugin && c.isPluginAvailable && c.isPluginAvailable(name)) return reg[name] || (reg[name] = c.registerPlugin(name));
    return null;
  };
  const isNative = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());

  const Native = {
    isNative,
    platform: () => (cap() && cap().getPlatform ? cap().getPlatform() : 'web'),

    /** Buka URL di Chrome (Chrome Custom Tabs) — terhubung langsung dengan browser Chrome di HP */
    async openUrl(url) {
      const Browser = P('Browser');
      if (Browser) { try { await Browser.open({ url, toolbarColor: '#121a36' }); return; } catch (e) { console.warn(e); } }
      g.open(url, '_blank', 'noopener');
    },

    /** Buka di aplikasi eksternal (Chrome penuh / app lain) */
    async openExternal(url) {
      const AppLauncher = P('AppLauncher');
      if (AppLauncher) { try { await AppLauncher.openUrl({ url }); return; } catch (e) { /* fallback */ } }
      return Native.openUrl(url);
    },

    async share({ title, text, url }) {
      const Share = P('Share');
      try {
        if (Share) return await Share.share({ title, text, url, dialogTitle: 'Bagikan' });
        if (navigator.share) return await navigator.share({ title, text, url });
      } catch (e) { return; }
      await Native.copy([text, url].filter(Boolean).join('\n'));
      g.toast && g.toast('Disalin ke papan klip');
    },

    async copy(text) {
      const Clipboard = P('Clipboard');
      try { if (Clipboard) return await Clipboard.write({ string: text }); } catch (e) {}
      try { await navigator.clipboard.writeText(text); }
      catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    },

    /** Simpan file ke folder Documents/NATS di HP (fallback: unduh di browser) */
    async saveFile(name, blob) {
      const FS = P('Filesystem');
      if (FS) {
        const data = await blobToBase64(blob);
        await FS.writeFile({ path: 'NATS/' + name, data, directory: 'DOCUMENTS', recursive: true });
        return 'Documents/NATS/' + name;
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return name;
    },

    onBack(handler) {
      const App = P('App');
      if (App && App.addListener) App.addListener('backButton', handler);
    },
    exitApp() { const App = P('App'); if (App && App.exitApp) App.exitApp(); },

    /** GET JSON lintas-domain: di Android lewat HTTP native (bebas CORS), di browser lewat fetch */
    async getJSON(url, ms) {
      const H = P('CapacitorHttp');
      if (H) {
        const r = await H.get({ url, headers: { Accept: 'application/json' }, connectTimeout: ms || 15000, readTimeout: ms || 15000 });
        if (r.status >= 400) throw new Error('HTTP ' + r.status);
        return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      }
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 15000);
      try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
      finally { clearTimeout(t); }
    },

    /** Izin galeri/foto (Android 13+: READ_MEDIA_IMAGES, 14+: akses foto terpilih) */
    async requestGalleryPermission() {
      const Camera = P('Camera');
      if (!Camera) return 'granted';
      try {
        let st = await Camera.checkPermissions();
        if (st.photos !== 'granted' && st.photos !== 'limited') st = await Camera.requestPermissions({ permissions: ['photos'] });
        return st.photos;
      } catch (e) { return 'granted'; }
    },

    /** Pilih banyak foto dari galeri → array File. Fallback: pemilih file browser. */
    async pickFromGallery({ limit = 0, video = false } = {}) {
      const Camera = P('Camera');
      if (Camera && !video) {
        const perm = await Native.requestGalleryPermission();
        if (perm === 'denied') throw new Error('Izin galeri ditolak. Aktifkan di Pengaturan HP ▸ Aplikasi ▸ NATS ▸ Izin ▸ Foto & video.');
        const res = await Camera.pickImages({ quality: 90, limit });
        const out = [];
        for (const ph of res.photos || []) {
          const blob = await (await fetch(ph.webPath)).blob();
          out.push(new File([blob], 'foto-' + Date.now() + '-' + out.length + '.' + (ph.format || 'jpg'), { type: blob.type || 'image/' + (ph.format || 'jpeg') }));
        }
        return out;
      }
      return pickViaInput(video ? 'image/*,video/*' : 'image/*', true);
    },

    /** Ambil foto langsung dari kamera (mis. memotret catatan/halaman buku) */
    async takePhoto() {
      const Camera = P('Camera');
      if (!Camera) return pickViaInput('image/*', false, 'environment');
      const ph = await Camera.getPhoto({ quality: 85, resultType: 'uri', source: 'CAMERA', saveToGallery: false });
      const blob = await (await fetch(ph.webPath)).blob();
      return [new File([blob], 'kamera-' + Date.now() + '.' + (ph.format || 'jpg'), { type: blob.type || 'image/jpeg' })];
    },

    async keepAwake(on) { try { if (on && navigator.wakeLock) Native._wl = await navigator.wakeLock.request('screen'); else if (Native._wl) Native._wl.release(); } catch (e) {} }
  };

  function blobToBase64(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  }
  function pickViaInput(accept, multiple, capture) {
    return new Promise(res => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple;
      if (capture) i.setAttribute('capture', capture);
      i.onchange = () => res(Array.from(i.files || [])); i.click();
    });
  }
  Native.pickViaInput = pickViaInput;
  Native.blobToBase64 = blobToBase64;
  g.Native = Native;
})(window);
