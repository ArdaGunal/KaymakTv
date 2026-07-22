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
