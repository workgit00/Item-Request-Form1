import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

 import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Users,
  Building,
  Settings,
  LogOut,
  Search,
  Filter,
  Eye,
  RotateCcw,
  Car,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bell
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requestsAPI, REQUEST_STATUSES, serviceVehicleRequestsAPI } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, canViewAllRequests, canManageUsers, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('item'); // 'item' or 'vehicle'
  const [requests, setRequests] = useState([]);
  const [vehicleRequests, setVehicleRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [vehicleStats, setVehicleStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    page: 1,
    limit: 5, // Display 5 requests per page
    sortBy: 'date', // 'date', 'status', 'requestor'
    sortOrder: 'desc' // 'asc' or 'desc'
  });
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    currentPage: 1
  });

  useEffect(() => {
    loadDashboardData();
  }, [filters, activeTab]);

  // Helper function to check if item request is pending current user's approval
  const isPendingMyApproval = (request) => {
    if (!request.approvals || !user) return false;
    
    // Check if there's a pending approval where the current user is the approver
    return request.approvals.some(approval => 
      approval.status === 'pending' && 
      approval.approver && 
      approval.approver.id === user.id
    );
  };

  // Helper function to check if vehicle request is pending current user's approval
  // For vehicle requests, we check based on approvals array and server-side flag
  const isPendingMyVehicleApproval = (request) => {
    if (!request || !user) return false;
    
    // Use server-side flag if available (most accurate)
    if (request.isPendingMyApproval !== undefined) {
      return request.isPendingMyApproval;
    }
    
    // Fallback: Check if there's a pending approval where the current user is the approver
    if (request.approvals && Array.isArray(request.approvals)) {
      return request.approvals.some(approval => 
        approval.status === 'pending' && 
        approval.approver && 
        approval.approver.id === user.id
      );
    }
    
    // Fallback: Check based on status and user role if approvals array is not available
    // Skip if request is completed, declined, or draft
    if (['completed', 'declined', 'draft'].includes(request.status)) {
      return false;
    }
    
    // Department approver can approve submitted or returned vehicle requests
    if ((user.role === 'department_approver' || user.role === 'super_administrator') && 
        (request.status === 'submitted' || request.status === 'returned')) {
      return true;
    }
    
    return false;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'item') {
      // Build query parameters with pagination and sorting
      const queryParams = {
        ...filters,
        limit: filters.limit || 5,
        page: filters.page || 1,
        sortBy: filters.sortBy || 'date',
        sortOrder: filters.sortOrder || 'desc'
      };
      
      const [requestsResponse, statsResponse] = await Promise.all([
        requestsAPI.getAll(queryParams),
        requestsAPI.getStats()
      ]);
      
      setRequests(requestsResponse.data.requests || []);
      
      // Update pagination info
      if (requestsResponse.data.pagination) {
        setPagination({
          total: requestsResponse.data.pagination.total || 0,
          pages: requestsResponse.data.pagination.pages || 0,
          currentPage: requestsResponse.data.pagination.page || 1
        });
      }
      setStats({
        ...statsResponse.data.stats,
        total: statsResponse.data.total
      });
      } else {
        // Load vehicle requests and stats
        // Build query parameters with pagination and sorting
        const queryParams = {
          ...filters,
          limit: filters.limit || 5,
          page: filters.page || 1,
          sortBy: filters.sortBy || 'date',
          sortOrder: filters.sortOrder || 'desc'
        };
        
        const [vehicleRequestsResponse, vehicleStatsResponse] = await Promise.all([
          serviceVehicleRequestsAPI.getAll(queryParams),
          serviceVehicleRequestsAPI.getStats()
        ]);
        
        const vehicleData = vehicleRequestsResponse.data?.requests || vehicleRequestsResponse.data || [];
        setVehicleRequests(Array.isArray(vehicleData) ? vehicleData : []);
        
        // Update pagination info for vehicle requests
        if (vehicleRequestsResponse.data?.pagination) {
          setPagination({
            total: vehicleRequestsResponse.data.pagination.total || 0,
            pages: vehicleRequestsResponse.data.pagination.pages || 0,
            currentPage: vehicleRequestsResponse.data.pagination.page || 1
          });
        }
        setVehicleStats({
          ...vehicleStatsResponse.data.stats,
          total: vehicleStatsResponse.data.total
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    let label, color;
    
    if (activeTab === 'item') {
    const statusConfig = REQUEST_STATUSES.find(s => s.value === status);
    if (!statusConfig) return null;
      label = statusConfig.label;
      color = statusConfig.color;
    } else {
      // Vehicle request statuses
      const vehicleStatusMap = {
        'draft': { label: 'Draft', color: 'gray' },
        'submitted': { label: 'Submitted', color: 'blue' },
        'department_approved': { label: 'Department Approved', color: 'green' },
        'returned': { label: 'Returned', color: 'orange' },
        'declined': { label: 'Declined', color: 'red' },
        'completed': { label: 'Completed', color: 'green' }
      };
      const vehicleStatus = vehicleStatusMap[status];
      if (!vehicleStatus) {
        // Fallback for unknown statuses - show the status value itself
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status || 'Unknown'}
          </span>
        );
      }
      label = vehicleStatus.label;
      color = vehicleStatus.color;
    }

    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      orange: 'bg-orange-100 text-orange-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}>
        {label}
      </span>
    );
  };

  const getStatsCards = () => {
    const cards = [];
    const currentStats = activeTab === 'item' ? stats : vehicleStats;

    if (user.role === 'requestor') {
      if (activeTab === 'item') {
        cards.push(
          { title: 'My Drafts', count: currentStats.draft || 0, icon: FileText, color: 'gray' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'Pending Approval', count: (currentStats.submitted || 0) + (currentStats.department_approved || 0), icon: Clock, color: 'yellow' },
          { title: 'Approved', count: (currentStats.it_manager_approved || 0) + (currentStats.service_desk_processing || 0), icon: CheckCircle, color: 'green' },
          { title: 'Declined', count: (currentStats.department_declined || 0) + (currentStats.it_manager_declined || 0), icon: XCircle, color: 'red' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' }
        );
      } else {
        // Vehicle request stats
      cards.push(
          { title: 'My Drafts', count: currentStats.draft || 0, icon: FileText, color: 'gray' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'Pending Approval', count: currentStats.submitted || 0, icon: Clock, color: 'yellow' },
          { title: 'Declined', count: currentStats.declined || 0, icon: XCircle, color: 'red' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' },
          { title: 'Total Requests', count: currentStats.total || 0, icon: Car, color: 'gray' }
      );
      }
    } else if (user.role === 'department_approver') {
      if (activeTab === 'item') {
        cards.push(
          { title: 'Pending My Approval', count: currentStats.submitted || 0, icon: AlertCircle, color: 'orange' },
          { title: 'Approved by Me', count: currentStats.department_approved || 0, icon: CheckCircle, color: 'green' },
          { title: 'Declined by Me', count: currentStats.department_declined || 0, icon: XCircle, color: 'red' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' },
          { title: 'Total Requests', count: currentStats.total || 0, icon: FileText, color: 'gray' }
        );
      } else {
        // Vehicle request stats for department approver
      cards.push(
          { title: 'Pending My Approval', count: currentStats.submitted || 0, icon: AlertCircle, color: 'orange' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'Declined', count: currentStats.declined || 0, icon: XCircle, color: 'red' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' },
          { title: 'Total Requests', count: currentStats.total || 0, icon: Car, color: 'gray' }
      );
      }
    } else if (user.role === 'it_manager') {
      if (activeTab === 'item') {
        cards.push(
          { title: 'Pending My Approval', count: currentStats.department_approved || 0, icon: AlertCircle, color: 'orange' },
          { title: 'Approved by Me', count: currentStats.it_manager_approved || 0, icon: CheckCircle, color: 'green' },
          { title: 'Declined by Me', count: currentStats.it_manager_declined || 0, icon: XCircle, color: 'red' },
          { title: 'Returned', count: currentStats.returned || 0, icon: RotateCcw, color: 'orange' },
          { title: 'In Processing', count: currentStats.service_desk_processing || 0, icon: Clock, color: 'yellow' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'blue' }
        );
      } else {
        // Vehicle requests don't go through IT manager
      cards.push(
          { title: 'Total Vehicle Requests', count: currentStats.total || 0, icon: Car, color: 'blue' }
      );
      }
    } else if (user.role === 'service_desk') {
      if (activeTab === 'item') {
      cards.push(
          { title: 'To Process', count: currentStats.it_manager_approved || 0, icon: AlertCircle, color: 'orange' },
          { title: 'Processing', count: currentStats.service_desk_processing || 0, icon: Clock, color: 'yellow' },
          { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'green' },
          { title: 'Total Requests', count: currentStats.total || 0, icon: FileText, color: 'blue' }
      );
      } else {
        // Vehicle requests don't go through service desk
        cards.push(
          { title: 'Total Vehicle Requests', count: currentStats.total || 0, icon: Car, color: 'blue' }
        );
      }
    } else {
      cards.push(
        { title: 'All Requests', count: currentStats.total || 0, icon: activeTab === 'item' ? FileText : Car, color: 'blue' },
        { title: 'Pending', count: (currentStats.submitted || 0) + (currentStats.department_approved || 0), icon: Clock, color: 'yellow' },
        { title: 'Completed', count: currentStats.completed || 0, icon: CheckCircle, color: 'green' },
        { title: 'Declined', count: (currentStats.department_declined || 0) + (currentStats.it_manager_declined || 0) + (currentStats.declined || 0), icon: XCircle, color: 'red' }
      );
    }

    return cards;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">STC</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">IT Equipment Requests</div>
                  <div className="text-xs text-gray-500">Styrotech Corporation</div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                <div className="text-xs text-gray-500">{user.role.replace('_', ' ').toUpperCase()}</div>
              </div>
              
              <div className="flex items-center space-x-2">
                {canManageUsers() && (
                  <button
                    onClick={() => navigate('/users')}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Manage Users"
                  >
                    <Users className="h-5 w-5" />
                  </button>
                )}
                
                {isAdmin() && (
                  <>
                    <button
                      onClick={() => navigate('/departments')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Manage Departments"
                    >
                      <Building className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        console.log('Settings button clicked, navigating to /settings/workflows');
                        navigate('/settings/workflows');
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Workflow Settings"
                      type="button"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                  </>
                )}
                
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.firstName}!
          </h1>
          <p className="text-gray-600">
            {user.department?.name} • {user.title}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('item')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'item'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-5 w-5 inline-block mr-2" />
              Item Requests
            </button>
            <button
              onClick={() => setActiveTab('vehicle')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'vehicle'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Car className="h-5 w-5 inline-block mr-2" />
              Vehicle Requests
            </button>
          </nav>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {getStatsCards().map((card, index) => {
            const Icon = card.icon;
            const colorClasses = {
              gray: 'bg-gray-500',
              blue: 'bg-blue-500',
              green: 'bg-green-500',
              red: 'bg-red-500',
              yellow: 'bg-yellow-500',
              orange: 'bg-orange-500'
            };

            return (
              <div key={index} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className={`p-2 rounded-md ${colorClasses[card.color]}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{card.title}</p>
                    <p className="text-2xl font-semibold text-gray-900">{card.count}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex space-x-4">
            {user.role === 'requestor' && (
              <button
                onClick={() => navigate('/requests/new')}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </button>
            )}
          </div>

          {/* Filters and Sorting */}
          <div className="flex flex-wrap gap-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              {activeTab === 'item' ? (
                REQUEST_STATUSES.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
                ))
              ) : (
                // Vehicle request statuses
                <>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="department_approved">Department Approved</option>
                  <option value="returned">Returned</option>
                  <option value="declined">Declined</option>
                  <option value="completed">Completed</option>
                </>
              )}
            </select>
            
            {/* Sort By */}
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date">Sort by Date</option>
              <option value="status">Sort by Status</option>
              <option value="requestor">Sort by Requestor</option>
            </select>
            
            {/* Sort Order */}
            <button
              onClick={() => setFilters(prev => ({ 
                ...prev, 
                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
                page: 1 
              }))}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-1"
              title={`Sort ${filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {filters.sortOrder === 'asc' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              <span className="text-sm">{filters.sortOrder === 'asc' ? 'Asc' : 'Desc'}</span>
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Recent {activeTab === 'item' ? 'Item' : 'Vehicle'} Requests
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {activeTab === 'item' ? 'Request' : 'Reference Code'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requestor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {activeTab === 'item' ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  ) : (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Request Type
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeTab === 'item' ? (
                  requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <p>No requests found</p>
                      {user.role === 'requestor' && (
                        <button
                            onClick={() => navigate('/forms')}
                          className="mt-2 text-blue-600 hover:text-blue-800"
                        >
                          Create your first request
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {isPendingMyApproval(request) && (
                              <span className="relative inline-flex items-center justify-center">
                                <Bell className="h-5 w-5 text-orange-600 animate-pulse" title="Pending your approval" />
                                <span className="absolute top-0 right-0 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </span>
                              </span>
                            )}
                            {request.requestNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {request.userName}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{request.requestor.fullName}</div>
                        <div className="text-sm text-gray-500">{request.department.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.itemsCount} item{request.itemsCount !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {request.status === 'draft' 
                          ? 'Not submitted yet'
                          : request.submittedAt 
                            ? new Date(request.submittedAt).toLocaleDateString()
                            : new Date(request.createdAt).toLocaleDateString()
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            if (request.status === 'draft' && user.id === request.requestor.id) {
                              navigate(`/requests/${request.id}/edit`);
                            } else {
                              navigate(`/requests/${request.id}`);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {request.status === 'draft' && user.id === request.requestor.id ? 'Edit' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))
                  )
                ) : (
                  vehicleRequests.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        <Car className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <p>No vehicle requests found</p>
                        {user.role === 'requestor' && (
                          <button
                            onClick={() => navigate('/forms')}
                            className="mt-2 text-blue-600 hover:text-blue-800"
                          >
                            Create your first vehicle request
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    vehicleRequests.map((request) => {
                      const requestorName = request.RequestedByUser?.fullName || 
                                           (request.RequestedByUser?.firstName && request.RequestedByUser?.lastName 
                                             ? `${request.RequestedByUser.firstName} ${request.RequestedByUser.lastName}`
                                             : request.requestor_name || 'Unknown');
                      const departmentName = request.Department?.name || 'No Department';
                      
                      return (
                        <tr key={request.id || request.request_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                {isPendingMyVehicleApproval(request) && (
                                  <span className="relative inline-flex items-center justify-center">
                                    <Bell className="h-5 w-5 text-orange-600 animate-pulse" title="Pending your approval" />
                                    <span className="absolute top-0 right-0 flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                    </span>
                                  </span>
                                )}
                                {request.reference_code || `SVR-${request.id || request.request_id}`}
                              </div>
                              <div className="text-sm text-gray-500">
                                {request.requestor_name || requestorName}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{requestorName}</div>
                            <div className="text-sm text-gray-500">{departmentName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(request.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {request.request_type ? request.request_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {request.status === 'draft' 
                              ? 'Not submitted yet'
                              : request.submitted_at 
                                ? new Date(request.submitted_at).toLocaleDateString()
                                : request.requested_date
                                  ? new Date(request.requested_date).toLocaleDateString()
                                  : new Date(request.created_at || request.createdAt).toLocaleDateString()
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                const requestId = request.id || request.request_id;
                                // Allow edit for draft or returned requests if user is the requestor
                                if ((request.status === 'draft' || request.status === 'returned') && user.id === request.requested_by) {
                                  navigate(`/service-vehicle-requests/${requestId}/edit`);
                                } else {
                                  navigate(`/service-vehicle-requests/${requestId}`);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-900 flex items-center"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {(request.status === 'draft' || request.status === 'returned') && user.id === request.requested_by ? 'Edit' : 'View'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(pagination.currentPage - 1) * (filters.limit || 5) + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.currentPage * (filters.limit || 5), pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> requests
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setFilters(prev => ({ ...prev, page: pageNum }))}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                            pagination.currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                    disabled={pagination.currentPage === pagination.pages}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
