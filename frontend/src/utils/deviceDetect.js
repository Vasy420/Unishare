import { useState, useEffect } from 'react';

export const useDeviceDetect = () => {
  const [device, setDevice] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isIOS: false,
    isAndroid: false,
    isTouch: false,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const userAgent = navigator.userAgent.toLowerCase();
      
      // Check touch support
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Screen size based detection
      const isMobile = width < 640;  // < sm breakpoint
      const isTablet = width >= 640 && width < 1024;  // sm to lg
      const isDesktop = width >= 1024;  // >= lg
      
      // OS detection
      const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroid = /android/.test(userAgent);
      
      setDevice({
        isMobile,
        isTablet,
        isDesktop,
        isIOS,
        isAndroid,
        isTouch,
        width,
        height,
      });
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);
    
    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return device;
};

// Simple check without hook
export const isMobileDevice = () => {
  return window.innerWidth < 640 || 
         'ontouchstart' in window || 
         navigator.maxTouchPoints > 0;
};

export const isIOSDevice = () => {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isAndroidDevice = () => {
  return /android/.test(navigator.userAgent.toLowerCase());
};
