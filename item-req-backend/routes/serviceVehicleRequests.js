import express from "express";
import { Op } from "sequelize";
import { body, validationResult } from "express-validator";
import {
  ServiceVehicleRequest,
  User,
  Department,
  VehicleApproval,
  WorkflowStep,
  sequelize,
} from "../models/index.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import emailService from "../utils/emailService.js";
import { processWorkflowOnSubmit, processWorkflowOnApproval, findCurrentStepForApprover, getActiveWorkflow, findApproverForStep } from "../utils/workflowProcessor.js";
import upload from "../utils/uploadConfig.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Helper function to build order clause for sorting vehicle requests
function buildVehicleOrderClause(sortBy, sortOrder) {
  const order = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  
  switch (sortBy) {
    case 'status':
      return [['status', order], ['created_at', 'DESC']];
    case 'requestor':
      return [
        [{ model: User, as: 'RequestedByUser' }, 'first_name', order],
        [{ model: User, as: 'RequestedByUser' }, 'last_name', order],
        ['created_at', 'DESC']
      ];
    case 'date':
    default:
      return [['created_at', order]];
  }
}

// Upload attachment for vehicle request
router.post(
  "/:id/attachments",
  authenticateToken,
  upload.array('files', 10), // Allow up to 10 files
  async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded"
        });
      }

      // Load request with User relation to get requestor email
      const request = await ServiceVehicleRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: "RequestedByUser",
            attributes: ["id", "first_name", "last_name", "email", "username"],
          },
        ],
      });
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found"
        });
      }

      // Check if user has permission to upload attachments
      // Only approvers (department_approver) and super_administrator can upload attachments
      // Requestors cannot upload attachments
      const isApprover = req.user.role === 'department_approver' || req.user.role === 'super_administrator';
      
      if (!isApprover) {
        return res.status(403).json({
          success: false,
          message: "Only approvers can upload attachments"
        });
      }

      // Allow attachment uploads for submitted, returned, department_approved, or completed requests
      // ODHC users need to upload attachments during the approval process (department_approved status), not just after completion
      if (!['submitted', 'returned', 'department_approved', 'completed'].includes(request.status)) {
        return res.status(400).json({
          success: false,
          message: "Attachments can only be uploaded for submitted, returned, department_approved, or completed requests"
        });
      }

      // Prepare attachment metadata
      const newAttachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: `/uploads/vehicle-requests/${file.filename}`,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user.id
      }));

      // Get existing attachments or initialize empty array
      const existingAttachments = request.attachments || [];
      const updatedAttachments = [...existingAttachments, ...newAttachments];

      // Update request with new attachments
      await request.update({
        attachments: updatedAttachments
      });

      // Send email notification to requestor about new attachments
      try {
        // Use the request we already loaded with relations
        if (request?.RequestedByUser) {
          // Convert to plain object to ensure all fields are accessible
          const requestedByUser = request.RequestedByUser.toJSON 
            ? request.RequestedByUser.toJSON() 
            : request.RequestedByUser;
          
          const requestorData = {
            ...requestedByUser,
            firstName: requestedByUser.first_name,
            lastName: requestedByUser.last_name,
            fullName: `${requestedByUser.first_name} ${requestedByUser.last_name}`,
            email: requestedByUser.email // Explicitly include email
          };
          
          // Debug logging
          console.log('📧 Attachment upload email notification:');
          console.log('   Requestor email:', requestorData.email);
          console.log('   Requestor name:', requestorData.fullName);
          console.log('   Request ID:', id);
          console.log('   RequestedByUser raw:', JSON.stringify(requestedByUser, null, 2));
          
          // Reload request to get updated attachments
          const requestWithAttachments = await ServiceVehicleRequest.findByPk(id);
          const requestData = requestWithAttachments.toJSON ? requestWithAttachments.toJSON() : requestWithAttachments;
          requestData.attachments = updatedAttachments; // Include all attachments including new ones
          
          await emailService.notifyVehicleAttachmentUploaded(
            requestData,
            requestorData,
            req.user,
            newAttachments.length,
            newAttachments // Pass only the newly uploaded attachments
          );
        } else {
          console.log('⚠️ RequestedByUser not found for request:', id);
          console.log('   Request object keys:', Object.keys(request || {}));
        }
      } catch (emailError) {
        console.error("Failed to send email notification for attachment upload:", emailError);
        console.error("Error stack:", emailError.stack);
        // Don't fail the upload if email fails
      }

      res.json({
        success: true,
        message: "Files uploaded successfully",
        attachments: newAttachments
      });
    } catch (error) {
      console.error("Error uploading attachments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload attachments",
        error: error.message
      });
    }
  }
);

// Delete attachment
router.delete(
  "/:id/attachments/:filename",
  authenticateToken,
  async (req, res) => {
    try {
      const { id, filename } = req.params;
      
      const request = await ServiceVehicleRequest.findByPk(id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found"
        });
      }

      // Check if user has permission to delete attachments
      // Only approvers (department_approver) and super_administrator can delete attachments
      const isApprover = req.user.role === 'department_approver' || req.user.role === 'super_administrator';
      
      if (!isApprover) {
        return res.status(403).json({
          success: false,
          message: "Only approvers can delete attachments"
        });
      }

      const attachments = request.attachments || [];
      const attachmentIndex = attachments.findIndex(att => att.filename === filename);

      if (attachmentIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Attachment not found"
        });
      }

      // Remove attachment from array
      const updatedAttachments = attachments.filter(att => att.filename !== filename);
      await request.update({
        attachments: updatedAttachments
      });

      // Optionally delete file from filesystem
      const fs = await import('fs');
      const filePath = join(__dirname, '..', 'uploads', 'vehicle-requests', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.json({
        success: true,
        message: "Attachment deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete attachment",
        error: error.message
      });
    }
  }
);

// Helper function to validate and format dates
function formatDate(dateString) {
  if (!dateString || dateString.trim() === "") return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0]; // Returns YYYY-MM-DD format
}

// Generate reference code
function generateReferenceCode() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const timestamp = now.getTime().toString().slice(-6);

  return `SVR-${year}${month}${day}-${timestamp}`;
}

