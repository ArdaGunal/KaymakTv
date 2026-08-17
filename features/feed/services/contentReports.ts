import axios from 'axios';
import * as SecureStore from '../../../utils/secureStorage';
import { logError } from '../../../utils/errorLog';

/**
 * İçerik bildirme — **Worker üzerinden** (F9).
 *
 * ⚠️ MİMARİ SAPMA KAPANDI: `018_content_reports.sql` bu tabloyu bilinçli bir
 * istisnayla anon key + doğrudan INSERT ile yazıyordu; o gün Worker'ın kaynağı
 * erişilebilir değildi ve migration'ın notu "ileride bir Worker ucu eklenirse
 * yazma da oraya taşınabilir" diyordu. `023` ile o gün geldi.
 *
 * 🔴 NEDEN TAŞINDI: F10 (N rapor alan içerik akıştan düşer) açıldığında rapor
 * sayısı bir moderasyon kaldıracına dönüşüyor. Anon yazmada kimlik
 * doğrulanamadığı için `reporter_user_id` NULL kalabiliyordu ve NULL'lar
 * `UNIQUE` kısıtını atlatıyordu (Postgres'te `NULL != NULL`) — yani tek kişi
 * aynı içeriği sınırsız kez bildirip istediği yorumu sansürletebilirdi.
 * Kimlik ancak sunucuda doğrulanabilir.
 *
 * ⚠️ DAVRANIŞ DEĞİŞİKLİĞİ: misafir artık bildirim gönderemez. Bilinçli —
 * beğeni, yorum ve engelleme de giriş gerektiriyor; bildirme tek istisnaydı.
 * Kimliksiz bildirim kabul etmek, kısıtın tamamını işlevsiz bırakıyordu.
 */
export type ReportTargetType = 'activity' | 'comment' | 'trakt_comment';
export type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'spoiler' | 'illegal' | 'other';

const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export interface ReportResult {
  /** Kullanıcı bu içeriği DAHA ÖNCE bildirmiş — yeni satır eklenmedi. */
  duplicate: boolean;
}

export async function reportContent(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  detail?: string
): Promise<ReportResult> {
  if (!KAYMAK_WORKER_URL) throw new Error('Sunucu adresi tanımlı değil.');

  const token = await SecureStore.getItemAsync('traktAccessToken');
  if (!token) throw new Error('Bildirim göndermek için giriş yapmalısın.');

  const trimmedDetail = detail?.trim();

  try {
    const response = await axios.post(
      `${KAYMAK_WORKER_URL}/feed/report`,
      {
        traktAccessToken: token,
        targetType,
        targetId,
        reason,
        detail: trimmedDetail ? trimmedDetail.slice(0, 500) : undefined,
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 12000 }
    );

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Bildirim gönderilemedi.');
    }
    return { duplicate: response.data?.duplicate === true };
  } catch (error: any) {
    logError('contentReports.reportContent', error);
    // Sessizce yutulmaz — çağıran (ReportContentModal) kullanıcıya görünür bir
    // toast gösteriyor (AI_RULES §2).
    throw new Error(
      error?.response?.data?.message || error?.message || 'Bildirim gönderilemedi.'
    );
  }
}
