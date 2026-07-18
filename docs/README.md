# KaymakTV

## Projenin Amacı
KaymakTV, kullanıcıların favori dizilerini takip edebileceği, son izledikleri bölümleri görebileceği ve Trakt.tv veritabanıyla tam senkronize çalışan modern, koyu temalı bir dizi takip uygulamasıdır. Kullanıcı dostu arayüzü ve sade tasarımı ile "İzleme Listesi" (Watchlist) deneyimini pürüzsüz hale getirmeyi hedefler.

## Genel Bakış
Uygulama, Expo ve React Native üzerine kurulmuş olup "Expo Router" yapısı sayesinde modüler bir sayfa geçiş sistemine sahiptir. Trakt API entegrasyonu OAuth 2.0 Authorization Code Flow (`expo-auth-session`) kullanılarak sağlanır — bkz. `docs/ARCHITECTURE.md` Bölüm 4 (eski "Device Code" yöntemi kaldırılmıştır, bkz. `docs/HISTORY.md` Madde 2 ve 14).
