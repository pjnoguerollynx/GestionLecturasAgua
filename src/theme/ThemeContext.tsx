import React, { createContext, ReactNode, useContext, useState, useMemo, useCallback } from 'react';
import { AppTheme, DefaultAppTheme, AppThemeUpdates } from './theme'; // Import AppThemeUpdates
import { ThemeService } from '../services/themeService'; // Import ThemeService

// Update the context type definition to match what's provided
const ThemeContext = createContext<{
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  updateTheme: (updates: AppThemeUpdates) => void;
  loadAndApplyRemoteTheme: () => Promise<void>;
}>({
  theme: DefaultAppTheme,
  setTheme: () => {},
  updateTheme: () => {},
  loadAndApplyRemoteTheme: async () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: AppTheme;
}

// Create a hook for using the theme
export const useTheme = () => useContext(ThemeContext);

// Fix the ThemeProvider definition - this is the main issue
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialTheme }) => {
  const [theme, setThemeState] = useState<AppTheme>(initialTheme || DefaultAppTheme);

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  const updateTheme = useCallback((updates: AppThemeUpdates) => {
    setThemeState(prevTheme => {
      // Deep merge colors, then merge the rest of the updates
      const newColors = updates.colors 
        ? { ...prevTheme.colors, ...updates.colors } 
        : prevTheme.colors;

      return {
        ...prevTheme,
        ...updates,
        colors: newColors,
        // Explicitly handle LogoComponent to allow setting it to undefined if needed
        LogoComponent: updates.LogoComponent ?? prevTheme.LogoComponent,
      };
    });
  }, []);

  const loadAndApplyRemoteTheme = useCallback(async () => {
    console.log('ThemeContext: Attempting to load remote theme...');
    const remoteThemeConfig = await ThemeService.fetchRemoteThemeConfig();
    if (remoteThemeConfig) {
      console.log('ThemeContext: Remote theme config fetched, applying...', remoteThemeConfig);
      updateTheme(remoteThemeConfig);
    } else {
      console.log('ThemeContext: No remote theme config fetched or failed to fetch.');
    }
  }, [updateTheme]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ 
    theme, 
    setTheme, 
    updateTheme, 
    loadAndApplyRemoteTheme 
  }), [theme, updateTheme, loadAndApplyRemoteTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
