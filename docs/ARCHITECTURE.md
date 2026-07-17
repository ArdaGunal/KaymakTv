<<<<<<< HEAD
# KaymakTV Uygulama Mimarisi (Architecture)

Bu döküman, KaymakTV projesinin modernleştirilmiş mimari yapısını, katmanlarını ve tasarım kararlarını açıklamaktadır.

---

## 1. Genel Mimari Yaklaşım
KaymakTV, **React Native (Expo)** tabanlı ve **Cross-Platform (iOS, Android, Web)** destekli bir uygulamadır. Kod tabanının temiz, sürdürülebilir ve test edilebilir olması için **Katmanlı Mimari (Layered Architecture)** prensipleri benimsenmiştir:

1. **Sunum Katmanı (UI Layer):** `app/` ve `components/` klasörleri. Sadece veriyi gösterir ve kullanıcı etkileşimlerini tetikler.
2. **Durum Yönetimi Katmanı (State Management):** Zustand (`store/`) ve geriye uyumluluk için hafif proxy rolü üstlenen React Context (`context/`).
3. **Servis/Veri Katmanı (Data/Service Layer):** `services/` ve `utils/` klasörleri. API isteklerini, önbellekleme (AsyncStorage/SecureStore) işlerini yürütür.
4. **İş Mantığı Katmanı (Business Logic):** Custom Hooks (`hooks/`). API'den gelen verileri UI için harmanlar.

---

## 2. Klasör ve Dosya Yapısı

```text
/
├── app/                  # Expo Router tabanlı sayfa yönlendirmeleri (Screens)
│   ├── (protected)/      # Giriş yapmış kullanıcılara özel sayfalar
│   ├── (public)/         # Giriş yapmamış kullanıcılara açık sayfalar (örn: Landing)
│   └── show/[id].tsx     # Dizi detay ekranı
│   └── movie/[id].tsx    # Film detay ekranı
│   └── episode/[id].tsx  # Bölüm detay ekranı
├── components/           # Yeniden kullanılabilir UI Bileşenleri
│   ├── modals/           # Uygulamadaki tüm pop-up ve alt çekmeceler (RatingModal, OptionsModal, vb.)
│   └── ...
├── context/              # Küresel Context yapıları (Zustand Proxy'leri)
│   ├── AuthContext.tsx   # Kimlik doğrulama yönetimi
│   └── LibraryContext.tsx# Kütüphane / İzleme durumları proxy'si
├── hooks/                # Custom React kancaları
│   ├── useShowDetail.ts  # Dizi detayı veri çekme ve harmanlama mantığı
│   ├── useMovieDetail.ts # Film detayı veri çekme ve harmanlama mantığı
│   └── ...
├── services/             # API ve Veri erişim katmanı
│   ├── api/              # Modüler Trakt API servisleri
│   │   ├── traktClient.ts# Axios instance'ı ve interceptor yönetimi
│   │   ├── shows.ts      # Dizi API çağrıları
│   │   ├── movies.ts     # Film API çağrıları
│   │   └── ...
│   ├── traktApi.ts       # Barrel File (Eski importları kırmayan yönlendirici)
│   └── tmdbApi.ts        # TMDB görsel ve fragman servisleri
├── store/                # Zustand State Mağazaları (Slices)
└── utils/                # Yardımcı fonksiyonlar (formatters, slugHelper vb.)
```

---

## 3. Kritik Tasarım Kararları

### A. Zustand ve Context Proxy Uyumu
Eski devasa `LibraryContext.tsx` yerine Zustand'a geçilmiş, ancak onlarca ekranın import yapısını bozup hata riskini artırmamak için Context bir "Proxy Hook" olarak bırakılmıştır. UI bileşenleri hala `useLibrary()` çağırır fakat arka planda istekler Zustand mağazasına (`useLibraryStore`) yönlendirilir.

### B. Trakt API Modülerizasyonu
`services/traktApi.ts` God Object olmaktan çıkarılmış; Axios istemcisi `traktClient.ts` içerisine izole edilmiş, endpoint'ler ise kendi domain dosyalarına (`shows.ts`, `movies.ts`, `users.ts` vb.) ayrılmıştır. `traktApi.ts` ise geriye dönük uyumluluk için bir Barrel (yönlendirici) dosyası olarak işlev görmektedir.

### C. UI ve Modalların Ayrılması
Ekranların şişmesini engellemek için tüm Modal pencereleri (`RatingModal`, `OptionsModal`, `EpisodeOptionsModal`, `EpisodeRatingModal`) `components/modals/` klasörü altına bağımsız bileşenler olarak taşınmıştır. Ekranlar sadece bu modalları import edip render eder.
=======
# Proje Mimarisi ve Klasör Yapısı

TvTaym, modülerliği artırmak ve spagetti kod oluşumunu engellemek için bileşenlere (components), servislere (services) ve bağlamlara (context) bölünmüştür.

## Klasör Yapısı

