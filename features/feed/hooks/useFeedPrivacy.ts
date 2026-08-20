import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getMyTraktSlug } from '../../../services/api/myIdentity';
import { invalidateFeedCache, invalidateUserFeedActivitiesCache } from '../services/feedApi';
import { useFeedStore } from '../store/feedStore';
import { getFeedPrivacySettings, updateFeedPrivacy, FeedPrivacySettings } from '../services/feedPrivacy';

const DEFAULT_SETTINGS: FeedPrivacySettings = {
  publishWatches: true,
  publishRatings: true,
  publishManual: true,
};

/**
 * Ayar kaydedildikten SONRA istemci tarafını sunucuyla hizalar.
 *
 * NEDEN VAR (F4-T12'de bulundu): kullanıcı "aktivitelerimi gizle"yi açtığında
 * Worker satırları DB'den gerçekten siliyordu (canlıda doğrulandı: 43 bölüm +
 * 50 film + puanlar → 0), ama istemcide hiçbir önbellek geçersiz kılınmıyor ve
 * ekrandaki listeye dokunulmuyordu. Sonuç: kullanıcı gizlemek istediği kartları
 * görmeye devam ediyor, ayarın çalışmadığını sanıyordu. Eylem başarılı ama
 * kullanıcıya sonucu YANSIMIYOR — `AI_RULES` §2'nin ters yönü.
 *
 * ⚠️ `feedStore.reset()` bilinçli olarak KULLANILMADI: `useFeed`'in yükleme
 * efekti yalnızca mount'ta çalışıyor ve sekmeler bellekte kaldığı için
 * store'u boşaltmak akışı BOŞ bırakırdı.
 *
 * KAPSAM SINIRI (dürüstçe): bu yalnızca GİZLEME yönünde anında etki eder.
 * Ayar tekrar AÇILDIĞINDA satırlar sunucuda da hemen geri gelmiyor (bir
 * sonraki `/feed/sync` gerekiyor), bu yüzden burada yalnızca önbellek
 * geçersiz kılınıyor; kartlar sonraki yüklemede döner.
 */
async function applyPrivacyToFeed(next: FeedPrivacySettings): Promise<void> {
  invalidateFeedCache();

  const mySlug = await getMyTraktSlug().catch(() => null);
  if (!mySlug) return;
  invalidateUserFeedActivitiesCache(mySlug);

  // Worker/DB'deki karşılığı: publishWatches → watched_episode + watched_movie
  // (İKİSİ BİRDEN — bkz. handleFeedSync'teki S5 düzeltmesi),
  // publishRatings → rated, publishManual → reviewed + posted (021).
  //
  // ⚠️ İlk ikisi sunucuda SİLİNİYOR, üçüncüsü yalnızca GİZLENİYOR — ama
  // ekrandaki kartın kalkması açısından fark etmez, ikisinde de listeden
  // düşmesi gerekir. (Realtime tarafı ayrıca `useFeedRealtime`'ın UPDATE
  // işleyicisinde ele alınıyor; bu blok ayarı DEĞİŞTİREN cihaz için.)
  const hiddenTypes: string[] = [];
  if (!next.publishWatches) hiddenTypes.push('watched_episode', 'watched_movie');
  if (!next.publishRatings) hiddenTypes.push('rated');
  if (!next.publishManual) hiddenTypes.push('reviewed', 'posted');
  if (hiddenTypes.length === 0) return;

  // Yalnızca KENDİ kartlarım — gizlilik ayarı başkasının aktivitesini etkilemez.
  useFeedStore
    .getState()
    .removeActivitiesWhere(
      (a) => a.user.traktSlug === mySlug && hiddenTypes.includes(a.activityType)
    );
}

type SavingKey = keyof FeedPrivacySettings | 'hideAll' | null;

