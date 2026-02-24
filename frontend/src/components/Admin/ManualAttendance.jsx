import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Calendar, Download, MoreVertical, Upload, AlertCircle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import CSVImportModal from './CSVImportModal.jsx';
import { formatDate, formatDateTime } from '../../utils/dateFormatter.js';
import { getDateMinusDays, getTodayDate } from '../../utils/dateFormatter.js';

export default function ManualAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(getDateMinusDays(30));
  const [toDate, setToDate] = useState(getTodayDate());
  const [showImportModal, setShowImportModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const userRole = localStorage.getItem('role');
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Wrap fetchAttendance in useCallback to make it stable
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await axios.get(
        `/api/attendance/range?fromDate=${fromDate}&toDate=${toDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.attendance) {
        setAttendance(response.data.attendance);
      } else {
        setAttendance([]);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Unauthorized. Please login again.');
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to access this page.');
      } else {
        toast.error('Failed to load attendance data');
      }
      console.error('Attendance fetch error:', error);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]); // dependencies for the fetch function

  // Initial load
  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]); // ✅ include fetchAttendance

  const handleDateRangeChange = () => {
    if (new Date(fromDate) > new Date(toDate)) {
      toast.error('From date cannot be after to date');
      return;
    }
    fetchAttendance();
  };

  const handleImportSuccess = () => {
    setRefreshing(true);
    setTimeout(() => {
      fetchAttendance();
      setRefreshing(false);
      toast.success('Attendance list updated');
    }, 1500);
  };

  const handleExport = () => {
    if (attendance.length === 0) {
      toast.error('No attendance data to export');
      return;
    }

    const csv = [
      ['Date', 'Employee ID', 'Name', 'Department', 'Status', 'In Time', 'Out Time', 'Hours Worked', 'Daily Earning', 'Last Modified'].join(',')
    ];

    attendance.forEach(record => {
      csv.push([
        record.dateFormatted || '--',
        record.empNumber || '--',
        record.empName || '--',
        record.department || '--',
        record.status || '--',
        record.inTime || '--',
        record.outTime || '--',
        (record.financials?.hoursPerDay?.toFixed(2)) || '0.00',
        (record.financials?.finalDayEarning?.toFixed(2)) || '0.00',
        record.lastModified || '--'
      ].map(val => `"${val}"`).join(','));
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${fromDate}-to-${toDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Attendance exported successfully');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return 'bg-green-100 text-green-800';
      case 'Late':
        return 'bg-yellow-100 text-yellow-800';
      case 'Leave':
        return 'bg-blue-100 text-blue-800';
      case 'Absent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manual Attendance</h1>
        <div className="flex gap-2 w-full md:w-auto">
          {isAdmin && (
            <button
              onClick={() => setShowImportModal(true)}
              disabled={loading || refreshing}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm md:text-base"
              title="Import CSV file"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={loading || attendance.length === 0}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm md:text-base"
            title="Export attendance"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchAttendance().then(() => setRefreshing(false));
            }}
            disabled={loading || refreshing}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 text-sm md:text-base ${
              refreshing ? 'animate-spin' : ''
            }`}
            title="Refresh data"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
              From Date (dd/mm/yyyy)
            </label>
            <input
              type="text"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="dd/mm/yyyy"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
              To Date (dd/mm/yyyy)
            </label>
            <input
              type="text"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="dd/mm/yyyy"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleDateRangeChange}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
          </div>
          <div className="flex items-end md:col-span-2">
            <div className="w-full text-xs text-gray-600 p-2 bg-gray-50 rounded">
              Total Records: {attendance.length}
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && !attendance.length ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Loading attendance data...</p>
          </div>
        ) : attendance.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No attendance records found for selected date range</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Employee ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Department</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">In Time</th>
                    <th className="px-4 py-3 text-center font-semibold">Out Time</th>
                    <th className="px-4 py-3 text-right font-semibold">Hours</th>
                    <th className="px-4 py-3 text-right font-semibold">Earning</th>
                    <th className="px-4 py-3 text-left font-semibold">Last Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{record.dateFormatted}</td>
                      <td className="px-4 py-3 font-medium">{record.empNumber}</td>
                      <td className="px-4 py-3">{record.empName}</td>
                      <td className="px-4 py-3">{record.department}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{record.inTime}</td>
                      <td className="px-4 py-3 text-center">{record.outTime}</td>
                      <td className="px-4 py-3 text-right">{(record.financials?.hoursPerDay || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        PKR {(record.financials?.finalDayEarning || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{record.lastModified}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-3 p-4">
              {attendance.map((record, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{record.empName}</p>
                      <p className="text-xs text-gray-600">ID: {record.empNumber}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm mb-2">
                    <p><span className="font-medium">Date:</span> {record.dateFormatted}</p>
                    <p><span className="font-medium">Dept:</span> {record.department}</p>
                    <p><span className="font-medium">In/Out:</span> {record.inTime} - {record.outTime}</p>
                    <p><span className="font-medium">Hours:</span> {(record.financials?.hoursPerDay || 0).toFixed(2)}</p>
                    <p><span className="font-medium">Earning:</span> PKR {(record.financials?.finalDayEarning || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Modified:</span> {record.lastModified}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <CSVImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}