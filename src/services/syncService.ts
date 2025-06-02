import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as offlineQueueRepository from '../database/offlineQueueRepository';
import { OfflineQueueItem, OfflineOperationType, Setting, ServerIncident } from '../types/databaseModels'; // Import ServerIncident
import { getDBConnection } from './databaseService';
import { useAuthStore } from '../store/authStore'; // Corrected import

// Import repositories for data reconciliation
import * as meterRepository from '../database/meterRepository';
import { ServerMeter } from '../database/meterRepository'; // Import ServerMeter
import * as readingRepository from '../database/readingRepository';
import { ServerReading } from '../database/readingRepository'; // Import ServerReading
import * as incidentRepository from '../database/incidentRepository';
import * as routeRepository from '../database/routeRepository';
import { ServerRoute } from '../database/routeRepository'; // Import ServerRoute
import * as routeMeterRepository from '../database/routeMeterRepository';
import { ServerRouteMeter, ServerBatchResponse } from '../database/routeMeterRepository'; // Importar ServerRouteMeter y ServerBatchResponse
import * as settingsRepository from '../database/settingsRepository';
import { ServerSetting } from '../database/settingsRepository'; // Import ServerSetting

// Actual API base URL
const API_BASE_URL = 'https://gila-api.example.com/api/v1';
const API_TIMEOUT = 15000; // 15 seconds

// Define SyncStatus type and initial status
export interface SyncStatus { // Exporting SyncStatus
  status: 'idle' | 'syncing' | 'success' | 'error';
  message?: string;
  newRoutesCount?: number;
  updatedRoutesCount?: number;
  newMetersCount?: number;
  // Add other relevant counts as needed
}

let currentSyncStatus: SyncStatus = { status: 'idle' };

// Function to update and get current sync status
const updateSyncStatus = (status: SyncStatus) => {
  currentSyncStatus = status;
  // Here you might want to emit an event or call a listener 
  // if NetworkStatusIndicator is subscribing to changes.
};

export const getSyncStatus = (): SyncStatus => { // Exporting getSyncStatus
  return currentSyncStatus;
};

export const clearSyncStatus = () => { // Exporting clearSyncStatus
  updateSyncStatus({ status: 'idle' });
};

let isSyncing = false;
let currentNetworkState: NetInfoState | null = null;
let unsubscribeNetInfoListener: (() => void) | null = null; // Added for managing the listener
let syncIntervalId: NodeJS.Timeout | null = null; // For periodic sync

