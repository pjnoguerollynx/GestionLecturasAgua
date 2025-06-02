import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  Appbar,
  Card,
  Avatar,
  Text as PaperText,
  useTheme as usePaperTheme,
  Menu,
  Divider,
} from 'react-native-paper';

interface MenuItemConfig {
  titleKey: string;
  screen: keyof RootStackParamList;
  accessibilityHintKey: string;
  icon: string;
  // Add a new property to hold a function that returns the metric value
  getMetric?: () => string | number | undefined; 
}

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Updated NavCard to include metric display
const NavCard = ({ title, icon, onPress, theme, metric, metricLabel }: { title: string; icon: string; onPress: () => void; theme: any; metric?: string | number; metricLabel?: string }) => (
  <Card style={[styles.navCard, { backgroundColor: theme.colors.surface }]} onPress={onPress} elevation={1}>
    <Card.Content style={styles.navCardContent}>
      <Avatar.Icon size={48} icon={icon} style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.onPrimaryContainer} />
      <PaperText variant="titleMedium" style={[styles.navCardTitle, { color: theme.colors.onSurface }]}>{title}</PaperText>
      {metric !== undefined && metricLabel && (
        <PaperText variant="bodySmall" style={{ color: theme.colors.secondary, marginTop: 4 }}>
          {`${metricLabel}: ${metric}`}
        </PaperText>
      )}
    </Card.Content>
  </Card>
);


const HomeScreen = () => {
  const { t } = useTranslation();
  const paperTheme = usePaperTheme();
  const { logout, user } = useAuthStore();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [menuVisible, setMenuVisible] = React.useState(false);
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  // Mock metric data - these would come from a store or service in a real app
  const pendingRoutesCount = 3; // Example
  const openIncidentsCount = 5; // Example
  const totalMetersCount = 120; // Example


  const menuItemsConfig: readonly MenuItemConfig[] = [
    { 
      titleKey: 'homeScreen.menuRoutes', 
      screen: 'Routes', 
      accessibilityHintKey: 'homeScreen.menuRoutesAccessHint', 
      icon: 'map-marker-path',
      getMetric: () => pendingRoutesCount, // Function to get pending routes count
    },
    { 
      titleKey: 'homeScreen.menuMeters', 
      screen: 'Meters', 
      accessibilityHintKey: 'homeScreen.menuMetersAccessHint', 
      icon: 'gauge',
      getMetric: () => totalMetersCount, // Function to get total meters count
    },
    { 
      titleKey: 'homeScreen.menuIncidents', 
      screen: 'Incidents', 
      accessibilityHintKey: 'homeScreen.menuIncidentsAccessHint', 
      icon: 'alert-octagon-outline',
      getMetric: () => openIncidentsCount, // Function to get open incidents count
    },
  ];

  const userImageUri = user?.profileImageUrl ?? null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: paperTheme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: paperTheme.colors.surface }} statusBarHeight={0} elevated>
        {userImageUri ? (
          <Avatar.Image size={36} source={{ uri: userImageUri }} style={styles.appbarAvatar} />
        ) : (
          <Avatar.Text size={36} label={user?.name?.substring(0, 1).toUpperCase() ?? 'A'} style={styles.appbarAvatar} />
        )}
        <Appbar.Content
          title={user ? `${t('homeScreen.welcomeSimple')}, ${user.name?.split(' ')[0]}` : t('homeScreen.title')}
          titleStyle={[styles.appbarTitle, { color: paperTheme.colors.onSurface }]}
        />
        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={<Appbar.Action icon="dots-vertical" onPress={openMenu} color={paperTheme.colors.onSurfaceVariant} />}>
          <Menu.Item onPress={() => { navigation.navigate('Settings'); closeMenu(); }} title={t('homeScreen.menuSettings')} />
          <Divider />
          <Menu.Item onPress={() => { logout(); closeMenu(); }} title={t('homeScreen.menuLogout')} />
        </Menu>
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        {/* User Greeting */}
        <View style={styles.greetingContainer}>
            <PaperText variant="headlineMedium" style={{color: paperTheme.colors.onBackground}}>{`${t('homeScreen.welcome')}, ${user?.name ?? t('common.guest')}!`}</PaperText>
            <PaperText variant="bodyMedium" style={{color: paperTheme.colors.onSurfaceVariant}}>{t('homeScreen.dashboardSubtitle')}</PaperText>
        </View>

        {/* Quick Navigation Section - Now main content */}
        <PaperText variant="titleLarge" style={[styles.sectionTitle, { color: paperTheme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }]}>{t('homeScreen.sectionQuickActions')}</PaperText>
        <View style={styles.navGrid}>
          {menuItemsConfig.map((item) => {
            const metricValue = item.getMetric ? item.getMetric() : undefined;
            let metricLabel = '';
            if (item.screen === 'Routes') metricLabel = t('homeScreen.metricPendingRoutes');
            else if (item.screen === 'Incidents') metricLabel = t('homeScreen.metricOpenIncidents');
            else if (item.screen === 'Meters') metricLabel = t('homeScreen.metricTotalMeters');

            return (
              <NavCard
                key={item.screen}
                title={t(item.titleKey)}
                icon={item.icon}
                onPress={() => navigation.navigate(item.screen, item.screen === 'Meters' || item.screen === 'Routes' || item.screen === 'Incidents' ? {} : undefined as any)}
                theme={paperTheme}
                metric={metricValue}
                metricLabel={metricLabel}
              />
            );
          })}
        </View>

        {/* Removed Charts Section and its Divider */}
        
      </ScrollView>
      {/* NetworkStatusIndicator will be rendered by App.tsx or a layout component */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  appbarAvatar: {
    marginLeft: 16,
    marginRight: 8,
  },
  appbarTitle: {
    fontSize: 20,
    fontWeight: '500',
  },
  scrollViewContainer: {
    paddingVertical: 24, // Increased padding
    paddingHorizontal: 16, // Added horizontal padding
  },
  greetingContainer: {
    paddingHorizontal: 4, // Adjusted from 20
    marginBottom: 24, // Increased margin
    alignItems: 'center', // Center greeting text
  },
  sectionTitle: {
    // marginLeft: 20, // Removed, using textAlign center for navGrid title
    marginBottom: 12,
    marginTop: 0, // Adjusted from 16
  },
  // Removed metricsGrid, metricCard, metricCardContent, metricTextContainer
  navGrid: {
    flexDirection: 'column', // Changed to column for larger buttons
    alignItems: 'center', // Center items in the column
    // marginHorizontal: 16, // Removed, handled by scrollViewContainer
    marginBottom: 8,
  },
  navCard: {
    width: '90%', // Make cards wider
    marginBottom: 20, // Increased spacing
    borderRadius: 16, // More rounded corners
  },
  navCardContent: {
    alignItems: 'center',
    paddingVertical: 24, // Increased padding
    paddingHorizontal: 16,
  },
  navCardTitle: {
    marginTop: 12, // Increased margin
    textAlign: 'center',
    fontSize: 18, // Larger font size
  },
  // Removed sectionDivider, chartWrapperCard, chartStyle
});

export default HomeScreen;
