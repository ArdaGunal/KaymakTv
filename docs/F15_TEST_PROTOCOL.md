# F15 — Denetim Düzeltmeleri Cihaz Testi Protokolü

> **Bu dosya bir durum panosu DEĞİLDİR.** Faz takibi `MASTER_PLAN.md` §0'da.
> Burası yalnızca F15'te yazılan 5 düzeltmenin cihazda doğrulanma listesi.
>
> **Neden yazılı protokol:** F15 tamamen `sed`/`node` ile, hiç cihazda
> denenmeden yazıldı (`HISTORY.md` Madde 191). Kod `tsc`'den geçti ama
> "kullanıcı ekranda ne görüyor" hiç ölçülmedi — `MASTER_PLAN`'ın F15 çıkış
> kriteri tam olarak bu: *"her düzeltme için 'kullanıcı ne görüyor' senaryosu
> cihazda doğrulanmış olmalı."*
>
> **Bu testi kim yapabilir:** Bu, F4 protokolünün aksine bir SQL/Worker
> doğrulaması DEĞİL — yalnızca uygulamayı kullanmak, uçak modunu açıp
> kapatmak ve ekrandaki metni okumak. Özel erişim gerekmiyor.

---

## Ön koşullar

- Gerçek bir Trakt hesabıyla giriş yapılmış olmalı (misafir modunda hata
  yolları farklı davranır).
- T4 için akışında en az bir kaç kart olsun; T5 için birkaç ekran gerçek
  veriyle açılabilsin (bir dizi, bir film, bir bölüm).
- T1'de "birkaç sayfa daha var" durumunu görmek için akışında yeterince
  aktivite birikmiş olması gerekiyor — azsa `hasMore` hemen `false` olur ve
  test tetiklenmez, bu durumda BAŞARISIZLIK değil, atlanmış sayılır.

---

## T1 · Akışta "devamı yüklenemedi" (Y21) — ZORUNLU

**Neyi düzeltiyor:** Eskiden akışın en altına inip devamı yüklenirken hata
olursa spinner sessizce kaybolur, hiçbir mesaj çıkmazdı — kullanıcı akışın
bittiğini mi bozulduğunu mu anlayamazdı (`onEndReached` en altta bir daha
tetiklenmediği için).

1. Akışı en alta kadar kaydır (birkaç sayfa daha yüklenecek kadar veri
   olmalı)
2. Tam "daha fazla yükleniyor" spinner'ı görünürken **uçak modunu aç**
3. Yüklemenin başarısız olmasını bekle

