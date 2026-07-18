# KaymakTV - Yapay Zeka (AI) Çalışma Kuralları

Bu döküman, bu projede geliştirme yapacak olan tüm Yapay Zeka (AI) asistanları ve kod üreticileri için zorunlu kuralları içerir. Bu kuralların dışına çıkılması KABUL EDİLEMEZ.

Proje, birden fazla geliştirici ve onların kullandığı farklı AI asistanları tarafından ortaklaşa geliştirilmektedir — bu yüzden kurallara herkesin **kesinlikle** uyması gerekir.

---

## 1. Kodlama Standartları ve Kalite

### 🚫 SPAGETTİ KOD YASAKTIR
- Hiçbir bileşen (Component) veya ekran (Screen) hem veri çekme (Data Fetching), hem küresel state yönetimi, hem de karmaşık modal/arayüz tasarımlarını aynı dosya içinde barındırmamalıdır.
- Dosya boyutu **400 satırı** aşmaya başladığında mutlaka modüler parçalara bölünmelidir.
- Eski "God Context" / "God Object" yapılarına (tek dosyada her işi yapan devasa context/servis) geri dönülmez. Yeni özellikler eklerken daima katman ayrımını koruyun.

### 📦 MODÜLER MİMARİ
- **UI & Logic Ayrımı:** Görsel arayüz elemanları ile iş mantığı (handlers, API calls, hooks) kesinlikle ayrılmalıdır.
- **Custom Hooks:** Sayfalardaki veri çekme ve manipülasyon mantığı her zaman custom hook'lar (örn: `useShowDetail`, `useMovieDetail`) içerisine taşınmalıdır.
- **Bileşenlerin Parçalanması:** Uzun liste render'ları, kartlar ve özellikle **Modallar** bağımsız bileşenler haline getirilip (`components/modals/` vb.) ana dosyadan dışarı çıkarılmalıdır.
- **State Yönetimi:** Küresel state için yüksek performanslı **Zustand** (`store/slices/`) kullanılır; API/servis çağrıları `services/` katmanında izole edilir. UI tarafına yalnızca temiz veriler/fonksiyonlar iletilmelidir.
- **Barrel Pattern:** Servis katmanında veya ortak bileşenlerde import yollarının karmaşıklaşmaması için yönlendirici (barrel) dosyalar kullanılmalıdır (örn. `services/traktApi.ts` → `services/api/*`).

---

## 2. Güvenlik ve Kararlılık

### 🔒 SİSTEM AÇIKLARI VE GÜVENLİK
- Uygulamada yetkisiz (Unauthorized) işlemlere izin verilmemelidir. Misafir kullanıcılar (`isGuest`) için kısıtlamalar (`Alert.alert` ve işlem engelleme) eksiksiz uygulanmalıdır.
- API anahtarları (Secrets), client secret'lar, token'lar ve hassas veriler kesinlikle istemci (client) koduna gömülmemeli; sunucu tarafı bir proxy köprüsü (backend/serverless function) üzerinden gizlenmelidir.
  - **Kritik:** Expo'da `EXPO_PUBLIC_` önekli her env değişkeni build zamanında JS bundle'ına gömülür ve uygulamayı indiren herkes tarafından okunabilir hale gelir. Bu yüzden `EXPO_PUBLIC_*` değişkenlerine **asla** client secret, API secret key gibi gizli kalması gereken değerler konulmamalıdır — sadece public ID'ler (client id, public API key vb.) bu şekilde tanımlanabilir.
- Kullanıcı girdileri (örn: arama kutuları, yorum alanları, URL/Slug parametreleri) temizlenmeli (sanitize edilmeli) ve olası çökmelere karşı korumalı olmalıdır.
- Eklenecek her kod; API rate limit'lerine ve sonsuz döngülere (infinite loops / infinite redirect) karşı katı şekilde kontrol edilmelidir.

### 🛡️ ERROR HANDLING (HATA YÖNETİMİ)
- Try-catch blokları eksiksiz kullanılmalı ve asenkron işlemler sırasında oluşabilecek hatalar kullanıcı dostu uyarılarla (Snackbar/Alert) yakalanmalıdır.
- `undefined` veya `null` olabilecek nesne özelliklerine erişirken mutlaka opsiyonel zincirleme (`?.`) ve varsayılan değer atamaları (`??`) kullanılmalıdır.

---

## 3. Belgeleme ve Takip (Documentation)

### 📝 DÖKÜMANTASYON GÜNCELLEME ZORUNLULUĞU
- **Altın Kural:** Projeye eklenen her yeni özellik, çözülen her majör hata (bug) veya yapılan her refactoring (kod temizliği) / mimari değişiklik sonrasında `docs/` altındaki `.md` dosyaları (özellikle `docs/HISTORY.md` ve gerekiyorsa `docs/ARCHITECTURE.md`) güncellenmelidir.
- AI asistanı, yaptığı değişikliklerin bir özetini ve nedenlerini tarih/madde sırasına göre `docs/HISTORY.md` dosyasına yeni bir madde olarak eklemek zorundadır. Bu, takım arkadaşlarının ve diğer AI asistanlarının projeyi anlayabilmesi için zorunludur.
