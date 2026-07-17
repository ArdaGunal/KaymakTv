import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { X, MessageSquare } from 'lucide-react-native';
import CommentItem from './comments/CommentItem';
import LoadingIndicator from './LoadingIndicator';
import { useComments } from '../hooks/useComments';

interface CommentSheetProps {
  visible: boolean;
  onClose: () => void;
  mediaId: number;
  mediaType: 'show' | 'movie' | 'episode';
  season?: number;
  episode?: number;
}

export default function CommentSheet({
  visible,
  onClose,
  mediaId,
  mediaType,
  season,
  episode,
}: CommentSheetProps) {
  const { comments, loading, loadingMore, error, totalCount, loadComments, loadMore } =
    useComments({ mediaId, mediaType, season, episode, sort: 'likes' });

  useEffect(() => {
    if (visible && mediaId) {
      loadComments();
    }
  }, [visible, mediaId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MessageSquare size={20} color="#60a5fa" />
              <Text style={styles.title}>
                Yorumlar
                {totalCount > 0 && (
                  <Text style={styles.count}> ({totalCount})</Text>
                )}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color="#94a3b8" size={22} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centerState}>
              <LoadingIndicator size="large" />
              <Text style={styles.stateText}>Yorumlar yükleniyor...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadComments} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item, index) =>
                item.id ? item.id.toString() : index.toString()
              }
              renderItem={({ item }) => <CommentItem item={item} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoader}>
                    <LoadingIndicator size="small" />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MessageSquare size={40} color="#1e293b" />
                  <Text style={styles.emptyTitle}>Henüz yorum yok</Text>
                  <Text style={styles.emptySubtitle}>
                    Bu içerik için ilk yorumu sen yapabilirsin.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '88%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' && {
      maxWidth: 680,
      alignSelf: 'center',
      width: '100%',
      borderRadius: 20,
      marginBottom: 40,
    } as any),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  count: {
    color: '#475569',
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 60,
  },
  stateText: {
    color: '#475569',
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  retryBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    color: '#475569',
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});
