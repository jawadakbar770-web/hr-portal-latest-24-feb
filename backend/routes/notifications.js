import express from 'express';
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';
import LeaveRequest from '../models/LeaveRequest.js';           // import your LeaveRequest model
import CorrectionRequest from '../models/CorrectionRequest.js'; // import your CorrectionRequest model

const router = express.Router();

// Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);
    req.user = user;
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// **Get all notifications (existing)**
router.get('/', auth, async (req, res) => {
  try {
    res.json({
      notifications: [
        {
          id: '1',
          message: 'Your leave request has been approved',
          type: 'success',
          timestamp: new Date(),
          read: false
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ **New route: GET /api/notifications/pending**
router.get('/pending', auth, async (req, res) => {
  try {
    // Fetch leave & correction requests from DB
    const leaveRequests = await LeaveRequest.find().sort({ createdAt: -1 });
    const correctionRequests = await CorrectionRequest.find().sort({ createdAt: -1 });

    res.json({ leaveRequests, correctionRequests });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Mark notification as read (existing)**
router.patch('/:id/read', auth, async (req, res) => {
  try {
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;