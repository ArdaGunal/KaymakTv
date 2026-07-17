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