// Get all service vehicle requests (with filtering and pagination)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = "",
      department = "",
      search = "",
      sortBy = 'date', // 'date', 'status', 'requestor'
      sortOrder = 'desc' // 'asc' or 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = {};

    // Role-based filtering
    if (req.user.role === "requestor") {
      // Requestors can only see their own requests
      whereClause.requested_by = req.user.id;
    } else if (req.user.role === "department_approver") {
      // For vehicle requests, ODHC department approvers should see ALL requests
      // (since all vehicle requests are routed to ODHC)
      // Check if user is from ODHC department
      const odhcDepartment = await Department.findOne({
        where: {
          name: { [Op.iLike]: '%ODHC%' },
          is_active: true,
        },
      });
      
      if (odhcDepartment && req.user.department_id === odhcDepartment.id) {
        // ODHC department approver can see all vehicle requests
        // No where clause restriction
      } else {
        // Other department approvers can see requests from their department
      whereClause.department_id = req.user.department_id;
      }
    } else if (
      ["it_manager", "service_desk", "super_administrator"].includes(
        req.user.role
      )
    ) {
      // IT managers, service desk, and super admins can see all requests
      // No where clause restriction
    }

    // Status filter
    if (status) {
      whereClause.status = status;
    }

    // Department filter
    if (department) {
      whereClause.department_id = department;
    }

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { requestor_name: { [Op.iLike]: `%${search}%` } },
        { reference_code: { [Op.iLike]: `%${search}%` } },
        { destination: { [Op.iLike]: `%${search}%` } },
        { passenger_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ServiceVehicleRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "RequestedByUser",
          attributes: ["id", "first_name", "last_name", "email", "username"],
        },
        {
          model: Department,
          as: "Department",
          attributes: ["id", "name"],
        },
        {
          model: VehicleApproval,
          as: "Approvals",
          include: [
            {
              model: User,
              as: "Approver",
              attributes: ["id", "first_name", "last_name", "username", "role"],
            }
          ],
          order: [['step_order', 'ASC']],
          required: false
        },
      ],
      offset,
      limit: parseInt(limit),
      order: buildVehicleOrderClause(sortBy, sortOrder),
    });

    // Map vehicle requests to include camelCase user fields and approvals
    const mappedRequests = await Promise.all(rows.map(async (request) => {
      const requestData = request.toJSON ? request.toJSON() : request;
      
      // Map RequestedByUser
      if (requestData.RequestedByUser) {
        requestData.RequestedByUser = {
          ...requestData.RequestedByUser,
          firstName: requestData.RequestedByUser.first_name,
          lastName: requestData.RequestedByUser.last_name,
          fullName: `${requestData.RequestedByUser.first_name} ${requestData.RequestedByUser.last_name}`
        };
      }
      
      // Map Approvals
      if (requestData.Approvals) {
        requestData.approvals = requestData.Approvals.map(approval => ({
          id: approval.id,
          stepOrder: approval.step_order,
          stepName: approval.step_name,
          status: approval.status,
          approver: approval.Approver ? {
            id: approval.Approver.id,
            fullName: `${approval.Approver.first_name} ${approval.Approver.last_name}`,
            username: approval.Approver.username,
            role: approval.Approver.role
          } : null,
          comments: approval.comments,
          approvedAt: approval.approved_at,
          declinedAt: approval.declined_at,
          returnedAt: approval.returned_at
        }));
      } else {
        requestData.approvals = [];
      }
      
      // Check if request is pending current user's approval using workflow
      // Skip if request is completed, declined, or draft
      if (!['completed', 'declined', 'draft'].includes(requestData.status)) {
        try {
          const currentStep = await findCurrentStepForApprover('vehicle_request', req.user, requestData.status, {
            department_id: requestData.department_id
          });
          
          if (currentStep) {
            // This request is pending the current user's approval
            requestData.isPendingMyApproval = true;
          } else {
            // Check if there's a pending approval record for this user
            requestData.isPendingMyApproval = requestData.approvals.some(approval => 
              approval.status === 'pending' && 
              approval.approver && 
              approval.approver.id === req.user.id
            );
          }
        } catch (error) {
          console.error('Error checking pending approval:', error);
          // Fallback to checking approvals array
          requestData.isPendingMyApproval = requestData.approvals.some(approval => 
            approval.status === 'pending' && 
            approval.approver && 
            approval.approver.id === req.user.id
          );
        }
      } else {
        requestData.isPendingMyApproval = false;
      }
      
      return requestData;
    }));

    res.json({
      success: true,
      requests: mappedRequests,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching service vehicle requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch requests",
      error: error.message,
    });
  }
});

// Get single service vehicle request
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceVehicleRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: "RequestedByUser",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "email",
            "username",
            "role",
          ],
        },
        {
          model: Department,
          as: "Department",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service vehicle request not found",
      });
    }

    // Check access permissions
    let hasAccess = false;
    
    if (req.user.id === request.requested_by) {
      // Requestor can always see their own request
      hasAccess = true;
    } else if (["it_manager", "service_desk", "super_administrator"].includes(req.user.role)) {
      // IT managers, service desk, and super admins can see all requests
      hasAccess = true;
    } else if (req.user.role === "department_approver") {
      // For vehicle requests, ODHC department approvers should see ALL requests
      // Check if user is from ODHC department
      const odhcDepartment = await Department.findOne({
        where: {
          name: { [Op.iLike]: '%ODHC%' },
          is_active: true,
        },
      });
      
      if (odhcDepartment && req.user.department_id === odhcDepartment.id) {
        // ODHC department approver can see all vehicle requests
        hasAccess = true;
      } else if (req.user.department_id === request.department_id) {
        // Other department approvers can see requests from their department
        hasAccess = true;
      }
    } else if (req.user.department_id === request.department_id) {
      // Users from the same department can see the request
      hasAccess = true;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this request",
      });
    }

    // Map request to include camelCase user fields
    const requestData = request.toJSON ? request.toJSON() : request;
    
    // Map RequestedByUser
    if (requestData.RequestedByUser) {
      requestData.RequestedByUser = {
        ...requestData.RequestedByUser,
        firstName: requestData.RequestedByUser.first_name,
        lastName: requestData.RequestedByUser.last_name,
        fullName: `${requestData.RequestedByUser.first_name} ${requestData.RequestedByUser.last_name}`
      };
    }

    res.json({
      success: true,
      request: requestData,
    });
  } catch (error) {
    console.error("Error fetching service vehicle request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch request",
      error: error.message,
    });
  }
});

