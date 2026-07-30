import React from 'react';
import { View, StyleSheet } from 'react-native';
import UserProfileCard from '../../feed/components/UserProfileCard';
import { TraktUserProfile } from '../../../services/api/social';
import { useFollowState, ConnectionState } from '../../../hooks/useFollowState';

interface NetworkUserCardProps {
  user: TraktUserProfile;
  initialConnectionState: ConnectionState;
}

export default function NetworkUserCard({ user, initialConnectionState }: NetworkUserCardProps) {
  const slug = user.ids?.slug || user.username;
  
  // skipFetch=true sayesinde arka planda her kart için getMyFollowingSlugs (Trakt API) çağrılmaz.
  // Gerekli initialState'i ana listeyi çeken ekran (network.tsx) sağlıyor.
  const { connectionState, isLoadingConnection, isFollowPending, toggleFollow } = useFollowState(
    slug,
    true, // skipFetch
    initialConnectionState
  );

  return (
    <View style={styles.cardWrapper}>
      <UserProfileCard
        profile={user}
        error={null}
        connectionState={connectionState}
        isLoadingConnection={isLoadingConnection}
        isFollowPending={isFollowPending}
        onToggleFollow={toggleFollow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
});
