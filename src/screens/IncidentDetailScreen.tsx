import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, Linking, SafeAreaView } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Appbar,
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Portal,
  Text,
  useTheme,
  List,
  Divider,
} from 'react-native-paper';
import { Incident } from '../types/databaseModels';
import { getIncidentById } from '../database/incidentRepository';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type IncidentDetailScreenRouteProp = RouteProp<RootStackParamList, 'IncidentDetail'>;
type IncidentDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'IncidentDetail'>;

const DetailItem = ({ label, value, iconName, onPress, theme }: { label: string; value?: string | null | number; iconName?: string; onPress?: () => void; theme: any }) => {
  if (!value && value !== 0 && value !== '') return null; // Allow empty string to be displayed
  return (
    <List.Item
      title={value?.toString() ?? ''} // Ensure value is string for title, handle null/undefined
      description={label}
      left={props => iconName ? <List.Icon {...props} icon={iconName} color={theme.colors.primary} /> : null}
      onPress={onPress}
      titleStyle={{ color: theme.colors.onSurface, fontWeight: 'bold' }}
      descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
      style={styles.detailListItem}
      right={props => onPress ? <List.Icon {...props} icon="chevron-right" /> : null}
    />
  );
};

const IncidentDetailScreen = () => {
  const { t } = useTranslation();
  const paperTheme = useTheme();
  const route = useRoute<IncidentDetailScreenRouteProp>();
  const navigation = useNavigation<IncidentDetailScreenNavigationProp>();
  const { incidentId } = route.params;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const fetchIncidentDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedIncident = await getIncidentById(incidentId);
      if (fetchedIncident) {
        setIncident(fetchedIncident);
      } else {
        setError(t('incidentDetailScreen.notFound'));
        setShowErrorDialog(true);
      }
    } catch (e: any) {
      console.error('Failed to load incident details:', e);
      setError(t('incidentDetailScreen.loadError'));
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  }, [incidentId, t]);

  useEffect(() => {
    fetchIncidentDetails();
  }, [fetchIncidentDetails]);

  const openMap = (latitude?: number, longitude?: number) => {
    if (latitude && longitude) {
      const scheme = `geo:${latitude},${longitude}`;
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.canOpenURL(scheme)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(scheme);
          }
          // Try web fallback
          return Linking.openURL(url);
        })
        .catch(() => {
            Alert.alert(t('incidentDetailScreen.mapErrorTitle'), t('incidentDetailScreen.mapErrorMessage'));
        });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: paperTheme.colors.background }]}>
        <ActivityIndicator animating={true} size="large" color={paperTheme.colors.primary} />
        <Text style={{ color: paperTheme.colors.onBackground, marginTop: 10 }} variant="bodyLarge">
          {t('common.loadingIncidentDetails')}
        </Text>
      </SafeAreaView>
    );
  }

  if (error && !incident) { // Show error only if incident is also null
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: paperTheme.colors.background }]}>
        <Appbar.Header theme={{ colors: { primary: paperTheme.colors.surface } }} style={{ backgroundColor: paperTheme.colors.surface, width: '100%' }}>
            {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={paperTheme.colors.primary} />}
            <Appbar.Content title={t('incidentDetailScreen.title')} titleStyle={{color: paperTheme.colors.primary}}/>
        </Appbar.Header>
        <View style={styles.flexGrowCentered}>
            <Text style={[styles.errorText, { color: paperTheme.colors.error }]} variant="headlineSmall">
            {error ?? t('incidentDetailScreen.notFound')}
            </Text>
            <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
            {t('common.goBack')}
            </Button>
        </View>
        <Portal>
          <Dialog visible={showErrorDialog} onDismiss={() => setShowErrorDialog(false)}>
            <Dialog.Icon icon="alert-circle-outline" size={48} color={paperTheme.colors.error} />
            <Dialog.Title style={{textAlign: 'center', color: paperTheme.colors.error}}>
                {t('incidentDetailScreen.errorTitle')}
            </Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium" style={{color: paperTheme.colors.onSurface}}>
                {error ?? t('incidentDetailScreen.loadErrorMessage')}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowErrorDialog(false)}>{t('common.ok')}</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </SafeAreaView>
    );
  }

  // Ensure incident is not null before proceeding
  if (!incident) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: paperTheme.colors.background }]}>
         <Appbar.Header theme={{ colors: { primary: paperTheme.colors.surface } }} style={{ backgroundColor: paperTheme.colors.surface, width: '100%' }}>
            {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={paperTheme.colors.primary} />}
            <Appbar.Content title={t('incidentDetailScreen.title')} titleStyle={{color: paperTheme.colors.primary}}/>
        </Appbar.Header>
        <View style={styles.flexGrowCentered}>
            <Text style={{ color: paperTheme.colors.onBackground, marginTop: 10 }} variant="bodyLarge">
            {t('incidentDetailScreen.notFound')}
            </Text>
            <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                {t('common.goBack')}
            </Button>
        </View>
      </SafeAreaView>
    );
  }

  const incidentPhotos = incident.photos ? JSON.parse(incident.photos) as string[] : [];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: paperTheme.colors.background }]}>
      <Appbar.Header theme={{ colors: { primary: paperTheme.colors.surface } }} style={{ backgroundColor: paperTheme.colors.surface }}>
        {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={paperTheme.colors.primary} />}
        <Appbar.Content title={incident.description.substring(0,25) + (incident.description.length > 25 ? '...':'')} titleStyle={{color: paperTheme.colors.primary}}/>
        {/* Add Edit Button if needed */}
        {/* <Appbar.Action icon="pencil" onPress={() => console.log('Edit incident')} /> */}
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.card}>
            <Card.Title 
                title={t('incidentDetailScreen.mainDetails')}
                titleVariant="headlineSmall"
                titleStyle={{color: paperTheme.colors.primary}}
            />
            <Card.Content>
                <DetailItem theme={paperTheme} label={t('incidentsScreen.descriptionLabel')} value={incident.description} iconName="text-long" />
                <Divider />
                <DetailItem theme={paperTheme} label={t('incidentsScreen.dateLabel')} value={new Date(incident.incidentDate * 1000).toLocaleString()} iconName="calendar-clock" />
                <Divider />
                <DetailItem theme={paperTheme} label={t('incidentsScreen.severityLabel')} value={t(`incidentSeverity.${incident.severity}`)} iconName="alert-octagon-outline" />
                <Divider />
                <DetailItem theme={paperTheme} label={t('incidentsScreen.statusLabel')} value={t(`incidentStatus.${incident.status}`)} iconName="list-status" />
            </Card.Content>
        </Card>

        {(incident.meterId || incident.routeId || (incident.latitude && incident.longitude)) && (
            <Card style={styles.card}>
                <Card.Title
                    title={t('incidentDetailScreen.additionalInfo')}
                    titleVariant="titleLarge"
                    titleStyle={{color: paperTheme.colors.secondary}}
                />
                <Card.Content>
                    {incident.meterId && <><DetailItem theme={paperTheme} label={t('incidentDetailScreen.meterIdLabel')} value={incident.meterId} iconName="gauge" /><Divider /></>}
                    {incident.routeId && <><DetailItem theme={paperTheme} label={t('incidentDetailScreen.routeIdLabel')} value={incident.routeId} iconName="directions" /><Divider /></>}
                    {(incident.latitude && incident.longitude) && (
                        <DetailItem
                            theme={paperTheme}
                            label={t('incidentDetailScreen.locationLabel')}
                            value={`${incident.latitude?.toFixed(5)}, ${incident.longitude?.toFixed(5)}`}
                            iconName="map-marker-outline"
                            onPress={() => openMap(incident.latitude, incident.longitude)}
                        />
                    )}
                </Card.Content>
            </Card>
        )}

        {incident.notes && (
            <Card style={styles.card}>
                <Card.Title
                  title={t('incidentDetailScreen.notesLabel')}
                  left={(props) => <List.Icon {...props} icon="note-text-outline" color={paperTheme.colors.secondary} />}
                  titleVariant="titleLarge"
                  titleStyle={{color: paperTheme.colors.secondary, marginLeft: -10 }} // Adjust margin if icon makes title shift
                />
                <Card.Content>
                    <Text variant="bodyMedium" style={{color: paperTheme.colors.onSurfaceVariant}}>{incident.notes}</Text>
                </Card.Content>
            </Card>
        )}

        {incident.resolvedDate && (
            <Card style={styles.card}>
                 <Card.Title
                   title={t('incidentDetailScreen.resolutionDetails')}
                   left={(props) => <List.Icon {...props} icon="calendar-check-outline" color={paperTheme.colors.secondary} />}
                   titleVariant="titleLarge"
                   titleStyle={{color: paperTheme.colors.secondary, marginLeft: -10 }} // Adjust margin
                 />
                <Card.Content>
                    <DetailItem theme={paperTheme} label={t('incidentDetailScreen.resolvedDateLabel')} value={new Date(incident.resolvedDate * 1000).toLocaleString()} iconName="calendar-check" />
                </Card.Content>
            </Card>
        )}

        {incidentPhotos.length > 0 && (
          <Card style={styles.card}>
            <Card.Title
              title={t('incidentDetailScreen.photosLabel')}
              left={(props) => <List.Icon {...props} icon="image-multiple-outline" color={paperTheme.colors.secondary} />}
              titleVariant="titleLarge"
              titleStyle={{color: paperTheme.colors.secondary, marginLeft: -10 }} // Adjust margin
            />
            <Card.Content>
              {incidentPhotos.map((uri) => (
                <Image key={uri} source={{ uri }} style={[styles.image, {borderColor: paperTheme.colors.outline}]} resizeMode="contain" />
              ))}
            </Card.Content>
          </Card>
        )}

        <Button 
            mode="outlined" 
            onPress={() => navigation.goBack()} 
            style={styles.button}
            icon="arrow-left"
            textColor={paperTheme.colors.primary}
        >
            {t('common.goBack')}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

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
  flexGrowCentered: {
    flexGrow: 1, // Allows this view to take up space and center its content
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%', // Ensure it takes full width for centering
    padding: 20,
  },
  container: {
    padding: 8, // Reduced padding for ScrollView to allow cards to have their own margin
  },
  card: {
    marginHorizontal: 8,
    marginVertical: 6,
  },
  detailListItem: {
    paddingVertical: 4, // Reduced padding for denser list
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#e0e0e0', 
    borderWidth: 1,
  },
  button: {
    marginHorizontal: 16,
    marginVertical: 24,
  },
});

export default IncidentDetailScreen;
