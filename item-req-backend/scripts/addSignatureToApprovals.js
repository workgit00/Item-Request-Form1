import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

async function addSignatureColumn() {
  try {
    console.log('Checking and adding signature column to approvals table...');
    
    // Check if signature column exists
    const checkSignatureColumn = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'approvals' AND column_name = 'signature'`,
      { type: QueryTypes.SELECT }
    );
    
    if (checkSignatureColumn.length === 0) {
      console.log('Adding signature column...');
      await sequelize.query(
        `ALTER TABLE approvals ADD COLUMN signature TEXT`,
        { type: QueryTypes.RAW }
      );
      console.log('✅ signature column added');
    } else {
      console.log('✅ signature column already exists');
    }
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding signature column:', error);
    process.exit(1);
  }
}

// Run the migration
addSignatureColumn();
