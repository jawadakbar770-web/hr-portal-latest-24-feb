import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated, getRole } from '../../services/auth';

export default function ProtectedRoute({ children, requiredRole }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const role = getRole();
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'} replace />;
  }

  return children;
}