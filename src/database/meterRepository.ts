import { Meter, SyncStatusType } from '../types/databaseModels'; // Added SyncStatusType
import { executeSql, getDBConnection } from '../services/databaseService';
import uuid from 'react-native-uuid';
import { addOperationToQueue } from './offlineQueueRepository';

// --- Helper to map ResultSet to Meter ---
const mapRowToMeter = (row: any): Meter => {
  return {
    id: row.id,
    serverId: row.serverId,
    serialNumber: row.serialNumber,
    address: row.address,
    locationLatitude: row.locationLatitude, // Corrected from latitude
    locationLongitude: row.locationLongitude, // Corrected from longitude
    installationDate: row.installationDate,
    meterType: row.meterType,
    status: row.status,
    notes: row.notes,
    syncStatus: row.syncStatus,
    lastModified: row.lastModified,
    userId: row.userId,
    version: row.version,
  };
};

// --- Meter CRUD Operations ---

/**
 * Adds a new meter to the database.
 * ID, syncStatus, and lastModified are handled by the database or this function.
 * @param meterData Data for the new meter, excluding id, syncStatus, and lastModified.
 * @returns The newly created Meter object.
 */
export const addMeter = async (meterData: Omit<Meter, 'id' | 'syncStatus' | 'lastModified' | 'serverId' | 'version'>): Promise<Meter> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const newId = uuid.v4(); // Removed 'as string'

  const query = `
    INSERT INTO Meters (id, serialNumber, address, locationLatitude, locationLongitude, installationDate, meterType, status, notes, userId, syncStatus, lastModified, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', strftime('%s','now'), 0);
  `; // Added version default 0

  const params = [
    newId,
    meterData.serialNumber,
    meterData.address,
    meterData.locationLatitude, // Corrected from latitude
    meterData.locationLongitude, // Corrected from longitude
    meterData.installationDate,
    meterData.meterType,
    meterData.status,
    meterData.notes,
    meterData.userId,
  ];

  try {
    await executeSql(query, params);
    console.log(`Meter ${newId} added successfully`);
    const newMeter = await getMeterById(newId);
    if (!newMeter) {
      throw new Error('Failed to retrieve newly added meter after insertion.');
    }

    // Add to offline queue
    try {
      await addOperationToQueue(
        'CREATE_METER',
        newMeter, // Full meter object as payload
        newMeter.id,
        'Meter'
      );
    } catch (queueError) {
      console.error(`Failed to add CREATE_METER operation for meter ${newMeter.id} to offline queue`, queueError);
      // Continue as the local operation was successful
    }

    return newMeter;
  } catch (error) {
    console.error('Error adding meter:', error);
    throw error;
  }
};

/**
 * Retrieves a meter by its ID.
 * @param id The ID of the meter to retrieve.
 * @returns The Meter object if found, otherwise null.
 */
