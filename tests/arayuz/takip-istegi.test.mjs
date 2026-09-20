// ==========================================================================
// ARAYUZ — M424: takip istegi reddi SATIRI SILER ("sessiz duvar" kalkti)
// ==========================================================================
// URUN KARARI (kullanici, 2026-09-21): *"Kullaniciya yalan soyleyen UX
// yapilari her zaman sorun cikarir. Tacizi engellemenin durust ve sektor
// standardi yolu ENGELLE'dir."*
//
// Eski tasarim reddi `state='denied'` yaparak satiri BIRAKIYORDU ve isteyen
// kisi ekraninda SONSUZA DEK "onay bekliyor" goruyordu. Dort kusur uretmisti:
//   1. "Geri cek" denied satirda SESSIZCE hicbir sey yapmiyordu
//   2. Hedef reddini geri alamiyordu (liste ve RPC yalniz pending goruyor)
//   3. Bayat satir hesap acilip kapaninca duvari yeniden kuruyordu
//   4. Istemcide cozulmeyen yerel kayit kaliyordu
//
// Bu takim 4. kusurun (istemci) ve migration 059'un yerinde durdugunu tutar.
// Worker tarafi `kaymaktv-feedback-worker/test/social.spec.js`te.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

const { baslat } = yardimci;
const T = baslat('ARAYUZ TAKIP ISTEGI (M424)', { kokOneki: 'arayuz-istek-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const oku = (...y) => fs.readFileSync(path.join(KOK, ...y), 'utf8');

// ─────────────────────────────────────────────────────────────────────────
T.H('Migration 059 — duvarlari kaldiriyor ve kolonu dusuruyor');
const m = oku('supabase', 'schema', '059_ret_siler.sql');
T.ok('Mevcut denied satirlar SILINIYOR (kilitli kullanicilar kurtuluyor)',
  /DELETE FROM follow_requests WHERE state = 'denied';/.test(m));
T.ok('state kolonu ve CHECK dusuyor',
  /DROP CONSTRAINT IF EXISTS follow_requests_durum/.test(m)
  && /DROP COLUMN IF EXISTS state/.test(m));
T.ok('Indeks tek kolonla yeniden kuruluyor',
  /CREATE INDEX IF NOT EXISTS idx_follow_requests_target\s*\n?\s*ON follow_requests\(target_id\)/.test(m));
T.ok('Tek islem (BEGIN/COMMIT)', /BEGIN;/.test(m) && /COMMIT;/.test(m));
T.ok('Idempotent (IF EXISTS kullaniliyor)', (m.match(/IF EXISTS/g) || []).length >= 2);
// 🔴 KOLONA BAKAN FONKSIYONLAR: kolon dusunce gövdesinde `state` gecen her
// fonksiyon CALISMA ANINDA patlar. Ikisi de 059'da yeniden taniminlaniyor.
T.ok('approve_follow_request yeniden tanimlanmis ve state sarti kalkmis',
  /CREATE OR REPLACE FUNCTION public\.approve_follow_request/.test(m)
  && !/AND state\s*=\s*'pending'/.test(m));
T.ok('gizliligi_ayarla yeniden tanimlanmis (acigA gecince bekleyenleri onaylar)',
  /CREATE OR REPLACE FUNCTION public\.gizliligi_ayarla/.test(m));
T.ok('Iki fonksiyonun yetkisi ROLLERIN ADIYLA geri aliniyor (M405 dersi)',
  (m.match(/FROM PUBLIC, anon, authenticated;/g) || []).length === 2
  && (m.match(/GRANT EXECUTE[\s\S]*?TO service_role;/g) || []).length === 2);
T.ok('PostgREST sema onbellegi tazeleniyor', /NOTIFY pgrst, 'reload schema';/.test(m));

// ─────────────────────────────────────────────────────────────────────────
T.H('Istemci — yerel "gonderilmis istek" kaydi artik cozuluyor');
const store = oku('store', 'notificationStore.ts');
T.ok('Sunucudaki istekler (pendingOut) tek dogru kaynak',
  /const sunucudakiIstekler = new Set\(graf\.pendingOut \?\? \[\]\);/.test(store));
T.ok('Sunucuda YOKSA kayit dusuyor (ret/geri cekme)',
  /\} else if \(sunucudakiIstekler\.has\(bekleyen\.userId\)\) \{\s*\n\s*stillPending\.push\(bekleyen\);/.test(store));
T.ok('Onay dali korundu (requestApproved bildirimi)',
  /type: 'requestApproved'/.test(store));

// ─────────────────────────────────────────────────────────────────────────
T.H('Istemci — dugme durumu sunucudan geliyor, tahmin YOK');
const kanca = oku('hooks', 'useFollowState.ts');
T.ok('Durum sunucunun yanitindan (takip/istek) okunuyor',
  /durum === 'istek' \? 'pending' : 'following'/.test(kanca));
T.ok('Misafir kapisi var', /guestRestrictedMessage/.test(kanca));

T.bitir();
