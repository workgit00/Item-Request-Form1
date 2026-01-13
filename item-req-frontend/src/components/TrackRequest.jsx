import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, User, Car } from 'lucide-react';
import { requestsAPI, serviceVehicleRequestsAPI } from '../services/api';

const TrackRequest = () => {
  const navigate = useNavigate();
  const [ticketCode, setTicketCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestData, setRequestData] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!ticketCode.trim()) {
      setError('Please enter a ticket code');
      return;
    }

    setLoading(true);
    setError('');
    setRequestData(null);

    try {
      const code = ticketCode.trim();
      
      // Try to determine request type based on code format
      // REQ-* = Item request, SVR-* = Vehicle request
      let response;
      
      if (code.startsWith('SVR-')) {
        // Vehicle request
        try {
          response = await serviceVehicleRequestsAPI.trackByReference(code);
          setRequestData(response.data);
        } catch (vehicleErr) {
          // If vehicle request fails, try item request as fallback
          try {
            response = await requestsAPI.trackByTicket(code);
            setRequestData(response.data);
          } catch (itemErr) {
            throw vehicleErr; // Throw the original vehicle error
          }
        }
      } else if (code.startsWith('REQ-')) {
        // Item request
        try {
          response = await requestsAPI.trackByTicket(code);
          setRequestData(response.data);
        } catch (itemErr) {
          // If item request fails, try vehicle request as fallback
          try {
            response = await serviceVehicleRequestsAPI.trackByReference(code);
            setRequestData(response.data);
          } catch (vehicleErr) {
            throw itemErr; // Throw the original item error
          }
        }
      } else {
        // Unknown format - try both
        try {
          response = await requestsAPI.trackByTicket(code);
          setRequestData(response.data);
        } catch (itemErr) {
          try {
            response = await serviceVehicleRequestsAPI.trackByReference(code);
            setRequestData(response.data);
          } catch (vehicleErr) {
            throw itemErr; // Throw the first error
          }
        }
      }
    } catch (err) {
      console.error('Error tracking request:', err);
      setError(err.response?.data?.message || 'Failed to find request. Please check the ticket code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      department_approved: 'bg-green-100 text-green-800',
      it_manager_approved: 'bg-green-100 text-green-800',
      service_desk_processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      declined: 'bg-red-100 text-red-800',
      returned: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (event) => {
    if (event.isDeclined) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (event.isCompleted) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (event.isPending) {
      return <Clock className="w-5 h-5 text-yellow-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-gray-400" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="mx-auto h-20 w-20 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Package className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Track Your Request
          </h1>
          <p className="text-gray-600">
            Enter your ticket code to view the status of your IT equipment or vehicle request
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label htmlFor="ticketCode" className="block text-sm font-medium text-gray-700 mb-2">
                Ticket Code
              </label>
              <div className="flex gap-3">
                <input
                  id="ticketCode"
                  type="text"
                  value={ticketCode}
                  onChange={(e) => {
                    setTicketCode(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g., REQ-20240106-123456 or SVR-20240106-123456"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Track
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-red-600">{error}</div>
              </div>
            )}
          </form>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>

        {/* Request Details */}
        {requestData && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {requestData.requestType === 'vehicle' ? (
                      <Car className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Package className="w-6 h-6 text-blue-600" />
                    )}
                    <h2 className="text-2xl font-bold text-gray-900">
                      {requestData.ticketCode}
                    </h2>
                    {requestData.requestType === 'vehicle' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        Vehicle Request
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>Submitted by: <strong>{requestData.submittedBy}</strong></span>
                    {requestData.department && (
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {requestData.department}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(requestData.status)}`}>
                    {requestData.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  {requestData.priority && (
                    <div className="mt-2">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(requestData.priority)}`}>
                        {requestData.priority.toUpperCase()} Priority
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">
                  <strong>Purpose:</strong> {requestData.purpose}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Submitted:</strong> {
                    requestData.status === 'draft' 
                      ? 'Not submitted yet'
                      : (requestData.submittedDate 
                          ? formatDate(requestData.submittedDate) 
                          : (requestData.timeline?.[0]?.timestamp 
                              ? formatDate(requestData.timeline[0].timestamp) 
                              : 'Date not available'))
                  }
                </p>
                {requestData.requestType === 'vehicle' && requestData.vehicleDetails && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-600">
                      <strong>Request Type:</strong> {requestData.vehicleDetails.requestType}
                    </p>
                    {requestData.vehicleDetails.travelDateFrom && (
                      <p className="text-sm text-gray-600">
                        <strong>Travel Date:</strong> {new Date(requestData.vehicleDetails.travelDateFrom).toLocaleDateString()}
                        {requestData.vehicleDetails.travelDateTo && ` - ${new Date(requestData.vehicleDetails.travelDateTo).toLocaleDateString()}`}
                      </p>
                    )}
                    {requestData.vehicleDetails.destination && (
                      <p className="text-sm text-gray-600">
                        <strong>Destination:</strong> {requestData.vehicleDetails.destination}
                      </p>
                    )}
                    {requestData.vehicleDetails.assignedDriver && (
                      <p className="text-sm text-gray-600">
                        <strong>Assigned Driver:</strong> {requestData.vehicleDetails.assignedDriver}
                      </p>
                    )}
                    {requestData.vehicleDetails.assignedVehicle && (
                      <p className="text-sm text-gray-600">
                        <strong>Assigned Vehicle:</strong> {requestData.vehicleDetails.assignedVehicle}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Timeline</h3>
              <div className="space-y-4">
                {requestData.timeline.map((event, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0 pt-1">
                      {getStatusIcon(event)}
                    </div>
                    <div className={`flex-1 pb-4 border-b border-gray-200 last:border-0 ${event.isPending ? 'bg-yellow-50 -mx-4 px-4 py-3 rounded' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className={`font-medium ${event.isPending ? 'text-yellow-900' : 'text-gray-900'}`}>
                              {event.status}
                            </h4>
                            {event.isPending && (
                              <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-medium rounded-full">
                                Awaiting Action
                              </span>
                            )}
                            {event.isCompleted && (
                              <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-medium rounded-full">
                                Completed
                              </span>
                            )}
                            {event.isDeclined && (
                              <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-medium rounded-full">
                                Declined
                              </span>
                            )}
                          </div>
                          <p className={`text-sm mt-1 ${event.isPending ? 'text-yellow-700 font-medium' : 'text-gray-600'}`}>
                            {event.description}
                          </p>
                          {event.completedBy && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                              <User className="w-4 h-4" />
                              <span>{event.completedBy.name}</span>
                              {event.completedBy.role && (
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                  {event.completedBy.role.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                          )}
                          {event.comments && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                              <strong>Comments:</strong> {event.comments}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <span className={`text-sm ${event.isPending ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
                            {event.isPending ? 'Pending' : (event.timestamp ? formatDate(event.timestamp) : (event.isCompleted ? 'Completed' : ''))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items Requested (only for item requests) */}
            {requestData.requestType !== 'vehicle' && requestData.items && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Items Requested</h3>
                <div className="space-y-3">
                  {requestData.items.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {item.category.replace(/_/g, ' ').toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                          </div>
                          {item.itemDescription && (
                            <p className="text-sm text-gray-700 mt-2">{item.itemDescription}</p>
                          )}
                          {item.specifications && (
                            <p className="text-sm text-gray-600 mt-1">
                              <strong>Specs:</strong> {item.specifications}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 pb-8">
          <p className="text-xs text-gray-500">© 2024 Styrotech Corporation. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default TrackRequest;

