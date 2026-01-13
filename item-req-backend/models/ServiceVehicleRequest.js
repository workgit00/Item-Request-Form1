import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ServiceVehicleRequest = sequelize.define('ServiceVehicleRequest', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    field: 'request_id'
  },
  requestor_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Name of the person requesting the vehicle'
  },
  department_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'departments',
      key: 'id'
    }
  },
  contact_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Contact number of the requestor'
  },
  date_prepared: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Date when the request was prepared'
  },
  purpose: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Purpose of the vehicle request'
  },
  request_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Type of vehicle request (drop_passenger, pickup_passenger, etc)'
  },
  travel_date_from: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Start date of travel'
  },
  travel_date_to: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'End date of travel'
  },
  pick_up_location: {
    type: DataTypes.STRING(300),
    allowNull: true,
    comment: 'Where the vehicle will be picked up'
  },
  pick_up_time: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Time for vehicle pickup'
  },
  drop_off_location: {
    type: DataTypes.STRING(300),
    allowNull: true,
    comment: 'Where the vehicle will be dropped off'
  },
  drop_off_time: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Time for vehicle drop-off'
  },
  passenger_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Name of the passenger'
  },
  destination: {
    type: DataTypes.STRING(300),
    allowNull: true,
    comment: 'Final destination of the trip'
  },
  departure_time: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Departure time from pickup location'
  },
  destination_car: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Preferred car type or model for destination'
  },
  has_valid_license: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether the requestor has a valid drivers license'
  },
  license_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Driver license number'
  },
  expiration_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'License expiration date'
  },
  requested_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'ID of the user who made the request'
  },
  requested_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Date and time when the request was made'
  },
  reference_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Unique reference code for tracking'
  },
  approval_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when the request was approved'
  },
  assigned_driver: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Name of the assigned driver (manual input)'
  },
  assigned_vehicle: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Assigned vehicle plate number or ID'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Status of the vehicle request'
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Comments or notes about the request'
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Array of attachment file paths and metadata'
  },
  passengers: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Array of passenger objects with name field'
  }
}, {
  tableName: 'service_vehicle_requests',
  timestamps: true,
  underscored: true,
  freezeTableName: true
});

export default ServiceVehicleRequest;
