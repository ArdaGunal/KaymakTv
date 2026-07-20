import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { X, Plus, Check, Folder } from 'lucide-react-native';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingIndicator from './LoadingIndicator';
import {
  DEFAULT_LIST_NAME,
  MAX_USER_LISTS,
  MAX_LIST_ITEMS,
  ListLimitError,
  isDefaultList,
} from '../utils/listHelpers';

interface AddToListModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId: number;
  mediaType: 'show' | 'movie';
}

// Sanal "Koleksiyonum" satırının kimliği — henüz Trakt'ta yoksa kaydederken oluşturulur.
const VIRTUAL_DEFAULT_ID = '__virtual_default__';

export default function AddToListModal({ visible, onClose, mediaId, mediaType }: AddToListModalProps) {
  const customLists = useLibrarySelector(s => s.customLists);
  const { createNewList, toggleMediaInList, getOrCreateDefaultList } = useLibraryActions();
  const { t } = useTranslation(['media', 'common']);
  const insets = useSafeAreaInsets();

  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);

  const hasRealDefault = customLists.some((l: any) => isDefaultList(l?.name));
  // Görüntülenecek satırlar: gerçek "Koleksiyonum" yoksa en üste sanal bir tane ekle.
  const displayRows: { id: string; name: string; itemCount: number; virtual: boolean }[] = [
    ...(!hasRealDefault
      ? [{ id: VIRTUAL_DEFAULT_ID, name: DEFAULT_LIST_NAME, itemCount: 0, virtual: true }]
      : []),
    ...customLists.map((l: any) => ({
      id: String(l.ids.trakt),
      name: l.name,
      itemCount: l.item_count || 0,
      virtual: false,
    })),
  ];

  useEffect(() => {
    if (visible) {
      // Varsayılan olarak "Koleksiyonum" seçili gelsin (kullanıcının en olası tercihi).
      const real = customLists.find((l: any) => isDefaultList(l?.name));
      setSelectedListIds(new Set([real ? String(real.ids.trakt) : VIRTUAL_DEFAULT_ID]));
    } else {
      setSelectedListIds(new Set());
      setIsCreating(false);
      setNewListName('');
    }
  }, [visible, customLists.length]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedListIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedListIds(newSet);
  };

  const showLimitError = (e: unknown) => {
    if (e instanceof ListLimitError && e.reason === 'maxLists') {
      Alert.alert(
        t('listLimitTitle', 'Liste Sınırı'),
        t('listLimitMsg', `Trakt hesabında en fazla ${MAX_USER_LISTS} liste oluşturabilirsin. Yeni liste için önce bir listeyi sil.`)
      );
      return true;
    }
    if (e instanceof ListLimitError && e.reason === 'maxItems') {
      Alert.alert(
        t('listItemsLimitTitle', 'Liste Dolu'),
        t('listItemsLimitMsg', `Bir listede en fazla ${MAX_LIST_ITEMS} içerik olabilir.`)
      );
      return true;
    }
    return false;
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    if (name.length > 50) {
      Alert.alert(t('common:error'), t('listNameTooLong', 'Liste adı en fazla 50 karakter olabilir.'));
      return;
    }

    setIsCreatingList(true);
    try {
      const newList = await createNewList(name);
      setSelectedListIds(prev => new Set(prev).add(String(newList.ids.trakt)));
      setNewListName('');
      setIsCreating(false);
    } catch (error) {
      if (!showLimitError(error)) {
        Alert.alert(t('common:error'), t('listCreateError', 'Liste oluşturulamadı.'));
      }
    } finally {
      setIsCreatingList(false);
    }
  };

  const handleSave = async () => {
    if (selectedListIds.size === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      // Sanal varsayılan seçiliyse önce gerçek listeye çevir.
      const targetIds: number[] = [];
      for (const id of selectedListIds) {
        if (id === VIRTUAL_DEFAULT_ID) {
          const created = await getOrCreateDefaultList();
          targetIds.push(created.ids.trakt);
        } else {
          targetIds.push(Number(id));
        }
      }

      for (const listId of targetIds) {
        await toggleMediaInList(listId, mediaId, mediaType, true);
      }

      onClose();
    } catch (error) {
      if (!showLimitError(error)) {
        Alert.alert(t('common:error'), t('listAddError', 'Listeye eklenirken bir hata oluştu.'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const atListLimit = customLists.length >= MAX_USER_LISTS;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }, Platform.OS === 'web' && styles.modalContentWeb]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{t('addToList', 'Listeye Ekle')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color="#94a3b8" size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {displayRows.map(row => {
              const isSelected = selectedListIds.has(row.id);
              const isDefault = row.name === DEFAULT_LIST_NAME;
              return (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.listRow, isSelected && styles.listRowSelected]}
                  onPress={() => toggleSelection(row.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.listIcon, isDefault && styles.listIconDefault]}>
                    <Folder size={16} color={isDefault ? '#60a5fa' : '#94a3b8'} />
                  </View>
                  <View style={styles.listInfo}>
                    <Text style={styles.listName}>{row.name}</Text>
                    <Text style={styles.listCount}>
                      {row.virtual
                        ? t('defaultListHint', 'Varsayılan koleksiyonun')
                        : t('itemsCount', { count: row.itemCount, defaultValue: `${row.itemCount} içerik` })}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Check color="#fff" size={15} strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {isCreating ? (
            <View style={styles.createContainer}>
              <TextInput
                style={styles.input}
                placeholder={t('newListNamePH', 'Yeni liste adı...')}
                placeholderTextColor="#64748b"
                value={newListName}
                onChangeText={setNewListName}
                maxLength={50}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity onPress={() => setIsCreating(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>{t('common:cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateList} style={[styles.smallSaveBtn, (!newListName.trim() || isCreatingList) && styles.disabledBtn]} disabled={isCreatingList || !newListName.trim()}>
                  {isCreatingList ? <LoadingIndicator size="small" /> : <Text style={styles.smallSaveBtnText}>{t('create', 'Oluştur')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.newBtn, atListLimit && styles.disabledBtn]}
              onPress={() => (atListLimit ? showLimitError(new ListLimitError('maxLists')) : setIsCreating(true))}
              activeOpacity={0.7}
            >
              <Plus color={atListLimit ? '#475569' : '#3b82f6'} size={20} />
              <Text style={[styles.newBtnText, atListLimit && { color: '#475569' }]}>
                {t('createNewList', 'Yeni Liste Oluştur')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.applyBtn, (isSaving || selectedListIds.size === 0) && styles.disabledBtn]}
            onPress={handleSave}
            disabled={isSaving || isCreating || selectedListIds.size === 0}
          >
            {isSaving ? <LoadingIndicator /> : <Text style={styles.applyBtnText}>{t('common:save')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '82%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modalContentWeb: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    marginBottom: 24,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  listContainer: {
    maxHeight: 320,
    marginBottom: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  listRowSelected: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listIconDefault: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  listCount: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  newBtnText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  createContainer: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 15,
  },
  smallSaveBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 84,
    alignItems: 'center',
  },
  smallSaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
