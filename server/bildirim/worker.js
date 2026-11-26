const { PARTI } = require('./ayar');
const { saglayiciSecenekleri } = require('../lazyfetch/zamanSiniri');

/*
 * Worker sözleşmesi (f8c45df). /ic/bildirim/* yalnız MOTOR_SIR,
 * /ic/push mevcut ICPUSH_SIR. Header x-kaymak-sync-secret, JSON UTF-8,
 * yönlendirme kapalı. Tarihler ISO UTC; sayfa imleçleri opak ve son sayfada null.
 * Her sayfada en çok 100 satır. Anahtarlar sunucuya özel; hesap UUID'si dışında
 * profil, token veya cihaz kimliği GNL'ye dönmez. HTTP 401 sır hatası, 503
 * servis/sır yok, 4xx geçersiz istek, 5xx geçici hata. Beklenen yarış 200 + durum.
 *
 * POST /ic/bildirim/plan-girdisi {simdi, ufuk, olay_baslangici, sonraki, limit}
 *   -> {satirlar:[{user_id, goruntu, zaman_dilimi, takip:[{tur,trakt_id}],
 *        tercihler, izlenen:[kanonik üye anahtarı], olaylar:[icerik_olaylari satırı],
 *        onceki:[plan + {id,durum,plan_surumu,kutu_id,iptal_nedeni}]}], sonraki}
 *   Kullanıcı atomik sayfa birimidir. Takip/izleme 075 semantiğiyle çözülür.
 *   Etkin kullanıcılar ile bekleyen/ilgili geçmişi olan kullanıcılar dahildir.
 *   Dilim en son geçerli cihaz açılışı, sonra hesap ayarı; son seçim UTC.
 *   Sezon duyurusu alindi_at > olay_baslangici ile okunur; tespit_at ile
 *   zamanlanır. alindi_at planın olay_alindi_at alanında korunur.
 *   onceki: tüm uzlaştırılabilir bekleyenler ve kanonik bildirim geçmişi.
 *   Geçmiş, dilim ve yayın günü değişiminde çift bildirimi önleyecek kadar
 *   tutulur; olaylı teslim kaynak olaydan önce silinmez.
 *
 * POST /ic/bildirim/plan-yaz {user_id,goruntu,planlar,duzeltmeler,korunanlar}
 *   -> {durum:'uygulandi'|'cakisma', eklenen, degisen, ayni, iptal, duzeltme}
 *   planlar tam istenen küme; kullanıcı başına tek işlem. goruntu opak CAS
 *   (okunan plan sürümleri, tercihler ve dilim, takip/izleme üyeliği);
 *   kaynak revizyonlarını her üye için de kontrol et. Tek kökte beklenen_rev,
 *   birden çok kökte icerikler[].takvim_rev kullanılır. Ayna gerideyse cakisma.
 *   Ayna tarafından uygulanan revizyon Worker'da kalıcı ve sorgulanabilir
 *   olmalı; icerik_olaylari en büyük revizyonu tek başına yeterli değildir
 *   (ilk takvim ve olaysız revizyonlar da mümkündür).
 *   Tekil kullanıcı+dedupe_anahtari; aynı değer yeniden yazılmaz, değişiklikte
 *   plan_surumu artırılır. Arşiv belirsizliğinde korunanlar (teslim ID listesi)
 *   yerinde kalır. Kümeden düşen diğer bekleyenleri iptal et, güncel ve
 *   bildirilmemiş iptal edilmiş anahtara yeni plan sürümü yazılabilir.
 *   Kutuya erişmiş erken duyuru bekleyen kalır; plan değişimi niyetleri siperler.
 *   Sonuçlanmış teslimi yeniden açma; düzeltme taleplerini ayrı, idempotent
 *   iş olarak kaydet. Kutu/niyet buradan yazılmaz. planlayici.js plan modelidir;
 *   097'de kolon karşılığı olmayan alanlar sunucuya özel plan üstverisi ister.
 *   duzeltmeler [{id,eklenen?:birimler[],degisen?:icerikler[]}]; aynı üyeyi
 *   tekrar ekleme; tarih kaymış/iptal üyenin kutusunu düzelt veya geri çek.
 *
 * GET /ic/bildirim/sablonlar -> {satirlar:[bildirim_sablonlari satırı]}
 *
 * POST /ic/bildirim/gonderim-adaylari {simdi,sonraki,limit}
 *   -> {satirlar:[{id,plan_surumu,plan,kutu_id,okundu_at,silindi_at,dil,
 *        son_sablon_id,kutu_sablonu?,gonderilebilir,zaman_dilimi,tercihler,
 *        duzeltme_id?:string,geri_cek?:boolean}], sonraki}
 *   Kutu zamanı gelenler, düzeltmeler ve zamanlanmış niyetler (ilk veya güvenli
 *   tekrar) sayfalanır. Süre dolduğunda kutu işi yine okunur. Terminal veya
 *   belirsiz niyet yeniden gönderilmez; süresi aşılmış gonderiliyor durumunu
 *   Worker belirsiz olarak sonuçlandırır. Adayın planı tam üye listesi içerir.
 *   gonderilebilir hesap açık, tüm üyeler takipte ve hiçbiri izlenmemişse true.
 *   Uygun olmayan bekleyen aday için iptal nedeni uygun_degil gönderilir.
 *   Worker iptal nedenini güncel hesap, takip ve izleme durumundan çözer.
 *   tercihler {tumu,sezon_duyuru,yayin,film,sosyal}; kaydı yoksa varsayılan true.
 *   düzeltmede plan, mevcut kutunun yeni izdüşümüdür; silinen kutu canlanmaz.
 *   Mevcut kutuyu güncellerken kutu_sablonu özgün satırdır (aktif olmasa da);
 *   kutu baştan yedek metin kullandıysa kutu_sablonu null döner.
 *
 * POST /ic/bildirim/teslim {id,beklenen_plan_surumu,beklenen_rev,icerikler,
 *          guncel_icerikler?, islem:'hazirla'|'iptal'|'duzelt', kutu?, push?,
 *          neden?, ertele_an?, push_birim_anahtarlari?, duzeltme_id?, geri_cek?}
 *   -> {durum:'uygulandi'|'cakisma',gonderim_idler:uuid[]}
 *   Teslim sürümü ve icerikler önce kayıtla karşılaştırılır. Ardından yetkili
 *   ayna guncel_icerikler ile denetlenir. Yalnız revizyon artmışsa ve ilgili
 *   durum/tarih/an_turu aynıysa revizyon koşullu ilerler; kutu/niyet kimlikleri
 *   korunur. İptal CAS'i eski planı hedefler, güncel revizyona eşitliği istemez.
 *   İzleme/takip, hesap, dilim, tercihler, okundu/silindi ve DB saati işlemde
 *   yeniden denetlenir. Kutu için mevcut tekillik ve okundu/silindi
 *   korunur. Kutu {sablon_id,dil,baslik,govde,adet,parametreler,hedef}; kanal
 *   'icerik', tur ve dedupe teslimden türetilir. Kutu ve niyet atomik;
 *   güvenli tekrar aynı niyet id'lerini döndürür.
 *   push false (geç/tercih/okundu) kutuyu korur ve zamanı gelmişse push'u
 *   kapatır; 'push_bekliyor' erken kutu aşamasıdır. 'sessiz_saat' ile ertele_an,
 *   orijinal planlanan_an ve TTL korunarak yalnız sonraki deneme zamanını
 *   ilerletir. Özet daralırsa push_birim_anahtarlari hâlâ açık en az üç birimi
 *   seçer; kutu ve teslim üyeliği bunlarla güncellenir, kalan birimler için
 *   planlayıcı ayrı kutu üretebilir. Eşik altına düşen özet yeniden planlanır.
 *   Cihaz ve güncel
 *   bag_nesli Worker'da çözülür. Düzeltmeler asla niyet üretmez. Geçici hatalar
 *   bir sonraki sayfa/turda kalıcı durumdan çözülür. İptal yalnız CAS ile;
 *   tarih, rev, dilim veya izleme değişiminde eski niyetleri hemen siperle,
 *   planlayıcının kalan geçerli üyelerle yeni sürüm yazmasına izin ver.
 *
 * POST /ic/push {gonderim_idler:uuid[]} -> {sonuclar:[{id,durum,deneme_kimligi?,bilet_id?}]}
 *   Mevcut uç; en çok 100 kimlik. Expo öncesinde güncel üyeler/revizyon,
 *   tercihler, sessiz saat (08:45 istisnasıyla), yakin_son, iki sezon duyurusu için okundu ve yeni kategori
 *   eşlemesi uygulanmalı (bolum_* → episodes, sezon_* → premieres,
 *   film_* → movies). Yaşayan denemeye dokunma; belirsiz denemeyi yollama.
 */
