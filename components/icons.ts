// ⚠️ OTOMATİK ÜRETİLDİ — elle ikon satırı ekle/çıkar, gerisine dokunma.
// Ayrıntılı gerekçe: docs/HISTORY.md Madde 235.
//
// NE İŞE YARIYOR: `import { X } from 'lucide-react-native'` yazmak paketin
// TAMAMINI (1.751 ikon = bundle'ın %23,7'si) bundle'a sokuyordu. Uygulamanın
// gerçekten kullandığı ikon sayısı 87. Bu dosya yalnızca onları getirir.
//
// NEDEN ÇİRKİN GÖRELİ YOL (`../node_modules/...`) — zorunlu, ölçüldü:
// `lucide-react-native@1.23.0`'ın `exports` haritası yalnızca `.` ve `./icons`
// tanımlıyor, wildcard YOK. Metro'da `unstable_enablePackageExports: true`
// olduğu için temiz derin import (`lucide-react-native/dist/esm/icons/x.mjs`)
// `ERR_PACKAGE_PATH_NOT_EXPORTED` ile REDDEDİLİYOR (Node ile doğrulandı).
// Göreli DOSYA YOLU paket belirteci olmadığından `exports` haritasına takılmaz.
// ⚠️ Bu, node_modules'ün düz (hoisted) yerleşimine bağlıdır — npm ile çalışır.
//
// DENENİP ELENEN ALTERNATİF: `EXPO_UNSTABLE_TREE_SHAKING=1` bundle'ı %42
// küçültüyordu AMA uygulamayı tamamen kırıyordu (beyaz ekran +
// "Cannot read properties of undefined (reading 'EventEmitter')").
// Tarayıcıda kontrol deneyiyle kanıtlandı. KULLANILAMAZ.
//
// İKON ADLARI ALIAS OLABİLİR: lucide bazılarını yeniden adlandırmış
// (`Home`→`house`, `BarChart2`→`chart-no-axes-column`,
// `MoreVertical`→`ellipsis-vertical`). Bu eşleşme TAHMİN EDİLMEDİ, paketin
// kendi barrel dosyasından programatik çıkarıldı.
//
// YENİ İKON EKLERKEN: buraya bir satır ekle. Doğrudan 'lucide-react-native'
// ten import ETME — tek bir named import 1.751 ikonun tamamını geri getirir.

// Tipler: `export type` Babel tarafından silinir, bundle'a çalışma zamanı
// kodu EKLEMEZ — bu yüzden doğrudan paketten alınabilir.
export type { LucideIcon } from 'lucide-react-native';

