-- KaymakTV Feed — Silinen Aktivite Kayıtları (Tombstone)
--
-- Bu dosyayı Supabase Dashboard → SQL Editor'e yapıştırıp çalıştır.
--
-- AMAÇ: Profil › Aktiviteler'de bir kullanıcı bir aktiviteyi kalıcı olarak
-- sildiğinde (bkz. kaymaktv-feedback-worker /feed/delete), o satır
-- `feed_activities`'ten TAMAMEN kaldırılır (hard delete — kullanıcı özellikle
-- bunu istedi, soft-delete/gizleme DEĞİL). SORUN: `/feed/sync`, Trakt'taki
-- izleme geçmişi/puanları periyodik olarak `feed_activities`'teki MEVCUT
-- satırlarla KARŞILAŞTIRIP farkı (yeni olanları) ekliyor. Silinen bir satık
-- artık "mevcut" değildir — ama Trakt'ta o izleme/puanlama hâlâ duruyorsa
-- (silme yalnızca KaymakTV'nin kendi kopyasını siler, Trakt'a dokunmaz), bir
-- sonraki sync bunu "yeni" sanıp SESSİZCE GERİ EKLER. Kullanıcı: "sildiğimde
-- her yerden silinmeli, bize güveniyor" dedi — bu tablo, "bu (kullanıcı, olay)
-- kombinasyonu BİLİNÇLİ OLARAK silindi, bir daha geri ekleme" bilgisini
-- `feed_activities`'in KENDİSİNDEN AYRI tutarak hem kalıcı silmeyi hem de
-- "geri gelmesin" garantisini aynı anda sağlar.
--
-- GÜVENLİK NOTU: Diğer tablolar gibi (bkz. 001_feed_schema.sql) bu proje
-- Supabase Auth kullanmıyor. Bu tabloyu client HİÇBİR ZAMAN doğrudan okumaz/
-- yazmaz — yalnızca Worker (service_role, RLS'i bypass eder) kullanır. Bu
-- yüzden BİLİNÇLİ OLARAK hiçbir RLS politikası eklenmedi: RLS açık + politika
-- yok = anon key için varsayılan "reddet", yani client'tan hiçbir erişim
-- mümkün değil (diğer tablolardaki gibi SELECT'i bile açmaya gerek yok).

CREATE TABLE deleted_feed_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('watched_episode', 'started_show', 'completed_show', 'rated')
  ),
  show_id BIGINT NOT NULL,
  -- watched_episode için dolu, diğer tipler için NULL (feed_activities ile aynı sözleşme).
  episode_number TEXT,
  -- watched_episode dedup anahtarının parçası (show_id|episode_number|activity_at).
  -- rated için sync yalnızca show_id'ye göre karşılaştırdığından burada saklanması
  -- zorunlu değil ama kayıt bütünlüğü için yine de tutulur.
  activity_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- handleFeedSync'in her senkronda attığı sorgu deseniyle birebir eşleşir:
-- `user_id=eq.{userId}` (her zaman) + activity_type/show_id/episode_number
-- karşılaştırması bellek içinde (Set) yapılır, bu yüzden tek index yeterli.
CREATE INDEX idx_deleted_feed_activities_user ON deleted_feed_activities(user_id);

ALTER TABLE deleted_feed_activities ENABLE ROW LEVEL SECURITY;
-- Bilinçli olarak SIFIR politika — bkz. yukarıdaki güvenlik notu.
