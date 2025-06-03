// filepath: c:\repo\GestionLecturasAgua\src\services\ocrService.ts
import TextRecognition, { TextRecognitionResult } from '@react-native-ml-kit/text-recognition';

export interface OCRResult {
  text: string;
  blocks: TextBlock[];
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface MeterReadingOCRResult {
  detectedNumber: string | null;
  confidence: number;
  allDetectedTexts: string[];
  suggestedReadings: string[];
}

/**
 * Extrae texto de una imagen usando OCR
 */
export const extractTextFromImage = async (imageUri: string): Promise<OCRResult> => {
  try {
    const result = await TextRecognition.recognize(imageUri);
    
    // Extraer texto de todos los bloques
    const allText = result.blocks
      .map(block => block.text)
      .join('\n');
    
    // Convertir bloques a nuestro formato
    const blocks: TextBlock[] = result.blocks.map(block => ({
      text: block.text,
      confidence: block.recognizedLanguages.length > 0 ? 0.8 : 0.5, // Estimación básica
      boundingBox: block.frame ? {
        x: block.frame.left,
        y: block.frame.top,
        width: block.frame.width,
        height: block.frame.height,
      } : undefined,
    }));
    
    return {
      text: allText,
      blocks: blocks
    };
  } catch (error) {
    console.error('Error en OCR:', error);
    throw new Error('Error al procesar la imagen');
  }
};

/**
 * Procesa el texto extraído para encontrar números de contador de agua
 */
export const extractMeterReading = (ocrText: string): MeterReadingOCRResult => {
  // Limpiar el texto y dividir en líneas
  const lines = ocrText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const allDetectedTexts = lines;
  const suggestedReadings: string[] = [];
  let bestReading: string | null = null;
  let bestConfidence = 0;

  // Patrones para detectar números de contador
  const patterns = [
    // Números con decimales típicos de contadores: 123.456, 1234.56, etc.
    /(\d{2,6}[.,]\d{1,3})/g,
    // Números enteros largos: 123456, 12345, etc.
    /(\d{4,8})/g,
    // Números con espacios: 123 456, 12 345, etc.
    /(\d{2,4}\s+\d{2,4})/g,
  ];

  for (const line of lines) {
    // Limpiar caracteres no numéricos excepto puntos, comas y espacios
    const cleanLine = line.replace(/[^\d.,\s]/g, '');
    
    for (const pattern of patterns) {
      const matches = cleanLine.match(pattern);
      
      if (matches) {
        for (const match of matches) {
          // Normalizar el número (reemplazar comas por puntos, eliminar espacios)
          const normalizedNumber = match
            .replace(/,/g, '.')
            .replace(/\s+/g, '');
          
          // Validar que sea un número válido para contador de agua
          const numericValue = parseFloat(normalizedNumber);
          
          if (!isNaN(numericValue) && numericValue > 0 && numericValue < 9999999) {
            // Calcular confianza basada en el patrón y posición
            let confidence = 0.5;
            
            // Mayor confianza para números con decimales
            if (normalizedNumber.includes('.')) {
              confidence += 0.3;
            }
            
            // Mayor confianza para números de longitud típica de contadores (4-7 dígitos)
            const digitCount = normalizedNumber.replace('.', '').length;
            if (digitCount >= 4 && digitCount <= 7) {
              confidence += 0.2;
            }
            
            // Añadir a sugerencias si no está duplicado
            if (!suggestedReadings.includes(normalizedNumber)) {
              suggestedReadings.push(normalizedNumber);
            }
            
            // Actualizar mejor lectura si tiene mayor confianza
            if (confidence > bestConfidence) {
              bestConfidence = confidence;
              bestReading = normalizedNumber;
            }
          }
        }
      }
    }
  }

  // Ordenar sugerencias por probabilidad (números con decimales primero)
  suggestedReadings.sort((a, b) => {
    const aHasDecimal = a.includes('.');
    const bHasDecimal = b.includes('.');
    
    if (aHasDecimal && !bHasDecimal) return -1;
    if (!aHasDecimal && bHasDecimal) return 1;
    
    // Si ambos tienen o no tienen decimales, ordenar por valor numérico descendente
    return parseFloat(b) - parseFloat(a);
  });

  return {
    detectedNumber: bestReading,
    confidence: bestConfidence,
    allDetectedTexts,
    suggestedReadings: suggestedReadings.slice(0, 5) // Máximo 5 sugerencias
  };
};

/**
 * Función principal para procesar una imagen y extraer lectura del contador
 */
export const processWaterMeterImage = async (imageUri: string): Promise<MeterReadingOCRResult> => {
  try {
    const ocrResult = await extractTextFromImage(imageUri);
    return extractMeterReading(ocrResult.text);
  } catch (error) {
    console.error('Error procesando imagen del contador:', error);
    throw error;
  }
};
