export type SyncStatusType = 'pending' | 'synced' | 'failed' | 'error' | 'conflicted'; // Expanded to include more states

// Add new enums
export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum IncidentStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  PENDING = 'pending', // Added based on usage
}


export interface Meter {
    id: string; // UUID, can be placeholder for offline creation
    serverId?: string; // Server-authoritative ID, populated after sync
    serialNumber: string;
    meterType?: string;
    locationLatitude?: number;
    locationLongitude?: number;
    status?: string; // e.g., 'active', 'inactive', 'maintenance'
    syncStatus: SyncStatusType;
    lastModified: number; // Unix timestamp (seconds)
    version?: number; // Optional: for conflict resolution/optimistic locking
    // Fields from original mapRowToMeter that might be missing or need review:
    address?: string; 
    installationDate?: number; // Assuming this should be a number (timestamp) if it exists
    notes?: string;
    userId?: string; // Assuming this is the user who last modified/created
}

export interface Reading {
    id: string; // UUID, can be placeholder for offline creation
    serverId?: string; // Server-authoritative ID, populated after sync
    meterId: string;
    routeId?: string; // Optional: if reading is part of a specific route visit
    readingDate: number; // Unix timestamp (seconds)
    value: number;
    notes?: string;
    latitude?: number;
    longitude?: number;
    syncStatus: SyncStatusType;
    lastModified: number; // Unix timestamp (seconds)
    userId?: string; // User who took the reading
    version?: number; // Optional: for conflict resolution/optimistic locking
}

export interface Incident {
  id: string; // UUID
  serverId?: string;
  meterId?: string; // Made meterId optional
  routeId?: string;
  readingId?: string; // Added readingId
  incidentDate: number; // Unix timestamp
  resolvedDate?: number; // Unix timestamp
  description: string;
  severity: IncidentSeverity; // Use the enum
  status: IncidentStatus;     // Use the enum
  photos?: string; // JSON array of photo URLs/paths or a single path
  notes?: string;
  latitude?: number;
  longitude?: number;
  syncStatus: SyncStatusType;
  lastModified: number; // Unix timestamp
  userId?: string;
  version?: number;
}

// Represents the structure of an Incident object as expected from/to the server
export interface ServerIncident extends Omit<Incident, 'syncStatus' | 'lastModified'> {
  // serverId is already optional in Incident, but for server-originated data, it should ideally exist.
  // If the server uses 'id' as its primary key and it maps to client's 'serverId', adjust accordingly.
  // For now, assuming ServerIncident largely mirrors Incident, excluding local-only fields.
  // readingId will be inherited from Incident via Omit if not excluded.
}

export interface Route {
    id: string; // UUID
    serverId?: string; // Server-authoritative ID, populated after sync
    name: string;
    description?: string;
    assignedUserId?: string; // Technician/user assigned to the route
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    meterCount: number; // Number of meters in the route, should default to 0
    syncStatus: SyncStatusType;
    lastModified: number; // Unix timestamp (seconds)
    version: number; // Version for sync, should default to 1
}

export interface RouteMeter {
    id: string; // Local unique ID (e.g., routeId_meterId or UUID)
    serverId?: string; // Server-authoritative ID for the association, if applicable
    routeId: string;
    meterId: string;
    sequenceOrder: number;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'unable_to_locate'; // Standardized status
    visitDate?: number; // Unix timestamp
    notes?: string;
    syncStatus: SyncStatusType;
    lastModified: number; // Unix timestamp
    version?: number;
}

export interface Setting {
  key: string;
  value: string | null;
  lastModified: number; // Unix timestamp
}

export type OfflineOperationType =
    // Meter operations
    | 'CREATE_METER'
    | 'UPDATE_METER'
    | 'DELETE_METER'
    // Reading operations
    | 'CREATE_READING'
    | 'UPDATE_READING'
    | 'DELETE_READING'
    // Incident operations
    | 'CREATE_INCIDENT'
    | 'UPDATE_INCIDENT'
    | 'DELETE_INCIDENT'
    // Route operations
    | 'CREATE_ROUTE'
    | 'UPDATE_ROUTE'
    | 'DELETE_ROUTE'
    // RouteMeter operations
    | 'CREATE_ROUTEMETER'
    | 'UPDATE_ROUTEMETER'
    | 'DELETE_ROUTEMETER'
    | 'BATCH_UPDATE_ROUTEMETER_SEQUENCE'
    | 'DELETE_ROUTEMETERS_BY_ROUTEID' // For deleting all RouteMeters associated with a Route
    // Settings operations
    | 'CREATE_SETTING'
    | 'UPDATE_SETTING'
    | 'DELETE_SETTING'
    | 'UPSERT_SETTING';

export type OfflineQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface OfflineQueueItem {
    id: string; // Changed to string, to be used with UUIDs
    operationType: OfflineOperationType;
    payload: string; // JSON string of the data needed for the operation
    entityId?: string; // UUID of the primary entity being affected (e.g., Meter.id, Reading.id)
    relatedEntityId?: string; // Optional: UUID of a related entity (e.g., Route.id for RouteMeter operations)
    entityType?: string; // e.g., 'Meter', 'Reading', 'RouteMeter' - for easier debugging or specific handling
    relatedEntityType?: string; // Optional: Type of the related entity (e.g., 'Route') // Added
    status: OfflineQueueStatus;
    syncStatus?: SyncStatusType; // More detailed status from the perspective of the entity itself
    attempts: number;
    lastAttemptAt?: number; // Unix timestamp
    createdAt: number; // Unix timestamp
    errorDetails?: string; // JSON string of error info if the last attempt failed
    token?: string; // Store the token used for this attempt, if needed for re-authentication or specific API calls
}
