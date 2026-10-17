// GIRIS-G-02 (kullanıcı, 2026-10-17): Google giriş düğmesi HERKESE AÇIK.
// *«hayır gerek yok, butonu aç ve şu an kalsın, sorun yok zaten bolca test ettik.»*
//
// Geçmiş: M502 Faz 0'da kapatıldı (düğme açıkken Trakt'lı kullanıcı Google'a basınca ikinci hesap
// açılıyordu). Kimlik Faz 3 (önce `check`, Trakt'lı → «Trakt ile Gir»), Faz 4 (yeni hesabı bırak,
// çıkış denetimi), Faz 5 (Giriş yöntemleri + Hesap Seç), Faz 6 (/u/<KaymakNo>) ve M525 (oturum
// bütünlüğü) bittikten sonra açıldı. D10 döneminde yalnız `EXPO_PUBLIC_GOOGLE_GIRIS_TEST=1` test
// APK'sında açıktı; o bayrak artık etkisiz (`apk-derle.sh --google-test` zararsız kaldı).
// Kapatmak gerekirse: tek satır `false` → web + APK yeniden derlenir.
export const GOOGLE_GIRIS_ACIK = true;
