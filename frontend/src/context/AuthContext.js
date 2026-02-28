/**
 * context/AuthContext.js
 *
 * Provides auth state (user, role) to the whole app.
 * On mount, restores state from localStorage then validates the JWT
 * against the backend — expired tokens are cleared automatically.
 */

import React, { createContext, useState, useCallback, useEffect, useContext } from 'react';
import { validateToken } from '../services/auth.js';

export const AuthContext = createContext(null);

// ─── convenience hook ─────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ─── provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [role,    setRole]    = useState(null);
  const [loading, setLoading] = useState(true);  // true until token check done

  // ── restore + validate on mount ───────────────────────────────────────────
  useEffect(() => {
    async function restoreSession() {
      try {
        const rawUser    = localStorage.getItem('user');
        const storedRole = localStorage.getItem('role');
        const token      = localStorage.getItem('token');

        // Nothing stored → not logged in
        if (!token || !rawUser) {
          setLoading(false);
          return;
        }

        // Safe parse — corrupted localStorage shouldn't crash the app
        let parsedUser = null;
        try { parsedUser = JSON.parse(rawUser); } catch { /* ignore */ }

        if (!parsedUser) {
          // Corrupted data — wipe and start fresh
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          setLoading(false);
          return;
        }

        // Validate JWT with backend — clears storage on 401 via apiClient interceptor
        const valid = await validateToken();

        if (valid) {
          setUser(parsedUser);
          setRole(storedRole);
        }
        // If invalid, validateToken already cleared localStorage via the
        // apiClient 401 interceptor; state stays null.
      } catch {
        // Network error etc. — keep user logged in optimistically
        // (the interceptor will catch the next real 401)
        const rawUser = localStorage.getItem('user');
        const storedRole = localStorage.getItem('role');
        try {
          if (rawUser) setUser(JSON.parse(rawUser));
          if (storedRole) setRole(storedRole);
        } catch { /* ignore */ }
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  // ── login — called after a successful POST /api/auth/login ───────────────
  const login = useCallback((userData, token) => {
    setUser(userData);
    setRole(userData.role);
    localStorage.setItem('token', token);
    localStorage.setItem('user',  JSON.stringify(userData));
    localStorage.setItem('role',  userData.role);
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    setRole(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
  }, []);

  // ── isAuthenticated — reactive (depends on state, not just localStorage) ─
  const isAuthenticated = useCallback(() => {
    return !!localStorage.getItem('token') && !!user;
  }, [user]);

  // ── update stored user (e.g. after profile edit) ─────────────────────────
  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, role, loading, login, logout, isAuthenticated, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}