export const getMeterById = async (id: string): Promise<Meter | null> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Meters WHERE id = ?;";
  try {
    const results = await executeSql(query, [id]);
    if (results.rows.length > 0) {
      return mapRowToMeter(results.rows.item(0));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching meter by id ${id}:`, error);
    throw error;
  }
};

/**
 * Retrieves all meters from the database.
 * @returns A promise that resolves to an array of Meter objects.
 */
export const getAllMeters = async (): Promise<Meter[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Meters ORDER BY lastModified DESC;";
  try {
    const results = await executeSql(query);
    const meters: Meter[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      meters.push(mapRowToMeter(results.rows.item(i)));
    }
    return meters;
  } catch (error) {
    console.error('Error fetching all meters:', error);
    throw error;
  }
};

/**
 * Prepares the SQL query parts for updating a meter.
 * @param updates The partial meter data to update.
 * @returns Object with setClauses and queryParams.
 */
const prepareMeterUpdateQuery = (updates: Partial<Omit<Meter, 'id' | 'lastModified'>>) => {
  const setClauses: string[] = [];
  const queryParams: (string | number | boolean | null | undefined)[] = [];
  let dataFieldsChanged = false;

  const allowedFields: (keyof Omit<Meter, 'id' | 'lastModified' | 'syncStatus'>)[] = [
    'serverId', 'serialNumber', 'address', 'locationLatitude', 'locationLongitude',
    'installationDate', 'meterType', 'status', 'notes', 'userId', 'version'
  ];

  for (const key of allowedFields) {
    if (updates.hasOwnProperty(key)) {
      const value = (updates as any)[key];
      // Ensure undefined is not pushed, but null is (to clear a field)
      if (value !== undefined) {
          setClauses.push(`${key} = ?`);
          queryParams.push(value);
          dataFieldsChanged = true;
      }
    }
  }
  return { setClauses, queryParams, dataFieldsChanged };
};

// Helper to avoid loop if updateMeter itself calls updateMeter for error status
const updateMeterSyncStatusOnError = async (id: string) => {
    const db = getDBConnection();
    if (!db) return;
    try {
        // Only update syncStatus and lastModified
        await executeSql("UPDATE Meters SET syncStatus = 'error', lastModified = strftime('%s', 'now') WHERE id = ?", [id]);
        console.log(`Meter ${id} marked with syncStatus 'error'.`);
    } catch (e) {
        console.error(`Failed to mark meter ${id} as error status:`, e);
    }
};


export const updateMeter = async (meterUpdate: Partial<Meter> & Pick<Meter, 'id'>): Promise<Meter | null> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open. Call openDatabase first.');

  const { id, ...updates } = meterUpdate;

  const currentMeterState = await getMeterById(id);
  if (!currentMeterState) {
      console.warn(`Meter ${id} not found for update.`);
      return null;
  }

  const { syncStatus: newSyncStatus, ...dataUpdates } = updates;
  const { setClauses, queryParams, dataFieldsChanged } = prepareMeterUpdateQuery(dataUpdates);

  let effectiveSyncStatus: SyncStatusType | undefined = newSyncStatus;
  if (newSyncStatus === undefined && dataFieldsChanged) {
    effectiveSyncStatus = 'pending';
  }

  if (effectiveSyncStatus !== undefined) {
    setClauses.push('syncStatus = ?');
    queryParams.push(effectiveSyncStatus);
  }

  if (dataFieldsChanged || newSyncStatus !== undefined) {
      setClauses.push("lastModified = strftime('%s', 'now')");
  }

  if (setClauses.length === 0) {
    console.warn(`updateMeter called for id: ${id}, but no effective changes to be made.`);
    return currentMeterState;
  }

  queryParams.push(id);
  const query = `UPDATE Meters SET ${setClauses.join(', ')} WHERE id = ?;`;

  try {
    const results = await executeSql(query, queryParams);
    const updatedMeter = await getMeterById(id);

    if (!updatedMeter) {
        console.error(`Meter ${id} could not be retrieved after update attempt.`);
        return null;
    }

    const shouldQueue = (dataFieldsChanged && updatedMeter.syncStatus === 'pending') ||
                        (newSyncStatus === 'pending' && !dataFieldsChanged);

    if (results.rowsAffected > 0) {
      console.log(`Meter ${id} updated successfully. Rows affected: ${results.rowsAffected}`);
    } else {
      console.warn(`Meter ${id}: update query affected 0 rows. Data might have been unchanged or meter ID invalid (though checked).`);
    }

    if (shouldQueue) {
        try {
          const payloadForQueue = { ...currentMeterState, ...meterUpdate, syncStatus: 'pending' as SyncStatusType };
          await addOperationToQueue('UPDATE_METER', payloadForQueue, id, 'Meter');
          console.log(`Meter ${id} queued for UPDATE_METER.`);
        } catch (queueError) {
          console.error(`Failed to add UPDATE_METER operation for meter ${id} to offline queue`, queueError);
        }
    }
    return updatedMeter;
  } catch (error) {
    console.error(`Error updating meter ${id}:`, error);
    await updateMeterSyncStatusOnError(id);
    throw error;
  }
};

/**
 * Deletes a meter by its ID.
 * @param id The ID of the meter to delete.
 * @returns A promise that resolves to true if deletion was successful, false otherwise.
 */
export const deleteMeter = async (id: string): Promise<boolean> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  // Optional: Fetch the meter data before deleting if needed for the queue payload
  // const meterToDelete = await getMeterById(id);

  const query = "DELETE FROM Meters WHERE id = ?;";
  try {
    const results = await executeSql(query, [id]);
    if (results.rowsAffected > 0) {
      console.log(`Meter ${id} deleted successfully`);
      // Add to offline queue
      try {
        await addOperationToQueue(
          'DELETE_METER',
          { id }, // Payload can be as simple as the ID for a delete operation
          id,
          'Meter'
        );
      } catch (queueError) {
        console.error(`Failed to add DELETE_METER operation for meter ${id} to offline queue`, queueError);
      }
      return true;
    }
    console.warn(`Meter ${id} not found for deletion.`);
    return false;
  } catch (error) {
    console.error(`Error deleting meter ${id}:`, error);
    throw error;
  }
};

/**
 * Retrieves meters by their synchronization status.
 * @param syncStatus The sync status to filter by ('pending' or 'error').
 * @returns A promise that resolves to an array of Meter objects.
 */
export const getMetersBySyncStatus = async (syncStatus: 'pending' | 'error'): Promise<Meter[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Meters WHERE syncStatus = ? ORDER BY lastModified ASC;";
  try {
    const results = await executeSql(query, [syncStatus]);
    const meters: Meter[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      meters.push(mapRowToMeter(results.rows.item(i)));
    }
    return meters;
  } catch (error) {
    console.error(`Error fetching meters with syncStatus ${syncStatus}:`, error);
    throw error;
  }
};

// Placeholder for server-side Meter model, adjust as per actual API response
// interface ServerMeter { // This will be replaced by the more detailed one below
//     id: string; // Server-authoritative ID
//     serialNumber: string;
//     meterType?: string;
//     locationLatitude?: number;
//     locationLongitude?: number;
//     status?: string;
//     // Add other fields that the server might return and you want to store/update
//     createdAt: string; // Assuming server returns ISO date strings
//     updatedAt: string; // Assuming server returns ISO date strings
//     version?: number; // Optional: for conflict resolution
// }

// --- Server Model & Reconciliation Functions ---

export interface ServerMeter { // Exporting for potential use in syncService
    id: string; // Server-authoritative ID
    serialNumber: string;
    address: string;
    locationLatitude?: number | null;
    locationLongitude?: number | null;
    installationDate?: string | null;
    meterType?: string | null;
    status?: string | null;
    notes?: string | null;
    userId?: string | null;
    version?: number;
    updatedAt?: string; // ISO date string (server's last update time)
    createdAt?: string; // ISO date string
}

export const getMeterByServerId = async (serverId: string): Promise<Meter | null> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');
  const query = "SELECT * FROM Meters WHERE serverId = ?;";
  try {
    const results = await executeSql(query, [serverId]);
    if (results.rows.length > 0) {
      return mapRowToMeter(results.rows.item(0));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching meter by serverId ${serverId}:`, error);
    throw error;
  }
};

