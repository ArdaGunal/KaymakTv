const { PARTI } = require('./ayar');
const { iso, gecerliDilim, sessizSaatSonu } = require('./zaman');
const { duyuruMu, birimAcik } = require('./planlayici');
const { kutuMetni } = require('./sablon');
const { sayfalariOku } = require('./worker');

function gonderimKarari(aday, simdi, takvimNedeni, motorBaslangic = -Infinity) {
  const { plan, tercihler } = aday;
  const duyuru = duyuruMu(plan);
  if (duyuru && motorBaslangic !== -Infinity && !(Date.parse(plan.olay_alindi_at) > motorBaslangic)) {
    return { islem: 'iptal', neden: 'motor_oncesi' };
  }
  if (aday.duzeltme_id) return { islem: 'duzelt', geri_cek: aday.geri_cek === true };
  if (takvimNedeni === 'takvim_belirsiz') return null;
  const neden = !aday.hesap_acik ? 'hesap_kapali' : !aday.takipte ? 'takip_yok'
    : aday.izlendi ? 'izlendi' : aday.silindi_at ? 'kutu_silindi'
      : takvimNedeni || (gecerliDilim(aday.zaman_dilimi) !== plan.zaman_dilimi ? 'dilim_degisti' : null);
  if (neden) return { islem: 'iptal', neden };
  if (simdi < Date.parse(plan.kutu_an)) return null;
  if (simdi < Date.parse(plan.planlanan_an)) return { islem: 'hazirla', push: false, neden: 'push_bekliyor' };
  const acikBirimler = duyuru ? [] : plan.birimler.filter((b) => birimAcik(b, tercihler));
  const pushSon = Date.parse(plan.push_son_an);
  const yakinSon = plan.yakin_son ? Date.parse(plan.yakin_son) : Infinity;
  const pushNedeni = simdi >= pushSon ? 'sure_doldu' : simdi >= yakinSon ? 'gec_kaldi'
    : duyuru && aday.okundu_at ? 'okundu'
      : (duyuru ? tercihler?.tumu === false || tercihler?.sezon_duyuru === false : !acikBirimler.length) ? 'tercih_kapali' : null;
  if (pushNedeni) return { islem: 'hazirla', push: false, neden: pushNedeni };

  const ozetDegisti = plan.kategori === 'gunluk_ozet' && acikBirimler.length !== plan.birimler.length;
  if (ozetDegisti && acikBirimler.length < 3) return { islem: 'iptal', neden: 'ozet_tercihi_degisti' };
  const ertele = sessizSaatSonu(simdi, plan, duyuru);
  if (ertele !== null) return ertele < Math.min(pushSon, yakinSon)
    ? { islem: 'hazirla', push: false, neden: 'sessiz_saat', ertele_an: iso(ertele) }
    : { islem: 'hazirla', push: false, neden: 'sessiz_saat_sure_doldu' };
  return ozetDegisti
    ? { islem: 'hazirla', push: true, push_birim_anahtarlari: acikBirimler.map((b) => b.anahtar) }
    : { islem: 'hazirla', push: true };
}

function hedef(plan) {
  if (plan.kategori === 'gunluk_ozet') return { rota: 'yaklasanlar' };
  const { tur, trakt_id } = plan.icerikler[0];
  return { rota: tur === 'movie' ? 'film' : 'dizi', trakt_id };
}

async function gonderimTuru({ worker, takvimiDogrula, sablonlar, saat, dur, motorBaslangic }) {
  const sayac = { kutu: 0, istek: 0, iptal: 0, cakisma: 0, hata: 0 };
  for await (const sayfa of sayfalariOku(worker.gonderimAdaylari, { simdi: iso(saat()) }, dur)) {
    const kimlikler = new Map();
    for (const aday of sayfa) {
      if (dur()) return sayac;
      try {
        const { plan, id, plan_surumu, duzeltme_id } = aday;
        if (!plan.icerikler.length && !aday.geri_cek) throw new Error('teslim_uyeleri_yok');
        const dogrulama = aday.geri_cek ? {} : takvimiDogrula(plan.icerikler);
        if (duzeltme_id && dogrulama.neden) continue;
        const karar = gonderimKarari(aday, saat(), dogrulama.neden, motorBaslangic);
        if (!karar) continue;
        const pushBirimleri = karar.push_birim_anahtarlari;
        const metinPlani = pushBirimleri ? { ...plan, birimler: plan.birimler.filter((b) => pushBirimleri.includes(b.anahtar)) } : plan;
        const kutuGerekli = (karar.islem === 'hazirla' && !aday.kutu_id) ||
          (karar.islem === 'duzelt' && !karar.geri_cek) || !!pushBirimleri;
        const kutu = kutuGerekli ? {
          ...kutuMetni(await sablonlar(), metinPlani, aday), hedef: hedef(plan),
        } : undefined;
        if (dur()) return sayac;
        const sonuc = await worker.teslim({
          id, beklenen_plan_surumu: plan_surumu, beklenen_rev: plan.beklenen_rev,
          icerikler: plan.icerikler, guncel_icerikler: dogrulama.icerikler, duzeltme_id, ...karar, kutu,
        });
        if (sonuc?.durum === 'cakisma') { sayac.cakisma++; continue; }
        if (sonuc?.durum !== 'uygulandi' || !Array.isArray(sonuc.gonderim_idler)) throw new Error('teslim_yaniti');
        if (karar.islem === 'iptal') sayac.iptal++;
        if (karar.neden === 'ozet_tercihi_degisti') sayac.yenidenPlanla = true;
        if (kutuGerekli) sayac.kutu++;
        if (karar.push) for (const kimlik of sonuc.gonderim_idler) kimlikler.set(kimlik, aday);
      } catch {
        sayac.hata++;
      }
    }
    const ids = [...kimlikler.keys()];
    for (let i = 0; i < ids.length && !dur(); i += PARTI) {
      const parti = ids.slice(i, i + PARTI).filter((id) => gonderimKarari(kimlikler.get(id), saat(), null, motorBaslangic)?.push);
      if (!parti.length) continue;
      try {
        const yanit = await worker.push({ gonderim_idler: parti });
        const durumlar = new Map(yanit?.sonuclar?.map((r) => [r.id, r.durum]));
        sayac.istek += parti.length;
        sayac.hata += parti.filter((id) => !durumlar.has(id) || durumlar.get(id) === 'veritabani_hatasi').length;
      } catch {
        // Yeni deneme yaratma. Bir sonraki tur Worker'ın kalıcı niyet durumunu okur.
        sayac.hata += parti.length;
      }
    }
  }
  return sayac;
}

module.exports = { gonderimKarari, gonderimTuru };
