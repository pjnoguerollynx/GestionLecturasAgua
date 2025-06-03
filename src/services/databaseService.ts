import SQLite, { SQLiteDatabase, ResultSet } from 'react-native-sqlite-storage';

// Enable promise-based API
SQLite.enablePromise(true);

const DATABASE_NAME = 'GestionLecturasAgua.db';
const DATABASE_LOCATION = 'default'; // 'default' location for Android, iOS uses 'Library'

let db: SQLiteDatabase | null = null;

/**
 * Gets the current database connection.
 * @returns SQLiteDatabase | null
 */
export const getDBConnection = (): SQLiteDatabase | null => {
  return db;
}

/**
 * Opens the database connection.
 * If the database doesn't exist, it will be created.
 */
export const openDatabase = async (): Promise<SQLiteDatabase> => {
  if (db) {
    console.log('DB_SERVICE: Database already open.');
    return db;
  }
  try {
    console.log('DB_SERVICE: Attempting to open database...');
    // SQLite.DEBUG(true); // Enable verbose SQLite plugin logging if needed
    const newDb = await SQLite.openDatabase({
      name: DATABASE_NAME,
      location: DATABASE_LOCATION,
      // createFromLocation: '~www/GestionLecturasAgua.db', // Uncomment if pre-populated DB is needed
    });
    db = newDb;
    console.log('DB_SERVICE: SQLite.openDatabase call successful. DB object:', db);
    if (db) {
      console.log('DB_SERVICE: Database object is valid. Proceeding to create tables.');
      await createTables(db); // Create tables if they don't exist
      console.log('DB_SERVICE: createTables call completed.');
    } else {
      console.error('DB_SERVICE: SQLite.openDatabase returned null or undefined.');
      throw new Error('DB_SERVICE: SQLite.openDatabase returned null or undefined.');
    }
    return db;
  } catch (error) {
    console.error('DB_SERVICE: Failed to open database', error);
    throw error;
  }
};

/**
 * Closes the database connection.
 */
export const closeDatabase = async (): Promise<void> => {
  if (db) {
    try {
      console.log('Closing database...');
      await db.close();
      db = null;
      console.log('Database CLOSED successfully');
    } catch (error) {
      console.error('Failed to close database', error);
      db = null; // Also nullify on error to prevent reuse of a bad db object
      throw error;
    }
  } else {
    console.log('Database not open, no need to close.');
  }
};

/**
 * Creates the necessary tables if they don't already exist.
 * @param database SQLiteDatabase instance
 */
