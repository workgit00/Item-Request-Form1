import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

async function addAttachmentsColumn() {
  try {
    console.log('Adding attachments column to service_vehicle_requests table...');
    
    // Check if the column exists
    const [columnInfo] = await sequelize.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'service_vehicle_requests'
      AND column_name = 'attachments'
    `, { type: QueryTypes.SELECT });
    
    if (columnInfo) {
      console.log('✅ attachments column already exists');
      return;
    }
    
    // Add the attachments column as JSONB
    await sequelize.query(`
      ALTER TABLE service_vehicle_requests
      ADD COLUMN attachments JSONB
    `);
    
    console.log('✅ Successfully added attachments column');
    
  } catch (error) {
    console.error('❌ Error adding attachments column:', error);
    throw error;
  }
}

// Run the migration
addAttachmentsColumn()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
