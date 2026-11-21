import { nativeColor } from '../../constants/mobilePalette';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions, ScrollView } from 'react-native';

import { useRouter } from 'expo-router';
import { useTranslation, Trans } from 'react-i18next';
import { Globe, CheckSquare, Square } from '../../components/icons';
import { useAuth } from '../../context/AuthContext';
import { beklenenTraktHesabiKaydet, beklenenTraktHesabiSil } from '../../services/auth/traktHesapKilidi';
import { logWarning } from '../../utils/errorLog';
import LegalTermsModal from '../../components/settings/LegalTermsModal';
import type { YasalBelge } from '../../utils/yasalBelge';
import { girisOnayiniIsaretle } from '../../services/kuralOnayiKapisi';
import LanguageMenuModal from '../../components/settings/LanguageMenuModal';
import GoogleGirisDugmesi from '../../components/auth/GoogleGirisDugmesi';
import TraktGirisDugmesi from '../../components/auth/TraktGirisDugmesi';
import TraktIleGirKutusu from '../../components/auth/TraktIleGirKutusu';
import TraktHesapUyusmazligiEkrani from '../../components/auth/TraktHesapUyusmazligiEkrani';
import { useGoogleHesapGiris } from '../../hooks/useGoogleHesapGiris';

// M502 Faz 0 + D10 — yalnız --google-test APK'sında açık (bkz. utils/googleGirisBayragi.ts).
import { GOOGLE_GIRIS_ACIK } from '../../utils/googleGirisBayragi';
import { useTraktGirisiniTamamla, type Uyusmazlik } from '../../hooks/useTraktGirisiniTamamla';
import { useTraktCihazGirisi } from '../../hooks/useTraktCihazGirisi';
import TraktCihazKodu from '../../components/auth/TraktCihazKodu';
import { useTraktWebGirisi } from '../../hooks/useTraktWebGirisi';
import { traktBaglamaNiyetiVarMi } from '../../services/auth/baglamaNiyeti';
import { styles } from '../../components/settings/settings.styles';

const OrDivider = ({ t }: { t: (key: string) => string }) => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
    <Text style={styles.dividerText}>{t('common:orDivider')}</Text>
    <View style={styles.dividerLine} />
  </View>
);