const getApiDetails = (operationType: OfflineOperationType, payload: any, item: OfflineQueueItem): { method: 'POST' | 'PUT' | 'DELETE', url: string } => {
    const entityId = item.entityId ?? payload?.id; // Use ??, ensure payload exists for id
    const relatedEntityId = item.relatedEntityId;

    switch (operationType) {
        // Meter operations
        case 'CREATE_METER': return { method: 'POST', url: `${API_BASE_URL}/meters` };
        case 'UPDATE_METER': return { method: 'PUT', url: `${API_BASE_URL}/meters/${entityId}` };
        case 'DELETE_METER': return { method: 'DELETE', url: `${API_BASE_URL}/meters/${entityId}` };

        // Reading operations
        case 'CREATE_READING': return { method: 'POST', url: `${API_BASE_URL}/meters/${payload.meterId}/readings` };
        case 'UPDATE_READING': return { method: 'PUT', url: `${API_BASE_URL}/meters/${payload.meterId}/readings/${entityId}` };
        case 'DELETE_READING': return { method: 'DELETE', url: `${API_BASE_URL}/meters/${payload.meterId}/readings/${entityId}` };

        // Incident operations
        case 'CREATE_INCIDENT': return { method: 'POST', url: `${API_BASE_URL}/meters/${payload.meterId}/incidents` };
        case 'UPDATE_INCIDENT': return { method: 'PUT', url: `${API_BASE_URL}/meters/${payload.meterId}/incidents/${entityId}` };
        case 'DELETE_INCIDENT': return { method: 'DELETE', url: `${API_BASE_URL}/meters/${payload.meterId}/incidents/${entityId}` };

        // Route operations
        case 'CREATE_ROUTE': return { method: 'POST', url: `${API_BASE_URL}/routes` };
        case 'UPDATE_ROUTE': return { method: 'PUT', url: `${API_BASE_URL}/routes/${entityId}` };
        case 'DELETE_ROUTE': return { method: 'DELETE', url: `${API_BASE_URL}/routes/${entityId}` };

        // RouteMeter operations
        case 'CREATE_ROUTEMETER': return { method: 'POST', url: `${API_BASE_URL}/routes/${relatedEntityId}/meters` }; // payload contains meterId
        case 'UPDATE_ROUTEMETER': return { method: 'PUT', url: `${API_BASE_URL}/routes/${relatedEntityId}/meters/${payload.meterId}` }; // payload.meterId is the target meter
        case 'DELETE_ROUTEMETER': return { method: 'DELETE', url: `${API_BASE_URL}/routes/${relatedEntityId}/meters/${payload.meterId}` }; // payload.meterId
        case 'BATCH_UPDATE_ROUTEMETER_SEQUENCE': return { method: 'PUT', url: `${API_BASE_URL}/routes/${relatedEntityId}/meters/sequence` };
        case 'DELETE_ROUTEMETERS_BY_ROUTEID': return { method: 'DELETE', url: `${API_BASE_URL}/routes/${entityId}/meters` }; // entityId is routeId

        // Settings operations
        case 'CREATE_SETTING': return { method: 'POST', url: `${API_BASE_URL}/settings` };
        case 'UPDATE_SETTING': return { method: 'PUT', url: `${API_BASE_URL}/settings/${entityId}` }; // entityId is setting key
        case 'DELETE_SETTING': return { method: 'DELETE', url: `${API_BASE_URL}/settings/${entityId}` }; // entityId is setting key
        case 'UPSERT_SETTING': return { method: 'PUT', url: `${API_BASE_URL}/settings/${(payload as Setting).key}` };
        
        default: {
            // Handle exhaustive check safely
            const exhaustiveCheck: never = operationType;
            console.error(`Unknown operation type: ${exhaustiveCheck}`);
            throw new Error(`Unknown operation type: ${exhaustiveCheck}`);
        }
    }
};

const parsePayload = (payloadString: string | object): object | null => {
    if (typeof payloadString === 'object') {
        return payloadString; // Already an object
    }
    try {
        return JSON.parse(payloadString);
    } catch (e) {
        console.error('Sync: Failed to parse payload string.', e, 'Raw payload:', payloadString);
        return null;
    }
};

interface ApiCallResult {
    success: boolean;
    data?: any;
    errorDetails?: any;
}

const makeApiCall = async (
    method: 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload: any,
    token: string | null
): Promise<ApiCallResult> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: AxiosRequestConfig = {
        method,
        url,
        data: (method === 'POST' || method === 'PUT') ? payload : undefined,
        headers,
        timeout: API_TIMEOUT,
    };

    try {
        const response: AxiosResponse = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        const axiosError = error as AxiosError;
        console.error(`Sync: API call ${method} ${url} failed:`, axiosError.response?.data ?? axiosError.message);
        let errorDetails: any = { message: axiosError.message, code: axiosError.code };
        if (axiosError.response) {
            errorDetails = { ...errorDetails, status: axiosError.response.status, data: axiosError.response.data };
        }
        if (axiosError.isAxiosError && axiosError.code === 'ECONNABORTED') {
            console.warn(`Sync: API call timed out for ${method} ${url}.`);
            errorDetails.isTimeout = true;
        }
        return { success: false, errorDetails };
    }
};

