import { Incident, SyncStatusType, IncidentSeverity, IncidentStatus, ServerIncident } from '../types/databaseModels';
import { executeSql, getDBConnection } from '../services/databaseService';
import uuid from 'react-native-uuid';
import { addOperationToQueue } from './offlineQueueRepository';

// --- Helper to map ResultSet to Incident ---
const mapRowToIncident = (row: any): Incident => {
  return {
    id: row.id,
    serverId: row.serverId, // Added
    meterId: row.meterId,
    routeId: row.routeId, // Changed from readingId
    incidentDate: row.incidentDate,
    resolvedDate: row.resolvedDate, // Added resolvedDate
    description: row.description,
    severity: row.severity, // Changed from incidentType
    status: row.status,
    photos: row.photos, // Changed from photoPath
    notes: row.notes, // Added
    latitude: row.latitude,
    longitude: row.longitude,
    syncStatus: row.syncStatus,
    lastModified: row.lastModified,
    userId: row.userId,
    version: row.version, // Added
  };
};

// --- Incident CRUD Operations ---

/**
 * Adds a new incident to the database.
 * @param incidentData Data for the new incident, excluding id, serverId, syncStatus, lastModified, and version.
 * @returns The newly created Incident object.
 */
export const addIncident = async (incidentData: Omit<Incident, 'id' | 'serverId' | 'syncStatus' | 'lastModified' | 'version'>): Promise<Incident> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const newId = uuid.v4(); // Removed 'as string'

  const query = `
    INSERT INTO Incidents (id, meterId, routeId, incidentDate, description, severity, status, photos, notes, latitude, longitude, userId, syncStatus, lastModified, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', strftime('%s', 'now'), 1);
  `;

  const params = [
    newId,
    incidentData.meterId,
    incidentData.routeId, // Changed from readingId
    incidentData.incidentDate,
    incidentData.description,
    incidentData.severity, // Changed from incidentType
    incidentData.status, 
    incidentData.photos, // Changed from photoPath
    incidentData.notes, // Added
    incidentData.latitude,
    incidentData.longitude,
    incidentData.userId,
  ];

  try {
    await executeSql(query, params);
    console.log(`Incident ${newId} added successfully`);
    const newIncident = await getIncidentById(newId);
    if (!newIncident) {
      throw new Error('Failed to retrieve newly added incident after insertion.');
    }

    try {
      await addOperationToQueue(
        'CREATE_INCIDENT',
        newIncident,
        newIncident.id,
        'Incident',
        newIncident.meterId,
        'Meter'
      );
    } catch (queueError) {
      console.error(`Failed to add CREATE_INCIDENT operation for incident ${newIncident.id} to offline queue`, queueError);
    }

    return newIncident;
  } catch (error) {
    console.error('Error adding incident:', error);
    throw error;
  }
};

/**
 * Retrieves an incident by its ID.
 * @param id The ID of the incident to retrieve.
 * @returns The Incident object if found, otherwise null.
 */
