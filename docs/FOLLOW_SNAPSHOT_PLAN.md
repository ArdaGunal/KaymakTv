# Takip Listesi Snapshot'ı (F6) — Trakt'tan Bağımsızlık

> **Tasarım gerekçesi kaydıdır**, durum panosu değil. Faz takibi:
> [`MASTER_PLAN.md`](MASTER_PLAN.md). Kronoloji: [`HISTORY.md`](HISTORY.md).

---

## 1. Sorun

Akışın "kimin aktivitesini görebilirim" kümesi tamamen Trakt'a bağlı:

```
feedApi.getVisibleUserIds()
  → followStore.getFollowingSlugs()
      → social.getMyFollowingSlugs()
          → Trakt GET /users/me/following
  → myIdentity.getMyTraktSlug()      ← BU DA Trakt'a gidiyor
```

Trakt ücretlendirmeye geçti ve proje ondan kopuyor (Kol B). **Trakt kapandığı
gün takip grafiği geri getirilemez** — ve F8'de Google girişi açıldığında o
kullanıcının sosyal grafiği sıfırdan başlar.

> **F6 bir UX/fallback fazı DEĞİL, bir VERİ YAKALAMA sigortasıdır.**
> Bugün yakalamazsak, sonra yakalayamayız. Tek yönlü bir kapı.

## 2. Ölçülen gerçekler (varsayım değil)

| Soru | Cevap | Nasıl |
|---|---|---|
| Trakt hatası "boş liste"den ayırt edilebiliyor mu? | ✅ **Evet** — hata `throw` eder, `[]` yalnızca 200 + boş gövdede üretilir | `social.ts` + `traktClient.ts` okundu |
| `/users/me/following` sayfalanıyor mu? | ❌ **Hayır** — `x-pagination` başlığı yok, tüm listeyi veriyor | Canlı çağrı; kontrol testi `/movies/popular` (başlıklar orada geliyor) |
| Trakt kesintisinde akış tamamen boşalır mı? | ❌ **Hayır** — `followStore` listeyi AsyncStorage'a kalıcılaştırıyor | `followStore.ts` okundu |
| Kaybolan ne? | **Kullanıcının KENDİSİ** — `getMyTraktSlug()` de Trakt'a bağlı ve hatada `null` döner | `myIdentity.ts` okundu |

> İlk üç madde, fazın ilk problem tanımındaki **yanlış varsayımları** düzeltti.
> Dördüncüsü, çözülmesi gereken asıl kırılganlığı ortaya çıkardı.

## 3. Değişmez kurallar

1. **`004` geri gelmiyor.** Takip/çıkış Trakt'ta yapılır. Bu tek yönlü kopya.
2. **Snapshot asla yazma kaynağı değil.** Yön: Trakt → biz.
3. **Başarısız yanıt asla snapshot yazmaz.** `[]` (gerçekten boş) ile `null`
   (kabul edilemez yanıt) ayrımı korunur.
4. **Engel her zaman üstün.** `user_blocks` Supabase'de, Trakt'tan bağımsız;
   çıkarma slug→id çözümünden **sonra** uygulanır. Kaynak değişse de bu sıra
   bozulmaz.
5. **`pending` asla `following` sayılmaz.**

## 4. Karar: snapshot F6'da YALNIZCA YAZILIR

İlk tasarım "Trakt başarısız olursa istemci snapshot'ı okur" diyordu.
**Çürütüldü, üç gerekçeyle:**

**(a) Okuma yolu döngüsel.** Snapshot'ı okumak `users.id` gerektirir → o
`trakt_slug`'dan gelir → slug **yalnızca Trakt'tan** gelir. Trakt yoksa
snapshot'ı hangi satırdan okuyacağımızı bilemeyiz. Worker üzerinden okumak da
imkânsız: `verifyAndUpsertUser` de Trakt'a gidiyor. İkinci bir döngü.

**(b) Anon okuma = takip grafiği herkese açık.** Supabase Auth olmadığı için
politika `USING(true)` olmak zorundaydı; anon key bundle'da, yani fiilen
public. Üstelik Trakt'ta **gizli** hesapların following listesi dışarıdan
görünmezken `/users/me/following` kendi token'ıyla onu da getirir → Trakt'ta
**olmayan** bir sızıntı yaratırdı.

**(c) F8'den önce marjinal değeri sıfır.** Yerel kopya (AsyncStorage) zaten
"Trakt kapalı, aynı cihaz" ve "tamamen çevrimdışı" senaryolarını çözüyor.
Sunucu okumasının kazandırdığı tek yeni senaryo — *Google girişi, Trakt ölü,
yeni cihaz* — **F8'den sonra** doğuyor.

> **Kapalı RLS sonradan açılabilir; açık RLS geri kapatılamaz** (veri çoktan
> kopyalanmıştır). Tek yönlü kapı doğru yöne bakıyor.

## 5. Şema — tek satır + dizi

`022_user_following_snapshot.sql`: `user_id` (PK, FK→users, CASCADE) ·
`following_slugs TEXT[]` · `synced_at` · `CHECK(length <= 5000)`.
**RLS açık, politika YOK.**

