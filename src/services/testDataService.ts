import { openDatabase } from './databaseService';

export class TestDataService {
  static async insertSimpleTestMeter(): Promise<void> {
    try {
      console.log('TestDataService: Inserting simple test meter...');
      const db = await openDatabase();
      
      const testMeter = {
        id: 'METER-TEST-001',
        serialNumber: 'CTR-TEST-001',
        address: 'Calle Falsa 123, Springfield', // Example address in Spain for testing
        locationLatitude: 40.416775,             // Latitude for Madrid, Spain
        locationLongitude: -3.703790,            // Longitude for Madrid, Spain
        installationDate: Math.floor(Date.now() / 1000).toString(), // Como string según el esquema
        meterType: 'Residential',
        status: 'Active',
        notes: 'Contador de prueba',
        userId: 'USER-001',
        syncStatus: 'pending',
        lastModified: Math.floor(Date.now() / 1000),
        serverId: null,
        version: 0
      };

      await new Promise<void>((resolve, reject) => {
        db.transaction(
          tx => {
            // Usar exactamente las columnas que existen según los logs
            const sql = `INSERT INTO Meters 
              (id, serialNumber, address, locationLatitude, locationLongitude, 
               installationDate, meterType, status, notes, syncStatus, lastModified, userId, serverId, version)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            const params = [
              testMeter.id,
              testMeter.serialNumber,
              testMeter.address,
              testMeter.locationLatitude,
              testMeter.locationLongitude,
              testMeter.installationDate,
              testMeter.meterType,
              testMeter.status,
              testMeter.notes,
              testMeter.syncStatus,
              testMeter.lastModified,
              testMeter.userId,
              testMeter.serverId,
              testMeter.version
            ];
            
            console.log('TestDataService: Executing meter SQL:', sql);
            console.log('TestDataService: Meter params:', params);
            
            tx.executeSql(
              sql,
              params,
              (tx, result) => {
                console.log('TestDataService: Test meter inserted successfully:', result);
                resolve();
              },
              (tx, error) => {
                console.error('TestDataService: Error inserting test meter:', error);
                reject(error);
                return false;
              }
            );
          },
          error => {
            console.error('TestDataService: Transaction error:', error);
            reject(error);
          }
        );
      });

    } catch (error) {
      console.error('TestDataService: Error in insertSimpleTestMeter:', error);
      throw error;
    }
  }

  static async insertSimpleTestRoute(): Promise<void> {
    try {
      console.log('TestDataService: Inserting simple test route...');
      const db = await openDatabase();
      
      const testRoute = {
        id: 'ROUTE-TEST-001',
        name: 'Ruta de Prueba',
        description: 'Ruta simple para testing',
        assignedUserId: 'USER-001',
        status: 'pending',
        syncStatus: 'pending',
        lastModified: Math.floor(Date.now() / 1000),
        serverId: null,
        version: 1,
        meterCount: 1
      };

      await new Promise<void>((resolve, reject) => {
        db.transaction(
          tx => {
            // Usar exactamente las columnas según routeRepository
            const sql = `INSERT INTO Routes 
              (id, name, description, assignedUserId, status, syncStatus, lastModified, serverId, version, meterCount)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            const params = [
              testRoute.id,
              testRoute.name,
              testRoute.description,
              testRoute.assignedUserId,
              testRoute.status,
              testRoute.syncStatus,
              testRoute.lastModified,
              testRoute.serverId,
              testRoute.version,
              testRoute.meterCount
            ];
            
            console.log('TestDataService: Executing route SQL:', sql);
            console.log('TestDataService: Route params:', params);
            
            tx.executeSql(
              sql,
              params,
              (tx, result) => {
                console.log('TestDataService: Test route inserted successfully:', result);
                resolve();
              },
              (tx, error) => {
                console.error('TestDataService: Error inserting test route:', error);
                reject(error);
                return false;
              }
            );
          },
          error => {
            console.error('TestDataService: Transaction error:', error);
            reject(error);
          }
        );
      });

    } catch (error) {
      console.error('TestDataService: Error in insertSimpleTestRoute:', error);
      throw error;
    }
  }

