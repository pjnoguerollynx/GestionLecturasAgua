import { RouteMeter } from '../types/databaseModels'; // Removed OfflineOperationType if not used directly in this file after refactor
import { executeSql, getDBConnection } from '../services/databaseService';
import { addOperationToQueue } from './offlineQueueRepository';
import uuid from 'react-native-uuid'; // Changed from 'uuid'

// --- Helper to map ResultSet to RouteMeter ---
const mapRowToRouteMeter = (row: any): RouteMeter => {
  return {
    id: row.id, // Added missing id field
    routeId: row.routeId,
    meterId: row.meterId,
    sequenceOrder: row.sequenceOrder, // Corrected: model uses sequenceOrder
    status: row.status,
    visitDate: row.visitDate,
    notes: row.notes,
    syncStatus: row.syncStatus,
    lastModified: row.lastModified,
  };
};

// --- RouteMeter CRUD Operations ---

/**
 * Adds a new route-meter link to the database.
 * @param routeMeterData Data for the new route-meter link, excluding id, lastModified, and syncStatus.
 * @returns The newly created RouteMeter object.
 */
export const addRouteMeter = async (routeMeterData: Omit<RouteMeter, 'id' | 'lastModified' | 'syncStatus'>): Promise<RouteMeter> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const newId = uuid.v4(); // Generate new UUID for the id field

  const query = `
    INSERT INTO RouteMeters (id, routeId, meterId, sequenceOrder, status, visitDate, notes, syncStatus, lastModified)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', strftime('%s', 'now'));
  `;

  const params = [
    newId, // Add newId to params
    routeMeterData.routeId,
    routeMeterData.meterId,
    routeMeterData.sequenceOrder,
    routeMeterData.status,
    routeMeterData.visitDate ?? null,
    routeMeterData.notes ?? null,
  ];

  try {
    await executeSql(query, params);
    console.log(`RouteMeter link with ID ${newId} between Route ${routeMeterData.routeId} and Meter ${routeMeterData.meterId} added successfully`);
    // Fetch by the newId if it's the primary key, or continue using composite if that's how getRouteMeterById is designed.
    // For consistency with the error, we assume getRouteMeterById might need adjustment or a new getById function.
    // However, if (routeId, meterId) is unique and mapRowToRouteMeter now includes `id`, this should be fine.
    const newRouteMeter = await getRouteMeterById(routeMeterData.routeId, routeMeterData.meterId);
    if (!newRouteMeter) {
      // This might happen if getRouteMeterById doesn't find the record immediately or if there's an issue.
      // A more robust fetch would be by the newId if the table schema supports it as a unique key for lookup.
      // For now, we proceed assuming getRouteMeterById works with composite key and returns the full object including the new `id`.
      throw new Error('Failed to retrieve newly added route-meter link after insertion. The new ID was ' + newId);
    }

    // Add to offline queue
    try {
      await addOperationToQueue(
        'CREATE_ROUTEMETER',
        newRouteMeter, 
        newRouteMeter.id, // Use the newRouteMeter.id as entityId
        'RouteMeter',
        newRouteMeter.routeId, // relatedEntityId (Route)
        'Route' // relatedEntityType
      );
    } catch (queueError) {
      console.error(`Failed to add CREATE_ROUTEMETER for ${newRouteMeter.routeId}_${newRouteMeter.meterId} to queue`, queueError);
    }

    return newRouteMeter;
  } catch (error) {
    console.error('Error adding route-meter link:', error);
    // Consider if a failed DB operation should still attempt to queue something.
    // If newId was generated, but DB insert failed, queueing might lead to issues.
    // For now, rethrowing, consistent with previous patterns.
    throw error;
  }
};

/**
 * Retrieves a route-meter link by its composite ID (routeId, meterId).
 * @param routeId The ID of the route.
 * @param meterId The ID of the meter.
 * @returns The RouteMeter object if found, otherwise null.
 */
