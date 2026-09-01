import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Bug, RefreshCw, Copy } from '../icons';
import { useTranslation } from 'react-i18next';

interface DevPanelActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSendReport: () => void;
  onRefresh: () => void;
  onCopyReport: () => void;
}

export function DevPanelActionsModal({
  visible,
  onClose,
  onSendReport,
  onRefresh,
  onCopyReport,
}: DevPanelActionsModalProps) {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.indicator} />

              <Text style={styles.title}>
                {t('settings:devPanelActionsTitle', 'Geliştirici Eylemleri')}
              </Text>

              <TouchableOpacity
                style={styles.orangeActionItem}
                onPress={() => {
                  onClose();
                  onSendReport();
                }}
                activeOpacity={0.75}
              >
                <View style={styles.orangeIconWrap}>
                  <Bug size={18} color="#fb923c" />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.orangeActionText}>
                    {t('settings:devPanelSendReport', 'Teşhis Raporu Gönder')}
                  </Text>
                  <Text style={styles.actionSubText}>
                    {t('settings:devPanelSendReportSub', 'Hata & performans raporu oluştur')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onClose();
                  onRefresh();
                }}
                activeOpacity={0.75}
              >
                <View style={styles.iconWrap}>
                  <RefreshCw size={18} color="#60a5fa" />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.actionText}>
                    {t('settings:devPanelRefreshAction', 'Yenile')}
                  </Text>
                  <Text style={styles.actionSubText}>
                    {t('settings:devPanelRefreshSub', 'Ölçümleri ve logları tazele')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  onClose();
                  onCopyReport();
                }}
                activeOpacity={0.75}
              >
                <View style={styles.iconWrap}>
                  <Copy size={18} color="#a78bfa" />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.actionText}>
                    {t('settings:devPanelCopyReport', 'Raporu Kopyala')}
                  </Text>
                  <Text style={styles.actionSubText}>
                    {t('settings:devPanelCopySub', 'JSON formatında panoya kopyala')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelText}>{t('common:cancel', 'Vazgeç')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  indicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 6,
  },
  title: {
    color: '#8c90a0',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  orangeActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    padding: 12,
    borderRadius: 14,
  },
  orangeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orangeActionText: {
    color: '#fb923c',
    fontSize: 14.5,
    fontWeight: '700',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(27, 32, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 12,
    borderRadius: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
    gap: 2,
  },
  actionText: {
    color: '#f1f5f9',
    fontSize: 14.5,
    fontWeight: '600',
  },
  actionSubText: {
    color: '#8c90a0',
    fontSize: 11.5,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginTop: 2,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 13.5,
    fontWeight: '600',
  },
});
