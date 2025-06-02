import { Setting, OfflineOperationType } from '../types/databaseModels'; // Modified import
import { executeSql, getDBConnection } from '../services/databaseService';
import { addOperationToQueue } from './offlineQueueRepository'; // Added import

// --- Helper to map ResultSet to Setting ---
const mapRowToSetting = (row: any): Setting => {
  return {
    key: row.key,
    value: row.value,
    lastModified: row.lastModified,
  };
};

// --- Settings CRUD Operations ---

/**
 * Adds or updates a setting in the database.
 * If a setting with the given key already exists, it will be updated.
 * Otherwise, a new setting will be created.
 * @param settingData Data for the setting (key and value).
 * @returns The created or updated Setting object.
 */
export const upsertSetting = async (settingData: Pick<Setting, 'key' | 'value'>): Promise<Setting> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  const existingSetting = await getSettingByKey(settingData.key);
  let operationType: OfflineOperationType; // Use the imported OfflineOperationType

  if (existingSetting) {
    operationType = 'UPDATE_SETTING';
    // Update existing setting
    const query = `
      UPDATE Settings
      SET value = ?, lastModified = strftime('%s', 'now')
      WHERE key = ?;
    `;
    const params = [settingData.value, settingData.key];
    try {
      await executeSql(query, params);
      console.log(`Setting with key '${settingData.key}' updated successfully.`);
      const updatedSetting = await getSettingByKey(settingData.key);
      if (!updatedSetting) {
        throw new Error('Failed to retrieve updated setting after update.');
      }
      // Add to offline queue
      try {
        await addOperationToQueue(
          operationType, // Use determined operation type
          updatedSetting, // Full setting object as payload
          updatedSetting.key,
          'Setting'
        );
      } catch (queueError) {
        console.error(`Failed to add ${operationType} for setting ${updatedSetting.key} to queue`, queueError);
      }
      return updatedSetting;
    } catch (error) {
      console.error(`Error updating setting with key '${settingData.key}':`, error);
      throw error;
    }
  } else {
    operationType = 'CREATE_SETTING'; // Assign operation type for new setting
    // Insert new setting
    const query = `
      INSERT INTO Settings (key, value)
      VALUES (?, ?);
    `;
    const params = [settingData.key, settingData.value];
    try {
      await executeSql(query, params);
      console.log(`Setting with key '${settingData.key}' added successfully.`);
      const newSetting = await getSettingByKey(settingData.key);
      if (!newSetting) {
        throw new Error('Failed to retrieve newly added setting after insertion.');
      }
      // Add to offline queue
      try {
        await addOperationToQueue(
          operationType, // 'CREATE_SETTING'
          newSetting, // Full setting object as payload
          newSetting.key,
          'Setting'
        );
      } catch (queueError) {
        console.error(`Failed to add CREATE_SETTING for setting ${newSetting.key} to queue`, queueError);
      }
      return newSetting;
    } catch (error) {
      console.error(`Error adding setting with key '${settingData.key}':`, error);
      throw error;
    }
  }
};

/**
 * Retrieves a setting by its key.
 * @param key The key of the setting.
 * @returns The Setting object if found, otherwise null.
 */
export const getSettingByKey = async (key: string): Promise<Setting | null> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT key, value, lastModified FROM Settings WHERE key = ?;";
  try {
    const results = await executeSql(query, [key]);
    if (results.rows.length > 0) {
      return mapRowToSetting(results.rows.item(0));
    }
    return null;
  } catch (error) {
    console.error(`Error fetching setting by key '${key}':`, error);
    throw error;
  }
};

/**
 * Retrieves all settings from the database.
 * @returns A promise that resolves to an array of Setting objects.
 */
export const getAllSettings = async (): Promise<Setting[]> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }
  const query = "SELECT key, value, lastModified FROM Settings;";
  try {
    const results = await executeSql(query, []);
    const settings: Setting[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      settings.push(mapRowToSetting(results.rows.item(i)));
    }
    return settings;
  } catch (error) {
    console.error('Error fetching all settings:', error);
    throw error;
  }
};