export const getRouteMeterById = async (routeId: string, meterId: string): Promise<RouteMeter | null> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM RouteMeters WHERE routeId = ? AND meterId = ?;";
  try {
    const results = await executeSql(query, [routeId, meterId]);
    if (results.rows.length > 0) {
      return mapRowToRouteMeter(results.rows.item(0));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching route-meter link by id (route: ${routeId}, meter: ${meterId}):`, error);
    throw error;
  }
};

/**
 * Retrieves all route-meter links for a specific route, ordered by sequence.
 * @param routeId The ID of the route.
 * @returns A promise that resolves to an array of RouteMeter objects.
 */
export const getRouteMetersByRouteId = async (routeId: string): Promise<RouteMeter[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM RouteMeters WHERE routeId = ? ORDER BY sequenceOrder ASC;"; // Corrected: order by sequenceOrder
  try {
    const results = await executeSql(query, [routeId]);
    const routeMeters: RouteMeter[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      routeMeters.push(mapRowToRouteMeter(results.rows.item(i)));
    }
    return routeMeters;
  } catch (error) {
    console.error(`Error fetching route-meters for route ${routeId}:`, error);
    throw error;
  }
};

/**
 * Retrieves all route-meter links for a specific meter.
 * @param meterId The ID of the meter.
 * @returns A promise that resolves to an array of RouteMeter objects.
 */
export const getRouteMetersByMeterId = async (meterId: string): Promise<RouteMeter[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT * FROM RouteMeters WHERE meterId = ?;";
  try {
    const results = await executeSql(query, [meterId]);
    const routeMeters: RouteMeter[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      routeMeters.push(mapRowToRouteMeter(results.rows.item(i)));
    }
    return routeMeters;
  } catch (error) {
    console.error(`Error fetching route-meters for meter ${meterId}:`, error);
    throw error;
  }
};

/**
 * Updates an existing route-meter link.
 * @param routeMeterUpdate An object containing the route-meter's composite ID and fields to update.
 * @returns The updated RouteMeter object if successful, otherwise null.
 */
export const updateRouteMeter = async (routeMeterUpdate: Partial<Omit<RouteMeter, 'lastModified'>> & Pick<RouteMeter, 'routeId' | 'meterId'>): Promise<RouteMeter | null> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open. Call openDatabase first.');

    const { routeId, meterId, ...updates } = routeMeterUpdate;

    const currentRouteMeter = await getRouteMeterById(routeId, meterId);
    if (!currentRouteMeter) {
        console.warn(`RouteMeter ${routeId}_${meterId} not found for update.`);
        return null;
    }

    // Pass all updatable fields (including potential syncStatus) to prepareRouteMeterUpdate
    const updatePreparation = prepareRouteMeterUpdate(routeId, meterId, updates, currentRouteMeter);

    if (!updatePreparation) {
        // Check if only syncStatus was intended to change and if it did change for queueing purposes
        const intendedSyncStatusChange = updates.syncStatus !== undefined && updates.syncStatus !== currentRouteMeter.syncStatus;
        if (intendedSyncStatusChange) {
            // Even if no SQL change (e.g., other fields same, syncStatus already 'pending' but was explicitly set again)
            // we might still want to queue if the *intent* was to mark for sync.
            // However, current `dataChangedForQueue` in `prepareRouteMeterUpdate` handles this.
            // If `prepareRouteMeterUpdate` returns null, it means no effective change for SQL or queue.
            console.warn(`updateRouteMeter for ${routeId}_${meterId}: no effective SQL changes or data changes for queue. Returning current state.`);
            // If syncStatus was explicitly set in `updates` and is different from current, but no other fields changed,
            // `prepareRouteMeterUpdate` might return null if `determineSyncStatusUpdate` doesn't yield a clause.
            // This path needs to ensure that if `updates.syncStatus` was provided and is different, it gets queued.
            // The `dataChangedForQueue` in `prepareRouteMeterUpdate` should capture this.
            // If `updatePreparation` is null, it implies `dataChangedForQueue` would have been false.
        } else {
            console.warn(`updateRouteMeter for ${routeId}_${meterId}: no effective SQL changes. Returning current state.`);
        }
        return currentRouteMeter;
    }

    const { query, params, dataChangedForQueue } = updatePreparation;

    try {
        const updateResult = await executeSql(query, params);
        
        const finalRouteMeterState = await getRouteMeterById(routeId, meterId);

        if (!finalRouteMeterState) {
            // The item is gone or unreadable after the update attempt.
            console.error(`RouteMeter ${routeId}_${meterId} could not be retrieved after update attempt. Rows affected: ${updateResult.rowsAffected}.`);
            // If data was intended to change, this is a failed update.
            // Returning null indicates failure to the caller.
            return null;
        }

        if (updateResult.rowsAffected > 0) {
            console.log(`RouteMeter ${routeId}_${meterId} updated successfully in DB (rows affected: ${updateResult.rowsAffected}).`);
        } else {
            // rowsAffected is 0. This implies the WHERE clause didn't match OR no values were changed by the SET.
            // Since lastModified is always set if the row is matched, this strongly implies the WHERE clause didn't match.
            // This contradicts currentRouteMeter being found initially. 
            // However, finalRouteMeterState was successfully fetched, meaning the item still exists.
            // This is an unusual state, but we proceed with the fetched state.
            console.warn(`RouteMeter ${routeId}_${meterId}: update query affected 0 rows, but item still exists. Current state (finalRouteMeterState) will be used for queue if needed.`);
        }

        if (dataChangedForQueue && finalRouteMeterState) { // Ensure finalRouteMeterState is not null
            try {
                await addOperationToQueue(
                    'UPDATE_ROUTEMETER',
                    finalRouteMeterState, 
                    finalRouteMeterState.id, // Use finalRouteMeterState.id as entityId
                    'RouteMeter',
                    routeId,
                    'Route'
                );
            } catch (queueError) {
                console.error(`Failed to add UPDATE_ROUTEMETER for ${routeId}_${meterId} to queue`, queueError);
                // Depending on policy, might re-throw or just log.
            }
        }
        return finalRouteMeterState; // Return the state as it is in the DB after the operation
    } catch (error) {
        console.error(`Error updating RouteMeter ${routeId}_${meterId}:`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
};

interface PrepareRouteMeterUpdateResult {
    query: string;
    params: any[];
    dataChangedForQueue: boolean;
}

// Corrected 'setClauses' variable name in the return type and usage
const buildUpdateClausesAndParams = (
    updates: Partial<Omit<RouteMeter, 'lastModified' | 'syncStatus' | 'routeId' | 'meterId'>>,
    currentRouteMeter: RouteMeter
): { setClauses: string[], queryParams: any[], actualDataChanged: boolean } => {
    const setClauses: string[] = [];
    const queryParams: (string | number | null | undefined)[] = [];
    let actualDataChanged = false;

    for (const key in updates) {
        if (updates.hasOwnProperty(key)) {
            const newValue = (updates as any)[key];
            const currentValue = (currentRouteMeter as any)[key];
            // Ensure undefined new values are handled correctly if they mean "no change" vs "set to null"
            // For now, if newValue is undefined, it's skipped. If it should set DB to NULL, logic needs adjustment.
            if (newValue !== undefined && newValue !== currentValue) {
                setClauses.push(`${key} = ?`);
                queryParams.push(newValue);
                actualDataChanged = true;
            }
        }
    }
    return { setClauses, queryParams, actualDataChanged };
};

const determineSyncStatusUpdate = (
    updates: Partial<{ syncStatus?: RouteMeter['syncStatus'] }>, // Use specific type
    currentSyncStatus: RouteMeter['syncStatus'],
    actualDataChanged: boolean
): { syncStatusClause?: string, syncStatusParam?: RouteMeter['syncStatus'] } => { // Use specific type
    let syncStatusToSet: RouteMeter['syncStatus'] | undefined = undefined;

    if (updates.syncStatus !== undefined && updates.syncStatus !== currentSyncStatus) {
        syncStatusToSet = updates.syncStatus;
    } else if (actualDataChanged && currentSyncStatus !== 'pending') {
        syncStatusToSet = 'pending';
    }

    if (syncStatusToSet !== undefined) {
        return { syncStatusClause: 'syncStatus = ?', syncStatusParam: syncStatusToSet };
    }
    return {};
};

// Corrected 'setClauses' variable name in destructuring
const prepareRouteMeterUpdate = (
    routeId: string,
    meterId: string,
    updates: Partial<Omit<RouteMeter, 'lastModified' | 'routeId' | 'meterId'>>,
    currentRouteMeter: RouteMeter
): PrepareRouteMeterUpdateResult | null => {
    const { setClauses: builtSetClauses, queryParams: builtQueryParams, actualDataChanged } = buildUpdateClausesAndParams(
        updates as Partial<Omit<RouteMeter, 'lastModified' | 'syncStatus' | 'routeId' | 'meterId'>>,
        currentRouteMeter
    );

    const { syncStatusClause, syncStatusParam } = determineSyncStatusUpdate(
        updates,
        currentRouteMeter.syncStatus,
        actualDataChanged
    );

    const finalSetClauses = [...builtSetClauses];
    const finalQueryParams = [...builtQueryParams];

    if (syncStatusClause && syncStatusParam !== undefined) {
        finalSetClauses.push(syncStatusClause);
        finalQueryParams.push(syncStatusParam);
    }

    if (finalSetClauses.length === 0) {
        // If only syncStatus was changed, but it didn't result in a clause (e.g. already 'pending')
        // and no other data changed, then no SQL update.
        // However, if syncStatus was explicitly set and IS different, it should be queued.
        const syncStatusExplicitlyChanged = updates.syncStatus !== undefined && updates.syncStatus !== currentRouteMeter.syncStatus;
        if (syncStatusExplicitlyChanged) {
             // This case implies an explicit change to syncStatus that didn't make it into clauses,
             // which is unlikely with current logic but good to be aware of.
             // For now, if no clauses, no SQL. Queueing decision is separate.
        }
        return null;
    }

    finalSetClauses.push("lastModified = strftime('%s', 'now')");
    finalQueryParams.push(routeId, meterId);

    const dataChangedForQueue = actualDataChanged ||
                              (updates.syncStatus !== undefined && updates.syncStatus !== currentRouteMeter.syncStatus);

    return {
        query: `UPDATE RouteMeters SET ${finalSetClauses.join(', ')} WHERE routeId = ? AND meterId = ?;`,
        params: finalQueryParams,
        dataChangedForQueue: dataChangedForQueue,
    };
};

/**
 * Deletes a route-meter link by its composite ID.
 * @param routeId The ID of the route.
 * @param meterId The ID of the meter.
 * @returns A promise that resolves to true if deletion was successful, false otherwise.
 */
export const deleteRouteMeter = async (routeId: string, meterId: string): Promise<boolean> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  // Fetch before deleting for the queue payload
  const routeMeterToDelete = await getRouteMeterById(routeId, meterId);

  const query = "DELETE FROM RouteMeters WHERE routeId = ? AND meterId = ?;";
  try {
    const results = await executeSql(query, [routeId, meterId]);
    if (results.rowsAffected > 0) {
      console.log(`RouteMeter link for route ${routeId}, meter ${meterId} deleted successfully`);
      if (routeMeterToDelete) {
        try {
          await addOperationToQueue(
            'DELETE_ROUTEMETER',
            { routeId: routeMeterToDelete.routeId, meterId: routeMeterToDelete.meterId, id: routeMeterToDelete.id }, // Include id in payload
            routeMeterToDelete.id, // Use routeMeterToDelete.id as entityId
            'RouteMeter',
            routeId,
            'Route'
          );
        } catch (queueError) {
          console.error(`Failed to add DELETE_ROUTEMETER for ${routeId}_${meterId} to queue`, queueError);
        }
      } else {
        // Fallback if somehow not fetched but deletion was successful
        // This case is less ideal as we won't have the original `id` if it wasn't part of routeId/meterId
        // However, if `id` is a separate UUID, we wouldn't know it here without fetching.
        // Assuming the primary way to identify for delete queue is routeId, meterId if routeMeterToDelete is null.
        // But if routeMeterToDelete is null, it implies it wasn't found, so deletion queue might be for a non-existent item.
        // For consistency, if we have an ID, we should use it. If not, this path is problematic.
        // The current logic relies on routeMeterToDelete being non-null if deletion is successful and queueing is needed.
         console.warn(`RouteMeter ${routeId}_${meterId} was deleted, but original data for queue was not available.`);
      }
      return true;
    }
    console.warn(`RouteMeter link for route ${routeId}, meter ${meterId} not found for deletion.`);
    return false;
  } catch (error) {
    console.error(`Error deleting route-meter link for route ${routeId}, meter ${meterId}:`, error);
    throw error;
  }
};

/**
 * Deletes all route-meter links for a specific route.
 * Useful when a route is deleted.
 * @param routeId The ID of the route.
 * @returns A promise that resolves to the number of links deleted.
 */
export const deleteRouteMetersByRouteId = async (routeId: string): Promise<number> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  // It's important to know which meter IDs were associated with the route for the offline queue.
  // However, the payload for DELETE_ROUTEMETERS_BY_ROUTEID might just be the routeId itself.
  // Let's assume the backend can handle deletion by routeId.
  // const routeMetersToDelete = await getRouteMetersByRouteId(routeId); // Keep if individual items needed for payload

  const query = "DELETE FROM RouteMeters WHERE routeId = ?;";
  try {
    const results = await executeSql(query, [routeId]);
    console.log(`${results.rowsAffected} RouteMeter links deleted for route ${routeId}`);

    if (results.rowsAffected > 0) {
      try {
        await addOperationToQueue(
          'DELETE_ROUTEMETERS_BY_ROUTEID', // New specific operation type
          { routeId }, // Payload is just the routeId
          routeId, // entityId can be the routeId itself
          'RouteMeter_BatchDelete', // A more descriptive entityType for this operation
          routeId,
          'Route'
        );
      } catch (queueError) {
        console.error(`Failed to add DELETE_ROUTEMETERS_BY_ROUTEID for route ${routeId} to queue`, queueError);
      }
    }
    return results.rowsAffected;
  } catch (error) {
    console.error(`Error deleting route-meter links for route ${routeId}:`, error);
    throw error;
  }
};

/**
 * Updates the sequence of meters within a route.
 * This might involve multiple updates if sequences are just swapped or reordered.
 * A more complex implementation might take an array of {meterId, newSequence}.
 * For now, this updates a single meter's sequence.
 * @param routeId The ID of the route.
 * @param meterId The ID of the meter.
 * @param newSequence The new sequence number for the meter in the route.
 * @returns The updated RouteMeter object or null.
 */
export const updateRouteMeterSequence = async (routeId: string, meterId: string, newSequence: number): Promise<RouteMeter | null> => {
    return updateRouteMeter({ routeId, meterId, sequenceOrder: newSequence });
};

/**
 * Updates the sequence of multiple meters within a route in a batch operation.
 * Uses a transaction to ensure atomicity.
 * @param routeId The ID of the route.
 * @param meterSequences An array of objects, each containing meterId and its new sequenceOrder.
 * @returns A promise that resolves to true if all updates were successful. Throws an error on failure.
 */
export const updateRouteMeterSequencesBatch = async (
  routeId: string,
  meterSequences: { meterId: string; sequenceOrder: number }[]
): Promise<boolean> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  if (!meterSequences || meterSequences.length === 0) {
    console.log('No meter sequences provided for batch update.');
    return true; // Nothing to update, considered a success.
  }

  // It's generally safer and often more performant to run batch updates within a transaction.
  try {
    await executeSql('BEGIN TRANSACTION;', []);
    const updatedItemsForQueue: RouteMeter[] = [];

    for (const item of meterSequences) {
      const updateQuery = `
        UPDATE RouteMeters
        SET sequenceOrder = ?, syncStatus = 'pending', lastModified = strftime('%s', 'now')
        WHERE routeId = ? AND meterId = ?;
      `;
      const updateParams = [item.sequenceOrder, routeId, item.meterId];
      const result = await executeSql(updateQuery, updateParams);

      if (result.rowsAffected > 0) {
        // Attempt to fetch the updated item to get all fields for the queue payload
        const updatedRm = await getRouteMeterById(routeId, item.meterId);
        if (updatedRm) {
            updatedItemsForQueue.push(updatedRm);
        } else {
            // Fallback: construct a partial payload if fetch fails
            console.warn(`Could not fetch RouteMeter ${routeId}_${item.meterId} after batch update, queueing partial data.`);
            updatedItemsForQueue.push({
                routeId,
                meterId: item.meterId,
                sequenceOrder: item.sequenceOrder,
                status: 'pending', // Assuming default or unknown status
                syncStatus: 'pending',
                lastModified: Math.floor(Date.now() / 1000), // Corrected: ensure this is a number
                // notes and visitDate are unknown here
            } as RouteMeter);
        }
      } else {
        console.warn(
          `Meter ${item.meterId} in route ${routeId} not found or sequenceOrder was already set to ${item.sequenceOrder} during batch update.`
        );
      }
    }

    await executeSql('COMMIT;', []);
    console.log(`Batch sequence update for route ${routeId} completed successfully.`);

    // Add operations to queue after successful commit
    for (const updatedRm of updatedItemsForQueue) {
        try {
            await addOperationToQueue(
                'UPDATE_ROUTEMETER',
                updatedRm, // Full or partial RouteMeter object
                updatedRm.id, // Use updatedRm.id as entityId
                'RouteMeter',
                updatedRm.routeId,
                'Route'
            );
        } catch (queueError) {
            console.error(`Failed to add UPDATE_ROUTEMETER for ${updatedRm.routeId}_${updatedRm.meterId} (batch) to queue`, queueError);
        }
    }
    return true;
  } catch (error) {
    await executeSql('ROLLBACK;', []).catch(rollbackError => {
      console.error('Error during ROLLBACK after batch update failure:', rollbackError);
    });
    console.error(`Error during batch sequence update for route ${routeId}:`, error);
    throw error;
  }
};

// --- Reconciliation Functions ---

// Interface for the RouteMeter object as expected from the server
export interface ServerRouteMeter { // Added export
    id: string; // Server-authoritative ID for the association
    routeId: string;
    meterId: string;
    sequenceOrder: number;
    status: 'pending' | 'completed' | 'skipped' | 'unable_to_locate';
    visitDate?: string; // ISO date string or timestamp
    notes?: string;
    // Assuming server provides these timestamps for versioning/auditing
    createdAt: string; // ISO date string or timestamp
    updatedAt: string; // ISO date string or timestamp
    version?: number; // Optional version number for optimistic locking
}

// For batch operations, the server might return an array of ServerRouteMeter or just a success status.
// Adjust ServerBatchResponse as needed.
export interface ServerBatchResponse { // Added export
    success: boolean;
    items?: ServerRouteMeter[]; // Optional: if server returns updated items
    errors?: any[]; // Optional: if server returns specific errors for items
}

export const reconcileCreatedRouteMeter = async (localCompositeId: string, serverRouteMeter: ServerRouteMeter): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    // localCompositeId is expected to be `${routeId}_${meterId}` or a local UUID if RouteMeter has its own primary key.
    // For this implementation, we assume RouteMeter uses routeId and meterId as composite primary key locally.
    // If RouteMeter has its own local UUID `id` field, then localCompositeId would be that UUID.

    // Let's assume the local table uses routeId and meterId as primary keys.
    // If serverRouteMeter.id is different from a locally generated one (if any), we need to handle it.
    // For now, we assume serverRouteMeter.id is the definitive composite key or a server-side specific ID for the link.

    // Check if a RouteMeter with the server ID (if it's a single field) or server composite key already exists.
    // This check is a bit more complex if the local PK is composite and server ID is a single field.
    // For simplicity, let's assume the server returns routeId and meterId which are used to find the local record.
    const existingRM = await getRouteMeterById(serverRouteMeter.routeId, serverRouteMeter.meterId);

    if (!existingRM) {
        console.warn(`RouteMeter for route ${serverRouteMeter.routeId}, meter ${serverRouteMeter.meterId} not found locally for reconciliation of CREATED item. This might indicate an issue or a DELETE followed by a CREATE.`);
        // Potentially, insert it if it doesn't exist, but this is for a CREATED item that should exist locally.
        // This usually means the local item was identified by a temporary ID that needs to be updated to the server's ID scheme.
        // If localCompositeId was a temp UUID, and serverRouteMeter.id is the server's UUID for this link:
        // We would need a way to map temp UUID to the server's new UUID.
        // For now, we assume localCompositeId helps find the record if its PK changes (e.g. temp UUID to server UUID)
        // If the local PK is routeId + meterId, then this path (existingRM is null) is problematic for a CREATE reconciliation.
        return;
    }

    const lastModified = Math.floor(new Date(serverRouteMeter.updatedAt).getTime() / 1000);
    const visitDateTimestamp = serverRouteMeter.visitDate ? Math.floor(new Date(serverRouteMeter.visitDate).getTime() / 1000) : existingRM.visitDate;

    // If your RouteMeter table has its own `id` (UUID) and `serverId` columns:
    // const updateQuery = `UPDATE RouteMeters SET serverId = ?, sequenceOrder = ?, status = ?, visitDate = ?, notes = ?, syncStatus = 'synced', lastModified = ?, version = ? WHERE id = ?;`;
    // const params = [serverRouteMeter.id, ..., localCompositeId];

    // Assuming routeId, meterId are PKs and we might update other fields + sync metadata:
    const query = `
        UPDATE RouteMeters
        SET sequenceOrder = ?, status = ?, visitDate = ?, notes = ?,
            syncStatus = 'synced', lastModified = ?, version = ?, serverId = ? 
        WHERE routeId = ? AND meterId = ?;
    `;
    // serverId column would store serverRouteMeter.id if it's a unique ID for the link from the server.
    const params = [
        serverRouteMeter.sequenceOrder,
        serverRouteMeter.status,
        visitDateTimestamp,
        serverRouteMeter.notes,
        lastModified,
        serverRouteMeter.version,
        serverRouteMeter.id, // Store the server's ID for this link if applicable
        serverRouteMeter.routeId, 
        serverRouteMeter.meterId
    ];

    try {
        await executeSql(query, params);
        console.log(`RouteMeter for route ${serverRouteMeter.routeId}, meter ${serverRouteMeter.meterId} reconciled (created).`);
    } catch (error) {
        console.error(`Error reconciling created RouteMeter for route ${serverRouteMeter.routeId}, meter ${serverRouteMeter.meterId}:`, error);
        await updateRouteMeter({ routeId: serverRouteMeter.routeId, meterId: serverRouteMeter.meterId, syncStatus: 'error' });
        throw error;
    }
};

export const reconcileUpdatedRouteMeter = async (routeId: string, meterId: string, serverRouteMeter: ServerRouteMeter): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const localRM = await getRouteMeterById(routeId, meterId);
    if (!localRM) {
        console.error(`Cannot reconcile updated RouteMeter: Link for route ${routeId}, meter ${meterId} not found locally.`);
        return;
    }

    if (serverRouteMeter.version !== undefined && localRM.version !== undefined && serverRouteMeter.version < localRM.version) {
        console.warn(`RouteMeter ${routeId}_${meterId}: Local version (${localRM.version}) is newer than server version (${serverRouteMeter.version}). Server data not applied.`);
        await updateRouteMeter({ routeId, meterId, syncStatus: 'conflicted' });
        return;
    }

    const lastModified = Math.floor(new Date(serverRouteMeter.updatedAt).getTime() / 1000);
    const visitDateTimestamp = serverRouteMeter.visitDate ? Math.floor(new Date(serverRouteMeter.visitDate).getTime() / 1000) : localRM.visitDate;

    const query = `
        UPDATE RouteMeters
        SET sequenceOrder = ?, status = ?, visitDate = ?, notes = ?,
            syncStatus = 'synced', lastModified = ?, version = ?, serverId = ?
        WHERE routeId = ? AND meterId = ?;
    `;
    const params = [
        serverRouteMeter.sequenceOrder,
        serverRouteMeter.status,
        visitDateTimestamp,
        serverRouteMeter.notes,
        lastModified,
        serverRouteMeter.version,
        serverRouteMeter.id, // server's ID for the link
        routeId,
        meterId
    ];

    try {
        await executeSql(query, params);
        console.log(`RouteMeter ${routeId}_${meterId} reconciled with server data (version: ${serverRouteMeter.version}).`);
    } catch (error) {
        console.error(`Error reconciling updated RouteMeter ${routeId}_${meterId}:`, error);
        await updateRouteMeter({ routeId, meterId, syncStatus: 'error' });
        throw error;
    }
};

export const reconcileDeletedRouteMeter = async (routeId: string, meterId: string): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const localRM = await getRouteMeterById(routeId, meterId);
    if (!localRM) {
        console.warn(`RouteMeter ${routeId}_${meterId} already deleted locally or never existed.`);
        return;
    }

    const query = "DELETE FROM RouteMeters WHERE routeId = ? AND meterId = ?;";
    try {
        await executeSql(query, [routeId, meterId]);
        console.log(`RouteMeter ${routeId}_${meterId} confirmed deleted locally after server reconciliation.`);
    } catch (error) {
        console.error(`Error deleting RouteMeter ${routeId}_${meterId} locally during reconciliation:`, error);
        throw error;
    }
};

export const reconcileBatchUpdateSequence = async (routeId: string, serverResponse: ServerBatchResponse): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    if (!serverResponse.success) {
        console.error(`Server reported failure for BATCH_UPDATE_ROUTEMETER_SEQUENCE for route ${routeId}. Errors:`, serverResponse.errors);
        // Potentially mark all involved local RouteMeters for this route as 'error' or 'conflicted'
        const localRouteMeters = await getRouteMetersByRouteId(routeId);
        for (const rm of localRouteMeters) {
            await updateRouteMeter({ routeId: rm.routeId, meterId: rm.meterId, syncStatus: 'error' });
        }
        return;
    }

    if (serverResponse.items && serverResponse.items.length > 0) {
        for (const serverRM of serverResponse.items) {
            // Assuming server returns the full updated state of each item
            await reconcileUpdatedRouteMeter(serverRM.routeId, serverRM.meterId, serverRM); 
        }
        console.log(`Batch sequence update for route ${routeId} reconciled with ${serverResponse.items.length} items.`);
    } else {
        // If server just confirms success without returning items, we might just mark local items as synced.
        // This requires knowing which items were part of the batch.
        // For now, we assume if items are not returned, we can't do fine-grained reconciliation here.
        // A better approach: the offline queue item for batch update should contain the list of meterIds and their new sequences.
        // Then, on success, iterate that local list and update their syncStatus.
        console.log(`Batch sequence update for route ${routeId} successful on server. Local items may need individual sync status updates if not covered by serverResponse.items.`);
        // As a fallback, mark all items in the route as synced if no specific items are returned.
        // This is a broad assumption and might not be accurate.
        const localRouteMeters = await getRouteMetersByRouteId(routeId);
        for (const rm of localRouteMeters) {
             // Only update if it was pending, to avoid overriding 'conflicted' or 'error' states without specific server data.
            if (rm.syncStatus === 'pending') { 
                await updateRouteMeter({ 
                    routeId: rm.routeId, 
                    meterId: rm.meterId, 
                    syncStatus: 'synced', 
                    // We don't have new version or lastModified from server in this scenario
                });
            }
        }
    }
};

export const reconcileDeletedRouteMetersByRouteId = async (routeId: string): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const localRMs = await getRouteMetersByRouteId(routeId);
    if (localRMs.length === 0) {
        console.warn(`No RouteMeters found locally for route ${routeId} to reconcile after batch delete.`);
        return;
    }

    const query = "DELETE FROM RouteMeters WHERE routeId = ?;";
    try {
        await executeSql(query, [routeId]);
        console.log(`All RouteMeters for route ${routeId} confirmed deleted locally after server reconciliation.`);
    } catch (error) {
        console.error(`Error batch deleting RouteMeters for route ${routeId} locally during reconciliation:`, error);
        // If deletion fails, the local items might need to be marked as 'error' or 'conflicted'.
        for (const rm of localRMs) {
            await updateRouteMeter({ routeId: rm.routeId, meterId: rm.meterId, syncStatus: 'error' });
        }
        throw error;
    }
};
