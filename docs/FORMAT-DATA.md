# Format Data Impor — NATS BY NATAN

Impor lewat **Pengaturan ▸ Impor dataset** (file `.json`). Data digabung dengan data bawaan dan disimpan offline di HP. Jenis dikenali dari kolom `type` atau dari kunci utamanya.

## Alkitab (`"type": "bible"`)
```json
{
  "type": "bible",
  "translations": [{ "id": "AYT", "name": "Alkitab Yang Terbuka", "lang": "id" }],
  "verses": {
    "GEN.1": [
      {
        "v": 1,
        "orig": "בְּרֵאשִׁית בָּרָא …",
        "translit": "bərēʾšîṯ bārāʾ …",
        "tr": { "AYT": "Pada mulanya …" },
        "words": [["בְּרֵאשִׁית", "bərēʾšîṯ", "pada mulanya", "H7225", "Prep + Nomina"]],
        "xref": ["JHN.1.1"],
        "note": "Catatan studi (opsional)"
      }
    ]
  }
}
```
- Kunci pasal: `KODE.PASAL` memakai kode kitab USFM (`GEN … MAL`, `MAT … REV`, lihat `www/js/canon.js`).
- `words`: `[asli, transliterasi, glosa, nomor Strong, morfologi]` — mengaktifkan mode Interlinear & leksikon.
- Hanya ingin menambah terjemahan? Cukup kirim `v` + `tr`; teks asli yang sudah ada tetap dipakai.

## Al-Qur'an (`"type": "quran"`)
```json
{
  "type": "quran",
  "translations": [{ "id": "KEMENAG", "name": "Terjemahan Kemenag RI", "lang": "id" }],
  "surah": {
    "2": [
      { "v": 255, "orig": "ٱللَّهُ لَآ إِلَٰهَ …", "translit": "Allāhu lā ilāha …",
        "tr": { "KEMENAG": "…" },
        "words": [["ٱللَّهُ", "allāhu", "Allah", "ا ل ه", "mubtada'"]],
        "tafsir": "Tafsir ringkas (opsional)" }
    ]
  }
}
```
`words`: `[arab, transliterasi, arti, akar kata (huruf dipisah spasi), keterangan/i'rab]`.

## Hadits (`"type": "hadith"`)
```json
{
  "type": "hadith",
  "themes": ["Shalat", "Puasa"],
  "items": {
    "bukhari": [
      { "no": 8, "bab": "Iman — …", "perawi": "Ibnu Umar",
        "arab": "بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ …", "translit": "…",
        "terjemah": "…", "derajat": "Shahih", "tema": ["Iman"],
        "takhrij": [["muslim", 16]], "syarah": "…", "faidah": ["…"] }
    ]
  }
}
```
ID kitab: `bukhari, muslim, abudawud, tirmidzi, nasai, ibnumajah, ahmad, malik, darimi`.

## Leksikon (`"type": "lexicon"`)
```json
{ "type": "lexicon",
  "strong": { "H1": { "lemma": "אָב", "translit": "ʾāḇ", "pron": "av", "pos": "Nomina", "def": "bapa", "root": "" } },
  "roots":  { "ك ت ب": { "meaning": "menulis", "derived": ["كتاب", "كاتب", "مكتوب"] } } }
```

## Tips konversi
Sumber terbuka yang umum dipakai: OSHB/WLC (Ibrani + morfologi), SBLGNT/OpenGNT (Yunani), Strong's (domain publik), Tanzil (teks Arab, wajib atribusi), Quranic Arabic Corpus (morfologi, cek lisensi). Selalu periksa lisensi terjemahan sebelum mendistribusikan APK.
