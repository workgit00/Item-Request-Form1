import { ApprovalWorkflow, WorkflowStep, User, Department } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Get the active workflow for a form type
 */
export async function getActiveWorkflow(formType) {
  try {
    console.log(`🔍 Looking for active workflow for form type: ${formType}`);
    
    // First try to find active AND default workflow
    let workflow = await ApprovalWorkflow.findOne({
      where: {
        form_type: formType,
        is_active: true,
        is_default: true
      },
      order: [['created_at', 'DESC']] // Get the most recent default workflow
    });

    // If not found, try to find any active workflow (fallback)
    if (!workflow) {
      console.log(`⚠️ No active default workflow found, trying any active workflow...`);
      workflow = await ApprovalWorkflow.findOne({
        where: {
          form_type: formType,
          is_active: true
        },
        order: [['created_at', 'DESC']]
      });
    }

    if (!workflow) {
      console.log(`❌ No active workflow found for form type: ${formType}`);
      return null;
    }

    console.log(`✅ Found workflow: ${workflow.name} (ID: ${workflow.id}, Active: ${workflow.is_active}, Default: ${workflow.is_default})`);

    // Load steps separately to avoid association issues
    // Note: is_active column doesn't exist in workflow_steps table, so we don't filter by it
    const steps = await WorkflowStep.findAll({
      where: {
        workflow_id: workflow.id
      },
      order: [['step_order', 'ASC']]
    });

    console.log(`📋 Found ${steps.length} step(s) for workflow ${workflow.id}`);

    // Attach steps to workflow object
    workflow.Steps = steps;

    return workflow;
  } catch (error) {
    console.error('❌ Error getting active workflow:', error);
    return null;
  }
}

/**
 * Get the first pending step for a request
 */
export async function getFirstPendingStep(formType) {
  const workflow = await getActiveWorkflow(formType);
  
  if (!workflow || !workflow.Steps || workflow.Steps.length === 0) {
    return null;
  }

  // Return the first step (lowest step_order)
  return workflow.Steps[0];
}

/**
 * Find the approver for a workflow step based on the step configuration
 */
export async function findApproverForStep(step, requestData = {}) {
  if (!step) {
    console.warn('⚠️ No step provided to findApproverForStep');
    return null;
  }

  try {
    let approver = null;

    console.log(`🔍 Finding approver for step: ${step.step_name}`);
    console.log(`   Approver type: ${step.approver_type}`);
    console.log(`   Request data department_id: ${requestData.department_id}`);

    switch (step.approver_type) {
      case 'role':
        // Find user by role
        const whereClause = {
          role: step.approver_role,
          is_active: true
        };

        // If requires_same_department, add department filter
        if (step.requires_same_department && requestData.department_id) {
          whereClause.department_id = requestData.department_id;
          console.log(`   Filtering by same department: ${requestData.department_id}`);
        }

        console.log(`   Searching for user with role: ${step.approver_role}`);
        approver = await User.findOne({ where: whereClause });
        break;

      case 'user':
        // Find specific user
        if (step.approver_user_id) {
          console.log(`   Searching for specific user ID: ${step.approver_user_id}`);
          approver = await User.findOne({
            where: {
              id: step.approver_user_id,
              is_active: true
            }
          });
        } else {
          console.warn(`   ⚠️ approver_user_id is not set for user-type step`);
        }
        break;

      case 'department':
      case 'department_approver':
        // Find department approver from specified department
        if (step.approver_department_id) {
          console.log(`   Searching for department approver in department ID: ${step.approver_department_id}`);
          approver = await User.findOne({
            where: {
              department_id: step.approver_department_id,
              role: 'department_approver',
              is_active: true
            }
          });
        } else if (step.requires_same_department && requestData.department_id) {
          // Fallback to requestor's department if requires_same_department
          console.log(`   No department specified, using requestor's department: ${requestData.department_id}`);
          approver = await User.findOne({
            where: {
              department_id: requestData.department_id,
              role: 'department_approver',
              is_active: true
            }
          });
        } else {
          console.warn(`   ⚠️ No department specified and requires_same_department is false`);
        }
        break;

      default:
        console.warn(`⚠️ Unknown approver_type: ${step.approver_type}`);
    }

    if (approver) {
      console.log(`   ✅ Found approver: ${approver.email}`);
    } else {
      console.warn(`   ❌ No approver found`);
    }

    return approver;
  } catch (error) {
    console.error('❌ Error finding approver for step:', error);
    return null;
  }
}

/**
 * Get the next step in the workflow after the current step
 */