// Create service vehicle request
router.post(
  "/",
  authenticateToken,
  [
    body("requestor_name").notEmpty().withMessage("Requestor name is required"),
    body("department_id").isInt().withMessage("Department ID is required"),
    body("request_type")
      .isIn([
        "drop_passenger_only",
        "point_to_point_service",
        "passenger_pickup_only",
        "item_pickup",
        "item_delivery",
        "car_only",
      ])
      .withMessage("Invalid request type"),
    body("travel_date_from")
      .if((value, { req }) => req.body.status === "submitted")
      .notEmpty()
      .withMessage("Travel date from is required")
      .custom((value) => {
        const formatted = formatDate(value);
        if (!formatted) throw new Error("Valid travel date from is required");
        return true;
      }),
    // Conditional validation for license - only required for car_only
    body("has_valid_license")
      .customSanitizer((value, { req }) => {
        // Only process if request_type is car_only
        if (req.body.request_type !== "car_only") {
          return null; // Set to null for non-car_only requests
        }
        if (value === "" || value === null || value === undefined) return true;
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        return value;
      })
      .if(() => req.body.request_type === "car_only")
      .isBoolean()
      .withMessage("License validity must be specified for car only requests"),
    body("license_number")
      .if(
        () =>
          req.body.request_type === "car_only" &&
          req.body.has_valid_license === true
      )
      .notEmpty()
      .withMessage("License number is required"),
    body("expiration_date")
      .if(
        () =>
          req.body.request_type === "car_only" &&
          req.body.has_valid_license === true
      )
      .notEmpty()
      .isISO8601()
      .withMessage("License expiration date is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const {
        requestor_name,
        department_id,
        contact_number,
        date_prepared,
        purpose,
        request_type,
        travel_date_from,
        travel_date_to,
        pick_up_location,
        pick_up_time,
        drop_off_location,
        drop_off_time,
        passenger_name,
        passengers,
        destination,
        departure_time,
        destination_car,
        has_valid_license,
        license_number,
        expiration_date,
        comments,
        status,
      } = req.body;

      // Process passengers array - filter out empty entries and keep only those with names
      let processedPassengers = null;
      if (passengers && Array.isArray(passengers)) {
        processedPassengers = passengers
          .filter(p => p && p.name && p.name.trim() !== '')
          .map(p => ({ name: p.name.trim() }));
        if (processedPassengers.length === 0) {
          processedPassengers = null;
        }
      }

      // Sanitize and validate date fields
      const sanitizedData = {
        requestor_name,
        department_id,
        contact_number: contact_number || null,
        date_prepared:
          formatDate(date_prepared) || new Date().toISOString().split("T")[0],
        purpose: purpose || null,
        request_type,
        travel_date_from: formatDate(travel_date_from),
        travel_date_to: formatDate(travel_date_to),
        pick_up_location: pick_up_location || null,
        pick_up_time: pick_up_time || null,
        drop_off_location: drop_off_location || null,
        drop_off_time: drop_off_time || null,
        passenger_name: passenger_name || null,
        passengers: processedPassengers, // Save passengers array
        destination: destination || null,
        departure_time: departure_time || null,
        destination_car: destination_car || null,
        has_valid_license:
          request_type === "car_only"
            ? has_valid_license === "true" || has_valid_license === true
            : true,
        license_number:
          request_type === "car_only" && has_valid_license
            ? license_number
            : null,
        expiration_date:
          request_type === "car_only" && has_valid_license
            ? formatDate(expiration_date)
            : null,
        requested_by: req.user.id,
        reference_code: generateReferenceCode(),
        status: status === "draft" ? "draft" : "submitted",
        comments: comments || null,
      };

      const newRequest = await ServiceVehicleRequest.create(sanitizedData);

      res.status(201).json({
        success: true,
        message: "Service vehicle request created successfully",
        request: newRequest,
      });
    } catch (error) {
      console.error("Error creating service vehicle request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create request",
        error: error.message,
      });
    }
  }
);

// Update service vehicle request
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceVehicleRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service vehicle request not found",
      });
    }

    // Check if user can edit this request
    const canEdit =
      (req.user.id === request.requested_by &&
        ["draft", "returned"].includes(request.status)) ||
      ["it_manager", "super_administrator"].includes(req.user.role);

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this request",
      });
    }

    // Process passengers array if provided
    if (req.body.passengers !== undefined) {
      if (req.body.passengers && Array.isArray(req.body.passengers)) {
        // Filter out empty entries and keep only those with names
        const processedPassengers = req.body.passengers
          .filter(p => p && p.name && p.name.trim() !== '')
          .map(p => ({ name: p.name.trim() }));
        request.passengers = processedPassengers.length > 0 ? processedPassengers : null;
      } else {
        request.passengers = null;
      }
    }

    // Update allowed fields
    const updateFields = [
      "requestor_name",
      "contact_number",
      "date_prepared",
      "purpose",
      "request_type",
      "travel_date_from",
      "travel_date_to",
      "pick_up_location",
      "pick_up_time",
      "drop_off_location",
      "drop_off_time",
      "passenger_name",
      "destination",
      "departure_time",
      "destination_car",
      "has_valid_license",
      "license_number",
      "expiration_date",
      "comments",
      "status",
    ];

    updateFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // Sanitize date fields
        if (
          [
            "date_prepared",
            "travel_date_from",
            "travel_date_to",
            "expiration_date",
          ].includes(field)
        ) {
          request[field] = formatDate(req.body[field]);
        } else if (
          ["pick_up_time", "drop_off_time", "departure_time"].includes(field)
        ) {
          request[field] = req.body[field] || null;
        } else if (
          [
            "contact_number",
            "purpose",
            "pick_up_location",
            "drop_off_location",
            "passenger_name",
            "destination",
            "destination_car",
            "license_number",
            "comments",
          ].includes(field)
        ) {
          request[field] = req.body[field] || null;
        } else {
          request[field] = req.body[field];
        }
      }
    });

    await request.save();

    res.json({
      success: true,
      message: "Service vehicle request updated successfully",
      request,
    });
  } catch (error) {
    console.error("Error updating service vehicle request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update request",
      error: error.message,
    });
  }
});