// Helper function to handle data reconciliation based on operation type
const handleReconciliation = async (item: OfflineQueueItem, payloadObject: any, serverResponseData: any) => {
    const localEntityId = item.entityId;

    // Placeholder: In a real scenario, each repository would have methods like:
    // reconcileCreatedEntity(localTempId, serverData)
    // reconcileUpdatedEntity(entityId, serverData)
    // reconcileDeletedEntity(entityId)
    // reconcileBatchOperation(relatedId, payload, serverData)
    // These methods would update local DB: change syncStatus to 'synced', update IDs if server sends new ones, merge data.

    switch (item.operationType) {
        // Meter
        case 'CREATE_METER': {
            if (localEntityId && serverResponseData) {
                console.log(`Sync: Reconciling CREATE_METER for local ID ${localEntityId}`);
                await meterRepository.reconcileCreatedMeter(localEntityId, serverResponseData as ServerMeter);
            }
            break;
        }
        case 'UPDATE_METER': {
            if (localEntityId && serverResponseData) {
                console.log(`Sync: Reconciling UPDATE_METER for local ID ${localEntityId}`);
                await meterRepository.reconcileUpdatedMeter(localEntityId, serverResponseData as ServerMeter);
            }
            break;
        }
        case 'DELETE_METER': {
            if (localEntityId) {
                console.log(`Sync: Reconciling DELETE_METER for local ID ${localEntityId}`);
                // Assuming serverResponseData might contain the serverId if available, though not strictly needed by current reconcileDeletedMeter
                const serverId = serverResponseData?.id;
                await meterRepository.reconcileDeletedMeter(localEntityId, serverId);
            }
            break;
        }

        // Reading
        case 'CREATE_READING': {
            if (localEntityId && serverResponseData) {
                console.log(`Sync: Reconciling CREATE_READING for local ID ${localEntityId}`);
                await readingRepository.reconcileCreatedReading(localEntityId, serverResponseData); // Removed 'as ServerReading'
            }
            break;
        }
        case 'UPDATE_READING': {
            if (localEntityId && serverResponseData) {
                console.log(`Sync: Reconciling UPDATE_READING for local ID ${localEntityId}`);
                await readingRepository.reconcileUpdatedReading(localEntityId, serverResponseData); // Removed 'as ServerReading'
            }
            break;
        }
        case 'DELETE_READING': {
            if (localEntityId) {
                console.log(`Sync: Reconciling DELETE_READING for local ID ${localEntityId}`);
                await readingRepository.reconcileDeletedReading(localEntityId, serverResponseData?.id); // Pass serverId if available
            }
            break;
        }

        // Incident
        case 'CREATE_INCIDENT': {
            if (localEntityId && serverResponseData) {
                console.log(`Sync: Reconciling CREATE_INCIDENT for local ID ${localEntityId}`);
                await incidentRepository.reconcileCreatedIncident(localEntityId, serverResponseData as ServerIncident);
            }
            break;
        }
        case 'UPDATE_INCIDENT': {
            if (localEntityId && serverResponseData) {
                console.log(`Sync: Reconciling UPDATE_INCIDENT for local ID ${localEntityId}`);
                await incidentRepository.reconcileUpdatedIncident(localEntityId, serverResponseData as ServerIncident);
            }
            break;
        }
        case 'DELETE_INCIDENT': {
            if (localEntityId) {
                console.log(`Sync: Reconciling DELETE_INCIDENT for local ID ${localEntityId}`);
                await incidentRepository.reconcileDeletedIncident(localEntityId);
            }
            break;
        }

        // Route
        case 'CREATE_ROUTE': {
            if (localEntityId && serverResponseData) {
                console.log(`Sync: Reconciling CREATE_ROUTE for local ID ${localEntityId}`);
                await routeRepository.reconcileCreatedRoute(localEntityId, serverResponseData as ServerRoute);
            }
            break;
        }
        case 'UPDATE_ROUTE': {
            if (localEntityId && serverResponseData) {
                console.log(`Sync: Reconciling UPDATE_ROUTE for local ID ${localEntityId}`);
                await routeRepository.reconcileUpdatedRoute(localEntityId, serverResponseData as ServerRoute);
            }
            break;
        }
        case 'DELETE_ROUTE': {
            if (localEntityId) {
                console.log(`Sync: Reconciling DELETE_ROUTE for local ID ${localEntityId}`);
                await routeRepository.reconcileDeletedRoute(localEntityId);
            }
            break;
        }

        // RouteMeter
        case 'CREATE_ROUTEMETER': { 
            // entityId in OfflineQueueItem for CREATE_ROUTEMETER is a composite `${routeId}_${meterId}` or a temp UUID.
            // serverResponseData should be ServerRouteMeter. We need routeId and meterId for local reconciliation.
            // Let's assume payloadObject contains routeId and meterId, or they are part of serverResponseData.
            if (payloadObject && serverResponseData) {
                const { routeId, meterId } = payloadObject; // Assuming payload has these for local identification
                if (routeId && meterId) {
                    console.log(`Sync: Reconciling CREATE_ROUTEMETER for route ${routeId}, meter ${meterId}`);
                    // The first argument to reconcileCreatedRouteMeter was localCompositeId, which might be item.entityId
                    // For now, assuming serverResponseData is ServerRouteMeter and contains the necessary IDs.
                    await routeMeterRepository.reconcileCreatedRouteMeter(item.entityId!, serverResponseData as ServerRouteMeter);
                } else {
                    console.error('Sync: Missing routeId or meterId in payload for CREATE_ROUTEMETER reconciliation');
                }
            }
            break;
        }
        case 'UPDATE_ROUTEMETER': { 
            if (payloadObject && serverResponseData) {
                const { routeId, meterId } = payloadObject; // Assuming payload has these
                 if (routeId && meterId) {
                    console.log(`Sync: Reconciling UPDATE_ROUTEMETER for route ${routeId}, meter ${meterId}`);
                    await routeMeterRepository.reconcileUpdatedRouteMeter(routeId, meterId, serverResponseData as ServerRouteMeter);
                } else {
                    console.error('Sync: Missing routeId or meterId in payload for UPDATE_ROUTEMETER reconciliation');
                }
            }
            break;
        }
        case 'DELETE_ROUTEMETER': { 
            if (payloadObject) {
                const { routeId, meterId } = payloadObject; // Assuming payload has these
                if (routeId && meterId) {
                    console.log(`Sync: Reconciling DELETE_ROUTEMETER for route ${routeId}, meter ${meterId}`);
                    await routeMeterRepository.reconcileDeletedRouteMeter(routeId, meterId);
                } else {
                     console.error('Sync: Missing routeId or meterId in payload for DELETE_ROUTEMETER reconciliation');
                }
            }
            break;
        }
        case 'BATCH_UPDATE_ROUTEMETER_SEQUENCE': { 
            if (item.relatedEntityId && serverResponseData) { // relatedEntityId is routeId
                console.log(`Sync: Reconciling BATCH_UPDATE_ROUTEMETER_SEQUENCE for route ${item.relatedEntityId}`);
                // TODO: Implement reconcileBatchSequenceUpdate in routeMeterRepository
                // For now, just log that the sync was successful without reconciliation
                console.warn(`Sync: Batch sequence update reconciliation not yet implemented for route ${item.relatedEntityId}. Marking as completed without local data reconciliation.`);
            }
            break;
        }
        case 'DELETE_ROUTEMETERS_BY_ROUTEID': { // entityId is routeId
            if (localEntityId) {
                console.log(`Sync: Reconciling DELETE_ROUTEMETERS_BY_ROUTEID for route ${localEntityId}`);
                // TODO: Implement reconcileDeletedRouteMeters in routeMeterRepository
                // For now, just log that the sync was successful without reconciliation
                console.warn(`Sync: Delete route meters reconciliation not yet implemented for route ${localEntityId}. Marking as completed without local data reconciliation.`);
            }
            break;
        }

        // Settings
        case 'CREATE_SETTING': 
        case 'UPDATE_SETTING': 
        case 'UPSERT_SETTING': { 
            const settingKey = item.entityId ?? (payloadObject as Setting)?.key;
            if (settingKey && serverResponseData) {
                console.log(`Sync: Reconciling ${item.operationType} for setting key ${settingKey}`);
                await settingsRepository.reconcileUpsertedSetting(settingKey, serverResponseData as ServerSetting);
            }
            break;
        }
        case 'DELETE_SETTING': {
            if (localEntityId) { // entityId is setting key
                console.log(`Sync: Reconciling DELETE_SETTING for setting key ${localEntityId}`);
                await settingsRepository.reconcileDeletedSetting(localEntityId);
            }
            break;
        }
        
        default: {
            // Exhaustive check for unhandled operation types
            const exhaustiveCheck: never = item.operationType;
            console.warn(`Sync: No specific reconciliation logic for ${exhaustiveCheck}. Item ${item.id} will be marked completed without data merge.`);
        }
    }
};

