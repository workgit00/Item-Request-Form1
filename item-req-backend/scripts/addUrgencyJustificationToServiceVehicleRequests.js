import { sequelize } from '../config/database.js';

async function addUrgencyJustificationColumn() {
    try {
        console.log('Checking service_vehicle_requests table...');
        const table = await sequelize.queryInterface.describeTable('service_vehicle_requests');

        if (table.urgency_justification) {
            console.log('urgency_justification column already exists in service_vehicle_requests table');
            return;
        }

        console.log('Adding urgency_justification column...');
        await sequelize.queryInterface.addColumn('service_vehicle_requests', 'urgency_justification', {
            type: sequelize.Sequelize.TEXT,
            allowNull: true,
            comment: 'Reason for same-day request'
        });

        console.log('✓ Successfully added urgency_justification column to service_vehicle_requests table');
    } catch (error) {
        console.error('Error adding urgency_justification column:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

addUrgencyJustificationColumn();
