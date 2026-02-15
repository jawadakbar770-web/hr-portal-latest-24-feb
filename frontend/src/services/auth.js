import { authService } from './api';

export async function adminLogin(email, password) {
  const response = await authService.adminLogin(email, password);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    localStorage.setItem('role', 'admin');
  }
  return response.data;
}

export async function employeeLogin(email, password) {
  const response = await authService.employeeLogin(email, password);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    localStorage.setItem('role', 'employee');
  }
  return response.data;
}

export async function employeeOnboard(token, data) {
  const response = await authService.employeeOnboard(token, data);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    localStorage.setItem('role', 'employee');
  }
  return response.data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('role');
}

export function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function getRole() {
  return localStorage.getItem('role');
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}