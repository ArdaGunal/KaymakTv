// M439: eski ag-bekle karari yerini kalici yerel ACK sinirina birakti.
// Motor/mutasyon davranisi watched-outbox.test.mjs'de gercek TS ile kosulur.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import { tsLoader } from '../ts-test-loader.mjs';

const T = yardimci.baslat('ARAYUZ KALICI ISARETLEME ACK (M439)', { kokOneki: 'arayuz-isaret-' });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const button = read('components/EpisodeCheckButton.tsx');
const checkIn = button.slice(button.indexOf('const performCheckIn'), button.indexOf('const handleCheckIn'));
const beforeAck = checkIn.slice(0, checkIn.indexOf('.then((newProgress)'));
T.ok('Disk ACK oncesi busyRef kilitli, yesil YOK', /busyRef.current = true/.test(beforeAck)
  && !/setIsSuccess\(true\)/.test(beforeAck) && !/setTimeout\(serbestBirak/.test(beforeAck));
T.ok('Yesil ve 550ms yalniz mutasyon ACK dalinda', /\.then\(\(newProgress\)[\s\S]*setIsSuccess\(true\)[\s\S]*setTimeout\(serbestBirak, SUCCESS_HOLD_MS\)/.test(checkIn));
T.ok('Cift dokunus senkron kilitli', /if \(busyRef.current\) return;\s*busyRef.current = true/.test(checkIn));
T.ok('Gec yanit yeni dokunusu bozmuyor', /if \(requestIdRef.current !== myRequestId\) return/.test(checkIn));
T.ok('Disk hatasi gorunur, kilit geri acilir', /\.catch\(\(error\)[\s\S]*notify\([\s\S]*serbestBirak\(\)/.test(checkIn));
T.ok('Null/eksik ilerleme konfeti/bitis SAYILMAZ', /if \(newProgress && !newProgress\.next_episode && !newProgress\.catalogIncomplete\)/.test(checkIn));

// Gercek React komponentinin event zinciri; state/ref/native yalniz port mock.
let resolveMark, rejectMark;
let result;
const states = [], refs = [], timers = [], alerts = [];
let stateIndex = 0, refIndex = 0, calls = 0, finishes = 0;
const mark = () => { calls++; return new Promise((resolve, reject) => { resolveMark = resolve; rejectMark = reject; }); };
const component = tsLoader(root, {
  react: { __esModule: true, default: { createElement: (_tag, props) => { result = props; return props; } },
    useState: (initial) => { const i = stateIndex++; states[i] = initial; return [initial, (v) => { states[i] = v; }]; },
    useRef: (initial) => { const r = { current: initial }; refs[refIndex++] = r; return r; } },
  'react-native': { TouchableOpacity: 'Button', StyleSheet: { create: (v) => v } },
  // GORSEL-01: uyarilar artik uygulama kutusundan (notify).
  '../utils/confirmDialog': { notify: (...args) => alerts.push(args), chooseAsync: async () => null },
  './icons': { Check: 'Check' },
  '../context/LibraryContext': { useLibraryActions: () => ({ markEpisodeAsWatched: mark, planiIsaretle: mark }) },
  '../store/useLibraryStore': { useLibraryStore: { getState: () => ({ showProgressMap: {} }) } },
  '../context/AuthContext': { useAuth: () => ({ isGuest: false }) },
  'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
}, { setTimeout: (fn) => { timers.push(fn); return 1; }, console: { error: () => {} } })('components/EpisodeCheckButton.tsx');
component.default({ traktId: 33733, season: 1, episode: 1, showName: 'Test', onShowFinished: () => { finishes++; } });
result.onPress(); result.onPress();
T.ok('Gercek event: disk sozu asiliyken iki dokunus TEK mutasyon', calls === 1 && states[0] === false && timers.length === 0);
resolveMark({ next_episode: { season: 1, number: 2 } });
await Promise.resolve(); await Promise.resolve();
T.ok('Gercek event: ACK sonrasi yesil ve tek tutma zamanlayicisi', states[0] === true && timers.length === 1);
timers.shift()();
result.onPress(); rejectMark(new Error('test disk hatasi'));
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
T.ok('Gercek event: disk hatasi yesil DEGIL ve gorunur uyari', states[0] === false && refs[0].current === false && alerts.length === 1);
result.onPress(); resolveMark({ next_episode: null, catalogIncomplete: true });
await Promise.resolve(); await Promise.resolve();
T.ok('Gercek event: eksik katalog null-next konfeti VE kalici kilit yapmaz', finishes === 0 && states[1] === false);
timers.shift()();
result.onPress(); resolveMark({ next_episode: null, completed: 1, aired: 1 });
await Promise.resolve(); await Promise.resolve();
T.ok('Gercek event: tam katalogda gercek final konfeti korunur', finishes === 1 && states[1] === true);
T.bitir();
