# TV Time Alternatifi Uygulama Projesi TODO

## 🚀 ACİL ÖNCELİKLİ (Yavaşlık Sorunu Çözüldü ✅)
- [x] **Performans İyileştirmesi:** Web platformunda yaşanan 1 dakikalık donma sorunu InteractionManager kilidinin (`isInteraction: false`) kaldırılması ve TMDB afişlerinin `SecureStore` (localStorage) ile önbelleğe alınmasıyla çözüldü. Artık Web sürümü anında yükleniyor.
- [ ] **Tüm Bölümleri Önbellekleme (Gelecek Diziler Sorunu):** Trakt API'nin 33 günlük limitini aşmak için uygulanan "Sıradaki Bölüm" sisteminin bir yan etkisi olarak, bir dizinin gelecekte çıkacak 2. veya 3. bölümü ekranda görünmüyor. Bu durum, dizilerin tüm bölüm listeleri arka planda telefon hafızasına kaydedildiğinde çözülecek.

## Tamamlanan Özellikler ve Sistem Kuralları (Mimarisi Oturanlar)
- [x] **Kullanıcı Girişi:** Trakt Device Authentication ile başarılı giriş.
- [x] **Profil ve Veri Çekme:** İzleme geçmişi (History) üzerinden dizilerin çekilmesi. Kütüphane (View All) yapısı sonsuz kaydırma ile tamamlandı.
- [x] **Tasarım:** Siyah (`slate-950`) ağırlıklı, mor (`purple-600`) veya sarı vurgulu klasik arayüz.
- [x] **Sonra İzle (Watchlist):** Watchlist entegrasyonu tamamlandı.
- [x] **Özel Listeler (Custom Lists):** Özel listeler ve Favoriler profile entegre edildi.
- [x] **İzlemeyi Bitir / Güncel Diziler (KURAL):** Trakt API'den `next_episode` alınamazsa (dizi güncel veya bitmişse), ana sayfada "İzleme Listesi" (Sıradakiler) sekmesinden GİZLENİR. Bu, TV Time'ın ana felsefesidir.
- [x] **Bırakılan / Yarım Kalan Diziler (KURAL):** Kullanıcının Watchlist'inde olmasına rağmen aslında bölümleri izlenmiş olan diziler `Henüz Başlanmadı` kategorisinde gösterilmez. Doğrudan gerçek ilerlemesi ile `Bir Süredir İzlenmedi` listesine aktarılır ve "BIRAKILDI" etiketi alır.
- [x] **Yaklaşanlar (Up Next / Takvim) Sayfası:** Trakt takvim API'si kullanılarak önümüzdeki 30 gün içinde çıkacak dizilerin takvim şeklinde listelenmesi tamamlandı. "Bugün", "Yarın" gibi dinamik etiketlerle donatıldı.
- [x] **Dizi Detay Ekranı (`[id].tsx`):** Afişlere tıklandığında dizinin özetinin, oyuncularının ve sezon/bölüm listesinin açıldığı özel detay sayfası tamamlandı. Tüm Sezonu İşaretleme (Bulk Sync) özelliği eklendi.
- [x] **Bölüm Detay Ekranı (`episode/[id].tsx`):** Bölüm görseli (still), kadro, modern/spoiler-korumalı yorum arayüzü ve "Tümünü Gör" Webview desteği eklendi. Ayrıca sayfa içine İzledim (Check-in) butonu konuldu.
- [x] **Akıllı Catch-Up (Öncekileri Doldur):** Kullanıcı ileri bir bölümü işaretlediğinde aradaki atlanmış bölümler de tek seferde senkronize ediliyor.
- [x] **Merkezi Beyin (LibraryContext):** Sayfa geçişlerinde API sınırlarına (429 Rate Limit) takılmamak ve hızlı yükleme sağlamak için ilerleme verisi (showProgress) ve detaylar cache'lendi.
## Geliştirilecek Ana Özellikler (Beklemede)
- [ ] **Profil Sayfası Yeni Sekmeler:** Profil sayfasına 'Devam Edenler', 'Bırakılanlar' ve 'Bitenler' olarak 3 yeni sekme/kategori eklenecek. Ana sayfadan filtrelenen tüm arşiv dizileri buraya taşınacak.
- [ ] **Arama (Keşfet) Ekranı:** Alt menüden ulaşılacak olan, Trakt arama servisi ile uygulamaya yeni diziler ekleyebilme özelliği.

## Geliştirmeler (İyileştirmeler)
- [ ] **Sezon ve Bölüm Cache (Önbellek):** Her açılışta `getShowProgress`'i yüzlerce kez tetiklememek için cihaz hafızasında `SecureStore` veya `AsyncStorage` ile bölüm bilgilerinin tutulması (Daha sonra optimize edilecek).
- [x] **TMDB Rate Limit Koruması:** `getShowPoster` fonksiyonundaki 429 hataları `chunk` yapısıyla engellendi ve resim linkleri kalıcı (localStorage/SecureStore) önbelleğe alındı.
- [x] **Web Platformu İçin Platform Splitting:** Mobil arayüze (`.tsx`) dokunulmadan masaüstüne özel (`.web.tsx`) dikey afişli (hover efektli) Netflix stili yatay listeler entegre edildi.
