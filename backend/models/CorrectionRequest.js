const mongoose = require('mongoose');

const correctionRequestSchema = new mongoose.Schema({
  empId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  empNumber: String,
  empName: String,
  date: {
    type: Date,
    required: true
  },
  correctionType: {
    type: String,
    enum: ['In-Time', 'Out-Time', 'Both'],
    required: true
  },
  originalInTime: String,
  correctedInTime: String,
  originalOutTime: String,
  correctedOutTime: String,
  reason: String,
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approvedBy: mongoose.Schema.Types.ObjectId,
  approvedAt: Date,
  rejectionReason: String,
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

module.exports = mongoose.model('CorrectionRequest', correctionRequestSchema);