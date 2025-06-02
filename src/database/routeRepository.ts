import { Route, SyncStatusType } from '../types/databaseModels';
import { getDBConnection, executeSql } from '../services/databaseService'; // Corrected import
import uuid from 'react-native-uuid'; // Added import
import { addOperationToQueue } from './offlineQueueRepository'; // Added import

// --- Helper to map ResultSet to Route ---
const mapRowToRoute = (row: any): Route => {
  return {
    id: row.id,
    serverId: row.serverId,
    name: row.name,
    description: row.description,
    assignedUserId: row.assignedUserId,
    status: row.status,
    syncStatus: row.syncStatus,
    lastModified: row.lastModified,
    version: row.version,
    meterCount: row.meterCount, // Added meterCount
  };
};

// --- Route CRUD Operations ---

/**
 * Adds a new route to the database.
 * @param routeData Data for the new route, excluding id, serverId, syncStatus, lastModified, version, status, and meterCount. Status is optional.
 */
export const addRoute = async (routeData: Omit<Route, 'id' | 'serverId' | 'syncStatus' | 'lastModified' | 'status' | 'version' | 'meterCount'> & { status?: Route['status'] }): Promise<Route> => {
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const newId = uuid.v4();

  const query = `
    INSERT INTO Routes (id, name, description, status, assignedUserId, serverId, version, meterCount, syncStatus, lastModified)
    VALUES (?, ?, ?, ?, ?, NULL, 1, 0, 'pending', strftime('%s','now'));
  `;

  const params = [
    newId,
    routeData.name,
    routeData.description,
    routeData.status ?? 'pending',
    routeData.assignedUserId,
  ];

  try {
    await executeSql(query, params);
    console.log(`Route ${newId} added successfully`);
    const newRoute = await getRouteById(newId);
    if (!newRoute) {
      throw new Error('Failed to retrieve newly added route after insertion.');
    }

    // Add to offline queue
    try {
      await addOperationToQueue(
        'CREATE_ROUTE',
        newRoute, // Full route object as payload
        newRoute.id,
        'Route'
      );
    } catch (queueError) {
      console.error(`Failed to add CREATE_ROUTE operation for route ${newRoute.id} to offline queue`, queueError);
    }

    return newRoute;
  } catch (error) {
    console.error('Error adding route:', error);
    throw error;
  }
};

/**
 * Retrieves a route by its ID.
 * @param id The ID of the route to retrieve.
 * @returns The Route object if found, otherwise null.
 */
