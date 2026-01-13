import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

async function changeAssignedDriverToVarchar() {
  try {
    console.log('Changing assigned_driver column from INTEGER to VARCHAR...');
    
    // Check if the column exists and get its current type
    const [columnInfo] = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'service_vehicle_requests'
      AND column_name = 'assigned_driver'
    `, { type: QueryTypes.SELECT });
    
    if (!columnInfo) {
      console.log('Column assigned_driver not found. Skipping migration.');
      return;
    }
    
    console.log('Current column type:', columnInfo.data_type);
    
    if (columnInfo.data_type === 'character varying' || columnInfo.data_type === 'varchar') {
      console.log('Column is already VARCHAR. No changes needed.');
      return;
    }
    
    // Drop the foreign key constraint if it exists
    console.log('Dropping foreign key constraint if it exists...');
    try {
      await sequelize.query(`
        ALTER TABLE service_vehicle_requests
        DROP CONSTRAINT IF EXISTS service_vehicle_requests_assigned_driver_fkey
      `);
      console.log('Foreign key constraint dropped (if it existed).');
    } catch (error) {
      console.log('No foreign key constraint to drop (or already dropped).');
    }
    
    // Drop the index if it exists
    try {
      await sequelize.query(`
        DROP INDEX IF EXISTS service_vehicle_requests_assigned_driver_idx
      `);
      console.log('Index dropped (if it existed).');
    } catch (error) {
      console.log('No index to drop (or already dropped).');
    }
    
    // Change the column type to VARCHAR(255)
    console.log('Changing column type to VARCHAR(255)...');
    await sequelize.query(`
      ALTER TABLE service_vehicle_requests
      ALTER COLUMN assigned_driver TYPE VARCHAR(255)
      USING assigned_driver::VARCHAR(255)
    `);
    
    console.log('✅ Successfully changed assigned_driver column to VARCHAR(255)');
    
    // Update any existing integer values to NULL (since they're no longer valid user IDs)
    console.log('Clearing any existing integer values...');
    await sequelize.query(`
      UPDATE service_vehicle_requests
      SET assigned_driver = NULL
      WHERE assigned_driver ~ '^[0-9]+$'
    `);
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Run the migration
changeAssignedDriverToVarchar()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
