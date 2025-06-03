// filepath: c:\repo\GestionLecturasAgua\src\components\OCRReadingComponent.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  useTheme, 
  Chip,
  ActivityIndicator,
  IconButton
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { processWaterMeterImage, MeterReadingOCRResult } from '../services/ocrService';

interface OCRReadingComponentProps {
  photoUri: string;
  onReadingSelected: (reading: string) => void;
  onClose: () => void;
}

const OCRReadingComponent: React.FC<OCRReadingComponentProps> = ({
  photoUri,
  onReadingSelected,
  onClose
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<MeterReadingOCRResult | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);

  const processImage = async () => {
    setIsProcessing(true);
    try {
      const result = await processWaterMeterImage(photoUri);
      setOcrResult(result);
      setHasProcessed(true);
      
      // Si hay una lectura detectada automáticamente, mostrar sugerencia
      if (result.detectedNumber && result.confidence > 0.7) {
        Alert.alert(
          t('createReadingScreen.ocr.autoDetectedTitle'),
          t('createReadingScreen.ocr.autoDetectedMessage', { reading: result.detectedNumber }),
          [
            {
              text: t('common.cancel'),
              style: 'cancel',
            },
            {
              text: t('createReadingScreen.ocr.useReading'),
              onPress: () => onReadingSelected(result.detectedNumber!),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error en OCR:', error);
      Alert.alert(
        t('createReadingScreen.ocr.errorTitle'),
        t('createReadingScreen.ocr.errorMessage')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestionPress = (reading: string) => {
    Alert.alert(
      t('createReadingScreen.ocr.confirmTitle'),
      t('createReadingScreen.ocr.confirmMessage', { reading }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('createReadingScreen.ocr.useReading'),
          onPress: () => onReadingSelected(reading),
        },
      ]
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return theme.colors.primary;
    if (confidence > 0.6) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence > 0.8) return t('createReadingScreen.ocr.highConfidence');
    if (confidence > 0.6) return t('createReadingScreen.ocr.mediumConfidence');
    return t('createReadingScreen.ocr.lowConfidence');
  };

  return (
    <Card style={styles.container}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            {t('createReadingScreen.ocr.title')}
          </Text>
          <IconButton
            icon="close"
            onPress={onClose}
            size={20}
          />
        </View>

        {!hasProcessed && (
          <View style={styles.actionContainer}>
            <Text style={styles.description}>
              {t('createReadingScreen.ocr.description')}
            </Text>
            <Button
              mode="contained"
              onPress={processImage}
              loading={isProcessing}
              disabled={isProcessing}
              icon="text-recognition"
              style={styles.processButton}
            >
              {isProcessing 
                ? t('createReadingScreen.ocr.processing') 
                : t('createReadingScreen.ocr.analyzePhoto')
              }
            </Button>
          </View>
        )}

        {isProcessing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>
              {t('createReadingScreen.ocr.processingText')}
            </Text>
          </View>
        )}

        {hasProcessed && ocrResult && (
          <View style={styles.resultsContainer}>
            {ocrResult.detectedNumber && (
              <View style={styles.bestResultContainer}>
                <Text style={styles.bestResultLabel}>
                  {t('createReadingScreen.ocr.bestMatch')}:
                </Text>
                <Chip
                  icon="star"
                  onPress={() => handleSuggestionPress(ocrResult.detectedNumber!)}
                  style={[
                    styles.bestResultChip,
                    { backgroundColor: getConfidenceColor(ocrResult.confidence) }
                  ]}
                  textStyle={styles.bestResultText}
                  mode="flat"
                >
                  {ocrResult.detectedNumber} ({getConfidenceText(ocrResult.confidence)})
                </Chip>
              </View>
            )}

            {ocrResult.suggestedReadings.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>
                  {t('createReadingScreen.ocr.otherSuggestions')}:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.suggestionsRow}>                    {ocrResult.suggestedReadings
                      .filter(reading => reading !== ocrResult.detectedNumber)
                      .map((reading) => (
                        <Chip
                          key={`suggestion-${reading}`}
                          onPress={() => handleSuggestionPress(reading)}
                          style={styles.suggestionChip}
                          mode="outlined"
                        >
                          {reading}
                        </Chip>
                      ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {ocrResult.suggestedReadings.length === 0 && !ocrResult.detectedNumber && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>
                  {t('createReadingScreen.ocr.noNumbersDetected')}
                </Text>
                <Text style={styles.noResultsSubtext}>
                  {t('createReadingScreen.ocr.tryDifferentAngle')}
                </Text>
              </View>
            )}

            <View style={styles.actionsContainer}>
              <Button
                mode="outlined"
                onPress={processImage}
                icon="refresh"
                style={styles.retryButton}
              >
                {t('createReadingScreen.ocr.tryAgain')}
              </Button>
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  description: {
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  actionContainer: {
    alignItems: 'center',
  },
  processButton: {
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.8,
  },
  resultsContainer: {
    marginTop: 8,
  },
  bestResultContainer: {
    marginBottom: 16,
  },
  bestResultLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bestResultChip: {
    alignSelf: 'flex-start',
  },
  bestResultText: {
    color: 'white',
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    marginBottom: 16,
  },
  suggestionsLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestionChip: {
    marginRight: 8,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  noResultsSubtext: {
    opacity: 0.7,
    textAlign: 'center',
  },
  actionsContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 8,
  },
});

export default OCRReadingComponent;