export async function getNextStep(formType, currentStepOrder) {
  const workflow = await getActiveWorkflow(formType);
  
  if (!workflow || !workflow.Steps || workflow.Steps.length === 0) {
    return null;
  }

  // Find the next step after currentStepOrder
  // Note: is_active doesn't exist on WorkflowStep, so we don't filter by it
  const nextStep = workflow.Steps.find(
    step => step.step_order > currentStepOrder
  );

  return nextStep || null;
}

/**
 * Process workflow on request submission - find first approver
 */
export async function processWorkflowOnSubmit(formType, requestData) {
  try {
    // Get the first step of the workflow
    const firstStep = await getFirstPendingStep(formType);
    
    if (!firstStep) {
      console.warn(`No workflow found for form type: ${formType}. Using fallback logic.`);
      return null;
    }

    // Find the approver for the first step
    const approver = await findApproverForStep(firstStep, requestData);
    
    if (!approver) {
      console.warn(`No approver found for first step of workflow: ${formType}`);
      return null;
    }

    return {
      step: firstStep,
      approver: approver
    };
  } catch (error) {
    console.error('Error processing workflow on submit:', error);
    return null;
  }
}

/**
 * Find the current workflow step based on request status and approver
 */
export async function findCurrentStepForApprover(formType, approver, requestStatus, requestData = {}) {
  try {
    const workflow = await getActiveWorkflow(formType);
    
    if (!workflow || !workflow.Steps || workflow.Steps.length === 0) {
      return null;
    }

    // If status is 'submitted' or 'returned', it's the first step
    if (requestStatus === 'submitted' || requestStatus === 'returned') {
      const firstStep = workflow.Steps[0];
      if (firstStep) {
        const stepApprover = await findApproverForStep(firstStep, requestData);
        if (stepApprover && stepApprover.id === approver.id) {
          return firstStep;
        }
      }
    } else {
      // Find the step whose status_on_approval matches the current status
      // This means we're on the step AFTER the one that set this status
      // Priority: Check status-based matching first (more accurate)
      for (let i = 0; i < workflow.Steps.length; i++) {
        const step = workflow.Steps[i];
        if (step.status_on_approval === requestStatus) {
          // The next step is the one we're currently on
          if (i + 1 < workflow.Steps.length) {
            const currentStep = workflow.Steps[i + 1];
            const stepApprover = await findApproverForStep(currentStep, requestData);
            if (stepApprover && stepApprover.id === approver.id) {
              console.log(`✅ Matched step ${currentStep.step_order} (${currentStep.step_name}) based on status ${requestStatus}`);
              return currentStep;
            }
          }
        }
      }
      
      // Fallback: check all steps to see if approver matches
      // But prioritize steps that come AFTER steps with matching status_on_approval
      // This prevents matching Step 1 when status is 'department_approved'
      const statusBasedStepIndex = workflow.Steps.findIndex(step => step.status_on_approval === requestStatus);
      
      for (const step of workflow.Steps) {
        // Skip steps that come before or at the step that set this status
        // Only check steps that come after (they're the ones that should handle this status)
        if (statusBasedStepIndex >= 0 && step.step_order <= workflow.Steps[statusBasedStepIndex].step_order) {
          continue;
        }
        
        const stepApprover = await findApproverForStep(step, requestData);
        if (stepApprover && stepApprover.id === approver.id) {
          console.log(`✅ Matched step ${step.step_order} (${step.step_name}) via fallback (after status-based step)`);
          return step;
        }
      }
      
      // Last resort: check all steps (but log warning)
      console.warn(`⚠️ Status-based matching failed for status ${requestStatus}, checking all steps as last resort`);
      for (const step of workflow.Steps) {
        const stepApprover = await findApproverForStep(step, requestData);
        if (stepApprover && stepApprover.id === approver.id) {
          console.warn(`⚠️ Matched step ${step.step_order} (${step.step_name}) - this may be incorrect if status doesn't match`);
          return step;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding current step for approver:', error);
    return null;
  }
}

/**
 * Process workflow on approval - find next approver
 */
export async function processWorkflowOnApproval(formType, requestData, currentStepOrder) {
  try {
    // Get the next step
    const nextStep = await getNextStep(formType, currentStepOrder);
    
    if (!nextStep) {
      // No more steps - workflow is complete
      return null;
    }

    // Find the approver for the next step
    const approver = await findApproverForStep(nextStep, requestData);
    
    if (!approver) {
      console.warn(`No approver found for next step (order: ${nextStep.step_order}) of workflow: ${formType}`);
      return null;
    }

    return {
      step: nextStep,
      approver: approver
    };
  } catch (error) {
    console.error('Error processing workflow on approval:', error);
    return null;
  }
}
