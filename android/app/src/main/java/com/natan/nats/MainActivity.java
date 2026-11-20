package com.natan.nats;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * NATS BY NATAN — Activity utama.
 * Menjalankan aplikasi web (www/) di dalam WebView Capacitor dan menerima
 * "Bagikan ke NATS" dari Chrome (link) atau aplikasi lain (PDF) untuk disimpan
 * ke Perpustakaan Digital.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebSettings s = getBridge().getWebView().getSettings();
        s.setTextZoom(100);              // ukuran huruf diatur dari dalam aplikasi
        s.setMediaPlaybackRequiresUserGesture(false); // murottal berurutan
        handleShare(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType();
        try {
            if ("text/plain".equals(type)) {
                String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
                if (text != null) dispatch("{\"kind\":\"text\",\"text\":" + json(text) + ",\"title\":" + json(subject == null ? "" : subject) + "}");
            } else if ("application/pdf".equals(type)) {
                Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (uri == null) return;
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384]; int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    String b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                    String name = uri.getLastPathSegment() == null ? "dokumen.pdf" : uri.getLastPathSegment();
                    dispatch("{\"kind\":\"pdf\",\"name\":" + json(name) + ",\"data\":\"" + b64 + "\"}");
                }
            }
        } catch (Exception ignored) { }
    }

    /** Kirim ke JavaScript: window.dispatchEvent(new CustomEvent('natsShare', {detail})) — menunggu WebView siap */
    private void dispatch(String detailJson) {
        final String js = "(function f(){if(window.natsReady){window.dispatchEvent(new CustomEvent('natsShare',{detail:" + detailJson + "}));}else{setTimeout(f,300);}})();";
        getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript(js, null), 600);
    }

    private static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': break;
                case '<': b.append("\\u003c"); break;
                default: if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c);
            }
        }
        return b.append('"').toString();
    }
}
