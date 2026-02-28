import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GhostModeView({ employee, onClose }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dashboardData,  setDashboardData]  = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [salaryData,     setSalaryData]     = useState(null);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    if (employee?._id) fetchGhostModeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?._id]);

  const fetchGhostModeData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Current pay-period dates (18th–17th cycle)
      const today = new Date();
      const year  = today.getFullYear();
      const month = today.getMonth();
      const day   = today.getDate();

      const periodStart = day >= 18
        ? new Date(year, month, 18)
        : new Date(year, month - 1, 18);
      const periodEnd = day >= 18
        ? new Date(year, month + 1, 17)
        : new Date(year, month, 17);

      // Cap toDate at today so we don't request future dates
      const toDate = periodEnd > today ? today : periodEnd;

      // FIX #1: backend GET /api/payroll/employee-breakdown/:empId expects
      // fromDate/toDate as dd/mm/yyyy query params (not ISO strings)
      const fmt = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
      };

      const response = await axios.get(
        `/api/payroll/employee-breakdown/${employee._id}`,
        {
          params: {
            fromDate: fmt(periodStart),
            toDate:   fmt(toDate),
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const breakdown = response.data.dailyBreakdown || [];
      // FIX #2: backend returns totals with baseSalary/totalOt/totalDeduction/netPayable
      // not basicEarned/otTotal/deductionTotal/netPayable
      const totals = response.data.totals || {};

      setAttendanceData(breakdown);
      setSalaryData(totals);

      setDashboardData({
        // FIX #3: was checking hoursPerDay > 0, backend field is hoursWorked
        daysWorked:   breakdown.filter(d => (d.hoursWorked || 0) > 0).length,
        totalEarning: totals.netPayable || 0,
        // FIX #4: was counting rows where otAmount exists — use actual sum instead
        otTotal:      totals.totalOt   || 0,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load employee data');
    } finally {
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
            <p className="text-blue-100 mt-1">Viewing as: {employee.firstName} {employee.lastName}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-blue-800 rounded-lg p-2 transition">
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <div className="bg-white border-b">
          <div className="flex gap-4 p-4">
            {['dashboard', 'attendance', 'salary'].map(section => (
              <button key={section} onClick={() => setActiveSection(section)}
                className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
                  activeSection === section ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                }`}>
                {section}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
              <p className="text-gray-600">Loading employee data...</p>
            </div>
          ) : (
            <>
              {/* Dashboard */}
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
                      <p className="text-3xl font-bold text-green-600">{dashboardData.daysWorked}</p>
                    </div>
                    <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-600 mb-2">OT Earned (PKR)</p>
                      {/* FIX #4: was showing a count of OT days — now shows actual OT amount */}
                      <p className="text-3xl font-bold text-purple-600">
                        PKR {dashboardData.otTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Employee Info</p>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Name:</span> {employee.firstName} {employee.lastName}</p>
                      <p><span className="font-medium">ID:</span> {employee.employeeNumber}</p>
                      <p><span className="font-medium">Department:</span> {employee.department}</p>
                      {/* FIX #5: display salary correctly for both types */}
                      {employee.salaryType === 'monthly' ? (
                        <p><span className="font-medium">Monthly Salary:</span> PKR {employee.monthlySalary?.toLocaleString()}</p>
                      ) : (
                        <p><span className="font-medium">Hourly Rate:</span> PKR {employee.hourlyRate}/hr</p>
                      )}
                      <p><span className="font-medium">Shift:</span> {employee.shift?.start} - {employee.shift?.end}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance */}
              {activeSection === 'attendance' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-800">Attendance History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left border border-gray-300">Date</th>
                          <th className="px-4 py-2 text-left border border-gray-300">Status</th>
                          <th className="px-4 py-2 text-left border border-gray-300">In / Out</th>
                          <th className="px-4 py-2 text-right border border-gray-300">Hours</th>
                          <th className="px-4 py-2 text-right border border-gray-300">Day Earning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceData.length > 0 ? (
                          attendanceData.map((day, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 border-b">
                              {/* FIX #6: backend returns day.date already formatted as dd/mm/yyyy */}
                              <td className="px-4 py-2 border border-gray-300">{day.date}</td>
                              <td className="px-4 py-2 border border-gray-300">{day.status}</td>
                              {/* FIX #6: backend returns inTime/outTime (not inOut.in / inOut.out) */}
                              <td className="px-4 py-2 border border-gray-300">
                                {day.inTime && day.outTime ? `${day.inTime} - ${day.outTime}` : '--'}
                              </td>
                              {/* FIX #3: hoursPerDay → hoursWorked */}
                              <td className="px-4 py-2 text-right border border-gray-300">
                                {(day.hoursWorked || 0).toFixed(2)}
                              </td>
                              {/* FIX #6: backend returns finalDayEarning (not dailyEarning) */}
                              <td className="px-4 py-2 text-right border border-gray-300 font-semibold">
                                PKR {(day.finalDayEarning || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-4 py-6 text-center text-gray-500">
                              No attendance records available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Salary */}
              {activeSection === 'salary' && salaryData && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-800">My Salary Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 mb-1">Basic Earned</p>
                      {/* FIX #2: field is baseSalary not basicEarned */}
                      <p className="text-2xl font-bold text-blue-600">
                        PKR {(salaryData.baseSalary || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600 mb-1">OT Total</p>
                      {/* FIX #2: field is totalOt not otTotal */}
                      <p className="text-2xl font-bold text-green-600">
                        PKR {(salaryData.totalOt || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-sm text-gray-600 mb-1">Deductions</p>
                      {/* FIX #2: field is totalDeduction not deductionTotal */}
                      <p className="text-2xl font-bold text-red-600">
                        PKR {(salaryData.totalDeduction || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-600 mb-1">Net Payable</p>
                      <p className="text-2xl font-bold text-purple-600">
                        PKR {(salaryData.netPayable || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500">
                      Read-only preview of {employee.firstName}'s portal experience.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 border-t p-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">This is a read-only preview of the employee portal</p>
          <button onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}