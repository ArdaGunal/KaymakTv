# Kaymak 🍿

Kaymak, modern ve kullanıcı odaklı bir dizi/film takip uygulamasıdır. 
Trakt API altyapısını kullanarak kişisel izleme geçmişinizi, listelerinizi ve yaklaşan bölümleri tek bir yerden yönetmenizi sağlar.

## Özellikler

- **Yaklaşanlar Takvimi:** Gelecekte yayınlanacak olan bölüm ve filmleri takip edin. (Uzak gelecek bölümleri için gelişmiş önbellekleme desteği)
- **Watchlist & İzlenenler:** Listelerinizi kolayca yönetin.
- **Kategorize Edilmiş UI:** Kaydırılabilir (collapsible) grup başlıklarıyla düzenli bir görünüm.
- **Paylaşım Entegrasyonu:** Favori yapımlarınızı arkadaşlarınızla tek tıkla paylaşın.
- **Trakt OAuth:** Güvenli ve stabil kullanıcı girişi.

## Teknolojiler

- **React Native / Expo**
- **TypeScript**
- **Trakt API**
- **AsyncStorage / SecureStore**

## Kurulum

1. Depoyu klonlayın:
```bash
git clone https://github.com/KullaniciAdi/Kaymak.git
cd Kaymak
```

## 🎨 UI/UX Tasarım Mimarisi (Midnight Slate & Soft Glass)

Proje, 2026 modern mobil UI standartlarına uygun olarak tamamen güncellenmiş ve entegre bir tasarım diline geçmiştir.

- **Ana Arka Plan (Midnight Slate):** Standart nötr gri yerine, çok daha derin ve premium bir hissiyat veren `#0B1120` (Gece Yarısı / Koyu Lacivert) rengi.
- **Kutu ve Kartlar:** Ana arka planda kaybolmaması ve derinlik sağlaması için hafif lacivert-gri tonlarında `#172033` arka planlar ve yumuşak `#2A364F` kenarlıklar kullanıldı.
- **Vurgu Renkleri (Accent):** Tasarıma enerji katması için 'TARDIS Blue' (`#2D58FA`) ve daha okunabilir açık bir mavi olan `#3B82F6` (Rozetler ve Aktif Yazılar için) seçildi.
- **Başarı ve Onay (Success):** Tik butonları ve tamamlanan aksiyonlar için canlı bir onay yeşili (`#10B981`) kullanıldı. İzlenmemiş eylemler ise nötr şeffaf-beyaz bırakılarak kafa karışıklığı önlendi.
- **Soft Glass ve Ghost Efektleri:** Aktif sekmeler ve bilgi rozetlerinde (badges) yarı saydam `rgba` arka planlar kullanılarak zarif bir cam hissiyatı yaratıldı (Örn: `rgba(59, 130, 246, 0.15)` veya `rgba(255, 255, 255, 0.1)`).
- **SafeArea Optimizasyonu:** `SafeAreaView` kısıtlamaları kırılarak, `react-native-safe-area-context` insets değerleriyle dinamik boşluklar hesaplandı. Böylece içerikler ne üstteki iPhone çentiği/Dynamic Island altında, ne de sayfa sonlarındaki alt navigasyon menüsünün (Bottom Tab) altında ezilmiyor.

## 🚀 Temel Özellikler

- **Trakt.tv Entegrasyonu:** OAuth2 ile güvenli giriş, izleme geçmişini senkronize etme, ilerleme kaydetme ve bulut tabanlı veri yönetimi.
- **Gelişmiş İzleme Listesi (Watchlist):** Sıradakiler, Yaklaşanlar, İzleme Listesi ve Bir Süredir İzlenmeyenler olarak akıllı ve şık kategorizasyon.
- **Bölüm Check-in:** Soft Glass stiline sahip modern butonlarla izlenen bölümleri anında işaretleme. Geçmiş bölümleri kaçıranlar için "Öncekileri de işaretle" akıllı uyarısı.
- **Dinamik Keşfet & Kütüphane:** Trend olan dizileri/filmleri inceleme, Animeler, Animasyonlar ve detaylı istatistiklerle dolu Profil yönetimi.
- **Detay Sayfaları:** İlgili yapımın oyuncuları (Cast), tüm sezonları, yorumları, benzer yapımları ve dinamik bölüm sayacı (Kalan gün/saat gösterimi).
- **Pürüzsüz Animasyonlar:** Ekran yüklenirken içeriklerin titrememesini (Glitch/Pop Effect) sağlayan, cihaz genişliğine duyarlı Skeleton (İskelet) Loader'lar.

## 📂 Proje Yapısı

```
TvTaym/
├── app/                  # Expo Router (Dosya tabanlı yönlendirme sistemi)
│   ├── (tabs)/           # Alt navigasyon sekmeleri (İzleme, Keşfet, Profil vb.)
│   ├── episode/          # Bölüm detay sayfaları
│   ├── movie/            # Film detay sayfaları
│   └── show/             # Dizi detay sayfaları
├── components/           # Tekrar kullanılabilir UI bileşenleri (EpisodeCard, MediaHero, EpisodeCheckButton vb.)
├── context/              # React Context Yönetimi (AuthContext, LibraryContext)
├── hooks/                # Özel (Custom) React hookları (useAirCountdown vb.)
├── services/             # Dış servis bağlantıları (TraktApi, TmdbApi)
├── utils/                # Yardımcı fonksiyonlar (Tarih formatlama, dateHelper)
└── assets/               # Statik görseller, ikonlar
```

## 🛠️ Kurulum ve Çalıştırma

1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```
2. **Uygulamayı Başlatın:**
   ```bash
   npx expo start
   ```

## 📝 Son Yapılan Kritik Güncellemeler (V1.1 - UI/UX Modernizasyonu)
- **Sekme & Akordiyon Yenilenmesi:** İzleme Listesi sayfasındaki üst sekmeler iOS benzeri modern *Segmented Control* yapısına geçirildi. Kategori başlıkları Lucide ikonlar ve yuvarlatılmış hatlarla donatıldı.
- **Renk ve Tema Otomasyonu:** "Midnight Slate" isimli yepyeni karanlık temaya geçildi. Zıtlık, gölgeler ve göz yoran katı beyaz butonlar kaldırılarak UI zenginleştirildi.
- **Mantıksal UI Düzeltmesi:** "Henüz izlenmemiş" olan bölümlerin tik butonlarındaki anlamsız yeşil renk temizlendi. İzlenmemişler beklemede (Ghost White), izlenenler onaylı (Neon Green) olarak işaretlendi.
- **Hata Yönetimi (Graceful Fallback):** API'den oyuncu (cast) veya sezon bilgisi eksik gelen içeriklerde (özellikle yeni animeler) uygulamanın çökmesi engellendi; bu bölümler akıllıca gizlenerek temiz bir kullanıcı deneyimi sağlandı.
