import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, SafeAreaView, View, Image, PermissionsAndroid, Platform } from 'react-native'; // Added PermissionsAndroid, Platform
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Appbar,
  Button,
  TextInput,
  Text,
  useTheme,
  ActivityIndicator,
  SegmentedButtons,
  Dialog,
  Portal,
  HelperText,
  Card,
} from 'react-native-paper';
import { Incident, IncidentSeverity, IncidentStatus } from '../types/databaseModels';
import { addIncident } from '../database/incidentRepository';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
// import * as ImagePicker from 'expo-image-picker'; // Removed
// import * as Location from 'expo-location'; // Removed
import { launchCamera, launchImageLibrary } from 'react-native-image-picker'; // Added
import Geolocation from 'react-native-geolocation-service'; // Added

type CreateIncidentScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateIncident'>;

const CreateIncidentScreen = () => {
  const { t } = useTranslation();
  const paperTheme = useTheme();
  const navigation = useNavigation<CreateIncidentScreenNavigationProp>();

  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>(IncidentSeverity.LOW);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<any | null>(null); // { coords: { latitude: number, longitude: number } } | null
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);

  const [showDialog, setShowDialog] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogIsError, setDialogIsError] = useState(false);

  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('createIncidentScreen.cameraPermissionTitle'),
            message: t('createIncidentScreen.cameraPermissionMessage'),
            buttonNeutral: t('permissions.askMeLater'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // For iOS, permissions are handled by Info.plist
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: t('createIncidentScreen.locationPermissionTitle'),
            message: t('createIncidentScreen.locationPermissionMessage'),
            buttonNeutral: t('permissions.askMeLater'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // For iOS, permissions are handled by Info.plist
  };


  useEffect(() => {
    // Request permissions on mount, or handle it before specific actions
    // For simplicity, we can call these before pickImage and getCurrentLocation
  }, []);


  const pickImage = async () => {
    // const hasPermission = await requestCameraPermission(); // Permission already requested or handled by library
    // if (!hasPermission) {
    //   setDialogTitle(t(\'createIncidentScreen.permissionDeniedTitle\'));
    //   setDialogMessage(t(\'createIncidentScreen.cameraPermissionDenied\')); // This was for camera, adjust if using gallery specific
    //   setDialogIsError(true);
    //   setShowDialog(true);
    //   return;
    // }

    launchImageLibrary({
        mediaType: 'photo',
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.5,
        includeBase64: false,
      }, (response) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          console.log('ImagePicker Error: ', response.errorMessage);
          setDialogTitle(t('createIncidentScreen.imagePickerErrorTitle'));
          setDialogMessage(response.errorMessage || t('createIncidentScreen.imagePickerErrorMessageGeneral'));
          setDialogIsError(true);
          setShowDialog(true);
        } else if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
          setImageUri(response.assets[0].uri);
        }
      });
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setDialogTitle(t('createIncidentScreen.permissionDeniedTitle'));
      setDialogMessage(t('createIncidentScreen.cameraPermissionDenied'));
      setDialogIsError(true);
      setShowDialog(true);
      return;
    }

    launchCamera({
        mediaType: 'photo',
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.5,
        includeBase64: false,
      }, (response) => {
        if (response.didCancel) {
          console.log('User cancelled camera');
        } else if (response.errorCode) {
          console.log('Camera Error: ', response.errorMessage);
          setDialogTitle(t('createIncidentScreen.cameraErrorTitle'));
          setDialogMessage(response.errorMessage || t('createIncidentScreen.cameraErrorMessageGeneral'));
          setDialogIsError(true);
          setShowDialog(true);
        } else if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
          setImageUri(response.assets[0].uri);
        }
      });
  };


  const getCurrentLocation = async () => {
    setLocationErrorMsg(null);
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setLocationErrorMsg(t('createIncidentScreen.locationPermissionDenied'));
      setDialogTitle(t('createIncidentScreen.permissionDeniedTitle'));
      setDialogMessage(t('createIncidentScreen.locationPermissionDeniedSettings'));
      setDialogIsError(true);
      setShowDialog(true);
      return;
    }

    // Storing the original isSubmitting state is not necessary here
    // as Geolocation.getCurrentPosition is async and we manage isSubmitting
    // at the start and end of the broader operation if needed, or specifically for this.
    // For now, let's assume isSubmitting is primarily for the overall form submission.
    // If getCurrentLocation itself needs to show a loading state on its button,
    // we might need a separate loading state for location fetching.
    // The existing `isSubmitting && !location` on the button already handles this.

    try {
      // setIsSubmitting(true); // Only set this if the whole form is blocked during location fetch
      Geolocation.getCurrentPosition(
        (position) => {
          setLocation(position);
          // setIsSubmitting(false); // Correspondingly, only if set true above
        },
        (error) => {
          console.error("Location Error: ", error);
          setLocationErrorMsg(t('createIncidentScreen.locationError') + `: ${error.message}`);
          setDialogTitle(t('createIncidentScreen.locationErrorTitle'));
          setDialogMessage(t('createIncidentScreen.locationErrorMessage') + `: ${error.message}`);
          setDialogIsError(true);
          setShowDialog(true);
          // setIsSubmitting(false); // Correspondingly
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (error: any) { 
      console.error("Geolocation Setup Error: ", error);
      setLocationErrorMsg(t('createIncidentScreen.locationError'));
      setDialogTitle(t('createIncidentScreen.locationErrorTitle'));
      setDialogMessage(t('createIncidentScreen.locationErrorMessage') + (error.message ? `: ${error.message}` : ''));
      setDialogIsError(true);
      setShowDialog(true);
      // setIsSubmitting(false); // Correspondingly
    }
  };

  const handleSubmit = async () => {
    setDescriptionError(null);
    if (!description.trim()) {
      setDescriptionError(t('createIncidentScreen.descriptionRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Construct the incident data, ensuring all required fields for Omit are present
      const newIncidentData: Omit<Incident, 'id' | 'serverId' | 'syncStatus' | 'lastModified' | 'version'> = {
        meterId: undefined, // Or link to a meter if applicable
        routeId: undefined, // Or link to a route if applicable
        description,
        severity,
        status: IncidentStatus.PENDING,
        incidentDate: Math.floor(Date.now() / 1000),
        photos: imageUri ? JSON.stringify([imageUri]) : undefined,
        notes: '', // Default or gather from a field
        latitude: location ? location.coords.latitude : undefined,
        longitude: location ? location.coords.longitude : undefined,
        userId: undefined, // This should be populated with the actual logged-in user ID
        // resolvedDate is optional and not part of the Omit type for addIncident
      };
      await addIncident(newIncidentData);
      setDialogTitle(t('createIncidentScreen.successTitle'));
      setDialogMessage(t('createIncidentScreen.successMessage'));
      setDialogIsError(false);
      setShowDialog(true);
    } catch (error) {
      console.error('Failed to save incident:', error);
      setDialogTitle(t('createIncidentScreen.errorTitle'));
      setDialogMessage(t('createIncidentScreen.errorMessage'));
      setDialogIsError(true);
      setShowDialog(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const severityOptions = Object.values(IncidentSeverity).map(value => ({
    value,
    label: t(`incidentSeverity.${value}`),
    icon: value === IncidentSeverity.HIGH ? 'alert-octagon' : value === IncidentSeverity.MEDIUM ? 'alert' : 'information-outline',
  }));

  const handleDialogDismiss = () => {
    setShowDialog(false);
    if (!dialogIsError) {
        navigation.goBack();
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: paperTheme.colors.background }]}>
      <Appbar.Header theme={{ colors: { primary: paperTheme.colors.surface } }} style={{ backgroundColor: paperTheme.colors.surface }}>
        {navigation.canGoBack() && <Appbar.BackAction onPress={() => navigation.goBack()} color={paperTheme.colors.primary} />}
        <Appbar.Content title={t('createIncidentScreen.title')} titleStyle={{color: paperTheme.colors.primary}} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              mode="outlined"
              label={t('createIncidentScreen.descriptionLabel')}
              value={description}
              onChangeText={text => {
                setDescription(text);
                if (text.trim()) setDescriptionError(null);
              }}
              placeholder={t('createIncidentScreen.descriptionPlaceholder')}
              multiline
              numberOfLines={4}
              style={styles.input}
              error={!!descriptionError}
              theme={{ colors: { primary: paperTheme.colors.primary } }}
            />
            {descriptionError && <HelperText type="error" visible={!!descriptionError}>{descriptionError}</HelperText>}

            <Text variant="labelLarge" style={[styles.label, { color: paperTheme.colors.onSurfaceVariant }]}>{t('createIncidentScreen.severityLabel')}</Text>
            <SegmentedButtons
              value={severity}
              onValueChange={(value) => setSeverity(value as IncidentSeverity)}
              buttons={severityOptions}
              style={styles.segmentedButton}
              // theme={{ colors: { primary: paperTheme.colors.primary } }} // Use default theme primary
            />

            <Button 
                icon="map-marker-outline" 
                mode="elevated" // Changed to elevated for better visual hierarchy
                onPress={getCurrentLocation} 
                style={styles.button}
                // textColor={paperTheme.colors.primary} // Default text color for elevated button is fine
                disabled={isSubmitting && !location} // Keep disabled logic
            >
                {isSubmitting && !location ? <ActivityIndicator animating={true} color={paperTheme.colors.primary} /> : (location ? t('createIncidentScreen.refreshLocation') : t('createIncidentScreen.getLocation'))}
            </Button>
            {location && (
              <Text style={{ textAlign: 'center', marginVertical: 5, color: paperTheme.colors.onSurfaceVariant }}>
                {`${t('createIncidentScreen.latitudeLabel')}: ${location.coords.latitude.toFixed(5)}, ${t('createIncidentScreen.longitudeLabel')}: ${location.coords.longitude.toFixed(5)}`}
              </Text>
            )}
            {locationErrorMsg && (
              <HelperText type="error" visible={!!locationErrorMsg} style={{textAlign: 'center'}}>{locationErrorMsg}</HelperText>
            )}

            <View style={styles.imageButtonsContainer}>
              <Button 
                  icon="camera-outline" 
                  mode="elevated" // Changed to elevated
                  onPress={takePhoto} 
                  style={styles.imageButton}
                  // textColor={paperTheme.colors.primary}
              >
                  {t('createIncidentScreen.takePhoto')}
              </Button>
              <Button 
                  icon="image-multiple-outline" 
                  mode="elevated" // Changed to elevated
                  onPress={pickImage} 
                  style={styles.imageButton}
                  // textColor={paperTheme.colors.primary}
              >
                  {imageUri ? t('createIncidentScreen.changeImage') : t('createIncidentScreen.attachImage')}
              </Button>
            </View>
            {imageUri && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={[styles.imagePreview, {borderColor: paperTheme.colors.outline}]} />
                <Button 
                    icon="close-circle" 
                    onPress={() => setImageUri(null)} 
                    compact 
                    mode="elevated" 
                    style={styles.removeImageButton} 
                    buttonColor={paperTheme.colors.errorContainer} 
                    textColor={paperTheme.colors.onErrorContainer}
                >
                    {t('common.remove')}
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting && !!location} // Show loading on submit if location was fetched, otherwise handled by location button
          style={styles.submitButton}
          icon="content-save-outline"
          labelStyle={{fontSize: 16}}
        >
          {t('createIncidentScreen.submitButton')}
        </Button>

        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          disabled={isSubmitting}
          style={styles.cancelButton}
          textColor={paperTheme.colors.primary}
        >
          {t('common.cancel')}
        </Button>
      </ScrollView>

      <Portal>
        <Dialog 
            visible={showDialog} 
            onDismiss={handleDialogDismiss}
        >
          <Dialog.Icon 
            icon={dialogIsError ? "alert-circle" : "check-circle"} 
            size={48} 
            color={dialogIsError ? paperTheme.colors.error : paperTheme.colors.primary} 
          />
          <Dialog.Title style={{
            textAlign: 'center', 
            color: dialogIsError ? paperTheme.colors.error : paperTheme.colors.primary
          }}>
            {dialogTitle}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{color: paperTheme.colors.onSurface}}>{dialogMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDialogDismiss} textColor={paperTheme.colors.primary}>{t('common.ok')}</Button>
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
  container: {
    paddingHorizontal: 16, // Consistent horizontal padding
    paddingVertical: 8, // Reduced vertical padding for scrollview
  },
  card: {
    marginBottom: 16,
    // backgroundColor: paperTheme.colors.surfaceVariant, // Use surfaceVariant for cards - This will be applied in the component directly via theme
  },
  label: {
    marginTop: 12, // Adjusted margin
    marginBottom: 8,
    fontSize: 12, 
    // color: paperTheme.colors.onSurfaceVariant, // Ensure label color contrasts with card - This will be applied in the component directly via theme
  },
  input: {
    marginBottom: 12, // Adjusted margin
    // backgroundColor: paperTheme.colors.surface, // Ensure input fields have proper background - This will be applied in the component directly via theme
  },
  segmentedButton: {
    marginBottom: 16,
  },
  button: {
    marginVertical: 10, // Increased vertical margin for standalone buttons
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  imageButton: {
    flex: 1, // Make buttons take equal space
    marginHorizontal: 4, // Add some space between buttons
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  imagePreview: {
    width: '100%', // Make image preview responsive
    aspectRatio: 4 / 3, // Maintain aspect ratio
    borderRadius: 8,
    borderWidth: 1,
    // borderColor is now applied dynamically
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    // Removed fixed background/text color, let theme handle it or use specific props
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 8,
    // backgroundColor: paperTheme.colors.primary, // Use default for contained
  },
  cancelButton: {
    marginTop: 8,
    marginBottom: 16, // Add some bottom margin
    // borderColor: paperTheme.colors.primary, // Use default for outlined
  },
  activityIndicator: { // Added for consistency if needed elsewhere
    marginVertical: 20,
  }
});

export default CreateIncidentScreen;