```
TvTaym/
│
├── app/                  # Expo Router sayfa yapısı (Tüm sayfalar buradadır)
│   ├── (public)/         # Giriş yapmamış kullanıcılara açık alan (Ziyaretçiler)
│   │   ├── _layout.tsx   # Ziyaretçi yönlendirmeleri
│   │   ├── index.tsx     # Mobil için standart Karşılama Ekranı (Landing Page)
│   │   ├── index.web.tsx # Web için HTML/CSS tabanlı Özel Karşılama Ekranı
│   │   └── settings.tsx  # Trakt OAuth 2.0 giriş ekranı ve ayarlar
│   ├── (protected)/      # Giriş yapmış kullanıcıların alanı (Auth Guard)
│   │   ├── _layout.tsx   # Oturum kontrolü ve Korumalı iskelet
│   │   └── (tabs)/       # Alt menü sekmeleri (İzleme, Keşfet, Profil vb.)
│   │       ├── _layout.tsx   # Sekme menüsünün iskeleti ve tasarımı
│   │       ├── shows.tsx     # Ana Sayfa (İzleme Listesi)
│   │       ├── discover.tsx  # Keşfet Sayfası
│   │       └── profile.tsx   # Profil Sayfası
│   └── _layout.tsx       # Uygulamanın ana kapısı ve root yönlendirme
│
├── components/           # Tekrar kullanılabilir UI parçaları
│   ├── EpisodeCard.tsx   # Siyah tasarımlı dizi kartı (Mobil)
│   └── EpisodeCard.web.tsx # Platform Splitting (Sadece Web için Netflix Stili Dikey Kart)
│
├── store/                # Yüksek performanslı Global durum yönetimi (Zustand)
│   ├── useLibraryStore.ts# Ana depo
│   └── slices/           # Mantıksal veri bölümleri (History, Watchlist, vb.)
│
├── context/              # Bağlamlar (Contexts) ve Geri Uyumluluk Köprüleri
│   ├── AuthContext.tsx   # Access Token verisini yönetir ve dağıtır
│   └── LibraryContext.tsx# (Eski God Context) Zustand ve servisleri sayfalara bağlayan hafif Proxy Hook
│
├── services/             # Dış servisler ve İş Mantığı (Logic)
│   ├── libraryService.ts # API çağrıları ve AsyncStorage operasyonları (UI'dan izole)
│   ├── traktApi.ts       # Trakt.tv'ye atılan tüm Axios istekleri (Get, Post vb.)
│   └── tmdbApi.ts        # Görseller için TheMovieDB API istekleri
│
├── netlify/              # Serverless Backend Mimarisi
│   └── functions/        # Netlify sunucusuz (serverless) fonksiyonları
│       ├── trakt-auth.js # Trakt Client Secret'ı gizleyen Proxy köprüsü (OAuth Token çeviricisi)
│       └── tmdb-proxy.js # Web'de CORS hatalarını aşmak için TMDB API Köprüsü
│
└── docs/                 # Projenin belgelendirme klasörü (Siz buradasınız)
```

## Kullanılan Teknolojiler
- **Expo & React Native:** Çapraz platform (iOS/Android) mobil uygulama altyapısı. SDK 54 sürümü kullanılmaktadır.
- **Zustand:** Yüksek performanslı, seçici render destekli modern global state yönetim kütüphanesi.
- **Expo Router:** Dosya tabanlı sayfa yönlendirmesi.
- **Expo Auth Session:** Trakt In-App Browser tabanlı OAuth 2.0 güvenli yetkilendirme akışı.
- **Netlify Functions:** `Client Secret` gizliliği için Backend For Frontend (BFF) Proxy köprüsü ve Web platformunda CORS yönetimi (TMDB Proxy).
- **Platform Splitting (.web.tsx):** Mobil (iOS/Android) mimarisini %100 korumak adına, Web'e özel masaüstü UI tasarımları `.web.tsx` uzantılı dosyalar üzerinden Expo/Metro bundler aracılığıyla otomatik ayrıştırılır.
- **Expo Secure Store:** Token'ların cihazda güvenli şekilde kriptolanarak saklanması (Web'de localStorage'a düşer).
- **Axios:** Trakt ve TMDB API ile haberleşmek için HTTP istemcisi.
- **Lucide React Native:** Projedeki modern ve şık SVG ikon seti.

## Sistem İşleyişi (OAuth 2.0 Akışı)
1. Kullanıcı uygulamada "Giriş" dediğinde `expo-auth-session` cihazda tarayıcı açar.
2. Trakt sunucularında onay verildikten sonra `tvtaym://auth` scheme'ine bir yetki kodu (`code`) döner.
3. Uygulama bu kodu alır ve Netlify üzerindeki `trakt-auth.js` proxy'sine atar.
4. Netlify, kendi içindeki gizli `CLIENT_SECRET`'ı ekleyip kodu Access Token'a dönüştürür.
5. Uygulama Token'ı alıp `SecureStore` içine yazar.
>>>>>>> de7e192ccf00c397f9213158998806b92479dfc5