// Submit service vehicle request
router.post("/:id/submit", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceVehicleRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service vehicle request not found",
      });
    }

    // Check if user can submit this request
    if (req.user.id !== request.requested_by) {
      return res.status(403).json({
        success: false,
        message: "You can only submit your own requests",
      });
    }

    if (!["draft", "returned"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: "Only draft or returned requests can be submitted",
      });
    }

    // Reload request with relations for email
    const requestWithRelations = await ServiceVehicleRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: "RequestedByUser",
          attributes: ["id", "first_name", "last_name", "email", "username"],
        },
        {
          model: Department,
          as: "Department",
          attributes: ["id", "name"],
        },
      ],
    });

    request.status = "submitted";
    request.submitted_at = new Date();
    await request.save();

    // Use workflow system to find the first approver
    const workflowResult = await processWorkflowOnSubmit('vehicle_request', {
      department_id: request.department_id
    });

    let departmentApprover = null;
    
    if (workflowResult && workflowResult.approver) {
      // Use approver from workflow
      departmentApprover = workflowResult.approver;
      console.log(`✅ Found approver from workflow: ${departmentApprover.email} (Step: ${workflowResult.step.step_name})`);
    } else {
      // Fallback to old logic if no workflow found
      console.warn('⚠️ No workflow found, using fallback approver logic');
      // Find ODHC department approver (vehicle requests go to ODHC, not requestor's department)
      const odhcDepartment = await Department.findOne({
        where: {
          name: { [Op.iLike]: '%ODHC%' }, // Case-insensitive search for ODHC department
          is_active: true,
        },
      });

      if (!odhcDepartment) {
        console.warn('⚠️ ODHC department not found. Falling back to requestor department.');
      }

      // Find department approver from ODHC department, or fallback to requestor's department
      departmentApprover = await User.findOne({
        where: {
          department_id: odhcDepartment?.id || request.department_id,
          role: "department_approver",
          is_active: true,
        },
      });
    }

    // Convert Sequelize instances to plain objects for email service
    const requestData = requestWithRelations?.toJSON ? requestWithRelations.toJSON() : requestWithRelations;
    const requestorData = requestData?.RequestedByUser ? {
      ...requestData.RequestedByUser,
      firstName: requestData.RequestedByUser.first_name,
      lastName: requestData.RequestedByUser.last_name,
      fullName: `${requestData.RequestedByUser.first_name} ${requestData.RequestedByUser.last_name}`
    } : null;

    // Send email notifications
    try {
      if (requestorData?.email) {
        await emailService.notifyVehicleRequestSubmitted(
          requestData,
          requestorData,
          departmentApprover
        );
      }
      if (departmentApprover?.email) {
        await emailService.notifyVehicleApprovalRequired(
          requestData,
          requestorData,
          departmentApprover
        );
      }
    } catch (emailError) {
      console.error("Failed to send email notifications:", emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: "Service vehicle request submitted successfully",
      request,
    });
  } catch (error) {
    console.error("Error submitting service vehicle request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit request",
      error: error.message,
    });
  }
});

// Approve service vehicle request
// Vehicle requests only go through ODHC (department approver) - this is the final step
router.post(
  "/:id/approve",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { remarks } = req.body;

      const request = await ServiceVehicleRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: "RequestedByUser",
            attributes: ["id", "first_name", "last_name", "email", "username"],
            required: false, // Left join in case user doesn't exist
          },
          {
            model: Department,
            as: "Department",
            attributes: ["id", "name"],
          },
        ],
      });
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found",
        });
      }

      // Use workflow system to determine which statuses can be approved
      const workflow = await getActiveWorkflow('vehicle_request');
      let allowedStatuses = ["submitted", "returned"];
      
      if (workflow && workflow.Steps && workflow.Steps.length > 0) {
        // Build list of allowed statuses based on workflow steps
        // Include 'submitted' and 'returned' for first step
        // Include all status_on_approval values for subsequent steps
        const statusOnApprovalValues = workflow.Steps.map(step => step.status_on_approval).filter(Boolean);
        allowedStatuses = ["submitted", "returned", ...statusOnApprovalValues];
      }
      
      if (!allowedStatuses.includes(request.status)) {
        return res.status(400).json({
          success: false,
          message: `Only requests with status ${allowedStatuses.join(', ')} can be approved`,
        });
      }

      // Check if approver is from ODHC department
      const odhcDepartment = await Department.findOne({
        where: {
          name: { [Op.iLike]: '%ODHC%' },
        },
      });
      const isODHCApprover = odhcDepartment && req.user.department_id === odhcDepartment.id;

      // Validate that Section 4 fields are filled before approval ONLY if approver is ODHC
      if (isODHCApprover) {
        if (!request.assigned_driver || !request.assigned_driver.trim()) {
          return res.status(400).json({
            success: false,
            message: "Please fill in the Assigned Driver field in Section 4 before approving",
          });
        }

        if (!request.assigned_vehicle || !request.assigned_vehicle.trim()) {
          return res.status(400).json({
            success: false,
            message: "Please fill in the Assigned Vehicle field in Section 4 before approving",
          });
        }

        if (!request.approval_date) {
          return res.status(400).json({
            success: false,
            message: "Please fill in the Approval Date field in Section 4 before approving",
          });
        }
      }

      // Convert Sequelize instance to plain object for email service (do this early)
      // Ensure we have the RequestedByUser relation loaded
      if (!request.RequestedByUser) {
        await request.reload({
          include: [{
            model: User,
            as: "RequestedByUser",
            attributes: ["id", "first_name", "last_name", "email", "username"],
          }]
        });
      }
      
      const requestData = request.toJSON ? request.toJSON() : request;
      const requestorData = requestData?.RequestedByUser ? {
        ...requestData.RequestedByUser,
        firstName: requestData.RequestedByUser.first_name,
        lastName: requestData.RequestedByUser.last_name,
        fullName: `${requestData.RequestedByUser.first_name} ${requestData.RequestedByUser.last_name}`
      } : null;

      // Use workflow system to determine next step and status (already loaded above)
      let newStatus = "completed"; // Default to completed
      let nextApprover = null;
      let currentStep = null;

      if (workflow && workflow.Steps && workflow.Steps.length > 0) {
        // Find the current step that matches this approver and request status
        currentStep = await findCurrentStepForApprover('vehicle_request', req.user, request.status, {
          department_id: request.department_id
        });

        if (currentStep) {
          console.log(`✅ Found current step: ${currentStep.step_name} (order: ${currentStep.step_order})`);
          
          // Check if there's a next step
          const nextStepResult = await processWorkflowOnApproval('vehicle_request', {
            department_id: request.department_id
          }, currentStep.step_order);

          if (nextStepResult && nextStepResult.step) {
            // There's a next step - use the current step's status_on_approval
            // Ensure status is never blank - use status_on_approval or fallback to a valid status
            if (!currentStep.status_on_approval || currentStep.status_on_approval.trim() === '') {
              console.warn(`⚠️ Step ${currentStep.step_order} has empty status_on_approval, using 'department_approved' as fallback`);
              newStatus = 'department_approved';
            } else {
              newStatus = currentStep.status_on_approval;
            }
            nextApprover = nextStepResult.approver;
            
            console.log(`➡️ Next step: ${nextStepResult.step.step_name} (order: ${nextStepResult.step.step_order}), Next approver: ${nextApprover.email}`);
            
            // Send notification to next approver if available
            if (nextApprover && requestorData) {
              try {
                await emailService.notifyVehicleApprovalRequired(
                  request.toJSON ? request.toJSON() : request,
                  requestorData,
                  {
                    ...nextApprover.toJSON(),
                    firstName: nextApprover.first_name,
                    lastName: nextApprover.last_name,
                    fullName: `${nextApprover.first_name} ${nextApprover.last_name}`
                  }
                );
                console.log(`✅ Email notification sent to next approver: ${nextApprover.email}`);
              } catch (emailError) {
                console.error("Failed to send email notification to next approver:", emailError);
              }
            } else {
              if (!nextApprover) {
                console.warn('⚠️ No next approver found to send notification');
              }
              if (!requestorData) {
                console.warn('⚠️ No requestor data found to send notification');
              }
            }
          } else {
            // No next step - this is the final step, use status_on_completion if set, otherwise use status_on_approval, or default to completed
            newStatus = currentStep.status_on_completion || currentStep.status_on_approval || "completed";
            console.log(`✅ Final step (${currentStep.step_name}) - setting status to: ${newStatus}`);
          }
        } else {
          console.warn('⚠️ Could not find current workflow step for approver, using default completed status');
          newStatus = "completed";
        }
      } else {
        console.warn('⚠️ No workflow found for vehicle_request, using default completed status');
        newStatus = "completed";
      }

      // Ensure status is never blank or empty
      if (!newStatus || newStatus.trim() === '') {
        console.warn('⚠️ Status is blank, defaulting to completed');
        newStatus = "completed";
      }

      // Create or update VehicleApproval record for this approval step
      let currentApprovalComments = remarks || null;
      if (currentStep) {
        let vehicleApproval = await VehicleApproval.findOne({
          where: {
            vehicle_request_id: request.id,
            step_order: currentStep.step_order
          }
        });

        if (!vehicleApproval) {
          // Create new approval record
          vehicleApproval = await VehicleApproval.create({
            vehicle_request_id: request.id,
            approver_id: req.user.id,
            workflow_step_id: currentStep.id,
            step_order: currentStep.step_order,
            step_name: currentStep.step_name,
            status: 'approved',
            comments: remarks || null,
            approved_at: new Date()
          });
        } else {
          // Update existing approval record
          vehicleApproval.approve(remarks || null);
          vehicleApproval.approver_id = req.user.id;
          await vehicleApproval.save();
        }
        // Store the current approver's comments for the email (from VehicleApproval record)
        currentApprovalComments = vehicleApproval.comments || remarks || null;
        console.log(`✅ Created/updated VehicleApproval record for step ${currentStep.step_order}: ${currentStep.step_name}`);
      }

      // Update request status
      request.status = newStatus;
      
      // approval_date is already set from Section 4, so we don't override it
      if (!request.approval_date && isODHCApprover) {
        request.approval_date = new Date();
      }
      
      // Don't overwrite request.comments with current approver's remarks
      // Keep request.comments as is (it may contain other information)
      // The email will use the current approver's comments from VehicleApproval
      
      await request.save();

      // Send email notification to requestor
      try {
        if (requestorData?.email) {
          // Send appropriate email based on completion status
          const isCompleted = newStatus === "completed";
          // Pass the current approver's comments separately to the email function
          await emailService.notifyVehicleRequestApproved(
            requestData,
            requestorData,
            req.user,
            isCompleted,
            nextApprover ? {
              first_name: nextApprover.first_name,
              last_name: nextApprover.last_name,
              username: nextApprover.username,
              email: nextApprover.email
            } : null,
            currentApprovalComments // Pass current approver's comments
          );
        }
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        // Don't fail the request if email fails
      }

      const successMessage = newStatus === "completed" 
        ? "Service vehicle request approved and completed successfully"
        : `Service vehicle request approved. Status updated to ${newStatus}. ${nextApprover ? `Next approver: ${nextApprover.first_name} ${nextApprover.last_name}` : ''}`;

      res.json({
        success: true,
        message: successMessage,
        request,
        nextApprover: nextApprover ? {
          id: nextApprover.id,
          name: `${nextApprover.first_name} ${nextApprover.last_name}`,
          email: nextApprover.email
        } : null
      });
    } catch (error) {
      console.error("Error approving service vehicle request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to approve request",
        error: error.message,
      });
    }
  }
);

