# KaymakTV - Yapay Zeka (AI) Çalışma Kuralları

Bu döküman, bu projede geliştirme yapacak olan tüm Yapay Zeka (AI) asistanları ve kod üreticileri için zorunlu kuralları içerir. Bu kuralların dışına çıkılması KABUL EDİLEMEZ.

---

## 1. Kodlama Standartları ve Kalite

### 🚫 SPAGETTİ KOD YASAKTIR
- Hiçbir bileşen (Component) veya ekran (Screen) hem veri çekme (Data Fetching), hem küresel state yönetimi, hem de karmaşık modal/arayüz tasarımlarını aynı dosya içinde barındırmamalıdır.
- Dosya boyutu **400 satırı** aşmaya başladığında mutlaka modüler parçalara bölünmelidir.

### 📦 MODÜLER MİMARİ
- **UI & Logic Ayrımı:** Görsel arayüz elemanları ile iş mantığı (handlers, API calls, hooks) kesinlikle ayrılmalıdır.
- **Custom Hooks:** Sayfalardaki veri çekme ve manipülasyon mantığı her zaman custom hook'lar (örn: `useShowDetail`, `useMovieDetail`) içerisine taşınmalıdır.
- **Bileşenlerin Parçalanması:** Uzun liste render'ları, kartlar ve özellikle **Modallar** bağımsız bileşenler haline getirilip (`components/modals/` vb.) ana dosyadan dışarı çıkarılmalıdır.
- **Barrel Pattern:** Servis katmanında veya ortak bileşenlerde import yollarının karmaşıklaşmaması için yönlendirici (barrel) dosyalar kullanılmalıdır.

---

## 2. Güvenlik ve Kararlılık

### 🔒 SİSTEM AÇIKLARI VE GÜVENLİK
- Uygulamada yetkisiz (Unauthorized) işlemlere izin verilmemelidir. Misafir kullanıcılar (`isGuest`) için kısıtlamalar (`Alert.alert` ve işlem engelleme) eksiksiz uygulanmalıdır.
- API anahtarları (Secrets), token'lar ve hassas veriler kesinlikle istemci (client) koduna gömülmemeli, `.env` dosyaları veya Netlify Functions gibi proxy köprüleri kullanılmalıdır.
- Kullanıcı girdileri (örn: arama kutuları, yorum alanları, URL/Slug parametreleri) temizlenmeli (sanitize edilmeli) ve olası çökmelere karşı korumalı olmalıdır.

### 🛡️ ERROR HANDLING (HATA YÖNETİMİ)
- Try-catch blokları eksiksiz kullanılmalı ve asenkron işlemler sırasında oluşabilecek hatalar kullanıcı dostu uyarılarla (Snackbar/Alert) yakalanmalıdır.
- `undefined` veya `null` olabilecek nesne özelliklerine erişirken mutlaka opsiyonel zincirleme (`?.`) ve varsayılan değer atamaları (`??`) kullanılmalıdır.

---

## 3. Belgeleme ve Takip (Documentation)

### 📝 DÖKÜMANTASYON GÜNCELLEME ZORUNLULUĞU
- **Altın Kural:** Projeye eklenen her yeni özellik, yapılan her refactoring (kod temizliği) veya mimari değişiklik sonrasında `docs/` altındaki `.md` dosyaları (özellikle `docs/HISTORY.md` ve `docs/ARCHITECTURE.md`) güncellenmelidir.
- AI asistanı, yaptığı değişikliklerin bir özetini ve nedenlerini tarih sırasına göre `docs/HISTORY.md` dosyasına yeni bir madde olarak eklemek zorundadır.
