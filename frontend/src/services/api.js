import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      window.location.href = '/login';
      toast.error('Session expired. Please login again.');
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to access this resource.');
    } else if (error.response?.status === 500) {
      toast.error('Server error. Please try again later.');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  adminLogin: (email, password) => api.post('/auth/admin/login', { email, password }),
  employeeLogin: (email, password) => api.post('/auth/employee/login', { email, password }),
  employeeOnboard: (token, data) => api.post('/auth/employee/onboard', { token, ...data }),
  validateToken: () => api.post('/auth/validate-token'),
  changePassword: (newPassword) => api.post('/auth/change-password', { newPassword })
};

export const employeeService = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  freeze: (id) => api.patch(`/employees/${id}/freeze`),
  archive: (id) => api.patch(`/employees/${id}/archive`),
  resendInvite: (id) => api.post(`/employees/${id}/resend-invite`),
  resetPassword: (id) => api.post(`/employees/${id}/reset-password`)
};

export const attendanceService = {
  saveBatch: (data) => api.post('/attendance/save-batch', data),
  getRange: (fromDate, toDate) => api.get('/attendance/range', { 
    params: { fromDate, toDate } 
  }),
  getByEmployee: (empId, fromDate, toDate) => api.get(`/attendance/employee/${empId}`, {
    params: { fromDate, toDate }
  })
};

export const payrollService = {
  getSummary: (fromDate, toDate) => api.get('/payroll/summary', { 
    params: { fromDate, toDate } 
  }),
  getEmployeeDetails: (empId, fromDate, toDate) => api.get(`/payroll/employee/${empId}`, { 
    params: { fromDate, toDate } 
  }),
  downloadReport: (fromDate, toDate) => api.get('/payroll/export', {
    params: { fromDate, toDate },
    responseType: 'blob'
  })
};

export const requestService = {
  submitLeave: (data) => api.post('/requests/leave/submit', data),
  submitCorrection: (data) => api.post('/requests/correction/submit', data),
  getMyRequests: (params) => api.get('/requests/my-requests', { params }),
  getPendingRequests: () => api.get('/requests/admin/pending'),
  approveLeave: (requestId, data) => api.patch(`/requests/leave/${requestId}/approve`, data),
  rejectLeave: (requestId, data) => api.patch(`/requests/leave/${requestId}/reject`, data),
  approveCorrection: (requestId, data) => api.patch(`/requests/correction/${requestId}/approve`, data),
  rejectCorrection: (requestId, data) => api.patch(`/requests/correction/${requestId}/reject`, data)
};

export const notificationService = {
  getPending: () => api.get('/notifications/pending'),
  clear: (filters) => api.patch('/notifications/clear', { filters })
};

export default api;