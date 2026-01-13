import axios from 'axios';

// Determine API URL dynamically based on current hostname
// If accessing from network IP, use same IP for backend
// Otherwise use localhost or configured URL
const getApiUrl = () => {
  const hostname = window.location.hostname;
  const envUrl = import.meta.env.VITE_API_URL;
  let apiUrl;
  
  // If accessing from network (not localhost), always use the network IP
  // This ensures remote users connect to the correct backend server
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    apiUrl = `http://${hostname}:3001/api`;
    console.log(`🌐 Network access detected: Using backend at ${apiUrl}`);
  } else {
    // For localhost access, use environment variable if set, otherwise default to localhost
    apiUrl = envUrl || 'http://localhost:3001/api';
    console.log(`🏠 Local access: Using backend at ${apiUrl}`);
  }
  
  return apiUrl;
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getApiUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  refreshToken: () => api.post('/auth/refresh'),
  validateToken: () => api.get('/auth/validate'),
  testLDAP: () => api.get('/auth/test-ldap')
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  updateStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }),
  updateDepartment: (id, departmentName) => api.patch(`/users/${id}/department`, { departmentName }),
  syncAll: () => api.post('/users/sync'),
  syncUser: (username) => api.post(`/users/${username}/sync`),
  getSyncStatus: () => api.get('/users/sync/status'),
  getByDepartment: (departmentId) => api.get(`/users/department/${departmentId}`),
  exportExcel: (params) => api.get('/users/export/excel', { params, responseType: 'blob' })
};

// Departments API
export const departmentsAPI = {
  getAll: (params) => api.get('/departments', { params }),
  getById: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
  sync: (id) => api.post(`/departments/${id}/sync`),
  getHierarchy: () => api.get('/departments/hierarchy/tree'),
  exportExcel: (params) => api.get('/departments/export/excel', { params, responseType: 'blob' })
};

// Requests API
export const requestsAPI = {
  getAll: (params) => api.get('/requests', { params }),
  getById: (id) => api.get(`/requests/${id}`),
  create: (data) => api.post('/requests', data),
  update: (id, data) => api.put(`/requests/${id}`, data),
  submit: (id) => api.post(`/requests/${id}/submit`),
  approve: (id, data) => api.post(`/requests/${id}/approve`, data),
  decline: (id, data) => api.post(`/requests/${id}/decline`, data),
  return: (id, data) => api.post(`/requests/${id}/return`, data),
  cancel: (id) => api.post(`/requests/${id}/cancel`),
  delete: (id) => api.delete(`/requests/${id}`),
  getStats: () => api.get('/requests/stats/overview'),
  trackByTicket: (ticketCode) => api.get(`/requests/public/track/${ticketCode}`)
};

// Equipment categories for the form
export const EQUIPMENT_CATEGORIES = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'desktop', label: 'Desktop Computer Set' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'keyboard', label: 'Keyboard' },
  { value: 'mouse', label: 'Mouse' },
  { value: 'ups', label: 'UPS' },
  { value: 'printer', label: 'Printer' },
  { value: 'software', label: 'Software/System' },
  { value: 'other_accessory', label: 'Other Accessory' },
  { value: 'other_equipment', label: 'Other Equipment' }
];

// Request status options
export const REQUEST_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'department_approved', label: 'Department Approved', color: 'green' },
  { value: 'department_declined', label: 'Department Declined', color: 'red' },
  { value: 'it_manager_approved', label: 'IT Manager Approved', color: 'green' },
  { value: 'it_manager_declined', label: 'IT Manager Declined', color: 'red' },
  { value: 'service_desk_processing', label: 'Service Desk Processing', color: 'yellow' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'gray' },
  { value: 'returned', label: 'Returned for Revision', color: 'orange' }
];

// Priority options
export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'green' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'red' }
];

// User roles
export const USER_ROLES = [
  { value: 'requestor', label: 'Requestor' },
  { value: 'department_approver', label: 'Department Approver' },
  { value: 'it_manager', label: 'IT Manager' },
  { value: 'service_desk', label: 'Service Desk' },
  { value: 'super_administrator', label: 'Super Administrator' }
];

//Service Vehicle Requests API
export const serviceVehicleRequestsAPI = {
  getAll: (params) => api.get('/service-vehicle-requests', { params }),
  getById: (id) => api.get(`/service-vehicle-requests/${id}`),
  create: (data) => api.post('/service-vehicle-requests', data),
  update: (id, data) => api.put(`/service-vehicle-requests/${id}`, data),
  submit: (id) => api.post(`/service-vehicle-requests/${id}/submit`),
  approve: (id, data) => api.post(`/service-vehicle-requests/${id}/approve`, data),
  decline: (id, data) => api.post(`/service-vehicle-requests/${id}/decline`, data),
  return: (id, data) => api.post(`/service-vehicle-requests/${id}/return`, data),
  cancel: (id) => api.post(`/service-vehicle-requests/${id}/cancel`),
  delete: (id) => api.delete(`/service-vehicle-requests/${id}`),
  assign: (id, data) => api.post(`/service-vehicle-requests/${id}/assign`, data),
  getStats: () => api.get('/service-vehicle-requests/stats/overview'),
  trackByReference: (referenceCode) => api.get(`/service-vehicle-requests/public/track/${referenceCode}`),
  uploadAttachments: (id, formData) => api.post(`/service-vehicle-requests/${id}/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }),
  deleteAttachment: (id, filename) => api.delete(`/service-vehicle-requests/${id}/attachments/${filename}`)
}

// Workflows API
export const workflowsAPI = {
  getAll: (params) => api.get('/workflows', { params }),
  getById: (id) => api.get(`/workflows/${id}`),
  create: (data) => api.post('/workflows', data),
  update: (id, data) => api.put(`/workflows/${id}`, data),
  delete: (id) => api.delete(`/workflows/${id}`),
  getActive: (formType) => api.get(`/workflows/active/${formType}`),
  getAllUsers: () => api.get('/workflows/users'), // Get all users for workflow configuration
}

export default api;
