const express = require('express');
const router = express.Router();
const LeaveRequest = require('../models/LeaveRequest');
const CorrectionRequest = require('../models/CorrectionRequest');
const { auth } = require('../middleware/auth');

// Get all pending requests for admin
router.get('/pending', auth, async (req, res) => {
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
      correctionRequests,
      total: leaveRequests.length + correctionRequests.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Clear notifications (soft delete)
router.patch('/clear', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { filters } = req.body;
    const statuses = filters?.statuses || ['Approved', 'Pending', 'Rejected'];

    await LeaveRequest.updateMany(
      { status: { $in: statuses }, isDeleted: false },
      { isDeleted: true }
    );

    await CorrectionRequest.updateMany(
      { status: { $in: statuses }, isDeleted: false },
      { isDeleted: true }
    );

    res.json({ message: 'Notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;