export const getIncidentById = async (id: string): Promise<Incident | null> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Incidents WHERE id = ?;";
  try {
    const results = await executeSql(query, [id]);
    if (results.rows.length > 0) {
      return mapRowToIncident(results.rows.item(0));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching incident by id ${id}:`, error);
    throw error;
  }
};

/**
 * Retrieves all incidents from the database.
 * @returns A promise that resolves to an array of Incident objects, ordered by incidentDate descending.
 */
export const getAllIncidents = async (): Promise<Incident[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Incidents ORDER BY incidentDate DESC;";
  try {
    const results = await executeSql(query);
    const incidents: Incident[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      incidents.push(mapRowToIncident(results.rows.item(i)));
    }
    return incidents;
  } catch (error) {
    console.error('Error fetching all incidents:', error);
    throw error;
  }
};

/**
 * Retrieves incidents by their synchronization status.
 * @param syncStatus The sync status to filter by ('pending' or 'error').
 * @returns A promise that resolves to an array of Incident objects.
 */
export const getIncidentsBySyncStatus = async (syncStatus: 'pending' | 'error'): Promise<Incident[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Incidents WHERE syncStatus = ? ORDER BY lastModified ASC;";
  try {
    const results = await executeSql(query, [syncStatus]);
    const incidents: Incident[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      incidents.push(mapRowToIncident(results.rows.item(i)));
    }
    return incidents;
  } catch (error) {
    console.error(`Error fetching incidents with syncStatus ${syncStatus}:`, error);
    throw error;
  }
};

/**
 * Retrieves incidents associated with a specific meter ID.
 * @param meterId The ID of the meter.
 * @returns A promise that resolves to an array of Incident objects.
 */
export const getIncidentsByMeterId = async (meterId: string): Promise<Incident[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Incidents WHERE meterId = ? ORDER BY incidentDate DESC;";
  try {
    const results = await executeSql(query, [meterId]);
    const incidents: Incident[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      incidents.push(mapRowToIncident(results.rows.item(i)));
    }
    return incidents;
  } catch (error) {
    console.error(`Error fetching incidents for meter ${meterId}:`, error);
    throw error;
  }
};

interface UpdateQueryParts {
  query: string;
  params: any[];
  dataChangedForQueue: boolean;
}

// Refactored helper to build the update query and determine if a queue operation is needed
const prepareIncidentUpdate = (
    incidentId: string,
    updates: Partial<Incident>,
    currentIncident: Incident
): UpdateQueryParts | null => {
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let actualDataChanged = false;

    // Define fields that are directly updatable by the client
    const updatableFields: (keyof Omit<Incident, 'id' | 'serverId' | 'syncStatus' | 'lastModified'>)[] = [
        'meterId', 'routeId', 'incidentDate', 'description', 'severity',
        'status', 'photos', 'notes', 'latitude', 'longitude', 'userId', 'version' // Added 'version'
    ];

    for (const key of updatableFields) {
        if (updates.hasOwnProperty(key)) {
            const newValue = updates[key];
            const currentValue = currentIncident[key];
            // Ensure newValue is not undefined before comparing or pushing
            if (newValue !== undefined && newValue !== currentValue) {
                setClauses.push(`${key} = ?`);
                queryParams.push(newValue);
                actualDataChanged = true;
            }
        }
    }

    let syncStatusToSet: SyncStatusType | undefined = undefined;
    if (updates.syncStatus !== undefined && updates.syncStatus !== currentIncident.syncStatus) {
        syncStatusToSet = updates.syncStatus;
    } else if (actualDataChanged && currentIncident.syncStatus !== 'pending') {
        syncStatusToSet = 'pending';
    }

    if (syncStatusToSet) {
        setClauses.push('syncStatus = ?');
        queryParams.push(syncStatusToSet);
    }

    // Only proceed if there are actual changes to data or syncStatus
    if (setClauses.length === 0) {
        return null;
    }

    setClauses.push("lastModified = strftime('%s', 'now')");
    // Add version increment if applicable and optimistic locking is used
    if (actualDataChanged && currentIncident.version !== undefined) {
        setClauses.push('version = ?');
        queryParams.push(currentIncident.version + 1);
    }
    queryParams.push(incidentId); // For the WHERE clause

    return {
        query: `UPDATE Incidents SET ${setClauses.join(', ')} WHERE id = ?;`,
        params: queryParams,
        dataChangedForQueue: actualDataChanged || (syncStatusToSet !== undefined && syncStatusToSet !== currentIncident.syncStatus),
    };
};


/**
 * Updates an existing incident.
 * @param incidentUpdate An object containing the incident's ID and fields to update.
 * @returns The updated Incident object if successful, otherwise null.
 */
export const updateIncident = async (incidentUpdate: Partial<Incident> & Pick<Incident, 'id'>): Promise<Incident | null> => {
    const db = getDBConnection();
    if (!db) {
        console.error('Database not open. Call openDatabase first.');
        // It's good practice to throw an error here to stop execution if DB is not available
        throw new Error('Database not open. Call openDatabase first.');
    }

    const { id } = incidentUpdate;

    const currentIncident = await getIncidentById(id);
    if (!currentIncident) {
        console.warn(`Incident ${id} not found for update.`);
        return null;
    }

    const updatePreparation = prepareIncidentUpdate(id, incidentUpdate, currentIncident);

    if (!updatePreparation) {
        console.warn(`updateIncident called for id: ${id}, but no effective SQL changes were determined. Returning current state.`);
        return currentIncident;
    }

    const { query, params, dataChangedForQueue } = updatePreparation;

    try {
        const results = await executeSql(query, params);
        const updatedIncidentFromDB = await getIncidentById(id); // Fetch the latest state from DB

        if (!updatedIncidentFromDB) {
            // This case should ideally not happen if the update was successful and ID is correct
            console.error(`Incident ${id} could not be retrieved after update attempt, though SQL execution did not throw.`);
            return null; 
        }

        if (results.rowsAffected > 0) {
            console.log(`Incident ${id} updated successfully in the database.`);
        } else {
            // This could happen if the data provided for update was identical to existing data,
            // or if the incident was deleted concurrently by another process.
            console.warn(`Incident ${id}: SQL update query affected 0 rows. Data might have been identical or incident deleted concurrently.`);
        }

        // Queue the operation if data relevant for synchronization was changed
        if (dataChangedForQueue) {
            try {
                await addOperationToQueue(
                    'UPDATE_INCIDENT',
                    updatedIncidentFromDB, // Pass the full updated incident object
                    updatedIncidentFromDB.id,
                    'Incident',
                    updatedIncidentFromDB.meterId, // Pass related entity ID if available
                    'Meter'
                );
            } catch (queueError) {
                console.error(`Failed to add UPDATE_INCIDENT operation for incident ${updatedIncidentFromDB.id} to offline queue`, queueError);
                // Decide if you want to re-throw, or if the main operation is still considered successful
            }
        }

        return updatedIncidentFromDB;
    } catch (error) {
        console.error(`Error updating incident ${id}:`, error);
        throw error;
    }
};

// --- Delete Operations ---

/**
 * Deletes an incident by its ID.
 * @param id The ID of the incident to delete.
 * @returns Promise<boolean> True if deletion was successful, false otherwise.
 */
export const deleteIncident = async (id: string): Promise<boolean> => {
    const db = getDBConnection();
    if (!db) {
        throw new Error('Database not open. Call openDatabase first.');
    }
    const query = "DELETE FROM Incidents WHERE id = ?;";
    try {
        const results = await executeSql(query, [id]);
        if (results.rowsAffected > 0) {
            console.log(`Incident ${id} deleted successfully`);
            try {
                await addOperationToQueue(
                    'DELETE_INCIDENT',
                    { id }, // For delete, only ID might be strictly needed for the queue payload
                    id,
                    'Incident'
                );
            } catch (queueError) {
                console.error(`Failed to add DELETE_INCIDENT operation for incident ${id} to offline queue`, queueError);
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error deleting incident ${id}:`, error);
        throw error;
    }
};