export default function Login() {
  const { loginAsGuest } = useAuth();
  const [isLangMenuVisible, setIsLangMenuVisible] = useState(false);
  const [acikBelge, setAcikBelge] = useState<YasalBelge | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  // Adım 4b (M609): kutu Topluluk Kuralları'nı da kapsar; işaretlenen sürüm cihaza not edilir ve
  // girişten sonraki ilk içerik yazımında sunucuya yazılır (services/kuralOnayiKapisi.ts).
  useEffect(() => { void girisOnayiniIsaretle(isChecked); }, [isChecked]);
  const router = useRouter();
  // GIRIS-TASARIM-01 (M536): Google giriş durumu BU EKRANDA tutulur — «Trakt ile devam et»
  // kutusu açılınca diğer bütün giriş seçenekleri gizlenir (kullanıcı: tek birincil düğme kalsın).
  const google = useGoogleHesapGiris();
  // GIRIS-KILIT-02: kartın hesabıyla Trakt'tan dönen farklıysa tam sayfa sakin ekran (diğer seçenekler gizli).
  const [uyusmazlik, setUyusmazlik] = useState<Uyusmazlik | null>(null);
  // Hesap kilidi → bağlama → Google bağlama → oturum: web yönlendirmesi ve cihaz kodu AYNI yoldan.
  const traktGirisiniTamamla = useTraktGirisiniTamamla(setUyusmazlik);
  // M620 · native Trakt girişi cihaz koduyla (docs/design/TRAKT_CIHAZ_KODU_PLANI.md): kişi kodu tarayıcıda
  // onaylar; uygulamadan çıkıp dönmek (simgeden bile) akışı bozmaz, süreç ölümünde diskten sürer.
  const cihaz = useTraktCihazGirisi({
    onGiris: (giris, mod) => traktGirisiniTamamla(giris, mod === 'baglama'),
    onHata: (kod) => logWarning('traktCihaz.hata', new Error(kod)),
  });
  const webGirisi = useTraktWebGirisi(traktGirisiniTamamla);
  const { isGenerating } = webGirisi;
  const nativeGiris = Platform.OS !== 'web';
  const cihazAcik = cihaz.durum.tur !== 'bos';
  // M622: bekleme (ve kod alınırken / giriş yapılırken) başlık alanı «Trakt onayı bekleniyor» + tek cümle; hata
  // ekranlarında olağan karşılama başlığı (mesajı kutu kendisi yazar).
  const cihazBekliyor = ['kod_aliniyor', 'bekliyor', 'tamamlaniyor'].includes(cihaz.durum.tur);
  const uyariAcik = uyusmazlik !== null;
  const kutuAcik = (GOOGLE_GIRIS_ACIK && google.durum === 'trakt_ile_gir') || uyariAcik || cihazAcik;
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const { t, i18n } = useTranslation(['settings', 'common', 'legal']);

  // 🚫 Google girişi bu ekrandan 2026-08-23'te kaldırıldı (Google = Trakt'lı hesaba BAĞLAMA seçeneği). Gerekçe ve
  // korunan kod (`completeIfPending` → hooks/useTraktGirisiniTamamla.ts): docs/design/GOOGLE_AUTH_MIGRATION.md
  const [baglamaModu, setBaglamaModu] = useState(false);
  useEffect(() => { traktBaglamaNiyetiVarMi().then(setBaglamaModu).catch(() => {}); }, []);

  // Kartla giriş ve yeniden deneme, web'de Trakt'ın hesap seçimini açar.
  const handleTraktLogin = async () => {
    await beklenenTraktHesabiSil();
    await traktGirisiniBaslat(false);
  };
  const handleKartlaTraktGiris = async () => {
    if (google.bagliHesap) await beklenenTraktHesabiKaydet({ ...google.bagliHesap, deneme: 0 });
    else await beklenenTraktHesabiSil();
    await traktGirisiniBaslat(true);
  };
  const handleTekrarDene = async () => {
    if (!uyusmazlik) return;
    await beklenenTraktHesabiKaydet({ ...uyusmazlik.beklenen, deneme: uyusmazlik.beklenen.deneme + 1 });
    setUyusmazlik(null);
    await traktGirisiniBaslat(true);
  };
  const handleBaskaYol = () => {
    setUyusmazlik(null);
    google.sifirla();
  };

  const traktGirisiniBaslat = async (zorunluGiris: boolean) => {
    if (nativeGiris) {
      await cihaz.baslat(zorunluGiris ? 'kart' : 'giris');
      return;
    }
    await webGirisi.baslat(zorunluGiris);
  };

  return (
    <View style={styles.container}>
      {/* Top Right Language Button */}
      <TouchableOpacity 
        style={styles.topRightLangButton}
        onPress={() => setIsLangMenuVisible(true)}
      >
        <Globe size={18} color={nativeColor('muted', "#94a3b8")} />
        <Text style={styles.topRightLangText}>{i18n.language.toUpperCase()}</Text>
      </TouchableOpacity>

      <LanguageMenuModal
        visible={isLangMenuVisible}
        onClose={() => setIsLangMenuVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.contentWrapper, isDesktop && styles.desktopCard]}>
        {/* M536: başlık her genişlikte ORTALI — eskiden yalnız masaüstünde ortalanıyordu, dar ekranda başlık sola,
            gövde ortaya yaslı kalıyordu (kullanıcı: «dar ekranda da başlık ve alt başlık ortalansın»). */}
        {!uyariAcik && <View style={[styles.headerContainer, isDesktop && { marginBottom: 40 }]}>
          <Text style={[styles.title, isDesktop && { fontSize: 36 }]}>{t(cihazBekliyor ? 'cihazBaslik' : kutuAcik && !cihazAcik ? 'traktIleDevamBaslik' : 'girisBaslik')}</Text>
          <Text style={[styles.subtitle, isDesktop && { fontSize: 18 }]}>{t(cihazBekliyor ? 'cihazAltBaslik' : kutuAcik && !cihazAcik ? 'traktIleDevamAltBaslik' : 'girisAltBaslik')}</Text>
        </View>}

      <View style={styles.formContainer}>
          <>
            {uyusmazlik && (
              <TraktHesapUyusmazligiEkrani
                beklenen={uyusmazlik.beklenen}
                gelen={uyusmazlik.gelen}
                onTekrarDene={handleTekrarDene}
                onBaskaYol={handleBaskaYol}
                cihazKodu={nativeGiris}
              />
            )}
            {cihazAcik && !uyariAcik && (
              <TraktCihazKodu durum={cihaz.durum} kopyalandi={cihaz.kopyalandi} onTekrarAc={cihaz.trakttaOnayla} onYeniKod={cihaz.yeniKod} onVazgec={cihaz.vazgec} />
            )}
            {kutuAcik && !uyariAcik && !cihazAcik && (
              <TraktIleGirKutusu hesap={google.bagliHesap} onTraktIleDevam={handleKartlaTraktGiris} onBaskaHesap={google.sifirla} />
            )}
            {!kutuAcik && <>
              <>
                <Text style={styles.description}>
                  {t('girisAciklama')}
                </Text>

                {/* 2026-08-21 — kullanım koşulları onayı artık İKİ girişin de
                    (Trakt + Google) ÜSTÜNDE, tek bir kapı olarak duruyor —
                    eskiden Trakt butonuyla Google seçeneği arasına sıkışmış
                    olması, Google'ın ikincil/gizli bir seçenekmiş gibi
                    algılanmasının bir parçasıydı. */}
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  activeOpacity={0.7}
                  onPress={() => setIsChecked(!isChecked)}
                >
                  {isChecked ? (
                    <CheckSquare size={20} color={nativeColor('steel', "#3b82f6")} />
                  ) : (
                    <Square size={20} color={nativeColor('mutedDeep', "#64748b")} />
                  )}
                  <Text style={styles.checkboxText}>
                    <Trans
                      i18nKey="settings:termsAcceptance"
                      components={{
                        1: <Text onPress={() => setAcikBelge('terms')} style={styles.linkText} />,
                        2: <Text onPress={() => setAcikBelge('rules')} style={styles.linkText} />,
                      }}
                    />
                  </Text>
                </TouchableOpacity>
                {/* M611 · KVKK: Gizlilik Politikası aydınlatmadır, kutuyla ONAYLATILMAZ; yalnız bilgi bağlantısı. */}
                <Text style={styles.privacyNoticeText}>
                  <Trans
                    i18nKey="settings:privacyNotice"
                    components={{ 1: <Text onPress={() => setAcikBelge('privacy')} style={styles.linkText} /> }}
                  />
                </Text>
              </>
            </>}

            {/* 🔴 Buradaki `!awaitingTraktLink` KAPISI KALDIRILDI (2026-08-23).
                Google köprü kartı bu ekrandan gidince, AsyncStorage'ında eski
                bir bekleyen kayıt taşıyan kullanıcıda o bayrak `true` kalıyor
                ve Trakt butonunu GİZLİYORDU — yani giriş ekranı HİÇBİR giriş
                seçeneği göstermeyen bir çıkmaza dönüşürdü. Trakt butonu artık
                KOŞULSUZ çiziliyor. */}
            {/* M536: Google + Trakt AYNI ölçüde, alt alta (`TraktGirisDugmesi.tsx`). Kutu açıkken gizli —
                Google konteyneri ise ASLA unmount edilmez (Madde 231), kendisi gizlenir. */}
            {!kutuAcik && (
              <TraktGirisDugmesi etkin={(nativeGiris || webGirisi.etkin) && isChecked} yukleniyor={isGenerating} onPress={handleTraktLogin} />
            )}

            {isGenerating && <Text style={styles.pollingText}>{t('pollingAuth')}</Text>}
            {baglamaModu && !cihazAcik && <Text style={styles.pollingText}>{t('settings:baglamaModuNotu')}</Text>}

            {/* M501 · Google girişi. 🔴 M502 FAZ 0 (kullanıcı, 2026-10-12): KAPALI —
                düğme `create_new`'i doğrudan çağırıyor → Trakt'lı kullanıcı Google'a
                basınca İKİNCİ, boş hesap açılıyordu (veri bölünmesi). Kimlik planı
                Faz 3 (docs/design/KIMLIK_BIRLIGI_PLANI.md) bitince açılır.
                D10 (2026-10-13): Faz 4–5 testleri için yalnız test APK'sında açık. */}
            {GOOGLE_GIRIS_ACIK && <GoogleGirisDugmesi etkin={isChecked && !isGenerating} giris={google} gizli={uyariAcik || cihazAcik} />}

            {/* Misafir/Vitrin de aynı gerekçeyle koşulsuz görünür (kutu açıkken değil — tek seçenek kalsın). */}
            {!kutuAcik && <>
              <>
                <OrDivider t={t} />

                <View style={styles.tertiaryRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={async () => {
                      await loginAsGuest();
                      router.replace('/(protected)/(tabs)/explore');
                    }}
                  >
                    <Text style={styles.tertiaryLinkText}>{t('common:landingGuest')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.tertiarySeparator}>·</Text>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => router.replace('/')}>
                    <Text style={styles.tertiaryLinkText}>{t('common:viewShowcase')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            </>}
          </>
        </View>
      </View>
      </ScrollView>
      <LegalTermsModal
        visible={acikBelge !== null}
        belgeler={acikBelge ? [acikBelge] : undefined}
        onClose={() => setAcikBelge(null)}
      />

    </View>
  );
}

