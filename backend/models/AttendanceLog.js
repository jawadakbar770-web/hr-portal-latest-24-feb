const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  empId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  empNumber: String,
  empName: String,
  department: String,
  status: {
    type: String,
    enum: ['Present', 'Late', 'Leave', 'Absent'],
    required: true
  },
  inOut: {
    in: String,
    out: String
  },
  financials: {
    hourlyRate: Number,
    hoursPerDay: Number,
    deduction: {
      type: Number,
      default: 0
    },
    otMultiplier: {
      type: Number,
      enum: [1, 1.5, 2],
      default: 1
    },
    otHours: {
      type: Number,
      default: 0
    },
    otAmount: {
      type: Number,
      default: 0
    },
    dailyEarning: Number
  },
  metadata: {
    lastUpdatedBy: String,
    isDisputed: {
      type: Boolean,
      default: false
    },
    notes: String
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);