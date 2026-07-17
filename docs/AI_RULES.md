<<<<<<< HEAD
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
=======
# Yapay Zeka (AI) Geliştirici Kuralları

Bu proje iki farklı geliştirici ve onların kullandığı Yapay Zeka (AI) asistanları tarafından ortaklaşa geliştirilmektedir. Lütfen aşağıdaki kurallara **kesinlikle** uyun:

1. **Spagetti Kod Yasaktır:** 
   Dosyaların yüzlerce satır uzamasına, UI (Kullanıcı Arayüzü) ile Logic (İş Mantığı) katmanlarının aynı dosyada birbirine girmesine asla izin verilmez. Eski "God Context" yapıları tamamen kaldırılmıştır. Yeni özellikler eklerken daima bu ayrımı koruyun.

2. **Modüler Kod Yazılacak:**
   Proje yüksek performanslı **Zustand** (Global State) ve bağımsız Servisler (`services/`) mimarisi kullanır. Yeni bir özellik veya veri çekme işlemi ekleneceği zaman, bu işlemler servis dosyalarına yazılmalı ve UI tarafına sadece temiz veriler/fonksiyonlar iletilmelidir.

3. **Sistemde Açıklar (Güvenlik / Bug) Olmayacak:**
   Eklenecek her kod, olası hatalara (try/catch), API rate limitlerine ve sonsuz döngülere (infinite loops) karşı katı bir şekilde kontrol edilmelidir. Hata yönetimi (Error Handling) eksiksiz olmalıdır.

4. **Her Özellik Sonrası Dökümantasyon Güncellenecek:**
   Başarıyla eklenen her yeni özellik veya çözülen her majör hata (bug), mutlaka `docs/` klasörü altındaki Markdown (`.md`) dökümantasyonlarına (Örn: `HISTORY.md` veya `ARCHITECTURE.md`) kalıcı olarak işlenmeli ve güncellenmelidir. Takım arkadaşınızın ve diğer AI'ın projeyi anlayabilmesi için bu **zorunludur**.
>>>>>>> de7e192ccf00c397f9213158998806b92479dfc5
