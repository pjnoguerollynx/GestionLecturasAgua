import { DefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import AppLogo from '../components/AppLogo'; // Re-enable import
import { MD3LightTheme, MD3DarkTheme, adaptNavigationTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';

export interface AppThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  notification: string;
  // Custom colors
  accent: string;
  success: string; // Added for online status
  danger: string;  // Added for offline status
  warning: string;
  info: string;
  placeholder: string; // Added for placeholder text
  // Specific component colors (optional)
  buttonPrimaryBackground: string;
  buttonPrimaryText: string;
  inputBackground: string;
  inputText: string;
  inputBorder: string;
  // Colors for status or alerts
  onError: string; // Text color on error/danger backgrounds
}

export interface AppTheme {
  dark: boolean;
  colors: AppThemeColors;
  logoUrl?: string; // Can be a URL for remote logos
  LogoComponent?: React.FC<any>; // For local SVG or complex logo components
  name?: string; // Added name property
  // Add other theme properties like typography, spacing, logo paths, etc.
  // Example: typography: { fontFamily: string; fontSize: number };
}

// Add new interface for theme updates
export interface AppThemeUpdates {
  dark?: boolean;
  colors?: Partial<AppThemeColors>; // Allows partial updates to colors
  logoUrl?: string;
  LogoComponent?: React.FC<any>;
  // Include other properties from AppTheme that can be updated, as optional
}

export const DefaultAppThemeColors: AppThemeColors = {
  primary: '#007bff', // Blue
  secondary: '#6c757d', // Gray
  background: '#f8f9fa', // Light Gray
  card: '#ffffff', // White
  text: '#212529', // Dark Gray
  border: '#dee2e6', // Lighter Gray
  notification: '#dc3545', // Red (often used for notifications)
  accent: '#17a2b8', // Teal
  success: '#28a745', // Green
  danger: '#dc3545', // Red
  warning: '#ffc107', // Yellow
  info: '#17a2b8', // Teal
  placeholder: '#6c757d', // Added placeholder color (e.g., gray)
  buttonPrimaryBackground: '#007bff',
  buttonPrimaryText: '#ffffff',
  inputBackground: '#ffffff',
  inputText: '#495057',
  inputBorder: '#ced4da',
  onError: '#ffffff', // White text on danger backgrounds
};

export const DefaultAppTheme: AppTheme = {
  dark: false,
  colors: {
    ...DefaultAppThemeColors, 
    ...(MD3LightTheme.colors as any), 
    primary: DefaultAppThemeColors.primary, 
    accent: DefaultAppThemeColors.accent, 
    background: DefaultAppThemeColors.background,
    card: DefaultAppThemeColors.card,
    text: DefaultAppThemeColors.text,
    border: DefaultAppThemeColors.border,
    notification: DefaultAppThemeColors.notification,
    success: DefaultAppThemeColors.success,
    danger: DefaultAppThemeColors.danger,
    warning: DefaultAppThemeColors.warning,
    info: DefaultAppThemeColors.info,
    placeholder: DefaultAppThemeColors.placeholder,
    buttonPrimaryBackground: DefaultAppThemeColors.buttonPrimaryBackground,
    buttonPrimaryText: DefaultAppThemeColors.buttonPrimaryText,
    inputBackground: DefaultAppThemeColors.inputBackground,
    inputText: DefaultAppThemeColors.inputText,
    inputBorder: DefaultAppThemeColors.inputBorder,
    onError: DefaultAppThemeColors.onError,
  },
  LogoComponent: AppLogo, // Re-enable AppLogo
  name: 'default',
};

// Define Dark Theme Colors
export const DarkAppThemeColors: AppThemeColors = {
  primary: '#75b7ff', // Lighter Blue for dark mode
  secondary: '#adb5bd', // Lighter Gray
  background: '#121212', // Very Dark Gray/Black
  card: '#1e1e1e', // Dark Gray
  text: '#e0e0e0', // Light Gray
  border: '#2c2c2c', // Darker Gray
  notification: '#ff4d4f', // Bright Red
  accent: '#17a2b8', // Teal (can be same or adjusted)
  success: '#4caf50', // Green
  danger: '#f44336', // Red
  warning: '#ff9800', // Orange
  info: '#2196f3', // Blue
  placeholder: '#888888', // Medium Gray for placeholders
  buttonPrimaryBackground: '#75b7ff',
  buttonPrimaryText: '#000000',
  inputBackground: '#1e1e1e',
  inputText: '#e0e0e0',
  inputBorder: '#2c2c2c',
  onError: '#000000', // Black text on light danger backgrounds in dark mode, or light text if danger is dark
};

export const DarkAppTheme: AppTheme = {
  dark: true,
  colors: {
    ...DarkAppThemeColors, 
    ...(MD3DarkTheme.colors as any), 
    primary: DarkAppThemeColors.primary,
    accent: DarkAppThemeColors.accent,
    background: DarkAppThemeColors.background,
    card: DarkAppThemeColors.card,
    text: DarkAppThemeColors.text,
    border: DarkAppThemeColors.border,
    notification: DarkAppThemeColors.notification,
    success: DarkAppThemeColors.success,
    danger: DarkAppThemeColors.danger,
    warning: DarkAppThemeColors.warning,
    info: DarkAppThemeColors.info,
    placeholder: DarkAppThemeColors.placeholder,
    buttonPrimaryBackground: DarkAppThemeColors.buttonPrimaryBackground,
    buttonPrimaryText: DarkAppThemeColors.buttonPrimaryText,
    inputBackground: DarkAppThemeColors.inputBackground,
    inputText: DarkAppThemeColors.inputText,
    inputBorder: DarkAppThemeColors.inputBorder,
    onError: DarkAppThemeColors.onError,
  },
  LogoComponent: AppLogo, // Re-enable AppLogo
  name: 'dark',
};

// React Navigation Theme Integration
const { LightTheme: NavLightTheme, DarkTheme: NavDarkTheme } = adaptNavigationTheme({
  reactNavigationLight: DefaultTheme, // react-navigation's default light theme
  reactNavigationDark: NavigationDarkTheme,   // react-navigation's default dark theme
  materialLight: MD3LightTheme,     // react-native-paper's light theme
  materialDark: MD3DarkTheme,       // react-native-paper's dark theme
});

export { NavLightTheme, NavDarkTheme };

// Function to get the combined Paper theme based on AppTheme
export const getCombinedPaperTheme = (appTheme: AppTheme) => {
  return appTheme.dark ? {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      ...appTheme.colors, // Your custom colors override Paper's where they conflict
    },
  } : {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      ...appTheme.colors, // Your custom colors override Paper's where they conflict
    },
  };
};
