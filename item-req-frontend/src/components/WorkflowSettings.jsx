import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  CheckCircle, 
  XCircle,
  Settings,
  FileText,
  Car,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { workflowsAPI, REQUEST_STATUSES } from '../services/api';
import api from '../services/api';

const FORM_TYPES = [
  { value: 'item_request', label: 'Item Request Form', icon: FileText },
  { value: 'vehicle_request', label: 'Vehicle Request Form', icon: Car }
];

const APPROVER_TYPES = [
  { value: 'role', label: 'By Role' },
  { value: 'user', label: 'Specific User' },
  { value: 'department', label: 'Department' },
  { value: 'department_approver', label: 'Department Approver' }
];

const USER_ROLES = [
  { value: 'department_approver', label: 'Department Approver' },
  { value: 'it_manager', label: 'IT Manager' },
  { value: 'service_desk', label: 'Service Desk' },
  { value: 'super_administrator', label: 'Super Administrator' }
];

export default function WorkflowSettings() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState(new Set());
  const [formData, setFormData] = useState({
    form_type: 'item_request',
    name: '',
    is_active: true,
    is_default: false,
    steps: [
      {
        step_order: 1,
        step_name: '',
        approver_type: 'role',
        approver_role: '',
        approver_user_id: null,
        approver_department_id: null,
        requires_same_department: false,
        is_required: true,
        can_skip: false,
        status_on_approval: '',
        status_on_completion: null
      }
    ]
  });

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [isAdmin, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [workflowsRes, usersRes, departmentsRes] = await Promise.all([
        workflowsAPI.getAll(),
        workflowsAPI.getAllUsers(), // Use workflow users endpoint to get all users
        api.get('/departments')
      ]);
      
      console.log('Workflows response:', workflowsRes.data);
      setWorkflows(workflowsRes.data?.workflows || workflowsRes.data || []);
      setUsers(usersRes.data?.users || usersRes.data || []);
      setDepartments(departmentsRes.data?.departments || departmentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load workflow data: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = () => {
    setFormData({
      form_type: 'item_request',
      name: '',
      is_active: true,
      is_default: false,
      steps: [
        {
          step_order: 1,
          step_name: '',
          approver_type: 'role',
          approver_role: '',
          approver_user_id: null,
          approver_department_id: null,
          requires_same_department: false,
          is_required: true,
          can_skip: false,
          status_on_approval: '',
          status_on_completion: null
        }
      ]
    });
    setEditingWorkflow(null);
    setShowCreateModal(true);
  };

  // Helper function to get all available statuses, including any custom ones from existing workflows
  const getAvailableStatuses = (currentValue) => {
    const statusValues = REQUEST_STATUSES.map(s => s.value);
    // If current value exists but not in predefined list, add it to preserve it
    if (currentValue && !statusValues.includes(currentValue)) {
      return [
        ...REQUEST_STATUSES,
        { value: currentValue, label: currentValue, color: 'gray' }
      ];
    }
    return REQUEST_STATUSES;
  };

  const handleEditWorkflow = (workflow) => {
    const workflowData = {
      form_type: workflow.form_type,
      name: workflow.name,
      is_active: workflow.is_active,
      is_default: workflow.is_default,
      steps: workflow.Steps.map(step => ({
        step_order: step.step_order,
        step_name: step.step_name,
        approver_type: step.approver_type,
        approver_role: step.approver_role || '',
        approver_user_id: step.approver_user_id || null,
        approver_department_id: step.approver_department_id || null,
        requires_same_department: step.requires_same_department,
        is_required: step.is_required,
        can_skip: step.can_skip,
        status_on_approval: step.status_on_approval,
        status_on_completion: step.status_on_completion || null
      })).sort((a, b) => a.step_order - b.step_order)
    };
    setFormData(workflowData);
    setEditingWorkflow(workflow);
    setShowCreateModal(true);
  };

  const handleAddStep = () => {
    const newStepOrder = formData.steps.length + 1;
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        {
          step_order: newStepOrder,
          step_name: '',
          approver_type: 'role',
          approver_role: '',
          approver_user_id: null,
          approver_department_id: null,
          requires_same_department: false,
          is_required: true,
          can_skip: false,
          status_on_approval: '',
          status_on_completion: null
        }
      ]
    });
  };

  const handleRemoveStep = (index) => {
    if (formData.steps.length === 1) {
      alert('Workflow must have at least one step');
      return;
    }
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Reorder steps
    const reorderedSteps = newSteps.map((step, i) => ({
      ...step,
      step_order: i + 1
    }));
    setFormData({ ...formData, steps: reorderedSteps });
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    
    // If changing approver_type, clear related fields
    if (field === 'approver_type') {
      newSteps[index].approver_role = '';
      newSteps[index].approver_user_id = null;
      newSteps[index].approver_department_id = null;
    }
    
    setFormData({ ...formData, steps: newSteps });
  };

  const handleSubmit = async () => {
    try {
      // Validate
      if (!formData.name.trim()) {
        alert('Workflow name is required');
        return;
      }
      
      if (formData.steps.some(step => !step.step_name.trim())) {
        alert('All steps must have a name');
        return;
      }
      
      if (formData.steps.some(step => !step.status_on_approval.trim())) {
        alert('All steps must have a status on approval');
        return;
      }

      // Validate approver configuration
      for (const step of formData.steps) {
        if (step.approver_type === 'role' && !step.approver_role) {
          alert(`Step ${step.step_order}: Please select a role`);
          return;
        }
        if (step.approver_type === 'user' && !step.approver_user_id) {
          alert(`Step ${step.step_order}: Please select a user`);
          return;
        }
        if (step.approver_type === 'department' && !step.approver_department_id) {
          alert(`Step ${step.step_order}: Please select a department`);
          return;
        }
        if (step.approver_type === 'department_approver' && !step.approver_department_id) {
          alert(`Step ${step.step_order}: Please select a department`);
          return;
        }
      }

      setLoading(true);
      
      if (editingWorkflow) {
        await workflowsAPI.update(editingWorkflow.id, formData);
        alert('Workflow updated successfully!');
      } else {
        await workflowsAPI.create(formData);
        alert('Workflow created successfully!');
      }
      
      setShowCreateModal(false);
      setEditingWorkflow(null);
      loadData();
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert(error.response?.data?.message || 'Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkflow = async (workflowId) => {
    if (!confirm('Are you sure you want to delete this workflow?')) {
      return;
    }
    
    try {
      setLoading(true);
      await workflowsAPI.delete(workflowId);
      alert('Workflow deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert(error.response?.data?.message || 'Failed to delete workflow');
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflowExpansion = (workflowId) => {
    const newExpanded = new Set(expandedWorkflows);
    if (newExpanded.has(workflowId)) {
      newExpanded.delete(workflowId);
    } else {
      newExpanded.add(workflowId);
    }
    setExpandedWorkflows(newExpanded);
  };

  const getFormTypeIcon = (formType) => {
    const formTypeConfig = FORM_TYPES.find(ft => ft.value === formType);
    return formTypeConfig ? formTypeConfig.icon : FileText;
  };

  const getFormTypeLabel = (formType) => {
    const formTypeConfig = FORM_TYPES.find(ft => ft.value === formType);
    return formTypeConfig ? formTypeConfig.label : formType;
  };

  const getApproverDescription = (step) => {
    if (step.approver_type === 'role') {
      const role = USER_ROLES.find(r => r.value === step.approver_role);
      return role ? role.label : step.approver_role;
    }
    if (step.approver_type === 'user') {
      const approverUser = users.find(u => u.id === step.approver_user_id);
      return approverUser ? approverUser.fullName : 'Unknown User';
    }
    if (step.approver_type === 'department' || step.approver_type === 'department_approver') {
      const dept = departments.find(d => d.id === step.approver_department_id);
      return dept ? `${dept.name} ${step.approver_type === 'department_approver' ? '(Approver)' : ''}` : 'Unknown Department';
    }
    return 'Not configured';
  };

  if (loading && workflows.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to Dashboard
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Workflow Settings</h1>
              <p className="text-gray-600 mt-1">Configure approval workflows for request forms</p>
            </div>
            <button
              onClick={handleCreateWorkflow}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Workflow
            </button>
          </div>
        </div>

        {/* Workflows List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Approval Workflows</h2>
          </div>
          
          {workflows.length === 0 ? (
            <div className="px-6 py-12">
              <div className="text-center mb-8">
                <Settings className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 mb-2">No workflows configured</p>
                <p className="text-sm text-gray-400 mb-6">Create workflows for each form type to enable approval processes</p>
              </div>
              
              {/* Show form types that need workflows */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {FORM_TYPES.map((formType) => {
                  const FormIcon = formType.icon;
                  const hasWorkflow = workflows.some(w => w.form_type === formType.value);
                  
                  return (
                    <div
                      key={formType.value}
                      className={`p-4 border-2 rounded-lg ${
                        hasWorkflow
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <FormIcon className={`h-6 w-6 ${
                          hasWorkflow ? 'text-green-600' : 'text-gray-400'
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{formType.label}</h4>
                          {hasWorkflow ? (
                            <p className="text-xs text-green-600 mt-1">Workflow configured</p>
                          ) : (
                            <p className="text-xs text-gray-500 mt-1">No workflow</p>
                          )}
                        </div>
                        {!hasWorkflow && (
                          <button
                            onClick={() => {
                              setFormData({
                                ...formData,
                                form_type: formType.value,
                                name: `Default ${formType.label} Workflow`
                              });
                              setShowCreateModal(true);
                            }}
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Create
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="text-center mt-6">
                <button
                  onClick={handleCreateWorkflow}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 inline mr-2" />
                  Create Workflow
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {workflows.map((workflow) => {
                const FormIcon = getFormTypeIcon(workflow.form_type);
                const isExpanded = expandedWorkflows.has(workflow.id);
                
                return (
                  <div key={workflow.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <FormIcon className="h-8 w-8 text-blue-600" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                            {workflow.is_default && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Default
                              </span>
                            )}
                            {workflow.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {getFormTypeLabel(workflow.form_type)} • {workflow.Steps?.length || 0} step(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleWorkflowExpansion(workflow.id)}
                          className="p-2 text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={() => handleEditWorkflow(workflow)}
                          className="p-2 text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && workflow.Steps && workflow.Steps.length > 0 && (
                      <div className="mt-4 ml-12 space-y-3">
                        {workflow.Steps.map((step, index) => (
                          <div key={step.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-semibold text-gray-700">
                                    Step {step.step_order}: {step.step_name}
                                  </span>
                                  {step.is_required && (
                                    <span className="text-xs text-gray-500">(Required)</span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                  Approver: {getApproverDescription(step)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Status on approval: <span className="font-semibold">{step.status_on_approval}</span>
                                  {step.status_on_completion && (
                                    <> • Final status: <span className="font-semibold">{step.status_on_completion}</span></>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingWorkflow(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Form Type <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.form_type}
                      onChange={(e) => setFormData({ ...formData, form_type: e.target.value })}
                      disabled={!!editingWorkflow}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {FORM_TYPES.map(ft => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Workflow Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Standard Item Request Workflow"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Set as Default</span>
                  </label>
                </div>

                {/* Workflow Steps */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Approval Steps</h3>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Step
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {formData.steps.map((step, index) => (
                      <div key={index} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Step {step.step_order}</h4>
                          {formData.steps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Step Name <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              value={step.step_name}
                              onChange={(e) => handleStepChange(index, 'step_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="e.g., Department Approval"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Approver Type <span className="text-red-600">*</span>
                            </label>
                            <select
                              value={step.approver_type}
                              onChange={(e) => handleStepChange(index, 'approver_type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {APPROVER_TYPES.map(at => (
                                <option key={at.value} value={at.value}>{at.label}</option>
                              ))}
                            </select>
                          </div>
                          
                          {step.approver_type === 'role' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Role <span className="text-red-600">*</span>
                              </label>
                              <select
                                value={step.approver_role}
                                onChange={(e) => handleStepChange(index, 'approver_role', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Select Role</option>
                                {USER_ROLES.map(role => (
                                  <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          {step.approver_type === 'user' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                User <span className="text-red-600">*</span>
                              </label>
                              <select
                                value={step.approver_user_id || ''}
                                onChange={(e) => handleStepChange(index, 'approver_user_id', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Select User</option>
                                {users.map(user => (
                                  <option key={user.id} value={user.id}>{user.fullName} ({user.email})</option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          {(step.approver_type === 'department' || step.approver_type === 'department_approver') && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Department <span className="text-red-600">*</span>
                              </label>
                              <select
                                value={step.approver_department_id || ''}
                                onChange={(e) => handleStepChange(index, 'approver_department_id', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">Select Department</option>
                                {departments.map(dept => (
                                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Status on Approval <span className="text-red-600">*</span>
                            </label>
                            <select
                              value={step.status_on_approval}
                              onChange={(e) => handleStepChange(index, 'status_on_approval', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select Status</option>
                              {getAvailableStatuses(step.status_on_approval).map(status => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Final Status (if last step)
                            </label>
                            <select
                              value={step.status_on_completion || ''}
                              onChange={(e) => handleStepChange(index, 'status_on_completion', e.target.value || null)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">None (leave empty if not final)</option>
                              {getAvailableStatuses(step.status_on_completion).map(status => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex items-center space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={step.requires_same_department}
                              onChange={(e) => handleStepChange(index, 'requires_same_department', e.target.checked)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Requires Same Department</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={step.is_required}
                              onChange={(e) => handleStepChange(index, 'is_required', e.target.checked)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Required</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={step.can_skip}
                              onChange={(e) => handleStepChange(index, 'can_skip', e.target.checked)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Can Skip</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingWorkflow(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingWorkflow ? 'Update' : 'Create'} Workflow
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