export { default as Activity } from '../node_modules/lucide-react-native/dist/esm/icons/activity.mjs';
export { default as AlertTriangle } from '../node_modules/lucide-react-native/dist/esm/icons/triangle-alert.mjs';
export { default as ArrowLeft } from '../node_modules/lucide-react-native/dist/esm/icons/arrow-left.mjs';
export { default as ArrowRight } from '../node_modules/lucide-react-native/dist/esm/icons/arrow-right.mjs';
export { default as ArrowUp } from '../node_modules/lucide-react-native/dist/esm/icons/arrow-up.mjs';
export { default as Ban } from '../node_modules/lucide-react-native/dist/esm/icons/ban.mjs';
export { default as BarChart2 } from '../node_modules/lucide-react-native/dist/esm/icons/chart-no-axes-column.mjs';
export { default as Bell } from '../node_modules/lucide-react-native/dist/esm/icons/bell.mjs';
export { default as Bookmark } from '../node_modules/lucide-react-native/dist/esm/icons/bookmark.mjs';
export { default as Bug } from '../node_modules/lucide-react-native/dist/esm/icons/bug.mjs';
export { default as Calendar } from '../node_modules/lucide-react-native/dist/esm/icons/calendar.mjs';
export { default as Check } from '../node_modules/lucide-react-native/dist/esm/icons/check.mjs';
export { default as CheckCheck } from '../node_modules/lucide-react-native/dist/esm/icons/check-check.mjs';
export { default as CheckCircle2 } from '../node_modules/lucide-react-native/dist/esm/icons/circle-check.mjs';
export { default as CheckSquare } from '../node_modules/lucide-react-native/dist/esm/icons/square-check-big.mjs';
export { default as ChevronDown } from '../node_modules/lucide-react-native/dist/esm/icons/chevron-down.mjs';
export { default as ChevronLeft } from '../node_modules/lucide-react-native/dist/esm/icons/chevron-left.mjs';
export { default as ChevronRight } from '../node_modules/lucide-react-native/dist/esm/icons/chevron-right.mjs';
export { default as ChevronUp } from '../node_modules/lucide-react-native/dist/esm/icons/chevron-up.mjs';
export { default as Circle } from '../node_modules/lucide-react-native/dist/esm/icons/circle.mjs';
export { default as Clapperboard } from '../node_modules/lucide-react-native/dist/esm/icons/clapperboard.mjs';
export { default as Clock } from '../node_modules/lucide-react-native/dist/esm/icons/clock.mjs';
export { default as CloudOff } from '../node_modules/lucide-react-native/dist/esm/icons/cloud-off.mjs';
export { default as Compass } from '../node_modules/lucide-react-native/dist/esm/icons/compass.mjs';
export { default as Copy } from '../node_modules/lucide-react-native/dist/esm/icons/copy.mjs';
export { default as CornerDownRight } from '../node_modules/lucide-react-native/dist/esm/icons/corner-down-right.mjs';
export { default as Cpu } from '../node_modules/lucide-react-native/dist/esm/icons/cpu.mjs';
export { default as Download } from '../node_modules/lucide-react-native/dist/esm/icons/download.mjs';
export { default as ExternalLink } from '../node_modules/lucide-react-native/dist/esm/icons/external-link.mjs';
export { default as Eye } from '../node_modules/lucide-react-native/dist/esm/icons/eye.mjs';
export { default as EyeOff } from '../node_modules/lucide-react-native/dist/esm/icons/eye-off.mjs';
export { default as FileCheck } from '../node_modules/lucide-react-native/dist/esm/icons/file-check.mjs';
export { default as FileText } from '../node_modules/lucide-react-native/dist/esm/icons/file-text.mjs';
export { default as Film } from '../node_modules/lucide-react-native/dist/esm/icons/film.mjs';
export { default as Flag } from '../node_modules/lucide-react-native/dist/esm/icons/flag.mjs';
export { default as Flame } from '../node_modules/lucide-react-native/dist/esm/icons/flame.mjs';
export { default as Folder } from '../node_modules/lucide-react-native/dist/esm/icons/folder.mjs';
export { default as Globe } from '../node_modules/lucide-react-native/dist/esm/icons/globe.mjs';
export { default as Heart } from '../node_modules/lucide-react-native/dist/esm/icons/heart.mjs';
export { default as History } from '../node_modules/lucide-react-native/dist/esm/icons/history.mjs';
export { default as Home } from '../node_modules/lucide-react-native/dist/esm/icons/house.mjs';
export { default as Inbox } from '../node_modules/lucide-react-native/dist/esm/icons/inbox.mjs';
export { default as Info } from '../node_modules/lucide-react-native/dist/esm/icons/info.mjs';
export { default as Lightbulb } from '../node_modules/lucide-react-native/dist/esm/icons/lightbulb.mjs';
export { default as Link2 } from '../node_modules/lucide-react-native/dist/esm/icons/link-2.mjs';
export { default as List } from '../node_modules/lucide-react-native/dist/esm/icons/list.mjs';
export { default as ListPlus } from '../node_modules/lucide-react-native/dist/esm/icons/list-plus.mjs';
export { default as ListVideo } from '../node_modules/lucide-react-native/dist/esm/icons/list-video.mjs';
export { default as Lock } from '../node_modules/lucide-react-native/dist/esm/icons/lock.mjs';
export { default as LogIn } from '../node_modules/lucide-react-native/dist/esm/icons/log-in.mjs';
export { default as LogOut } from '../node_modules/lucide-react-native/dist/esm/icons/log-out.mjs';
export { default as MessageCircle } from '../node_modules/lucide-react-native/dist/esm/icons/message-circle.mjs';
export { default as MessageSquare } from '../node_modules/lucide-react-native/dist/esm/icons/message-square.mjs';
export { default as MessageSquarePlus } from '../node_modules/lucide-react-native/dist/esm/icons/message-square-plus.mjs';
export { default as MoreVertical } from '../node_modules/lucide-react-native/dist/esm/icons/ellipsis-vertical.mjs';
export { default as PauseCircle } from '../node_modules/lucide-react-native/dist/esm/icons/circle-pause.mjs';
export { default as PenLine } from '../node_modules/lucide-react-native/dist/esm/icons/pen-line.mjs';
export { default as Pencil } from '../node_modules/lucide-react-native/dist/esm/icons/pencil.mjs';
export { default as Play } from '../node_modules/lucide-react-native/dist/esm/icons/play.mjs';
export { default as PlayCircle } from '../node_modules/lucide-react-native/dist/esm/icons/circle-play.mjs';
export { default as Plus } from '../node_modules/lucide-react-native/dist/esm/icons/plus.mjs';
export { default as RefreshCw } from '../node_modules/lucide-react-native/dist/esm/icons/refresh-cw.mjs';
export { default as Repeat } from '../node_modules/lucide-react-native/dist/esm/icons/repeat.mjs';
export { default as RotateCcw } from '../node_modules/lucide-react-native/dist/esm/icons/rotate-ccw.mjs';
export { default as RotateCw } from '../node_modules/lucide-react-native/dist/esm/icons/rotate-cw.mjs';
export { default as Rss } from '../node_modules/lucide-react-native/dist/esm/icons/rss.mjs';
export { default as Search } from '../node_modules/lucide-react-native/dist/esm/icons/search.mjs';
export { default as SearchX } from '../node_modules/lucide-react-native/dist/esm/icons/search-x.mjs';
export { default as Send } from '../node_modules/lucide-react-native/dist/esm/icons/send.mjs';
export { default as Settings } from '../node_modules/lucide-react-native/dist/esm/icons/settings.mjs';
export { default as Share2 } from '../node_modules/lucide-react-native/dist/esm/icons/share-2.mjs';
export { default as ShieldCheck } from '../node_modules/lucide-react-native/dist/esm/icons/shield-check.mjs';
export { default as SlidersHorizontal } from '../node_modules/lucide-react-native/dist/esm/icons/sliders-horizontal.mjs';
export { default as Smartphone } from '../node_modules/lucide-react-native/dist/esm/icons/smartphone.mjs';
export { default as Sparkles } from '../node_modules/lucide-react-native/dist/esm/icons/sparkles.mjs';
export { default as Square } from '../node_modules/lucide-react-native/dist/esm/icons/square.mjs';
export { default as Star } from '../node_modules/lucide-react-native/dist/esm/icons/star.mjs';
export { default as Trash2 } from '../node_modules/lucide-react-native/dist/esm/icons/trash-2.mjs';
export { default as Tv } from '../node_modules/lucide-react-native/dist/esm/icons/tv.mjs';
export { default as User } from '../node_modules/lucide-react-native/dist/esm/icons/user.mjs';
export { default as UserCheck } from '../node_modules/lucide-react-native/dist/esm/icons/user-check.mjs';
export { default as UserCircle2 } from '../node_modules/lucide-react-native/dist/esm/icons/circle-user-round.mjs';
export { default as UserPlus } from '../node_modules/lucide-react-native/dist/esm/icons/user-plus.mjs';
export { default as UserX } from '../node_modules/lucide-react-native/dist/esm/icons/user-x.mjs';
export { default as WifiOff } from '../node_modules/lucide-react-native/dist/esm/icons/wifi-off.mjs';
export { default as X } from '../node_modules/lucide-react-native/dist/esm/icons/x.mjs';
export { default as Zap } from '../node_modules/lucide-react-native/dist/esm/icons/zap.mjs';
