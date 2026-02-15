import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ChevronUp, ChevronDown, Save, Upload, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ManualAttendance() {
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [employees, setEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      generateAttendanceGrid();
    }
  }, [fromDate, toDate, employees]);

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

  const generateAttendanceGrid = () => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const records = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      employees.forEach(emp => {
        records.push({
          id: `${emp._id}-${d.toISOString().split('T')[0]}`,
          date: new Date(d).toISOString().split('T')[0],
          empId: emp._id,
          empName: `${emp.firstName} ${emp.lastName}`,
          empNumber: emp.employeeNumber,
          department: emp.department,
          shift: emp.shift,
          hourlyRate: emp.hourlyRate,
          status: 'Absent',
          inTime: '',
          outTime: '',
          otHours: 0,
          otRate: 1,
          deduction: 0,
          dailyEarning: 0,
          saved: false
        });
      });
    }

    // Sort by date ascending
    records.sort((a, b) => new Date(a.date) - new Date(b.date));
    setAttendanceData(records);
  };

  const updateAttendanceRecord = (id, field, value) => {
    setAttendanceData(prev => {
      const updated = prev.map(record => {
        if (record.id === id) {
          const updatedRecord = { ...record, [field]: value };
          
          // Calculate daily earning
          if (['status', 'inTime', 'outTime', 'otHours', 'otRate', 'deduction'].includes(field)) {
            updatedRecord.dailyEarning = calculateDailyEarning(updatedRecord);
          }
          
          return updatedRecord;
        }
        return record;
      });
      return updated;
    });
  };

  const calculateDailyEarning = (record) => {
    if (record.status === 'Absent') return 0;
    
    if (record.status === 'Leave') {
      const [startHour, startMin] = record.shift.start.split(':').map(Number);
      const [endHour, endMin] = record.shift.end.split(':').map(Number);
      const hoursPerDay = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
      return hoursPerDay * record.hourlyRate;
    }

    // Present or Late
    if (record.inTime && record.outTime) {
      const [inHour, inMin] = record.inTime.split(':').map(Number);
      const [outHour, outMin] = record.outTime.split(':').map(Number);
      const hoursPerDay = ((outHour * 60 + outMin) - (inHour * 60 + inMin)) / 60;
      const basePay = hoursPerDay * record.hourlyRate;
      const otPay = record.otHours * record.hourlyRate * record.otRate;
      const totalEarning = basePay + otPay - record.deduction;
      return Math.max(0, totalEarning);
    }

    return 0;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Group by date for batch saving
      const groupedByDate = {};
      attendanceData.forEach(record => {
        if (!groupedByDate[record.date]) {
          groupedByDate[record.date] = [];
        }
        groupedByDate[record.date].push({
          empId: record.empId,
          status: record.status,
          inOut: {
            in: record.inTime || null,
            out: record.outTime || null
          },
          financials: {
            deduction: record.deduction,
            otMultiplier: record.otRate,
            otHours: record.otHours
          },
          metadata: { notes: '' }
        });
      });

      // Save each date
      for (const [date, records] of Object.entries(groupedByDate)) {
        await axios.post(
          '/api/attendance/save-batch',
          { attendanceData: records, date },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      toast.success('Attendance saved successfully');
      generateAttendanceGrid();
    } catch (error) {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllPresent = () => {
    setAttendanceData(prev => prev.map(record => ({
      ...record,
      status: 'Present',
      inTime: record.shift.start,
      outTime: record.shift.end
    })));
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manual Attendance</h1>
        <div className="flex gap-2">
          <button
            onClick={handleMarkAllPresent}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
          >
            Mark All Present
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="flex items-end">
            <button
              onClick={() => {}}
              className="flex items-center gap-2 w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm"
            >
              <Upload size={18} />
              Import CSV
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">In Time</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Out Time</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">OT Hours</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">OT Rate</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Deduction</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Day Earning</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {attendanceData.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{record.date}</td>
                  <td className="px-4 py-3">{record.empName}</td>
                  <td className="px-4 py-3 text-gray-600">{record.empNumber}</td>
                  <td className="px-4 py-3">
                    <select
                      value={record.status}
                      onChange={(e) => updateAttendanceRecord(record.id, 'status', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Absent">Absent</option>
                      <option value="Present">Present</option>
                      <option value="Late">Late</option>
                      <option value="Leave">Leave</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {record.status !== 'Leave' && record.status !== 'Absent' ? (
                      <input
                        type="time"
                        value={record.inTime}
                        onChange={(e) => updateAttendanceRecord(record.id, 'inTime', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm w-24 focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-400">--:--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.status !== 'Leave' && record.status !== 'Absent' ? (
                      <input
                        type="time"
                        value={record.outTime}
                        onChange={(e) => updateAttendanceRecord(record.id, 'outTime', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm w-24 focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-400">--:--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.status !== 'Leave' && record.status !== 'Absent' ? (
                      <input
                        type="number"
                        value={record.otHours}
                        onChange={(e) => updateAttendanceRecord(record.id, 'otHours', parseFloat(e.target.value) || 0)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm w-16 focus:ring-2 focus:ring-blue-500"
                        step="0.5"
                        min="0"
                      />
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.status !== 'Leave' && record.status !== 'Absent' ? (
                      <select
                        value={record.otRate}
                        onChange={(e) => updateAttendanceRecord(record.id, 'otRate', parseFloat(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm w-20 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={1}>1x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                      </select>
                    ) : (
                      <span className="text-gray-400">1x</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.status !== 'Absent' ? (
                      <input
                        type="number"
                        value={record.deduction}
                        onChange={(e) => updateAttendanceRecord(record.id, 'deduction', parseFloat(e.target.value) || 0)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm w-20 focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-blue-600">
                    PKR {record.dailyEarning.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateAttendanceRecord(record.id, 'saved', true)}
                      className="text-green-500 hover:text-green-700"
                    >
                      <Check size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}