  static async insertSimpleTestRouteMeter(): Promise<void> {
    try {
      console.log('TestDataService: Inserting simple test route-meter relation...');
      const db = await openDatabase();
      
      const testRouteMeter = {
        routeId: 'ROUTE-TEST-001',
        meterId: 'METER-TEST-001',
        sequenceOrder: 1,
        status: 'pending',
        visitDate: null, // Added for completeness
        notes: null,     // Added for completeness
        syncStatus: 'pending',
        lastModified: Math.floor(Date.now() / 1000)
      };

      await new Promise<void>((resolve, reject) => {
        db.transaction(
          tx => {
            // First, let's check what columns actually exist in RouteMeters table
            tx.executeSql(
              "PRAGMA table_info(RouteMeters)",
              [],
              (tx, result) => {
                console.log('TestDataService: RouteMeters table schema:');
                for (let i = 0; i < result.rows.length; i++) {
                  const column = result.rows.item(i);
                  console.log(`  Column ${i}: ${column.name} (${column.type})`);
                }
                
                // Corrected SQL to include all columns as per schema or ensure nullable columns are handled
                const sql = `INSERT INTO RouteMeters 
                  (routeId, meterId, sequenceOrder, status, visitDate, notes, syncStatus, lastModified)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                
                const params = [
                  testRouteMeter.routeId,
                  testRouteMeter.meterId,
                  testRouteMeter.sequenceOrder,
                  testRouteMeter.status,
                  testRouteMeter.visitDate, // Added param
                  testRouteMeter.notes,     // Added param
                  testRouteMeter.syncStatus,
                  testRouteMeter.lastModified
                ];
                
                console.log('TestDataService: Executing corrected route-meter SQL:', sql);
                console.log('TestDataService: Route-meter params:', params);
                
                tx.executeSql(
                  sql,
                  params,
                  (tx, result) => {
                    console.log('TestDataService: Test route-meter inserted successfully:', result);
                    resolve();
                  },
                  (tx, error) => {
                    console.error('TestDataService: Error inserting test route-meter. Error object:', error);
                    if (error && typeof error === 'object') {
                      console.error('Error message:', error.message);
                      console.error('Error code:', error.code);
                    }
                    console.error('Full error (stringified):', JSON.stringify(error));
                    reject(error); // Changed from resolve()
                    return true; // Indicate error is handled, request rollback
                  }
                );
              },
              (tx, error) => {
                console.error('TestDataService: Error getting RouteMeters schema. Error object:', error);
                if (error && typeof error === 'object') {
                  console.error('Error message:', error.message);
                  console.error('Error code:', error.code);
                }
                console.error('Full error (stringified):', JSON.stringify(error));
                reject(error); // Changed from resolve()
                return false; // Keep original return for PRAGMA failure
              }
            );
          },
          error => {
            console.error('TestDataService: Transaction error for RouteMeter insertion. Error object:', error);
            if (error && typeof error === 'object') {
                console.error('Transaction error message:', error.message);
                console.error('Transaction error code:', error.code);
            }
            console.error('Full transaction error (stringified):', JSON.stringify(error));
            reject(error); // Changed from resolve()
          }
        );
      });

    } catch (error) {
      console.error('TestDataService: Error in insertSimpleTestRouteMeter:', error);
      // Don't throw error to allow other inserts to continue
    }
  }

  static async insertSimpleTestIncident(): Promise<void> {
    try {
      console.log('TestDataService: Inserting simple test incident...');
      const db = await openDatabase();
      
      // Use schema from incidentRepository.ts
      const testIncident = {
        id: 'INC-TEST-001',
        meterId: 'METER-TEST-001',
        routeId: null,
        readingId: null,
        severity: 'medium',
        description: 'Incidencia de prueba para testing',
        photos: null,
        notes: 'Nota de prueba',
        latitude: 40.416775,
        longitude: -3.703790,
        incidentDate: Math.floor(Date.now() / 1000),
        resolvedDate: null,
        status: 'open',
        syncStatus: 'pending',
        userId: 'USER-001',
        version: 1
      };

      await new Promise<void>((resolve, reject) => {
        db.transaction(
          tx => {
            const sql = `INSERT INTO Incidents 
              (id, meterId, routeId, readingId, severity, description, photos, notes, 
               latitude, longitude, incidentDate, resolvedDate, status, syncStatus, userId, version)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            const params = [
              testIncident.id,
              testIncident.meterId,
              testIncident.routeId,
              testIncident.readingId,
              testIncident.severity,
              testIncident.description,
              testIncident.photos,
              testIncident.notes,
              testIncident.latitude,
              testIncident.longitude,
              testIncident.incidentDate,
              testIncident.resolvedDate,
              testIncident.status,
              testIncident.syncStatus,
              testIncident.userId,
              testIncident.version
            ];
            
            console.log('TestDataService: Executing incident SQL:', sql);
            console.log('TestDataService: Incident params:', params);
            
            tx.executeSql(
              sql,
              params,
              (tx, result) => {
                console.log('TestDataService: Test incident inserted successfully:', result);
                resolve();
              },
              (tx, error) => {
                console.error('TestDataService: Error inserting test incident:', error);
                reject(error);
                return false;
              }
            );
          },
          error => {
            console.error('TestDataService: Transaction error:', error);
            reject(error);
          }
        );
      });

    } catch (error) {
      console.error('TestDataService: Error in insertSimpleTestIncident:', error);
      throw error;
    }
  }

  static async insertSimpleTestReading(): Promise<void> {
    try {
      console.log('TestDataService: Inserting simple test reading...');
      const db = await openDatabase();
      
      await new Promise<void>((resolve, reject) => {
        db.transaction(
          tx => {
            // First, let's check what columns actually exist in ReadingsSimple table
            tx.executeSql(
              "PRAGMA table_info(ReadingsSimple)",
              [],
              (tx, result) => {
                console.log('TestDataService: ReadingsSimple table schema:');
                const columns: string[] = [];
                for (let i = 0; i < result.rows.length; i++) {
                  const column = result.rows.item(i);
                  columns.push(column.name);
                  console.log(`  Column ${i}: ${column.name} (${column.type})`);
                }
                
                // Check if this is the correct ReadingsSimple table or if it's the wrong one
                if (columns.includes('testColumn')) {
                  console.error('TestDataService: ReadingsSimple table has wrong schema! Recreating table with correct schema...');
                  
                  // Drop and recreate the table with correct schema
                  tx.executeSql(
                    "DROP TABLE IF EXISTS ReadingsSimple",
                    [],
                    (tx, result) => {
                      console.log('TestDataService: Dropped incorrect ReadingsSimple table');
                      
                      // Create the correct table
                      const createTableSQL = `
                        CREATE TABLE ReadingsSimple (
                          id TEXT PRIMARY KEY,
                          meterId TEXT NOT NULL,
                          readingValue TEXT NOT NULL,
                          readingDate INTEGER NOT NULL,
                          userId TEXT NOT NULL,
                          status TEXT DEFAULT 'pending',
                          syncStatus TEXT DEFAULT 'pending',
                          lastModified INTEGER,
                          serverId TEXT,
                          version INTEGER DEFAULT 1,
                          FOREIGN KEY (meterId) REFERENCES Meters(id)
                        )
                      `;
                      
                      tx.executeSql(
                        createTableSQL,
                        [],
                        (tx, result) => {
                          console.log('TestDataService: ReadingsSimple table recreated with correct schema');
                          
                          // Now insert the test data
                          const testReading = {
                            id: 'READ-TEST-001',
                            meterId: 'METER-TEST-001',
                            readingValue: '10023',
                            readingDate: Math.floor(Date.now() / 1000),
                            userId: 'USER-001',
                            status: 'pending',
                            syncStatus: 'pending',
                            lastModified: Math.floor(Date.now() / 1000),
                            serverId: null,
                            version: 1
                          };
                          
                          const sql = `INSERT INTO ReadingsSimple 
                            (id, meterId, readingValue, readingDate, userId, status, syncStatus, lastModified, serverId, version)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                          
                          const params = [
                            testReading.id,
                            testReading.meterId,
                            testReading.readingValue,
                            testReading.readingDate,
                            testReading.userId,
                            testReading.status,
                            testReading.syncStatus,
                            testReading.lastModified,
                            testReading.serverId,
                            testReading.version
                          ];
                          
                          tx.executeSql(
                            sql,
                            params,
                            (tx, result) => {
                              console.log('TestDataService: Test reading inserted successfully after table recreation:', result);
                              resolve();
                            },
                            (tx, error) => {
                              console.error('TestDataService: Error inserting test reading after table recreation. Error object:', error);
                              if (error && typeof error === 'object') {
                                console.error('Error message:', error.message);
                                console.error('Error code:', error.code);
                              }
                              console.error('Full error (stringified):', JSON.stringify(error));
                              reject(error); // Changed from resolve()
                              return true; // Indicate error is handled, request rollback
                            }
                          );
                        },
                        (tx, error) => {
                          console.error('TestDataService: Error recreating ReadingsSimple table. Error object:', error);
                          if (error && typeof error === 'object') {
                            console.error('Error message:', error.message);
                            console.error('Error code:', error.code);
                          }
                          console.error('Full error (stringified):', JSON.stringify(error));
                          reject(error); // Changed from resolve()
                          return false;
                        }
                      );
                    },
                    (tx, error) => {
                      console.error('TestDataService: Error dropping ReadingsSimple table. Error object:', error);
                      if (error && typeof error === 'object') {
                        console.error('Error message:', error.message);
                        console.error('Error code:', error.code);
                      }
                      console.error('Full error (stringified):', JSON.stringify(error));
                      reject(error); // Changed from resolve()
                      return false;
                    }
                  );
                  return;
                }
                
                // If we reach here, the table has the correct schema
                const testReading = {
                  id: 'READ-TEST-001',
                  meterId: 'METER-TEST-001',
                  readingValue: '10023',
                  readingDate: Math.floor(Date.now() / 1000),
                  userId: 'USER-001',
                  status: 'pending',
                  syncStatus: 'pending',
                  lastModified: Math.floor(Date.now() / 1000),
                  serverId: null,
                  version: 1
                };
                
                const sql = `INSERT INTO ReadingsSimple 
                  (id, meterId, readingValue, readingDate, userId, status, syncStatus, lastModified, serverId, version)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                
                const params = [
                  testReading.id,
                  testReading.meterId,
                  testReading.readingValue,
                  testReading.readingDate,
                  testReading.userId,
                  testReading.status,
                  testReading.syncStatus,
                  testReading.lastModified,
                  testReading.serverId,
                  testReading.version
                ];
                
                console.log('TestDataService: Executing reading SQL:', sql);
                console.log('TestDataService: Reading params:', params);
                
                tx.executeSql(
                  sql,
                  params,
                  (tx, result) => {
                    console.log('TestDataService: Test reading inserted successfully:', result);
                    resolve();
                  },
                  (tx, error) => {
                    console.error('TestDataService: Error inserting test reading. Error object:', error);
                    if (error && typeof error === 'object') {
                      console.error('Error message:', error.message);
                      console.error('Error code:', error.code);
                    }
                    console.error('Full error (stringified):', JSON.stringify(error));
                    reject(error); // Changed from resolve()
                    return true;  // Indicate error is handled, request rollback
                  }
                );
              },
              (tx, error) => {
                console.error('TestDataService: Error getting ReadingsSimple schema. Error object:', error);
                if (error && typeof error === 'object') {
                  console.error('Error message:', error.message);
                  console.error('Error code:', error.code);
                }
                console.error('Full error (stringified):', JSON.stringify(error));
                reject(error); // Changed from resolve()
                return false; // Keep original return for PRAGMA failure
              }
            );
          },
          error => {
            console.error('TestDataService: Transaction error for Reading insertion. Error object:', error);
             if (error && typeof error === 'object') {
                console.error('Transaction error message:', error.message);
                console.error('Transaction error code:', error.code);
            }
            console.error('Full transaction error (stringified):', JSON.stringify(error));
            reject(error); // Changed from resolve()
          }
        );
      });

    } catch (error) {
      console.error('TestDataService: Error in insertSimpleTestReading:', error);
      // Don't throw error to allow other inserts to continue
    }
  }

  static async populateTestData(): Promise<void> {
    try {
      console.log('TestDataService: ===== STARTING SIMPLE TEST DATA =====');
      
      // Insertar en orden correcto para respetar foreign keys
      console.log('TestDataService: Step 1 - Inserting meter...');
      await this.insertSimpleTestMeter();
      console.log('TestDataService: ✅ Test meter inserted');
      
      console.log('TestDataService: Step 2 - Inserting route...');
      await this.insertSimpleTestRoute();
      console.log('TestDataService: ✅ Test route inserted');
      
      console.log('TestDataService: Step 3 - Inserting route-meter relation...');
      try {
        await this.insertSimpleTestRouteMeter();
        console.log('TestDataService: ✅ Test route-meter relation inserted');
      } catch (error) {
        console.error('TestDataService: Failed to insert route-meter relation, continuing with other data:', error);
      }
      
      console.log('TestDataService: Step 4 - Inserting reading...');
      try {
        await this.insertSimpleTestReading();
        console.log('TestDataService: ✅ Test reading inserted');
      } catch (error) {
        console.error('TestDataService: Failed to insert reading, continuing with other data:', error);
      }
      
      console.log('TestDataService: Step 5 - Inserting incident...');
      try {
        await this.insertSimpleTestIncident();
        console.log('TestDataService: ✅ Test incident inserted');
      } catch (error) {
        console.error('TestDataService: Failed to insert incident, continuing with test data:', error);
      }
      
      console.log('TestDataService: ===== SIMPLE TEST DATA COMPLETED =====');
    } catch (error) {
      console.error('TestDataService: ===== ERROR POPULATING SIMPLE TEST DATA =====', error);
      // No hacer throw para que la app continúe
    }
  }
}