import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Inbox, Trash2 } from '../../../components/icons';
import ConfirmModal from '../../../components/ConfirmModal';
import { useNotificationStore } from '../../../store/notificationStore';
import { useInboxStore } from '../inbox/useInboxStore';
import { buildTimeline, timelineCount } from '../inbox/timeline';
import type { TimelineEntry, TimelineGroupId } from '../inbox/timeline';
import { SwipeToDelete } from './SwipeToDelete';
import { TimelineRow } from './TimelineRow';

/**
 * Birleşik bildirim akışı — `app/(protected)/notifications.tsx`'in gövdesi
 * (docs/design/notifications.md § 11).
 *
 * 🔴 İKİ STORE, TEK GÖRÜNÜM. `store/notificationStore.ts` (sosyal) ve
 * `inbox/useInboxStore.ts` (içerik) AYRI kalmaya devam ediyor — §11'in
 * kararı bozulmadı. Burada yapılan tek şey ikisini `buildTimeline` ile tek
 * bir zaman akışında GÖSTERMEK ve silmeyi doğru store'a yönlendirmek.
 * Kullanıcı için "bildirim" tek bir kavram; iki ayrı kutu görmesi için bir
 * sebep yok, ama veri şekilleri farklı olduğu için store'ları birleştirmek
 * için de bir sebep yok.
 *
 * ⚠️ AYRI BİLEŞEN OLMASININ SEBEBİ: ekran zaten sınıra yakındı; akışı içine
 * yazmak `AI_RULES` §1'in 400 satır sınırını aşardı.
 */

const GROUP_LABELS: Record<TimelineGroupId, { key: string; fallback: string }> = {
  today: { key: 'timeline.today', fallback: 'Bugün' },
  yesterday: { key: 'timeline.yesterday', fallback: 'Dün' },
  week: { key: 'timeline.week', fallback: 'Bu hafta' },
  older: { key: 'timeline.older', fallback: 'Daha eski' },
};

export function NotificationTimeline() {
  const { t } = useTranslation('notifications');

  const contentItems = useInboxStore((s) => s.items);
  const socialItems = useNotificationStore((s) => s.items);
  const removeContent = useInboxStore((s) => s.remove);
  const clearContent = useInboxStore((s) => s.clear);
  const removeSocial = useNotificationStore((s) => s.remove);
  const clearSocial = useNotificationStore((s) => s.clearAll);

  // `Date.now()` render sırasında okunuyor: ekran her açıldığında/yenilendiğinde
  // gruplar tazelenir. Saniyelik bir zamanlayıcıya bağlamak gereksiz — kullanıcı
  // ekranda dururken bir kaydın "bugün"den "bu hafta"ya geçmesi ancak gece
  // yarısında olur ve o an ekranda olma ihtimali ihmal edilebilir.
  const now = Date.now();
  const groups = useMemo(
    () => buildTimeline(contentItems, socialItems, now),
    [contentItems, socialItems, now],
  );
  const total = timelineCount(groups);

  const handleDelete = useCallback(
    (entry: TimelineEntry) => {
      if (entry.kind === 'content') removeContent(entry.id);
      else removeSocial(entry.id);
    },
    [removeContent, removeSocial],
  );

  // 🔴 YEREL `Alert.alert` YERİNE UYGULAMA DİLİNDE BİR KUTU (kullanıcı
  // kararı, 2026-09-06). Sistem diyaloğu işlevseldi ama uygulamanın görsel
  // dilinin dışında duruyordu; web'de ise `window.confirm` düğme
  // etiketlerini bile yansıtamıyordu ("Temizle/Vazgeç" yerine "OK/Cancel").
  const [onayAcik, setOnayAcik] = useState(false);

  const handleClearAll = useCallback(() => {
    // ⚠️ Kapatma önce çağrılıyor ama SEBEBİ SIRA DEĞİL. Kutunun açık kalması
    // sorunu buradan DEĞİL, `ConfirmModal`'ın `visible` prop'una güvenmesinden
    // geliyordu ve orada `if (!visible) return null` ile çözüldü (gerekçe o
    // dosyada). Bu sıra yalnızca niyeti okunur kılıyor: "kutuyu kapat, sonra
    // işi yap". Sırayı değiştirmek bir şeyi bozmaz.
    setOnayAcik(false);
    // İKİ store da temizlenir: kullanıcı tek bir liste görüyor, "tümü"
    // dediğinde yalnızca yarısının silinmesi güven kırar.
    clearContent();
    clearSocial();
  }, [clearContent, clearSocial]);

  return (
    <View style={styles.section}>
      {/* 🔴 BOLUM BASLIGI YOK — bilerek. Ekranin kendi basligi zaten
          "Bildirimler"; burada ikinci bir "BILDIRIMLER" satiri tekrar
          okunuyordu (web onizlemesinde goruldu). Akisin bolumlenmesini
          tarih grubu basliklari ("Bugun" / "Bu hafta") zaten yapiyor. */}
      {total > 0 && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setOnayAcik(true)}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
          >
            <Trash2 size={13} color="#94a3b8" />
            <Text style={styles.clearText}>{t('timeline.clearAll', 'Tümünü temizle')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {total === 0 ? (
        <View style={styles.emptyBox}>
          <Inbox size={28} color="#334155" />
          <Text style={styles.emptyTitle}>{t('timeline.emptyTitle', 'Bildirim kutun boş')}</Text>
          <Text style={styles.emptyText}>
            {t('timeline.emptyBody', 'Takip ettiğin dizilerin yeni bölümleri ve sosyal etkileşimler burada görünür.')}
          </Text>
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupTitle}>
              {t(GROUP_LABELS[group.id].key, GROUP_LABELS[group.id].fallback)}
            </Text>

            <View style={styles.card}>
              {group.entries.map((entry, index) => (
                <View key={entry.key}>
                  <SwipeToDelete
                    onDelete={() => handleDelete(entry)}
                    deleteLabel={t('timeline.delete', 'Sil')}
                  >
                    <TimelineRow entry={entry} />
                  </SwipeToDelete>
                  {index < group.entries.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      {/* ⛔ "Silmek için sola kaydır" İPUCU KALDIRILDI (kullanıcı kararı,
          2026-09-06): jest kendiliğinden keşfedilsin. Kalıcı bir talimat
          satırı, listenin altında sürekli duran ve bir kez okunduktan sonra
          hiçbir şey söylemeyen bir gürültüye dönüşüyordu. */}

      <ConfirmModal
        visible={onayAcik}
        icon={<Trash2 size={20} color="#f87171" />}
        title={t('timeline.clearConfirmTitle', 'Tümünü temizle?')}
        message={t('timeline.clearConfirmBody', 'Bildirim listesi boşaltılacak. Bu işlem geri alınamaz.')}
        confirmLabel={t('timeline.clearConfirm', 'Temizle')}
        cancelLabel={t('timeline.clearCancel', 'Vazgeç')}
        destructive
        onConfirm={handleClearAll}
        onCancel={() => setOnayAcik(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
  },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  clearText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },

  group: { gap: 8 },
  groupTitle: { color: '#64748b', fontSize: 12, fontWeight: '700', paddingHorizontal: 4 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },

  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 30,
    paddingHorizontal: 24,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '700', marginTop: 2 },
  emptyText: { color: '#64748b', fontSize: 12.5, textAlign: 'center', lineHeight: 18 },

});
