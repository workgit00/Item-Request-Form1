import { sequelize } from '../config/database.js';

async function addVerifierColumns() {
    try {
        console.log('Checking service_vehicle_requests table...');
        const table = await sequelize.queryInterface.describeTable('service_vehicle_requests');

        if (table.verifier_id) {
            console.log('verifier_id column already exists');
        } else {
            console.log('Adding verifier_id column...');
            await sequelize.queryInterface.addColumn('service_vehicle_requests', 'verifier_id', {
                type: sequelize.Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'User ID of the temporary verifier'
            });
            console.log('✓ Added verifier_id');
        }

        if (table.verification_status) {
            console.log('verification_status column already exists');
        } else {
            console.log('Adding verification_status column...');
            await sequelize.queryInterface.addColumn('service_vehicle_requests', 'verification_status', {
                type: sequelize.Sequelize.STRING,
                allowNull: true,
                defaultValue: 'none', // none, pending, verified, declined
                comment: 'Status of the temporary verification'
            });
            console.log('✓ Added verification_status');
        }

        if (table.verified_at) {
            console.log('verified_at column already exists');
        } else {
            console.log('Adding verified_at column...');
            await sequelize.queryInterface.addColumn('service_vehicle_requests', 'verified_at', {
                type: sequelize.Sequelize.DATE,
                allowNull: true,
                comment: 'Timestamp when verification action was taken'
            });
            console.log('✓ Added verified_at');
        }

        if (table.verifier_comments) {
            console.log('verifier_comments column already exists');
        } else {
            console.log('Adding verifier_comments column...');
            await sequelize.queryInterface.addColumn('service_vehicle_requests', 'verifier_comments', {
                type: sequelize.Sequelize.TEXT,
                allowNull: true,
                comment: 'Comments from the verifier'
            });
            console.log('✓ Added verifier_comments');
        }

        console.log('✓ Successfully added verification columns to service_vehicle_requests table');
    } catch (error) {
        console.error('Error adding verification columns:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

addVerifierColumns();
