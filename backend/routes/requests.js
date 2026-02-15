const express = require('express');
const router = express.Router();
const LeaveRequest = require('../models/LeaveRequest');
const CorrectionRequest = require('../models/CorrectionRequest');
const AttendanceLog = require('../models/AttendanceLog');
const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');

// Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);
    req.user = user;
    req.role = decoded.role;
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Get leave balance for employee
function getLeaveBalance(joiningDate) {
  const now = new Date();
  const joinDate = new Date(joiningDate);
  const daysElapsed = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
  const canApply = daysElapsed >= 90;
  const daysUntilEligible = Math.max(0, 90 - daysElapsed);
  
  return { canApply, daysUntilEligible, holidayLeaves: 13, sickLeaves: 7 };
}

// Submit leave request
router.post('/leave/submit', auth, async (req, res) => {
  try {
    const { fromDate, toDate, leaveType, reason } = req.body;
    
    // Check eligibility
    const { canApply, daysUntilEligible } = getLeaveBalance(req.user.joiningDate);
    if (!canApply) {
      return res.status(400).json({
        message: `You can apply for leave after ${daysUntilEligible} days`,
        daysUntilEligible
      });
    }
    
    // Check for conflicts
    const existingRequest = await LeaveRequest.findOne({
      empId: req.user._id,
      status: 'Pending',
      fromDate: { $lte: new Date(toDate) },
      toDate: { $gte: new Date(fromDate) },
      isDeleted: false
    });
    
    if (existingRequest) {
      return res.status(400).json({
        message: 'You already have a pending leave request for this date. Wait for admin approval.'
      });
    }
    
    const leaveRequest = new LeaveRequest({
      empId: req.user._id,
      empNumber: req.user.employeeNumber,
      empName: `${req.user.firstName} ${req.user.lastName}`,
      leaveType,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      reason,
      status: 'Pending'
    });
    
    await leaveRequest.save();
    
    res.json({
      message: 'Leave request submitted successfully',
      requestId: leaveRequest._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit correction request
router.post('/correction/submit', auth, async (req, res) => {
  try {
    const { date, fromTime, toTime, reason } = req.body;
    
    // Check for conflicts
    const existingRequest = await CorrectionRequest.findOne({
      empId: req.user._id,
      date: new Date(date),
      status: 'Pending',
      isDeleted: false
    });
    
    if (existingRequest) {
      return res.status(400).json({
        message: 'You already have a pending correction request for this date.'
      });
    }
    
    const attendance = await AttendanceLog.findOne({
      empId: req.user._id,
      date: new Date(date)
    });
    
    const correctionRequest = new CorrectionRequest({
      empId: req.user._id,
      empNumber: req.user.employeeNumber,
      empName: `${req.user.firstName} ${req.user.lastName}`,
      date: new Date(date),
      correctionType: 'Both',
      originalInTime: attendance?.inOut?.in,
      correctedInTime: fromTime,
      originalOutTime: attendance?.inOut?.out,
      correctedOutTime: toTime,
      reason,
      status: 'Pending'
    });
    
    await correctionRequest.save();
    
    res.json({
      message: 'Correction request submitted successfully',
      requestId: correctionRequest._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get employee requests
router.get('/my-requests', auth, async (req, res) => {
  try {
    const { fromDate, toDate, status, type } = req.query;
    
    let query = {
      empId: req.user._id,
      isDeleted: false
    };
    
    if (fromDate && toDate) {
      query.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    
    let leaveRequests = [];
    let correctionRequests = [];
    
    if (!type || type === 'leave') {
      let leaveQuery = { ...query };
      if (status) leaveQuery.status = status;
      leaveRequests = await LeaveRequest.find(leaveQuery);
    }
    
    if (!type || type === 'correction') {
      let correctionQuery = { ...query };
      if (status) correctionQuery.status = status;
      correctionRequests = await CorrectionRequest.find(correctionQuery);
    }
    
    res.json({
      leaveRequests,
      correctionRequests,
      total: leaveRequests.length + correctionRequests.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all pending requests
router.get('/admin/pending', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 45);

    const leaveRequests = await LeaveRequest.find({
      status: 'Pending',
      isDeleted: false,
      createdAt: { $gte: defaultDate }
    }).populate('empId', 'firstName lastName employeeNumber');

    const correctionRequests = await CorrectionRequest.find({
      status: 'Pending',
      isDeleted: false,
      createdAt: { $gte: defaultDate }
    }).populate('empId', 'firstName lastName employeeNumber');

    res.json({
      leaveRequests,
      correctionRequests
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Approve leave request
router.patch('/leave/:requestId/approve', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const leaveRequest = await LeaveRequest.findById(req.params.requestId);
    if (!leaveRequest) return res.status(404).json({ message: 'Request not found' });
    
    leaveRequest.status = 'Approved';
    leaveRequest.approvedBy = req.userId;
    leaveRequest.approvedAt = new Date();
    await leaveRequest.save();
    
    // Update attendance records for each day
    const currentDate = new Date(leaveRequest.fromDate);
    while (currentDate <= leaveRequest.toDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      await AttendanceLog.findOneAndUpdate(
        {
          empId: leaveRequest.empId,
          date: new Date(dateStr)
        },
        {
          status: 'Leave',
          'financials.dailyEarning': calculateLeaveEarning(leaveRequest.empId)
        },
        { upsert: true }
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.json({ message: 'Leave request approved', leaveRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Reject leave request
router.patch('/leave/:requestId/reject', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { reason } = req.body;
    const leaveRequest = await LeaveRequest.findById(req.params.requestId);
    if (!leaveRequest) return res.status(404).json({ message: 'Request not found' });
    
    leaveRequest.status = 'Rejected';
    leaveRequest.rejectionReason = reason;
    await leaveRequest.save();
    
    res.json({ message: 'Leave request rejected', leaveRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Approve correction request
router.patch('/correction/:requestId/approve', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const correctionRequest = await CorrectionRequest.findById(req.params.requestId);
    if (!correctionRequest) return res.status(404).json({ message: 'Request not found' });
    
    correctionRequest.status = 'Approved';
    correctionRequest.approvedBy = req.userId;
    correctionRequest.approvedAt = new Date();
    await correctionRequest.save();
    
    // Update attendance record
    const attendance = await AttendanceLog.findOneAndUpdate(
      {
        empId: correctionRequest.empId,
        date: new Date(correctionRequest.date)
      },
      {
        'inOut.in': correctionRequest.correctedInTime,
        'inOut.out': correctionRequest.correctedOutTime
      },
      { new: true }
    );

    // Recalculate daily earning
    if (attendance) {
      const employee = await Employee.findById(correctionRequest.empId);
      const hoursPerDay = calculateHours(correctionRequest.correctedInTime, correctionRequest.correctedOutTime);
      attendance.financials.dailyEarning = (hoursPerDay * employee.hourlyRate) - (attendance.financials.deduction || 0);
      await attendance.save();
    }
    
    res.json({ message: 'Correction request approved', correctionRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Reject correction request
router.patch('/correction/:requestId/reject', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { reason } = req.body;
    const correctionRequest = await CorrectionRequest.findById(req.params.requestId);
    if (!correctionRequest) return res.status(404).json({ message: 'Request not found' });
    
    correctionRequest.status = 'Rejected';
    correctionRequest.rejectionReason = reason;
    await correctionRequest.save();
    
    res.json({ message: 'Correction request rejected', correctionRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function calculateHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let start = startHour * 60 + startMin;
  let end = endHour * 60 + endMin;
  
  if (end < start) end += 24 * 60;
  
  return (end - start) / 60;
}

async function calculateLeaveEarning(empId) {
  const employee = await Employee.findById(empId);
  const [startHour, startMin] = employee.shift.start.split(':').map(Number);
  const [endHour, endMin] = employee.shift.end.split(':').map(Number);
  const hoursPerDay = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
  return hoursPerDay * employee.hourlyRate;
}

module.exports = router;