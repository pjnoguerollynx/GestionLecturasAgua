import { Reading, SyncStatusType } from '../types/databaseModels';
import { executeSql, getDBConnection } from '../services/databaseService';
import uuid from 'react-native-uuid';
import { addOperationToQueue } from './offlineQueueRepository';

// --- Helper to map ResultSet to Reading ---
const mapRowToReading = (row: any): Reading => {
  const reading: Reading = {
    id: row.id,
    meterId: row.meterId,
    value: row.readingValue, // Map DB 'readingValue' to interface 'value'
    readingDate: row.readingDate,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
    syncStatus: row.syncStatus,
    lastModified: row.lastModified,
    userId: row.userId,
  };

  // Optional fields from Reading interface
  if (row.serverId !== undefined && row.serverId !== null) reading.serverId = row.serverId;
  if (row.routeId !== undefined && row.routeId !== null) reading.routeId = row.routeId;
  if (row.version !== undefined && row.version !== null) reading.version = row.version;
  
  // DB columns 'readingType' and 'isAnomaly' are not part of the Reading interface.
  // They are handled during DB insertion/update if necessary but not mapped back to the Reading object directly
  // unless the Reading interface is changed.

  return reading;
};

// --- Reading CRUD Operations ---

/**
 * Adds a new reading to the database.
 * The DB schema for 'Readings' table is assumed to have 'readingValue', 'readingType', 'isAnomaly' columns.
 * 'readingType' and 'isAnomaly' are not part of the Reading interface, so they are inserted with default/explicit values here.
 * @param readingData Data for the new reading, conforming to Omit<Reading, 'id' | 'syncStatus' | 'lastModified'>.
 * @param readingType Optional: The type of reading (e.g., 'normal', 'estimated'). Defaults to 'normal'.
 * @param isAnomaly Optional: Whether the reading is an anomaly. Defaults to false.
 * @returns The newly created Reading object.
 */
export const addReading = async (
  readingData: Omit<Reading, 'id' | 'syncStatus' | 'lastModified'>,
  readingType: string = 'normal', // Default value for DB
  isAnomaly: boolean = false      // Default value for DB
): Promise<Reading> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const newId = uuid.v4();

  const query = `
    INSERT INTO Readings (id, meterId, readingValue, readingDate, readingType, latitude, longitude, isAnomaly, notes, userId, syncStatus, lastModified, version, serverId, routeId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', strftime('%s','now'), 0, ?, ?);
  `;

  const params = [
    newId,
    readingData.meterId,
    readingData.value, // Use 'value' from Reading interface, maps to 'readingValue' DB column
    readingData.readingDate,
    readingType, // Explicitly insert readingType (not from Reading interface)
    readingData.latitude,
    readingData.longitude,
    isAnomaly ? 1 : 0, // Explicitly insert isAnomaly (not from Reading interface)
    readingData.notes,
    readingData.userId,
    readingData.serverId, // from Reading interface
    readingData.routeId,  // from Reading interface
  ];

  try {
    await executeSql(query, params);
    console.log(`Reading ${newId} added successfully for meter ${readingData.meterId}`);
    const newReading = await getReadingById(newId);
    if (!newReading) {
      throw new Error('Failed to retrieve newly added reading after insertion.');
    }

    await addOperationToQueue(
      'CREATE_READING',
      newReading,
      newReading.id,
      'Reading',
      newReading.meterId,
      'Meter'
    );
    return newReading;
  } catch (error) {
    console.error('Error adding reading:', error);
    throw error;
  }
};

/**
 * Retrieves a reading by its ID.
 * @param id The ID of the reading to retrieve.
 * @returns The Reading object if found, otherwise null.
 */
