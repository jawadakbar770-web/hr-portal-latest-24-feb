import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Filter, MoreVertical, Trash2, Lock, Eye, Edit2, Send } from 'lucide-react';
import AddEmployeeModal from './AddEmployeeModal';
import EmployeeActionsMenu from './EmployeeActionsMenu';
import toast from 'react-hot-toast';

export default function ManageEmployees() {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null); // State to handle editing
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    fetchEmployees();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    filterAndSortEmployees();
  }, [employees, searchTerm, statusFilter, departmentFilter, sortBy]);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/employees/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(response.data.employees);
    } catch (error) {
      toast.error('Failed to fetch employees');
    }
  };

  const filterAndSortEmployees = () => {
    let filtered = employees.filter(emp => {
      const matchesSearch = !searchTerm || 
        emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeNumber.includes(searchTerm);

      const matchesStatus = !statusFilter || emp.status === statusFilter;
      const matchesDept = !departmentFilter || emp.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    });

    if (sortBy === 'name') {
      filtered.sort((a, b) => a.firstName.localeCompare(b.firstName));
    } else if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.joiningDate) - new Date(a.joiningDate));
    } else if (sortBy === 'rate') {
      filtered.sort((a, b) => b.hourlyRate - a.hourlyRate);
    }

    setFilteredEmployees(filtered);
  };

  const handleAddEmployee = (newEmployee) => {
    setEmployees([...employees, newEmployee]);
    setShowAddModal(false);
  };

  const handleUpdateEmployee = (updatedEmployee) => {
    setEmployees(employees.map(emp => 
      emp._id === updatedEmployee._id ? updatedEmployee : emp
    ));
    setEditingEmployee(null);
  };

  const handleToggleFreeze = async (employeeId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/employees/${employeeId}/freeze`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEmployees();
      toast.success('Employee status updated');
      setOpenMenuId(null);
    } catch (error) {
      toast.error('Failed to update employee');
    }
  };

  const handleArchive = async (employeeId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/employees/${employeeId}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEmployees();
      toast.success('Employee archived');
      setOpenMenuId(null);
    } catch (error) {
      toast.error('Failed to archive employee');
    }
  };

  const handleResendInvite = async (employeeId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/employees/${employeeId}/resend-invite`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const link = response.data.joinLink;
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied to clipboard!');
      setOpenMenuId(null);
    } catch (error) {
      toast.error('Failed to generate invite link');
    }
  };

  const handleGhostMode = async (employee) => {
    try {
      // Set flags in localStorage so the Dashboard knows to act as Read-Only
      localStorage.setItem('ghostMode', 'true');
      localStorage.setItem('viewingEmployeeId', employee._id);
      localStorage.setItem('viewingEmployeeName', `${employee.firstName} ${employee.lastName}`);
      
      toast.success(`Viewing as ${employee.firstName} (Read-Only Mode)`);
      
      // Redirect to the employee dashboard view
      window.location.href = '/dashboard'; 
    } catch (error) {
      toast.error('Failed to enter Ghost Mode');
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      Active: 'bg-green-100 text-green-800',
      Inactive: 'bg-gray-100 text-gray-800',
      Frozen: 'bg-blue-100 text-blue-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Employees</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className={`${
            isMobile ? 'fixed bottom-6 right-6 w-14 h-14 rounded-full' : 'px-4 py-2 rounded-lg'
          } bg-blue-500 text-white flex items-center justify-center gap-2 hover:bg-blue-600 transition z-40 shadow-lg`}
        >
          <Plus size={20} />
          {!isMobile && <span>Add Employee</span>}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Name, Email, or ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Frozen">Frozen</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Departments</option>
              <option value="IT">IT</option>
              <option value="Customer Support">Customer Support</option>
              <option value="Manager">Manager</option>
              <option value="Marketing">Marketing</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Name (A-Z)</option>
              <option value="date">Joining Date</option>
              <option value="rate">Hourly Rate</option>
            </select>
          </div>
        </div>
      </div>

      {!isMobile ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Department</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEmployees.map((employee) => (
                  <tr key={employee._id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{employee.firstName} {employee.lastName}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{employee.email}</td>
                    <td className="px-6 py-4 text-gray-600">{employee.employeeNumber}</td>
                    <td className="px-6 py-4 text-gray-600">{employee.department}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(employee.status)}`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === employee._id ? null : employee._id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <MoreVertical size={20} />
                      </button>
                      {openMenuId === employee._id && (
                        <EmployeeActionsMenu
                          employee={employee}
                          onFreeze={() => handleToggleFreeze(employee._id)}
                          onArchive={() => handleArchive(employee._id)}
                          onResend={() => handleResendInvite(employee._id)}
                          onGhostMode={() => handleGhostMode(employee)}
                          onEdit={() => setEditingEmployee(employee)}
                          onClose={() => setOpenMenuId(null)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEmployees.map((employee) => (
            <div key={employee._id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{employee.firstName} {employee.lastName}</h3>
                  <p className="text-sm text-gray-600">{employee.email}</p>
                </div>
                <button
                  onClick={() => setOpenMenuId(openMenuId === employee._id ? null : employee._id)}
                  className="text-gray-400"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
              <div className="space-y-2 text-sm mb-3">
                <p><span className="font-medium">ID:</span> {employee.employeeNumber}</p>
                <p><span className="font-medium">Dept:</span> {employee.department}</p>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(employee.status)}`}>
                {employee.status}
              </span>
              {openMenuId === employee._id && (
                <div className="relative mt-2">
                  <EmployeeActionsMenu
                    employee={employee}
                    onFreeze={() => handleToggleFreeze(employee._id)}
                    onArchive={() => handleArchive(employee._id)}
                    onResend={() => handleResendInvite(employee._id)}
                    onGhostMode={() => handleGhostMode(employee)}
                    onEdit={() => setEditingEmployee(employee)}
                    onClose={() => setOpenMenuId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddEmployee}
        />
      )}

      {editingEmployee && (
        <AddEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onAdd={handleUpdateEmployee}
        />
      )}
    </div>
  );
}