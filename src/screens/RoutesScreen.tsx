import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getAllRoutes } from '../database/routeRepository';
import { Route } from '../types/databaseModels';
import { ActivityIndicator, Card, Text, Button, useTheme, List, Appbar, Icon } from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type RoutesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Routes'>;

const RouteLeftIcon = (props: { color: string; style?: any }) => <List.Icon {...props} icon="map-marker-distance" />;
const RouteRightIcon = (props: { color: string; style?: any }) => <List.Icon {...props} icon="chevron-right" />;
const EmptyStateListIcon = (props: { size: number; color: string }) => <Icon source="map-search-outline" size={props.size} color={props.color} />;

const RoutesScreen = () => {
  const { t } = useTranslation();
  const paperTheme = useTheme();
  const navigation = useNavigation<RoutesScreenNavigationProp>();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        setLoading(true);
        const fetchedRoutes = await getAllRoutes();
        setRoutes(fetchedRoutes);
      } catch (error) {
        console.error("Failed to fetch routes:", error);
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, []);

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
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
      marginVertical: 6,
    },
    cardContent: {
      paddingTop: 4,
      paddingBottom: 8,
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubText: {
      textAlign: 'center',
      marginBottom: 24,
    },
    button: {
      marginTop: 20,
      minWidth: 220,
    },
    buttonSecondary: {
      marginTop: 12,
    }
  });

  const renderRouteItem = ({ item }: { item: Route }) => (
    <Card
      style={[styles.card, { backgroundColor: paperTheme.colors.surface }]}
      onPress={() => {
        navigation.navigate('Meters', { params: { routeId: item.id, routeName: item.name ?? t('routesScreen.unnamedRoute') } });
      }}
      mode="elevated"
    >
      <Card.Title
        title={item.name ?? t('routesScreen.unnamedRoute')}
        subtitle={item.description ?? `${t('routesScreen.metersCount')}: ${item.meterCount ?? 0}`}
        titleStyle={{ color: paperTheme.colors.onSurface }}
        subtitleStyle={{ color: paperTheme.colors.onSurfaceVariant, fontSize: 14 }}
        left={(props) => <RouteLeftIcon {...props} color={paperTheme.colors.primary} />}
        right={(props) => <RouteRightIcon {...props} color={paperTheme.colors.onSurfaceVariant} />}
      />
      {(!!item.lastModified || !!item.status) && (
        <Card.Content style={styles.cardContent}>
          {item.status && (
            <Text variant="bodySmall" style={{ color: paperTheme.colors.secondary, fontWeight: 'bold' }}>
              {t('routesScreen.statusLabel')}: {t(`routeStatus.${item.status}`, { defaultValue: item.status })}
            </Text>
          )}
          {!!item.lastModified && (
            <Text variant="bodySmall" style={{ color: paperTheme.colors.onSurfaceVariant }}>
              {t('routesScreen.lastModified')}: {new Date(item.lastModified * 1000).toLocaleDateString()}
            </Text>
          )}
        </Card.Content>
      )}
      <Card.Actions>
        <Button 
          mode="outlined" 
          compact
          icon="map"
          onPress={() => navigation.navigate('RouteMap', { routeId: item.id })}
        >
          Ver en Mapa
        </Button>
        <Button 
          mode="contained" 
          compact
          icon="counter"
          onPress={() => navigation.navigate('Meters', { params: { routeId: item.id, routeName: item.name ?? t('routesScreen.unnamedRoute') } })}
        >
          Ver Contadores
        </Button>
      </Card.Actions>
    </Card>
  );

  const commonLoadingRoutes = t('common.loadingRoutes');
  const routesScreenTitle = t('routesScreen.title');

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: paperTheme.colors.background }]}>
        <Appbar.Header elevated style={{ backgroundColor: paperTheme.colors.surface }}>
          {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={paperTheme.colors.onSurface} />}
          <Appbar.Content title={routesScreenTitle} titleStyle={{ color: paperTheme.colors.onSurface }} />
        </Appbar.Header>
        <View style={styles.centered}>
          <ActivityIndicator animating={true} size="large" color={paperTheme.colors.primary} />
          <Text style={{ color: paperTheme.colors.onBackground, marginTop: 10 }} variant="bodyLarge">
            {commonLoadingRoutes}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: paperTheme.colors.background }]}>
      <Appbar.Header elevated style={{ backgroundColor: paperTheme.colors.surface }}>
        {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={paperTheme.colors.onSurface} />}
        <Appbar.Content title={routesScreenTitle} titleStyle={{ color: paperTheme.colors.onSurface }} />
      </Appbar.Header>
      {routes.length === 0 ? (
        <View style={styles.centered}>
          <EmptyStateListIcon size={80} color={paperTheme.colors.onSurfaceDisabled ?? paperTheme.colors.outline} />
          <Text style={[styles.emptyText, { color: paperTheme.colors.onSurfaceVariant }]} variant="headlineSmall">
            {t('routesScreen.noRoutesFound')}
          </Text>
          <Text style={[styles.emptySubText, { color: paperTheme.colors.onSurfaceVariant }]} variant="bodyLarge">
            {t('routesScreen.noRoutesFoundSubtitle')}
          </Text>
          <Button
            mode="contained"
            onPress={() => console.log("Attempt to create a new route or refresh")}
            style={styles.button}
            icon="plus-circle-outline"
          >
            {t('routesScreen.addRouteButton')}
          </Button>
          {navigation.canGoBack() && (
            <Button
              mode="text"
              onPress={() => navigation.goBack()}
              style={styles.buttonSecondary}
              icon="arrow-left"
              textColor={paperTheme.colors.primary}
            >
              {t('common.goBack')}
            </Button>
          )}
        </View>
      ) : (
        <FlatList
          data={routes}
          renderItem={renderRouteItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

export default RoutesScreen;
