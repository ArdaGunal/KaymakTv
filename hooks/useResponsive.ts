import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width } = useWindowDimensions();
  
  // Standard breakpoints
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 768; // For our purposes, anything >= 768 is "desktop/premium web"

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
  };
}
