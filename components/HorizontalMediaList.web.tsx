import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import MediaPoster from './MediaPoster';

interface HorizontalMediaListProps {
  title: string;
  titleIcon?: React.ReactNode;
  data: any[];
  onShowAll?: () => void;
  type?: 'show' | 'movie'; // Media tipini belirlemek için
}

export default function HorizontalMediaListWeb({ title, titleIcon, data, onShowAll, type = 'show' }: HorizontalMediaListProps) {
  const router = useRouter();

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {titleIcon && <View style={styles.iconContainer}>{titleIcon}</View>}
          <Text style={styles.title}>{title}</Text>
        </View>
        {onShowAll && (
          <div style={{ cursor: 'pointer', padding: 4 }} onClick={onShowAll}>
            <ChevronRight size={20} color="#a3a3a3" />
          </div>
        )}
      </View>

      <div className="media-scroll-container">
        {data.map((item, index) => {
          const traktId = item.rawTraktId || item.id || item.ids?.trakt || item.show?.ids?.trakt || item.movie?.ids?.trakt;
          const tmdbId = item.tmdbId || item.ids?.tmdb || item.show?.ids?.tmdb || item.movie?.ids?.tmdb || '';
          
          return (
            <div 
              key={`${traktId}-${index}`}
              className="media-card-hover"
              onClick={() => {
                if (traktId) {
                  router.push(`/${type}/${traktId}?tmdbId=${tmdbId}`);
                }
              }}
            >
              <MediaPoster 
                tmdbId={tmdbId} 
                type={type} 
                title={item.title || item.show?.title || item.movie?.title} 
                style={styles.poster} 
              />
            </div>
          );
        })}
      </div>
      
      <style>{`
        .media-scroll-container {
          display: flex;
          overflow-x: auto;
          gap: 16px;
          padding: 4px 16px 20px 16px;
          scroll-behavior: smooth;
        }
        .media-scroll-container::-webkit-scrollbar {
          height: 8px;
        }
        .media-scroll-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .media-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .media-scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .media-card-hover {
          flex: 0 0 auto;
          width: 150px;
          height: 225px;
          border-radius: 8px;
          overflow: hidden;
          background-color: #262626;
          cursor: pointer;
          transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .media-card-hover:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 10px 20px rgba(0,0,0,0.4);
          z-index: 10;
        }
        @media (max-width: 768px) {
          .media-card-hover {
             width: 120px;
             height: 180px;
          }
        }
      `}</style>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
});
