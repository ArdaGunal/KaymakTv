import { supabase } from './supabaseClient';
import { getMySupabaseUserId } from './userBlocks';

// İçerik bildirme — bkz. supabase/schema/018_content_reports.sql başındaki
// "MİMARİ SAPMA" notu: diğer tüm yazmalardan farklı olarak Worker'ı YOK,
// doğrudan anon key ile INSERT edilir (RLS: yalnızca INSERT, hiç SELECT yok
// — istemci kendi gönderdiği dahil hiçbir raporu okuyamaz).
export type ReportTargetType = 'activity' | 'comment' | 'trakt_comment';
export type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'spoiler' | 'illegal' | 'other';

export async function reportContent(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  detail?: string
): Promise<void> {
  // Misafir veya henüz KaymakTV'de hiç senkron tetiklememiş biri için `null`
  // döner (bkz. getMySupabaseUserId) — bildirim yine de gönderilir, kimin
  // gönderdiği bilinmemesi bildirimi geçersiz kılmaz.
  const reporterUserId = await getMySupabaseUserId().catch(() => null);

  const trimmedDetail = detail?.trim();
  const { error } = await supabase.from('content_reports').insert({
    reporter_user_id: reporterUserId,
    target_type: targetType,
    target_id: targetId,
    reason,
    detail: trimmedDetail ? trimmedDetail.slice(0, 500) : null,
  });
  if (error) throw error;
}
