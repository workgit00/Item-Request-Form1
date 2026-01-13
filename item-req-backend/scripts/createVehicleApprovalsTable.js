import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

/**
 * Script to create vehicle_approvals table for tracking individual approval steps
 * Run this script once to create the table: node scripts/createVehicleApprovalsTable.js
 */
async function createVehicleApprovalsTable() {
  try {
    console.log('🔄 Creating vehicle_approvals table...');

    // Check if table already exists
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicle_approvals'
      );`,
      { type: QueryTypes.SELECT }
    );

    if (tableExists[0].exists) {
      console.log('✅ Table vehicle_approvals already exists. Skipping creation.');
      return;
    }

    // Create the table
    await sequelize.query(`
      CREATE TABLE vehicle_approvals (
        id SERIAL PRIMARY KEY,
        vehicle_request_id INTEGER NOT NULL,
        approver_id INTEGER NOT NULL,
        workflow_step_id INTEGER,
        step_order INTEGER NOT NULL,
        step_name VARCHAR(200) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'returned')),
        comments TEXT,
        approved_at TIMESTAMP WITH TIME ZONE,
        declined_at TIMESTAMP WITH TIME ZONE,
        returned_at TIMESTAMP WITH TIME ZONE,
        return_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_vehicle_request FOREIGN KEY (vehicle_request_id) 
          REFERENCES service_vehicle_requests(request_id) ON DELETE CASCADE,
        CONSTRAINT fk_approver FOREIGN KEY (approver_id) 
          REFERENCES users(id),
        CONSTRAINT fk_workflow_step FOREIGN KEY (workflow_step_id) 
          REFERENCES workflow_steps(id),
        CONSTRAINT unique_vehicle_request_step_order UNIQUE (vehicle_request_id, step_order)
      );
    `);

    // Create indexes
    await sequelize.query(`
      CREATE INDEX idx_vehicle_approvals_vehicle_request_id ON vehicle_approvals(vehicle_request_id);
      CREATE INDEX idx_vehicle_approvals_approver_id ON vehicle_approvals(approver_id);
      CREATE INDEX idx_vehicle_approvals_workflow_step_id ON vehicle_approvals(workflow_step_id);
      CREATE INDEX idx_vehicle_approvals_status ON vehicle_approvals(status);
    `);

    console.log('✅ Successfully created vehicle_approvals table with indexes!');
    console.log('📝 Table structure:');
    console.log('   - id (Primary Key)');
    console.log('   - vehicle_request_id (Foreign Key to service_vehicle_requests)');
    console.log('   - approver_id (Foreign Key to users)');
    console.log('   - workflow_step_id (Foreign Key to workflow_steps)');
    console.log('   - step_order (Integer, unique per request)');
    console.log('   - step_name (VARCHAR 200)');
    console.log('   - status (ENUM: pending, approved, declined, returned)');
    console.log('   - comments (TEXT)');
    console.log('   - approved_at (TIMESTAMP)');
    console.log('   - declined_at (TIMESTAMP)');
    console.log('   - returned_at (TIMESTAMP)');
    console.log('   - return_reason (TEXT)');
    console.log('   - created_at, updated_at (TIMESTAMPS)');
  } catch (error) {
    console.error('❌ Error creating vehicle_approvals table:', error);
    throw error;
  }
}

// Run the script
createVehicleApprovalsTable()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
