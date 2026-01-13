import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

async function addPassengersColumn() {
  try {
    console.log('Adding passengers column to service_vehicle_requests table...');
    
    // Check if the column exists
    const [columnInfo] = await sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'service_vehicle_requests'
      AND column_name = 'passengers'
    `, { type: QueryTypes.SELECT });
    
    if (columnInfo) {
      console.log('✅ passengers column already exists');
      return;
    }
    
    // Add the passengers column as JSONB
    await sequelize.query(`
      ALTER TABLE service_vehicle_requests
      ADD COLUMN passengers JSONB
    `);
    
    console.log('✅ Successfully added passengers column');
    
    // Optionally migrate existing passenger_name data to passengers array
    console.log('Migrating existing passenger_name data to passengers array...');
    await sequelize.query(`
      UPDATE service_vehicle_requests
      SET passengers = CASE
        WHEN passenger_name IS NOT NULL AND passenger_name != '' THEN
          jsonb_build_array(jsonb_build_object('name', passenger_name))
        ELSE NULL
      END
      WHERE passengers IS NULL
    `);
    
    console.log('✅ Successfully migrated existing passenger data');
    
  } catch (error) {
    console.error('❌ Error adding passengers column:', error);
    throw error;
  }
}

// Run the migration
addPassengersColumn()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
