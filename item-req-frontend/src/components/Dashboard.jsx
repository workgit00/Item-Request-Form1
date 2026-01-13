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
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requestsAPI, REQUEST_STATUSES } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, canViewAllRequests, canManageUsers, isAdmin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    page: 1
  });

  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [requestsResponse, statsResponse] = await Promise.all([
        requestsAPI.getAll(filters),
        requestsAPI.getStats()
      ]);
      
      setRequests(requestsResponse.data.requests);
      // Merge stats and total into one object
      setStats({
        ...statsResponse.data.stats,
        total: statsResponse.data.total
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = REQUEST_STATUSES.find(s => s.value === status);
    if (!statusConfig) return null;

    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      orange: 'bg-orange-100 text-orange-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[statusConfig.color]}`}>
        {statusConfig.label}
      </span>
    );
  };

  const getStatsCards = () => {
    const cards = [];

    if (user.role === 'requestor') {
      cards.push(
        { title: 'My Drafts', count: stats.draft || 0, icon: FileText, color: 'gray' },
        { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange' },
        { title: 'Pending Approval', count: (stats.submitted || 0) + (stats.department_approved || 0), icon: Clock, color: 'yellow' },
        { title: 'Approved', count: (stats.it_manager_approved || 0) + (stats.service_desk_processing || 0), icon: CheckCircle, color: 'green' },
        { title: 'Declined', count: (stats.department_declined || 0) + (stats.it_manager_declined || 0), icon: XCircle, color: 'red' },
        { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue' }
      );
    } else if (user.role === 'department_approver') {
      cards.push(
        { title: 'Pending My Approval', count: stats.submitted || 0, icon: AlertCircle, color: 'orange' },
        { title: 'Approved by Me', count: stats.department_approved || 0, icon: CheckCircle, color: 'green' },
        { title: 'Declined by Me', count: stats.department_declined || 0, icon: XCircle, color: 'red' },
        { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange' },
        { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue' },
        { title: 'Total Requests', count: stats.total || 0, icon: FileText, color: 'gray' }
      );
    } else if (user.role === 'it_manager') {
      cards.push(
        { title: 'Pending My Approval', count: stats.department_approved || 0, icon: AlertCircle, color: 'orange' },
        { title: 'Approved by Me', count: stats.it_manager_approved || 0, icon: CheckCircle, color: 'green' },
        { title: 'Declined by Me', count: stats.it_manager_declined || 0, icon: XCircle, color: 'red' },
        { title: 'Returned', count: stats.returned || 0, icon: RotateCcw, color: 'orange' },
        { title: 'In Processing', count: stats.service_desk_processing || 0, icon: Clock, color: 'yellow' },
        { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'blue' }
      );
    } else if (user.role === 'service_desk') {
      cards.push(
        { title: 'To Process', count: stats.it_manager_approved || 0, icon: AlertCircle, color: 'orange' },
        { title: 'Processing', count: stats.service_desk_processing || 0, icon: Clock, color: 'yellow' },
        { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'green' },
        { title: 'Total Requests', count: stats.total || 0, icon: FileText, color: 'blue' }
      );
    } else {
      cards.push(
        { title: 'All Requests', count: stats.total || 0, icon: FileText, color: 'blue' },
        { title: 'Pending', count: (stats.submitted || 0) + (stats.department_approved || 0), icon: Clock, color: 'yellow' },
        { title: 'Completed', count: stats.completed || 0, icon: CheckCircle, color: 'green' },
        { title: 'Declined', count: (stats.department_declined || 0) + (stats.it_manager_declined || 0), icon: XCircle, color: 'red' }
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
                      onClick={() => navigate('/settings')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Settings"
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
              <>
                <button
                  onClick={() => navigate('/forms')}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </button>
              </>
            )}
          </div>

          {/* Filters */}
          <div className="flex space-x-4">
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
              {REQUEST_STATUSES.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Requests</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requestor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <p>No requests found</p>
                      {user.role === 'requestor' && (
                        <button
                          onClick={() => navigate('/requests/new')}
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
                          <div className="text-sm font-medium text-gray-900">
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
                            // If it's a draft and user is the requestor, go to edit mode
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
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