// Decline service vehicle request
// Only ODHC (department approver) can decline vehicle requests
router.post(
  "/:id/decline",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Decline reason is required",
        });
      }

      const request = await ServiceVehicleRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: "RequestedByUser",
            attributes: ["id", "first_name", "last_name", "email", "username"],
          },
        ],
      });
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found",
        });
      }

      // Use workflow system to determine which statuses can be declined
      // Allow decline for: submitted, returned, and any intermediate workflow statuses
      const workflow = await getActiveWorkflow('vehicle_request');
      let allowedDeclineStatuses = ["submitted", "returned"];
      
      if (workflow && workflow.Steps && workflow.Steps.length > 0) {
        // Include all status_on_approval values (intermediate statuses) for decline
        const statusOnApprovalValues = workflow.Steps.map(step => step.status_on_approval).filter(Boolean);
        allowedDeclineStatuses = ["submitted", "returned", ...statusOnApprovalValues];
      }
      
      if (!allowedDeclineStatuses.includes(request.status)) {
        return res.status(400).json({
          success: false,
          message: `Only requests with status ${allowedDeclineStatuses.join(', ')} can be declined`,
        });
      }

      // Find current workflow step
      const currentStep = await findCurrentStepForApprover('vehicle_request', req.user, request.status, {
        department_id: request.department_id
      });

      // Create or update VehicleApproval record for decline
      if (currentStep) {
        let vehicleApproval = await VehicleApproval.findOne({
          where: {
            vehicle_request_id: request.id,
            step_order: currentStep.step_order
          }
        });

        if (!vehicleApproval) {
          vehicleApproval = await VehicleApproval.create({
            vehicle_request_id: request.id,
            approver_id: req.user.id,
            workflow_step_id: currentStep.id,
            step_order: currentStep.step_order,
            step_name: currentStep.step_name,
            status: 'declined',
            comments: reason || null,
            declined_at: new Date()
          });
        } else {
          vehicleApproval.decline(reason || null);
          vehicleApproval.approver_id = req.user.id;
          await vehicleApproval.save();
        }
        console.log(`✅ Created/updated VehicleApproval record for decline at step ${currentStep.step_order}`);
      }

      request.status = "declined";
      request.comments = reason;
      await request.save();

      // Convert Sequelize instance to plain object for email service
      const requestData = request.toJSON ? request.toJSON() : request;
      const requestorData = requestData?.RequestedByUser ? {
        ...requestData.RequestedByUser,
        firstName: requestData.RequestedByUser.first_name,
        lastName: requestData.RequestedByUser.last_name,
        fullName: `${requestData.RequestedByUser.first_name} ${requestData.RequestedByUser.last_name}`
      } : null;

      // Send email notification
      try {
        if (requestorData?.email) {
          await emailService.notifyVehicleRequestDeclined(
            requestData,
            requestorData,
            req.user,
            reason
          );
        }
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: "Service vehicle request declined",
        request,
      });
    } catch (error) {
      console.error("Error declining service vehicle request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to decline request",
        error: error.message,
      });
    }
  }
);

