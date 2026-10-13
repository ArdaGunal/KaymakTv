// Kimlik planı D10 (kullanıcı, 2026-10-13): Google giriş düğmesi Faz 4–5 testleri için
// YALNIZ `EXPO_PUBLIC_GOOGLE_GIRIS_TEST=1` ile derlenen test APK'sında açılır
// (`bash scripts/apk-derle.sh --google-test`). Yayın APK'sı ve web'de KAPALI kalır —
// M502 Faz 0: düğme açıkken Trakt'lı kullanıcı Google'a basınca ikinci hesap açılabiliyordu.
// Herkese açılması EN SON (GIRIS-G-02, kullanıcı: «en son koyalım ya bu butonu»).
//
// ⚠️ EXPO_PUBLIC_* derleme anında pakete GÖMÜLÜR; `.env`'e YAZILMAZ (test bunu denetler).
export const GOOGLE_GIRIS_ACIK = process.env.EXPO_PUBLIC_GOOGLE_GIRIS_TEST === '1';
