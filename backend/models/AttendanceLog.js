const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  // Primary Keys
  date: {
    type: Date,
    required: true,
    index: true
  },
  empId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  
  // Employee Details (Snapshot at time of record)
  empNumber: {
    type: String,
    required: true,
    index: true
  },
  empName: String,
  department: String,

  // Status
  status: {
    type: String,
    enum: ['Present', 'Late', 'Leave', 'Absent'],
    required: true,
    default: 'Absent'
  },

  // Time (24-hour format HH:mm)
  inOut: {
    in: {
      type: String,
      default: null
    },
    out: {
      type: String,
      default: null
    }
  },

  // Snapshot of Employee Profile (Frozen at time of record)
  shift: {
    start: {
      type: String,
      required: true,
      default: '09:00'
    },
    end: {
      type: String,
      required: true,
      default: '18:00'
    }
  },
  hourlyRate: {
    type: Number,
    required: true
  },

  // Financials
  financials: {
    hoursPerDay: {
      type: Number,
      default: 0
    },
    basePay: {
      type: Number,
      default: 0
    },
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
    finalDayEarning: {
      type: Number,
      default: 0
    }
  },

  // Manual Override Protection
  manualOverride: {
    type: Boolean,
    default: false
  },

  // CSV Processing
  csvSource: {
    importedAt: Date,
    csvBatch: String
  },

  // Metadata
  metadata: {
    lastUpdatedBy: mongoose.Schema.Types.ObjectId,
    isDisputed: {
      type: Boolean,
      default: false
    },
    notes: String,
    source: {
      type: String,
      enum: ['manual', 'csv', 'system'],
      default: 'manual'
    }
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

// Unique index to prevent duplicates: employee + date
attendanceLogSchema.index({ empId: 1, date: 1 }, { unique: true });

// Calculate daily earning
attendanceLogSchema.methods.calculateDayEarning = function() {
  const { hoursPerDay, basePay, otAmount, deduction } = this.financials;
  
  if (this.status === 'Absent' || (!this.inOut.in && !this.inOut.out)) {
    this.financials.finalDayEarning = 0;
    return 0;
  }

  if (this.status === 'Leave') {
    // Full day pay for leave
    this.financials.finalDayEarning = basePay || (hoursPerDay * this.hourlyRate);
    return this.financials.finalDayEarning;
  }

  if (this.inOut.in && !this.inOut.out) {
    // Only in time: 50% of base pay
    this.financials.finalDayEarning = (basePay * 0.5) + otAmount - deduction;
  } else if (!this.inOut.in && this.inOut.out) {
    // Only out time: 50% of base pay
    this.financials.finalDayEarning = (basePay * 0.5) + otAmount - deduction;
  } else if (this.inOut.in && this.inOut.out) {
    // Full day
    this.financials.finalDayEarning = basePay + otAmount - deduction;
  }

  // Never negative
  this.financials.finalDayEarning = Math.max(0, this.financials.finalDayEarning);
  
  return this.financials.finalDayEarning;
};

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);