import { useEffect, useState } from 'react';

/** Sayfa 40px'ten fazla kaydırılınca nav bar'ın arka planını koyulaştırır. */
export function useNavScrollStyle() {
  const [navStyle, setNavStyle] = useState({ background: 'rgba(12, 29, 43, 0.72)', borderBottom: '1px solid transparent' });

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setNavStyle({ background: 'rgba(12, 29, 43, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' });
      } else {
        setNavStyle({ background: 'rgba(12, 29, 43, 0.72)', borderBottom: '1px solid transparent' });
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return navStyle;
}