// --- Reconciliation Functions ---

/**
 * Reconciles a locally created incident with server data.
 * Updates the local incident with the serverId and marks it as synced.
 * @param localId The local temporary ID of the incident.
 * @param serverIncident The incident data received from the server.
 */
export const reconcileCreatedIncident = async (localId: string, serverIncident: ServerIncident): Promise<void> => {
  const db = getDBConnection();
  if (!db) {
    console.error('ReconcileCreatedIncident: Database not open.');
    throw new Error('Database not open. Call openDatabase first.');
  }

  // Assuming serverIncident.id contains the server-authoritative ID
  const serverId = serverIncident.id; 
  if (!serverId) {
    console.error(`ReconcileCreatedIncident: Server data for local incident ${localId} is missing a server ID.`);
    // Optionally, update local status to 'failed' or handle as an error
    await executeSql("UPDATE Incidents SET syncStatus = 'failed', lastModified = strftime('%s', 'now') WHERE id = ?;", [localId]);
    return;
  }

  const query = "UPDATE Incidents SET serverId = ?, syncStatus = 'synced', description = ?, severity = ?, status = ?, photos = ?, notes = ?, incidentDate = ?, resolvedDate = ?, meterId = ?, routeId = ?, latitude = ?, longitude = ?, userId = ?, version = ?, lastModified = strftime('%s', 'now') WHERE id = ?;";
  const params = [
    serverId,
    serverIncident.description,
    serverIncident.severity,
    serverIncident.status,
    serverIncident.photos,
    serverIncident.notes,
    serverIncident.incidentDate,
    serverIncident.resolvedDate,
    serverIncident.meterId,
    serverIncident.routeId,
    serverIncident.latitude,
    serverIncident.longitude,
    serverIncident.userId,
    serverIncident.version,
    localId
  ];

  try {
    const result = await executeSql(query, params);
    if (result.rowsAffected > 0) {
      console.log(`ReconcileCreatedIncident: Incident ${localId} reconciled with serverId ${serverId}.`);
    } else {
      console.warn(`ReconcileCreatedIncident: No rows updated for local incident ${localId}. It might have been deleted locally before reconciliation.`);
    }
  } catch (error) {
    console.error(`ReconcileCreatedIncident: Error reconciling incident ${localId} with serverId ${serverId}:`, error);
    // Optionally, update local status to 'failed' or re-throw
    await executeSql("UPDATE Incidents SET syncStatus = 'failed', lastModified = strftime('%s', 'now') WHERE id = ?;", [localId]);
    throw error;
  }
};

