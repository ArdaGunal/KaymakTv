import { useEffect, useState } from 'react';

/** Sayfa 40px'ten fazla kaydırılınca nav bar'ın arka planını koyulaştırır. */
export function useNavScrollStyle() {
  const [navStyle, setNavStyle] = useState({ background: 'rgba(14, 19, 29, 0.72)', borderBottom: '1px solid transparent' });

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setNavStyle({ background: 'rgba(14, 19, 29, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' });
      } else {
        setNavStyle({ background: 'rgba(14, 19, 29, 0.72)', borderBottom: '1px solid transparent' });
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return navStyle;
}

/**
 * .reveal sınıflı elemanlar görünüme girince .in-view ekleyip fade-in
 * animasyonunu tetikler.
 */
export function useScrollRevealObserver() {
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
