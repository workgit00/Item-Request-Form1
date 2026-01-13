import { sequelize } from '../config/database.js';
import User from './User.js';
import Department from './Department.js';
import Request from './Request.js';
import RequestItem from './RequestItem.js';
import Approval from './Approval.js';
import ServiceVehicleRequest from './ServiceVehicleRequest.js';

// Define associations

// User - Department associations
User.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});

Department.hasMany(User, {
  foreignKey: 'department_id',
  as: 'Users'
});


// Request - User associations
Request.belongsTo(User, {
  foreignKey: 'requestor_id',
  as: 'Requestor'
});

User.hasMany(Request, {
  foreignKey: 'requestor_id',
  as: 'Requests'
});

// Request - Department associations
Request.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});

Department.hasMany(Request, {
  foreignKey: 'department_id',
  as: 'Requests'
});

// Request - RequestItem associations
Request.hasMany(RequestItem, {
  foreignKey: 'request_id',
  as: 'Items',
  onDelete: 'CASCADE'
});

RequestItem.belongsTo(Request, {
  foreignKey: 'request_id',
  as: 'Request'
});

// Request - Approval associations
Request.hasMany(Approval, {
  foreignKey: 'request_id',
  as: 'Approvals',
  onDelete: 'CASCADE'
});

Approval.belongsTo(Request, {
  foreignKey: 'request_id',
  as: 'Request'
});

// Approval - User associations
Approval.belongsTo(User, {
  foreignKey: 'approver_id',
  as: 'Approver'
});

User.hasMany(Approval, {
  foreignKey: 'approver_id',
  as: 'Approvals'
});

// ServiceVehicleRequest - User associations (requested_by)
ServiceVehicleRequest.belongsTo(User, {
  foreignKey: 'requested_by',
  as: 'RequestedByUser'
});

User.hasMany(ServiceVehicleRequest, {
  foreignKey: 'requested_by',
  as: 'ServiceVehicleRequests'
});

// ServiceVehicleRequest - User associations (assigned_driver)
ServiceVehicleRequest.belongsTo(User, {
  foreignKey: 'assigned_driver',
  as: 'AssignedDriverUser'
});

// ServiceVehicleRequest - Department associations
ServiceVehicleRequest.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});

Department.hasMany(ServiceVehicleRequest, {
  foreignKey: 'department_id',
  as: 'ServiceVehicleRequests'
});

// Export all models
export {
  sequelize,
  User,
  Department,
  Request,
  RequestItem,
  Approval,
  ServiceVehicleRequest
};

// Sync database function
export async function syncDatabase(force = false) {
  try {
    await sequelize.sync({ force, alter: !force });
    console.log('✅ Database synchronized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
    throw error;
  }
}

// Initialize default data
export async function initializeDefaultData() {
  try {
    // Create default departments if they don't exist
    const [itDept] = await Department.findOrCreate({
      where: { name: 'Information Technology' },
      defaults: {
        description: 'IT Department',
        is_active: true
      }
    });

    const [hrDept] = await Department.findOrCreate({
      where: { name: 'Human Resources' },
      defaults: {
        description: 'HR Department',
        is_active: true
      }
    });

    const [financeDept] = await Department.findOrCreate({
      where: { name: 'Finance' },
      defaults: {
        description: 'Finance Department',
        is_active: true
      }
    });

    console.log('✅ Default departments initialized');
    return { itDept, hrDept, financeDept };
  } catch (error) {
    console.error('❌ Failed to initialize default data:', error);
    throw error;
  }
}
