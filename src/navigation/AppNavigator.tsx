import React from 'react';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RoutesScreen from '../screens/RoutesScreen';
import MetersScreen from '../screens/MetersScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import CreateIncidentScreen from '../screens/CreateIncidentScreen'; 
import IncidentDetailScreen from '../screens/IncidentDetailScreen'; 
import SettingsScreen from '../screens/SettingsScreen';
import MeterDetailScreen from '../screens/MeterDetailScreen'; 
import RouteMapScreen from '../screens/RouteMapScreen';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { useTheme as usePaperTheme } from 'react-native-paper';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Meters: { screen?: string; params?: any }; 
  Routes: { screen?: string; params?: any }; 
  Incidents: { screen?: string; params?: any }; 
  CreateIncident: { meterId?: string; readingId?: string }; 
  IncidentDetail: { incidentId: string };
  Settings: undefined;
  MeterDetail: { meterId: string; serialNumber: string }; 
  RouteMap: { routeId: string };
  // Add other screens here
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const paperTheme = usePaperTheme();

  const screenOptions: StackNavigationOptions = {
    headerStyle: {
      backgroundColor: paperTheme.colors.primary,
    },
    headerTintColor: paperTheme.colors.onPrimary,
    headerTitleStyle: {
      fontWeight: 'bold',
    },
  };

  return (
    <Stack.Navigator 
      initialRouteName={isAuthenticated ? "Home" : "Login"}
      screenOptions={screenOptions}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: t('homeScreen.title') }} />
          <Stack.Screen name="Routes" component={RoutesScreen} options={{ title: t('routesScreen.title') }} />
          <Stack.Screen name="Meters" component={MetersScreen} options={{ title: t('metersScreen.title') }} />
          <Stack.Screen name="Incidents" component={IncidentsScreen} options={{ title: t('incidentsScreen.title') }} />
          <Stack.Screen name="CreateIncident" component={CreateIncidentScreen} options={{ title: t('createIncidentScreen.title') }} />
          <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} options={{ title: t('incidentDetailScreen.title') }} />
          <Stack.Screen name="MeterDetail" component={MeterDetailScreen} options={{ title: t('meterDetailScreen.title') }} />
          <Stack.Screen 
            name="RouteMap" 
            component={RouteMapScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settingsScreen.title') }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