async function insertReconciledMeterFromServer(serverMeter: ServerMeter): Promise<Meter | null> {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const newLocalId = uuid.v4();
    const currentTimeSec = Math.floor(Date.now() / 1000);
    const installationDate = serverMeter.installationDate ?? null; // Changed from ||
    const lastModified = serverMeter.updatedAt ? Math.floor(new Date(serverMeter.updatedAt).getTime() / 1000) : currentTimeSec;
    const version = serverMeter.version ?? 0;

    const query = `
        INSERT INTO Meters (id, serverId, serialNumber, address, locationLatitude, locationLongitude, installationDate, meterType, status, notes, userId, syncStatus, lastModified, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);
    `;
    const params = [
        newLocalId, serverMeter.id, serverMeter.serialNumber, serverMeter.address,
        serverMeter.locationLatitude ?? null, serverMeter.locationLongitude ?? null,
        installationDate, serverMeter.meterType ?? null, serverMeter.status ?? null,
        serverMeter.notes ?? null, serverMeter.userId ?? null, lastModified, version
    ];

    try {
        await executeSql(query, params);
        console.log(`Meter with server ID ${serverMeter.id} inserted locally during reconciliation as ${newLocalId}.`);
        return getMeterById(newLocalId);
    } catch (error) {
        console.error(`Error inserting meter from server data (serverId: ${serverMeter.id}):`, error);
        throw error;
    }
}


