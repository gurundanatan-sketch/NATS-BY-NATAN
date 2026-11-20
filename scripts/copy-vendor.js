// Menyalin pustaka pihak ketiga ke www/ agar aplikasi Android berjalan OFFLINE:
//  - pdf.js (penampil PDF Perpustakaan Digital)
//  - capacitor.js (runtime Capacitor untuk aplikasi tanpa bundler)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www', 'vendor');
fs.mkdirSync(out, { recursive: true });
const copies = [
  ['node_modules/pdfjs-dist/build/pdf.min.js', 'www/vendor/pdf.min.js'],
  ['node_modules/pdfjs-dist/build/pdf.worker.min.js', 'www/vendor/pdf.worker.min.js'],
  ['node_modules/@capacitor/core/dist/capacitor.js', 'www/capacitor.js']
];
for (const [from, to] of copies) {
  const src = path.join(root, from);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(root, to)); console.log('✓', to); }
  else console.log('• lewati (belum terpasang):', from);
}
