import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const VehicleApproval = sequelize.define('VehicleApproval', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  vehicle_request_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'service_vehicle_requests',
      key: 'request_id'
    },
    onDelete: 'CASCADE',
    comment: 'ID of the vehicle request'
  },
  approver_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'ID of the user who approved/declined/returned'
  },
  workflow_step_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'workflow_steps',
      key: 'id'
    },
    comment: 'ID of the workflow step this approval corresponds to'
  },
  step_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Order of the approval step (1, 2, 3, etc.)'
  },
  step_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Name of the approval step (e.g., "Department Approval", "HR Approver")'
  },
  status: {
    type: DataTypes.ENUM(
      'pending',
      'approved',
      'declined',
      'returned'
    ),
    allowNull: false,
    defaultValue: 'pending'
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Approval comments or feedback'
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date and time when this step was approved'
  },
  declined_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date and time when this step was declined'
  },
  returned_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date and time when this step was returned'
  },
  return_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for returning the request'
  }
}, {
  tableName: 'vehicle_approvals',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['vehicle_request_id']
    },
    {
      fields: ['approver_id']
    },
    {
      fields: ['workflow_step_id']
    },
    {
      fields: ['status']
    },
    {
      unique: true,
      fields: ['vehicle_request_id', 'step_order'],
      name: 'unique_vehicle_request_step_order'
    }
  ]
});

// Instance methods
VehicleApproval.prototype.approve = function(comments = null) {
  this.status = 'approved';
  this.comments = comments;
  this.approved_at = new Date();
  this.declined_at = null;
  this.returned_at = null;
};

VehicleApproval.prototype.decline = function(comments = null) {
  this.status = 'declined';
  this.comments = comments;
  this.declined_at = new Date();
  this.approved_at = null;
  this.returned_at = null;
};

VehicleApproval.prototype.returnForRevision = function(reason) {
  this.status = 'returned';
  this.return_reason = reason;
  this.returned_at = new Date();
  this.approved_at = null;
  this.declined_at = null;
};

export default VehicleApproval;
