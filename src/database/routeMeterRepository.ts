import { executeSql, getDBConnection } from '../services/databaseService';

export interface RouteMeter {
  routeId: string;
  meterId: string;
  sequenceOrder: number; // Cambiado de orderInRoute
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  visitDate?: string | null;
  notes?: string | null;
  syncStatus: 'pending' | 'synced' | 'error';
  lastModified?: number;
}

const mapRowToRouteMeter = (row: any): RouteMeter => {
  return {
    routeId: row.routeId,
    meterId: row.meterId,
    sequenceOrder: row.sequenceOrder, // Cambiado
    status: row.status,
    visitDate: row.visitDate,
    notes: row.notes,
    syncStatus: row.syncStatus,
    lastModified: row.lastModified,
  };
};

export const getMetersByRouteId = async (routeId: string): Promise<RouteMeter[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  
  const query = `
    SELECT * FROM RouteMeters 
    WHERE routeId = ? 
    ORDER BY sequenceOrder ASC
  `;
  
  try {
    const results = await executeSql(query, [routeId]);
    const routeMeters: RouteMeter[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      routeMeters.push(mapRowToRouteMeter(results.rows.item(i)));
    }
    return routeMeters;
  } catch (error) {
    console.error(`Error fetching meters for route ${routeId}:`, error);
    throw error;
  }
};

export const addMeterToRoute = async (
  routeId: string, 
  meterId: string, 
  sequenceOrder: number
): Promise<RouteMeter> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  
  const query = `
    INSERT INTO RouteMeters (routeId, meterId, sequenceOrder, status, syncStatus, lastModified)
    VALUES (?, ?, ?, 'pending', 'pending', strftime('%s','now'))
  `;
  
  const params = [routeId, meterId, sequenceOrder];
  
  try {
    console.log('RouteMeterRepository: Executing addMeterToRoute with params:', params);
    const result = await executeSql(query, params);
    console.log('RouteMeterRepository: addMeterToRoute result:', result);
    
    // Return the created RouteMeter
    const routeMeter: RouteMeter = {
      routeId,
      meterId,
      sequenceOrder,
      status: 'pending',
      visitDate: null,
      notes: null,
      syncStatus: 'pending',
      lastModified: Math.floor(Date.now() / 1000)
    };
    
    console.log('RouteMeterRepository: Created RouteMeter:', routeMeter);
    return routeMeter;
  } catch (error) {
    console.error('RouteMeterRepository: Error in addMeterToRoute:', error);
    throw error;
  }
};

export const updateRouteMeterStatus = async (
  id: string, 
  status: RouteMeter['status'],
  actualStartTime?: number,
  actualEndTime?: number,
  notes?: string
): Promise<void> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  const query = `
    UPDATE RouteMeters 
    SET status = ?, actualStartTime = ?, actualEndTime = ?, notes = ?
    WHERE id = ?
  `;
  
  const params = [status, actualStartTime || null, actualEndTime || null, notes || null, id];
  
  try {
    await executeSql(query, params);
    console.log(`RouteMeter ${id} status updated to ${status}`);
  } catch (error) {
    console.error(`Error updating RouteMeter ${id}:`, error);
    throw error;
  }
};