const createTables = async (database: SQLiteDatabase): Promise<void> => {
  try {
    console.log('DB_SERVICE: createTables - VERY BEGINNING OF FUNCTION - DB_TX_DEBUG_V5'); // Updated version

    // Drop Meters table before creating it to ensure schema updates
    console.log('DB_SERVICE: createTables - Starting Transaction for DROP Meters table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx_DropMeters: Inside. Dropping Meters table if it exists...');
      try {
        await tx.executeSql('DROP TABLE IF EXISTS Meters;');
        console.log('DB_SERVICE: createTables - Tx_DropMeters: DROP TABLE IF EXISTS Meters SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx_DropMeters: ERROR dropping "Meters" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction for DROP Meters committed successfully.');

    // Transaction 1: Create Meters table
    console.log('DB_SERVICE: createTables - Starting Transaction 1 for Meters table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx1: Inside. Creating Meters table...');
      try {
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS Meters (
            id TEXT PRIMARY KEY NOT NULL,
            serialNumber TEXT UNIQUE NOT NULL,
            address TEXT,
            locationLatitude REAL, -- Corrected column name
            locationLongitude REAL, -- Corrected column name
            installationDate TEXT,
            meterType TEXT,
            status TEXT, -- e.g., active, inactive, needs_repair
            notes TEXT,
            syncStatus TEXT DEFAULT 'pending', -- pending, synced, error
            lastModified INTEGER DEFAULT (strftime('%s', 'now')),
            userId TEXT, -- User who last modified this record locally
            serverId TEXT, -- Added for server synchronization
            version INTEGER DEFAULT 0 -- Added for version control during sync
          );
        `);
        console.log('DB_SERVICE: createTables - Tx1: Table "Meters" creation SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx1: ERROR creating "Meters" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction 1 for Meters committed successfully.');

    // Transaction 2: Create ReadingsSimple table
    console.log('DB_SERVICE: createTables - Starting Transaction 2 for ReadingsSimple table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx2: Inside. Creating ReadingsSimple table...');
      try {
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS ReadingsSimple (
            id TEXT PRIMARY KEY NOT NULL,
            testColumn TEXT
          );
        `);
        console.log('DB_SERVICE: createTables - Tx2: Table "ReadingsSimple" creation SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx2: ERROR creating "ReadingsSimple" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction 2 for ReadingsSimple committed successfully.');

    // Drop Readings table before creating it to ensure schema updates
    console.log('DB_SERVICE: createTables - Starting Transaction for DROP Readings table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx_DropReadings: Inside. Dropping Readings table if it exists...');
      try {
        await tx.executeSql('DROP TABLE IF EXISTS Readings;');
        console.log('DB_SERVICE: createTables - Tx_DropReadings: DROP TABLE IF EXISTS Readings SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx_DropReadings: ERROR dropping "Readings" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction for DROP Readings committed successfully.');

    // Transaction 2b: Create Readings table
    console.log('DB_SERVICE: createTables - Starting Transaction 2b for Readings table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx2b: Inside. Creating Readings table...');
      try {
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS Readings (
            id TEXT PRIMARY KEY NOT NULL,
            meterId TEXT NOT NULL,
            readingValue REAL NOT NULL,
            readingDate INTEGER NOT NULL,
            readingType TEXT DEFAULT 'normal',
            latitude REAL,
            longitude REAL,
            isAnomaly INTEGER DEFAULT 0,
            notes TEXT,
            photoUri TEXT,
            userId TEXT,
            syncStatus TEXT DEFAULT 'pending',
            lastModified INTEGER DEFAULT (strftime('%s', 'now')),
            serverId TEXT,
            routeId TEXT,
            version INTEGER DEFAULT 0,
            FOREIGN KEY (meterId) REFERENCES Meters (id) ON DELETE CASCADE
          );
        `);
        console.log('DB_SERVICE: createTables - Tx2b: Table "Readings" creation SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx2b: ERROR creating "Readings" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction 2b for Readings committed successfully.');

    // Drop Incidents table before creating it to ensure schema updates
    console.log('DB_SERVICE: createTables - Starting Transaction for DROP Incidents table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx_DropIncidents: Inside. Dropping Incidents table if it exists...');
      try {
        await tx.executeSql('DROP TABLE IF EXISTS Incidents;');
        console.log('DB_SERVICE: createTables - Tx_DropIncidents: DROP TABLE IF EXISTS Incidents SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx_DropIncidents: ERROR dropping "Incidents" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction for DROP Incidents committed successfully.');

    // Transaction 3: Create Incidents table
    console.log('DB_SERVICE: createTables - Starting Transaction 3 for Incidents table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx3: Inside. Creating Incidents table...');
      try {
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS Incidents (
            id TEXT PRIMARY KEY NOT NULL,
            meterId TEXT,
            routeId TEXT, -- Added routeId
            readingId TEXT,
            severity TEXT, -- Added severity (low, medium, high)
            description TEXT,
            photos TEXT, -- Changed from photoPath to photos to store JSON array of paths
            notes TEXT, -- Added notes
            latitude REAL,
            longitude REAL,
            incidentDate INTEGER NOT NULL, -- Changed to INTEGER for Unix timestamp
            resolvedDate INTEGER, -- Added resolvedDate as INTEGER for Unix timestamp
            status TEXT DEFAULT 'open',
            syncStatus TEXT DEFAULT 'pending',
            lastModified INTEGER DEFAULT (strftime('%s', 'now')),
            userId TEXT NOT NULL,
            version INTEGER DEFAULT 1, -- Added version column
            FOREIGN KEY (meterId) REFERENCES Meters (id) ON DELETE SET NULL,
            FOREIGN KEY (routeId) REFERENCES Routes (id) ON DELETE SET NULL -- Added FK for routeId
            -- FOREIGN KEY (readingId) REFERENCES Readings (id) ON DELETE SET NULL -- Temporarily commented out
          );
        `);
        console.log('DB_SERVICE: createTables - Tx3: Table "Incidents" creation SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx3: ERROR creating "Incidents" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction 3 for Incidents committed successfully.');

    // Transaction 4a: Drop Routes table
    console.log('DB_SERVICE: createTables - Starting Transaction 4a for DROP Routes table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx4a: Inside. Dropping Routes table...');
      try {
        await tx.executeSql('DROP TABLE IF EXISTS Routes;');
        console.log('DB_SERVICE: createTables - Tx4a: DROP TABLE IF EXISTS Routes SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx4a: ERROR dropping "Routes" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction 4a for DROP Routes committed successfully.');

    // Transaction 4b: Create Routes table
    console.log('DB_SERVICE: createTables - Starting Transaction 4b for CREATE Routes table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx4b: Inside. Creating Routes table...');
      try {
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS Routes (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            assignedUserId TEXT,
            status TEXT DEFAULT 'pending',
            syncStatus TEXT DEFAULT 'pending',
            lastModified INTEGER DEFAULT (strftime('%s', 'now')),
            serverId TEXT,
            version INTEGER DEFAULT 1,
            meterCount INTEGER DEFAULT 0
          );
        `);
        console.log('DB_SERVICE: createTables - Tx4b: Table "Routes" creation SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx4b: ERROR creating "Routes" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction 4b for CREATE Routes committed successfully.');

    // Transaction 5: Create RouteMeters table
    console.log('DB_SERVICE: createTables - Starting Transaction 5 for RouteMeters table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx5: Inside. Creating RouteMeters table...');
      try {
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS RouteMeters (
            routeId TEXT NOT NULL,
            meterId TEXT NOT NULL,
            sequenceOrder INTEGER,
            status TEXT DEFAULT 'pending',
            visitDate TEXT,
            notes TEXT,
            syncStatus TEXT DEFAULT 'pending',
            lastModified INTEGER DEFAULT (strftime('%s', 'now')),
            PRIMARY KEY (routeId, meterId),
            FOREIGN KEY (routeId) REFERENCES Routes (id) ON DELETE CASCADE,
            FOREIGN KEY (meterId) REFERENCES Meters (id) ON DELETE CASCADE
          );
        `);
        console.log('DB_SERVICE: createTables - Tx5: Table "RouteMeters" creation SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx5: ERROR creating "RouteMeters" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction 5 for RouteMeters committed successfully.');

    // Transaction 6: Create Settings table
    console.log('DB_SERVICE: createTables - Starting Transaction 6 for Settings table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx6: Inside. Creating Settings table...');
      try {
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS Settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT,
            lastModified INTEGER DEFAULT (strftime('%s', 'now'))
          );
        `);
        console.log('DB_SERVICE: createTables - Tx6: Table "Settings" creation SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx6: ERROR creating "Settings" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction 6 for Settings committed successfully.');

    // Drop OfflineQueue table before creating it to ensure schema updates
    console.log('DB_SERVICE: createTables - Starting Transaction for DROP OfflineQueue table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx_DropOfflineQueue: Inside. Dropping OfflineQueue table if it exists...');
      try {
        await tx.executeSql('DROP TABLE IF EXISTS OfflineQueue;');
        console.log('DB_SERVICE: createTables - Tx_DropOfflineQueue: DROP TABLE IF EXISTS OfflineQueue SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx_DropOfflineQueue: ERROR dropping "OfflineQueue" table:', error?.message, error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction for DROP OfflineQueue committed successfully.');

    // Transaction for OfflineQueue table
    console.log('DB_SERVICE: createTables - Starting Transaction for OfflineQueue table...');
    await database.transaction(async (tx) => {
      console.log('DB_SERVICE: createTables - Tx_OfflineQueue: Inside. Creating OfflineQueue table...');
      try {
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS OfflineQueue (
            id TEXT PRIMARY KEY,
            operationType TEXT NOT NULL,
            payload TEXT NOT NULL,
            timestamp INTEGER NOT NULL, -- Ensure this is used for creation time
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            lastAttemptAt INTEGER, -- Changed from lastAttemptTimestamp
            errorDetails TEXT,
            entityId TEXT,
            entityType TEXT,
            relatedEntityId TEXT,
            relatedEntityType TEXT,
            syncStatus TEXT, -- Added
            token TEXT -- Added
          );
        `);
        console.log('DB_SERVICE: createTables - Tx_OfflineQueue: Table "OfflineQueue" creation SQL executed successfully.');
      } catch (error: any) {
        console.error('DB_SERVICE: createTables - Tx_OfflineQueue: Error creating "OfflineQueue" table:', error);
        throw error;
      }
    });
    console.log('DB_SERVICE: createTables - Transaction for OfflineQueue committed successfully.');

    console.log('DB_SERVICE: createTables - ALL TABLES CREATED SUCCESSFULLY - DB_TX_DEBUG_V5'); // Updated version
  } catch (error: any) { // Explicitly type error as any to access message property
    // Ensure db is not null before trying to access its properties or methods if applicable
    // This top-level catch is for errors not caught by individual transaction error handlers
    console.error('DB_SERVICE: createTables - CRITICAL ERROR during table creation process. One or more transactions may have failed and rolled back. Error:', error?.message, error);
    // It's important to re-throw so the caller (openDatabase) knows initialization failed.
    throw error; 
  }
};

