import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Menu } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GhostModeView({ employee, onClose }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGhostModeData();
  }, [employee]);

  const fetchGhostModeData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Get current month dates
      const today = new Date();
      const month = today.getMonth();
      const year = today.getFullYear();
      const day = today.getDate();

      let fromDate, toDate;
      if (day >= 18) {
        fromDate = new Date(year, month, 18);
        toDate = new Date(year, month + 1, 17);
      } else {
        fromDate = new Date(year, month - 1, 18);
        toDate = new Date(year, month, 17);
      }

      // Fetch payroll data for this employee
      const response = await axios.get(
        `/api/payroll/employee-breakdown/${employee._id}`,
        {
          params: {
            fromDate: fromDate.toISOString().split('T')[0],
            toDate: Math.min(toDate, today).toISOString().split('T')[0]
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setAttendanceData(response.data.dailyBreakdown || []);
      setSalaryData(response.data.totals);

      setDashboardData({
        daysWorked: response.data.dailyBreakdown.filter(d => d.hoursPerDay > 0).length,
        totalEarning: response.data.totals.netPayable,
        otHours: response.data.dailyBreakdown.reduce((sum, d) => sum + (d.otAmount ? 1 : 0), 0)
      });

      setLoading(false);
    } catch (error) {
      toast.error('Failed to load employee data');
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Employee Portal Preview</h2>
            <p className="text-blue-100 mt-1">
              Viewing as: {employee.firstName} {employee.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <div className="bg-white border-b">
          <div className="flex gap-4 p-4">
            <button
              onClick={() => setActiveSection('dashboard')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeSection === 'dashboard'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveSection('attendance')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeSection === 'attendance'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Attendance
            </button>
            <button
              onClick={() => setActiveSection('salary')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeSection === 'salary'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Salary
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading employee data...</p>
            </div>
          ) : (
            <>
              {/* Dashboard Section */}
              {activeSection === 'dashboard' && dashboardData && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-800">My Dashboard</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 mb-2">Current Earning (This Month)</p>
                      <p className="text-3xl font-bold text-blue-600">
                        PKR {dashboardData.totalEarning.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600 mb-2">Days Worked</p>
                      <p className="text-3xl font-bold text-green-600">
                        {dashboardData.daysWorked}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-600 mb-2">OT Hours</p>
                      <p className="text-3xl font-bold text-purple-600">
                        {dashboardData.otHours}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">Employee Info</p>
                    <div className="space-y-2">
                      <p><span className="font-medium">Name:</span> {employee.firstName} {employee.lastName}</p>
                      <p><span className="font-medium">ID:</span> {employee.employeeNumber}</p>
                      <p><span className="font-medium">Department:</span> {employee.department}</p>
                      <p><span className="font-medium">Hourly Rate:</span> PKR {employee.hourlyRate}</p>
                      <p><span className="font-medium">Shift:</span> {employee.shift.start} - {employee.shift.end}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Section */}
              {activeSection === 'attendance' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-800">Attendance History</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left border border-gray-300">Date</th>
                          <th className="px-4 py-2 text-left border border-gray-300">In / Out</th>
                          <th className="px-4 py-2 text-left border border-gray-300">Status</th>
                          <th className="px-4 py-2 text-right border border-gray-300">Day Earning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceData.length > 0 ? (
                          attendanceData.map((day, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 border-b">
                              <td className="px-4 py-2 border border-gray-300">
                                {new Date(day.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 border border-gray-300">
                                {day.inOut?.in && day.inOut?.out
                                  ? `${day.inOut.in} - ${day.inOut.out}`
                                  : '--'}
                              </td>
                              <td className="px-4 py-2 border border-gray-300">{day.status}</td>
                              <td className="px-4 py-2 text-right border border-gray-300 font-semibold">
                                PKR {day.dailyEarning.toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-4 py-4 text-center text-gray-600">
                              No attendance records available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Salary Section */}
              {activeSection === 'salary' && salaryData && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-800">My Salary Details</h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 mb-1">Basic Earned</p>
                      <p className="text-2xl font-bold text-blue-600">
                        PKR {salaryData.basicEarned.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600 mb-1">OT Total</p>
                      <p className="text-2xl font-bold text-green-600">
                        PKR {salaryData.otTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-sm text-gray-600 mb-1">Deductions</p>
                      <p className="text-2xl font-bold text-red-600">
                        PKR {salaryData.deductionTotal.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">Net Payable</p>
                      <p className="text-2xl font-bold text-purple-600">
                        PKR {salaryData.netPayable.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-3">
                      This is how the employee sees their salary information in the portal.
                    </p>
                    <div className="bg-white p-4 rounded border border-gray-300 text-sm">
                      <p className="text-gray-700 mb-2">
                        You are viewing a read-only snapshot of {employee.firstName}'s portal experience.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border-t p-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            This is a read-only preview of the employee portal
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}