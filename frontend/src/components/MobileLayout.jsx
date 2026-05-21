import React from 'react';
import { useDeviceDetect } from '../utils/deviceDetect';

/**
 * MobileLayout - Wrapper component that applies mobile-specific classes
 * Use this to wrap any component that needs mobile optimization
 */
const MobileLayout = ({ children, className = '' }) => {
  const { isMobile, isTouch, isIOS } = useDeviceDetect();

  const mobileClasses = isMobile 
    ? 'text-sm touch-manipulation select-none' 
    : 'text-base';
  
  const touchClasses = isTouch 
    ? 'cursor-pointer' 
    : '';
  
  const iosClasses = isIOS 
    ? 'ios-safe-area' 
    : '';

  return (
    <div className={`${mobileClasses} ${touchClasses} ${iosClasses} ${className}`}>
      {children}
    </div>
  );
};

/**
 * ResponsiveGrid - Grid that adapts to screen size
 */
export const ResponsiveGrid = ({ children, className = '' }) => {
  const { isMobile, isTablet } = useDeviceDetect();
  
  const gridCols = isMobile 
    ? 'grid-cols-1' 
    : isTablet 
    ? 'grid-cols-2' 
    : 'grid-cols-3';

  return (
    <div className={`grid gap-3 sm:gap-4 ${gridCols} ${className}`}>
      {children}
    </div>
  );
};

/**
 * MobileButton - Button with proper touch targets
 */
export const MobileButton = ({ children, onClick, className = '', ...props }) => {
  const { isTouch } = useDeviceDetect();
  
  const touchClasses = isTouch 
    ? 'min-h-[48px] min-w-[48px] active:scale-95' 
    : 'hover:opacity-80';

  return (
    <button 
      onClick={onClick}
      className={`${touchClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

/**
 * MobileText - Text that scales based on device
 */
export const MobileText = ({ children, size = 'base', className = '' }) => {
  const { isMobile } = useDeviceDetect();
  
  const sizeClasses = {
    xs: isMobile ? 'text-[10px]' : 'text-xs',
    sm: isMobile ? 'text-xs' : 'text-sm',
    base: isMobile ? 'text-sm' : 'text-base',
    lg: isMobile ? 'text-base' : 'text-lg',
    xl: isMobile ? 'text-lg' : 'text-xl',
  };

  return (
    <span className={`${sizeClasses[size] || sizeClasses.base} ${className}`}>
      {children}
    </span>
  );
};

export default MobileLayout;