const UCLAR = Object.freeze({
  planGirdisi: ['/ic/bildirim/plan-girdisi', 'POST'],
  planYaz: ['/ic/bildirim/plan-yaz', 'POST'],
  sablonlar: ['/ic/bildirim/sablonlar', 'GET'],
  gonderimAdaylari: ['/ic/bildirim/gonderim-adaylari', 'POST'],
  teslim: ['/ic/bildirim/teslim', 'POST'],
  push: ['/ic/push', 'POST'],
});

const GECICI_DURUMLAR = new Set([502, 503, 504, 520, 521, 522, 523, 524]);
const AG_HATALARI = new Set(['TypeError', 'AbortError', 'TimeoutError']);

function geciciWorkerHatasi(hata) {
  if (hata?.uc == null || hata.message === 'worker_sayfa') return false;
  return Number.isInteger(hata?.status) ? GECICI_DURUMLAR.has(hata.status) : Boolean(hata?.ag);
}

function workerIstemcisi({ workerUrl, motorSir, pushSir, fetch = globalThis.fetch, saat = Date.now }) {
  return Object.fromEntries(Object.entries(UCLAR).map(([ad, [yol, method]]) => [ad, async (girdi) => {
    const basladi = saat();
    let agda = false;
    try {
      const adres = new URL(yol, workerUrl);
      const secenekler = {
        method, redirect: 'error', signal: saglayiciSecenekleri().signal,
        headers: { 'x-kaymak-sync-secret': ad === 'push' ? pushSir : motorSir, 'Content-Type': 'application/json' },
        body: girdi === undefined ? undefined : JSON.stringify(girdi),
      };
      agda = true;
      const yanit = await fetch(adres, secenekler);
      if (!yanit.ok) {
        const hata = new Error('worker_http');
        hata.status = yanit.status;
        throw hata;
      }
      return await yanit.json();
    } catch (hata) {
      const status = hata?.status;
      const adHatasi = hata?.name;
      const istekHatasi = hata !== null && typeof hata === 'object' && Object.isExtensible(hata)
        ? hata : new Error('worker_istek', { cause: hata });
      istekHatasi.uc = ad;
      istekHatasi.sure = saat() - basladi;
      if (istekHatasi !== hata && Number.isInteger(status)) istekHatasi.status = status;
      if (agda && !Number.isInteger(status) && AG_HATALARI.has(adHatasi)) istekHatasi.ag = `ag_${adHatasi}`;
      throw istekHatasi;
    }
  }]));
}

async function* sayfalariOku(oku, girdi, dur) {
  let sonraki = null;
  const gorulen = new Set();
  do {
    if (dur()) return;
    const yanit = await oku({ ...girdi, sonraki, limit: PARTI });
    sonraki = yanit?.sonraki;
    if (!Array.isArray(yanit?.satirlar) || yanit.satirlar.length > PARTI ||
        !(sonraki === null || (typeof sonraki === 'string' && sonraki && !gorulen.has(sonraki)))) {
      throw new Error('worker_sayfa');
    }
    gorulen.add(sonraki);
    yield yanit.satirlar;
  } while (sonraki !== null);
}

module.exports = { UCLAR, workerIstemcisi, sayfalariOku, geciciWorkerHatasi };
