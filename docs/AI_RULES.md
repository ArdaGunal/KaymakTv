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