export function useFeedPrivacy() {
  const { accessToken, isGuest } = useAuth();
  const [settings, setSettings] = useState<FeedPrivacySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SavingKey>(null);
  /**
   * Y18: kaydetme başarısız olduğunda kullanıcıya GÖSTERİLECEK mesaj.
   *
   * Eskiden catch yalnızca console.warn atıp anahtarı eski hâline döndürüyordu.
   * Kullanıcı gizle der, Worker 401/429 döner, anahtar SESSİZCE geri açılır —
   * fark etmezse aktiviteleri paylaşılmaya devam eder ve GİZLEDİĞİNİ SANIR.
   * Bir beğeni değil, bir GİZLİLİK kontrolü; burada sessizlik kabul edilemez
   * (AI_RULES §2). Optimistic UI geri alınması geri bildirim değildir.
   */
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || isGuest) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // F11/Y15: artık `accessToken`'ın kendisiyle Worker'dan okunuyor —
        // kimlik `resolveCaller` tarafında doğrulanıyor, ayrıca slug çözmeye
        // gerek yok (bkz. features/feed/services/feedPrivacy.ts).
        const current = await getFeedPrivacySettings(accessToken);
        if (!cancelled) setSettings(current);
      } catch (error) {
        console.warn('[Feed] Gizlilik ayarları okunamadı:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest]);

  // Tek bir alanı (İzlediklerimi Paylaş / Puanlarımı Paylaş) günceller.
  const update = useCallback(
    async (key: keyof FeedPrivacySettings, value: boolean) => {
      if (!accessToken) return;
      const previous = settings;
      setSettings((s) => ({ ...s, [key]: value })); // iyimser (optimistic) güncelleme
      setSaveError(null);
      setSavingKey(key);
      try {
        await updateFeedPrivacy(accessToken, { [key]: value });
        await applyPrivacyToFeed({ ...previous, [key]: value });
      } catch (error) {
        setSettings(previous); // başarısızsa geri al
        console.warn('[Feed] Gizlilik ayarı kaydedilemedi:', error);
        // Sessiz geri alma GERİ BİLDİRİM DEĞİLDİR (AI_RULES §2) — kullanıcı
        // anahtarın kendi kendine geri açıldığını fark etmezse gizlediğini sanır.
        setSaveError(
          (error as any)?.response?.data?.message ||
            'Ayar kaydedilemedi — aktiviteler hâlâ ESKİ ayarla paylaşılıyor.'
        );
      } finally {
        setSavingKey(null);
      }
    },
    [accessToken, settings]
  );

  // "Her Şeyi Gizle" — DB'de ayrı bir alan DEĞİL, ikisini birden tek istekte
  // değiştiren bir kısayol. Açılınca ikisini de false yapar; kapanınca
  // ikisini de true'ya döndürür (bkz. kullanıcının istediği simetrik davranış).
  const setHideAll = useCallback(
    async (hide: boolean) => {
      if (!accessToken) return;
      const previous = settings;
      const next: FeedPrivacySettings = {
        publishWatches: !hide,
        publishRatings: !hide,
        // 021: artık ÜÇÜ birden. Bu alan eklenmeden "Her Şeyi Gizle" adını
        // taşıyan anahtar incelemeleri ve gönderileri kapsamıyordu — F4'te
        // kullanıcının bulduğu kusur tam olarak buydu.
        publishManual: !hide,
      };
      setSettings(next);
      setSaveError(null);
      setSavingKey('hideAll');
      try {
        await updateFeedPrivacy(accessToken, next);
        await applyPrivacyToFeed(next);
      } catch (error) {
        setSettings(previous);
        console.warn('[Feed] Gizlilik ayarı kaydedilemedi:', error);
        // Sessiz geri alma GERİ BİLDİRİM DEĞİLDİR (AI_RULES §2) — kullanıcı
        // anahtarın kendi kendine geri açıldığını fark etmezse gizlediğini sanır.
        setSaveError(
          (error as any)?.response?.data?.message ||
            'Ayar kaydedilemedi — aktiviteler hâlâ ESKİ ayarla paylaşılıyor.'
        );
      } finally {
        setSavingKey(null);
      }
    },
    [accessToken, settings]
  );

  // Türetilmiş (derived) durum — ÜÇÜ de kapalıysa "Her Şeyi Gizle" açık
  // görünür. Ayrı bir DB bayrağı yok, tek gerçek kaynak bu üç alan; biri
  // dışarıdan (ör. başka bir cihazdan) tekrar açılırsa bu değer otomatik
  // güncellenir, senkron dışı kalma riski yok (008'in modeli — genişledi ama
  // ilkesi değişmedi).
  const hideAll =
    !settings.publishWatches && !settings.publishRatings && !settings.publishManual;

  return { settings, hideAll, isLoading, savingKey, saveError, update, setHideAll };
}
