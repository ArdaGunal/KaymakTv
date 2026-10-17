/**
 * KaymakNo görünümü (Kimlik birliği Faz 2 · 066 · plan D9): `#48291735`.
 * SAF — numara 8 haneli aralıkta değilse `null` (066 öncesi / eski Worker → gösterilmez).
 * 🔴 Yalnız gösterim; giriş/yetki anahtarı DEĞİL.
 */
export function kaymakNoMetni(no: number | null | undefined): string | null {
  return typeof no === 'number' && Number.isInteger(no) && no >= 10000000 && no <= 99999999 ? `#${no}` : null;
}

/**
 * Kimlik Faz 6 (M522) · D7 — kısa profil bağlantısı `https://kaymaktv.com/u/<KaymakNo>`.
 * Ad değişse de kırılmaz (numara değişmez, asla yeniden verilmez — 067). Numara geçersizse `null`.
 * Açan kişi giriş yapmamışsa giriş ekranına gider (D6); `/user/<ad>` bağlantıları da çalışmaya devam eder.
 */
export function profilPaylasimLinki(no: number | null | undefined): string | null {
  return kaymakNoMetni(no) ? `https://kaymaktv.com/u/${no}` : null;
}
