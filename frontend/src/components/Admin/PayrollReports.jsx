import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { Calendar, Download, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PayrollReports() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState([]);
  const [performanceSummary, setPerformanceSummary] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [selectedAttendanceFilter, setSelectedAttendanceFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  useEffect(() => {
    fetchReports();
  }, [fromDate, toDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const [attendanceRes, payrollRes] = await Promise.all([
        axios.get('/api/attendance/range', {
          params: { fromDate, toDate },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/payroll/summary', {
          params: { fromDate, toDate },
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Process attendance data
      const attendanceData = attendanceRes.data.attendance;
      const statusCount = {
        'On-time': 0,
        'Late': 0,
        'Leave': 0,
        'Absent': 0
      };

      attendanceData.forEach(log => {
        const inTime = log.inOut?.in;
        const shiftStart = log.shift?.start;
        
        let status = log.status;
        if (status === 'Present' && inTime && shiftStart) {
          const [inH, inM] = inTime.split(':').map(Number);
          const [shiftH, shiftM] = shiftStart.split(':').map(Number);
          status = (inH * 60 + inM) <= (shiftH * 60 + shiftM) ? 'On-time' : 'Late';
        }

        if (statusCount[status] !== undefined) {
          statusCount[status]++;
        }
      });

      const chartData = Object.entries(statusCount).map(([name, value]) => ({
        name,
        value,
        percentage: ((value / Object.values(statusCount).reduce((a, b) => a + b, 1)) * 100).toFixed(1)
      }));

      setAttendanceSummary(chartData);
      setPayrollSummary(payrollRes.data.summary || []);
      
      // Process performance data
      const performanceData = payrollRes.data.summary.map(emp => ({
        name: emp.name.split(' ')[0],
        salary: emp.netPayable,
        ot: emp.otTotal,
        deductions: emp.deductionTotal
      }));
      setPerformanceSummary(performanceData);

      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch reports');
      setLoading(false);
    }
  };

  const fetchEmployeeDetails = async (empId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/payroll/employee/${empId}`, {
        params: { fromDate, toDate },
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployeeDetails(response.data);
      setSelectedEmployee(empId);
    } catch (error) {
      toast.error('Failed to fetch employee details');
    }
  };

  const handleQuickPreset = (preset) => {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'week':
        start = new Date(today);
        start.setDate(start.getDate() - today.getDay());
        end = new Date(today);
        break;
      case 'month':
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        if (day >= 18) {
          start = new Date(year, month, 18);
          end = new Date(year, month + 1, 17);
        } else {
          start = new Date(year, month - 1, 18);
          end = new Date(year, month, 17);
        }
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 18);
        end = new Date(today.getFullYear(), today.getMonth(), 17);
        break;
      default:
        return;
    }

    setFromDate(start.toISOString().split('T')[0]);
    setToDate(end.toISOString().split('T')[0]);
  };

  const handleDownloadReport = () => {
    // Implement Excel export functionality
    toast.success('Report download feature coming soon');
  };

  const getTotalPayroll = () => {
    return payrollSummary.reduce((sum, emp) => sum + emp.netPayable, 0);
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Payroll Reports</h1>
        <button
          onClick={handleDownloadReport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Download size={18} />
          Download Report
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">Total Payroll</p>
          <p className="text-3xl font-bold text-gray-800">PKR {getTotalPayroll().toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-2">{payrollSummary.length} employees</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">Avg Deductions</p>
          <p className="text-3xl font-bold text-red-600">
            PKR {(payrollSummary.reduce((sum, emp) => sum + emp.deductionTotal, 0) / payrollSummary.length).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm mb-2">Total OT</p>
          <p className="text-3xl font-bold text-green-600">
            PKR {payrollSummary.reduce((sum, emp) => sum + emp.otTotal, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 px-4 py-3 font-medium border-b-2 transition text-sm md:text-base ${
              activeTab === 'attendance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 px-4 py-3 font-medium border-b-2 transition text-sm md:text-base ${
              activeTab === 'performance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setActiveTab('salary')}
            className={`flex-1 px-4 py-3 font-medium border-b-2 transition text-sm md:text-base ${
              activeTab === 'salary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            Salary
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <button
              onClick={() => handleQuickPreset('today')}
              className="px-3 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
            >
              Today
            </button>
            <button
              onClick={() => handleQuickPreset('week')}
              className="px-3 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
            >
              Week
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => handleQuickPreset('month')}
              className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Current Month
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading reports...</div>
      ) : (
        <>
          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Attendance Overview</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={attendanceSummary}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {attendanceSummary.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-3">
                  {attendanceSummary.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition"
                      onClick={() => setSelectedAttendanceFilter(item.name.toLowerCase())}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium text-gray-800">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{item.value}</p>
                        <p className="text-xs text-gray-600">{item.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Performance Overview</h2>

              {performanceSummary.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={performanceSummary}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `PKR ${value.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="salary" fill="#10b981" name="Net Salary" />
                    <Bar dataKey="ot" fill="#f59e0b" name="Overtime" />
                    <Bar dataKey="deductions" fill="#ef4444" name="Deductions" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-600">No data available</p>
              )}
            </div>
          )}

          {/* Salary Tab */}
          {activeTab === 'salary' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Payroll Summary</h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Name</th>
                      <th className="px-4 py-3 text-right font-semibold">Basic Earned</th>
                      <th className="px-4 py-3 text-right font-semibold">OT Total</th>
                      <th className="px-4 py-3 text-right font-semibold">Deductions</th>
                      <th className="px-4 py-3 text-right font-semibold">Net Payable</th>
                      <th className="px-4 py-3 text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payrollSummary.map((emp) => (
                      <tr key={emp.empId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          PKR {emp.basicEarned.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          PKR {emp.otTotal.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          PKR {emp.deductionTotal.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-600">
                          PKR {emp.netPayable.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => fetchEmployeeDetails(emp.empId)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Employee Details Modal */}
              {selectedEmployee && employeeDetails && (
                <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Detailed Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-100 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Date</th>
                          <th className="px-4 py-3 text-left font-semibold">In / Out</th>
                          <th className="px-4 py-3 text-left font-semibold">Status</th>
                          <th className="px-4 py-3 text-right font-semibold">Day Earning</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {employeeDetails.dailyBreakdown.map((day, idx) => (
                          <tr key={idx} className="hover:bg-blue-100">
                            <td className="px-4 py-3">
                              {new Date(day.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              {day.inOut?.in && day.inOut?.out
                                ? `${day.inOut.in} - ${day.inOut.out}`
                                : '--'
                              }
                            </td>
                            <td className="px-4 py-3">{day.status}</td>
                            <td className="px-4 py-3 text-right font-semibold">
                              PKR {day.dailyEarning.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-blue-100 border-t-2">
                        <tr>
                          <td colSpan="3" className="px-4 py-3 font-bold">Total</td>
                          <td className="px-4 py-3 text-right font-bold">
                            PKR {employeeDetails.totals.netPayable.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <button
                    onClick={() => setSelectedEmployee(null)}
                    className="mt-4 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
                  >
                    Close Details
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}