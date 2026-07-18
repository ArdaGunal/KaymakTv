# KaymakTV Uygulama Mimarisi (Architecture)

Bu döküman, KaymakTV projesinin mimari yapısını, katmanlarını ve tasarım kararlarını açıklamaktadır.

---

## 1. Genel Mimari Yaklaşım
KaymakTV, **React Native (Expo SDK 54)** tabanlı ve **Cross-Platform (iOS, Android, Web)** destekli bir uygulamadır. Kod tabanının temiz, sürdürülebilir ve test edilebilir olması için **Katmanlı Mimari (Layered Architecture)** prensipleri benimsenmiştir:

1. **Sunum Katmanı (UI Layer):** `app/` ve `components/` klasörleri. Sadece veriyi gösterir ve kullanıcı etkileşimlerini tetikler.
2. **Durum Yönetimi Katmanı (State Management):** Zustand (`store/`) ve geriye uyumluluk için hafif proxy rolü üstlenen React Context (`context/`).
3. **Servis/Veri Katmanı (Data/Service Layer):** `services/` ve `utils/` klasörleri. API isteklerini, önbellekleme (AsyncStorage/SecureStore) işlerini yürütür.
4. **İş Mantığı Katmanı (Business Logic):** Custom Hooks (`hooks/`). API'den gelen verileri UI için harmanlar.

---

## 2. Klasör ve Dosya Yapısı

