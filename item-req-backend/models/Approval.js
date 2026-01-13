import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Approval = sequelize.define('Approval', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  request_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'requests',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  approver_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approval_type: {
    type: DataTypes.ENUM(
      'department_approval',
      'it_manager_approval',
      'service_desk_processing'
    ),
    allowNull: false
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
    allowNull: true
  },
  declined_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  returned_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  return_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for returning the request'
  },
  estimated_completion_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Estimated date for completion (service desk use)'
  },
  actual_completion_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Actual completion date'
  },
  processing_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Processing notes for service desk'
  },
  signature: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Base64 encoded signature image of the approver'
  }
}, {
  tableName: 'approvals',
  indexes: [
    {
      fields: ['request_id']
    },
    {
      fields: ['approver_id']
    },
    {
      fields: ['approval_type']
    },
    {
      fields: ['status']
    },
    {
      unique: true,
      fields: ['request_id', 'approval_type'],
      name: 'unique_request_approval_type'
    }
  ]
});

// Instance methods
Approval.prototype.approve = function(comments = null) {
  this.status = 'approved';
  this.comments = comments;
  this.approved_at = new Date();
  this.declined_at = null;
  this.returned_at = null;
};

Approval.prototype.decline = function(comments = null) {
  this.status = 'declined';
  this.comments = comments;
  this.declined_at = new Date();
  this.approved_at = null;
  this.returned_at = null;
};

Approval.prototype.returnForRevision = function(reason) {
  this.status = 'returned';
  this.return_reason = reason;
  this.returned_at = new Date();
  this.approved_at = null;
  this.declined_at = null;
};

Approval.prototype.getStatusDisplayName = function() {
  const statusNames = {
    'pending': 'Pending Review',
    'approved': 'Approved',
    'declined': 'Declined',
    'returned': 'Returned for Revision'
  };
  
  return statusNames[this.status] || this.status;
};

Approval.prototype.getApprovalTypeDisplayName = function() {
  const typeNames = {
    'department_approval': 'Department Approval',
    'it_manager_approval': 'IT Manager Approval',
    'service_desk_processing': 'Service Desk Processing'
  };
  
  return typeNames[this.approval_type] || this.approval_type;
};

export default Approval;
