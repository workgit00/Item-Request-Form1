import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import RequestForm from './components/RequestForm';
import UserManagement from './components/UserManagement';
import DepartmentManagement from './components/DepartmentManagement';
import TrackRequest from './components/TrackRequest';
import ServiceVehicleRequestForm from './components/ServiceVehicleRequestForm';
import FormSelector from './components/FormSelector';

import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirect to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <LoginForm />
          </PublicRoute>
        } 
      />
      
      <Route 
        path="/track" 
        element={<TrackRequest />} 
      />

      {/* Form Selector Route */}
      <Route 
        path="/forms" 
        element={
          <ProtectedRoute>
            <FormSelector />
          </ProtectedRoute>
        } 
      />

      {/* Protected Routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/requests/new" 
        element={
          <ProtectedRoute>
            <RequestForm />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/requests/:id/edit" 
        element={
          <ProtectedRoute>
            <RequestForm />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/requests/:id" 
        element={
          <ProtectedRoute>
            <RequestForm />
          </ProtectedRoute>
        } 
      />
        <Route 
        path="/service-vehicle-requests/new" 
        element={
          <ProtectedRoute>
            <ServiceVehicleRequestForm />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/service-vehicle-requests/:id/edit" 
        element={
          <ProtectedRoute>
            <ServiceVehicleRequestForm />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/service-vehicle-requests/:id" 
        element={
          <ProtectedRoute>
            <ServiceVehicleRequestForm />
          </ProtectedRoute>
        } 
      />
      
 
      
      <Route 
        path="/users" 
        element={
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/departments" 
        element={
          <ProtectedRoute>
            <DepartmentManagement />
          </ProtectedRoute>
        } 
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
