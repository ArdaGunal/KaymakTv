/** TARDIS uygulama paleti. Pazarlama karşılama sayfası kendi ayrı CSS temasını kullanır. */
export const MOBILE_PALETTE = {
  background: '#0C1D2B',
  surface: '#15222E',
  raised: '#1D2C3A',
  border: '#263B4F',
  primary: '#0F4A80',
  steel: '#8CA5B5',
  steelTint: 'rgba(140, 165, 181, 0.12)',
  rating: '#D4BE83',
  ratingTint: 'rgba(212, 190, 131, 0.11)',
  ratingBorder: 'rgba(212, 190, 131, 0.30)',
  text: '#E6E9E8',
  body: '#C7D0D4',
  muted: '#9AAAB8',
  mutedDeep: '#748898',
  navPill: 'rgba(15, 74, 128, 0.28)',
  navBorder: 'rgba(140, 165, 181, 0.35)',
  navBackgroundAndroid: 'rgba(12, 29, 43, 0.95)',
  navBackgroundIos: 'rgba(12, 29, 43, 0.82)',
} as const;

/** Ortak uygulama bileşenlerinde TARDIS rengini platformdan bağımsız uygular. */
export function nativeColor(token: keyof typeof MOBILE_PALETTE, _webColor: string): string {
  return MOBILE_PALETTE[token];
}

/** Eski parlak mavi/camgöbeği şeffaf vurguları TARDIS mat tonlarına taşır. */
export function nativeTint(token: 'primary' | 'steel', opacity: number, _webColor: string): string {
  const rgb = token === 'primary' ? '15,74,128' : '140,165,181';
  return `rgba(${rgb},${opacity})`;
}