| Alternatif | Neden değil |
|---|---|
| Kenar tablosu `(follower_id, followed_slug)` | N satır/kullanıcı + diff döngüsü; ve **boş liste temsil edilemez** — "hiç senkron olmadı" ile "kimseyi takip etmiyor" ayrılamazdı |
| `users`'a kolon | S11: `users_select_all USING(true)` → her yeni kolon herkese açık |
| Slug yerine `users.id` FK'si | Henüz KaymakTV'ye katılmamış kişileri sessizce düşürürdü; oysa onları saklamak fazın **amacı** |

## 6. Yakalama mantığı (Worker)

`handleFeedSync` içinde, `verifyAndUpsertUser`'dan sonra, **gizlilik erken
dönüşünden ÖNCE**. Gerekçe: gizlilik kuralı *"senin aktiviten görünmesin"*
der; bu tablo *"sen kimi görebilirsin"* sorusudur. Erken dönüşün altında
kalsaydı gizli hesaplar hiç snapshot alamaz ve Trakt kapanınca akışları
kalıcı olarak boşalırdı.

| # | Kural | Karşılık geldiği tuzak |
|---|---|---|
| 1 | **12 saatlik tazelik kapısı** | Her senkronda +1 Trakt isteği = mevcut 5 çağrıya %20 ek; ücretli API'de savunulamaz. Böylece ~kullanıcı/gün 1 istek |
| 2 | **Katı kabul** — `res.ok` **ve** `Array.isArray` | `res.ok ? … : []` deseni (bu dosyada hâkim) tam olarak Madde 185'teki veri kaybına yol açtı. Bu fonksiyonda **yasak** |
| 3 | Boş liste yazılabilir, ama yalnızca **başarılı** yanıttan | Kullanıcı gerçekten kimseyi takip etmiyorsa `'{}'` doğrudur |
| 4 | Gizli hesap da yakalanır | Yukarıdaki gerekçe |
| 5 | Fail-soft ama **sessiz değil** | `console.error` + yanıtta `following:{status,count}` (`tmdbBackfilled` deseni) |
| 6 | Küçülme uyarısı (>%50) | Sayfalama/kısmi yanıt regresyonunu erken yakalar; yazmayı engellemez |
| 7 | `normalizeFollowingSlugs` **saf ve export** | Birim testi (`normalizePublishActivity` emsali) |

## 7. İstemci — dayanıklılık YEREL (Adım 5, henüz yapılmadı)

> **Değişmez: `feedApi.ts` ve `useFeedRealtime.ts` DEĞİŞMEYECEK.** Tüm iş
> `getFollowingSlugs()`/`getMyTraktSlug()`'ın **arkasında**. Bu, keyset
> `.or(...)` kırılganlığını ve Realtime senkronu gereğini yapısal olarak
> devre dışı bırakır; `feedApi.ts`'i de (zaten S10 borcu) büyütmez.

| Dosya | Değişiklik | Neden |
|---|---|---|
| `services/api/myIdentity.ts` | Slug'ı diske yaz, hatada diskten oku | **ÖN KOŞUL** — bugün Trakt kesintisinde kullanıcı KENDİNİ kaybediyor |
| `services/api/social.ts` | `Array.isArray` guard + açık throw | Bugün 200+HTML gelirse `.map is not a function` **tesadüfen** doğru davranıyor; niyetli hâle getir |
| `store/followStore.ts` | `fetchedAt` kalıcılığı · `lastFailedAt` · 60sn backoff · slug damgası · `isFollowingListStale()` | Hata dalı bugün `isFetched:false` bırakıyor → **her sayfa ölü isteği yeniden deniyor**, akış 20sn'ye kadar bloke olabiliyor |
| Akış ekranı + `locales` | "Takip listesi güncellenemedi, son bilinen hâli gösteriliyor" satırı | AI_RULES §2 — sessiz başarısızlık yasağı |

## 8. Bilinen sınırlar (gizlenmiyor)

1. **F6 istemcide görünür bir fallback ÜRETMİYOR.** Sunucu snapshot'ı yalnızca
   yazılıyor. "F6 bitti, artık Trakt gidebilir" **denemez**.
2. **Trakt öldüğü an grafik donar.** Değişmez 1 gereği kaçınılmaz; 12 saatlik
   bayatlık kabul edildi.
3. **Hiç senkron olmamış kullanıcının snapshot'ı hiç oluşmaz** ve sonradan
   oluşturulamaz. Fazı erken göndermek için tek gerçek argüman bu.
4. **KaymakTV kullanmayan takip edilenler slug olarak saklanır** — bugün
   işlevsiz; bilinçli, F8 sonrası katılırlarsa grafik kurulabilsin diye.
5. **Gizli hesapların following listesi bizde saklanır.** RLS kapalı olduğu
   için dışarı açılmaz, ama bu **kayıt altına alınmış bir veri toplama
   kararıdır** ve okuma politikası açılırsa (F7/F8) ayrıca ele alınmalıdır.
6. **`?limit=N` kabul ediliyor.** Uç bugün sayfalamıyor ama parametreyi
   kabul ediyor — koda bir gün `limit` eklenirse liste **sessizce kırpılır**.
   `getMyFollowingSlugs` ve Worker çağrısı parametresiz kalmalı.
