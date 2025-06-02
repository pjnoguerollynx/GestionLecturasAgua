import { OfflineQueueItem, OfflineOperationType, OfflineQueueStatus } from '../types/databaseModels';
import { executeSql, getDBConnection } from '../services/databaseService';
import RNUUID from 'react-native-uuid'; // Import the default export

const mapRowToOfflineQueueItem = (row: any): OfflineQueueItem => {
  // Removed parsing logic as OfflineQueueItem.payload is expected to be a string.
  // If the application needs the payload as an object, it should parse it after retrieval.
  return {
    id: row.id, // Assuming id from DB is already string or compatible
    operationType: row.operationType as OfflineOperationType,
    payload: row.payload as string, // Assign the string payload directly from the DB row
    createdAt: row.timestamp, // Changed from row.createdAt to row.timestamp
    status: row.status as OfflineQueueStatus,
    attempts: row.attempts,
    lastAttemptAt: row.lastAttemptAt, // Changed from lastAttemptTimestamp to lastAttemptAt
    errorDetails: row.errorDetails,
    entityId: row.entityId,
    entityType: row.entityType,
    relatedEntityId: row.relatedEntityId,
    relatedEntityType: row.relatedEntityType, // Added
    // Ensure all fields from OfflineQueueItem are mapped
    syncStatus: row.syncStatus, // Added if it exists in the table
    token: row.token, // Added if it exists in the table
  };
};

export const addOperationToQueue = async (
  operationType: OfflineOperationType,
  payload: object,
  entityId?: string,
  entityType?: string,
  relatedEntityId?: string,
  relatedEntityType?: string
): Promise<OfflineQueueItem> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('DB_OFFLINE_QUEUE: Database not open.');
  }
  const id = RNUUID.v4().toString();
  const payloadString = JSON.stringify(payload);
  const currentTimestamp = Math.floor(Date.now() / 1000); // Calculate timestamp in JS

  const query = `
    INSERT INTO OfflineQueue (id, operationType, payload, entityId, entityType, relatedEntityId, relatedEntityType, timestamp, status, attempts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0);
  `;
  const params = [
    id,
    operationType,
    payloadString, // Ensure this is the stringified version
    entityId ?? null, // Convert undefined to null
    entityType ?? null, // Convert undefined to null
    relatedEntityId ?? null, // Convert undefined to null
    relatedEntityType ?? null, // Convert undefined to null
    currentTimestamp, // Pass calculated timestamp as parameter
  ];

  try {
    await executeSql(query, params);
    console.log(`Operation ${id} (${operationType}) added to offline queue.`);
    return {
      id,
      operationType,
      payload: payloadString, // Use the stringified version to match OfflineQueueItem type
      createdAt: currentTimestamp,
      status: 'pending',
      attempts: 0,
      entityId,
      entityType,
      relatedEntityId,
      relatedEntityType,
      // Initialize other optional fields if necessary
      // lastAttemptAt: undefined, // Or null
      // errorDetails: undefined, // Or null
      // syncStatus: undefined, // Or null
      // token: undefined, // Or null
    };
  } catch (error) {
    console.error('Error adding operation to offline queue:', error);
    throw error;
  }
};

export const getPendingOperations = async (limit: number = 50): Promise<OfflineQueueItem[]> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  const query = `
    SELECT * FROM OfflineQueue 
    WHERE status = 'pending' OR status = 'failed' 
    ORDER BY timestamp ASC
    LIMIT ?;
  `;
  try {
    const results = await executeSql(query, [limit]);
    const items: OfflineQueueItem[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      items.push(mapRowToOfflineQueueItem(results.rows.item(i)));
    }
    return items;
  } catch (error) {
    console.error('Error fetching pending operations from offline queue:', error);
    throw error;
  }
};

export const updateQueueItemStatus = async (
  id: string, // id is now string
  status: OfflineQueueStatus,
  attemptsIncrement: number = 0,
  errorDetails?: string | null
): Promise<OfflineQueueItem | null> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  const setClauses: string[] = ['status = ?'];
  const params: any[] = [status];

  if (attemptsIncrement > 0) {
    setClauses.push('attempts = attempts + ?');
    params.push(attemptsIncrement);
  }
  setClauses.push('lastAttemptAt = ?'); // Changed from lastAttemptTimestamp
  params.push(Math.floor(Date.now() / 1000));

  if (errorDetails !== undefined) {
    setClauses.push('errorDetails = ?');
    params.push(errorDetails);
  } else if (status === 'failed') {
    // Ensure errorDetails is not null if status is failed and no new error is provided
    // This might mean keeping the old error or setting a generic one.
    // For now, if errorDetails is undefined and status is failed, we don't update errorDetails.
  } else {
    // If status is not 'failed', clear errorDetails
    setClauses.push('errorDetails = NULL');
  }
  
  params.push(id);

  const query = `UPDATE OfflineQueue SET ${setClauses.join(', ')} WHERE id = ?;`;

  try {
    await executeSql(query, params);
    console.log(`Offline queue item ${id} status updated to ${status}.`);
    // Fetch and return the updated item
    const updatedItemResult = await executeSql('SELECT * FROM OfflineQueue WHERE id = ?;', [id]);
    if (updatedItemResult.rows.length > 0) {
      return mapRowToOfflineQueueItem(updatedItemResult.rows.item(0));
    }
    return null;
  } catch (error) {
    console.error(`Error updating offline queue item ${id}:`, error);
    throw error;
  }
};

export const deleteQueueItem = async (id: string): Promise<boolean> => { // id is now string
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  const query = 'DELETE FROM OfflineQueue WHERE id = ?;';
  try {
    const result = await executeSql(query, [id]);
    return result.rowsAffected > 0;
  } catch (error) {
    console.error(`Error deleting offline queue item ${id}:`, error);
    throw error;
  }
};

export const clearCompletedOperations = async (): Promise<number> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  const query = "DELETE FROM OfflineQueue WHERE status = 'completed';";
  try {
    const result = await executeSql(query, []);
    console.log(`${result.rowsAffected} completed operations cleared from offline queue.`);
    return result.rowsAffected;
  } catch (error) {
    console.error('Error clearing completed operations from offline queue:', error);
    throw error;
  }
};