export const getReadingById = async (id: string): Promise<Reading | null> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Readings WHERE id = ?;";
  try {
    const results = await executeSql(query, [id]);
    if (results.rows.length > 0) {
      return mapRowToReading(results.rows.item(0));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching reading by id ${id}:`, error);
    throw error;
  }
};

/**
 * Retrieves all readings for a specific meter.
 * @param meterId The ID of the meter.
 * @returns A promise that resolves to an array of Reading objects, ordered by readingDate descending.
 */
export const getReadingsByMeterId = async (meterId: string): Promise<Reading[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Readings WHERE meterId = ? ORDER BY readingDate DESC;";
  try {
    const results = await executeSql(query, [meterId]);
    const readings: Reading[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      readings.push(mapRowToReading(results.rows.item(i)));
    }
    return readings;
  } catch (error) {
    console.error(`Error fetching readings for meter ${meterId}:`, error);
    throw error;
  }
};

/**
 * Retrieves all readings from the database.
 * @returns A promise that resolves to an array of Reading objects, ordered by lastModified descending.
 */
export const getAllReadings = async (): Promise<Reading[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Readings ORDER BY lastModified DESC;";
  try {
    const results = await executeSql(query);
    const readings: Reading[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      readings.push(mapRowToReading(results.rows.item(i)));
    }
    return readings;
  } catch (error) {
    console.error('Error fetching all readings:', error);
    throw error;
  }
};

/**
 * Updates an existing reading.
 * @param readingUpdate An object containing the reading's ID and fields to update.
 * @returns The updated Reading object if successful, otherwise null.
 */
const determineEffectiveSyncStatus = (
    currentStatus: SyncStatusType,
    requestedStatus: SyncStatusType | undefined,
    dataChanged: boolean
): SyncStatusType => {
    if (requestedStatus !== undefined && requestedStatus !== currentStatus) {
        return requestedStatus;
    }
    if (dataChanged && currentStatus !== 'synced' && currentStatus !== 'failed') {
        return 'pending';
    }
    return currentStatus;
};

const executeReadingUpdate = async (
    id: string,
    query: string,
    queryParams: any[],
    dataFieldsChanged: boolean
): Promise<Reading | null> => {
    try {
        const results = await executeSql(query, queryParams);
        const updatedReadingFromDb = await getReadingById(id);

        if (!updatedReadingFromDb) {
            console.error(`Reading ${id} could not be retrieved after update attempt.`);
            if (results.rowsAffected === 0 && dataFieldsChanged) {
                await updateReadingSyncStatusOnError(id);
            }
            return null;
        }

        if (results.rowsAffected > 0) {
            console.log(`Reading ${id} updated successfully. Rows affected: ${results.rowsAffected}`);
        } else {
            console.warn(`Reading ${id}: update query affected 0 rows. Data might have been unchanged or ID invalid.`);
        }
        return updatedReadingFromDb;
    } catch (error) {
        console.error(`Error updating reading ${id}:`, error);
        await updateReadingSyncStatusOnError(id);
        throw error;
    }
}

export const updateReading = async (
    readingUpdate: Partial<Reading & { readingType?: string; isAnomaly?: boolean }> & Pick<Reading, 'id'>
): Promise<Reading | null> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open. Call openDatabase first.');

    const { id, ...updatesToApply } = readingUpdate;

    const currentReading = await getReadingById(id);
    if (!currentReading) {
        console.warn(`Reading ${id} not found for update.`);
        return null;
    }

    const { syncStatus: newSyncStatusRequest, ...dataPayload } = updatesToApply;
    const { setClauses, queryParams, dataFieldsChanged } = prepareReadingUpdateQuery(dataPayload);

    const effectiveSyncStatus = determineEffectiveSyncStatus(
        currentReading.syncStatus,
        newSyncStatusRequest,
        dataFieldsChanged
    );

    const syncStatusActuallyChanged = effectiveSyncStatus !== currentReading.syncStatus;
    const needsDbUpdate = dataFieldsChanged || syncStatusActuallyChanged;

    if (!needsDbUpdate) {
        console.warn(`updateReading for id: ${id} resulted in no effective changes. Current state returned.`);
        return currentReading;
    }

    setClauses.push("lastModified = strftime('%s', 'now')");
    if (syncStatusActuallyChanged) {
        setClauses.push('syncStatus = ?');
        queryParams.push(effectiveSyncStatus);
    }

    queryParams.push(id); // For the WHERE id = ?
    const query = `UPDATE Readings SET ${setClauses.join(', ')} WHERE id = ?;`;

    const updatedReadingFromDb = await executeReadingUpdate(id, query, queryParams, dataFieldsChanged);

    if (!updatedReadingFromDb) {
        return null; // Error already logged by executeReadingUpdate
    }

    // Determine if the operation needs to be queued
    const needsQueueing = updatedReadingFromDb.syncStatus === 'pending' && needsDbUpdate;

    if (needsQueueing) {
        await handleReadingUpdateQueueing(updatedReadingFromDb, id);
    }

    return updatedReadingFromDb;
};

// Helper function to handle adding the update operation to the offline queue
const handleReadingUpdateQueueing = async (updatedReading: Reading, readingId: string) => {
    try {
        await addOperationToQueue(
            'UPDATE_READING',
            updatedReading, // Use the state confirmed from DB
            readingId,
            'Reading',
            updatedReading.meterId,
            'Meter'
        );
    } catch (queueError) {
        console.error(`Failed to add UPDATE_READING operation for reading ${readingId} to offline queue`, queueError);
        // If queueing fails for an item that should be pending, mark it as error.
        if (updatedReading.syncStatus === 'pending') {
            await updateReadingSyncStatusOnError(readingId);
        }
    }
};

/**
 * Deletes a reading by its ID.
 * @param id The ID of the reading to delete.
 * @returns A promise that resolves to true if deletion was successful, false otherwise.
 */
export const deleteReading = async (id: string): Promise<boolean> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  const readingToDelete = await getReadingById(id); // Fetch before deleting

  const query = "DELETE FROM Readings WHERE id = ?;";
  try {
    const results = await executeSql(query, [id]);
    if (results.rowsAffected > 0) {
      console.log(`Reading ${id} deleted successfully`);
      // Add to offline queue
      if (readingToDelete) { // Ensure we have the reading data
        try {
          await addOperationToQueue(
            'DELETE_READING',
            { id: readingToDelete.id, meterId: readingToDelete.meterId }, // Include meterId
            readingToDelete.id,
            'Reading',
            readingToDelete.meterId, // relatedEntityId
            'Meter'                 // relatedEntityType
          );
        } catch (queueError) {
          console.error(`Failed to add DELETE_READING operation for reading ${id} to offline queue`, queueError);
        }
      } else {
        // If readingToDelete was null (should not happen if rowsAffected > 0, but as a fallback)
        try {
          await addOperationToQueue('DELETE_READING', { id }, id, 'Reading');
        } catch (queueError) {
          console.error(`Failed to add DELETE_READING operation (reading data not found) for reading ${id} to offline queue`, queueError);
        }
      }
      return true;
    }
    console.warn(`Reading ${id} not found for deletion.`);
    return false;
  } catch (error) {
    console.error(`Error deleting reading ${id}:`, error);
    throw error;
  }
};

/**
 * Retrieves readings by their synchronization status.
 * @param syncStatus The sync status to filter by ('pending' or 'error').
 * @returns A promise that resolves to an array of Reading objects.
 */
export const getReadingsBySyncStatus = async (syncStatus: 'pending' | 'error'): Promise<Reading[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Readings WHERE syncStatus = ? ORDER BY lastModified ASC;";
  try {
    const results = await executeSql(query, [syncStatus]);
    const readings: Reading[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      readings.push(mapRowToReading(results.rows.item(i)));
    }
    return readings;
  } catch (error) {
    console.error(`Error fetching readings with syncStatus ${syncStatus}:`, error);
    throw error;
  }
};

// Placeholder for server-side Reading model, adjust as per actual API response
export interface ServerReading { // Added export keyword
    id: string; // Server-authoritative ID
    meterId: string;
    readingDate: string; // Assuming server returns ISO date strings
    value: number; // Aligned with Reading interface
    notes?: string;
    latitude?: number;
    longitude?: number;
    userId?: string;
    createdAt: string; // Assuming server returns ISO date strings
    updatedAt: string; // Assuming server returns ISO date strings
    version?: number;
    // Server might also send readingType and isAnomaly, which are not in local Reading interface
    readingType?: string;
    isAnomaly?: boolean;
    routeId?: string;
}

export const reconcileCreatedReading = async (localId: string, serverReading: ServerReading): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const existingReadingByServerId = await getReadingById(serverReading.id).catch(() => null);
    if (existingReadingByServerId && existingReadingByServerId.id !== localId) {
        console.error(`Conflict: Server ID ${serverReading.id} already exists locally for a different reading (${existingReadingByServerId.id}). Marking local ${localId} as conflicted.`);
        await executeSql("UPDATE Readings SET syncStatus = 'conflicted', lastModified = strftime('%s', 'now') WHERE id = ?", [localId]);
        return;
    }
    
    const updateQuery = `
        UPDATE Readings
        SET serverId = ?, meterId = ?, readingDate = ?, readingValue = ?, notes = ?, latitude = ?, longitude = ?, userId = ?,
            syncStatus = 'synced', lastModified = ?, version = ?, readingType = ?, isAnomaly = ?, routeId = ?
        WHERE id = ?;`; 

    const lastModified = serverReading.updatedAt ? Math.floor(new Date(serverReading.updatedAt).getTime() / 1000) : Math.floor(Date.now() / 1000);
    const readingDateTimestamp = Math.floor(new Date(serverReading.readingDate).getTime() / 1000);

    let anomalyDbValue: number | null = null;
    if (serverReading.isAnomaly !== undefined) {
        anomalyDbValue = serverReading.isAnomaly ? 1 : 0;
    }

    await executeSql(updateQuery, [
        serverReading.id, 
        serverReading.meterId,
        readingDateTimestamp,
        serverReading.value, 
        serverReading.notes,
        serverReading.latitude,
        serverReading.longitude,
        serverReading.userId,
        lastModified,
        serverReading.version,
        serverReading.readingType ?? null, 
        anomalyDbValue, // Use extracted value
        serverReading.routeId ?? null,
        localId 
    ]);
    
    console.log(`Reading ${localId} reconciled with server data. Server ID: ${serverReading.id}`);
};

export const reconcileUpdatedReading = async (readingId: string, serverReading: ServerReading): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const localReading = await getReadingById(readingId);
    if (!localReading) {
        console.error(`Cannot reconcile updated reading: Reading ${readingId} not found locally.`);
        return;
    }

    if (serverReading.version !== undefined && localReading.version !== undefined && serverReading.version < localReading.version) {
        console.warn(`Reading ${readingId}: Local version (${localReading.version}) is newer than server version (${serverReading.version}). Server data not applied. Marking as conflicted.`);
        await executeSql("UPDATE Readings SET syncStatus = 'conflicted', lastModified = strftime('%s', 'now') WHERE id = ?", [readingId]);
        return;
    }
    
    const updateQuery = `
        UPDATE Readings
        SET meterId = ?, readingDate = ?, readingValue = ?, notes = ?, latitude = ?, longitude = ?, userId = ?,
            syncStatus = 'synced', lastModified = ?, version = ?, readingType = ?, isAnomaly = ?, routeId = ?, serverId = ?
        WHERE id = ?;`;
    const lastModified = serverReading.updatedAt ? Math.floor(new Date(serverReading.updatedAt).getTime() / 1000) : Math.floor(Date.now() / 1000);
    const readingDateTimestamp = Math.floor(new Date(serverReading.readingDate).getTime() / 1000);

    let anomalyDbValue: number | null = null;
    if (serverReading.isAnomaly !== undefined) {
        anomalyDbValue = serverReading.isAnomaly ? 1 : 0;
    }

    await executeSql(updateQuery, [
        serverReading.meterId,
        readingDateTimestamp,
        serverReading.value, 
        serverReading.notes,
        serverReading.latitude,
        serverReading.longitude,
        serverReading.userId,
        lastModified,
        serverReading.version,
        serverReading.readingType ?? null,
        anomalyDbValue, // Use extracted value
        serverReading.routeId ?? null,
        serverReading.id, 
        readingId
    ]);
    console.log(`Reading ${readingId} reconciled after update from server.`);
};

// Added reconcileDeletedReading function
const findReadingForReconciliation = async (readingId: string, serverId?: string): Promise<Reading | null> => {
    let localReading = await getReadingById(readingId);
    if (!localReading && serverId) {
        // Placeholder: If you implement getReadingByServerId, use it here.
        // localReading = await getReadingByServerId(serverId);
        // For now, if not found by localId, and serverId is present, we assume it might have been identified by serverId.
        // This logic might need refinement based on how server IDs are mapped locally if they differ from local UUIDs.
        console.warn(`Local reading ${readingId} not found. Server ID ${serverId} was provided.`);
    }
    return localReading;
};

export const reconcileDeletedReading = async (readingId: string, serverId?: string): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const localReading = await findReadingForReconciliation(readingId, serverId);
    const idToDelete = localReading ? localReading.id : readingId; // Use local ID if found, otherwise the provided readingId

    if (!localReading && !serverId) {
        console.warn(`Reading ${readingId} not found locally and no serverId provided for deletion reconciliation. Assuming already deleted.`);
        return;
    }

    const query = "DELETE FROM Readings WHERE id = ?;";
    try {
        const result = await executeSql(query, [idToDelete]);
        if (result.rowsAffected > 0) {
            console.log(`Reading ${idToDelete} (Server ID: ${serverId ?? 'N/A'}) confirmed deleted locally after server reconciliation.`);
        } else {
            console.log(`Reading ${idToDelete} (Server ID: ${serverId ?? 'N/A'}) was already deleted or not found locally during reconciliation.`);
        }
    } catch (error) {
        console.error(`Error deleting reading ${idToDelete} locally during reconciliation:`, error);
        // Check if the entity (still) exists before trying to mark it as error
        const existsAfterError = await getReadingById(idToDelete).catch(() => null);
        if (existsAfterError) {
            await updateReadingSyncStatusOnError(idToDelete);
        }
        throw error;
    }
};


// --- Helper to prepare update query for readings ---
// Takes updates based on the Reading interface (e.g., uses 'value' not 'readingValue')
const prepareReadingUpdateQuery = (
    updates: Partial<Reading & { readingType?: string; isAnomaly?: boolean }>
) => {
    const setClauses: string[] = [];
    const queryParams: (string | number | null | undefined)[] = [];
    let dataFieldsChanged = false;

    for (const key in updates) {
        if (updates.hasOwnProperty(key)) {
            const typedKey = key as keyof typeof updates;
            let valueToSet = updates[typedKey];
            let dbColumnName = typedKey as string;

            if (typedKey === 'value') {
                dbColumnName = 'readingValue';
            } else if (typedKey === 'isAnomaly' && typeof valueToSet === 'boolean') {
                valueToSet = valueToSet ? 1 : 0;
            }
            // 'readingType' uses its own name if present in updates.

            // Ensure valueToSet is not undefined before adding to query
            // null is a valid value to set for nullable fields.
            if (valueToSet !== undefined) {
                // Avoid adding id, syncStatus, or lastModified directly via this mechanism
                if (typedKey === 'id' || typedKey === 'syncStatus' || typedKey === 'lastModified') {
                    continue;
                }
                setClauses.push(`\`${dbColumnName}\` = ?`);
                queryParams.push(valueToSet as string | number | null);
                dataFieldsChanged = true;
            }
        }
    }
    return { setClauses, queryParams, dataFieldsChanged };
};

// Helper to update syncStatus to 'error' on failure
const updateReadingSyncStatusOnError = async (id: string) => {
    const db = getDBConnection();
    if (!db) return;
    try {
        await executeSql("UPDATE Readings SET syncStatus = 'error', lastModified = strftime('%s', 'now') WHERE id = ?", [id]);
        console.log(`Reading ${id} marked with syncStatus 'error'.`);
    } catch (e) {
        console.error(`Failed to mark reading ${id} as error status:`, e);
    }
};
