import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Supabase Auth KULLANILMIYOR (kimlik doğrulama Trakt OAuth üzerinden) —
// bu yüzden oturum kalıcılığı/otomatik token yenileme kapatıldı. Bu client
// yalnızca anon key + RLS (SELECT-only, bkz. supabase/schema/001_feed_schema.sql)
// ile veri okumak için kullanılır.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
