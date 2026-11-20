/* NATS BY NATAN — kanon kitab: daftar 66 kitab Alkitab & 114 surah Al-Qur'an */
(function (g) {
  // [id, nama Indonesia, jumlah pasal, PL/PB, slug Bible Hub, singkatan SABDA]
  const B = `GEN|Kejadian|50|genesis|Kej;EXO|Keluaran|40|exodus|Kel;LEV|Imamat|27|leviticus|Im;NUM|Bilangan|36|numbers|Bil;DEU|Ulangan|34|deuteronomy|Ul;JOS|Yosua|24|joshua|Yos;JDG|Hakim-hakim|21|judges|Hak;RUT|Rut|4|ruth|Rut;1SA|1 Samuel|31|1_samuel|1Sam;2SA|2 Samuel|24|2_samuel|2Sam;1KI|1 Raja-raja|22|1_kings|1Raj;2KI|2 Raja-raja|25|2_kings|2Raj;1CH|1 Tawarikh|29|1_chronicles|1Taw;2CH|2 Tawarikh|36|2_chronicles|2Taw;EZR|Ezra|10|ezra|Ezr;NEH|Nehemia|13|nehemiah|Neh;EST|Ester|10|esther|Est;JOB|Ayub|42|job|Ayb;PSA|Mazmur|150|psalms|Mzm;PRO|Amsal|31|proverbs|Ams;ECC|Pengkhotbah|12|ecclesiastes|Pkh;SNG|Kidung Agung|8|songs|Kid;ISA|Yesaya|66|isaiah|Yes;JER|Yeremia|52|jeremiah|Yer;LAM|Ratapan|5|lamentations|Rat;EZK|Yehezkiel|48|ezekiel|Yeh;DAN|Daniel|12|daniel|Dan;HOS|Hosea|14|hosea|Hos;JOL|Yoel|3|joel|Yl;AMO|Amos|9|amos|Am;OBA|Obaja|1|obadiah|Ob;JON|Yunus|4|jonah|Yun;MIC|Mikha|7|micah|Mi;NAM|Nahum|3|nahum|Nah;HAB|Habakuk|3|habakkuk|Hab;ZEP|Zefanya|3|zephaniah|Zef;HAG|Hagai|2|haggai|Hag;ZEC|Zakharia|14|zechariah|Za;MAL|Maleakhi|4|malachi|Mal;MAT|Matius|28|matthew|Mat;MRK|Markus|16|mark|Mrk;LUK|Lukas|24|luke|Luk;JHN|Yohanes|21|john|Yoh;ACT|Kisah Para Rasul|28|acts|Kis;ROM|Roma|16|romans|Rm;1CO|1 Korintus|16|1_corinthians|1Kor;2CO|2 Korintus|13|2_corinthians|2Kor;GAL|Galatia|6|galatians|Gal;EPH|Efesus|6|ephesians|Ef;PHP|Filipi|4|philippians|Flp;COL|Kolose|4|colossians|Kol;1TH|1 Tesalonika|5|1_thessalonians|1Tes;2TH|2 Tesalonika|3|2_thessalonians|2Tes;1TI|1 Timotius|6|1_timothy|1Tim;2TI|2 Timotius|4|2_timothy|2Tim;TIT|Titus|3|titus|Tit;PHM|Filemon|1|philemon|Flm;HEB|Ibrani|13|hebrews|Ibr;JAS|Yakobus|5|james|Yak;1PE|1 Petrus|5|1_peter|1Ptr;2PE|2 Petrus|3|2_peter|2Ptr;1JN|1 Yohanes|5|1_john|1Yoh;2JN|2 Yohanes|1|2_john|2Yoh;3JN|3 Yohanes|1|3_john|3Yoh;JUD|Yudas|1|jude|Yud;REV|Wahyu|22|revelation|Why`;
  const books = B.split(';').map((s, i) => {
    const [id, name, ch, slug, abbr] = s.split('|');
    return { id, name, chapters: +ch, testament: i < 39 ? 'PL' : 'PB', lang: i < 39 ? 'he' : 'grc', slug, abbr, index: i };
  });

  const S = `Al-Fatihah|7;Al-Baqarah|286;Ali 'Imran|200;An-Nisa'|176;Al-Ma'idah|120;Al-An'am|165;Al-A'raf|206;Al-Anfal|75;At-Taubah|129;Yunus|109;Hud|123;Yusuf|111;Ar-Ra'd|43;Ibrahim|52;Al-Hijr|99;An-Nahl|128;Al-Isra'|111;Al-Kahf|110;Maryam|98;Taha|135;Al-Anbiya'|112;Al-Hajj|78;Al-Mu'minun|118;An-Nur|64;Al-Furqan|77;Asy-Syu'ara'|227;An-Naml|93;Al-Qasas|88;Al-'Ankabut|69;Ar-Rum|60;Luqman|34;As-Sajdah|30;Al-Ahzab|73;Saba'|54;Fatir|45;Yasin|83;As-Saffat|182;Sad|88;Az-Zumar|75;Gafir|85;Fussilat|54;Asy-Syura|53;Az-Zukhruf|89;Ad-Dukhan|59;Al-Jasiyah|37;Al-Ahqaf|35;Muhammad|38;Al-Fath|29;Al-Hujurat|18;Qaf|45;Az-Zariyat|60;At-Tur|49;An-Najm|62;Al-Qamar|55;Ar-Rahman|78;Al-Waqi'ah|96;Al-Hadid|29;Al-Mujadilah|22;Al-Hasyr|24;Al-Mumtahanah|13;As-Saff|14;Al-Jumu'ah|11;Al-Munafiqun|11;At-Tagabun|18;At-Talaq|12;At-Tahrim|12;Al-Mulk|30;Al-Qalam|52;Al-Haqqah|52;Al-Ma'arij|44;Nuh|28;Al-Jinn|28;Al-Muzzammil|20;Al-Muddassir|56;Al-Qiyamah|40;Al-Insan|31;Al-Mursalat|50;An-Naba'|40;An-Nazi'at|46;'Abasa|42;At-Takwir|29;Al-Infitar|19;Al-Mutaffifin|36;Al-Insyiqaq|25;Al-Buruj|22;At-Tariq|17;Al-A'la|19;Al-Gasyiyah|26;Al-Fajr|30;Al-Balad|20;Asy-Syams|15;Al-Lail|21;Ad-Duha|11;Asy-Syarh|8;At-Tin|8;Al-'Alaq|19;Al-Qadr|5;Al-Bayyinah|8;Az-Zalzalah|8;Al-'Adiyat|11;Al-Qari'ah|11;At-Takasur|8;Al-'Asr|3;Al-Humazah|9;Al-Fil|5;Quraisy|4;Al-Ma'un|7;Al-Kausar|3;Al-Kafirun|6;An-Nasr|3;Al-Lahab|5;Al-Ikhlas|4;Al-Falaq|5;An-Nas|6`;
  const surahs = S.split(';').map((s, i) => { const [name, ayat] = s.split('|'); return { no: i + 1, name, ayat: +ayat }; });

  g.CANON = {
    books, surahs,
    book: id => books.find(b => b.id === id),
    refLabel(ref) { // "GEN.1.1" -> "Kejadian 1:1"
      const [b, c, v] = ref.split('.'); const bk = books.find(x => x.id === b);
      return (bk ? bk.name : b) + ' ' + c + (v ? ':' + v : '');
    },
    qLabel(ref) { const [s, v] = String(ref).split('.'); const su = surahs[+s - 1]; return 'QS ' + (su ? su.name : s) + (v ? ' ' + s + ':' + v : ''); }
  };
})(window);
