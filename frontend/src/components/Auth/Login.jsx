import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, employeeLogin, isAuthenticated } from '../../services/auth';
import toast from 'react-hot-toast';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
  const [userType, setUserType] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated()) {
      const role = localStorage.getItem('role');
      navigate(role === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
    }

    // Load saved credentials if remember me was checked
    const savedEmail = localStorage.getItem('savedEmail');
    const savedUserType = localStorage.getItem('savedUserType');
    if (savedEmail) {
      setEmail(savedEmail);
      setUserType(savedUserType || 'admin');
      setRememberMe(true);
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      if (userType === 'admin') {
        await adminLogin(email, password);
        toast.success('Welcome Admin!');
      } else {
        await employeeLogin(email, password);
        toast.success('Welcome!');
      }

      // Save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedUserType', userType);
      } else {
        localStorage.removeItem('savedEmail');
        localStorage.removeItem('savedUserType');
      }

      navigate(userType === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setUserType('admin');
    setEmail('admin@example.com');
    setPassword('Admin@123456');
  };

  const fillEmployeeCredentials = () => {
    setUserType('employee');
    setEmail('employee@example.com');
    setPassword('Employee@123456');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full filter blur-3xl"></div>
      </div>

      {/* Login Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 md:p-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <LogIn className="text-blue-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">HR Portal</h1>
          <p className="text-gray-600">Employee Management System</p>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-6">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Demo Credentials:</span>
            <br />
            Admin: admin@example.com / Admin@123456
            <br />
            Employee: employee@example.com / Employee@123456
          </p>
        </div>

        {/* User Type Selection */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setUserType('admin')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-200 ${
              userType === 'admin'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => setUserType('employee')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-200 ${
              userType === 'employee'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Employee
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
              disabled={loading}
            />
            <label htmlFor="rememberMe" className="text-sm text-gray-600">
              Remember me
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Quick Demo Fill */}
        <div className="border-t pt-6">
          <p className="text-center text-sm text-gray-600 mb-4">Quick Demo Access:</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={fillAdminCredentials}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
            >
              Fill Admin
            </button>
            <button
              onClick={fillEmployeeCredentials}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-medium"
            >
              Fill Employee
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="absolute top-4 left-4 right-4 text-white text-center text-sm">
        <p className="flex items-center justify-center gap-2">
          <AlertCircle size={16} />
          This is a demo application. Use provided credentials for testing.
        </p>
      </div>
    </div>
  );
}