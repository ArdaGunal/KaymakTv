import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Supabase Auth KULLANILMIYOR (kimlik doğrulama Trakt OAuth üzerinden) —
// bu yüzden oturum kalıcılığı/otomatik token yenileme kapatıldı. Bu client
// yalnızca anon key + RLS (SELECT-only, bkz. supabase/schema/001_feed_schema.sql)
// ile veri okumak için kullanılır.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * 🔴 UYGULAMAYI AÇILIŞTA ÖLDÜREN HATA — 2026-08-30'da yaşandı, bir daha olmasın.
 *
 * `createClient('', '')` **fırlatır** (`supabaseUrl is required.` — ölçüldü).
 * Bu dosya modül seviyesinde çağırdığı ve akış servisleri üzerinden
 * `app/(protected)/_layout.tsx`'in yükleme yolunda olduğu için, o fırlatma
 * TÜM UYGULAMAYI açılış anında çökertiyordu: kurulum başarılı, ikona
 * dokunuluyor, uygulama anında kapanıyor. Hiçbir ekran, hiçbir hata mesajı.
 *
 * NASIL OLDU: `.easignore` `.env`'i dışlıyor ve EAS'ta tanımlı değişken yoktu.
 * Yerelde (`localapk.bat`) `.env` hep mevcut olduğu için yıllarca görünmedi;
 * ilk bulut build'inde ortaya çıktı.
 *
 * KURAL: eksik bir ortam değişkeni bir özelliği devre dışı bırakabilir, ama
 * uygulamanın AÇILMASINI engellememelidir. Yapılandırma yoksa artık geçersiz
 * ama zararsız bir yer tutucuyla client kuruluyor; akış istekleri ağ hatası
 * verip mevcut `catch` bloklarına düşüyor.
 */
const isConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

if (!isConfigured) {
  // Sessiz başarısızlık YASAK (AI_RULES) — ama burada BİLİNÇLİ olarak yalnızca
  // `console.error` kullanılıyor, `utils/errorLog` DEĞİL: bu modül açılış
  // yolunda çalışıyor ve buraya yeni bir modül bağımlılığı eklemek, tam da
  // önlemeye çalıştığımız türden bir açılış çökmesi riski doğurur.
  console.error(
    '[supabaseClient] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY tanimli degil — ' +
      'akis (feed) ozellikleri calismayacak. Build ortaminda .env veya EAS ortam degiskenleri eksik.',
  );
}

export const supabase = createClient(
  // Geçersiz ama SÖZDİZİMİ AÇISINDAN GEÇERLİ bir URL: `createClient` fırlatmaz,
  // istek atılırsa çözümlenemez ve normal bir ağ hatası olarak döner.
  isConfigured ? supabaseUrl : 'https://supabase-yapilandirilmadi.invalid',
  isConfigured ? supabaseAnonKey : 'yapilandirilmadi',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