const processQueueItem = async (item: OfflineQueueItem): Promise<void> => {
    if (!currentNetworkState?.isInternetReachable) {
        console.log(`Sync: Internet not reachable. Skipping item ${item.id}.`);
        return;
    }

    const currentAttempts = item.attempts;
    await offlineQueueRepository.updateQueueItemStatus(item.id, 'processing', 1);

    const payloadObject = parsePayload(item.payload);
    if (!payloadObject) {
        await offlineQueueRepository.updateQueueItemStatus(item.id, 'failed', 0, JSON.stringify({ error: 'Payload parse error' }));
        return;
    }

    let apiDetails;
    try {
        apiDetails = getApiDetails(item.operationType, payloadObject, item);
    } catch (e) {
        console.error(`Sync: Failed to get API details for item ${item.id} (${item.operationType}). Marking as failed.`, e);
        await offlineQueueRepository.updateQueueItemStatus(item.id, 'failed', 0, JSON.stringify({ error: 'API details error', details: (e as Error).message }));
        return;
    }

    console.log(`Sync: Attempting ${apiDetails.method} ${apiDetails.url} for item ${item.id} (Attempt: ${currentAttempts + 1})`);
    const token = useAuthStore.getState().accessToken;
    const result = await makeApiCall(apiDetails.method, apiDetails.url, payloadObject, token);

    if (result.success) {
        console.log(`Sync: Item ${item.id} (${item.operationType}) synced successfully with server.`);
        try {
            const serverResponseData = result.data;

            // Validation for localEntityId based on operation type
            const isCreateOperation = item.operationType.startsWith('CREATE_');
            const requiresLocalEntityIdForUpdateOrDelete = !isCreateOperation && 
                !['BATCH_UPDATE_ROUTEMETER_SEQUENCE', 'DELETE_ROUTEMETERS_BY_ROUTEID', 'UPSERT_SETTING'].includes(item.operationType);

            if (isCreateOperation && !item.entityId) {
                console.warn(`Sync: localEntityId (client-side temporary ID) is missing for ${item.operationType} on item ${item.id}. Cannot reconcile.`);
                await offlineQueueRepository.updateQueueItemStatus(item.id, 'failed', 0, JSON.stringify({ error: 'Missing client-side localEntityId for CREATE operation reconciliation' }));
                return;
            }
            if (requiresLocalEntityIdForUpdateOrDelete && !item.entityId) {
                 console.warn(`Sync: localEntityId is missing for ${item.operationType} on item ${item.id}. Cannot reconcile.`);
                 await offlineQueueRepository.updateQueueItemStatus(item.id, 'failed', 0, JSON.stringify({ error: 'Missing localEntityId for reconciliation' }));
                 return;
            }

            // Call the reconciliation handler
            await handleReconciliation(item, payloadObject, serverResponseData);

            await offlineQueueRepository.updateQueueItemStatus(item.id, 'completed', 0);
            console.log(`Sync: Item ${item.id} (${item.operationType}) processed and marked completed.`);

        } catch (reconciliationError) {
            console.error(`Sync: Error during data reconciliation for item ${item.id} (${item.operationType}):`, reconciliationError);
            await offlineQueueRepository.updateQueueItemStatus(item.id, 'failed', 0, JSON.stringify({ error: 'Reconciliation failed', details: (reconciliationError as Error).message }));
        }
    } else {
        console.warn(`Sync: Item ${item.id} (${item.operationType}) failed. Error:`, result.errorDetails);
        await offlineQueueRepository.updateQueueItemStatus(item.id, 'failed', 0, JSON.stringify(result.errorDetails ?? { error: 'Unknown API call failure' }));
    }
};

