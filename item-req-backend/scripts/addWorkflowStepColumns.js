import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

async function addMissingColumns() {
  try {
    console.log('Checking and adding missing columns to workflow_steps table...');
    
    const columnsToCheck = [
      { name: 'step_name', type: 'VARCHAR(200) NOT NULL DEFAULT \'Step\'', hasDefault: true },
      { name: 'approver_type', type: 'VARCHAR(50) NOT NULL', hasDefault: false },
      { name: 'approver_role', type: 'VARCHAR(50)', hasDefault: false },
      { name: 'approver_user_id', type: 'INTEGER REFERENCES users(id)', hasDefault: false },
      { name: 'approver_department_id', type: 'INTEGER REFERENCES departments(id)', hasDefault: false },
      { name: 'requires_same_department', type: 'BOOLEAN NOT NULL DEFAULT false', hasDefault: true },
      { name: 'is_required', type: 'BOOLEAN NOT NULL DEFAULT true', hasDefault: true },
      { name: 'can_skip', type: 'BOOLEAN NOT NULL DEFAULT false', hasDefault: true },
      { name: 'status_on_approval', type: 'VARCHAR(50) NOT NULL', hasDefault: false },
      { name: 'status_on_completion', type: 'VARCHAR(50)', hasDefault: false }
    ];
    
    for (const column of columnsToCheck) {
      const checkColumn = await sequelize.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = 'workflow_steps' AND column_name = '${column.name}'`,
        { type: QueryTypes.SELECT }
      );
      
      if (checkColumn.length === 0) {
        console.log(`Adding ${column.name} column...`);
        await sequelize.query(
          `ALTER TABLE workflow_steps ADD COLUMN ${column.name} ${column.type}`,
          { type: QueryTypes.RAW }
        );
        console.log(`✅ ${column.name} column added`);
      } else {
        console.log(`✅ ${column.name} column already exists`);
      }
    }
    
    console.log('\n✅ All workflow_steps columns checked/added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  }
}

// Run the migration
addMissingColumns();
