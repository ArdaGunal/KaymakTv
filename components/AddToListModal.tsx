import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { X, Plus, Check } from 'lucide-react-native';
import { useLibrary } from '../context/LibraryContext';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingIndicator from './LoadingIndicator';

interface AddToListModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId: number;
  mediaType: 'show' | 'movie';
}

export default function AddToListModal({ visible, onClose, mediaId, mediaType }: AddToListModalProps) {
  const { customLists, createNewList, toggleMediaInList } = useLibrary();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  const [selectedListIds, setSelectedListIds] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // When modal opens, auto-select if there's exactly 1 list
  useEffect(() => {
    if (visible && customLists.length === 1) {
      setSelectedListIds(new Set([customLists[0].ids.trakt]));
    } else if (!visible) {
      setSelectedListIds(new Set());
      setIsCreating(false);
      setNewListName('');
    }
  }, [visible, customLists.length]);

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedListIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedListIds(newSet);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    if (newListName.length > 50) {
      Alert.alert(t('common:error'), 'Liste adı en fazla 50 karakter olabilir.');
      return;
    }
    
    setIsLoading(true);
    try {
      const newList = await createNewList(newListName.trim());
      setSelectedListIds(prev => {
        const newSet = new Set(prev);
        newSet.add(newList.ids.trakt);
        return newSet;
      });
      setNewListName('');
      setIsCreating(false);
    } catch (error) {
      Alert.alert(t('common:error'), 'Liste oluşturulamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (selectedListIds.size === 0) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      const promises = Array.from(selectedListIds).map(listId => 
        toggleMediaInList(listId, mediaId, mediaType, true)
      );
      await Promise.all(promises);
      Alert.alert(t('common:success'), 'Seçilen listelere eklendi.');
      onClose();
    } catch (error) {
      Alert.alert(t('common:error'), 'Listeye eklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }, Platform.OS === 'web' && { maxWidth: 400, margin: 'auto', borderRadius: 16 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Listeye Ekle</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listContainer} keyboardShouldPersistTaps="handled">
            {customLists.map(list => {
              const isSelected = selectedListIds.has(list.ids.trakt);
              return (
                <TouchableOpacity 
                  key={list.ids.trakt} 
                  style={[styles.listRow, isSelected && styles.listRowSelected]}
                  onPress={() => toggleSelection(list.ids.trakt)}
                  activeOpacity={0.7}
                >
                  <View style={styles.listInfo}>
                    <Text style={styles.listName}>{list.name}</Text>
                    <Text style={styles.listCount}>{list.item_count || 0} içerik</Text>
                  </View>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Check color="#fff" size={16} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {isCreating ? (
            <View style={styles.createContainer}>
              <TextInput
                style={styles.input}
                placeholder="Yeni Liste Adı..."
                placeholderTextColor="#a3a3a3"
                value={newListName}
                onChangeText={setNewListName}
                maxLength={50}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity onPress={() => setIsCreating(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>{t('common:cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateList} style={styles.saveBtn} disabled={isLoading || !newListName.trim()}>
                  {isLoading ? <LoadingIndicator size="small" /> : <Text style={styles.saveBtnText}>Oluştur</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.newBtn} onPress={() => setIsCreating(true)}>
              <Plus color="#3b82f6" size={20} />
              <Text style={styles.newBtnText}>Yeni Liste Oluştur</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.applyBtn} onPress={handleSave} disabled={isLoading || isCreating}>
            {isLoading && !isCreating ? (
              <LoadingIndicator />
            ) : (
              <Text style={styles.applyBtnText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  listContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  listRowSelected: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  listCount: {
    color: '#94a3b8',
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
    marginBottom: 16,
  },
  newBtnText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  createContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
