import { useState, useEffect } from 'react';

export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
    isMobile: undefined,
    isTablet: undefined,
    isDesktop: undefined
  });

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setWindowSize({
        width,
        height,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}