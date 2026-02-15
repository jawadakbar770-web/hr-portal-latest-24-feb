const express = require('express');
const router = express.Router();
const AttendanceLog = require('../models/AttendanceLog');
const Employee = require('../models/Employee');

// Helper function to get company month
function getCompanyMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  let startDate, endDate;
  
  if (day >= 18) {
    startDate = new Date(year, month, 18);
    endDate = new Date(year, month + 1, 17);
  } else {
    startDate = new Date(year, month - 1, 18);
    endDate = new Date(year, month, 17);
  }
  
  return { startDate, endDate };
}

// Get payroll summary for all employees (current month)
router.get('/summary', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const start = fromDate ? new Date(fromDate) : getCompanyMonthRange().startDate;
    const end = toDate ? new Date(toDate) : new Date();
    
    const attendance = await AttendanceLog.find({
      date: { $gte: start, $lte: end },
      isDeleted: false
    }).populate('empId', 'firstName lastName email');
    
    const summaryMap = {};
    
    attendance.forEach(log => {
      if (!summaryMap[log.empId._id]) {
        summaryMap[log.empId._id] = {
          empId: log.empId._id,
          name: `${log.empId.firstName} ${log.empId.lastName}`,
          email: log.empId.email,
          basicEarned: 0,
          otTotal: 0,
          deductionTotal: 0,
          netPayable: 0,
          days: []
        };
      }
      
      summaryMap[log.empId._id].basicEarned += (log.financials.hoursPerDay * log.financials.hourlyRate) || 0;
      summaryMap[log.empId._id].otTotal += log.financials.otAmount || 0;
      summaryMap[log.empId._id].deductionTotal += log.financials.deduction || 0;
      summaryMap[log.empId._id].days.push(log);
    });
    
    const summary = Object.values(summaryMap).map(emp => ({
      ...emp,
      netPayable: emp.basicEarned + emp.otTotal - emp.deductionTotal
    }));
    
    res.json({ summary, dateRange: { from: start, to: end } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get detailed payroll for specific employee
router.get('/employee/:empId', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const start = fromDate ? new Date(fromDate) : getCompanyMonthRange().startDate;
    const end = toDate ? new Date(toDate) : new Date();
    
    const attendance = await AttendanceLog.find({
      empId: req.params.empId,
      date: { $gte: start, $lte: end },
      isDeleted: false
    });
    
    const dailyBreakdown = attendance.map(log => ({
      date: log.date,
      inOut: log.inOut,
      status: log.status,
      hoursPerDay: log.financials.hoursPerDay,
      basePay: log.financials.hoursPerDay * log.financials.hourlyRate,
      otAmount: log.financials.otAmount,
      deduction: log.financials.deduction,
      dailyEarning: log.financials.dailyEarning
    }));
    
    const totals = {
      basicEarned: dailyBreakdown.reduce((sum, d) => sum + d.basePay, 0),
      otTotal: dailyBreakdown.reduce((sum, d) => sum + d.otAmount, 0),
      deductionTotal: dailyBreakdown.reduce((sum, d) => sum + d.deduction, 0),
      netPayable: dailyBreakdown.reduce((sum, d) => sum + d.dailyEarning, 0)
    };
    
    res.json({
      dailyBreakdown,
      totals,
      dateRange: { from: start, to: end }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;