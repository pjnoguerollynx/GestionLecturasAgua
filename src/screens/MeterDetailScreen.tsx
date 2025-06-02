import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Appbar, Card, Text, useTheme, Button, Portal, Modal, TextInput, SegmentedButtons, FAB } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getMeterById } from '../database/meterRepository';
import { addIncident } from '../database/incidentRepository';
import { Meter, Incident, IncidentSeverity, IncidentStatus } from '../types/databaseModels';
import { useAuthStore } from '../store/authStore'; // Importar el store de autenticación

type MeterDetailScreenRouteProp = RouteProp<RootStackParamList, 'MeterDetail'>;
type MeterDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MeterDetail'>;

const MeterDetailScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<MeterDetailScreenNavigationProp>();
  const route = useRoute<MeterDetailScreenRouteProp>();
  const currentUser = useAuthStore((state) => state.user); // Obtener el usuario del store


  const { meterId, serialNumber } = route.params;

  const [meter, setMeter] = useState<Meter | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessIssueType, setAccessIssueType] = useState('no_access');
  const [accessNotes, setAccessNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchMeter = async () => {
      try {
        const meterData = await getMeterById(meterId);
        setMeter(meterData);
      } catch (error) {
        console.error('Error fetching meter:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeter();
  }, [meterId]);

  const handleReportAccessIssue = () => {
    setShowAccessModal(true);
  };

  const handleSubmitAccessIssue = async () => {
    if (!meter) return;

    if (!currentUser || !currentUser.id) {
      Alert.alert(t('common.error'), t('common.pleaseLogin')); 
      return;
    }

    setSubmitting(true);
    try {
      const incidentData: Omit<Incident, 'id' | 'syncStatus' | 'lastModified' | 'serverId' | 'version'> = {
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
        <Text>{t('common.loading')}</Text>
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
                  <Text variant="bodyMedium">
                    {`${t('meterDetailScreen.installationDate')}: ${new Date(meter.installationDate * 1000).toLocaleDateString()}`}
                  </Text>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title={t('meterDetailScreen.actions')} />
          <Card.Content>
            <Button
              mode="outlined"
              onPress={() => {/* TODO: Navigate to reading screen */}}
              style={styles.actionButton}
              icon="clipboard-text"
            >
              {t('meterDetailScreen.takeReading')}
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleReportAccessIssue}
              style={styles.actionButton}
              icon="alert-circle"
              buttonColor={theme.colors.errorContainer}
              textColor={theme.colors.onErrorContainer}
            >
              {t('meterDetailScreen.reportAccessIssue')}
            </Button>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
  actionButton: {
    marginVertical: 4,
  },
  modalContent: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  modalSubtitle: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  otherButton: {
    marginBottom: 16,
  },
  textInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});

export default MeterDetailScreen;
