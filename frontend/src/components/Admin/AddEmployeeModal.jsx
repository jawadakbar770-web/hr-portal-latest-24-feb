import React, { useState } from 'react';
import axios from 'axios';
import { X, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddEmployeeModal({ onClose, onAdd, employee }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if we are in Edit Mode
  const isEditMode = !!employee;

  const [formData, setFormData] = useState({
    email: employee?.email || '',
    employeeNumber: employee?.employeeNumber || '',
    firstName: employee?.firstName || '',
    lastName: employee?.lastName || '',
    joiningDate: employee?.joiningDate ? employee.joiningDate.split('T')[0] : new Date().toISOString().split('T')[0],
    department: employee?.department || 'IT',
    shift: {
      start: employee?.shift?.start || '09:00',
      end: employee?.shift?.end || '18:00'
    },
    hourlyRate: employee?.hourlyRate || '',
    bank: {
      bankName: employee?.bank?.bankName || '',
      accountName: employee?.bank?.accountName || '',
      accountNumber: employee?.bank?.accountNumber || ''
    }
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('shift')) {
      const key = name.split('.')[1];
      setFormData({
        ...formData,
        shift: { ...formData.shift, [key]: value }
      });
    } else if (name.includes('bank')) {
      const key = name.split('.')[1];
      setFormData({
        ...formData,
        bank: { ...formData.bank, [key]: value }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const calculateMonthlySalary = () => {
    if (!formData.hourlyRate) return 0;
    const shiftStart = formData.shift.start.split(':');
    const shiftEnd = formData.shift.end.split(':');
    const startMinutes = parseInt(shiftStart[0]) * 60 + parseInt(shiftStart[1]);
    const endMinutes = parseInt(shiftEnd[0]) * 60 + parseInt(shiftEnd[1]);
    const hoursPerDay = (endMinutes - startMinutes) / 60;
    const monthlySalary = hoursPerDay * 22 * parseFloat(formData.hourlyRate);
    return monthlySalary.toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      if (isEditMode) {
        // Edit Mode Logic
        const response = await axios.put(`/api/employees/${employee._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Employee updated successfully');
        onAdd(response.data.employee); // This updates the state in ManageEmployees
        onClose();
      } else {
        // Add Mode Logic
        const response = await axios.post('/api/employees/', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setJoinLink(response.data.joinLink);
        setShowSuccess(true);
        onAdd(response.data.employee);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} employee`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Invitation Created</h2>
          <p className="text-gray-600 mb-6">Share this link with the employee:</p>
          
          <div className="bg-gray-100 p-4 rounded-lg mb-6 break-all text-sm">
            {joinLink}
          </div>

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition mb-4"
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <button
            onClick={() => {
              setShowSuccess(false);
              onClose();
            }}
            className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 md:p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {isEditMode ? 'Edit Employee' : 'Register New Employee'}
            </h2>
            <p className="text-sm text-gray-600">
              {isEditMode ? 'Update profile and payroll details.' : 'Set up basic profile and payroll defaults.'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('basic')}
              className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Basic Info
            </button>
            <button
              onClick={() => setActiveTab('bank')}
              className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'bank'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Bank Details
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="employee@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employee Number *</label>
                  <input
                    type="text"
                    name="employeeNumber"
                    value={formData.employeeNumber}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="A001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Joining Date *</label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="IT">IT</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Manager">Manager</option>
                    <option value="Marketing">Marketing</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shift Start Time *</label>
                  <input
                    type="time"
                    name="shift.start"
                    value={formData.shift.start}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shift End Time *</label>
                  <input
                    type="time"
                    name="shift.end"
                    value={formData.shift.end}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate (PKR) *</label>
                <input
                  type="number"
                  name="hourlyRate"
                  value={formData.hourlyRate}
                  onChange={handleInputChange}
                  required
                  inputMode="numeric"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter hourly rate"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Estimated Monthly Salary: <span className="font-semibold">PKR {calculateMonthlySalary()}</span>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                <input
                  type="text"
                  name="bank.bankName"
                  value={formData.bank.bankName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="HBL, UBL, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                <input
                  type="text"
                  name="bank.accountName"
                  value={formData.bank.accountName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                <input
                  type="text"
                  name="bank.accountNumber"
                  value={formData.bank.accountNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  inputMode="numeric"
                />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : (isEditMode ? 'Update Employee' : 'Save & Invite')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}