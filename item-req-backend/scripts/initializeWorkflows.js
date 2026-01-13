import { sequelize } from '../config/database.js';
import { initializeDefaultWorkflows } from '../models/index.js';

async function run() {
  try {
    console.log('Initializing default workflows...');
    await sequelize.authenticate();
    console.log('Database connection established.');
    
    await initializeDefaultWorkflows();
    
    console.log('\n✅ Workflow initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing workflows:', error);
    process.exit(1);
  }
}

run();
