import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getRole } from './services/auth';

// Auth Pages
import Login from './components/Auth/Login';
import EmployeeOnboarding from './components/Auth/EmployeeOnboarding';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Admin Pages
import AdminDashboard from './components/Admin/AdminDashboard';
import ManageEmployees from './components/Admin/ManageEmployees';
import ManualAttendance from './components/Admin/ManualAttendance';
import PayrollReports from './components/Admin/PayrollReports';
import NotificationCenter from './components/Admin/NotificationCenter';

// Employee Pages
import EmployeeDashboard from './components/Employee/EmployeeDashboard';
import AttendanceHistory from './components/Employee/AttendanceHistory';
import MySalary from './components/Employee/MySalary';
import MyRequests from './components/Employee/MyRequests';
import Profile from './components/Employee/Profile';

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate token on app load
    const validateToken = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Token exists, user is authenticated
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading HR Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/join/:token" element={<EmployeeOnboarding />} />

        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute requiredRole="admin">
              <ManageEmployees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/attendance"
          element={
            <ProtectedRoute requiredRole="admin">
              <ManualAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payroll"
          element={
            <ProtectedRoute requiredRole="admin">
              <PayrollReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute requiredRole="admin">
              <NotificationCenter />
            </ProtectedRoute>
          }
        />

        {/* Employee Routes */}
        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute requiredRole="employee">
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/attendance"
          element={
            <ProtectedRoute requiredRole="employee">
              <AttendanceHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/salary"
          element={
            <ProtectedRoute requiredRole="employee">
              <MySalary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/requests"
          element={
            <ProtectedRoute requiredRole="employee">
              <MyRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/profile"
          element={
            <ProtectedRoute requiredRole="employee">
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Catch All */}
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              <Navigate to={getRole() === 'admin' ? '/admin/dashboard' : '/employee/dashboard'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}