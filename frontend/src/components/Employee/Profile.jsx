import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Save, Calendar, User, Lock, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const [employee, setEmployee] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day   = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year  = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // ── FIX 1: Use /api/auth/validate-token instead of admin-only /api/employees/:id ──
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await axios.get('/api/auth/validate-token', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setEmployee(response.data.user);
      } else {
        toast.error('Failed to load profile');
      }
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // ── FIX 2: Send currentPassword in request body + show field in UI ──
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!formData.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      await axios.post(
        '/api/auth/change-password',
        {
          currentPassword: formData.currentPassword, // ← was missing before
          newPassword: formData.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Password changed successfully');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setEditMode(false);
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to change password';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleShow = (field) =>
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));

  const cancelEdit = () => {
    setEditMode(false);
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500">Loading profile…</div>
      </div>
    );
  }

  const InfoField = ({ label, value, type = 'text' }) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        readOnly
        className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 cursor-not-allowed select-none"
      />
    </div>
  );

  const PasswordField = ({ label, field, placeholder }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={showPassword[field] ? 'text' : 'password'}
          value={formData[`${field}Password`] ?? formData[field] ?? ''}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              [`${field}Password`]: e.target.value,
            }))
          }
          required
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => toggleShow(field)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword[field] ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">My Profile</h1>

      <div className="max-w-3xl space-y-6">

        {/* ── Personal Information ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <User size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Personal Information</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="First Name" value={employee?.firstName} />
              <InfoField label="Last Name"  value={employee?.lastName} />
            </div>

            <InfoField label="Email" value={employee?.email} type="email" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Employee ID" value={employee?.employeeNumber} />
              <InfoField label="Department"  value={employee?.department} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Joining Date</label>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
                  <Calendar size={16} className="text-gray-400 shrink-0" />
                  <span>{employee?.joiningDate ? formatDateToDisplay(employee.joiningDate) : '—'}</span>
                </div>
              </div>
              <InfoField label="Hourly Rate (PKR)" value={employee?.hourlyRate} type="number" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Shift Start" value={employee?.shift?.start} type="time" />
              <InfoField label="Shift End"   value={employee?.shift?.end}   type="time" />
            </div>
          </div>
        </div>

        {/* ── Bank Details ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <CreditCard size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Bank Details</h2>
          </div>

          <div className="space-y-4">
            <InfoField label="Bank Name"      value={employee?.bank?.bankName} />
            <InfoField label="Account Name"   value={employee?.bank?.accountName} />
            <InfoField label="Account Number" value={employee?.bank?.accountNumber} />
          </div>
        </div>

        {/* ── Change Password ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">Change Password</h2>
            </div>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
              >
                Change Password
              </button>
            ) : (
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            )}
          </div>

          {editMode && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* ── FIX 3: currentPassword field was missing from the UI ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword.current ? 'text' : 'password'}
                    value={formData.currentPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                    required
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('current')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword.new ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    required
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('new')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword.confirm ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    required
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('confirm')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {saving ? 'Saving…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}