/**
 * Reconciles a locally updated incident with server data.
 * Updates the local incident's fields based on server response and marks it as synced.
 * @param localId The local ID of the incident.
 * @param serverIncident The incident data received from the server.
 */
export const reconcileUpdatedIncident = async (localId: string, serverIncident: ServerIncident): Promise<void> => {
  const db = getDBConnection();
  if (!db) {
    console.error('ReconcileUpdatedIncident: Database not open.');
    throw new Error('Database not open. Call openDatabase first.');
  }
  
  // Ensure serverId from serverIncident matches the existing one if available, or use localId if serverId is not part of ServerIncident for updates
  // For now, we assume localId is the correct reference.
  // serverIncident.id should be the authoritative ID from the server.

  const query = "UPDATE Incidents SET syncStatus = 'synced', description = ?, severity = ?, status = ?, photos = ?, notes = ?, incidentDate = ?, resolvedDate = ?, meterId = ?, routeId = ?, latitude = ?, longitude = ?, userId = ?, version = ?, serverId = ?, lastModified = strftime('%s', 'now') WHERE id = ?;";
  const params = [
    serverIncident.description,
    serverIncident.severity,
    serverIncident.status,
    serverIncident.photos,
    serverIncident.notes,
    serverIncident.incidentDate,
    serverIncident.resolvedDate,
    serverIncident.meterId,
    serverIncident.routeId,
    serverIncident.latitude,
    serverIncident.longitude,
    serverIncident.userId,
    serverIncident.version,
    serverIncident.id, // serverId from server data
    localId
  ];

  try {
    const result = await executeSql(query, params);
     if (result.rowsAffected > 0) {
      console.log(`ReconcileUpdatedIncident: Incident ${localId} reconciled with server data.`);
    } else {
      console.warn(`ReconcileUpdatedIncident: No rows updated for local incident ${localId}. It might have been deleted locally or data was identical.`);
    }
  } catch (error) {
    console.error(`ReconcileUpdatedIncident: Error reconciling incident ${localId}:`, error);
    await executeSql("UPDATE Incidents SET syncStatus = 'failed', lastModified = strftime('%s', 'now') WHERE id = ?;", [localId]);
    throw error;
  }
};

/**
 * Handles reconciliation for a locally deleted incident.
 * Currently, this function only logs the confirmation as the record is expected to be already deleted.
 * @param localId The local ID of the incident that was deleted.
 * @param serverId Optional server ID, if available from the delete confirmation.
 */
