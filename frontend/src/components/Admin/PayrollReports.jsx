import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import { Calendar, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

// FIX #1: Date → dd/mm/yyyy for backend (backend expects this format)
const toBackendDate = (isoStr) => {
  if (!isoStr) return '';
  const [year, month, day] = isoStr.split('-');
  return `${day}/${month}/${year}`;
};

export default function PayrollReports() {
  // ── Refs for custom date pickers ─────────────────────────────────────────
  const attFromRef  = useRef(null);
  const attToRef    = useRef(null);
  const perfFromRef = useRef(null);
  const perfToRef   = useRef(null);
  const salFromRef  = useRef(null);
  const salToRef    = useRef(null);

  // ── Section 1: Attendance ─────────────────────────────────────────────────
  const [attendanceFromDate, setAttendanceFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceToDate,   setAttendanceToDate]   = useState(new Date().toISOString().split('T')[0]);
  const [attendanceChart,    setAttendanceChart]    = useState([]);
  const [attendanceList,     setAttendanceList]     = useState([]);
  const [attendanceLoading,  setAttendanceLoading]  = useState(false);
  const [attendanceFilter,   setAttendanceFilter]   = useState('all');

  // ── Section 2: Performance ────────────────────────────────────────────────
  const [performanceFromDate, setPerformanceFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [performanceToDate,   setPerformanceToDate]   = useState(new Date().toISOString().split('T')[0]);
  const [performanceData,     setPerformanceData]     = useState([]);
  const [performanceLoading,  setPerformanceLoading]  = useState(false);

  // ── Section 3: Salary ─────────────────────────────────────────────────────
  const [salaryFromDate,      setSalaryFromDate]      = useState(new Date().toISOString().split('T')[0]);
  const [salaryToDate,        setSalaryToDate]        = useState(new Date().toISOString().split('T')[0]);
  // FIX #2: correct field names matching backend grandTotals shape
  const [salarySummary,       setSalarySummary]       = useState([]);
  const [salaryTotals,        setSalaryTotals]        = useState({
    totalBaseSalary: 0, totalOT: 0, totalDeductions: 0, totalNetPayable: 0
  });
  const [salaryLoading,       setSalaryLoading]       = useState(false);
  const [salarySearch,        setSalarySearch]        = useState('');
  const [expandedEmployees,   setExpandedEmployees]   = useState({});

  const getToken = () => localStorage.getItem('token');

  // ── SECTION 1: Attendance ─────────────────────────────────────────────────
  const fetchAttendanceOverview = async () => {
    setAttendanceLoading(true);
    try {
      // FIX #1: convert ISO → dd/mm/yyyy for backend
      const response = await axios.post(
        '/api/payroll/attendance-overview',
        {
          fromDate:   toBackendDate(attendanceFromDate),
          toDate:     toBackendDate(attendanceToDate),
          filterType: attendanceFilter === 'all' ? undefined : attendanceFilter
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setAttendanceChart(response.data.chartData   || []);
      setAttendanceList(response.data.detailedList || []);
    } catch {
      toast.error('Failed to load attendance data');
    } finally {
      setAttendanceLoading(false);
    }
  };

  // ── SECTION 2: Performance ────────────────────────────────────────────────
  const fetchPerformanceOverview = async () => {
    setPerformanceLoading(true);
    try {
      // FIX #1: convert ISO → dd/mm/yyyy for backend
      const response = await axios.post(
        '/api/payroll/performance-overview',
        {
          fromDate: toBackendDate(performanceFromDate),
          toDate:   toBackendDate(performanceToDate)
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setPerformanceData(response.data.performance || []);
    } catch {
      toast.error('Failed to load performance data');
    } finally {
      setPerformanceLoading(false);
    }
  };

  // ── SECTION 3: Salary ─────────────────────────────────────────────────────
  // FIX #3: was importing from '../../routes/payrollRoutes' — that's a backend
  // file and cannot be imported in a React frontend. Use axios directly.
  const fetchSalarySummary = async () => {
    setSalaryLoading(true);
    try {
      // FIX #1: convert ISO → dd/mm/yyyy for backend
      const response = await axios.post(
        '/api/payroll/report',
        {
          fromDate: toBackendDate(salaryFromDate),
          toDate:   toBackendDate(salaryToDate),
          search:   salarySearch
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setSalarySummary(response.data.report       || []);
      // FIX #2: backend returns grandTotals with these exact keys
      setSalaryTotals(response.data.grandTotals   || {
        totalBaseSalary: 0, totalOT: 0, totalDeductions: 0, totalNetPayable: 0
      });
    } catch {
      toast.error('Failed to load salary data');
    } finally {
      setSalaryLoading(false);
    }
  };

  const toggleEmployeeExpansion = (empId) =>
    setExpandedEmployees(prev => ({ ...prev, [empId]: !prev[empId] }));

  // ── Preset helpers ────────────────────────────────────────────────────────
  const getMonthRange = () => {
    const today = new Date();
    const day   = today.getDate();
    const year  = today.getFullYear();
    const month = today.getMonth();
    const start = day >= 18 ? new Date(year, month, 18)     : new Date(year, month - 1, 18);
    const end   = day >= 18 ? new Date(year, month + 1, 17) : new Date(year, month, 17);
    return { start, end };
  };

  const getLastMonthRange = () => {
    const today = new Date();
    return {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 18),
      end:   new Date(today.getFullYear(), today.getMonth(), 17)
    };
  };

  const toISO = (d) => d.toISOString().split('T')[0];
  const today = () => toISO(new Date());

  const applyPreset = (preset, setFrom, setTo) => {
    if (preset === 'today')     { setFrom(today()); setTo(today()); }
    if (preset === 'month')     { const { start, end } = getMonthRange();     setFrom(toISO(start)); setTo(toISO(end)); }
    if (preset === 'lastMonth') { const { start, end } = getLastMonthRange(); setFrom(toISO(start)); setTo(toISO(end)); }
    if (preset === 'week')      {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay());
      setFrom(toISO(d)); setTo(today());
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  // FIX #4: was using wrong field names (emp.totals.basePay etc.) — backend
  // report rows use flat fields: baseSalary, totalDeduction, totalOt, netPayable
  const handleExport = async () => {
    try {
      const response = await axios.post(
        '/api/payroll/export',
        {
          fromDate: toBackendDate(salaryFromDate),
          toDate:   toBackendDate(salaryToDate),
          format:   'csv'
        },
        {
          headers:      { Authorization: `Bearer ${getToken()}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `payroll-${salaryFromDate}-${salaryToDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow sticky top-0 z-30">
        <div className="flex items-center justify-between p-4 md:p-6">
          <h1 className="text-2xl font-bold text-gray-800">Payroll Reports</h1>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-8">

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: ATTENDANCE
        ══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Section 1: Attendance & Discipline</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* From */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
              <div onClick={() => attFromRef.current?.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
                <span>{formatDateToDisplay(attendanceFromDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input ref={attFromRef} type="date" value={attendanceFromDate}
                onChange={e => setAttendanceFromDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none" />
            </div>
            {/* To */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
              <div onClick={() => attToRef.current?.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
                <span>{formatDateToDisplay(attendanceToDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input ref={attToRef} type="date" value={attendanceToDate} min={attendanceFromDate}
                onChange={e => setAttendanceToDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none" />
            </div>
            {/* Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter</label>
              <select value={attendanceFilter} onChange={e => setAttendanceFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="all">All</option>
                <option value="on-time">On-time</option>
                <option value="late">Late</option>
                <option value="leave">Leave</option>
                <option value="absent">Absent</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={fetchAttendanceOverview} disabled={attendanceLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {attendanceLoading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {['today','week','month'].map(p => (
              <button key={p} onClick={() => applyPreset(p, setAttendanceFromDate, setAttendanceToDate)}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm capitalize">
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {attendanceChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={attendanceChart} cx="50%" cy="50%" outerRadius={80}
                      labelLine={false} label={({ name, percentage }) => `${name}: ${percentage}%`}
                      dataKey="value">
                      {attendanceChart.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">No data — click Load</div>
              )}
            </div>
            <div className="space-y-2">
              {attendanceChart.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="font-medium text-gray-800">{item.name}</span>
                  <span className="ml-auto text-gray-600">{item.value}</span>
                  <span className="text-gray-500">({item.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>

          {attendanceList.length > 0 && (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtered List</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attendanceList.slice(0, 10).map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {/* FIX #5: item.date is already formatted by backend */}
                        <td className="px-4 py-2">{item.date}</td>
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            item.type === 'On-time' ? 'bg-green-100 text-green-800' :
                            item.type === 'Late'    ? 'bg-yellow-100 text-yellow-800' :
                            item.type === 'Leave'   ? 'bg-blue-100 text-blue-800' :
                                                      'bg-red-100 text-red-800'
                          }`}>{item.type}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {attendanceList.length > 10 && (
                <p className="text-sm text-gray-500 mt-2">Showing 10 of {attendanceList.length} records</p>
              )}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: PERFORMANCE
        ══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Section 2: Performance Overview</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
              <div onClick={() => perfFromRef.current?.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
                <span>{formatDateToDisplay(performanceFromDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input ref={perfFromRef} type="date" value={performanceFromDate}
                onChange={e => setPerformanceFromDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none" />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
              <div onClick={() => perfToRef.current?.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
                <span>{formatDateToDisplay(performanceToDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input ref={perfToRef} type="date" value={performanceToDate} min={performanceFromDate}
                onChange={e => setPerformanceToDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none" />
            </div>
            <div className="flex items-end">
              <button onClick={fetchPerformanceOverview} disabled={performanceLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {performanceLoading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {['today','week','month'].map(p => (
              <button key={p} onClick={() => applyPreset(p, setPerformanceFromDate, setPerformanceToDate)}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm capitalize">
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          {performanceData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-center">Score</th>
                    <th className="px-4 py-2 text-center">Present</th>
                    <th className="px-4 py-2 text-center">Absent</th>
                    <th className="px-4 py-2 text-center">Late</th>
                    <th className="px-4 py-2 text-center">Leave</th>
                    <th className="px-4 py-2 text-left">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* FIX #6: use correct field names from backend response */}
                  {performanceData.map(emp => (
                    <tr key={emp.empId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">
                        {emp.name}
                        <span className="text-xs text-gray-500 ml-1">({emp.empId})</span>
                      </td>
                      <td className="px-4 py-2 text-center font-bold text-blue-600">{emp.performanceScore}</td>
                      {/* FIX #6: backend returns presentDays/absentDays/lateDays/leaveDays */}
                      <td className="px-4 py-2 text-center text-green-600">{emp.presentDays}</td>
                      <td className="px-4 py-2 text-center text-red-600">{emp.absentDays}</td>
                      <td className="px-4 py-2 text-center text-yellow-600">{emp.lateDays}</td>
                      <td className="px-4 py-2 text-center text-blue-600">{emp.leaveDays}</td>
                      <td className="px-4 py-2">
                        {/* FIX #6: backend returns 'rating' not 'status' */}
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          emp.rating === 'Excellent' ? 'bg-green-100 text-green-800' :
                          emp.rating === 'Good'      ? 'bg-blue-100 text-blue-800' :
                          emp.rating === 'Average'   ? 'bg-yellow-100 text-yellow-800' :
                                                       'bg-red-100 text-red-800'
                        }`}>{emp.rating}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">No data — select a date range and click Load</div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: SALARY
        ══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Section 3: Salary & Payroll</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
              <div onClick={() => salFromRef.current?.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
                <span>{formatDateToDisplay(salaryFromDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input ref={salFromRef} type="date" value={salaryFromDate}
                onChange={e => setSalaryFromDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none" />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
              <div onClick={() => salToRef.current?.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white">
                <span>{formatDateToDisplay(salaryToDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input ref={salToRef} type="date" value={salaryToDate} min={salaryFromDate}
                onChange={e => setSalaryToDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none" />
            </div>
            <div className="flex items-end">
              <button onClick={fetchSalarySummary} disabled={salaryLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {salaryLoading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {['today','month','lastMonth'].map(p => (
              <button key={p} onClick={() => applyPreset(p, setSalaryFromDate, setSalaryToDate)}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                {p === 'today' ? 'Today' : p === 'month' ? 'This Month' : 'Last Month'}
              </button>
            ))}
          </div>

          {/* FIX #2: correct grandTotals field names from backend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600">Total Base Salary</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                PKR {(salaryTotals.totalBaseSalary || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600">Total OT</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                PKR {(salaryTotals.totalOT || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm text-gray-600">Total Deductions</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                PKR {(salaryTotals.totalDeductions || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600">Total Net Payable</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                PKR {(salaryTotals.totalNetPayable || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 flex gap-3">
            <input type="text" value={salarySearch} onChange={e => setSalarySearch(e.target.value)}
              placeholder="Search by name or employee number"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            <button onClick={fetchSalarySummary} disabled={salaryLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {salaryLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Salary Table */}
          {salarySummary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-right">Base Salary</th>
                    <th className="px-4 py-2 text-right">Deductions</th>
                    <th className="px-4 py-2 text-right">OT</th>
                    <th className="px-4 py-2 text-right">Net Payable</th>
                    <th className="px-4 py-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* FIX #4: use correct flat field names from calcEmployeeTotals */}
                  {salarySummary.map(emp => (
                    <React.Fragment key={emp.empId}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">
                          {emp.name} <span className="text-xs text-gray-500">({emp.empNumber})</span>
                        </td>
                        <td className="px-4 py-2 text-right">PKR {emp.baseSalary.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-red-600">PKR {emp.totalDeduction.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-green-600">PKR {emp.totalOt.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-blue-600">PKR {emp.netPayable.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => toggleEmployeeExpansion(emp.empId)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            {expandedEmployees[emp.empId] ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>

                      {expandedEmployees[emp.empId] && (
                        <tr>
                          <td colSpan={6} className="bg-blue-50 px-4 py-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-white">
                                    <th className="px-3 py-2 text-left border">Date</th>
                                    <th className="px-3 py-2 text-left border">Status</th>
                                    <th className="px-3 py-2 text-left border">In</th>
                                    <th className="px-3 py-2 text-left border">Out</th>
                                    <th className="px-3 py-2 text-right border">Hours</th>
                                    <th className="px-3 py-2 text-right border">Base</th>
                                    <th className="px-3 py-2 text-right border">Deduction</th>
                                    <th className="px-3 py-2 text-right border">OT</th>
                                    <th className="px-3 py-2 text-right border">Final</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* FIX #7: backend returns dailyAttendance with hoursWorked
                                      (not hoursPerDay), finalDayEarning (not finalEarning) */}
                                  {emp.dailyAttendance.map((day, i) => (
                                    <tr key={i} className="bg-white">
                                      <td className="px-3 py-2 border">{day.date}</td>
                                      <td className="px-3 py-2 border">{day.status}</td>
                                      <td className="px-3 py-2 border">{day.inTime}</td>
                                      <td className="px-3 py-2 border">{day.outTime}</td>
                                      <td className="px-3 py-2 border text-right">{day.hoursWorked.toFixed(2)}</td>
                                      <td className="px-3 py-2 border text-right">PKR {day.basePay.toFixed(2)}</td>
                                      <td className="px-3 py-2 border text-right text-red-600">PKR {day.deduction.toFixed(2)}</td>
                                      <td className="px-3 py-2 border text-right text-green-600">PKR {day.otAmount.toFixed(2)}</td>
                                      <td className="px-3 py-2 border text-right font-semibold">PKR {day.finalDayEarning.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">No data — select a date range and click Load</div>
          )}
        </section>
      </div>
    </div>
  );
}