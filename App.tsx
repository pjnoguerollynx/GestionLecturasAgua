/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import 'react-native-gesture-handler'; // Ensure this is at the top
import React, { useEffect, useState } from 'react'; // Added useState
import { LogBox, View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n/i18n.config';
import { ThemeProvider as CustomThemeProvider, useTheme } from './src/theme/ThemeContext';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper'; // Ensure MD3 themes are imported
import AppNavigator from './src/navigation/AppNavigator';
import { openDatabase } from './src/services/databaseService'; // Import openDatabase
import { TestDataService } from './src/services/testDataService'; // Import TestDataService
import NetworkStatusIndicator from './src/components/NetworkStatusIndicator'; // Import NetworkStatusIndicator

LogBox.ignoreLogs(['RCTBridge required dispatch_sync to load RNGestureHandlerModule.']);
// Ensure the specific error is not ignored to help debugging
// LogBox.ignoreLogs(['Text strings must be rendered within a <Text> component.']);

const AppContent: React.FC = () => {
  // Only destructure what we need from useTheme to avoid issues with changed context
  const { theme } = useTheme(); 
  const [themeLoaded, setThemeLoaded] = React.useState(false);
  const [dbInitialized, setDbInitialized] = useState(false); // State for DB initialization

  useEffect(() => {
    const initApp = async () => {
      try {
        await openDatabase(); // Initialize database
        setDbInitialized(true);
        console.log("Database initialized successfully from App.tsx");
        
        // Populate test data AFTER setting dbInitialized to true
        // This way the app loads even if test data fails
        try {
          await TestDataService.populateTestData();
        } catch (testDataError) {
          console.warn("Test data population failed, but app will continue:", testDataError);
        }
        
      } catch (error) {
        console.error("Failed to initialize database from App.tsx", error);
        // Handle DB initialization error (e.g., show an error message)
      }
      // Theme initialization can proceed regardless of DB for now, or be chained
      setThemeLoaded(true); 
    };
    initApp();
  }, []);

  if (!themeLoaded || !dbInitialized) { // Wait for both theme and DB
    return (
      <View style={styles.container}>
        <Text>Cargando Aplicación...</Text>
      </View>
    ); 
  }

  const currentNavigationTheme = theme.dark ? NavigationDarkTheme : NavigationDefaultTheme;
  
  // Reinstated PaperProvider theme logic
  const basePaperTheme = theme.dark ? MD3DarkTheme : MD3LightTheme;
  const currentPaperProviderTheme = {
    ...basePaperTheme, 
    colors: {
      ...basePaperTheme.colors,
      ...theme.colors, 
    },
  };

  // MODIFIED: Reintroduce PaperProvider
  return (
    <PaperProvider theme={currentPaperProviderTheme}>
      <NavigationContainer theme={currentNavigationTheme}>
        <AppNavigator />
        {/* NetworkStatusIndicator was here, moved to App component */}
      </NavigationContainer>
    </PaperProvider>
  );
};

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <CustomThemeProvider>
          <AppContent />
          <NetworkStatusIndicator /> 
        </CustomThemeProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // lightText and darkText might be unused, can be cleaned up later
  lightText: { 
    color: '#000000',
  },
  darkText: { 
    color: '#FFFFFF',
  },
});

export default App;
