import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Bump this when the project changes its preferred default so stale 'light'
// localStorage choices get reset once. Manual toggle after that is preserved.
const THEME_DEFAULT_VERSION = '2';

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedVersion = localStorage.getItem('theme_default_version');
    if (savedVersion !== THEME_DEFAULT_VERSION) {
      localStorage.setItem('theme_default_version', THEME_DEFAULT_VERSION);
      localStorage.setItem('theme', 'dark');
      return 'dark';
    }
    const saved = localStorage.getItem('theme');
    return saved || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
