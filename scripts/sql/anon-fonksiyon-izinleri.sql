-- ANON / AUTHENTICATED FONKSİYON İZİNLERİ — SALT OKUMA (hiçbir şeyi değiştirmez) · M499, 2026-10-12
-- Neden SQL: RPC'yi anon anahtarla ÇAĞIRARAK sınamak, izin açıksa silen bir
-- fonksiyonu (prune_*) gerçekten çalıştırır. Bu sorgu yalnız izni okur.
-- Hatırlatma (hafıza: supabase-default-function-grants): REVOKE FROM PUBLIC,
-- anon'un kendi EXECUTE iznini kaldırmaz — rol adıyla REVOKE gerekir.
--
-- Beklenen: `anon_calistirir = true` satırlarının HER BİRİ bilerek açık olmalı
-- (ör. katalog/okuma RPC'leri). SECURITY DEFINER + anon = true + veri değiştiren
-- bir fonksiyon görürsen bildir.
select p.proname                                         as fonksiyon,
       p.prosecdef                                       as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_calistirir,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_calistirir,
       p.provolatile                                     as oynaklik   -- v = değiştirebilir, s/i = salt okuma
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.prokind = 'f'
  and pg_get_function_result(p.oid) <> 'trigger'
order by anon_calistirir desc, security_definer desc, p.proname;
