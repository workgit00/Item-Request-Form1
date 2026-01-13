import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ApprovalWorkflow = sequelize.define('ApprovalWorkflow', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  form_type: {
    type: DataTypes.ENUM('item_request', 'vehicle_request'),
    allowNull: false,
    comment: 'Type of form this workflow applies to'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'workflow_name', // Map to database column name
    comment: 'Name/description of the workflow'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Whether this workflow is currently active'
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Whether this is the default workflow for this form type'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who created this workflow'
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who last updated this workflow'
  }
}, {
  tableName: 'approval_workflows',
  timestamps: true,
  underscored: true
});

export default ApprovalWorkflow;
