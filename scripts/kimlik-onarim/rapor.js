// ==========================================================================
// A3 KİMLİK ONARIMI — Okunur kuru çalıştırma raporu (M552)
// ==========================================================================
// Kullanıcı (2026-10-20): «Hangi grupta kaç kaydın ayrılacağını, Chernobyl/Fargo/Haunting ve 3 WWE Raw
// kaydında tam olarak ne yapacağını gösteren kuru çalıştırma raporunu bana sun.»

const { beklenenFark } = require('./uygula');

const say = (dizi, f) => dizi.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
const satir = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ');

function rapor(plan, once) {
  const c = [];
  const p = (s = '') => c.push(s);
  const fark = beklenenFark(plan.eylemler);
  const tur = say(plan.eylemler, (e) => e.tur);
  p('══════════ A3 KİMLİK ONARIMI — KURU ÇALIŞTIRMA (veritabanına HİÇBİR ŞEY YAZILMADI) ══════════');
  p(`veritabanı      ${plan.db}`);
  p(`ölçüm           ${plan.uretildi}`);
  p(`parmak izi      ${plan.parmakIzi}   (uygulamada --onay ile aynen verilmeli)`);
  p(`Trakt istekleri ${Object.keys(plan.trakt).length}${plan.yeniIstek != null ? ` (bu koşuda ağdan çekilen: ${plan.yeniIstek})` : ''}`);
  for (const [k, v] of Object.entries(plan.trakt)) p(`   ${v.govde == null ? '✗ ' + v.durum : '✓'} ${k}`);
  p();
  p(`ŞİMDİ           varlık ${once.varlik} · kimlik ${once.kimlik} · yük ${once.yuk} · çoklu-aktif trakt:episode ${once.cokluTraktBolum} · trakt:season ${once.cokluTraktSezon} · trakt:show ${once.cokluTraktDizi} · tmdb:episode ${once.cokluTmdbBolum}`);
  p(`UYGULANIRSA     +${fark.varlik} varlık · +${fark.kimlik} kimlik · +${fark.yuk} yük · SİLİNEN 0`);
  p(`                ${satir(tur)}`);
  p(`BEKLENEN SONRA  çoklu-aktif trakt:episode ${plan.beklenen.cokluTraktBolum} · trakt:season ${plan.beklenen.cokluTraktSezon} · trakt:show ${plan.beklenen.cokluTraktDizi} · tmdb:episode ${plan.beklenen.cokluTmdbBolum ?? '(G1 ile birlikte — sayı sonradan ölçülür)'}`);

  p();
  p(`── G1s · sezon birleşmeleri — 🆕 08 raporunda YOKTU, ONAYIN GEREKİR${plan.secenek && plan.secenek.g1sYok ? ' (--g1s-yok: PLANA ALINMADI)' : ''}`);
  for (const k of plan.gruplar.g1s || []) {
    p(`   ${k.dizi} ${k.sezon} «${k.baslik}» trakt:season ${(k.trakt || []).join(' + ')} → ${k.durum}${k.yeniBaslik && k.yeniBaslik !== k.baslik ? ` · başlık «${k.yeniBaslik}»` : ''}`);
    for (const a of k.ayrilan) p(`      • ${a.trakt} → ${a.hedef || '?'} ${a.not}${a.yeniSezon ? ` · yeni sezon ${a.yeniSezon} · kimlik [${a.kimlik.join(', ')}] · ${a.bolum} bölüm kendi sezonuna taşınır` : ''}`);
  }

  const g1 = plan.gruplar.g1;
  const tas = g1.flatMap((k) => k.tasinacak || []);
  const kimlikTur = say(tas.flatMap((t) => (t.not === 'hedef_bos' || t.not === 'sezon_yok' || t.not === 'hedef_dolu') ? t.tasinacakKimlik : []), (k) => k.split('=')[0]);
  p();
  const yeniTur = say(plan.eylemler.filter((e) => e.tur === 'varlikEkle'), (e) => e.type);
  p(`── G1 · birleşik bölümler: ${g1.length} kayıt, ${new Set(g1.map((k) => k.diziKid)).size} dizi (${satir(say(g1, (k) => (k.yuva.startsWith('S0E') ? 'özel S0' : 'normal')))})`);
  p(`   durum         ${satir(say(g1, (k) => k.durum))}`);
  p(`   taşıma        ${satir(say(tas, (t) => t.not))}  (toplam ${tas.length} Trakt bölümü)`);
  p(`   kimlik        ${satir(kimlikTur)}  (hedef_dolu olanlar emekli, diğerleri yeni kayda taşınır)`);
  p(`   yeni sezona   ${tas.filter((t) => t.yeniSezonda).length} taşıma, arşivde olmayan sezona gider (açılan sezon: ${tas.filter((t) => t.not === 'sezon_yok').length})`);
  p(`   yeni kayıt    (tüm gruplar) ${satir(yeniTur)}`);
  for (const k of g1.filter((x) => x.durum === 'hedef_dolu')) {
    for (const t of k.tasinacak.filter((x) => x.not === 'hedef_dolu')) {
      p(`   ⚑ ${k.dizi} ${k.yuva} «${k.baslik}» sahip ${k.sahip} | fazla ${t.trakt} → Trakt yuvası ${t.hedef} «${t.hedefBaslik}»`);
      p(`       hedefte kayıt var: «${t.hedefKayit.baslik}» trakt ${t.hedefKayit.trakt.join(',')} → S2: EMEKLİ [${t.tasinacakKimlik.join(', ')}]`);
    }
  }
  for (const k of g1.filter((x) => !['temiz_ayrilir', 'hedef_dolu'].includes(x.durum))) p(`   ⚠ ${k.kid} ${k.dizi} ${k.yuva}: ${k.durum} ${JSON.stringify(k.tasinacak)}`);

  p();
  p('── G2 · birleşik dizi (Haunting)');
  for (const k of plan.gruplar.g2) {
    p(`   ${k.kid} «${k.baslik}» trakt:show ${k.trakt.join(' + ')} → ${k.durum}`);
    if (k.kalan) p(`   KALAN  ${k.kalan}  ·  AYRILAN ${k.ayrilan} → yeni ${k.yeniDizi}`);
    p(`   taşınan ${k.tasinan.length}: ${k.tasinan.join(' ')}`);
    p(`   yeniden etkin ${k.etkinlesen.length}: ${k.etkinlesen.join(' ')}`);
    p(`   ortak (ilk sahipte kalır) ${k.ortak.length}: ${k.ortak.join(' ')}`);
    if (k.belirsiz.length) p(`   ⚠ hiçbir tarafa uymayan (dokunulmaz) ${k.belirsiz.length}: ${k.belirsiz.join(' ')}`);
    for (const e of k.eylem) p(`   • ${e}`);
  }

  p();
  p('── G3 · slug kökleri');
  for (const k of plan.gruplar.g3) {
    p(`   ${k.slug || '(slug yok)'} ${k.kid} (${k.sezon} sezon) → ${k.durum}${k.trakt ? ` · Trakt: ${k.trakt}` : ''}${k.birlesir ? ` · birleşir: ${k.birlesir}` : ''}`);
    for (const e of k.eylem) p(`      • ${e}`);
  }

  p();
  p('── G5 · tür karışması');
  for (const k of plan.gruplar.g5) {
    p(`   ${k.tur} «${k.baslik}» ${k.kid} → ${k.durum}${k.yuva ? ` · yuva ${k.yuva}` : ''}${k.yeniBolum ? ` · yeni bölüm ${k.yeniBolum}` : ''}${k.yeniFilm ? ` · yeni film ${k.yeniFilm}` : ''}`);
    for (const e of k.eylem) p(`      • ${e}`);
  }

  if (plan.gruplar.g6) {
    p();
    p(`── G6 · çift aktif tmdb:episode (O-6) — ${plan.gruplar.g6.length} kayıt · ${satir(say(plan.gruplar.g6, (k) => k.durum))}`);
    for (const k of plan.gruplar.g6) p(`   ${k.dizi || '(başlıksız)'} ${k.yuva} «${k.baslik}» → ${k.durum}${k.kalan ? ` · kalan ${k.kalan}` : ''}${k.emekli.length ? ` · emekli ${k.emekli.join(', ')}` : ''}`);
  }
  p();
  p('── Supabase (bu betik YAZMAZ)');
  p('   S1: G1 izleme satırları sahip kayıtta kalır — dokunulmaz. G5 film satırları bölümde kalır.');
  const another = plan.gruplar.g5.find((k) => k.baslik === 'Another' && k.yeniBolum);
  if (another) p(`   S3: «Another» izleme satırı ${another.kid} → ${another.yeniBolum} (ayna yeni bölümü Supabase'e taşıdıktan SONRA; ayrı onay)`);
  if (plan.ekBulgu) {
    const b = plan.ekBulgu;
    p();
    p(`── SEZON KAYMASI (ölçüm, uygulama öncesi; G1s bunları kendi sezonuna taşır): ebeveyn sezonuyla numarası uyuşmayan ${b.bolum} bölüm · ${b.sezon} sezon · ${b.dizi} dizi`);
    for (const o of b.ornek) p(`   ${o.dizi} — arşiv S${o.sezon} «${o.sezonAdi}» altında S${o.cocukNo} bölümleri (${o.n})`);
  }
  p();
  p(`── Uyarılar (${plan.uyarilar.length})`);
  for (const u of plan.uyarilar) p(`   ⚠ ${u}`);
  return c.join('\n');
}

module.exports = { rapor };
