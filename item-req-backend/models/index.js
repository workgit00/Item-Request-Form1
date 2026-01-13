import { sequelize } from '../config/database.js';
import User from './User.js';
import Department from './Department.js';
import Request from './Request.js';
import RequestItem from './RequestItem.js';
import Approval from './Approval.js';
import ServiceVehicleRequest from './ServiceVehicleRequest.js';
import ApprovalWorkflow from './ApprovalWorkflow.js';
import WorkflowStep from './WorkflowStep.js';
import VehicleApproval from './VehicleApproval.js';
 
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
// Removed: assigned_driver is now a string field, not a foreign key
 
// ServiceVehicleRequest - Department associations
ServiceVehicleRequest.belongsTo(Department, {
  foreignKey: 'department_id',
  as: 'Department'
});
 
Department.hasMany(ServiceVehicleRequest, {
  foreignKey: 'department_id',
  as: 'ServiceVehicleRequests'
});
 
// ApprovalWorkflow - User associations
ApprovalWorkflow.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'Creator'
});
 
ApprovalWorkflow.belongsTo(User, {
  foreignKey: 'updated_by',
  as: 'Updater'
});
 
User.hasMany(ApprovalWorkflow, {
  foreignKey: 'created_by',
  as: 'CreatedWorkflows'
});
 
// ApprovalWorkflow - WorkflowStep associations
ApprovalWorkflow.hasMany(WorkflowStep, {
  foreignKey: 'workflow_id',
  as: 'Steps',
  onDelete: 'CASCADE'
});
 
WorkflowStep.belongsTo(ApprovalWorkflow, {
  foreignKey: 'workflow_id',
  as: 'Workflow'
});
 
// WorkflowStep - User associations (for specific user approvers)
WorkflowStep.belongsTo(User, {
  foreignKey: 'approver_user_id',
  as: 'ApproverUser'
});
 
// WorkflowStep - Department associations
WorkflowStep.belongsTo(Department, {
  foreignKey: 'approver_department_id',
  as: 'ApproverDepartment'
});
 
// ServiceVehicleRequest - VehicleApproval associations
ServiceVehicleRequest.hasMany(VehicleApproval, {
  foreignKey: 'vehicle_request_id',
  as: 'Approvals',
  onDelete: 'CASCADE'
});
 
VehicleApproval.belongsTo(ServiceVehicleRequest, {
  foreignKey: 'vehicle_request_id',
  as: 'VehicleRequest'
});
 
// VehicleApproval - User associations
VehicleApproval.belongsTo(User, {
  foreignKey: 'approver_id',
  as: 'Approver'
});
 
User.hasMany(VehicleApproval, {
  foreignKey: 'approver_id',
  as: 'VehicleApprovals'
});
 
// VehicleApproval - WorkflowStep associations
VehicleApproval.belongsTo(WorkflowStep, {
  foreignKey: 'workflow_step_id',
  as: 'WorkflowStep'
});
 
WorkflowStep.hasMany(VehicleApproval, {
  foreignKey: 'workflow_step_id',
  as: 'Approvals'
});
 
// Export all models
export {
  sequelize,
  User,
  Department,
  Request,
  RequestItem,
  Approval,
  ServiceVehicleRequest,
  ApprovalWorkflow,
  WorkflowStep,
  VehicleApproval
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
    // Initialize default workflows if they don't exist
    await initializeDefaultWorkflows();
    return { itDept, hrDept, financeDept };
  } catch (error) {
    console.error('❌ Failed to initialize default data:', error);
    throw error;
  }
}
 
// Initialize default workflows
export async function initializeDefaultWorkflows() {
  try {
    // Get the first super administrator user to use as creator
    const superAdmin = await User.findOne({
      where: { role: 'super_administrator' },
      order: [['id', 'ASC']]
    });
 
    if (!superAdmin) {
      console.log('⚠️  No super administrator found. Skipping default workflow initialization.');
      return;
    }
 
    // Check if default workflows already exist
    const existingItemWorkflow = await ApprovalWorkflow.findOne({
      where: { form_type: 'item_request', is_default: true }
    });
 
    const existingVehicleWorkflow = await ApprovalWorkflow.findOne({
      where: { form_type: 'vehicle_request', is_default: true }
    });
 
    // Create default Item Request workflow if it doesn't exist
    if (!existingItemWorkflow) {
      const itemWorkflow = await ApprovalWorkflow.create({
        form_type: 'item_request',
        name: 'Standard Item Request Workflow',
        is_active: true,
        is_default: true,
        created_by: superAdmin.id,
        updated_by: superAdmin.id
      });
 
      // Create workflow steps for item request
      await WorkflowStep.create({
        workflow_id: itemWorkflow.id,
        step_order: 1,
        step_name: 'Department Approval',
        approver_type: 'role',
        approver_role: 'department_approver',
        approver_user_id: null,
        approver_department_id: null,
        requires_same_department: true,
        is_required: true,
        can_skip: false,
        status_on_approval: 'department_approved',
        status_on_completion: null
      });
 
      await WorkflowStep.create({
        workflow_id: itemWorkflow.id,
        step_order: 2,
        step_name: 'IT Manager Approval',
        approver_type: 'role',
        approver_role: 'it_manager',
        approver_user_id: null,
        approver_department_id: null,
        requires_same_department: false,
        is_required: true,
        can_skip: false,
        status_on_approval: 'it_manager_approved',
        status_on_completion: null
      });
 
      await WorkflowStep.create({
        workflow_id: itemWorkflow.id,
        step_order: 3,
        step_name: 'Service Desk Processing',
        approver_type: 'role',
        approver_role: 'service_desk',
        approver_user_id: null,
        approver_department_id: null,
        requires_same_department: false,
        is_required: true,
        can_skip: false,
        status_on_approval: 'service_desk_processing',
        status_on_completion: 'completed'
      });
 
      console.log('✅ Default Item Request workflow initialized');
    }
 
    // Create default Vehicle Request workflow if it doesn't exist
    if (!existingVehicleWorkflow) {
      const vehicleWorkflow = await ApprovalWorkflow.create({
        form_type: 'vehicle_request',
        name: 'Standard Vehicle Request Workflow',
        is_active: true,
        is_default: true,
        created_by: superAdmin.id,
        updated_by: superAdmin.id
      });
 
      // Create workflow steps for vehicle request (simplified - only department approver)
      await WorkflowStep.create({
        workflow_id: vehicleWorkflow.id,
        step_order: 1,
        step_name: 'Department Approval',
        approver_type: 'role',
        approver_role: 'department_approver',
        approver_user_id: null,
        approver_department_id: null,
        requires_same_department: true,
        is_required: true,
        can_skip: false,
        status_on_approval: 'completed',
        status_on_completion: 'completed'
      });
 
      console.log('✅ Default Vehicle Request workflow initialized');
    }
 
    console.log('✅ Default workflows initialized');
  } catch (error) {
    console.error('❌ Failed to initialize default workflows:', error);
    // Don't throw - allow system to continue even if workflows fail to initialize
  }
}