// Return service vehicle request for revision
// Only ODHC (department approver) can return vehicle requests
router.post(
  "/:id/return",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Return reason is required",
        });
      }

      const request = await ServiceVehicleRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: "RequestedByUser",
            attributes: ["id", "first_name", "last_name", "email", "username"],
          },
        ],
      });
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found",
        });
      }

      // Use workflow system to determine which statuses can be returned
      // Allow return for: submitted, returned, and any intermediate workflow statuses
      // This allows approvers at any step to return the request for revision
      const workflow = await getActiveWorkflow('vehicle_request');
      let allowedReturnStatuses = ["submitted", "returned"];
      
      if (workflow && workflow.Steps && workflow.Steps.length > 0) {
        // Include all status_on_approval values (intermediate statuses) for return
        const statusOnApprovalValues = workflow.Steps.map(step => step.status_on_approval).filter(Boolean);
        allowedReturnStatuses = ["submitted", "returned", ...statusOnApprovalValues];
      }
      
      if (!allowedReturnStatuses.includes(request.status)) {
        return res.status(400).json({
          success: false,
          message: `Only requests with status ${allowedReturnStatuses.join(', ')} can be returned`,
        });
      }

      // Find current workflow step
      const currentStep = await findCurrentStepForApprover('vehicle_request', req.user, request.status, {
        department_id: request.department_id
      });

      // Create or update VehicleApproval record for return
      if (currentStep) {
        let vehicleApproval = await VehicleApproval.findOne({
          where: {
            vehicle_request_id: request.id,
            step_order: currentStep.step_order
          }
        });

        if (!vehicleApproval) {
          vehicleApproval = await VehicleApproval.create({
            vehicle_request_id: request.id,
            approver_id: req.user.id,
            workflow_step_id: currentStep.id,
            step_order: currentStep.step_order,
            step_name: currentStep.step_name,
            status: 'returned',
            return_reason: reason || null,
            returned_at: new Date()
          });
        } else {
          vehicleApproval.returnForRevision(reason || null);
          vehicleApproval.approver_id = req.user.id;
          await vehicleApproval.save();
        }
        console.log(`✅ Created/updated VehicleApproval record for return at step ${currentStep.step_order}`);
      }

      request.status = "returned";
      request.comments = reason;
      await request.save();

      // Convert Sequelize instance to plain object for email service
      const requestData = request.toJSON ? request.toJSON() : request;
      const requestorData = requestData?.RequestedByUser ? {
        ...requestData.RequestedByUser,
        firstName: requestData.RequestedByUser.first_name,
        lastName: requestData.RequestedByUser.last_name,
        fullName: `${requestData.RequestedByUser.first_name} ${requestData.RequestedByUser.last_name}`
      } : null;

      // Send email notification
      try {
        if (requestorData?.email) {
          await emailService.notifyVehicleRequestReturned(
            requestData,
            requestorData,
            req.user,
            reason
          );
        }
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: "Service vehicle request returned for revision",
        request,
      });
    } catch (error) {
      console.error("Error returning service vehicle request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to return request",
        error: error.message,
      });
    }
  }
);

// Assign vehicle to request (deprecated - vehicle requests are completed when approved by ODHC)
// Keeping for backward compatibility but not used in new workflow
router.post(
  "/:id/assign",
  authenticateToken,
  requireRole(["department_approver", "super_administrator"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { assigned_driver, assigned_vehicle } = req.body;

      const request = await ServiceVehicleRequest.findByPk(id);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Service vehicle request not found",
        });
      }

      // Check if user is from ODHC department
      const odhcDepartment = await Department.findOne({
        where: {
          name: { [Op.iLike]: '%ODHC%' },
          is_active: true,
        },
      });

      const isODHCApprover = odhcDepartment && req.user.department_id === odhcDepartment.id;

      // Allow assignment if:
      // 1. Status is 'completed' (after ODHC approval), OR
      // 2. User is ODHC approver and status is 'submitted', 'department_approved', or 'completed'
      // (department_approved allows ODHC to save Section 4 after first approver approves)
      if (request.status !== "completed" && !(isODHCApprover && ['submitted', 'department_approved', 'completed'].includes(request.status))) {
        return res.status(400).json({
          success: false,
          message: "Only ODHC approvers can assign vehicles to submitted/department_approved/completed requests",
        });
      }

      request.assigned_driver = assigned_driver;
      request.assigned_vehicle = assigned_vehicle;
      
      // Update approval_date if provided
      if (req.body.approval_date) {
        request.approval_date = req.body.approval_date;
      }
      
      await request.save();

      res.json({
        success: true,
        message: "Vehicle assigned successfully",
        request,
      });
    } catch (error) {
      console.error("Error assigning vehicle:", error);
      res.status(500).json({
        success: false,
        message: "Failed to assign vehicle",
        error: error.message,
      });
    }
  }
);

// Delete service vehicle request
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceVehicleRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Service vehicle request not found",
      });
    }

    // Check if user can delete this request
    const canDelete =
      (req.user.id === request.requested_by &&
        ["draft", "declined"].includes(request.status)) ||
      req.user.role === "super_administrator";

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this request",
      });
    }

    await request.destroy();

    res.json({
      success: true,
      message: "Service vehicle request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting service vehicle request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete request",
      error: error.message,
    });
  }
});

// Get statistics for service vehicle requests
router.get("/stats/overview", authenticateToken, async (req, res) => {
  try {
    let whereClause = {};
    
    // Role-based filtering
    if (req.user.role === "requestor") {
      whereClause.requested_by = req.user.id;
    } else if (req.user.role === "department_approver") {
      // For vehicle requests, ODHC department approvers should see ALL requests
      // (since all vehicle requests are routed to ODHC)
      // Check if user is from ODHC department
      const odhcDepartment = await Department.findOne({
        where: {
          name: { [Op.iLike]: '%ODHC%' },
          is_active: true,
        },
      });
      
      if (odhcDepartment && req.user.department_id === odhcDepartment.id) {
        // ODHC department approver can see all vehicle requests
        // No where clause restriction
      } else {
        // Other department approvers can see requests from their department
        whereClause.department_id = req.user.department_id;
      }
    }

    const stats = await ServiceVehicleRequest.findAll({
      where: whereClause,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.literal('"ServiceVehicleRequest"."request_id"')), "count"]
      ],
      group: ["status"],
      raw: true
    });

    const statusCounts = {
      draft: 0,
      submitted: 0,
      returned: 0,
      declined: 0,
      completed: 0
    };

    stats.forEach(stat => {
      if (statusCounts.hasOwnProperty(stat.status)) {
        statusCounts[stat.status] = parseInt(stat.count);
      }
    });

    // Calculate total excluding drafts for non-requestor roles
    let total;
    if (req.user.role === "requestor") {
      total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    } else {
      // Exclude drafts from total for other roles
      const { draft, ...countsWithoutDraft } = statusCounts;
      total = Object.values(countsWithoutDraft).reduce((sum, count) => sum + count, 0);
    }

    res.json({
      stats: statusCounts,
      total: total
    });
  } catch (error) {
    console.error("Error fetching service vehicle request statistics:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      message: error.message
    });
  }
});

