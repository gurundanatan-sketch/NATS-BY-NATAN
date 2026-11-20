/* NATS BY NATAN — jembatan ke fitur native Android via Capacitor (dengan fallback web) */
(function (g) {
  const cap = () => g.Capacitor;
  const P = name => (cap() && cap().Plugins && cap().Plugins[name]) || null;
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

    async keepAwake(on) { try { if (on && navigator.wakeLock) Native._wl = await navigator.wakeLock.request('screen'); else if (Native._wl) Native._wl.release(); } catch (e) {} }
  };

  function blobToBase64(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  }
  Native.blobToBase64 = blobToBase64;
  g.Native = Native;
})(window);