export const triggerSync = async (isManualTrigger: boolean = false): Promise<void> => { // Added isManualTrigger parameter
    if (isSyncing) {
        console.log('Sync: Already in progress.');
        if (isManualTrigger) {
            updateSyncStatus({ status: 'idle', message: 'Sync: Already in progress.' });
        }
        return;
    }
    if (!currentNetworkState?.isInternetReachable) {
        console.log('Sync: No internet connection, sync aborted.');
        updateSyncStatus({ status: 'error', message: 'Sync: No internet connection, sync aborted.' });
        return;
    }
    const db = getDBConnection();
    if (!db) {
        console.error('Sync: Database not open, sync aborted.');
        updateSyncStatus({ status: 'error', message: 'Sync: Database not open, sync aborted.' });
        return;
    }

    isSyncing = true;
    console.log('Sync: Starting synchronization process...');
    updateSyncStatus({ status: 'syncing', message: 'Sync: Starting synchronization...' });

    let summary = {
        processedItems: 0,
        completedItems: 0,
        failedItems: 0,
        newRoutes: 0, // Example: count new routes fetched
        // Add other relevant summary data points
    };

    try {
        // Placeholder for fetching new data from server (e.g., routes, meters)
        // This would typically happen before or after processing the offline queue
        // For now, let's simulate fetching some data if it's a manual trigger or periodic sync
        if (isManualTrigger || !isSyncing) { // Assuming periodic sync also might fetch
            // const fetchedDataSummary = await fetchDataFromServer();
            // summary.newRoutes = fetchedDataSummary.newRoutesCount || 0;
            // console.log('Sync: Fetched data from server.', fetchedDataSummary);
        }

        const pendingItems = await offlineQueueRepository.getPendingOperations();
        if (pendingItems.length === 0) {
            console.log('Sync: No pending items to sync.');
            // updateSyncStatus({ status: 'success', message: 'Sync: No pending items.' }); // Already handled in finally
            // return; // Allow to proceed to finally
        }

        summary.processedItems = pendingItems.length;
        console.log(`Sync: Found ${pendingItems.length} items to process.`);

        for (const item of pendingItems) {
            if (!currentNetworkState?.isInternetReachable) {
                console.log('Sync: Internet connection lost during sync process. Aborting further processing.');
                summary.failedItems = pendingItems.length - summary.completedItems;
                updateSyncStatus({ status: 'error', message: 'Sync: Internet lost during sync.' });
                break;
            }
            await processQueueItem(item); // processQueueItem should update item status in DB
            // We need to check the result of processQueueItem or re-fetch to count completed/failed accurately
        }
        
        // After processing, re-fetch to see actual completed/failed counts if processQueueItem doesn't return it
        const finalPendingItems = await offlineQueueRepository.getPendingOperations();
        summary.failedItems = finalPendingItems.filter(it => it.status === 'failed').length;
        summary.completedItems = summary.processedItems - finalPendingItems.filter(it => it.status !== 'completed').length;


        const clearedCount = await offlineQueueRepository.clearCompletedOperations();
        if (clearedCount > 0) {
            console.log(`Sync: Cleared ${clearedCount} completed items from the queue.`);
        }

        let successMessage = 'Sync: Synchronization process finished.';
        if (summary.newRoutes > 0) {
            successMessage += ` ${summary.newRoutes} new routes.`;
        }
        if (summary.completedItems > 0) {
            successMessage += ` ${summary.completedItems} items synced.`;
        }
        if (summary.failedItems > 0) {
            successMessage += ` ${summary.failedItems} items failed.`;
            updateSyncStatus({ status: 'error', message: successMessage });
        } else if (summary.processedItems === 0 && summary.newRoutes === 0) {
            updateSyncStatus({ status: 'success', message: 'Sync: No changes to sync.' });
        } else {
            updateSyncStatus({ status: 'success', message: successMessage });
        }

    } catch (error) {
        console.error('Sync: Error during synchronization process:', error);
        updateSyncStatus({ status: 'error', message: `Sync: Error - ${(error as Error).message}` });
    } finally {
        isSyncing = false;
        console.log('Sync: Synchronization process finished.');
        // The status is updated within try/catch now
    }
};

