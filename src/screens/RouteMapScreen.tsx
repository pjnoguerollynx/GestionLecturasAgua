import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Alert, Dimensions, FlatList } from 'react-native';
import {
  Appbar,
  Card,
  Text,
  Button,
  FAB,
  Chip,
  ActivityIndicator,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../theme/ThemeContext';
import { Route, Meter } from '../types/databaseModels';
import { getRouteById } from '../database/routeRepository';
import { getMetersByRouteId } from '../database/routeMeterRepository';
import { getMeterById } from '../database/meterRepository';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

// --- TIPOS ---
type RootStackParamList = {
  RouteMap: { routeId: string };
  MeterDetail: { meterId: string };
};

type RouteMapScreenRouteProp = RouteProp<RootStackParamList, 'RouteMap'>;
type RouteMapScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface RoutePoint {
  meter: Meter;
  latitude: number;
  longitude: number;
  order: number;
}

// --- CONSTANTES ---
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// --- COMPONENTE ---
const RouteMapScreen: React.FC = () => {
  const route = useRoute<RouteMapScreenRouteProp>();
  const navigation = useNavigation<RouteMapScreenNavigationProp>();
  const { theme } = useTheme();
  const { routeId } = route.params;

  const mapRef = useRef<MapView>(null);

  // --- ESTADOS ---
  const [routeData, setRouteData] = useState<Route | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isFabOpen, setFabOpen] = useState(false);
    const [initialRegion] = useState({
    latitude: 40.416775, // Coordenada de fallback (Madrid, España)
    longitude: -3.70379,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });
  // --- FUNCIONES ---
  const loadData = async () => {
    try {
      setLoading(true);
      const routeInfo = await getRouteById(routeId);
      setRouteData(routeInfo);

      if (routeInfo) {
        const routeMeters = await getMetersByRouteId(routeId);
        const points: RoutePoint[] = [];

        for (const routeMeter of routeMeters) {
          const meter = await getMeterById(routeMeter.meterId);
          if (meter?.locationLatitude && meter?.locationLongitude) {
            points.push({
              meter,
              latitude: typeof meter.locationLatitude === 'string' ? parseFloat(meter.locationLatitude) : meter.locationLatitude,
              longitude: typeof meter.locationLongitude === 'string' ? parseFloat(meter.locationLongitude) : meter.locationLongitude,
              order: routeMeter.sequenceOrder || 0,
            });
          }
        }

        points.sort((a, b) => a.order - b.order);
        setRoutePoints(points);
      } else {
        console.warn('RouteMapScreen: Route not found:', routeId);
      }
    } catch (error) {
      console.error('RouteMapScreen: Error loading route data:', error);
      Alert.alert('Error', 'No se pudo cargar la información de la ruta');
    } finally {
      setLoading(false);
    }
  };

  // --- EFECTOS ---
  useEffect(() => {
    loadData();
  }, [routeId]);

  useEffect(() => {
    if (isMapReady && routePoints.length > 0) {
      const latitudes = routePoints.map(p => p.latitude);
      const longitudes = routePoints.map(p => p.longitude);
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);

      const region = {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(maxLat - minLat, LATITUDE_DELTA) * 1.5,
        longitudeDelta: Math.max(maxLng - minLng, LONGITUDE_DELTA) * 1.5,
      };

      mapRef.current?.animateToRegion(region, 1000);
    }  }, [isMapReady, routePoints]);

  // --- FUNCIONES ---
  const getMarkerColor = (meter: Meter, index: number) => {
    switch (meter.status?.toLowerCase()) {
      case 'active': return '#4CAF50';
      case 'inactive': return '#F44336';
      case 'maintenance': return '#FF9800';
      default: return '#2196F3';
    }
  };

  const handleMarkerPress = (point: RoutePoint) => {
    navigation.navigate('MeterDetail', { meterId: point.meter.id });
  };

  const optimizeRoute = () => {
    setShowOptimizeDialog(true);
  };

  const handleOptimizeConfirm = () => {
    const optimizedPoints = [...routePoints].sort((a, b) => {
      return a.latitude - b.latitude + a.longitude - b.longitude;
    });
    setRoutePoints(optimizedPoints);
    setShowOptimizeDialog(false);
    Alert.alert('Éxito', 'Ruta optimizada correctamente');
  };

  const getRouteStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return '#4CAF50';
      case 'in_progress': return '#FF9800';
      case 'pending': return '#2196F3';
      case 'cancelled': return '#F44336';
      default: return theme.colors.text;
    }
  };

  const getRouteStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'Completada';
      case 'in_progress': return 'En Progreso';
      case 'pending': return 'Pendiente';
      case 'cancelled': return 'Cancelada';
      default: return status || 'Desconocido';
    }
  };

  // --- VISTAS CONDICIONALES ---
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Cargando..." />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Cargando mapa de ruta...</Text>
        </View>
      </View>
    );
  }

  if (!routeData) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Error" />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ruta no encontrada</Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Volver
          </Button>
        </View>
      </View>
    );
  }

  // --- VISTA PRINCIPAL ---
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={routeData.name || 'Ruta'} />
        <Appbar.Action
          icon={viewMode === 'map' ? 'format-list-bulleted' : 'map'}
          onPress={() => setViewMode(prevMode => prevMode === 'map' ? 'list' : 'map')}
        />
        <Appbar.Action 
          icon="map-outline" 
          onPress={() => {
            const nextType = mapType === 'standard' ? 'satellite' : 
                             mapType === 'satellite' ? 'hybrid' : 'standard';
            setMapType(nextType);
          }}
        />
        <Appbar.Action icon="refresh" onPress={loadData} />
      </Appbar.Header>

      <Card style={styles.routeInfo}>
        <Card.Content>
          <View style={styles.routeHeader}>
            <View style={styles.routeDetails}>
              <Text variant="titleMedium">{routeData.name}</Text>
              <Text variant="bodySmall">{routeData.description}</Text>
            </View>
            <Chip 
              mode="outlined" 
              textStyle={{ color: getRouteStatusColor(routeData.status) }}
              style={{ borderColor: getRouteStatusColor(routeData.status) }}
            >
              {getRouteStatusText(routeData.status)}
            </Chip>
          </View>
          <View style={styles.routeStats}>
            <Text variant="bodySmall">
              Contadores: {routePoints.length} | 
              Distancia estimada: {(routePoints.length * 0.2).toFixed(1)} km
            </Text>
          </View>
        </Card.Content>
      </Card>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={initialRegion}
            onMapReady={() => setMapReady(true)}
            mapType={mapType}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {routePoints.map((point, index) => (
              <Marker
                key={`meter-${point.meter.id}-${index}`}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={`${index + 1}. ${point.meter.serialNumber}`}
                description={point.meter.address}
                onPress={() => handleMarkerPress(point)}
              >
                <View style={[styles.customMarker, { backgroundColor: getMarkerColor(point.meter, index) }]}>
                  <Text style={styles.markerNumber}>{index + 1}</Text>
                </View>
              </Marker>
            ))}
            
            {routePoints.length > 1 && (
              <Polyline
                coordinates={routePoints.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
                strokeColor="#2196F3"
                strokeWidth={3}
              />
            )}
          </MapView>
        </View>
      ) : (
        <FlatList
          data={routePoints}
          keyExtractor={(item) => item.meter.id.toString()}
          renderItem={({ item, index }) => (
            <Card style={styles.listItem} onPress={() => handleMarkerPress(item)}>
              <Card.Title
                title={`${index + 1}. ${item.meter.serialNumber}`}
                subtitle={`${item.meter.address} - ${item.meter.meterType}`}
                left={(props) => <Chip {...props} icon="water" style={{ backgroundColor: getMarkerColor(item.meter, index) }}>{index + 1}</Chip>}
              />
              <Card.Content>
                <Text variant="bodyMedium">Estado: {item.meter.status ?? 'Desconocido'}</Text>
              </Card.Content>
            </Card>
          )}
          contentContainerStyle={styles.listContentContainer}
        />
      )}

      <Portal>
        <FAB.Group
          open={isFabOpen}
          visible
          icon={isFabOpen ? 'close' : 'map-marker-path'}
          actions={[
            { icon: 'route', label: 'Optimizar Ruta', onPress: optimizeRoute },
            { icon: 'navigation', label: 'Iniciar Navegación', onPress: () => Alert.alert('Navegación', 'Función próximamente') },
            { icon: 'download', label: 'Descargar Offline', onPress: () => Alert.alert('Descarga', 'Función próximamente') },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          onPress={() => {
            if (isFabOpen) {
              // Acción al presionar el FAB principal cuando está abierto
            }
          }}
        />
      </Portal>

      <Portal>
        <Dialog visible={showOptimizeDialog} onDismiss={() => setShowOptimizeDialog(false)}>
          <Dialog.Title>Optimizar Ruta</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              ¿Deseas optimizar el orden de los contadores para minimizar la distancia de recorrido?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowOptimizeDialog(false)}>Cancelar</Button>
            <Button onPress={handleOptimizeConfirm}>Optimizar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

// --- ESTILOS ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginBottom: 20,
    textAlign: 'center',
  },
  routeInfo: {
    margin: 8,
    elevation: 2,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routeDetails: {
    flex: 1,
    marginRight: 12,
  },
  routeStats: {
    marginTop: 8,
  },
  mapContainer: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerNumber: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listItem: {
    marginHorizontal: 8,
    marginVertical: 4,
    elevation: 1,
  },
  listContentContainer: {
    paddingVertical: 8,
  },
});

export default RouteMapScreen;