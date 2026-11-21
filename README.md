# NATS BY NATAN

Aplikasi **Android** untuk belajar kitab suci dari bahasa aslinya. NATS BY NATAN menggabungkan fitur-fitur gaya *Alkitab SABDA*, *Bible Hub*, *Qur'an Kemenag*, dan *Ensiklopedia Hadits* dalam satu aplikasi HP yang berjalan **offline**.

| Modul | Teks asli | Transliterasi | Terjemahan | Kata per kata |
|---|---|---|---|---|
| Alkitab — Perjanjian Lama | Ibrani (עִבְרִית) | Latin akademik | NATS (Indonesia), KJV, WEB, + impor | Strong H####, morfologi, konkordansi |
| Alkitab — Perjanjian Baru | Yunani (Ἑλληνική) | Latin | NATS, KJV, WEB, + impor | Strong G####, morfologi, konkordansi |
| Al-Qur'an | Arab | Latin | Kemenag RI, English, + impor | arti per kata, akar kata, i'rab, kemunculan akar |
| Hadits 9 Imam | Arab (matan) | Latin | Indonesia | derajat, perawi, bab, syarah, faidah, takhrij, tema |

## Fitur

**Pembaca kitab (Alkitab & Al-Qur'an memakai tata letak yang sama)**
- Kartu ayat: teks asli → transliterasi Latin → satu atau beberapa terjemahan pilihan
- Mode **Paralel** dan **Interlinear** (kotak per kata: Strong/akar · kata asli · translit · glosa · morfologi), seperti Bible Hub
- Ketuk kata asli → lembar leksikon: lema, pelafalan, kelas kata, morfologi, definisi, **konkordansi**, tautan Bible Hub / Quranic Corpus
- Pilih kitab (66) & pasal, surah (114), penanda ★, stabilo 4 warna, catatan, salin, bagikan, bandingkan semua terjemahan, referensi silang, catatan studi / tafsir ringkas
- Audio murottal per ayat & satu surah (5 qari) · suara TTS untuk terjemahan
- Pengaturan tampilan: tema Malam/Terang/Sepia/Hitam (AMOLED), ukuran teks asli & terjemahan, tampilkan/sembunyikan tiap lapisan

**Tampilan Alkitab (v1.1)**
- Bilah atas: **nama kitab di tengah** → ketuk untuk memilih Kitab → Pasal → Ayat; **tombol terjemahan** di sebelahnya untuk mencentang banyak terjemahan sekaligus; **ikon cari** di kanan untuk menelusuri referensi (`Yoh 3:16`, `Mzm 23`) atau kata kunci di semua terjemahan, teks asli, glosa, dan nomor Strong

**Ensiklopedia Hadits 9 Imam** — sumber teks: [Hadith API GadingDev](https://api.hadith.gading.dev) (tanpa API key), disimpan ke cache offline; kitab bisa diunduh penuh untuk dibaca & dicari tanpa internet
- Bukhari, Muslim, Abu Dawud, Tirmidzi, Nasa'i, Ibnu Majah, Ahmad, Malik, Darimi (dengan rumus takhrij klasik خ م د ت ن ه حم ط مي)
- **Cari berdasarkan nomor** (pilih kitab + nomor), **cari berdasarkan tema**, dan cari kata kunci (Arab/terjemah/perawi)
- Kartu hadits: kitab & bab, derajat, perawi, matan Arab, translit, terjemah, tab Syarah · Faidah · Takhrij · Tema · Catatan, navigasi nomor sebelum/sesudah

**Perpustakaan Digital**
- **Impor foto dari Galeri** (pilih banyak sekaligus), foto & video, atau **ambil foto dengan kamera** — izin Android 13/14 (READ_MEDIA_IMAGES/VIDEO, akses foto terpilih) diminta otomatis
- Tetap ringan untuk ribuan item: metadata dipisah dari isi file, thumbnail 320 px, foto dikompres (maks 2048 px), daftar dimuat bertahap, PDF dirender per halaman yang terlihat, mode Kelola untuk hapus/pindah banyak item
- Simpan PDF, e-book, gambar, dokumen, teks, link website, dan catatan kajian — tersimpan di HP (IndexedDB), terbuka offline
- Penampil PDF internal (pdf.js) dengan zoom, folder & tag, pencarian, ekspor ke folder *Documents/NATS*
- Terima **“Bagikan → NATS”** dari Chrome (link) dan aplikasi lain (PDF)

**Pencarian**
- Pencarian gabungan di aplikasi: Alkitab, Al-Qur'an, hadits, leksikon, pustaka, catatan; deteksi referensi (mis. `Yoh 3:16`)
- Pencarian web terhubung **Chrome** (Chrome Custom Tabs): Google, Bing, DuckDuckGo, Scholar, YouTube, Wikipedia + filter situs SABDA, Bible Hub, Qur'an Kemenag, Quran.com, Hadits.id, Sunnah.com

**Lainnya:** Leksikon Ibrani/Yunani/akar Arab · Studi Tema lintas kitab · Rencana Bacaan · Hafalan (flashcard bertingkat) · Catatan, Penanda, Stabilo, Riwayat · Bacaan Hari Ini · Impor dataset JSON · Backup & pulihkan semua data (termasuk file pustaka) · tombol Kembali Android.

## Struktur proyek

```
NATS-BY-NATAN/
├─ www/                      # Antarmuka aplikasi (HTML, CSS, JS) — dibundel ke APK
│  ├─ index.html
│  ├─ css/style.css
│  ├─ js/canon.js            # 66 kitab & 114 surah
│  ├─ js/native.js           # jembatan Capacitor: Chrome, Share, Filesystem, Clipboard, tombol Kembali
│  ├─ js/store.js            # preferensi + IndexedDB (pustaka & dataset)
│  ├─ js/app.js              # router & semua layar
│  ├─ data/*.json            # Alkitab, Al-Qur'an, hadits, leksikon, tema & rencana
│  └─ assets/                # ikon
├─ android/                  # Proyek Android native (Capacitor)
│  ├─ settings.gradle  build.gradle  gradle.properties  variables.gradle
│  ├─ gradle/wrapper/        # gradle-wrapper.jar + .properties (Gradle 8.11.1)
│  ├─ gradlew  gradlew.bat
│  └─ app/                   # build.gradle, AndroidManifest.xml, MainActivity.java, ikon
├─ .github/workflows/android-build.yml   # CI: APK debug/rilis + AAB + backup ZIP
├─ server.js                 # server pengembangan & API JSON (tanpa dependensi)
├─ capacitor.config.json     # appId com.natan.nats
├─ scripts/                  # salin pdf.js/capacitor.js, validasi data
└─ docs/                     # PERANCANGAN.md, FORMAT-DATA.md
```

## Membangun APK

### Cara 1 — GitHub Actions (tanpa install apa pun)
1. Unggah isi folder ini ke repo `gurundanatan-sketch/NATS-BY-NATAN` (branch `main`).
2. Buka tab **Actions** → *Android Build — NATS BY NATAN* → berjalan otomatis (atau **Run workflow**).
3. Setelah selesai, unduh artefak **NATS-BY-NATAN-android-N** → berisi `NATS-BY-NATAN-debug.apk`, `-release.apk`, `-release.aab`, dan `-master-backup.zip`.
4. Pasang `.apk` di HP (izinkan “Instal dari sumber tidak dikenal”).
5. Buat tag `v1.0.0` (`git tag v1.0.0 && git push --tags`) untuk otomatis membuat GitHub Release.

Untuk kunci rilis permanen, isi Secrets: `NATS_KEYSTORE_BASE64`, `NATS_KEYSTORE_PASSWORD`, `NATS_KEY_ALIAS`, `NATS_KEY_PASSWORD`.

### Cara 2 — Komputer sendiri
Butuh Node.js 20+, JDK 21, Android Studio/SDK 35.
```bash
npm install                 # memasang Capacitor 7 + menyalin pdf.js ke www/vendor
npx cap sync android        # bila folder capacitor-cordova-android-plugins belum ada, jalankan langkah CI "Lengkapi modul" dulu
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
Atau `npx cap open android` lalu tekan ▶ Run di Android Studio dengan HP tersambung USB.

### Pratinjau cepat di browser (pengembangan)
```bash
node server.js     # http://localhost:8080  — API: /api/health, /api/bible/GEN/1, /api/quran/1,
                   # /api/hadith/bukhari/1, /api/hadith/tema/Ilmu, /api/lexicon/H7225, /api/search?q=niat
```

## Data
Data bawaan adalah **contoh lengkap secara struktur** (Kejadian 1:1–3, Mazmur 23:1, Matius 5:3, Yohanes 1:1–3 & 3:16, Al-Fatihah, Al-Ikhlas, 9 hadits pilihan, 64 entri Strong, 24 akar Arab). Teks lengkap ditambahkan lewat **Pengaturan ▸ Impor dataset** dengan format di [`docs/FORMAT-DATA.md`](docs/FORMAT-DATA.md). Pastikan lisensi sumber data mengizinkan penggunaan (mis. WLC & SBLGNT/teks Yunani terbuka, Strong's domain publik, KJV/WEB domain publik, teks Tanzil dengan atribusi; terjemahan TB/BIS LAI dan beberapa terjemahan hadits berhak cipta dan memerlukan izin).

Penomoran hadits berbeda antar-edisi (Fuad Abdul Baqi, Lidwa Pusaka, dll.) — cocokkan nomor contoh dengan dataset yang Anda impor.

---
© Natan — NATS BY NATAN
