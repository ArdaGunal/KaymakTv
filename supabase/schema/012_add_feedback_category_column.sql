-- Migration: 012_add_feedback_category_column.sql
-- Açıklama: error_logs tablosuna `category` sütunu ekleniyor.
-- Bu sütun, gelen geri bildirimin "hata/problem" mi yoksa "istek/öneri" mi
-- olduğunu ayırt etmek için kullanılır. Mevcut kayıtlar etkilenmemesi için
-- varsayılan değer olarak 'bug' atanmaktadır.
-- Supabase Dashboard > SQL Editor'den çalıştırın.

ALTER TABLE error_logs
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'bug';

-- İleride kategori bazlı sorgu yapabilmek için index (isteğe bağlı ama önerilir)
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs (category);

-- Sadece geçerli kategorilerin girilmesini zorla
ALTER TABLE error_logs
  ADD CONSTRAINT chk_error_logs_category
  CHECK (category IN ('bug', 'feature'));