// Public endpoint: Track vehicle request by reference code (no authentication required)
router.get('/public/track/:referenceCode', async (req, res) => {
  try {
    const { referenceCode } = req.params;

    // Find the vehicle request by reference code
    // Include VehicleApproval records to get individual approval dates
    const request = await ServiceVehicleRequest.findOne({
      where: { reference_code: referenceCode },
      include: [
        {
          model: User,
          as: 'RequestedByUser',
          attributes: ['id', 'first_name', 'last_name', 'username'],
          required: false
        },
        {
          model: Department,
          as: 'Department',
          attributes: ['id', 'name']
        },
        {
          model: VehicleApproval,
          as: 'Approvals',
          include: [
            {
              model: User,
              as: 'Approver',
              attributes: ['id', 'first_name', 'last_name', 'username', 'role']
            }
          ],
          order: [['step_order', 'ASC']]
        }
      ]
      // Note: Sequelize includes all fields by default, so created_at, updated_at, approval_date are automatically included
    });

    if (!request) {
      return res.status(404).json({
        error: 'Request not found',
        message: 'No vehicle request found with this reference code. Please check the code and try again.'
      });
    }

    // Build timeline based on workflow steps
    const timeline = [];
    
    // Get active workflow for vehicle requests
    const workflow = await getActiveWorkflow('vehicle_request');
    
    // 1. Request submitted - Always completed
    // Use created_at (when request was created) as submission date
    const requestDataForTimeline = request.toJSON ? request.toJSON() : request;
    const createdAtForTimeline = requestDataForTimeline.created_at || request.created_at || request.createdAt || requestDataForTimeline.createdAt;
    
    timeline.push({
      stage: 'submitted',
      status: 'Request Submitted',
      timestamp: createdAtForTimeline,
      completedBy: request.RequestedByUser ? {
        name: `${request.RequestedByUser.first_name} ${request.RequestedByUser.last_name}`,
        username: request.RequestedByUser.username
      } : {
        name: request.requestor_name || 'Unknown',
        username: null
      },
      description: 'Vehicle request has been submitted',
      isPending: false,
      isCompleted: true
    });

    // Build timeline from workflow steps
    // Use VehicleApproval records if available to get individual approval dates
    const vehicleApprovals = request.Approvals || [];
    const approvalsByStepOrder = {};
    vehicleApprovals.forEach(approval => {
      approvalsByStepOrder[approval.step_order] = approval;
    });
    
    if (workflow && workflow.Steps && workflow.Steps.length > 0) {
      const sortedSteps = [...workflow.Steps].sort((a, b) => a.step_order - b.step_order);
      
      // Find the current step index based on request status
      const currentStepIndex = sortedSteps.findIndex(s => s.status_on_approval === request.status);
      
      // Track when each step was completed by checking status progression
      // Use VehicleApproval records to get individual approval dates
      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        const stepStatus = step.status_on_approval;
        const isCurrentStep = request.status === stepStatus;
        const isPastStep = currentStepIndex >= 0 && i < currentStepIndex;
        const isFutureStep = currentStepIndex >= 0 && i > currentStepIndex;
        
        let stageName = step.step_name;
        let description = '';
        let isPending = false;
        let isCompleted = false;
        let isDeclined = false;
        let approverInfo = null;
        let approvalTimestamp = null;
        
        // Get approval record for this step if it exists
        const approvalRecord = approvalsByStepOrder[step.step_order];
        
        // Determine step status and calculate appropriate timestamp
        const isLastStep = i === sortedSteps.length - 1;
        
        // Extract dates from request object (handle Sequelize field name variations)
        const requestDataForTimestamp = request.toJSON ? request.toJSON() : request;
        const updatedAt = requestDataForTimestamp.updated_at || request.updated_at || request.updatedAt || requestDataForTimestamp.updatedAt;
        const approvalDate = requestDataForTimestamp.approval_date || request.approval_date || request.approvalDate || requestDataForTimestamp.approvalDate;
        const createdAt = requestDataForTimestamp.created_at || request.created_at || request.createdAt || requestDataForTimestamp.createdAt;
        
        // FIRST: Check if this step has an approval record - if it does, it's completed (regardless of status matching)
        if (approvalRecord && (approvalRecord.status === 'approved' || approvalRecord.approved_at)) {
          isCompleted = true;
          description = `Completed: ${stageName}`;
          approvalTimestamp = approvalRecord.approved_at || updatedAt || createdAt;
          // Get approver from approval record
          if (approvalRecord.Approver) {
            approverInfo = {
              name: `${approvalRecord.Approver.first_name} ${approvalRecord.Approver.last_name}`,
              username: approvalRecord.Approver.username,
              role: approvalRecord.Approver.role
            };
          }
        } else if (request.status === 'declined') {
          // If request is declined, mark current step as declined
          if (isCurrentStep) {
            isDeclined = true;
            description = `Declined at ${stageName}`;
            // Use approval record's declined_at if available, otherwise use updated_at
            approvalTimestamp = approvalRecord?.declined_at || updatedAt || createdAt;
            // Get approver from approval record
            if (approvalRecord?.Approver) {
              approverInfo = {
                name: `${approvalRecord.Approver.first_name} ${approvalRecord.Approver.last_name}`,
                username: approvalRecord.Approver.username,
                role: approvalRecord.Approver.role
              };
            }
          } else if (isPastStep) {
            isCompleted = true;
            description = `Completed: ${stageName}`;
            // Use approval record's approved_at if available
            approvalTimestamp = approvalRecord?.approved_at || updatedAt || createdAt;
            // Get approver from approval record
            if (approvalRecord?.Approver) {
              approverInfo = {
                name: `${approvalRecord.Approver.first_name} ${approvalRecord.Approver.last_name}`,
                username: approvalRecord.Approver.username,
                role: approvalRecord.Approver.role
              };
            }
          } else {
            // Future steps not shown if declined
            break;
          }
        } else if (request.status === 'completed') {
          // If completed, all steps are completed
          isCompleted = true;
          description = `Completed: ${stageName}`;
          // Use approval record's approved_at if available (this gives us individual approval dates!)
          if (approvalRecord?.approved_at) {
            approvalTimestamp = approvalRecord.approved_at;
          } else if (isLastStep && approvalDate) {
            approvalTimestamp = approvalDate;
          } else {
            approvalTimestamp = updatedAt || createdAt;
          }
          // Get approver from approval record
          if (approvalRecord?.Approver) {
            approverInfo = {
              name: `${approvalRecord.Approver.first_name} ${approvalRecord.Approver.last_name}`,
              username: approvalRecord.Approver.username,
              role: approvalRecord.Approver.role
            };
          }
        } else if (approvalRecord && (approvalRecord.status === 'approved' || approvalRecord.approved_at)) {
          // Step has an approval record - it's completed regardless of current status
          isCompleted = true;
          description = `Completed: ${stageName}`;
          approvalTimestamp = approvalRecord.approved_at || updatedAt || createdAt;
          // Get approver from approval record
          if (approvalRecord.Approver) {
            approverInfo = {
              name: `${approvalRecord.Approver.first_name} ${approvalRecord.Approver.last_name}`,
              username: approvalRecord.Approver.username,
              role: approvalRecord.Approver.role
            };
          }
        } else if (request.status === 'returned') {
          // If returned, mark current step appropriately
          if (isCurrentStep) {
            isPending = true;
            description = `Returned for revision at ${stageName}`;
            // Get approver from approval record if returned
            if (approvalRecord?.Approver) {
              approverInfo = {
                name: `${approvalRecord.Approver.first_name} ${approvalRecord.Approver.last_name}`,
                username: approvalRecord.Approver.username,
                role: approvalRecord.Approver.role
              };
            }
          } else if (isPastStep) {
            isCompleted = true;
            description = `Completed: ${stageName}`;
            // Use approval record's approved_at if available
            approvalTimestamp = approvalRecord?.approved_at || updatedAt || createdAt;
            // Get approver from approval record
            if (approvalRecord?.Approver) {
              approverInfo = {
                name: `${approvalRecord.Approver.first_name} ${approvalRecord.Approver.last_name}`,
                username: approvalRecord.Approver.username,
                role: approvalRecord.Approver.role
              };
            }
          } else {
            // Future step - don't show yet
            continue;
          }
        } else {
          // Normal workflow progression (only reached if no approval record found in earlier checks)
          if (isCurrentStep) {
            // No approval record and status matches - this step is currently pending
            isPending = true;
            description = `Waiting for ${stageName}`;
          } else if (isPastStep) {
            // Past step but no approval record (shouldn't happen, but handle gracefully)
            isCompleted = true;
            description = `Completed: ${stageName}`;
            approvalTimestamp = updatedAt || createdAt;
          } else {
            // Future step - don't show yet
            continue;
          }
        }
        
        // Fallback: Get approver information from workflow step configuration if not in approval record
        if (isCompleted && !approverInfo && step) {
          // Use findApproverForStep to get the actual approver user
          const approver = await findApproverForStep(step, {
            department_id: request.department_id
          });
          
          if (approver) {
            approverInfo = {
              name: `${approver.first_name} ${approver.last_name}`,
              username: approver.username,
              role: approver.role
            };
          } else {
            // Fallback: Show step name or role
            if (step.approver_role) {
              approverInfo = {
                name: `${step.approver_role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                username: null,
                role: step.approver_role
              };
            } else if (step.approver_department_id) {
              const approverDept = await Department.findByPk(step.approver_department_id);
              if (approverDept) {
                approverInfo = {
                  name: `${approverDept.name} Approver`,
                  username: null,
                  role: 'department_approver'
                };
              }
            }
          }
        }
        
        // Ensure timestamp is always set for completed steps
        // Use approval record's approved_at for individual step dates, fallback to updated_at/created_at if no record exists
        const finalTimestamp = approvalTimestamp || updatedAt || createdAt;
        
        timeline.push({
          stage: `step_${step.step_order}`,
          status: stageName,
          timestamp: finalTimestamp,
          completedBy: approverInfo,
          description,
          comments: null,
          isPending,
          isCompleted,
          isDeclined
        });
      }
    } else {
      // Fallback: Simple status-based timeline if no workflow
      const statusMap = {
        'submitted': { name: 'Submitted', description: 'Request has been submitted' },
        'department_approved': { name: 'Department Approved', description: 'Approved by department approver' },
        'completed': { name: 'Completed', description: 'Request has been completed' },
        'declined': { name: 'Declined', description: 'Request has been declined' },
        'returned': { name: 'Returned', description: 'Request returned for revision' }
      };
      
      if (request.status !== 'submitted' && request.status !== 'draft') {
        const statusInfo = statusMap[request.status] || { name: request.status, description: `Status: ${request.status}` };
        const requestDataForFallback = request.toJSON ? request.toJSON() : request;
        const updatedAtFallback = requestDataForFallback.updated_at || request.updated_at || request.updatedAt || requestDataForFallback.updatedAt;
        const approvalDateFallback = requestDataForFallback.approval_date || request.approval_date || request.approvalDate || requestDataForFallback.approvalDate;
        
        timeline.push({
          stage: request.status,
          status: statusInfo.name,
          timestamp: approvalDateFallback || updatedAtFallback || request.created_at,
          completedBy: null,
          description: statusInfo.description,
          comments: null,
          isPending: request.status === 'returned',
          isCompleted: request.status === 'completed' || request.status === 'department_approved',
          isDeclined: request.status === 'declined'
        });
      }
    }

    // Format request type
    const requestType = request.request_type 
      ? request.request_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'N/A';

    // Return public-safe data
    // Ensure created_at is included (use toJSON to get all fields)
    const requestData = request.toJSON ? request.toJSON() : request;
    
    // Get created_at from various possible field names
    const createdAt = requestData.created_at || request.created_at || request.createdAt || requestData.createdAt;
    
    res.json({
      ticketCode: request.reference_code,
      requestType: 'vehicle',
      status: request.status,
      submittedDate: createdAt,
      submittedBy: request.RequestedByUser 
        ? `${request.RequestedByUser.first_name} ${request.RequestedByUser.last_name}`
        : request.requestor_name || 'Unknown',
      department: request.Department?.name,
      purpose: request.purpose || 'Vehicle service request',
      timeline,
      vehicleDetails: {
        requestType,
        travelDateFrom: request.travel_date_from,
        travelDateTo: request.travel_date_to,
        pickUpLocation: request.pick_up_location,
        pickUpTime: request.pick_up_time,
        dropOffLocation: request.drop_off_location,
        dropOffTime: request.drop_off_time,
        destination: request.destination,
        passengerName: request.passenger_name,
        assignedDriver: request.assigned_driver,
        assignedVehicle: request.assigned_vehicle,
        approvalDate: request.approval_date
      }
    });
  } catch (error) {
    console.error('Error tracking vehicle request:', error);
    res.status(500).json({
      error: 'Failed to track request',
      message: error.message
    });
  }
});

export default router;
