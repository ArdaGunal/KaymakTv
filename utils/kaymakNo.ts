/**
 * KaymakNo görünümü (Kimlik birliği Faz 2 · 066 · plan D9): `#48291735`.
 * SAF — numara 8 haneli aralıkta değilse `null` (066 öncesi / eski Worker → gösterilmez).
 * 🔴 Yalnız gösterim; giriş/yetki anahtarı DEĞİL.
 */
export function kaymakNoMetni(no: number | null | undefined): string | null {
  return typeof no === 'number' && Number.isInteger(no) && no >= 10000000 && no <= 99999999 ? `#${no}` : null;
}
