import { useState, useCallback } from 'react';
import { authService } from '../services/auth';

export function useAuth() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [role, setRole] = useState(() => {
    return localStorage.getItem('role') || null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password, isAdmin = false) => {
    setLoading(true);
    setError(null);

    try {
      const data = isAdmin
        ? await authService.adminLogin(email, password)
        : await authService.employeeLogin(email, password);

      setUser(data.user);
      setRole(isAdmin ? 'admin' : 'employee');

      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    setUser(null);
    setRole(null);
  }, []);

  const isAuthenticated = useCallback(() => {
    return !!localStorage.getItem('token');
  }, []);

  return {
    user,
    role,
    loading,
    error,
    login,
    logout,
    isAuthenticated
  };
}