export const initializeSyncService = () => {
    console.log('SyncService: Initializing...');

    if (unsubscribeNetInfoListener) {
        console.log('SyncService: Removing existing network state listener.');
        unsubscribeNetInfoListener();
        unsubscribeNetInfoListener = null;
    }
    if (syncIntervalId) {
        console.log('SyncService: Clearing existing sync interval.');
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }

    NetInfo.fetch().then(initialNetState => {
        currentNetworkState = initialNetState;
        console.log('SyncService: Initial network state fetched:', initialNetState);

        console.log('SyncService: Adding network state listener.');
        unsubscribeNetInfoListener = NetInfo.addEventListener(netState => {
            const previousState = currentNetworkState;
            currentNetworkState = netState;
            console.log('SyncService: Network state changed (listener):', netState);

            if (netState.isConnected && netState.isInternetReachable) {
                if (!previousState?.isInternetReachable) {
                    console.log('SyncService: Internet connection restored via listener. Triggering sync.');
                    triggerSync();
                }
            } else {
                console.log('SyncService: Internet connection lost or not reachable (listener).');
            }
        });

        // Removed initial sync with setTimeout:
        // if (initialNetState.isConnected && initialNetState.isInternetReachable) {
        //     console.log('SyncService: Internet connected on init. Scheduling initial sync.');
        //     setTimeout(triggerSync, 2000);
        // } else {
        //     console.log('SyncService Init: No internet or not reachable on init. Initial sync deferred.');
        // }

        // Set up periodic sync (e.g., every 5 minutes)
        syncIntervalId = setInterval(() => {
            console.log('SyncService: Periodic sync triggered (every 5 minutes).');
            if (currentNetworkState?.isInternetReachable) {
                triggerSync();
            } else {
                console.log('SyncService: Periodic sync skipped, no internet.');
            }
        }, 5 * 60 * 1000); // 5 minutes in milliseconds
        console.log('SyncService: Periodic sync interval (5 minutes) set up.');

    }).catch(error => {
        console.error('SyncService: Failed to fetch initial network state during initialization:', error);
    });
};

export const manualTriggerSync = () => {
    if (!currentNetworkState?.isInternetReachable) {
        console.warn("Manual sync trigger: No internet connection.");
        updateSyncStatus({status: 'error', message: 'Manual Sync: No internet.'});
        return;
    }
    console.log('SyncService: Manual sync triggered.');
    triggerSync(true); // Pass true for manual trigger
};
