/**
 * Hafif semver (Semantic Versioning) karşılaştırıcı — yalnızca `major.minor.patch`
 * biçimini anlar (ör. "1.0.12", "1.1.0"). Pre-release/build metadata ("-beta.1",
 * "+build5") KASITLI OLARAK desteklenmiyor: bu proje o etiketleri hiçbir yerde
 * (app.json → expo.version, Play Store sürüm numarası) kullanmıyor, tam semver
 * spesifikasyonunu (npm'in `semver` paketi gibi) bağımlılığa eklemek gereksiz
 * ağırlık olurdu. Eksik/bozuk parça `0` sayılır ("1.2" → "1.2.0" gibi
 * davranır) — sunucudan veya cihazdan gelen sürüm string'i beklenmedik şekilde
 * kısa olsa bile zorunlu güncelleme kontrolü asla çökmez.
 */

const parse = (version: string): [number, number, number] => {
  const parts = (version || '').trim().split('.').map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

/** `a` `b`'den küçükse -1, büyükse 1, eşitse 0 döner. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/** `currentVersion`, `minRequiredVersion`'dan KESİNLİKLE eski mi (eşitse false — eşit sürüm zorunlu güncelleme tetiklemez). */
export function isVersionBelow(currentVersion: string, minRequiredVersion: string): boolean {
  return compareVersions(currentVersion, minRequiredVersion) < 0;
}
