import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const WorkflowStep = sequelize.define('WorkflowStep', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  workflow_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'approval_workflows',
      key: 'id',
      onDelete: 'CASCADE'
    },
    comment: 'ID of the workflow this step belongs to'
  },
  step_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Order of this step in the workflow (1, 2, 3, etc.)'
  },
  step_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Name of this approval step (e.g., "Department Approval", "IT Manager Approval")'
  },
  approver_type: {
    type: DataTypes.ENUM('role', 'user', 'department', 'department_approver'),
    allowNull: false,
    comment: 'Type of approver: role-based, specific user, department, or department approver'
  },
  approver_role: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Role required to approve (if approver_type is "role")'
  },
  approver_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Specific user ID who can approve (if approver_type is "user")'
  },
  approver_department_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'departments',
      key: 'id'
    },
    comment: 'Department ID whose approver can approve (if approver_type is "department" or "department_approver")'
  },
  requires_same_department: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'If true, approver must be from the same department as the requestor'
  },
  is_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Whether this step is required or optional'
  },
  can_skip: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Whether this step can be skipped under certain conditions'
  },
  status_on_approval: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Status to set when this step is approved (e.g., "department_approved", "it_manager_approved")'
  },
  status_on_completion: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Final status if this is the last step (e.g., "completed")'
  }
}, {
  tableName: 'workflow_steps',
  timestamps: true,
  underscored: true
});

export default WorkflowStep;
