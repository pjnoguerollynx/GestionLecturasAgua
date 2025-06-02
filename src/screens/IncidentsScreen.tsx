import React, { useState, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Appbar, ActivityIndicator, Button, Card, Dialog, Portal, Text, useTheme, List, FAB, Chip } from 'react-native-paper';
import { Incident } from '../types/databaseModels';
import { getAllIncidents } from '../database/incidentRepository';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type IncidentsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Incidents'>;

const IncidentsScreen = () => {
  const { t } = useTranslation();
  const paperTheme = useTheme();
  const navigation = useNavigation<IncidentsScreenNavigationProp>();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const loadIncidents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setShowErrorDialog(false); // Ensure dialog is hidden on new load attempt
      const fetchedIncidents = await getAllIncidents();
      setIncidents(fetchedIncidents);
    } catch (e: any) {
      console.error('Failed to load incidents:', e);
      setError(t('incidentsScreen.loadError'));
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadIncidents();
    }, [loadIncidents])
  );

  const getSeverityColor = (severity: Incident['severity']) => {
    switch (severity) {
      case 'high':
        return {
          background: paperTheme.colors.errorContainer,
          text: paperTheme.colors.onErrorContainer,
        };
      case 'medium':
        return {
          background: paperTheme.colors.tertiaryContainer, // Or secondaryContainer if more appropriate
          text: paperTheme.colors.onTertiaryContainer,
        };
      case 'low':
      default:
        return {
          background: paperTheme.colors.secondaryContainer, // Or a less prominent color
          text: paperTheme.colors.onSecondaryContainer,
        };
    }
  };

  const getStatusColor = (status: Incident['status']) => {
    // Example: customize colors based on status
    switch (status) {
      case 'open':
        return {
          background: paperTheme.colors.surfaceVariant, // A neutral or attention-grabbing color for open issues
          text: paperTheme.colors.primary,
        };
      case 'resolved':
      case 'closed':
        return {
          background: paperTheme.colors.surfaceDisabled, // Muted for resolved/closed
          text: paperTheme.colors.onSurfaceDisabled,
        };
      default:
        return {
          background: paperTheme.colors.surfaceVariant,
          text: paperTheme.colors.onSurfaceVariant,
        };
    }
  };


  const renderIncidentItem = ({ item }: { item: Incident }) => {
    const severityColors = getSeverityColor(item.severity);
    const statusColors = getStatusColor(item.status);

    return (
    <Card
      style={[styles.card, { backgroundColor: paperTheme.colors.surface }]} // Use surface for cards
      onPress={() => navigation.navigate('IncidentDetail', { incidentId: item.id })}
      mode="elevated" // Consistent elevation
      accessibilityLabel={t('incidentsScreen.incidentCardAccessLabel', { description: item.description })}
      accessibilityHint={t('incidentsScreen.incidentCardAccessHint')}
    >
      <Card.Title
        title={item.description || t('incidentsScreen.noDescription')}
        titleNumberOfLines={2}
        subtitle={`${t('incidentsScreen.dateLabel')}: ${new Date(item.incidentDate * 1000).toLocaleDateString()}`}
        left={(props) => <List.Icon {...props} icon="alert-octagon-outline" color={severityColors.text} style={{backgroundColor: severityColors.background, borderRadius: 20}} />} // Icon reflecting severity
        titleStyle={[styles.cardTitle, { color: paperTheme.colors.onSurface }]}
        subtitleStyle={[styles.cardSubtitle, { color: paperTheme.colors.onSurfaceVariant }]}
      />
      <Card.Content>
        <View style={styles.chipRow}>
            <Chip 
              icon="tag-outline" 
              mode="flat" 
              style={[styles.chip, { backgroundColor: severityColors.background }]
              }
              textStyle={{color: severityColors.text}}
              accessibilityLabel={t('incidentsScreen.severityChipAccessLabel', { severity: t('incidentSeverity.' + item.severity) })}
            >
              {t('incidentSeverity.' + item.severity)}
            </Chip>
            <Chip 
              icon="list-status" 
              mode="flat" 
              style={[styles.chip, { backgroundColor: statusColors.background }]
              }
              textStyle={{color: statusColors.text}}
              accessibilityLabel={t('incidentsScreen.statusChipAccessLabel', { status: t('incidentStatus.' + item.status) })}
            >
              {t('incidentStatus.' + item.status)}
            </Chip>
        </View>
        {item.meterId && (
            <Text variant="bodySmall" style={[styles.meterIdText, {color: paperTheme.colors.onSurfaceVariant}]}>
                {t('incidentsScreen.meterIdLabel')}: {item.meterId}
            </Text>
        )}
         {item.routeId && (
            <Text variant="bodySmall" style={[styles.meterIdText, {color: paperTheme.colors.onSurfaceVariant}]}>
                {t('incidentsScreen.routeIdLabel')}: {item.routeId}
            </Text>
        )}
      </Card.Content>
    </Card>
  )};

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: paperTheme.colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator animating={true} size="large" color={paperTheme.colors.primary} />
          <Text style={{ color: paperTheme.colors.onBackground, marginTop: 10 }} variant="bodyLarge">
            {t('common.loadingIncidents')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: paperTheme.colors.background }]}>
      {incidents.length === 0 && !loading && !error ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: paperTheme.colors.onBackground }]} variant="headlineSmall">
            {t('incidentsScreen.noIncidents')}
          </Text>
          <Button
            mode="contained" // More prominent for primary action on empty screen
            onPress={loadIncidents}
            style={styles.button}
            icon="refresh"
            labelStyle={{color: paperTheme.colors.onPrimary}} // Ensure text color contrasts with button
            // accessibilityLabel={t('common.retry')} // Already good
          >
            {t('common.retry')}
          </Button>
          <Button
            mode="elevated" // Secondary action
            onPress={() => navigation.navigate('CreateIncident', {})}
            style={styles.button}
            icon="plus-circle-outline"
            // accessibilityLabel={t('incidentsScreen.addIncident')} // Already good
          >
            {t('incidentsScreen.addIncident')}
          </Button>
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={renderIncidentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContentContainer}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: paperTheme.colors.primaryContainer }]}
        onPress={() => navigation.navigate('CreateIncident', {})}
        color={paperTheme.colors.onPrimaryContainer}
        accessibilityLabel={t('incidentsScreen.addIncident')}
      />

      <Portal>
        <Dialog visible={showErrorDialog} onDismiss={() => setShowErrorDialog(false)} style={{backgroundColor: paperTheme.colors.surface}}>
          <Dialog.Icon icon="alert-circle-outline" size={48} color={paperTheme.colors.error} />
          <Dialog.Title style={[styles.dialogTitle, {color: paperTheme.colors.onSurface}]}>
            {t('incidentsScreen.loadErrorTitle')}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{color: paperTheme.colors.onSurfaceVariant}}>
              {error || t('incidentsScreen.loadErrorMessage')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { loadIncidents(); setShowErrorDialog(false); }} textColor={paperTheme.colors.primary}>{t('common.retry')}</Button>
            <Button onPress={() => setShowErrorDialog(false)} textColor={paperTheme.colors.secondary}>{t('common.ok')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    gap: 16, // Add gap for items in centered view
  },
  listContentContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  card: {
    marginHorizontal: 8,
    marginVertical: 6, // Adjusted vertical margin
    borderRadius: 12, // Consistent rounding
  },
  cardTitle: {
    // fontWeight: 'bold', // Use variant for this
    // fontSize: 16, // Use variant
  },
  cardSubtitle: {
    // fontSize: 12, // Use variant
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // Allow chips to wrap on smaller screens
    alignItems: 'center',
    marginTop: 8,
    gap: 8, // Add gap between chips
  },
  chip: {
    // marginRight: 8, // Replaced by gap in chipRow
    // marginBottom: 4, // Add some bottom margin if chips wrap
  },
  meterIdText: {
    marginTop: 8,
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 10, // Reduced margin as Button has its own
  },
  button: {
    marginTop: 10, // Adjusted margin
    minWidth: 220, // Ensure button is wide enough
  },
  fab: {
    position: 'absolute',
    margin: 16, // Keep general margin
    right: 16, // Explicitly set right
    bottom: 32, // Increase bottom margin
    borderRadius: 28, // Standard FAB rounding for react-native-paper v5+
  },
  // chipContainer: { // Removed as chips are now in Card.Content
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   marginRight: 16,
  // },
  dialogTitle: {
    textAlign: 'center',
    // fontSize: 18, // Use variant
    // fontWeight: 'bold', // Use variant
  }
});

export default IncidentsScreen;
