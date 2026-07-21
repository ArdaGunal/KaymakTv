import React from 'react';
import { useResponsive } from '../../../hooks/useResponsive';
import ProfileStatisticsMobile from '../../../screens/ProfileStatisticsMobile';
import ProfileStatisticsWeb from '../../../screens/ProfileStatisticsWeb';

export default function ProfileStatisticsRouteWeb() {
  const { isDesktop } = useResponsive();

  if (!isDesktop) return <ProfileStatisticsMobile />;
  return <ProfileStatisticsWeb />;
}