```text
/
├── app/                  # Expo Router tabanlı sayfa yönlendirmeleri (Screens)
│   ├── (public)/         # Giriş yapmamış kullanıcılara açık alan
│   │   ├── index.tsx     # Mobil Karşılama Ekranı (Landing)
│   │   ├── index.web.tsx # Web'e özel HTML/CSS tabanlı Karşılama Ekranı
│   │   └── settings.tsx  # Trakt OAuth giriş ekranı ve ayarlar
│   ├── (protected)/      # Giriş yapmış kullanıcılara özel sayfalar (Auth Guard)
│   │   └── (tabs)/       # Alt menü sekmeleri (shows, explore, profile, vb.)
│   ├── show/[id].tsx     # Dizi detay ekranı
│   ├── movie/[id].tsx    # Film detay ekranı
│   └── episode/[id].tsx  # Bölüm detay ekranı
├── components/           # Yeniden kullanılabilir UI Bileşenleri
│   ├── modals/           # Uygulamadaki tüm pop-up ve alt çekmeceler (RatingModal, OptionsModal, vb.)
│   └── EpisodeCard.web.tsx # Platform Splitting örneği (bkz. aşağıda)
├── context/              # Küresel Context yapıları (Zustand Proxy'leri)
│   ├── AuthContext.tsx   # Kimlik doğrulama / token yönetimi
│   └── LibraryContext.tsx# Kütüphane / İzleme durumları proxy'si (eski God Context, artık Proxy Hook)
├── hooks/                # Custom React kancaları
│   ├── useShowDetail.ts  # Dizi detayı veri çekme ve harmanlama mantığı
│   ├── useMovieDetail.ts # Film detayı veri çekme ve harmanlama mantığı
│   └── ...
├── services/             # API ve Veri erişim katmanı
│   ├── api/              # Modüler Trakt API servisleri
│   │   ├── traktClient.ts# Axios instance'ı ve interceptor yönetimi
│   │   ├── auth.ts       # OAuth token değişimi (bkz. Bölüm 4 — bilinen sorun)
│   │   ├── shows.ts      # Dizi API çağrıları
│   │   ├── movies.ts     # Film API çağrıları
│   │   └── ...
│   ├── traktApi.ts       # Barrel File (Eski importları kırmayan yönlendirici)
│   ├── libraryService.ts # Kütüphane senkronizasyon/cache mantığı
│   └── tmdbApi.ts        # TMDB görsel ve fragman servisleri
├── store/                # Zustand State Mağazaları
│   ├── useLibraryStore.ts# Ana depo
│   └── slices/           # Mantıksal veri bölümleri (history, watchlist, favorites, lists, calendar, ratings)
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

### D. Platform Splitting (.web.tsx)
Mobil (iOS/Android) arayüzüne dokunulmadan Web'e özel masaüstü tasarımları sunmak için Expo/Metro bundler'ın dosya uzantısı bazlı otomatik ayrıştırması kullanılır: `import EpisodeCard from './EpisodeCard'` ifadesi Web derlemesinde otomatik olarak `EpisodeCard.web.tsx` dosyasını, mobilde ise `EpisodeCard.tsx` dosyasını çözer. Örnekler: `index.web.tsx`, `shows.web.tsx`, `EpisodeCard.web.tsx`, `MovieCard.web.tsx`. Bu ikilinin iş mantığı (veri çekme/dönüştürme) aynı olmalı — yalnızca görsel katman farklılaşmalıdır; ortak mantık `hooks/` veya `utils/` içine çıkarılmalıdır.

---

## 4. Sistem İşleyişi (OAuth 2.0 Akışı) — Express BFF Proxy Üzerinden

1. Kullanıcı "Giriş" dediğinde `expo-auth-session` cihazda/tarayıcıda Trakt'ın onay ekranını açar (In-App Browser).
2. Trakt onaydan sonra uygulamanın `scheme`'ine (`app.json` → `"scheme": "kaymak"`) bir yetki kodu (`code`) ile geri döner.
3. Uygulama bu kodu `services/api/auth.ts` içindeki `exchangeAuthCode` fonksiyonuna verir. Bu fonksiyon Trakt'ı **doğrudan çağırmaz** — `server.js`'teki `POST /api/trakt` proxy uç noktasına gider (istek gövdesi: `{ code, redirect_uri }`). `Client Secret` sadece sunucuda, `TRAKT_CLIENT_SECRET` ortam değişkeninde (öneksiz — `EXPO_PUBLIC_` **değil**) tutulur ve asla client bundle'ına gömülmez.
4. Token yenileme (401 sonrası) de aynı proxy'yi kullanır: `services/api/traktClient.ts`'deki Axios interceptor, `services/api/auth.ts`'deki `refreshTraktToken` fonksiyonunu çağırır (`{ refresh_token, redirect_uri }` gönderir); Trakt'a giden gerçek istek yine `server.js` içinde, secret ile birlikte kurulur.
5. Uç adres seçimi `services/tmdbApi.ts`'deki `TMDB_PROXY_URL` deseniyle birebir aynıdır: `EXPO_PUBLIC_API_URL` tanımlıysa (native derlemeler için gerekli — cihazın sunucuya ulaşacağı mutlak adres) `${EXPO_PUBLIC_API_URL}/api/trakt` kullanılır; tanımlı değilse (Web, aynı origin'den servis edildiği için) göreli `/api/trakt` yeterlidir.
6. Token alındıktan sonra `SecureStore` içine yazılır (Web'de `localStorage`'a düşer).

> ✅ **2026-07-18 güncellemesi:** Bu bölümde önceden "Bilinen Güvenlik Sorunu" olarak işaretlenen açık (Trakt Client Secret'ın `EXPO_PUBLIC_TRAKT_CLIENT_SECRET` ile client bundle'ına gömülmesi) kapatıldı. `server.js`'te zaten var olan ama frontend tarafından hiç kullanılmayan `POST /api/trakt` uç noktası sertleştirildi (artık `EXPO_PUBLIC_TRAKT_CLIENT_SECRET`'a fallback yapmıyor) ve hem `exchangeAuthCode` hem de token yenileme akışı bu uç noktaya yönlendirildi. Detay için `docs/HISTORY.md` Madde 25.

---

## 5. Kullanılan Teknolojiler
- **Expo & React Native:** Çapraz platform (iOS/Android/Web) uygulama altyapısı, SDK 54.
- **Expo Router:** Dosya tabanlı sayfa yönlendirmesi.
- **Zustand:** Yüksek performanslı, seçici render destekli global state yönetimi.
- **Expo Auth Session:** Trakt In-App Browser tabanlı OAuth 2.0 yetkilendirme akışı (bkz. Bölüm 4).
- **Expo Secure Store:** Token'ların cihazda şifrelenerek saklanması.
- **Axios:** Trakt ve TMDB API'leriyle haberleşen HTTP istemcisi.
- **Lucide React Native:** Proje genelinde kullanılan SVG ikon seti.
