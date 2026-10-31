import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation, Trans } from 'react-i18next';
import Avatar from '../Avatar';
import type { BeklenenTraktHesabi, GelenTraktKimligi } from '../../services/auth/traktHesapKilidi';

interface Props {
  beklenen: BeklenenTraktHesabi;
  gelen: GelenTraktKimligi;
  onTekrarDene: () => void;
  onBaskaYol: () => void;
}

/**
 * GIRIS-KILIT-02 · Kartın hesabıyla Trakt'tan dönen hesap farklıysa çıkan ekran.
 *
 * Kullanıcı (2026-10-31): dizi izleyen kişi yorgun ve teknik değil; küçük bir uyarı «sistem çöktü»
 * sandırır, tekrar tekrar dener. Bu yüzden: ilk cümle «hiçbir şey bozulmadı»; iki hesap yan yana
 * (Google e-postası + profil · Trakt'tan gelen ad + resim); TEK büyük düğme — Trakt giriş ekranını
 * zorla açar, trakt.tv'de çıkış yapmayı bilmek gerekmez. İkinci uyuşmazlıkta adım adım rehber.
 * Danışman + kullanıcı kararı: «@X ile devam et» seçeneği YOK.
 */
export default function TraktHesapUyusmazligiEkrani({ beklenen, gelen, onTekrarDene, onBaskaYol }: Props) {
  const { t } = useTranslation(['settings']);
  const istenenTrakt = beklenen.traktSlug ?? `@${beklenen.username}`;
  const rehber = beklenen.deneme >= 1;
  const kalin = { 1: <Text style={styles.kalin} /> };

  return (
    <View style={styles.ekran}>
      <View style={styles.baslikAlani}>
        <Text style={styles.baslik}>{t('settings:uyusmazlikBaslik')}</Text>
        <Text style={styles.alt}>{t('settings:uyusmazlikAlt')}</Text>
      </View>

      <View style={styles.kutular}>
        <HesapKutusu
          etiket={t('settings:uyusmazlikIstenen')}
          ad={`@${beklenen.username}`}
          avatarAd={beklenen.username}
          satirlar={[
            beklenen.googleEmail ? t('settings:uyusmazlikGoogleSatiri', { email: beklenen.googleEmail }) : null,
            beklenen.traktSlug ? t('settings:kartTraktHesabi', { slug: beklenen.traktSlug }) : null,
          ]}
          vurgu
        />
        <HesapKutusu
          etiket={t('settings:uyusmazlikSecilen')}
          ad={gelen.ad ?? gelen.slug ?? '?'}
          avatarAd={gelen.ad ?? gelen.slug}
          avatarUrl={gelen.avatar}
          satirlar={[gelen.slug ? t('settings:kartTraktHesabi', { slug: gelen.slug }) : null]}
        />
      </View>

      {rehber && (
        <View style={styles.rehber}>
          <Text style={styles.rehberBaslik}>{t('settings:rehberBaslik')}</Text>
          <Adim no={1}>{t('settings:rehberAdim1')}</Adim>
          <Adim no={2}>
            <Trans i18nKey="settings:rehberAdim2" values={{ trakt: istenenTrakt }} components={kalin} />
          </Adim>
          <Adim no={3}>{t('settings:rehberAdim3')}</Adim>
        </View>
      )}

      <TouchableOpacity style={styles.birincil} onPress={onTekrarDene} activeOpacity={0.85} accessibilityRole="button">
        <Text style={styles.birincilMetin}>{t('settings:uyusmazlikTekrarDene')}</Text>
      </TouchableOpacity>
      {!rehber && (
        <Text style={styles.ipucu}>
          <Trans i18nKey="settings:uyusmazlikIpucu" values={{ trakt: istenenTrakt }} components={kalin} />
        </Text>
      )}
      <TouchableOpacity onPress={onBaskaYol} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
        <Text style={styles.ikincil}>{t('settings:uyusmazlikBaskaYol')}</Text>
      </TouchableOpacity>
      <SorunKutusu />
    </View>
  );
}

