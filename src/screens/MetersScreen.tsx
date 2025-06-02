import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getAllMeters, getMeterById } from '../database/meterRepository';
import { getMetersByRouteId } from '../database/routeMeterRepository'; // Cambiar nombre aquí
import { Meter } from '../types/databaseModels';
import { ActivityIndicator, Card, Text, Button, useTheme, List, Chip, Appbar, Icon, Searchbar, MD3Theme } from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

// Define prop types for the screen
type MetersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Meters'>;
type MetersScreenRouteProp = RouteProp<RootStackParamList, 'Meters'>;

// Function to generate styles, taking theme as an argument
const getStyles = (theme: MD3Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchbar: {
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: theme.colors.elevation.level2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  card: {
    marginHorizontal: 8,
    marginVertical: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 20,
    minWidth: 200,
  },
});

const MetersScreen = () => {
  const { t } = useTranslation();
  const paperTheme = useTheme();
  const navigation = useNavigation<MetersScreenNavigationProp>();
  const route = useRoute<MetersScreenRouteProp>();

  const styles = getStyles(paperTheme); // Generate styles using the current theme

  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  const routeId = route.params?.params?.routeId;
  const routeName = route.params?.params?.routeName;

  useEffect(() => {
    const fetchMeters = async () => {
      try {
        setLoading(true);
        let fetchedMetersData: Meter[] = [];
        if (routeId) {
          console.log(`MetersScreen: Fetching meters for routeId: ${routeId}`);
          const routeMeters = await getMetersByRouteId(routeId); // Cambiar nombre aquí también
          if (routeMeters && routeMeters.length > 0) {
            const meterPromises = routeMeters.map(rm => getMeterById(rm.meterId));
            const metersFromRoute = (await Promise.all(meterPromises)).filter(meter => meter !== null) as Meter[];
            fetchedMetersData = metersFromRoute;
          } else {
            console.log(`MetersScreen: No routeMeters found for routeId: ${routeId}`);
            fetchedMetersData = [];
          }
        } else {
          console.log("MetersScreen: Fetching all meters (no routeId provided).");
          fetchedMetersData = await getAllMeters();
        }
        setMeters(fetchedMetersData);
      } catch (error) {
        console.error("Failed to fetch meters:", error);
        setMeters([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMeters();
  }, [routeId]);

  const filteredMeters = useMemo(() => {
    if (!searchQuery) {
      return meters;
    }
    return meters.filter(meter => {
      const searchTerm = searchQuery.toLowerCase();
      return (
        meter.serialNumber?.toLowerCase().includes(searchTerm) ||
        meter.address?.toLowerCase().includes(searchTerm) ||
        meter.meterType?.toLowerCase().includes(searchTerm)
      );
    });
  }, [meters, searchQuery]);

  const renderMeterItem = ({ item }: { item: Meter }) => (
    <Card
      style={[styles.card, { backgroundColor: paperTheme.colors.surfaceVariant }]}
      onPress={() => {
        console.log("Navigate to meter details for:", item.id);
        navigation.navigate('MeterDetail', { meterId: item.id, serialNumber: item.serialNumber });
      }}
      mode="elevated"
    >
      <Card.Title
        title={`${t('metersScreen.serialNumber')}: ${item.serialNumber}`}
        titleStyle={{ color: paperTheme.colors.onSurfaceVariant }}
        subtitleStyle={{ color: paperTheme.colors.onSurfaceVariant, fontSize: 12 }}
        left={(props) => <List.Icon {...props} icon="gauge" color={paperTheme.colors.primary} />}
        right={(props) => item.status ? <Chip {...props} icon="tag" mode="flat" style={{ backgroundColor: paperTheme.colors.tertiaryContainer, marginRight: 16}} textStyle={{color: paperTheme.colors.onTertiaryContainer}}>{item.status}</Chip> : null}
      />
      <Card.Content>
        {item.address &&
          <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
            {t('metersScreen.address')}: {item.address}
          </Text>}
        {item.meterType &&
          <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
            {t('metersScreen.meterType')}: {item.meterType}
          </Text>}
        <Text variant="bodySmall" style={{ color: paperTheme.colors.onSurfaceVariant, marginTop: 4 }}>
          {t('metersScreen.lastModified')}: {new Date(item.lastModified * 1000).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );

  const screenTitle = routeId && routeName 
    ? t('metersScreen.routeMetersTitle', { routeName: routeName }) 
    : t('metersScreen.allMetersTitle');

  return (
    <SafeAreaView style={styles.safeArea}>
      <Appbar.Header
          style={{ backgroundColor: paperTheme.colors.surface }}
          statusBarHeight={0} // Assuming status bar is handled by SafeAreaView or elsewhere
      >
          {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={paperTheme.colors.onSurface} />}
          <Appbar.Content title={screenTitle} titleStyle={{color: paperTheme.colors.onSurface}} />
      </Appbar.Header>

      <Searchbar
        placeholder={t('metersScreen.searchPlaceholder')}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar} // Use styles from getStyles
        iconColor={paperTheme.colors.primary}
        inputStyle={{ color: paperTheme.colors.onSurface }}
        placeholderTextColor={paperTheme.colors.onSurfaceDisabled}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator animating={true} size="large" color={paperTheme.colors.primary} />
          <Text style={{ color: paperTheme.colors.onBackground, marginTop: 10 }} variant="bodyLarge">
            {t('common.loadingMeters')}
          </Text>
        </View>
      ) : filteredMeters.length === 0 ? (
        <View style={styles.centered}>
          <Icon source={searchQuery ? "magnify-close" : "clipboard-text-outline"} size={64} color={paperTheme.colors.onSurfaceDisabled} />
          <Text style={[styles.emptyText, { color: paperTheme.colors.onBackground, marginTop: 16 }]} variant="headlineSmall">
            {searchQuery 
              ? t('metersScreen.noMetersMatchSearch')
              : routeId
                ? t('metersScreen.noMetersFoundForRoute', { routeName: routeName || routeId })
                : t('metersScreen.noMetersFound')}
          </Text>
          {navigation.canGoBack() && !searchQuery &&
            <Button
              mode="contained"
              onPress={() => navigation.goBack()}
              style={styles.button}
              icon="arrow-left"
            >
              {t('common.goBack')}
            </Button>
          }
        </View>
      ) : (
        <FlatList
          data={filteredMeters}
          renderItem={renderMeterItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

export default MetersScreen;
