import React, { createContext, useState, useCallback, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    const storedRole = localStorage.getItem('role');

    if (storedUser && storedRole) {
      setUser(JSON.parse(storedUser));
      setRole(storedRole);
    }

    setLoading(false);
  }, []);

  const login = useCallback((userData, userRole) => {
    setUser(userData);
    setRole(userRole);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('role', userRole);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setRole(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
  }, []);

  const isAuthenticated = useCallback(() => {
    return !!localStorage.getItem('token') && !!user;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        login,
        logout,
        isAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}