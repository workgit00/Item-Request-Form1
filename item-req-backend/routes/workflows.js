import express from 'express';
import { Op } from 'sequelize';
import { body, validationResult } from 'express-validator';
import {
  ApprovalWorkflow,
  WorkflowStep,
  User,
  Department,
  Request,
  ServiceVehicleRequest
} from '../models/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Helper function to map user data from snake_case to camelCase
function mapUserData(user) {
  if (!user) return null;
  return {
    ...user,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: `${user.first_name} ${user.last_name}`
  };
}

// Helper function to map workflow data
function mapWorkflowData(workflow) {
  const workflowData = workflow.toJSON ? workflow.toJSON() : workflow;
  
  // Map Creator
  if (workflowData.Creator) {
    workflowData.Creator = mapUserData(workflowData.Creator);
  }
  
  // Map Updater
  if (workflowData.Updater) {
    workflowData.Updater = mapUserData(workflowData.Updater);
  }
  
  // Map Steps and their ApproverUser
  if (workflowData.Steps) {
    workflowData.Steps = workflowData.Steps.map(step => {
      if (step.ApproverUser) {
        step.ApproverUser = mapUserData(step.ApproverUser);
      }
      return step;
    });
  }
  
  return workflowData;
}

// Get all users for workflow configuration (no pagination)
// MUST be before /:id route to avoid route conflict
router.get('/users', authenticateToken, requireRole(['super_administrator']), async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        is_active: true
      },
      include: [{
        model: Department,
        as: 'Department',
        attributes: ['id', 'name'],
        required: false
      }],
      attributes: ['id', 'first_name', 'last_name', 'email', 'username', 'role'],
      order: [['last_name', 'ASC'], ['first_name', 'ASC']]
    });

    const mappedUsers = users.map(user => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`,
      email: user.email,
      username: user.username,
      role: user.role,
      department: user.Department ? {
        id: user.Department.id,
        name: user.Department.name
      } : null
    }));

    res.json({
      success: true,
      users: mappedUsers
    });
  } catch (error) {
    console.error('Error fetching users for workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get active workflow for a form type
// MUST be before /:id route to avoid route conflict
router.get('/active/:form_type', authenticateToken, async (req, res) => {
  try {
    const { form_type } = req.params;

    if (!['item_request', 'vehicle_request'].includes(form_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid form type'
      });
    }

    const workflow = await ApprovalWorkflow.findOne({
      where: {
        form_type,
        is_active: true,
        is_default: true
      },
      include: [
        {
          model: WorkflowStep,
          as: 'Steps',
          include: [
            {
              model: User,
              as: 'ApproverUser',
              attributes: ['id', 'first_name', 'last_name', 'email'],
              required: false
            },
            {
              model: Department,
              as: 'ApproverDepartment',
              attributes: ['id', 'name'],
              required: false
            }
          ],
          order: [['step_order', 'ASC']]
        }
      ]
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'No active workflow found for this form type'
      });
    }

    // Map workflow to include camelCase user fields
    const mappedWorkflow = mapWorkflowData(workflow);

    res.json({
      success: true,
      workflow: mappedWorkflow
    });
  } catch (error) {
    console.error('Error fetching active workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active workflow',
      error: error.message
    });
  }
});

// Get all workflows
router.get('/', authenticateToken, requireRole(['super_administrator']), async (req, res) => {
  try {
    const { form_type } = req.query;

    const whereClause = {};
    if (form_type) {
      whereClause.form_type = form_type;
    }

    const workflows = await ApprovalWorkflow.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: User,
          as: 'Updater',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          required: false
        },
        {
          model: WorkflowStep,
          as: 'Steps',
          include: [
            {
              model: User,
              as: 'ApproverUser',
              attributes: ['id', 'first_name', 'last_name', 'email'],
              required: false
            },
            {
              model: Department,
              as: 'ApproverDepartment',
              attributes: ['id', 'name'],
              required: false
            }
          ],
          order: [['step_order', 'ASC']]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Map workflows to include camelCase user fields
    const mappedWorkflows = workflows.map(mapWorkflowData);

    res.json({
      success: true,
      workflows: mappedWorkflows
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows',
      error: error.message
    });
  }
});

// Get workflow by ID
router.get('/:id', authenticateToken, requireRole(['super_administrator']), async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await ApprovalWorkflow.findByPk(id, {
      include: [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: User,
          as: 'Updater',
          attributes: ['id', 'first_name', 'last_name', 'email'],
          required: false
        },
        {
          model: WorkflowStep,
          as: 'Steps',
          include: [
            {
              model: User,
              as: 'ApproverUser',
              attributes: ['id', 'first_name', 'last_name', 'email'],
              required: false
            },
            {
              model: Department,
              as: 'ApproverDepartment',
              attributes: ['id', 'name'],
              required: false
            }
          ],
          order: [['step_order', 'ASC']]
        }
      ]
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow',
      error: error.message
    });
  }
});

// Create workflow
router.post(
  '/',
  authenticateToken,
  requireRole(['super_administrator']),
  [
    body('form_type').isIn(['item_request', 'vehicle_request']).withMessage('Invalid form type'),
    body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Name is required and must be less than 200 characters'),
    body('steps').isArray({ min: 1 }).withMessage('At least one workflow step is required'),
    body('steps.*.step_name').trim().isLength({ min: 1 }).withMessage('Step name is required'),
    body('steps.*.step_order').isInt({ min: 1 }).withMessage('Step order must be a positive integer'),
    body('steps.*.approver_type').isIn(['role', 'user', 'department', 'department_approver']).withMessage('Invalid approver type'),
    body('steps.*.status_on_approval').trim().isLength({ min: 1 }).withMessage('Status on approval is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { form_type, name, is_active = true, is_default = false, steps } = req.body;

      // If setting as default, unset other defaults for this form type
      if (is_default) {
        await ApprovalWorkflow.update(
          { is_default: false },
          { where: { form_type, is_default: true } }
        );
      }

      // Create workflow
      const workflow = await ApprovalWorkflow.create({
        form_type,
        name,
        is_active,
        is_default,
        created_by: req.user.id,
        updated_by: req.user.id
      });

      // Create workflow steps
      const createdSteps = [];
      for (const step of steps) {
        const workflowStep = await WorkflowStep.create({
          workflow_id: workflow.id,
          step_order: step.step_order,
          step_name: step.step_name,
          approver_type: step.approver_type,
          approver_role: step.approver_role || null,
          approver_user_id: step.approver_user_id || null,
          approver_department_id: step.approver_department_id || null,
          requires_same_department: step.requires_same_department || false,
          is_required: step.is_required !== undefined ? step.is_required : true,
          can_skip: step.can_skip || false,
          status_on_approval: step.status_on_approval,
          status_on_completion: step.status_on_completion || null
        });
        createdSteps.push(workflowStep);
      }

      // Reload workflow with steps
      await workflow.reload({
        include: [
          {
            model: WorkflowStep,
            as: 'Steps',
            include: [
              {
                model: User,
                as: 'ApproverUser',
                attributes: ['id', 'first_name', 'last_name', 'email'],
                required: false
              },
              {
                model: Department,
                as: 'ApproverDepartment',
                attributes: ['id', 'name'],
                required: false
              }
            ],
            order: [['step_order', 'ASC']]
          }
        ]
      });

      // Map workflow to include camelCase user fields
      const mappedWorkflow = mapWorkflowData(workflow);

      res.status(201).json({
        success: true,
        message: 'Workflow created successfully',
        workflow: mappedWorkflow
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create workflow',
        error: error.message
      });
    }
  }
);

// Update workflow
router.put(
  '/:id',
  authenticateToken,
  requireRole(['super_administrator']),
  [
    body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Name must be less than 200 characters'),
    body('steps').optional().isArray({ min: 1 }).withMessage('At least one workflow step is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { name, is_active, is_default, steps } = req.body;

      const workflow = await ApprovalWorkflow.findByPk(id);
      if (!workflow) {
        return res.status(404).json({
          success: false,
          message: 'Workflow not found'
        });
      }

      // If setting as default, unset other defaults for this form type
      if (is_default && !workflow.is_default) {
        await ApprovalWorkflow.update(
          { is_default: false },
          { where: { form_type: workflow.form_type, is_default: true, id: { [Op.ne]: id } } }
        );
      }

      // Update workflow
      const updateData = {
        updated_by: req.user.id
      };
      if (name !== undefined) updateData.name = name;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (is_default !== undefined) updateData.is_default = is_default;

      await workflow.update(updateData);

      // Update steps if provided
      if (steps && Array.isArray(steps)) {
        // Delete existing steps
        await WorkflowStep.destroy({ where: { workflow_id: id } });

        // Create new steps
        for (const step of steps) {
          await WorkflowStep.create({
            workflow_id: id,
            step_order: step.step_order,
            step_name: step.step_name,
            approver_type: step.approver_type,
            approver_role: step.approver_role || null,
            approver_user_id: step.approver_user_id || null,
            approver_department_id: step.approver_department_id || null,
            requires_same_department: step.requires_same_department || false,
            is_required: step.is_required !== undefined ? step.is_required : true,
            can_skip: step.can_skip || false,
            status_on_approval: step.status_on_approval,
            status_on_completion: step.status_on_completion || null
          });
        }
      }

      // Reload workflow with steps
      await workflow.reload({
        include: [
          {
            model: WorkflowStep,
            as: 'Steps',
            include: [
              {
                model: User,
                as: 'ApproverUser',
                attributes: ['id', 'first_name', 'last_name', 'email'],
                required: false
              },
              {
                model: Department,
                as: 'ApproverDepartment',
                attributes: ['id', 'name'],
                required: false
              }
            ],
            order: [['step_order', 'ASC']]
          }
        ]
      });

      // Map workflow to include camelCase user fields
      const mappedWorkflow = mapWorkflowData(workflow);

      res.json({
        success: true,
        message: 'Workflow updated successfully',
        workflow: mappedWorkflow
      });
    } catch (error) {
      console.error('Error updating workflow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update workflow',
        error: error.message
      });
    }
  }
);

// Delete workflow
router.delete('/:id', authenticateToken, requireRole(['super_administrator']), async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await ApprovalWorkflow.findByPk(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    // Check if workflow is default
    if (workflow.is_default) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default workflow. Please set another workflow as default first.'
      });
    }

    // Check if workflow is in use
    // For item requests
    if (workflow.form_type === 'item_request') {
      const requestsUsingWorkflow = await Request.count({
        where: {
          status: { [Op.in]: ['submitted', 'department_approved', 'it_manager_approved', 'service_desk_processing'] }
        }
      });
      if (requestsUsingWorkflow > 0 && workflow.is_active) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete active workflow that has pending requests. Please deactivate it first.'
        });
      }
    }

    // For vehicle requests
    if (workflow.form_type === 'vehicle_request') {
      const vehicleRequestsUsingWorkflow = await ServiceVehicleRequest.count({
        where: {
          status: { [Op.in]: ['submitted', 'returned'] }
        }
      });
      if (vehicleRequestsUsingWorkflow > 0 && workflow.is_active) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete active workflow that has pending requests. Please deactivate it first.'
        });
      }
    }

    await workflow.destroy();

    res.json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete workflow',
      error: error.message
    });
  }
});

export default router;
