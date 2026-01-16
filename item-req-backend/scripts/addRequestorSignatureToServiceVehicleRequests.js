import { sequelize } from '../config/database.js';

async function addRequestorSignatureColumn() {
    try {
        console.log('Checking service_vehicle_requests table...');
        const table = await sequelize.queryInterface.describeTable('service_vehicle_requests');

        if (table.requestor_signature) {
            console.log('requestor_signature column already exists in service_vehicle_requests table');
            return;
        }

        console.log('Adding requestor_signature column...');
        await sequelize.queryInterface.addColumn('service_vehicle_requests', 'requestor_signature', {
            type: sequelize.Sequelize.TEXT,
            allowNull: true,
            comment: 'Base64 encoded signature of the requestor'
        });

        console.log('✓ Successfully added requestor_signature column to service_vehicle_requests table');
    } catch (error) {
        console.error('Error adding requestor_signature column:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

addRequestorSignatureColumn();