export const reconcileCreatedMeter = async (localId: string, serverMeter: ServerMeter): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const localMeter = await getMeterById(localId);
    if (!localMeter) {
        console.warn(`Meter with local ID ${localId} not found for reconciliation of creation. Attempting to insert from server data.`);
        await insertReconciledMeterFromServer(serverMeter);
        return;
    }

    if (localMeter.serverId === serverMeter.id) {
        console.log(`Meter ${localId} already has serverId ${serverMeter.id}. Ensuring data consistency.`);
    }

    const lastModifiedServer = serverMeter.updatedAt ? Math.floor(new Date(serverMeter.updatedAt).getTime() / 1000) : localMeter.lastModified;
    const versionServer = serverMeter.version ?? localMeter.version ?? 0; // Changed from ternary

    const query = `
        UPDATE Meters
        SET
            serverId = ?, serialNumber = ?, address = ?, locationLatitude = ?, locationLongitude = ?,
            installationDate = ?, meterType = ?, status = ?, notes = ?, userId = ?,
            version = ?, lastModified = ?, syncStatus = 'synced'
        WHERE id = ?;
    `;
    const params = [
        serverMeter.id,
        serverMeter.serialNumber ?? localMeter.serialNumber,
        serverMeter.address ?? localMeter.address,
        serverMeter.locationLatitude ?? localMeter.locationLatitude,
        serverMeter.locationLongitude ?? localMeter.locationLongitude,
        serverMeter.installationDate ?? localMeter.installationDate,
        serverMeter.meterType ?? localMeter.meterType,
        serverMeter.status ?? localMeter.status,
        serverMeter.notes ?? localMeter.notes,
        serverMeter.userId ?? localMeter.userId,
        versionServer,
        lastModifiedServer,
        localId
    ];

    try {
        const result = await executeSql(query, params);
        if (result.rowsAffected > 0) {
            console.log(`Meter ${localId} reconciled with server ID ${serverMeter.id}.`);
        } else {
            const verifyMeter = await getMeterById(localId);
            if (verifyMeter && verifyMeter.serverId === serverMeter.id && verifyMeter.syncStatus === 'synced') {
                 console.log(`Meter ${localId} (server ID ${serverMeter.id}) likely already up-to-date.`);
            } else {
                 console.warn(`Meter ${localId} not updated during reconciliation (0 rows affected), server ID: ${serverMeter.id}. Current state: ${JSON.stringify(verifyMeter)}`);
            }
        }
    } catch (error) {
        console.error(`Error reconciling created meter ${localId} with server ID ${serverMeter.id}:`, error);
        await updateMeterSyncStatusOnError(localId);
        throw error;
    }
};

export const reconcileUpdatedMeter = async (meterId: string, serverMeter: ServerMeter): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    let localMeter = await getMeterById(meterId);

    if (!localMeter) {
        localMeter = await getMeterByServerId(serverMeter.id);
        if (!localMeter) {
            console.warn(`Meter with local ID ${meterId} or server ID ${serverMeter.id} not found. Inserting from server data.`);
            await insertReconciledMeterFromServer(serverMeter);
            return;
        }
        meterId = localMeter.id; // Ensure meterId is the local one if found by serverId
    }

    const serverVersion = serverMeter.version;
    const localVersion = localMeter.version ?? 0;
    const serverTimestamp = serverMeter.updatedAt ? new Date(serverMeter.updatedAt).getTime() : 0;
    const localTimestamp = localMeter.lastModified ? localMeter.lastModified * 1000 : 0;

    // Conflict resolution logic
    if (serverVersion !== undefined && serverVersion < localVersion) {
        console.warn(`Local meter ${meterId} (v${localVersion}) is newer than server data (v${serverVersion}). Server data will be applied to ensure consistency.`);
    } else if (serverVersion === localVersion && serverTimestamp < localTimestamp && localMeter.syncStatus === 'synced') {
        console.log(`Local meter ${meterId} (v${localVersion}, t${localTimestamp}) is same version and newer timestamp than server data (v${serverVersion}, t${serverTimestamp}). SyncStatus is 'synced'. No reconciliation update applied.`);
        if (localMeter.syncStatus !== 'synced') { // This condition seems redundant given the outer if, but kept for safety
            await executeSql("UPDATE Meters SET syncStatus = 'synced', lastModified = ? WHERE id = ?", [Math.floor(serverTimestamp/1000), meterId]);
        }
        return;
    }

    // Prepare update if reconciliation is needed
    const lastModifiedServer = serverMeter.updatedAt ? Math.floor(new Date(serverMeter.updatedAt).getTime() / 1000) : localMeter.lastModified;
    const versionToSet = serverMeter.version ?? localVersion; // Changed from ternary

    const query = `
        UPDATE Meters
        SET
            serialNumber = ?, address = ?, locationLatitude = ?, locationLongitude = ?,
            installationDate = ?, meterType = ?, status = ?, notes = ?, userId = ?,
            version = ?, lastModified = ?, syncStatus = 'synced', serverId = ?
        WHERE id = ?;
    `;
    const params = [
        serverMeter.serialNumber ?? localMeter.serialNumber,
        serverMeter.address ?? localMeter.address,
        serverMeter.locationLatitude ?? localMeter.locationLatitude,
        serverMeter.locationLongitude ?? localMeter.locationLongitude,
        serverMeter.installationDate ?? localMeter.installationDate,
        serverMeter.meterType ?? localMeter.meterType,
        serverMeter.status ?? localMeter.status,
        serverMeter.notes ?? localMeter.notes,
        serverMeter.userId ?? localMeter.userId,
        versionToSet,
        lastModifiedServer,
        serverMeter.id, // Ensure serverId is also updated if it wasn't set or changed
        meterId
    ];

    try {
        const result = await executeSql(query, params);
        if (result.rowsAffected > 0) {
            console.log(`Meter ${meterId} (server ID ${serverMeter.id}) reconciled after update.`);
        } else {
            const verifyMeter = await getMeterById(meterId);
            if (verifyMeter && verifyMeter.syncStatus === 'synced' && verifyMeter.version === versionToSet) {
                 console.log(`Meter ${meterId} (server ID ${serverMeter.id}) likely already up-to-date after update reconciliation.`);
            } else {
                 console.warn(`Meter ${meterId} not updated during update reconciliation (0 rows affected), server ID: ${serverMeter.id}. Current state: ${JSON.stringify(verifyMeter)}`);
            }
        }
    } catch (error) {
        console.error(`Error reconciling updated meter ${meterId} with server ID ${serverMeter.id}:`, error);
        await updateMeterSyncStatusOnError(meterId);
        throw error;
    }
};

