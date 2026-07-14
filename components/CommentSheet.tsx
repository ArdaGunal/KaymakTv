import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native';
import { X, AlertCircle } from 'lucide-react-native';
import { getMediaComments } from '../services/traktApi';

interface CommentSheetProps {
  visible: boolean;
  onClose: () => void;
  mediaId: number;
  mediaType: 'show' | 'movie' | 'episode';
  season?: number;
  episode?: number;
}

export default function CommentSheet({ visible, onClose, mediaId, mediaType, season, episode }: CommentSheetProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && mediaId) {
      fetchComments();
    }
  }, [visible, mediaId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await getMediaComments(mediaId, mediaType, 'likes', 1, 20, season, episode);
      setComments(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSpoiler = item.spoiler;
    const username = item.user?.username || 'Kullanıcı';
    const likes = item.likes || 0;
    const commentText = item.comment || '';

    return (
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          <Text style={styles.username}>{username}</Text>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            {isSpoiler && <Text style={styles.spoilerBadge}>SPOILER</Text>}
            <Text style={styles.likes}>♥ {likes}</Text>
          </View>
        </View>
        {isSpoiler ? (
          <View style={styles.spoilerBox}>
            <AlertCircle size={14} color="#facc15" />
            <Text style={styles.spoilerText}>Bu yorum spoiler içeriyor.</Text>
          </View>
        ) : (
          <Text style={styles.commentText}>{commentText}</Text>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Yorumlar ({comments.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          {loading ? (
             <ActivityIndicator style={{marginTop: 40}} color="#3b82f6" />
          ) : (
            <FlatList 
              data={comments}
              keyExtractor={(item, index) => item.id?.toString() || index.toString()}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.emptyText}>Bu bölüm için henüz yorum yok.</Text>}
            />
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#172033',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  commentCard: {
    backgroundColor: '#172033',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  username: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  likes: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  spoilerBadge: {
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  spoilerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1c1c1c',
    padding: 8,
    borderRadius: 6,
  },
  spoilerText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontStyle: 'italic',
  },
  commentText: {
    color: '#e5e5e5',
    lineHeight: 20,
  },
  emptyText: {
    color: '#a3a3a3',
    textAlign: 'center',
    marginTop: 20,
  },
});
