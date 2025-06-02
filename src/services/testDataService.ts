import { openDatabase } from './databaseService';

export class TestDataService {
  static async insertSampleIncidents(): Promise<void> {
    try {
      console.log('TestDataService: Starting insertSampleIncidents...');
      const db = await openDatabase();
      console.log('TestDataService: Database obtained successfully');
      
      const sampleIncidents = [
        {
          id: 'INC-001',
          meterId: 'CTR-001',
          routeId: null,
          readingId: null,
          severity: 'high',
          description: 'Fuga de agua en tubería principal',
          photos: null,
          notes: 'Reportado por vecino - urgente',
          latitude: -10.4806,
          longitude: -66.9036,
          incidentDate: Date.now(),
          resolvedDate: null,
          status: 'open',
          syncStatus: 'pending',
          userId: 'USER-001'
        },
        {
          id: 'INC-002',
          meterId: 'CTR-002',
          routeId: null,
          readingId: null,
          severity: 'medium',
          description: 'Contador dañado - lectura incorrecta',
          photos: null,
          notes: 'Cliente reporta consumo elevado',
          latitude: -10.4820,
          longitude: -66.9050,
          incidentDate: Date.now() - 86400000, // 1 day ago
          resolvedDate: null,
          status: 'open',
          syncStatus: 'pending',
          userId: 'USER-002'
        }
      ];

      console.log('TestDataService: Sample incidents prepared:', sampleIncidents.length);

      for (let i = 0; i < sampleIncidents.length; i++) {
        const incident = sampleIncidents[i];
        console.log(`TestDataService: Inserting incident ${i + 1}:`, {
          id: incident.id,
          description: incident.description,
          severity: incident.severity,
          status: incident.status
        });

        await new Promise<void>((resolve, reject) => {
          console.log(`TestDataService: Starting transaction for incident ${i + 1}`);
          
          db.transaction(
            tx => {
              console.log(`TestDataService: Inside transaction for incident ${i + 1}`);
              
              const sql = `INSERT INTO Incidents 
                (id, meterId, routeId, readingId, severity, description, photos, notes, 
                 latitude, longitude, incidentDate, resolvedDate, status, syncStatus, userId, version) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
              
              const params = [
                incident.id,
                incident.meterId,
                incident.routeId,
                incident.readingId,
                incident.severity,
                incident.description,
                incident.photos,
                incident.notes,
                incident.latitude,
                incident.longitude,
                incident.incidentDate,
                incident.resolvedDate,
                incident.status,
                incident.syncStatus,
                incident.userId,
                1 // version
              ];
              
              console.log(`TestDataService: About to execute SQL for incident ${i + 1}:`, sql);
              console.log(`TestDataService: SQL params for incident ${i + 1}:`, params);
              
              tx.executeSql(
                sql,
                params,
                (tx, result) => {
                  console.log(`TestDataService: SUCCESS inserting incident ${i + 1}:`, result);
                  resolve();
                },
                (tx, error) => {
                  console.error(`TestDataService: SQL ERROR inserting incident ${i + 1}:`, {
                    message: (error as any)?.message || 'No message',
                    code: (error as any)?.code || 'No code',
                    details: error,
                    sql: sql,
                    params: params
                  });
                  reject(error);
                  return false;
                }
              );
            },
            error => {
              console.error(`TestDataService: Transaction ERROR for incident ${i + 1}:`, {
                message: (error as any)?.message || 'No message',
                code: (error as any)?.code || 'No code',
                details: error ? String(error) : 'No error details',
                errorType: typeof error,
                errorConstructor: (error as any)?.constructor?.name || 'Unknown'
              });
              reject(error);
            },
            () => {
              console.log(`TestDataService: Transaction SUCCESS for incident ${i + 1}`);
            }
          );
        });
      }

      console.log('TestDataService: All sample incidents inserted successfully');
    } catch (error) {
      console.error('TestDataService: Error in insertSampleIncidents:', {
        error: error,
        message: (error as any)?.message || 'No message',
        stack: (error as any)?.stack || 'No stack',
        errorType: typeof error,
        stringified: error ? String(error) : 'No error'
      });
      throw error;
    }
  }

  static async verifyTableStructure(): Promise<void> {
    try {
      const db = await openDatabase();
      
      // Verificar estructura de la tabla Incidents
      await new Promise<void>((resolve, reject) => {
        db.transaction(tx => {
          tx.executeSql(
            "PRAGMA table_info(Incidents)",
            [],
            (tx, result) => {
              console.log('TestDataService: Incidents table structure:');
              for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                console.log(`  Column ${i}: ${row.name} (${row.type}) - NotNull: ${row.notnull}, Default: ${row.dflt_value}`);
              }
              resolve();
            },
            (tx, error) => {
              console.error('TestDataService: Error checking Incidents table structure:', error);
              reject(error);
              return false;
            }
          );
        });
      });

      // Verificar estructura de la tabla Meters
      await new Promise<void>((resolve, reject) => {
        db.transaction(tx => {
          tx.executeSql(
            "PRAGMA table_info(Meters)",
            [],
            (tx, result) => {
              console.log('TestDataService: Meters table structure:');
              if (result.rows.length === 0) {
                console.log('  ⚠️  Meters table does not exist or has no columns!');
              } else {
                for (let i = 0; i < result.rows.length; i++) {
                  const row = result.rows.item(i);
                  console.log(`  Column ${i}: ${row.name} (${row.type}) - NotNull: ${row.notnull}, Default: ${row.dflt_value}`);
                }
              }
              resolve();
            },
            (tx, error) => {
              console.error('TestDataService: Error checking Meters table structure:', error);
              reject(error);
              return false;
            }
          );
        });
      });

      // Verificar estructura de la tabla ReadingsSimple
      await new Promise<void>((resolve, reject) => {
        db.transaction(tx => {
          tx.executeSql(
            "PRAGMA table_info(ReadingsSimple)",
            [],
            (tx, result) => {
              console.log('TestDataService: ReadingsSimple table structure:');
              if (result.rows.length === 0) {
                console.log('  ⚠️  ReadingsSimple table does not exist or has no columns!');
              } else {
                for (let i = 0; i < result.rows.length; i++) {
                  const row = result.rows.item(i);
                  console.log(`  Column ${i}: ${row.name} (${row.type}) - NotNull: ${row.notnull}, Default: ${row.dflt_value}`);
                }
              }
              resolve();
            },
            (tx, error) => {
              console.error('TestDataService: Error checking ReadingsSimple table structure:', error);
              reject(error);
              return false;
            }
          );
        });
      });

      // Verificar qué tablas existen realmente
      await new Promise<void>((resolve, reject) => {
        db.transaction(tx => {
          tx.executeSql(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
            [],
            (tx, result) => {
              console.log('TestDataService: All tables in database:');
              for (let i = 0; i < result.rows.length; i++) {
                const row = result.rows.item(i);
                console.log(`  Table ${i}: ${row.name}`);
              }
              resolve();
            },
            (tx, error) => {
              console.error('TestDataService: Error listing tables:', error);
              reject(error);
              return false;
            }
          );
        });
      });

    } catch (error) {
      console.error('TestDataService: Error in verifyTableStructure:', error);
    }
  }

  static async insertSampleMeters(): Promise<void> {
    try {
      console.log('TestDataService: Starting insertSampleMeters...');
      const db = await openDatabase();
      console.log('TestDataService: Database obtained for meters');
      
      // Usar la estructura correcta según meterRepository.ts
      const sampleMeters = [
        {
          serialNumber: 'CTR-001',
          address: 'Calle Principal 123',
          locationLatitude: -10.4806,
          locationLongitude: -66.9036,
          installationDate: Math.floor(Date.now() / 1000) - (31536000), // 1 year ago in seconds
          meterType: 'Residential',
          status: 'Active',
          notes: 'Medidor residencial - Pedro Martínez',
          userId: 'USER-001'
        },
        {
          serialNumber: 'CTR-002',
          address: 'Av. Libertador 456',
          locationLatitude: -10.4820,
          locationLongitude: -66.9050,
          installationDate: Math.floor(Date.now() / 1000) - (15768000), // 6 months ago in seconds
          meterType: 'Commercial',
          status: 'Active',
          notes: 'Medidor comercial - Empresa ABC S.A.',
          userId: 'USER-002'
        }
      ];

      console.log('TestDataService: Sample meters prepared:', sampleMeters.length);

      for (let i = 0; i < sampleMeters.length; i++) {
        const meter = sampleMeters[i];
        console.log(`TestDataService: Inserting meter ${i + 1}:`, meter);

        await new Promise<void>((resolve, reject) => {
          console.log(`TestDataService: Starting transaction for meter ${i + 1}`);
          
          db.transaction(
            tx => {
              console.log(`TestDataService: Inside transaction for meter ${i + 1}`);
              
              // Generar un ID único para el meter
              const meterId = `METER-${Date.now()}-${i}`;
              
              // Usar la estructura correcta de la tabla Meters según meterRepository.ts
              const sql = `INSERT INTO Meters 
               (id, serialNumber, address, locationLatitude, locationLongitude, installationDate, meterType, status, notes, userId, syncStatus, lastModified, version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', strftime('%s','now'), 0)`;
              
              const params = [
                meterId,
                meter.serialNumber,
                meter.address,
                meter.locationLatitude,
                meter.locationLongitude,
                meter.installationDate,
                meter.meterType,
                meter.status,
                meter.notes,
                meter.userId
              ];
              
              console.log(`TestDataService: About to execute SQL for meter ${i + 1}:`, sql);
              console.log(`TestDataService: SQL params for meter ${i + 1}:`, params);
              
              tx.executeSql(
                sql,
                params,
                (tx, result) => {
                  console.log(`TestDataService: SUCCESS inserting meter ${i + 1}:`, result);
                  resolve();
                },
                (tx, error) => {
                  console.error(`TestDataService: SQL ERROR inserting meter ${i + 1}:`, {
                    message: (error as any)?.message || 'No message',
                    code: (error as any)?.code || 'No code',
                    details: error,
                    sql: sql,
                    params: params
                  });
                  reject(error);
                  return false;
                }
              );
            },
            error => {
              console.error(`TestDataService: Transaction ERROR for meter ${i + 1}:`, {
                message: (error as any)?.message || 'No message',
                code: (error as any)?.code || 'No code',
                details: error ? String(error) : 'No error details',
                errorType: typeof error,
                errorConstructor: (error as any)?.constructor?.name || 'Unknown'
              });
              reject(error);
            },
            () => {
              console.log(`TestDataService: Transaction SUCCESS for meter ${i + 1}`);
            }
          );
        });
      }

      console.log('TestDataService: All sample meters inserted successfully');
    } catch (error) {
      console.error('TestDataService: Error in insertSampleMeters:', {
        error: error,
        message: (error as any)?.message || 'No message',
        stack: (error as any)?.stack || 'No stack',
        errorType: typeof error,
        stringified: error ? String(error) : 'No error'
      });
      throw error;
    }
  }

  static async populateTestData(): Promise<void> {
    try {
      console.log('TestDataService: ===== STARTING POPULATE TEST DATA =====');
      
      // Primero verificar la estructura de las tablas
      await this.verifyTableStructure();
      
      // Insertar incidencias
      try {
        await this.insertSampleIncidents();
        console.log('TestDataService: Incidents inserted successfully');
      } catch (incidentError) {
        console.error('TestDataService: Failed to insert incidents, but continuing:', incidentError);
      }
      
      // Insertar meters
      try {
        await this.insertSampleMeters();
        console.log('TestDataService: Meters inserted successfully');
      } catch (meterError) {
        console.error('TestDataService: Failed to insert meters, but continuing:', meterError);
      }
      
      console.log('TestDataService: ===== TEST DATA POPULATION COMPLETED =====');
    } catch (error) {
      console.error('TestDataService: ===== ERROR POPULATING TEST DATA =====', {
        error: error,
        message: (error as any)?.message || 'No message',
        stack: (error as any)?.stack || 'No stack',
        name: (error as any)?.name || 'No name',
        stringified: error ? String(error) : 'No error',
        errorKeys: error ? Object.keys(error) : []
      });
      // No hacer throw del error para que la app continúe
    }
  }

  static async clearTestData(): Promise<void> {
    try {
      const db = await openDatabase();
      
      await new Promise<void>((resolve, reject) => {
        db.transaction(tx => {
          tx.executeSql('DELETE FROM Incidents', [], () => {
            tx.executeSql('DELETE FROM Meters', [], () => {
              tx.executeSql('DELETE FROM ReadingsSimple', [], () => resolve(), (_, error) => {
                reject(error);
                return false;
              });
            }, (_, error) => {
              reject(error);
              return false;
            });
          }, (_, error) => {
            reject(error);
            return false;
          });
        });
      });
      
      console.log('Test data cleared successfully');
    } catch (error) {
      console.error('Error clearing test data:', error);
      throw error;
    }
  }
}