export const reconcileDeletedMeter = async (localId: string, serverId?: string): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    let meterToDelete = await getMeterById(localId);
    if (!meterToDelete && serverId) {
        meterToDelete = await getMeterByServerId(serverId);
    }

    if (meterToDelete) {
        try {
            await executeSql("DELETE FROM Meters WHERE id = ?", [meterToDelete.id]);
            console.log(`Meter ${meterToDelete.id} (Server ID: ${meterToDelete.serverId || 'N/A'}) deleted locally based on server confirmation.`);
        } catch (error) {
            console.error(`Error deleting meter ${meterToDelete.id} locally during reconciliation:`, error);
            // If deletion fails, it might be already deleted or another issue.
            // Consider marking as 'error' or specific status if needed.
        }
    } else {
        console.warn(`Meter with local ID ${localId} (or server ID ${serverId || 'N/A'}) not found for deletion reconciliation.`);
    }
};


// --- Mock Data Functions ---
export const createMockMeters = async (count: number = 5): Promise<void> => {
    console.log('Attempting to create mock meters...');
    const db = getDBConnection();
    if (!db) {
        console.error('MockMeters: Database not open.');
        return;
    }

    const existingMeters = await getAllMeters();
    if (existingMeters.length > 0) {
        console.log('MockMeters: Meters already exist. Skipping mock data creation.');
        return;
    }

    const mockMeterData: Omit<Meter, 'id' | 'syncStatus' | 'lastModified' | 'serverId' | 'version'>[] = [];
    for (let i = 1; i <= count; i++) {
        mockMeterData.push({
            serialNumber: `SN-MOCK-${String(i).padStart(3, '0')}`,
            address: `Mock Address ${i}, 123 Mockingbird Lane`,
            locationLatitude: 34.0522 + (i * 0.001), // Example coordinates
            locationLongitude: -118.2437 + (i * 0.001),
            installationDate: Math.floor(new Date(2023, i % 12, (i % 28) + 1).getTime() / 1000), // Example date
            meterType: i % 2 === 0 ? 'Residential' : 'Commercial',
            status: 'Active',
            notes: `This is mock meter number ${i}.`,
            userId: 'mock-user-id', // Or link to an actual user if available
        });
    }

    let createdCount = 0;
    for (const data of mockMeterData) {
        try {
            // Use addMeter to ensure it goes through the normal process including offline queue
            const newMeter = await addMeter(data);
            console.log(`Mock meter ${newMeter.serialNumber} (ID: ${newMeter.id}) created successfully.`);
            createdCount++;
        } catch (error) {
            console.error('Error creating mock meter:', data.serialNumber, error);
        }
    }
    console.log(`${createdCount} mock meters created (or attempted).`);
};
