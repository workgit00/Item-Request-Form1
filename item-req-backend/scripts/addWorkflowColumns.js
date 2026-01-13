import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

async function addMissingColumns() {
  try {
    console.log('Checking and adding missing columns to approval_workflows table...');
    
    // Check if name column exists
    const checkNameColumn = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'approval_workflows' AND column_name = 'name'`,
      { type: QueryTypes.SELECT }
    );
    
    if (checkNameColumn.length === 0) {
      console.log('Adding name column...');
      await sequelize.query(
        `ALTER TABLE approval_workflows ADD COLUMN name VARCHAR(200) NOT NULL DEFAULT 'Workflow'`,
        { type: QueryTypes.RAW }
      );
      console.log('✅ name column added');
    } else {
      console.log('✅ name column already exists');
    }
    
    // Check if is_default column exists
    const checkDefaultColumn = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'approval_workflows' AND column_name = 'is_default'`,
      { type: QueryTypes.SELECT }
    );
    
    if (checkDefaultColumn.length === 0) {
      console.log('Adding is_default column...');
      await sequelize.query(
        `ALTER TABLE approval_workflows ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false`,
        { type: QueryTypes.RAW }
      );
      console.log('✅ is_default column added');
    } else {
      console.log('✅ is_default column already exists');
    }
    
    // Check if is_active column exists
    const checkActiveColumn = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'approval_workflows' AND column_name = 'is_active'`,
      { type: QueryTypes.SELECT }
    );
    
    if (checkActiveColumn.length === 0) {
      console.log('Adding is_active column...');
      await sequelize.query(
        `ALTER TABLE approval_workflows ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true`,
        { type: QueryTypes.RAW }
      );
      console.log('✅ is_active column added');
    } else {
      console.log('✅ is_active column already exists');
    }
    
    // Check if created_by column exists
    const checkCreatedByColumn = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'approval_workflows' AND column_name = 'created_by'`,
      { type: QueryTypes.SELECT }
    );
    
    if (checkCreatedByColumn.length === 0) {
      console.log('Adding created_by column...');
      await sequelize.query(
        `ALTER TABLE approval_workflows ADD COLUMN created_by INTEGER NOT NULL REFERENCES users(id)`,
        { type: QueryTypes.RAW }
      );
      console.log('✅ created_by column added');
    } else {
      console.log('✅ created_by column already exists');
    }
    
    // Check if updated_by column exists
    const checkUpdatedByColumn = await sequelize.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'approval_workflows' AND column_name = 'updated_by'`,
      { type: QueryTypes.SELECT }
    );
    
    if (checkUpdatedByColumn.length === 0) {
      console.log('Adding updated_by column...');
      await sequelize.query(
        `ALTER TABLE approval_workflows ADD COLUMN updated_by INTEGER REFERENCES users(id)`,
        { type: QueryTypes.RAW }
      );
      console.log('✅ updated_by column added');
    } else {
      console.log('✅ updated_by column already exists');
    }
    
    console.log('\n✅ All columns checked/added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  }
}

// Run the migration
addMissingColumns();
