import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { notify } from '../utils/confirmDialog';
import { X, Plus, Check, Folder } from './icons';
import { useLibrarySelector, useLibraryActions } from '../context/LibraryContext';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOBILE_PALETTE, nativeColor } from '../constants/mobilePalette';
import { styles } from './AddToListModal.styles';
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
  const native = Platform.OS !== 'web';

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
      notify(
        t('listLimitTitle', 'Liste Sınırı'),
        t('listLimitMsg', `Trakt hesabında en fazla ${MAX_USER_LISTS} liste oluşturabilirsin. Yeni liste için önce bir listeyi sil.`)
      );
      return true;
    }
    if (e instanceof ListLimitError && e.reason === 'maxItems') {
      notify(
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
      notify(t('common:error'), t('listNameTooLong', 'Liste adı en fazla 50 karakter olabilir.'));
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
        notify(t('common:error'), t('listCreateError', 'Liste oluşturulamadı.'));
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
        notify(t('common:error'), t('listAddError', 'Listeye eklenirken bir hata oluştu.'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const atListLimit = customLists.length >= MAX_USER_LISTS;

  return (
    <Modal visible={visible} animationType={native ? 'fade' : 'slide'} transparent onRequestClose={onClose} statusBarTranslucent={native}>
      <KeyboardAvoidingView behavior="padding" style={[styles.modalOverlay, native && styles.nativeOverlay]}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { paddingBottom: native ? 20 : Math.max(insets.bottom, 20) }, native && styles.nativeContent, !native && styles.modalContentWeb]}>
          {!native && <View style={styles.grabber} />}
          <View style={styles.header}>
            <Text style={[styles.title, native && styles.nativeTitle]}>{t('addToList', 'Listeye Ekle')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={native ? MOBILE_PALETTE.muted : nativeColor('muted', '#94a3b8')} size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView style={[styles.listContainer, native && styles.nativeListContainer]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {displayRows.map(row => {
              const isSelected = selectedListIds.has(row.id);
              const isDefault = row.name === DEFAULT_LIST_NAME;
              return (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.listRow, native && styles.nativeListRow, isSelected && (native ? styles.nativeListRowSelected : styles.listRowSelected)]}
                  onPress={() => toggleSelection(row.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.listIcon, isDefault && (native ? styles.nativeListIconDefault : styles.listIconDefault)]}>
                    <Folder size={16} color={native ? MOBILE_PALETTE.steel : (isDefault ? nativeColor('steel', '#60a5fa') : nativeColor('muted', '#94a3b8'))} />
                  </View>
                  <View style={styles.listInfo}>
                    <Text style={[styles.listName, native && styles.nativeListName]}>{row.name}</Text>
                    <Text style={[styles.listCount, native && styles.nativeListCount]}>
                      {row.virtual
                        ? t('defaultListHint', 'Varsayılan koleksiyonun')
                        : t('itemsCount', { count: row.itemCount, defaultValue: `${row.itemCount} içerik` })}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, native && styles.nativeCheckbox, isSelected && (native ? styles.nativeCheckboxSelected : styles.checkboxSelected)]}>
                    {isSelected && <Check color="#fff" size={15} strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {isCreating ? (
            <View style={styles.createContainer}>
              <TextInput
                style={[styles.input, native && styles.nativeInput]}
                placeholder={t('newListNamePH', 'Yeni liste adı...')}
                placeholderTextColor={native ? MOBILE_PALETTE.mutedDeep : nativeColor('mutedDeep', '#64748b')}
                selectionColor={native ? MOBILE_PALETTE.steel : undefined}
                value={newListName}
                onChangeText={setNewListName}
                maxLength={50}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity onPress={() => setIsCreating(false)} style={styles.cancelBtn}>
                  <Text style={[styles.cancelText, native && styles.nativeCancelText]}>{t('common:cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateList} style={[styles.smallSaveBtn, native && styles.nativeSaveBtn, (!newListName.trim() || isCreatingList) && styles.disabledBtn]} disabled={isCreatingList || !newListName.trim()}>
                  {isCreatingList ? <ActivityIndicator size="small" /> : <Text style={styles.smallSaveBtnText}>{t('create', 'Oluştur')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.newBtn, atListLimit && styles.disabledBtn]}
              onPress={() => (atListLimit ? showLimitError(new ListLimitError('maxLists')) : setIsCreating(true))}
              activeOpacity={0.7}
            >
              <Plus color={atListLimit ? nativeColor('mutedDeep', '#475569') : (native ? MOBILE_PALETTE.steel : nativeColor('primary', '#3b82f6'))} size={20} />
              <Text style={[styles.newBtnText, native && styles.nativeNewBtnText, atListLimit && { color: nativeColor('mutedDeep', '#475569') }]}>
                {t('createNewList', 'Yeni Liste Oluştur')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.applyBtn, native && styles.nativeSaveBtn, (isSaving || isCreating || selectedListIds.size === 0) && styles.disabledBtn]}
            onPress={handleSave}
            disabled={isSaving || isCreating || selectedListIds.size === 0}
          >
            {isSaving ? <ActivityIndicator size="small" /> : <Text style={styles.applyBtnText}>{t('common:save')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