export const getRouteById = async (id: string): Promise<Route | null> => {
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Routes WHERE id = ?;";
  try {
    const results = await executeSql(query, [id]);
    if (results.rows.length > 0) {
      return mapRowToRoute(results.rows.item(0));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching route by id ${id}:`, error);
    throw error;
  }
};

/**
 * Retrieves all routes from the database.
 * @returns A promise that resolves to an array of Route objects, ordered by lastModified descending then name ascending.
 */
export const getAllRoutes = async (): Promise<Route[]> => {
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  // Removed assignedDate from ORDER BY as it's not consistently in the model/schema
  const query = "SELECT * FROM Routes ORDER BY lastModified DESC, name ASC;"; 
  try {
    const results = await executeSql(query);
    const routes: Route[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      routes.push(mapRowToRoute(results.rows.item(i)));
    }
    return routes;
  } catch (error) {
    console.error('Error fetching all routes:', error);
    throw error;
  }
};

/**
 * Retrieves routes by their synchronization status.
 * @param syncStatus The sync status to filter by ('pending' or 'error').
 * @returns A promise that resolves to an array of Route objects.
 */
export const getRoutesBySyncStatus = async (syncStatus: 'pending' | 'error'): Promise<Route[]> => {
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM Routes WHERE syncStatus = ? ORDER BY lastModified ASC;";
  try {
    const results = await executeSql(query, [syncStatus]);
    const routes: Route[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      routes.push(mapRowToRoute(results.rows.item(i)));
    }
    return routes;
  } catch (error) {
    console.error(`Error fetching routes with syncStatus ${syncStatus}:`, error);
    throw error;
  }
};

/**
 * Retrieves routes by their status.
 * @param status The status to filter by.
 * @returns A promise that resolves to an array of Route objects.
 */
export const getRoutesByStatus = async (status: Route['status']): Promise<Route[]> => {
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  // Removed assignedDate from ORDER BY
  const query = "SELECT * FROM Routes WHERE status = ? ORDER BY lastModified DESC, name ASC;"; 
  try {
    const results = await executeSql(query, [status]);
    const routes: Route[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      routes.push(mapRowToRoute(results.rows.item(i)));
    }
    return routes;
  } catch (error) {
    console.error(`Error fetching routes with status ${status}:`, error);
    throw error;
  }
};

/**
 * Retrieves routes assigned to a specific user.
 * @param assignedUserId The ID of the user. // Corrected parameter name
 * @returns A promise that resolves to an array of Route objects.
 */
export const getRoutesByAssignedUserId = async (assignedUserId: string): Promise<Route[]> => { // Corrected function name and parameter
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  // Corrected column name in query and removed assignedDate from ORDER BY
  const query = "SELECT * FROM Routes WHERE assignedUserId = ? ORDER BY lastModified DESC, name ASC;"; 
  try {
    const results = await executeSql(query, [assignedUserId]);
    const routes: Route[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      routes.push(mapRowToRoute(results.rows.item(i)));
    }
    return routes;
  } catch (error) {
    console.error(`Error fetching routes for user ${assignedUserId}:`, error);
    throw error;
  }
};

/**
 * Updates an existing route.
 * @param routeUpdate An object containing the route's ID and fields to update.
 * @returns The updated Route object if successful, otherwise null.
 */
export const updateRoute = async (routeUpdate: Partial<Route> & Pick<Route, 'id'>): Promise<Route | null> => {
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  const { id, ...updates } = routeUpdate;

  const currentRoute = await getRouteById(id);
  if (!currentRoute) {
      console.warn(`Route ${id} not found for update.`);
      return null;
  }

  const updatePreparation = prepareRouteUpdate(id, updates, currentRoute);

  if (!updatePreparation) {
      console.warn(`updateRoute called for id: ${id}, but no effective SQL changes were determined. Returning current state.`);
      return currentRoute;
  }

  const { query, params, dataChangedForQueue } = updatePreparation;

  try {
      await executeSql(query, params);
      const updatedRouteAfterDB = await getRouteById(id);

      if (!updatedRouteAfterDB) {
          console.error(`Route ${id} could not be retrieved after update attempt.`);
          return null;
      }
      // No need to check results.rowsAffected if we fetch the route again and check its state.
      console.log(`Route ${id} update processed.`);

      if (dataChangedForQueue) {
          try {
              await addOperationToQueue(
                  'UPDATE_ROUTE',
                  updatedRouteAfterDB, // Send the latest state from DB
                  id,
                  'Route'
              );
          } catch (queueError) {
              console.error(`Failed to add UPDATE_ROUTE operation for route ${id} to offline queue`, queueError);
          }
      }
      return updatedRouteAfterDB;
  } catch (error) {
      console.error(`Error updating route ${id}:`, error);
      throw error;
  }
};

interface PrepareRouteUpdateResult {
    query: string;
    params: any[];
    dataChangedForQueue: boolean;
}

const buildUpdateClauses = (updates: Partial<Omit<Route, 'id' | 'lastModified' | 'syncStatus' | 'serverId' | 'version' | 'meterCount'> >, currentRoute: Route): { setClauses: string[], queryParams: any[], actualDataChanged: boolean } => {
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let actualDataChanged = false;

    const updatableFields: (keyof typeof updates)[] = ['name', 'description', 'assignedUserId', 'status', /* meterCount can be updated via different mechanism if needed */];

    for (const key of updatableFields) {
        if (updates.hasOwnProperty(key)) {
            const newValue = updates[key];
            const currentValue = currentRoute[key as keyof Route];
            if (newValue !== undefined && newValue !== currentValue) {
                setClauses.push(`${key} = ?`);
                queryParams.push(newValue);
                actualDataChanged = true;
            }
        }
    }
    return { setClauses, queryParams, actualDataChanged };
};

const determineSyncStatusForUpdate = (updates: Partial<Pick<Route, 'syncStatus'>>, currentSyncStatus: SyncStatusType, actualDataChanged: boolean): SyncStatusType | undefined => {
    if (updates.syncStatus !== undefined && updates.syncStatus !== currentSyncStatus) {
        return updates.syncStatus;
    }
    if (actualDataChanged && currentSyncStatus !== 'pending') {
        return 'pending';
    }
    return undefined;
};

const prepareRouteUpdate = (
    id: string,
    updates: Partial<Omit<Route, 'id' | 'lastModified' | 'serverId' | 'version' | 'meterCount'> >, // Added meterCount to Omit
    currentRoute: Route
): PrepareRouteUpdateResult | null => {
    const { setClauses: dataSetClauses, queryParams: dataQueryParams, actualDataChanged } = buildUpdateClauses(updates, currentRoute);

    const syncStatusToSet = determineSyncStatusForUpdate(updates, currentRoute.syncStatus, actualDataChanged);

    const finalSetClauses = [...dataSetClauses];
    const finalQueryParams = [...dataQueryParams];

    if (syncStatusToSet) {
        finalSetClauses.push('syncStatus = ?');
        finalQueryParams.push(syncStatusToSet);
    }

    if (finalSetClauses.length === 0) {
        return null; // No SQL update needed
    }

    finalSetClauses.push("lastModified = strftime('%s', 'now')");
    // If versioning is implemented and `updates` can include `version`:
    // if (updates.version !== undefined && typeof updates.version === 'number') {
    //     finalSetClauses.push('version = ?');
    //     finalQueryParams.push(updates.version);
    // } else if (actualDataChanged && currentRoute.version !== undefined) {
    //     finalSetClauses.push('version = ?');
    //     finalQueryParams.push(currentRoute.version + 1);
    // }

    finalQueryParams.push(id); // For the WHERE clause

    return {
        query: `UPDATE Routes SET ${finalSetClauses.join(', ')} WHERE id = ?;`,
        params: finalQueryParams,
        dataChangedForQueue: actualDataChanged || (syncStatusToSet !== undefined && syncStatusToSet !== currentRoute.syncStatus),
    };
};

/**
 * Deletes a route by its ID.
 * @param id The ID of the route to delete.
 * @returns A promise that resolves to true if deletion was successful, false otherwise.
 */
export const deleteRoute = async (id: string): Promise<boolean> => {
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  // Fetch the route before deleting to have its data for the queue
  // const routeToDelete = await getRouteById(id); 
  // For DELETE, often only the ID is strictly necessary for the payload.
  // If other details are useful for the backend (e.g. for cascading deletes or logging), fetch them.

  const query = "DELETE FROM Routes WHERE id = ?;";
  try {
    const results = await executeSql(query, [id]);
    if (results.rowsAffected > 0) {
      console.log(`Route ${id} deleted successfully`);
      // Add to offline queue
      try {
        await addOperationToQueue(
          'DELETE_ROUTE',
          { id }, // Payload can be as simple as the ID
          id,
          'Route'
        );
      } catch (queueError) {
        console.error(`Failed to add DELETE_ROUTE operation for route ${id} to offline queue`, queueError);
      }
      return true;
    }
    console.warn(`Route ${id} not found for deletion.`);
    return false;
  } catch (error) {
    console.error(`Error deleting route ${id}:`, error);
    throw error;
  }
};

// --- Reconciliation Functions ---

// Interface for the Route object as expected from the server
export interface ServerRoute {
    id: string; // Server-authoritative ID
    name: string;
    description?: string;
    // assignedDate: string; // Removed
    assignedUserId?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    createdAt: string; 
    updatedAt: string; 
    version?: number; 
    // meterCount is usually a derived value or managed locally, not typically sent by server for a Route itself
}

export const reconcileCreatedRoute = async (localId: string, serverRoute: ServerRoute): Promise<void> => {
    const db = getDBConnection(); // Corrected function name
    if (!db) throw new Error('Database not open.');

    // Check if a route with the server ID already exists and is not the one we are reconciling
    const existingRouteByServerId = await getRouteById(serverRoute.id);
    if (existingRouteByServerId && existingRouteByServerId.id !== localId) {
        console.error(`Conflict: Server ID ${serverRoute.id} for route already exists locally for a different local ID (${existingRouteByServerId.id}). Local ID was ${localId}.`);
        // Mark the local item (localId) as conflicted
        await updateRoute({ id: localId, syncStatus: 'conflicted' });
        return;
    }

    const lastModified = Math.floor(new Date(serverRoute.updatedAt).getTime() / 1000);

    const query = `
        UPDATE Routes
        SET id = ?, name = ?, description = ?, status = ?, assignedUserId = ?,
            syncStatus = 'synced', lastModified = ?, serverId = ?, version = ?
        WHERE id = ?;
    `;
    const params = [
        serverRoute.id, // Update local ID to server ID
        serverRoute.name,
        serverRoute.description,
        serverRoute.status,
        serverRoute.assignedUserId,
        lastModified,
        serverRoute.id, // Store server ID in serverId field (if you add this column)
        serverRoute.version,
        localId // Find record by original localId
    ];

    try {
        await executeSql(query, params);
        console.log(`Route ${localId} reconciled with server ID ${serverRoute.id}`);
    } catch (error) {
        console.error(`Error reconciling created route ${localId} with server ID ${serverRoute.id}:`, error);
        // Optionally, set syncStatus to 'error' for the localId record
        await updateRoute({ id: localId, syncStatus: 'error' });
        throw error;
    }
};

export const reconcileUpdatedRoute = async (routeId: string, serverRoute: ServerRoute): Promise<void> => {
    const db = getDBConnection(); // Corrected function name
    if (!db) throw new Error('Database not open.');

    const localRoute = await getRouteById(routeId);
    if (!localRoute) {
        console.error(`Cannot reconcile updated route: Route ${routeId} not found locally.`);
        return;
    }

    // Optimistic locking check (if versioning is used)
    if (serverRoute.version !== undefined && localRoute.version !== undefined && serverRoute.version < localRoute.version) {
        console.warn(`Route ${routeId}: Local version (${localRoute.version}) is newer than server version (${serverRoute.version}). Server data not applied.`);
        await updateRoute({ id: routeId, syncStatus: 'conflicted' }); // Mark as conflicted
        return;
    }

    const lastModified = Math.floor(new Date(serverRoute.updatedAt).getTime() / 1000);

    const query = `
        UPDATE Routes
        SET name = ?, description = ?, status = ?, assignedUserId = ?,
            syncStatus = 'synced', lastModified = ?, serverId = ?, version = ?
        WHERE id = ?;
    `;
    const params = [
        serverRoute.name,
        serverRoute.description,
        serverRoute.status,
        serverRoute.assignedUserId,
        lastModified,
        serverRoute.id, // Ensure serverId is updated/set
        serverRoute.version,
        routeId
    ];

    try {
        await executeSql(query, params);
        console.log(`Route ${routeId} reconciled with server data (version: ${serverRoute.version}).`);
    } catch (error) {
        console.error(`Error reconciling updated route ${routeId}:`, error);
        await updateRoute({ id: routeId, syncStatus: 'error' });
        throw error;
    }
};

export const reconcileDeletedRoute = async (routeId: string): Promise<void> => {
    const db = getDBConnection(); // Corrected function name
    if (!db) throw new Error('Database not open.');

    const localRoute = await getRouteById(routeId);
    if (!localRoute) {
        console.warn(`Route ${routeId} already deleted locally or never existed.`);
        return;
    }

    const query = "DELETE FROM Routes WHERE id = ?;";
    try {
        await executeSql(query, [routeId]);
        console.log(`Route ${routeId} confirmed deleted locally after server reconciliation.`);
        // Optionally, also delete related RouteMeters if not handled by cascade or other logic
        // await deleteRouteMetersByRouteId(routeId); // Be cautious with cascading deletes here
    } catch (error) {
        console.error(`Error deleting route ${routeId} locally during reconciliation:`, error);
        // If deletion fails, it might be an issue to mark the local record as error or conflicted
        // For now, we just log the error.
        throw error;
    }
};

// Helper to generate simple pseudo-UUIDs for mock data
const generateMockUUID = () => `mock-${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}`;

export const createMockRoutes = async (): Promise<void> => {
  const db = getDBConnection(); // Corrected function name
  if (!db) {
    console.error('Database not available for creating mock routes.');
    return;
  }

  const existingRoutes = await getAllRoutes();
  if (existingRoutes.length > 0) {
    console.log('Mock routes already exist or table is not empty.');
    return;
  }

  // Omit serverId, version, meterCount, syncStatus, lastModified as they have defaults or are set by DB/logic
  type MockRouteInput = Omit<Route, 'id' | 'serverId' | 'syncStatus' | 'lastModified' | 'version' | 'meterCount'>;


  const mockRoutesData: MockRouteInput[] = [
    {
      name: 'Ruta Matutina Centro',
      description: 'Recorrido por el centro de la ciudad, principalmente contadores residenciales.',
      status: 'pending',
      assignedUserId: 'user-1-id', 
    },
    {
      name: 'Ruta Vespertina Industrial',
      description: 'Recorrido por la zona industrial, contadores de grandes empresas.',
      status: 'pending',
      assignedUserId: 'user-2-id',
    },
    {
      name: 'Ruta Urgencias Nocturna',
      description: 'Atención a incidencias y lecturas urgentes.',
      status: 'in_progress',
      assignedUserId: 'user-1-id',
    },
  ];

  try {
    for (const routeData of mockRoutesData) {
      // Use addRoute to ensure consistency with offline queue and other logic
      await addRoute(routeData);
    }
    console.log(`${mockRoutesData.length} mock routes created successfully using addRoute.`);
  } catch (error) {
    console.error('Error creating mock routes:', error);
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('Error message:', (error as Error).message);
    }
  }
};
