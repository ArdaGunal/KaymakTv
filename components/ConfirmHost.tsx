import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from './ConfirmModal';
import { useDialogStore } from '../store/dialogStore';

/**
 * Kökte TEK bağlanır (`app/_layout.tsx`). `utils/confirmDialog.ts`'ten gelen istekleri
 * uygulamanın koyu kutusuyla (`ConfirmModal`) gösterir — GORSEL-01 / BACKLOG C34.
 * Kuyruğun başını çizer; `key` her istekte kutuyu sıfırdan kurar.
 */
export default function ConfirmHost() {
  const { t } = useTranslation('common');
  const bas = useDialogStore((s) => s.queue[0]);
  const settle = useDialogStore((s) => s.settle);

  useEffect(() => useDialogStore.getState().hostMounted(), []);

  if (!bas) return null;
  return (
    <ConfirmModal
      key={bas.id}
      visible
      title={bas.title}
      message={bas.message}
      confirmLabel={bas.confirmLabel || t('ok', 'Tamam')}
      cancelLabel={bas.cancelLabel}
      destructive={bas.destructive}
      onConfirm={() => settle(bas.id, 'confirm')}
      onCancel={() => settle(bas.id, 'cancel')}
      onDismiss={() => settle(bas.id, 'dismiss')}
    />
  );
}
