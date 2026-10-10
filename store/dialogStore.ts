import { create } from 'zustand';

/**
 * GORSEL-01 / BACKLOG C34 — uygulama içi onay/bilgi kutularının kuyruğu.
 *
 * `utils/confirmDialog.ts` her yerden (hook, servis, olay işleyici) çağrılabilen bir
 * Promise döndürür; kutuyu ise kökteki `components/ConfirmHost.tsx` çizer. İkisini bu
 * store bağlar. Eskiden Android yerel `Alert.alert` açılıyordu → koyu uygulamada BEYAZ
 * pencere (2026-10-10 yayın turunda tüm onaylar beyaz görüldü).
 *
 * 🔴 Sonuç TEK SEFER: aynı kutuya çift dokunuş ya da dokunuş + geri tuşu ikinci kez
 * çözmez — `settle` kaydı kuyruktan çıkarır, bulamazsa hiçbir şey yapmaz.
 * 🔴 Kuyruk: aynı anda iki istek gelirse sırayla gösterilir, hiçbiri kaybolmaz.
 */

/** confirm = birincil düğme · cancel = ikincil düğme · dismiss = dışarı dokunma / geri tuşu */
export type DialogResult = 'confirm' | 'cancel' | 'dismiss';

export interface DialogRequest {
  id: number;
  title: string;
  message: string;
  /** Boşsa host `common:ok` kullanır (bilgi kutusu). */
  confirmLabel?: string;
  /** Yoksa tek düğmeli bilgi kutusu. */
  cancelLabel?: string;
  destructive: boolean;
  resolve: (r: DialogResult) => void;
}

interface DialogState {
  queue: DialogRequest[];
  /** Kökte bağlı host sayısı — 0 ise çağıran yerel diyaloğa düşer. */
  hosts: number;
  open: (req: Omit<DialogRequest, 'id' | 'resolve'>) => Promise<DialogResult>;
  settle: (id: number, result: DialogResult) => void;
  hostMounted: () => () => void;
}

let sonId = 0;

export const useDialogStore = create<DialogState>((set, get) => ({
  queue: [],
  hosts: 0,
  open: (req) =>
    new Promise<DialogResult>((resolve) => {
      const id = ++sonId;
      set((s) => ({ queue: [...s.queue, { ...req, id, resolve }] }));
    }),
  settle: (id, result) => {
    const kayit = get().queue.find((q) => q.id === id);
    if (!kayit) return;
    set((s) => ({ queue: s.queue.filter((q) => q.id !== id) }));
    kayit.resolve(result);
  },
  hostMounted: () => {
    set((s) => ({ hosts: s.hosts + 1 }));
    return () => {
      set((s) => ({ hosts: Math.max(0, s.hosts - 1) }));
      // Son host giderse bekleyenler askıda kalmasın: «vazgeç» say.
      if (get().hosts === 0) get().queue.forEach((q) => get().settle(q.id, 'dismiss'));
    };
  },
}));

export const dialogHostVar = (): boolean => useDialogStore.getState().hosts > 0;
