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
- **Sessiz başarısızlık YASAKTIR:** Kullanıcının başlattığı bir eylem (butona basma) başarısız olduğunda ekranda görünür bir geri bildirim OLMAK ZORUNDADIR. Trakt'a giden asenkron bir çağrı `await` edilmeden ve `catch`'lenmeden bırakılırsa, hata yalnızca konsola düşer — kullanıcı için buton "çalışmıyor" görünür ve teşhisi neredeyse imkânsız olur. `console.error` tek başına YETERLİ DEĞİLDİR; kalıcı tanılama için `logError` da kullanılmalıdır.

---

## 2.5. Ölü Kod ve Refactor Hijyeni

### 🧹 ÖLÜ KOD BIRAKMAK YASAKTIR
Bir mantığı/özelliği yeni bir yere (bileşen, hook, servis) **taşıdığında, eski yerdeki kopyayı AYNI değişiklikte SİL.** "Sonra temizleriz" diye bırakılan kopyalar zamanla şu üç somut zarara yol açar:

1. **Yanlış yeri düzeltirsin.** İki kopya varsa, bir hata bildirildiğinde ölü olanı düzeltip "düzelttim ama çalışmıyor" tuzağına düşersin.
2. **Kopyalar sessizce ıraksar.** Yeni yerdeki sürüme eklenen korumalar (misafir kontrolü, onay diyaloğu, yayınlanmamış bölüm ayıklama vb.) eski kopyaya eklenmez; kod tabanı hangisinin doğru olduğunu artık söyleyemez.
3. **Gerçek kaybı gizler.** Ölü kod gürültüsü arttıkça, arayüzden GERÇEKTEN kopmuş bir özelliği fark etmek imkânsızlaşır.

**Kurallar:**
- Bir özelliği taşıdığında/değiştirdiğinde: eski state, handler, `StyleSheet` girdisi, çeviri anahtarı ve import'un **hepsini** aynı anda temizle. Yarım bırakma.
- Yeni kod yazarken "ileride lazım olur" diye bağlanmamış state/fonksiyon **ekleme**. İhtiyaç doğduğunda yazılır.
- Bir prop/parametre artık her çağrı yerinde sabit bir değere düşüyorsa (ör. her yerde `false`), o prop ölmüştür — kaldır.
- Bir çeviri anahtarı kodda kullanılmıyorsa `locales/tr` **ve** `locales/en` dosyalarından birlikte sil.

### 🔬 SİLMEDEN ÖNCE OTOPSİ ZORUNLUDUR
Kullanılmayan kodu **asla körlemesine silme.** Her biri için önce şu üç soruyu cevapla:

1. **Nerede?** Hangi dosya/bileşen.
2. **Ne işe yarıyordu?** Mantığın amacı ne.
3. **Neden boşta kaldı?** Üç ihtimal vardır ve **her biri farklı sonuç doğurur**:
   - **(a) Taşınmış** → Özellik yeni yerinde yaşıyor. Eski kopyayı sil.
   - **(b) Bilinçli olarak değiştirilmiş** → Yerine daha iyisi geldi (ör. WebView → native sheet). Sil.
   - **(c) Kazara kopmuş** → Bu **GERÇEK BİR KAYIP ÖZELLİKTİR**. **SİLME** — arayüze geri bağla veya kullanıcıya sor.

> Silmenin doğru sırası her zaman: **Önce Bağla/Düzelt, Sonra Temizle.**

**Ölü kodu bulmanın DOĞRU yolu:**
```bash
npx tsc --noEmit --noUnusedLocals --noUnusedParameters -p .
```
Bu komut kesin sonuç verir. Metin tabanlı `grep` taramaları ile ölü kod aramak **GÜVENİLMEZDİR** — `t('common:someKey')` gibi namespace önekli veya `obj[dynamicKey]` gibi dinamik kullanımları kaçırır ve CANLI kodu "ölü" gösterip sildirir.

**Doğrulama:** Her silme turundan sonra `npx tsc --noEmit` çalıştır. Kullanılmayan *import* silmek davranışsal olarak risksizdir; kullanılmayan *state/fonksiyon* silmek değildir — ikincisinde yukarıdaki otopsi şarttır.

---

## 3. Belgeleme ve Takip (Documentation)

### 📝 DÖKÜMANTASYON GÜNCELLEME ZORUNLULUĞU
- **Altın Kural:** Projeye eklenen her yeni özellik, çözülen her majör hata (bug) veya yapılan her refactoring (kod temizliği) / mimari değişiklik sonrasında `docs/` altındaki `.md` dosyaları (özellikle `docs/HISTORY.md` ve gerekiyorsa `docs/ARCHITECTURE.md`) güncellenmelidir.
- AI asistanı, yaptığı değişikliklerin bir özetini ve nedenlerini tarih/madde sırasına göre `docs/HISTORY.md` dosyasına yeni bir madde olarak eklemek zorundadır. Bu, takım arkadaşlarının ve diğer AI asistanlarının projeyi anlayabilmesi için zorunludur.
