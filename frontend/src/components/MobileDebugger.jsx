import React from 'react';
import { useDeviceDetect } from '../utils/deviceDetect';

/**
 * MobileDebugger - Shows device info for testing
 * Add this to any page to verify detection is working
 */
const MobileDebugger = () => {
  const device = useDeviceDetect();

  return (
    <div className="fixed bottom-2 left-2 z-50 bg-black/80 text-white text-xs p-2 rounded-lg font-mono">
      <div>📱 {device.isMobile ? 'Mobile' : device.isTablet ? 'Tablet' : 'Desktop'}</div>
      <div>🖐️ {device.isTouch ? 'Touch' : 'Mouse'}</div>
      <div>🍎 {device.isIOS ? 'iOS' : device.isAndroid ? 'Android' : 'Other OS'}</div>
      <div>📐 {device.width}x{device.height}</div>
    </div>
  );
};

export default MobileDebugger;
