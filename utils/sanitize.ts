// G-13 — İstemci ve Worker birbirinden bağımsız dağıtılır. Maskeleme kuralları
// Kaymak utils/sanitize.ts ve Worker src/lib/sanitize.js içinde eş tutulur.
const MASK = "[GİZLENDİ]";
const SENSITIVE_KEYS = new Set([
  "authorization", "proxyauthorization", "cookie", "setcookie",
  "token", "jwt", "authtoken", "bearertoken", "accesstoken", "refreshtoken", "idtoken", "googletoken", "googleidtoken",
  "traktaccesstoken", "traktrefreshtoken", "kaymakoturum", "kaymaktoken",
  "sessiontoken", "sessionid", "csrftoken", "xsrftoken", "codeverifier",
  "kasabileti", "bilet", "erisim", "yenileme",
  "apikey", "xapikey", "password", "secret", "clientsecret",
  "supabasekey", "supabaseanonkey", "servicerolekey", "xkaymaksyncsecret",
]);

const keyPattern = [...SENSITIVE_KEYS].map((key) => key.split("").join("[-_]?")).join("|");
const quotedValue = String.raw`"(?:\\.|[^"\\\r\n])*(?:"|(?=[\r\n]|$))|'(?:\\.|[^'\\\r\n])*(?:'|(?=[\r\n]|$))`;
const bareValue = String.raw`[^\s,;\]}"'&#<>]+`;
const maskedValue = String.raw`\[GİZLENDİ\]`;
const fieldPattern = new RegExp(
  String.raw`(^|[^\w-])(["']?(?:${keyPattern})["']?[ \t]*[:=][ \t]*)(${quotedValue}|(?:Bearer|Basic|Token)[ \t]+(?:${maskedValue}|${bareValue})|${maskedValue}|${bareValue})`,
  "gi",
);
const credentialHeader = /(^|[^\w"'-])((?:proxy[-_]?authorization|authorization|set[-_]?cookie|cookie)[ \t]*:[ \t]*)(?!["']|[ \t])[^\r\n]+/gi;
const cookieAssignment = /(^|[^\w"'-])((?:set[-_]?cookie|cookie)[ \t]*=[ \t]*)(?!["']|[ \t])(?=[^&\r\n]*;)[^&\r\n]+/gi;
const authSchemePattern = /(\b(?:Bearer|Basic)[ \t]+)[A-Za-z0-9._~+/-]{8,}=*/gi;
const sessionPattern = /\b(?:kaymak_session_v1\.[A-Za-z0-9_.-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;
const opaquePattern = /[A-Za-z0-9_+-]{40,}={0,2}/g;
const pathSeparator = /[/\\.]/;
const deviceUuid = /^(?:guest-)?[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function sensitiveKey(key: string) {
  return SENSITIVE_KEYS.has(key.replace(/[-_]/g, "").toLowerCase());
}

function maskField(_match: string, prefix: string, field: string, value: string) {
  const quote = value[0];
  if (quote !== '"' && quote !== "'") return prefix + field + MASK;
  const closing = value.length > 1 && value.endsWith(quote) ? quote : "";
  return prefix + field + quote + MASK + closing;
}

function maskOpaque(value: string, offset: number, input: string) {
  // Çıplak değer sezgiseldir. Dosya/URL parçaları ve anonim cihaz kimliği tanı verisidir.
  if (pathSeparator.test(input.charAt(offset - 1)) ||
      pathSeparator.test(input.charAt(offset + value.length)) ||
      deviceUuid.test(value)) return value;
  const mixed = /[A-Za-z]/.test(value) && /\d/.test(value);
  return mixed || /^[a-f0-9]{64,}$/i.test(value) ? MASK : value;
}

function redactPlainText(input: string) {
  return input
    .replace(credentialHeader, "$1$2" + MASK)
    .replace(cookieAssignment, "$1$2" + MASK)
    .replace(fieldPattern, maskField)
    .replace(authSchemePattern, "$1" + MASK)
    .replace(sessionPattern, MASK)
    .replace(emailPattern, "[GİZLENDİ_EMAIL]")
    .replace(opaquePattern, maskOpaque);
}

export function sanitizeJson(value: unknown): string {
  return JSON.stringify(value, (key, item) => {
    if (typeof item !== "string") return item;
    return sensitiveKey(key) ? MASK : sanitizeText(item);
  }) ?? "";
}

export function sanitizeText(input: string): string {
  if (typeof input !== "string" || !input) return "";
  const start = input.trimStart()[0];
  if (start === "{" || start === "[") {
    try {
      return sanitizeJson(JSON.parse(input));
    } catch {
      // Günlüklerde yarım JSON da bulunur, bu durumda serbest metni tara.
    }
  }
  return redactPlainText(input);
}

export function sanitizeLogTags(tags: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!tags) return undefined;
  return Object.fromEntries(Object.entries(tags).map(([key, value]) => [
    sanitizeText(key), typeof value === "string" ? (sensitiveKey(key) ? MASK : sanitizeText(value)) : value,
  ]));
}
