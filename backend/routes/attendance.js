const express = require('express');
const router = express.Router();
const AttendanceLog = require('../models/AttendanceLog');
const Employee = require('../models/Employee');

// Middleware
const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Employee.findById(decoded.id);
    if (admin.department !== 'Manager') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Helper function to calculate hours
function calculateHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let start = startHour * 60 + startMin;
  let end = endHour * 60 + endMin;
  
  if (end < start) end += 24 * 60;
  
  return (end - start) / 60;
}

// Save attendance for multiple employees
router.post('/save-batch', adminAuth, async (req, res) => {
  try {
    const { attendanceData, date } = req.body;
    const results = [];
    
    for (const record of attendanceData) {
      const employee = await Employee.findById(record.empId);
      if (!employee) continue;
      
      let dailyEarning = 0;
      let hoursPerDay = 0;
      
      if (record.status === 'Leave') {
        hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
        dailyEarning = hoursPerDay * employee.hourlyRate;
      } else if (record.status === 'Absent') {
        dailyEarning = 0;
      } else if (record.status === 'Present' || record.status === 'Late') {
        hoursPerDay = calculateHours(record.inOut.in, record.inOut.out);
        let basePay = hoursPerDay * employee.hourlyRate;
        let otPay = (record.financials.otHours || 0) * employee.hourlyRate * (record.financials.otMultiplier || 1);
        dailyEarning = basePay + otPay - (record.financials.deduction || 0);
      }
      
      const attendance = new AttendanceLog({
        date: new Date(date),
        empId: employee._id,
        empNumber: employee.employeeNumber,
        empName: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        status: record.status,
        inOut: record.inOut,
        financials: {
          hourlyRate: employee.hourlyRate,
          hoursPerDay,
          deduction: record.financials.deduction || 0,
          otMultiplier: record.financials.otMultiplier || 1,
          otHours: record.financials.otHours || 0,
          otAmount: (record.financials.otHours || 0) * employee.hourlyRate * (record.financials.otMultiplier || 1),
          dailyEarning
        },
        metadata: {
          lastUpdatedBy: req.admin._id,
          notes: record.metadata?.notes || ''
        }
      });
      
      await attendance.save();
      results.push(attendance);
    }
    
    res.json({
      message: 'Attendance saved successfully',
      savedCount: results.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get attendance for date range
router.get('/range', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const attendance = await AttendanceLog.find({
      date: {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      },
      isDeleted: false
    }).populate('empId', 'firstName lastName email');
    
    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;