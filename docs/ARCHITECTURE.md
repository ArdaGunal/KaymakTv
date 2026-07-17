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
