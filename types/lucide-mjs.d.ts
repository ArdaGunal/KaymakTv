// Tip kabuğu — `components/icons.ts` içindeki derin `.mjs` import'ları için.
//
// NEDEN GEREKLİ: `lucide-react-native` tekil ikonlar için `.d.ts` ÜRETMİYOR
// (ölçüldü: 1745 adet `.mjs`, 0 adet `.d.ts`); yalnızca toplu bir declaration
// dosyası var. Bu kabuk olmadan her ikon `any` olur (TS7016) ve
// `<Icon size={..} color={..} />` çağrılarında tip güvenliği kaybolur.
//
// KAPSAM: proje genelinde BAŞKA HİÇBİR `.mjs` import'u yok (ölçüldü), bu
// yüzden bu bildirim pratikte yalnızca lucide ikonlarını etkiler. Başka bir
// `.mjs` bağımlılığı eklenirse burası daraltılmalı.
declare module '*.mjs' {
  import type { LucideIcon } from 'lucide-react-native';
  const ikon: LucideIcon;
  export default ikon;
}
