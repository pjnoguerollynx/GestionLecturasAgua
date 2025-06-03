import { useCallback } from 'react';
import { addOperationToQueue } from '../database/offlineQueueRepository';
import { OfflineOperationType } from '../types/databaseModels';

interface QueueOperation {
  type: OfflineOperationType;
  data: any;
  timestamp: number;
}

export const useOfflineQueue = () => {
  const addToQueue = useCallback(async (operation: QueueOperation) => {
    try {
      await addOperationToQueue(
        operation.type,
        operation.data,
        operation.data.id,
        getEntityType(operation.type),
        operation.data.meterId || operation.data.routeId,
        getRelatedEntityType(operation.type)
      );
    } catch (error) {
      console.error('Error adding operation to queue:', error);
      throw error;
    }
  }, []);

  return {
    addToQueue
  };
};

const getEntityType = (operationType: OfflineOperationType): string => {
  if (operationType.includes('READING')) return 'Reading';
  if (operationType.includes('METER')) return 'Meter';
  if (operationType.includes('INCIDENT')) return 'Incident';
  if (operationType.includes('ROUTE')) return 'Route';
  return 'Unknown';
};

const getRelatedEntityType = (operationType: OfflineOperationType): string | undefined => {
  if (operationType.includes('READING')) return 'Meter';
  if (operationType.includes('INCIDENT')) return 'Meter';
  return undefined;
};
