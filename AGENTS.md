# KaymakTV Geliştirici Ajan Kuralları

Hoş geldin! Bu proje **KaymakTV** — Trakt.tv veritabanıyla senkronize çalışan, TV Time esintili bir dizi/film takip uygulaması (Expo SDK 54 + React Native + Expo Router). Bu projede çalışırken uyman gereken zorunlu standartlar bulunmaktadır. İşe başlamadan önce aşağıdaki kılavuzları dikkatle oku:

1. **Çalışma Kuralları:** [AI Çalışma Kuralları](docs/AI_RULES.md)
2. **Proje Mimarisi:** [Uygulama Mimarisi (Architecture)](docs/ARCHITECTURE.md)
3. **Geçmiş Kayıtlar:** [Proje Geliştirme Geçmişi (History)](docs/HISTORY.md)

## Temel Kurallar Özeti
- **Spagetti kod yazmak kesinlikle yasaktır.** Kodlar her zaman modüler, UI ve Logic ayrılmış şekilde yazılmalıdır. Bir dosya 400 satırı geçmeye başladığında mutlaka mantıklı parçalara bölünmelidir.
- Veri çekme/senkronizasyon mantığı `hooks/` içindeki custom hook'lara, API çağrıları `services/` katmanına taşınmalıdır. UI bileşenleri sadece veriyi gösterir.
- Güvenlik açıklarına sebep olabilecek try-catch eksikliği, guest (misafir) kontrollerinin atlanması ve API sırlarının (secrets) istemci koduna gömülmesi gibi hatalardan kaçınılmalıdır.
- Tamamlanan her görev/özellik sonrası yukarıda belirtilen `.md` dökümanları (özellikle `docs/HISTORY.md`) mutlaka güncellenmelidir.

Bu proje birden fazla geliştirici (ve onların AI asistanlarının) ortak çalışmasıyla ilerlemektedir — yukarıdaki kurallar herkes için bağlayıcıdır ve pull request'lerde bu döküman referans alınmalıdır.

> Not: Bağımlılık sürümleri hızlı değişebilir. Expo/React Native API'leri hakkında emin olmadığın noktalarda `package.json`'daki gerçek sürümü kontrol et (şu an Expo SDK 54) ve o sürüme ait resmi dokümantasyona bak; sabit bir sürüm numarasını buraya yazmıyoruz çünkü güncelliğini kaybediyor.
