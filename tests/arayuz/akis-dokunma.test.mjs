import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

// C1 · Kart dokunma haritası — kaynak denetimi (RN bileşeni Node'da çizilmez;
// davranış emülatörde ayrıca doğrulanır, bkz. docs/testler/2.6.5.md AKIS-DOKUN-*).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AKIS DOKUNMA HARITASI (C1)', { kokOneki: 'akis-dokunma-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const kart = oku('features/feed/components/FeedCard.tsx');
const maraton = oku('features/feed/components/MarathonFeedCard.tsx');
const detay = oku('app/activity/[id].tsx');

T.ok('Kart govdesi Pressable, detaya gidiyor', /<Pressable\s+onPress=\{handleOpenDetail\}/.test(kart) && /router\.push\(`\/activity\/\$\{activity\.id\}`/.test(kart));
T.ok('Bekleyen (isPending) kart dokunulmaz', /canOpenDetail = openDetailOnPress && isInteractive/.test(kart) && /disabled=\{!canOpenDetail\}/.test(kart));
T.ok('Detay sayfasi kendine yonlendirmez', /openDetailOnPress=\{false\}/.test(detay));
T.ok('Ic hedefler korunuyor: avatar/ad -> profil, yapim adi/poster -> yapim', (kart.match(/onPress=\{handlePressProfile\}/g) || []).length >= 2 && (kart.match(/onPress=\{handlePressShow\}/g) || []).length >= 2);
T.ok('Maraton karti -> dizinin sayfasi (detay yok)', /<Pressable\s+onPress=\{handlePressShow\}/.test(maraton) && !/\/activity\//.test(maraton.replace(/\/\/.*$/gm, '')));
T.ok('Web hover geri bildirimi', /hovered/.test(kart) && /cardHover/.test(kart) && /hovered/.test(maraton));
T.bitir();
