import { create } from 'zustand';

// Bildirim sistemi henüz yapım aşamasında (bkz. docs/notifications.md) —
// gerçek bir sunucu/push kaynağı bağlanana kadar `unreadCount` HER ZAMAN 0
// kalmalı. `incrementUnread` gibi test amaçlı mutasyonlar buradan bilerek
// çıkarıldı (bkz. docs/HISTORY.md) — geri eklenmesi gerekiyorsa gerçek bir
// bildirim kaynağına (Expo/Web Push payload'ı veya sunucudan okunan
// unread sayısı) bağlı olarak eklenmelidir, UI testi için değil.
interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  clearUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,

  setUnreadCount: (count) => set({ unreadCount: count }),

  clearUnread: () => set({ unreadCount: 0 }),
}));
