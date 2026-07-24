// İstemci tarafı sanitizasyon — Worker'daki aynı regex kalkanının bir kopyası
// (çift dikiş güvenlik: veri Worker'a ulaşmadan önce burada da temizlenir).
// Herhangi bir yerde token/şifre sızıntısı varsa iki katmandan biri yakalar.

const BEARER_PATTERN = /(Bearer\s+)\S+/gi;
const KEY_VALUE_PATTERN =
  /("?(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|password|secret|client[_-]?secret)"?\s*[:=]\s*")[^"]+(")/gi;
// Bearer önekiyle veya tırnak içinde yakalanamayan çıplak JWT'ler (xxx.yyy.zzz) için son çare.
const JWT_PATTERN = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

export const sanitizeText = (input: string): string => {
  if (!input) return input;
  return input
    .replace(BEARER_PATTERN, '$1[GİZLENDİ]')
    .replace(KEY_VALUE_PATTERN, '$1[GİZLENDİ]$2')
    .replace(JWT_PATTERN, '[GİZLENDİ]');
};