/**
 * Executes a SQL query.
 * @param sqlStatement The SQL query string.
 * @param params Optional array of parameters for the query.
 * @returns Promise<ResultSet>
 */
export const executeSql = async (sqlStatement: string, params: any[] = []): Promise<ResultSet> => {
  const currentDb = getDBConnection();
  if (!currentDb) {
    // Attempt to open the database if it's not already open
    // This provides a bit of resilience but ideally openDatabase should be called explicitly at app start.
    console.warn('Database not open. Attempting to open automatically...');
    await openDatabase(); // This will set the global db variable
    const newDb = getDBConnection();
    if (!newDb) { // Check again after attempting to open
        throw new Error('Database is not open and could not be opened.');
    }
    // If newDb is successfully assigned, executeSql will be called with it in the next line.
  }
  
  // Re-fetch the db connection in case openDatabase was called and successfully opened it.
  const dbToUse = getDBConnection();
  if (!dbToUse) { // Final check
    throw new Error('Database connection is not available after attempting to open.');
  }

  try {
    const [results] = await dbToUse.executeSql(sqlStatement, params || []);
    return results;
  } catch (error: any) { 
    console.error(
      'DB_SERVICE: Error executing SQL. Statement:', sqlStatement, 'Params:', params
    );
    // Try to get as much info as possible
    if (error) {
      console.error('DB_SERVICE: Error Message:', error.message);
      console.error('DB_SERVICE: Error Code:', error.code);
      try {
        // Attempt to stringify the error, including non-enumerable properties if possible
        const errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error));
        console.error('DB_SERVICE: Error JSON:', errorDetails);
      } catch (stringifyError) {
        // If stringify fails (e.g., circular references not handled by getOwnPropertyNames), log basic toString
        console.error('DB_SERVICE: Error (could not stringify):', String(error));
      }
    } else {
      console.error('DB_SERVICE: Caught an undefined/null error object during SQL execution.');
    }
    throw error;
  }
};