| Beklenen | Nerede |
|---|---|
| Spinner kaybolur ama **boş bırakmaz** | Cihaz |
| *"Devamı yüklenemedi."* metni + **"Tekrar Dene"** butonu görünür (footer'da) | Cihaz |
| Uçak modunu kapat → **"Tekrar Dene"**'ye bas → yükleme devam eder | Cihaz |

---

## T2 · Detay sayfası hata yolu — dizi/film/bölüm (Y17, en ağırı) — ZORUNLU

**Neyi düzeltiyor:** Eskiden Trakt çökünce üç sayfa da (`episode`, `show`,
`movie`) sanki başarıyla açılmış gibi sahte içerik gösteriyordu. Bölüm
sayfasında bu özellikle kötüydü: `first_aired` boş kaldığı için **"TBA"
rozeti** çıkıyor ve **"İzledim" butonu tamamen kayboluyordu** — uygulama
"bu bölüm henüz yayınlanmadı" diyordu, oysa sorun kendi bağlantısıydı.

Her üç sayfa için aynı adımları tekrarla:

1. **Uçak modunu aç**
2. Daha önce **hiç açılmamış** bir dizi/film/bölüm sayfasına git (önbellek
   varsa eski veriden başarılı görünebilir — bu yüzden yeni bir içerik seç)

| Beklenen | Nerede |
|---|---|
| *"İçerik yüklenemedi"* ekranı çıkar — **sahte başlık/özet YOK** | Cihaz (üç sayfa da) |
| Bölüm sayfasında **"TBA" rozeti YOK**, **"İzledim" butonu YOK DEĞİL** (çünkü sayfa hiç açılmadı) | Cihaz — özellikle önemli, eski davranış buydu |
| **"Tekrar Dene"** butonu var (yalnızca "Geri Dön" değil) | Cihaz — üç sayfada da |
| Uçak modunu kapat → **"Tekrar Dene"** → sayfa gerçek veriyle açılır | Cihaz |

> Dizi/film sayfası "Dizi bulunamadı" gibi yanlış bir teşhis **YAZMAMALI** —
> içerik duruyor, yalnızca yüklenemedi. Böyle bir metin görürsen T2 BAŞARISIZ.

---

## T3 · Gizlilik anahtarı sessiz başarısızlık (Y18) — ZORUNLU

**Neyi düzeltiyor:** Eskiden "gizle" dediğinde sunucu hata dönerse anahtar
sessizce eski hâline geri açılıyordu — kullanıcı fark etmezse gizlediğini
sanıyordu. Bir gizlilik kontrolünde sessizlik kabul edilemez.

1. **Ayarlar → Akış** bölümüne git
2. **Uçak modunu aç**
3. Herhangi bir anahtarı (İzlediklerimi Paylaş / Puanlarımı Paylaş) değiştir

| Beklenen | Nerede |
|---|---|
| Anahtar önce değişir (iyimser), sonra **eski hâline geri döner** | Cihaz |
| Bölümün **en üstünde** kırmızı bir uyarı kutusu çıkar (*"Ayar kaydedilemedi — aktiviteler hâlâ ESKİ ayarla paylaşılıyor."*) | Cihaz |
| Uyarı **sessizce kaybolmaz**, ayar değiştirmeyi tekrar deneyene kadar durur | Cihaz |
| Uçak modunu kapat → anahtarı tekrar değiştir → başarılı, uyarı kalkar | Cihaz |

---

## T4 · Onaysız metin kaybı — 3 yazma yüzeyi (Y16) — ZORUNLU

**Neyi düzeltiyor:** Arka plana dokunma, X ve Android geri tuşu, yazılan
metni onaysız siliyordu. Klavyeyi kapatmak için sheet'in üstündeki
karartılmış alana dokunmak mobilde en doğal refleks — yani uzun bir metin
tek dokunuşla, geri alınamaz şekilde gidiyordu.

Üç yüzeyin **her birinde** aşağıdaki dört kapatma yolunu ayrı ayrı dene:

| Yüzey | Nasıl açılır |
|---|---|
| **Gönderi oluştur** (`ComposePostModal`) | Akış sekmesinde "Gönderi Oluştur" |
| **Akış yorumu** (`FeedCommentSheet`) | Bir kartın yorum ikonuna dokun |
| **Not düzenleyici** (`NoteEditorModal`) | Bir izleme kartında notu düzenle |

Her yüzeyde:

1. En az birkaç kelime yaz
2. Sırayla dene: **(a)** karartılmış arka plana dokun **(b)** X'e bas **(c)** Android geri tuşuna bas

| Beklenen | Not |
|---|---|
| Üçünde de **onay sorulur** (*"...çıkılsın mı?"*) | "Vazgeç" metni siler, "Devam Et" sheet'i açık bırakır — ikisini de dene |
| **Not düzenleyici özel durum:** mevcut notu **hiç değiştirmeden** kapatırsan onay SORULMAMALI (ölçüt "metin var mı" değil "değişti mi") | Bu davranış BUG değil, bilinçli — bkz. `HISTORY` Madde 191 |
| "Devam Et"e basınca yazılan metin **duruyor**, sheet açık | Cihaz |

---

## T5 · `SectionErrorBoundary` — akış kartı + `MediaCast` (Y20, kısmi) — İSTEĞE BAĞLI

**Neyi düzeltiyor:** Bir kartın render hatası eskiden **tüm akışı**
`ErrorFallback`'e düşürüyordu. Bu turda yalnızca akış kartları ve
`show/[id].tsx`'teki `MediaCast` bloğu izole edildi — `MediaHero`,
`SeasonAccordion`, `HorizontalMediaList`, `movie` blokları **hâlâ izole
değil** (bilinçli olarak bu fazda yapılmadı).

Bu adımı test etmek gerçek bir render hatası **tetiklemeyi** gerektiriyor,
ki bu normal kullanımda kolayca oluşmaz — bu yüzden ZORUNLU değil. Yapmak
istersen: geliştirici modunda bilinçli olarak bir karta bozuk veri
göndermeyi dener misin bilmiyorum; pratik değilse atla, iddia etme.

---

## Sonuç Kaydı

Test bittiğinde bana şunu söyle, ben `HISTORY.md`'ye işleyeyim:

- Hangi T-adımları **geçti**
- Hangileri **BAŞARISIZ** oldu (ekranda ne gördüğünü tarif et — ekran
  görüntüsü varsa çok daha hızlı teşhis ederim)
- T1 gibi "atlanmış" adımlar varsa (ön koşul sağlanamadıysa) onu da belirt

> ⚠️ Bir adım başarısız olursa **diğerlerini durdurma** — hepsini bitir,
> sonunda tek seferde bildir. Kısmi bir bulguyla erken durmak, geri kalan
> kusurları gizler.