/**
 * Kullanıcı (2026-10-31): «Sorun mu yaşıyorsun?» — basınca hafif bir kutu açılır; ekran kalabalıklaşmaz,
 * ileride yeni sorun/çözüm buraya eklenir (yalnız `SORUNLAR`'a bir anahtar). Bugün tek madde: Trakt'taki
 * Google düğmesi tarayıcının Google oturumuyla yanlış hesabı KENDİLİĞİNDEN seçiyor (canlı tur M565) —
 * o çerez başka sitenin, uygulamadan silinemez; e-posta kutusuyla giriş onu tamamen atlar.
 */
const SORUNLAR = ['sorunGoogleKendiliginden'] as const;

function SorunKutusu() {
  const { t } = useTranslation(['settings']);
  const [acik, setAcik] = useState(false);
  return (
    <View style={styles.sorunAlani}>
      <TouchableOpacity
        onPress={() => setAcik(!acik)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityState={{ expanded: acik }}
      >
        <Text style={styles.sorunBaglanti}>{t('settings:sorunMuYasiyorsun')}</Text>
      </TouchableOpacity>
      {acik && (
        <View style={styles.sorunKutu}>
          {SORUNLAR.map((anahtar) => (
            <Text key={anahtar} style={styles.sorunMetin}>
              <Trans i18nKey={`settings:${anahtar}`} components={{ 1: <Text style={styles.kalin} /> }} />
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function HesapKutusu({ etiket, ad, avatarAd, avatarUrl, satirlar, vurgu }: {
  etiket: string;
  ad: string;
  avatarAd: string | null;
  avatarUrl?: string | null;
  satirlar: (string | null)[];
  vurgu?: boolean;
}) {
  return (
    <View style={[styles.kutu, vurgu && styles.kutuVurgu]}>
      <Text style={styles.etiket}>{etiket}</Text>
      <View style={styles.kutuSatir}>
        <Avatar url={avatarUrl} ad={avatarAd} size={40} />
        <View style={styles.kutuMetin}>
          <Text style={styles.ad} numberOfLines={1}>{ad}</Text>
          {satirlar.filter(Boolean).map((s) => (
            <Text key={s} style={styles.satir} numberOfLines={1}>{s}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function Adim({ no, children }: { no: number; children: React.ReactNode }) {
  return (
    <View style={styles.adim}>
      <View style={styles.adimNo}><Text style={styles.adimNoMetin}>{no}</Text></View>
      <Text style={styles.adimMetin}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { width: '100%', alignItems: 'center', gap: 16, paddingVertical: 8 },
  baslikAlani: { alignItems: 'center', gap: 8 },
  baslik: { color: '#f8fafc', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  alt: { color: '#cbd5e1', fontSize: 16, lineHeight: 23, textAlign: 'center' },
  kutular: { alignSelf: 'stretch', gap: 10 },
  kutu: { padding: 14, borderRadius: 12, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', gap: 10 },
  kutuVurgu: { borderColor: '#2563eb' },
  // Büyük harfe ÇEVRİLMEZ: CSS uppercase Türkçe «i»yi «I» yapıyor («GIRMEK»).
  etiket: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  kutuSatir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kutuMetin: { flex: 1, gap: 2 },
  ad: { color: '#f8fafc', fontSize: 17, fontWeight: '700' },
  satir: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  rehber: { alignSelf: 'stretch', padding: 14, borderRadius: 12, backgroundColor: '#1e293b', gap: 12 },
  rehberBaslik: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  adim: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  adimNo: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  adimNoMetin: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  adimMetin: { flex: 1, color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  kalin: { fontWeight: '800', color: '#ffffff' },
  birincil: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 10, backgroundColor: '#2563eb' },
  birincilMetin: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  ipucu: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  ikincil: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  sorunAlani: { alignSelf: 'stretch', alignItems: 'center', gap: 10, marginTop: 4 },
  sorunBaglanti: { color: '#64748b', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  sorunKutu: { alignSelf: 'stretch', padding: 12, borderRadius: 10, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', gap: 8 },
  sorunMetin: { color: '#cbd5e1', fontSize: 14, lineHeight: 21 },
});