export const reconcileDeletedIncident = async (localId: string, serverId?: string): Promise<void> => {
  console.log(`ReconcileDeletedIncident: Confirmed deletion of incident ${localId} (Server ID: ${serverId || 'N/A'}) from server.`);
  // No specific database action is taken here as the local record should already be deleted
  // by the deleteIncident function before this reconciliation step.
  // If a soft-delete strategy were used, this is where you'd update the local record's status.
};

// --- Mock Data Generation (For Testing/Development) ---
// IMPORTANT: This function is for development and testing purposes only.
// It should be removed or conditionally called in production builds.
export const createMockIncidents = async (): Promise<void> => {
  const db = getDBConnection();
  if (!db) {
    console.error('Database not available for creating mock incidents.');
    return;
  }

  // Check if mock incidents already exist (optional, based on how you want to handle it)
  // For simplicity, we'll assume we always try to add if the table is empty or based on a count.
  // const existingIncidents = await getAllIncidents();
  // if (existingIncidents.length > 0) {
  //   console.log('Mock incidents already exist or table is not empty.');
  //   return;
  // }

  const mockIncidentsData: Omit<Incident, 'id' | 'serverId' | 'syncStatus' | 'lastModified' | 'version'>[] = [
    {
      meterId: 'mock-meter-1', // Assuming mock meter IDs exist
      routeId: 'mock-route-1', // Assuming mock route IDs exist
      incidentDate: Math.floor(Date.now() / 1000) - (24 * 60 * 60), // Yesterday
      description: 'Fuga leve en la acometida.',
      severity: IncidentSeverity.LOW,
      status: IncidentStatus.OPEN,
      photos: JSON.stringify(['path/to/photo1.jpg']),
      notes: 'Cliente reportó la fuga por la mañana.',
      latitude: 40.7128, // Example coordinates
      longitude: -74.0060,
      userId: 'user-1-id',
    },
    {
      meterId: 'mock-meter-2',
      incidentDate: Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60), // Two days ago
      description: 'Contador detenido, no registra consumo.',
      severity: IncidentSeverity.MEDIUM,
      status: IncidentStatus.IN_PROGRESS,
      notes: 'Se requiere revisión técnica.',
      latitude: 34.0522,
      longitude: -118.2437,
      userId: 'user-2-id',
    },
    {
      // Incident not tied to a specific meter
      routeId: 'mock-route-2',
      incidentDate: Math.floor(Date.now() / 1000), // Today
      description: 'Obstruction in access to multiple meters in area X.',
      severity: IncidentSeverity.MEDIUM,
      status: IncidentStatus.OPEN,
      notes: 'Construction work blocking the street.',
      latitude: 40.7129,
      longitude: -74.0059,
      userId: 'user-1-id',
    }
  ];

  try {
    for (const incidentData of mockIncidentsData) {
      const newId = generateMockUUID();
      const currentTime = Math.floor(Date.now() / 1000);
      const syncStatus: SyncStatusType = 'synced'; // Or 'pending' if they need to be synced

      await executeSql(
        `INSERT INTO Incidents (id, meterId, routeId, incidentDate, description, severity, status, photos, notes, latitude, longitude, userId, syncStatus, lastModified, version, serverId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL);`,
        [
          newId,
          incidentData.meterId,
          incidentData.routeId,
          incidentData.incidentDate,
          incidentData.description,
          incidentData.severity,
          incidentData.status,
          incidentData.photos,
          incidentData.notes,
          incidentData.latitude,
          incidentData.longitude,
          incidentData.userId,
          syncStatus,
          currentTime,
        ]
      );
    }
    console.log('Mock incidents created successfully.');
  } catch (error) {
    console.error('Error creating mock incidents:', error);
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('Error message:', error.message);
    }
  }
};

// Helper to generate simple pseudo-UUIDs for mock data
const generateMockUUID = () => `mock-incident-${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}`;
