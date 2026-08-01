-- KaymakTV "Bize Ulaşın" Geri Bildirimine Performans Raporu Eklendi
--
-- Bu dosyayı Supabase Dashboard → SQL Editor'e yapıştırıp çalıştır.
--
-- BAĞLAM: `error_logs` tablosu Madde 78'de (kaymaktv-feedback-worker,
-- handleFeedback) oluşturuldu ama o zaman bir migration dosyası olarak
-- İZLENMEDİ — Dashboard'dan elle kuruldu. Bu yüzden bu dosya bir CREATE TABLE
-- DEĞİL, yalnızca eklemeli (additive) bir ALTER TABLE'dır; tablonun geri
-- kalan sütunlarına (user_id, user_message, error_data, device_info)
-- dokunulmuyor.
--
-- AMAÇ: Kullanıcı bir hata bildirdiğinde ve "Hata loglarımı da gönder"
-- anahtarını AÇIK bıraktığında (bkz. hooks/useReportIssue.ts, components/
-- settings/ReportIssueModal.tsx), artık yalnızca hata günlüğü değil, son
-- 24 saatlik performans/telemetri özeti (utils/metrics.ts → exportMetricsReport)
-- de aynı satıra kaydediliyor — geliştirici bir sorunu incelerken ikisini
-- BİRLİKTE, Supabase'den görebilsin diye (Discord bildirimi zaten embed alan
-- sınırı — 1024 karakter — yüzünden yalnızca "kaydedildi" durumunu gösteriyor,
-- ham veri kasıtlı olarak Supabase'de tutuluyor).
--
-- GÜVENLİK NOTU (001_feed_schema.sql'deki notla AYNI): Bu proje Supabase Auth
-- KULLANMIYOR — RLS yalnızca OKUMA (SELECT) izni verir, bu tabloya YAZMA
-- yalnızca Worker'ın service_role anahtarıyla (istemciden değil) yapılır.

ALTER TABLE error_logs
  ADD COLUMN IF NOT EXISTS performance_report JSONB;

COMMENT ON COLUMN error_logs.performance_report IS
  'Bildirim anındaki son 24 saatlik telemetri özeti (utils/metrics.ts → exportMetricsReport). Kullanıcı "Hata loglarımı da gönder" anahtarını kapattıysa NULL/boş kalır.';