export const getRouteProgress = async (routeId: string): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  skipped: number;
}> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  const query = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
    FROM RouteMeters 
    WHERE routeId = ?
  `;
  
  try {
    const results = await executeSql(query, [routeId]);
    if (results.rows.length > 0) {
      const row = results.rows.item(0);
      return {
        total: row.total || 0,
        completed: row.completed || 0,
        inProgress: row.inProgress || 0,
        pending: row.pending || 0,
        skipped: row.skipped || 0,
      };
    }
    return { total: 0, completed: 0, inProgress: 0, pending: 0, skipped: 0 };
  } catch (error) {
    console.error(`Error getting route progress for ${routeId}:`, error);
    throw error;
  }
};

// Add server interfaces for reconciliation
export interface ServerRouteMeter {
  routeId: string;
  meterId: string;
  sequenceOrder: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  visitDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

export interface ServerBatchResponse {
  routeId: string;
  updatedMeters: ServerRouteMeter[];
  success: boolean;
  message?: string;
}

// Add reconciliation methods
export const reconcileCreatedRouteMeter = async (localCompositeId: string, serverRouteMeter: ServerRouteMeter): Promise<void> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  const lastModified = Math.floor(new Date(serverRouteMeter.updatedAt).getTime() / 1000);

  const query = `
    UPDATE RouteMeters
    SET sequenceOrder = ?, status = ?, visitDate = ?, notes = ?,
        syncStatus = 'synced', lastModified = ?
    WHERE routeId = ? AND meterId = ?;
  `;
  
  const params = [
    serverRouteMeter.sequenceOrder,
    serverRouteMeter.status,
    serverRouteMeter.visitDate,
    serverRouteMeter.notes,
    lastModified,
    serverRouteMeter.routeId,
    serverRouteMeter.meterId
  ];

  try {
    await executeSql(query, params);
    console.log(`RouteMeter ${localCompositeId} reconciled with server data`);
  } catch (error) {
    console.error(`Error reconciling created RouteMeter ${localCompositeId}:`, error);
    throw error;
  }
};

export const reconcileUpdatedRouteMeter = async (routeId: string, meterId: string, serverRouteMeter: ServerRouteMeter): Promise<void> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  const lastModified = Math.floor(new Date(serverRouteMeter.updatedAt).getTime() / 1000);

  const query = `
    UPDATE RouteMeters
    SET sequenceOrder = ?, status = ?, visitDate = ?, notes = ?,
        syncStatus = 'synced', lastModified = ?
    WHERE routeId = ? AND meterId = ?;
  `;
  
  const params = [
    serverRouteMeter.sequenceOrder,
    serverRouteMeter.status,
    serverRouteMeter.visitDate,
    serverRouteMeter.notes,
    lastModified,
    routeId,
    meterId
  ];

  try {
    await executeSql(query, params);
    console.log(`RouteMeter ${routeId}/${meterId} reconciled with server data`);
  } catch (error) {
    console.error(`Error reconciling updated RouteMeter ${routeId}/${meterId}:`, error);
    throw error;
  }
};

export const reconcileDeletedRouteMeter = async (routeId: string, meterId: string): Promise<void> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  const query = "DELETE FROM RouteMeters WHERE routeId = ? AND meterId = ?;";
  
  try {
    await executeSql(query, [routeId, meterId]);
    console.log(`RouteMeter ${routeId}/${meterId} confirmed deleted locally after server reconciliation`);
  } catch (error) {
    console.error(`Error deleting RouteMeter ${routeId}/${meterId} during reconciliation:`, error);
    throw error;
  }
};

export const reconcileBatchSequenceUpdate = async (routeId: string, payload: any, serverResponse: ServerBatchResponse): Promise<void> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  if (!serverResponse.success) {
    console.warn(`Batch sequence update for route ${routeId} failed on server: ${serverResponse.message}`);
    return;
  }

  try {
    // Update each meter's sequence order based on server response
    for (const serverMeter of serverResponse.updatedMeters) {
      const lastModified = Math.floor(new Date(serverMeter.updatedAt).getTime() / 1000);
      
      const query = `
        UPDATE RouteMeters
        SET sequenceOrder = ?, syncStatus = 'synced', lastModified = ?
        WHERE routeId = ? AND meterId = ?;
      `;
      
      const params = [
        serverMeter.sequenceOrder,
        lastModified,
        serverMeter.routeId,
        serverMeter.meterId
      ];

      await executeSql(query, params);
    }
    
    console.log(`Batch sequence update for route ${routeId} reconciled successfully`);
  } catch (error) {
    console.error(`Error reconciling batch sequence update for route ${routeId}:`, error);
    throw error;
  }
};

export const reconcileDeletedRouteMeters = async (routeId: string): Promise<void> => {
  const db = getDBConnection();
  if (!db) throw new Error('Database not open.');

  const query = "DELETE FROM RouteMeters WHERE routeId = ?;";
  
  try {
    const result = await executeSql(query, [routeId]);
    console.log(`All RouteMeters for route ${routeId} confirmed deleted locally after server reconciliation. Rows affected: ${result.rowsAffected}`);
  } catch (error) {
    console.error(`Error deleting RouteMeters for route ${routeId} during reconciliation:`, error);
    throw error;
  }
};
