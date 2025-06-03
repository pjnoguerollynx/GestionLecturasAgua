import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Appbar, Card, Text, useTheme, Button, Portal, Modal, TextInput, SegmentedButtons, List, ActivityIndicator, Divider } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getMeterById } from '../database/meterRepository';
import { addIncident, getIncidentsByMeterId } from '../database/incidentRepository'; // Import getIncidentsByMeterId
import { getReadingsByMeterId } from '../database/readingRepository';
import { Meter, Incident, IncidentSeverity, IncidentStatus, Reading } from '../types/databaseModels';
import { useAuthStore } from '../store/authStore';
// @ts-ignore 
import { format } from 'date-fns';
// @ts-ignore - Esta línea será corregida o eliminada si la instalación es correcta
import { es } from 'date-fns/locale/es'; // Ruta corregida para el local español
// @ts-ignore - Esta línea será corregida o eliminada si la instalación es correcta
import { enUS } from 'date-fns/locale/en-US'; // Ruta corregida para el local inglés de EE. UU.

type MeterDetailScreenRouteProp = RouteProp<RootStackParamList, 'MeterDetail'>;
type MeterDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MeterDetail'>;

const MeterDetailScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<MeterDetailScreenNavigationProp>();
  const route = useRoute<MeterDetailScreenRouteProp>();
  const currentUser = useAuthStore((state) => state.user);
  const currentLocale = currentUser?.language === 'es' ? es : enUS;

  const { meterId, serialNumber } = route.params;

  const [meter, setMeter] = useState<Meter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessIssueType, setAccessIssueType] = useState('no_access');
  const [accessNotes, setAccessNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [relatedIncidents, setRelatedIncidents] = useState<Incident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [readingHistory, setReadingHistory] = useState<Reading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(false);

  const fetchMeterData = useCallback(async () => {
    setLoading(true);
    try {
      const meterData = await getMeterById(meterId);
      setMeter(meterData);
      if (meterData) {
        setLoadingIncidents(true);
        setLoadingReadings(true);
        try {
          const incidents = await getIncidentsByMeterId(meterData.id);
          setRelatedIncidents(incidents);
        } catch (error) {
          console.error('Error fetching related incidents:', error);
          Alert.alert(t('common.error'), t('meterDetailScreen.errorFetchingIncidents'));
        } finally {
          setLoadingIncidents(false);
        }

        try {
          const readings = await getReadingsByMeterId(meterData.id);
          setReadingHistory(readings);
        } catch (error) {
          console.error('Error fetching reading history:', error);
          Alert.alert(t('common.error'), 'Error fetching reading history');
        } finally {
          setLoadingReadings(false);
        }
      }
    } catch (error) {
      console.error('Error fetching meter:', error);
      Alert.alert(t('common.error'), t('meterDetailScreen.errorFetchingMeter'));
    } finally {
      setLoading(false);
    }
  }, [meterId, t]);

  useEffect(() => {
    fetchMeterData();
  }, [fetchMeterData]);

  const handleReportAccessIssue = () => {
    setShowAccessModal(true);
  };

  const handleSubmitAccessIssue = async () => {
    if (!meter) return;

    if (!currentUser?.id) {
      Alert.alert(t('common.error'), t('common.pleaseLogin')); 
      return;
    }

    setSubmitting(true);
    try {
      const incidentData: Omit<Incident, 'id' | 'syncStatus' | 'lastModified' | 'serverId' | 'version' | 'readingId'> = {
        meterId: meter.id,
        severity: accessIssueType === 'no_access' ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM,
        description: getAccessIssueDescription(accessIssueType),
        notes: accessNotes.trim() || undefined,
        status: IncidentStatus.OPEN, 
        incidentDate: Math.floor(Date.now() / 1000), 
        userId: currentUser.id, // Usar el ID del usuario actual del store
      };

      await addIncident(incidentData);
      
      Alert.alert(
        t('meterDetailScreen.accessIssueReported'),
        t('meterDetailScreen.accessIssueReportedMessage'),
        [{ text: t('common.ok'), onPress: () => setShowAccessModal(false) }]
      );
    } catch (error) {
      console.error('Error reporting access issue:', error);
      Alert.alert(
        t('common.error'),
        t('meterDetailScreen.accessIssueReportError'),
        [{ text: t('common.ok') }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getAccessIssueDescription = (type: string): string => {
    switch (type) {
      case 'no_access':
        return t('meterDetailScreen.accessIssues.noAccess');
      case 'locked_area':
        return t('meterDetailScreen.accessIssues.lockedArea');
      case 'dangerous_area':
        return t('meterDetailScreen.accessIssues.dangerousArea');
      case 'meter_damaged':
        return t('meterDetailScreen.accessIssues.meterDamaged');
      case 'other':
        return t('meterDetailScreen.accessIssues.other');
      default:
        return t('meterDetailScreen.accessIssues.noAccess');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating={true} size="large" />
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!meter) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text>{t('meterDetailScreen.meterNotFound')}</Text>
        <Button onPress={() => navigation.goBack()}>{t('common.goBack')}</Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header statusBarHeight={0}>
        {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.colors.onSurface} />}
        <Appbar.Content title={t('meterDetailScreen.title')} titleStyle={{color: theme.colors.onSurface}} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Title title={t('meterDetailScreen.meterInfo')} />
          <Card.Content>
            <Text variant="bodyLarge">{`${t('metersScreen.serialNumber')}: ${serialNumber}`}</Text>
            <Text variant="bodyMedium">{`${t('meterDetailScreen.meterIdLabel')}: ${meterId}`}</Text>
            {meter && (
              <>
                {meter.address && <Text variant="bodyMedium">{`${t('metersScreen.address')}: ${meter.address}`}</Text>}
                {meter.meterType && <Text variant="bodyMedium">{`${t('metersScreen.meterType')}: ${meter.meterType}`}</Text>}
                {meter.status && <Text variant="bodyMedium">{`${t('meterDetailScreen.status')}: ${meter.status}`}</Text>}
                {meter.installationDate && (
                  <Text variant="bodyMedium">{`${t('meterDetailScreen.installationDate')}: ${format(new Date(meter.installationDate * 1000), 'PPP', { locale: currentLocale })}`}</Text>
                )}
                {meter.notes && <Text variant="bodyMedium">{`${t('common.notes')}: ${meter.notes}`}</Text>}
                {meter.locationLatitude && meter.locationLongitude && (
                  <Text variant="bodyMedium">{`${t('meterDetailScreen.location')}: ${meter.locationLatitude}, ${meter.locationLongitude}`}</Text>
                )}
                <Text variant="bodySmall">{`${t('common.lastModified')}: ${format(new Date(meter.lastModified * 1000), 'Pp', { locale: currentLocale })}`}</Text>
                <Text variant="bodySmall">{`${t('common.syncStatus')}: ${t(`syncStatus.${meter.syncStatus}` as any, meter.syncStatus)}`}</Text>
              </>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title={t('meterDetailScreen.actions')} />
          <Card.Content>
            <Button
              mode="contained"
              onPress={() => {
                if (meter) {
                  navigation.navigate('CreateReading', { meterId: meter.id, serialNumber: meter.serialNumber });
                }
              }}
              style={styles.actionButton}
              icon="camera"
              disabled={!meter}
            >
              {t('meterDetailScreen.takeReading')}
            </Button>
            <Button
              mode="outlined"
              onPress={handleReportAccessIssue}
              style={styles.actionButton}
              icon="alert-octagon"
              disabled={!meter}
            >
              {t('meterDetailScreen.reportAccessIssue')}
            </Button>
          </Card.Content>
        </Card>

        {/* Placeholder for Related Incidents */}
        <Card style={styles.card}>
          <Card.Title title={t('meterDetailScreen.relatedIncidents')} />
          <Card.Content>
            {loadingIncidents ? (
              <ActivityIndicator animating={true} />
            ) : relatedIncidents.length > 0 ? (
              relatedIncidents.map((incident, index) => (
                <React.Fragment key={incident.id}>
                  <TouchableOpacity onPress={() => navigation.navigate('IncidentDetail', { incidentId: incident.id })}>
                    <List.Item
                      title={incident.description}
                      description={`${t('incidentDetailScreen.dateLabel')}: ${format(new Date(incident.incidentDate * 1000), 'P', { locale: currentLocale })} - ${t('incidentDetailScreen.statusLabel')}: ${t(`incidentStatus.${incident.status}`, incident.status)}`}
                      left={props => <List.Icon {...props} icon="alert-circle-outline" />}
                      titleNumberOfLines={2}
                      descriptionNumberOfLines={1}
                    />
                  </TouchableOpacity>
                  {index < relatedIncidents.length - 1 && <Divider />}
                </React.Fragment>
              ))
            ) : (
              <Text>{t('meterDetailScreen.noIncidentsFound')}</Text>
            )}
          </Card.Content>
        </Card>

        {/* Reading History */}
        <Card style={styles.card}>
          <Card.Title title={t('meterDetailScreen.readingsHistory')} />
          <Card.Content>
            {loadingReadings ? (
              <ActivityIndicator animating={true} />
            ) : readingHistory.length > 0 ? (
              readingHistory.slice(0, 10).map((reading, index) => (
                <React.Fragment key={reading.id}>
                  <List.Item
                    title={`${t('createReadingScreen.form.reading')}: ${reading.value}`}
                    description={
                      `${t('createReadingScreen.meterInfo.date')}: ${format(new Date(reading.readingDate * 1000), 'Pp', { locale: currentLocale })}` +
                      (reading.notes ? ` - ${reading.notes}` : '') +
                      (reading.latitude && reading.longitude ? ` - ${t('meterDetailScreen.location')}: ${reading.latitude.toFixed(6)}, ${reading.longitude.toFixed(6)}` : '') +
                      ` - ${t('common.syncStatus')}: ${t(`syncStatus.${reading.syncStatus}` as any, reading.syncStatus)}`
                    }
                    left={props => <List.Icon {...props} icon="water" />}
                    titleNumberOfLines={1}
                    descriptionNumberOfLines={3}
                  />
                  {index < Math.min(readingHistory.length, 10) - 1 && <Divider />}
                </React.Fragment>
              ))
            ) : (
              <Text>{t('meterDetailScreen.noReadingsFound')}</Text>
            )}
            {readingHistory.length > 10 && (
              <Button
                mode="text"
                onPress={() => {
                  // Future: Navigate to full reading history screen
                  Alert.alert(t('common.info'), 'Full reading history view coming soon');
                }}
                style={{ marginTop: 8 }}
              >
                {t('meterDetailScreen.viewAllReadings')} ({readingHistory.length})
              </Button>
            )}
          </Card.Content>
        </Card>

      </ScrollView>

      <Portal>
        <Modal
          visible={showAccessModal}
          onDismiss={() => setShowAccessModal(false)}
          contentContainerStyle={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="headlineSmall" style={styles.modalTitle}>
            {t('meterDetailScreen.reportAccessIssueTitle')}
          </Text>
          
          <Text variant="bodyMedium" style={styles.modalSubtitle}>
            {t('meterDetailScreen.selectAccessIssueType')}
          </Text>
          
          <SegmentedButtons
            value={accessIssueType}
            onValueChange={setAccessIssueType}
            buttons={[
              {
                value: 'no_access',
                label: t('meterDetailScreen.accessIssueTypes.noAccess'),
              },
              {
                value: 'locked_area',
                label: t('meterDetailScreen.accessIssueTypes.locked'),
              },
            ]}
            style={styles.segmentedButtons}
          />
          
          <SegmentedButtons
            value={accessIssueType}
            onValueChange={setAccessIssueType}
            buttons={[
              {
                value: 'dangerous_area',
                label: t('meterDetailScreen.accessIssueTypes.dangerous'),
              },
              {
                value: 'meter_damaged',
                label: t('meterDetailScreen.accessIssueTypes.damaged'),
              },
            ]}
            style={styles.segmentedButtons}
          />
          
          <Button
            mode={accessIssueType === 'other' ? 'contained' : 'outlined'}
            onPress={() => setAccessIssueType('other')}
            style={styles.otherButton}
          >
            {t('meterDetailScreen.accessIssueTypes.other')}
          </Button>

          <TextInput
            label={t('meterDetailScreen.additionalNotes')}
            value={accessNotes}
            onChangeText={setAccessNotes}
            multiline
            numberOfLines={3}
            style={styles.textInput}
            placeholder={t('meterDetailScreen.additionalNotesPlaceholder')}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowAccessModal(false)}
              style={styles.modalButton}
            >
              {t('common.cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmitAccessIssue}
              loading={submitting}
              disabled={submitting}
              style={styles.modalButton}
            >
              {t('common.submit')}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 8,
  },
  actionButton: {
    marginVertical: 8,
  },
  modalContainer: {
    backgroundColor: 'white', // Ensure theme.colors.surface or similar is used for dark mode compatibility
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalContent: {
    backgroundColor: 'white', // Default, will be overridden by theme.colors.surface
    padding: 20,
    margin: 30, // Provide some margin from screen edges
    borderRadius: 8,
  },
  modalTitle: {
    // fontSize: 18, // Replaced by variant="headlineSmall"
    marginBottom: 15,
    // color: theme.colors.onSurface // For dark mode - Handled by Text variant color
  },
  modalSubtitle: {
    marginBottom: 10,
    // color: theme.colors.onSurface // Handled by Text variant color
  },
  textInput: {
    marginBottom: 10,
    // backgroundColor: theme.colors.background, // For dark mode
    // color: theme.colors.onSurface // For dark mode
  },
  segmentedButtonsContainer: {
    marginBottom: 15,
  },
  segmentedButtons: {
    marginBottom: 10,
  },
  otherButton: {
    marginTop: 5, // Add some space if it's after segmented buttons
    marginBottom: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    marginLeft: 10,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    // backgroundColor: theme.colors.primary // For dark mode
  },
});

export default MeterDetailScreen;