/**
 * Deletes a setting by its key.
 * @param key The key of the setting to delete.
 * @returns A promise that resolves to true if deletion was successful, false otherwise.
 */
export const deleteSettingByKey = async (key: string): Promise<boolean> => {
  const db = getDBConnection();
  if (!db) {
    throw new Error('Database not open. Call openDatabase first.');
  }

  // Fetch the setting before deleting to have its data for the queue, if needed for payload.
  // For settings, key is usually enough for DELETE.
  // const settingToDelete = await getSettingByKey(key);

  const query = "DELETE FROM Settings WHERE key = ?;";
  try {
    const results = await executeSql(query, [key]);
    if (results.rowsAffected > 0) {
      console.log(`Setting with key '${key}' deleted successfully.`);
      // Add to offline queue
      try {
        await addOperationToQueue(
          'DELETE_SETTING', // This should now be a valid OfflineOperationType
          { key }, // Payload can be just the key
          key,
          'Setting'
        );
      } catch (queueError) {
        console.error(`Failed to add DELETE_SETTING for setting ${key} to queue`, queueError);
      }
      return true;
    }
    console.warn(`Setting with key '${key}' not found for deletion.`);
    return false;
  } catch (error) {
    console.error(`Error deleting setting with key '${key}':`, error);
    throw error;
  }
};

// --- Reconciliation Functions ---

// Interface for the Setting object as expected from the server
export interface ServerSetting { // Added export
    key: string;
    value: string | null;
    // Assuming server provides these timestamps for versioning/auditing or just last update time
    updatedAt: string; // ISO date string or timestamp
    // Settings might not have a version, but if they do, include it:
    // version?: number;
}

export const reconcileUpsertedSetting = async (settingKey: string, serverSetting: ServerSetting): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const localSetting = await getSettingByKey(settingKey);

    let lastModifiedTimestamp: number;
    if (serverSetting.updatedAt) {
        lastModifiedTimestamp = Math.floor(new Date(serverSetting.updatedAt).getTime() / 1000);
    } else if (localSetting) {
        lastModifiedTimestamp = localSetting.lastModified;
    } else {
        lastModifiedTimestamp = Math.floor(Date.now() / 1000);
    }

    // For settings, an upsert is common. If it exists, update; otherwise, insert.
    // The local `upsertSetting` already handles this logic, but reconciliation might need to be more direct
    // or handle server-authoritative state differently (e.g., server can delete a setting client thinks it has).

    // For simplicity, we'll use a direct UPSERT SQL command or separate INSERT/UPDATE.
    // SQLite's INSERT OR REPLACE or INSERT ... ON CONFLICT DO UPDATE is ideal here.

    const query = `
        INSERT INTO Settings (key, value, lastModified)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            lastModified = excluded.lastModified;
    `;
    // Note: `excluded.value` and `excluded.lastModified` refer to the values from the VALUES clause in SQLite.
    // Also, we are not explicitly setting a syncStatus for settings here, assuming they are always considered 'synced'
    // once the server value is applied, or they don't have a syncStatus field.
    // If Settings table has syncStatus and version, they should be handled.

    const params = [
        serverSetting.key, // Should match settingKey
        serverSetting.value,
        lastModifiedTimestamp
    ];

    try {
        await executeSql(query, params);
        console.log(`Setting ${settingKey} reconciled with server data.`);
    } catch (error) {
        console.error(`Error reconciling setting ${settingKey}:`, error);
        // If settings had a syncStatus, you might set it to 'error' here.
        throw error;
    }
};

export const reconcileDeletedSetting = async (settingKey: string): Promise<void> => {
    const db = getDBConnection();
    if (!db) throw new Error('Database not open.');

    const localSetting = await getSettingByKey(settingKey);
    if (!localSetting) {
        console.warn(`Setting ${settingKey} already deleted locally or never existed.`);
        return;
    }

    const query = "DELETE FROM Settings WHERE key = ?;";
    try {
        await executeSql(query, [settingKey]);
        console.log(`Setting ${settingKey} confirmed deleted locally after server reconciliation.`);
    } catch (error) {
        console.error(`Error deleting setting ${settingKey} locally during reconciliation:`, error);
        throw error;
    }
};
