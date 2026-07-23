import { Dimensions } from 'react-native';

/**
 * Profil ekranındaki YATAY şeritlerin ortak ölçüleri.
 *
 * Eskiden her bileşen kendi boyutunu tanımlıyordu: poster kartları
 * `width * 0.28`, "Listelerim" kartları ise sabit 160×220 idi. Sonuç, aynı
 * ekranda üst üste duran şeritlerin birbirinden belirgin şekilde farklı
 * boyutlarda görünmesiydi. Ölçüler tek yere alınarak bu sapma kapatıldı —
 * yeni bir şerit eklendiğinde de kendiliğinden hizalı olacak.
 */
const { width } = Dimensions.get('window');

/** Poster oranı 2:3. Tam piksele yuvarlanır (yarım piksel kenarları bulanıklaştırır). */
export const POSTER_CARD_WIDTH = Math.round(width * 0.28);
export const POSTER_CARD_HEIGHT = Math.round(POSTER_CARD_WIDTH * 1.5);

/** Kartlar arası boşluk ve şeritlerin kenar boşluğu — hepsi aynı ızgarada. */
export const CARD_GAP = 12;
export const SECTION_PADDING_H = 16;

/** Şeritler arası dikey boşluk. */
export const SECTION_SPACING = 26;

/**
 * Masaüstü (`profile.web.tsx`, `isDesktop` dalı) için SABİT kart ölçüleri.
 *
 * `POSTER_CARD_WIDTH` yukarıda `Dimensions.get('window').width` üzerinden,
 * yani MOBİL EKRAN için hesaplanır. Bunu masaüstünde de kullanmak "Listelerim"
 * kartlarının, aynı sayfadaki komşu carousel'lerin (`MovieCard.web.tsx`,
 * `EpisodeCard.web.tsx` — ikisi de sabit 180×270 kullanır) yanında devasa
 * büyük görünmesine yol açardı: geniş bir pencerede `width * 0.28` kolayca
 * 400px'i aşar. Bu yüzden masaüstünde ayrı, sabit bir ölçü kullanılır —
 * sibling kartlarla BİREBİR aynı boyutta.
 */
export const DESKTOP_CARD_WIDTH = 180;
export const DESKTOP_CARD_HEIGHT = 270;
export const DESKTOP_CARD_GAP = 16;
