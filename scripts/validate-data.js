// Validasi struktur data JSON bawaan sebelum build
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'www', 'data'); let errors = 0;
const load = n => JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8'));
const bible = load('bible'), quran = load('quran'), hadith = load('hadith'), lex = load('lexicon'); load('topics');
for (const [ch, arr] of Object.entries(bible.verses)) for (const v of arr) {
  if (!v.orig || !v.translit || !v.tr) { console.error('Alkitab tidak lengkap', ch, v.v); errors++; }
  for (const w of v.words || []) if (!lex.strong[w[3]]) { console.error('Strong tidak ada di leksikon:', w[3], ch + '.' + v.v); errors++; }
}
for (const [s, arr] of Object.entries(quran.surah)) for (const v of arr) if (!v.orig || !v.tr) { console.error('Quran tidak lengkap', s, v.v); errors++; }
const ids = hadith.kitab.map(k => k.id);
if (ids.length !== 9) { console.error('Harus ada 9 kitab hadits'); errors++; }
for (const k of Object.keys(hadith.items)) if (!ids.includes(k)) { console.error('Kitab tak dikenal', k); errors++; }
console.log(errors ? `✗ ${errors} masalah data` : '✓ Data valid'); process.exit(errors ? 1 : 0);
