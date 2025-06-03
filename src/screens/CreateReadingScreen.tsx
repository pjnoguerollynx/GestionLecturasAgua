import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, Platform, Linking, PermissionsAndroid } from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  Card, 
  useTheme, 
  HelperText,
  IconButton
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { addReading } from '../database/readingRepository';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import uuid from 'react-native-uuid';
import { launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import OCRReadingComponent from '../components/OCRReadingComponent';

type CreateReadingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateReading'>;
type CreateReadingScreenRouteProp = RouteProp<RootStackParamList, 'CreateReading'>;

interface CreateReadingScreenProps {
  navigation: CreateReadingScreenNavigationProp;
  route: CreateReadingScreenRouteProp;
}

const CreateReadingScreen: React.FC<CreateReadingScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { meterId, serialNumber } = route.params;
  const { addToQueue } = useOfflineQueue();  const user = useAuthStore(state => state.user);

  // Form state
  const [reading, setReading] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  
  // Validation
  const [readingError, setReadingError] = useState('');
  const validateReading = (value: string): boolean => {
    if (!value.trim()) {
      setReadingError(t('createReadingScreen.validation.readingRequired'));
      return false;
    }
    
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0) {
      setReadingError(t('createReadingScreen.validation.invalidReading'));
      return false;
    }
    
    setReadingError('');
    return true;
  };

  // Camera permission handling
  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('createReadingScreen.camera.permissionTitle'),
            message: t('createReadingScreen.camera.permissionMessage'),
            buttonNeutral: t('common.cancel'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.warn('Camera permission error:', error);
        return false;
      }
    }
    return true; // For iOS, permissions are handled by Info.plist
  };

  // Camera functionality
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        t('createReadingScreen.camera.permissionTitle'),
        t('createReadingScreen.camera.permissionMessage'),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('createReadingScreen.camera.openSettings'),
            onPress: () => {
              Linking.openSettings();
            },
          },
        ]
      );
      return;
    }

    const options = {
      mediaType: 'photo' as MediaType,
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.7 as const,
      includeBase64: false,
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.errorCode) {
        console.log('Camera Error: ', response.errorMessage);
        Alert.alert(
          t('createReadingScreen.camera.errorTitle'),
          response.errorMessage ?? t('createReadingScreen.camera.errorMessage')
        );
      } else if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        setPhotoUri(response.assets[0].uri);
        setShowOCR(false); // Hide OCR when taking a new photo
      }
    });
  };

  const removePhoto = () => {
    Alert.alert(
      t('createReadingScreen.camera.removeTitle'),
      t('createReadingScreen.camera.removeMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setPhotoUri(null);
            setShowOCR(false);
          },
        },
      ]
    );
  };

  const handleOCRReading = (detectedReading: string) => {
    setReading(detectedReading);
    setShowOCR(false);
    if (readingError) {
      validateReading(detectedReading);
    }
  };

  const toggleOCR = () => {
    if (!photoUri) {
      Alert.alert(
        t('createReadingScreen.ocr.errorTitle'),
        'Primero debe tomar una foto para usar el análisis automático.'
      );
      return;
    }
    setShowOCR(!showOCR);
  };

  const handleSaveReading = async () => {
    if (!validateReading(reading)) {
      return;
    }

    if (!user) {
      Alert.alert(t('common.error'), t('createReadingScreen.errors.noUser'));
      return;
    }

    setIsLoading(true);
    
    try {
      const newReading = {
        id: uuid.v4(),
        meterId,
        value: parseFloat(reading),
        readingDate: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
        notes: notes.trim() || undefined,
        photoUri: photoUri ?? undefined,
        userId: user.id,
      };

      // Save to local database
      await addReading(newReading);

      // Add to offline queue for sync
      addToQueue({
        type: 'CREATE_READING',
        data: newReading,
        timestamp: Date.now(),
      });

      Alert.alert(
        t('common.success'),
        t('createReadingScreen.success.readingSaved'),
        [
          {
            text: t('common.ok'),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving reading:', error);
      Alert.alert(t('common.error'), t('createReadingScreen.errors.saveFailed'));    } finally {
      setIsLoading(false);
    }
  };
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.title}>
              {t('createReadingScreen.title')}
            </Text>
            
            <View style={styles.meterInfo}>
              <Text style={styles.meterLabel}>
                {t('createReadingScreen.meterInfo.serialNumber')}:
              </Text>
              <Text style={styles.meterValue}>{serialNumber}</Text>
            </View>

            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>
                {t('createReadingScreen.meterInfo.date')}:
              </Text>
              <Text style={styles.dateValue}>
                {format(new Date(), 'dd/MM/yyyy HH:mm')}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <TextInput
                label={t('createReadingScreen.form.reading')}
                value={reading}
                onChangeText={(text) => {
                  setReading(text);
                  if (readingError) {
                    validateReading(text);
                  }
                }}
                mode="outlined"
                keyboardType="numeric"                style={styles.input}
                error={!!readingError}
                right={
                  <TextInput.Icon 
                    icon="water"
                  />
                }
              />
              {readingError ? (
                <HelperText type="error" visible={!!readingError}>
                  {readingError}
                </HelperText>
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <TextInput
                label={t('createReadingScreen.form.notes')}
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.input}                placeholder={t('createReadingScreen.form.notesPlaceholder')}
              />
            </View>

            {/* Photo Section */}
            <View style={styles.formGroup}>
              <Text style={styles.sectionTitle}>
                {t('createReadingScreen.camera.title')}
              </Text>
              
              {photoUri ? (
                <View style={styles.photoContainer}>
                  <Image 
                    source={{ uri: photoUri }} 
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <View style={styles.photoActions}>
                    <IconButton
                      icon="camera"
                      mode="contained"
                      onPress={takePhoto}
                      style={styles.photoButton}
                    />
                    <IconButton
                      icon="text-recognition"
                      mode="contained"
                      onPress={toggleOCR}
                      style={[styles.photoButton, styles.ocrButton]}
                    />
                    <IconButton
                      icon="delete"
                      mode="contained"
                      onPress={removePhoto}
                      style={[styles.photoButton, styles.deleteButton]}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.noCameraContainer}>
                  <IconButton
                    icon="camera"
                    mode="contained"
                    size={40}
                    onPress={takePhoto}
                    style={styles.cameraButton}
                  />
                  <Text style={styles.cameraText}>
                    {t('createReadingScreen.camera.takePhoto')}
                  </Text>
                  <Text style={styles.cameraSubtext}>
                    {t('createReadingScreen.camera.optional')}
                  </Text>
                </View>
              )}
              
              {/* OCR Component */}
              {showOCR && photoUri && (
                <OCRReadingComponent
                  photoUri={photoUri}
                  onReadingSelected={handleOCRReading}
                  onClose={() => setShowOCR(false)}
                />
              )}
            </View>
          </Card.Content>
        </Card>

        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={[styles.button, styles.cancelButton]}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          
          <Button
            mode="contained"
            onPress={handleSaveReading}
            style={[styles.button, styles.saveButton]}
            loading={isLoading}
            disabled={isLoading || !reading.trim()}          >
            {t('createReadingScreen.form.saveReading')}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 20,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  meterInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  meterLabel: {
    fontWeight: 'bold',
    marginRight: 8,
  },
  meterValue: {
    flex: 1,
  },
  dateInfo: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dateLabel: {
    fontWeight: 'bold',
    marginRight: 8,
  },
  dateValue: {
    flex: 1,
  },  formGroup: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 0.48,
  },  cancelButton: {
    marginRight: 8,
  },
  saveButton: {
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  photoContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  photoButton: {
    margin: 4,
  },
  ocrButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  noCameraContainer: {
    alignItems: 'center',
    padding: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 8,
  },
  cameraButton: {
    marginBottom: 12,
  },
  cameraText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  cameraSubtext: {
    fontSize: 14,
    opacity: 0.7,
  },
});

export default CreateReadingScreen;
