// models/Employee.js

import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const employeeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  employeeNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName:  { type: String, required: true },
  lastName:   { type: String, required: true },

  department: {
    type: String,
    enum: ['IT', 'Customer Support', 'Manager', 'Marketing', 'HR', 'Finance'],
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'employee'],
    default: 'employee',
    index: true
  },

  joiningDate: { type: Date, required: true },

  shift: {
    start: {
      type: String,
      required: true,
      default: '09:00',
      validate: {
        validator: v => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
        message: 'Shift time must be HH:mm (24-hour)'
      }
    },
    end: {
      type: String,
      required: true,
      default: '18:00',
      validate: {
        validator: v => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
        message: 'Shift time must be HH:mm (24-hour)'
      }
    }
  },

  /**
   * Salary configuration.
   *
   * salaryType:
   *   'hourly'  — paid per hour worked (hourlyRate × hoursWorked)
   *   'monthly' — fixed monthly salary; deductions/OT still applied on top
   *
   * hourlyRate:
   *   Always required. For monthly employees it is derived automatically:
   *     hourlyRate = monthlySalary / (workingDaysPerMonth × scheduledHoursPerDay)
   *   but we also accept an explicit override.
   *
   * monthlySalary:
   *   Required when salaryType === 'monthly'.
   *   Used in PayrollRecord to compute gross salary for the period.
   */
  salaryType: {
    type: String,
    enum: ['hourly', 'monthly'],
    default: 'hourly',
    required: true
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  monthlySalary: {
    type: Number,
    min: 0,
    default: null   // null means use hourlyRate-based calculation
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Frozen'],
    default: 'Inactive',
    index: true
  },
  isArchived: { type: Boolean, default: false },

  password:          String,
  tempPassword:      String,
  inviteToken:       String,
  inviteTokenExpires: Date,

  bank: {
    bankName:      String,
    accountName:   String,
    accountNumber: String
  },

  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// ─── Hooks ────────────────────────────────────────────────────────────────────

employeeSchema.pre('save', async function (next) {
  // Hash passwords only when modified
  if (!this.isModified('password') && !this.isModified('tempPassword')) return next();

  try {
    if (this.isModified('password') && this.password) {
      const salt = await bcryptjs.genSalt(10);
      this.password = await bcryptjs.hash(this.password, salt);
    }
    if (this.isModified('tempPassword') && this.tempPassword) {
      const salt = await bcryptjs.genSalt(10);
      this.tempPassword = await bcryptjs.hash(this.tempPassword, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Instance methods ─────────────────────────────────────────────────────────

employeeSchema.methods.comparePassword = async function (entered) {
  return bcryptjs.compare(entered, this.password);
};

employeeSchema.methods.isLeaveEligible = function () {
  const days = Math.floor((Date.now() - new Date(this.joiningDate)) / 86_400_000);
  return days >= 90;
};

employeeSchema.methods.getDaysUntilLeaveEligible = function () {
  const days = Math.floor((Date.now() - new Date(this.joiningDate)) / 86_400_000);
  return Math.max(0, 90 - days);
};

/**
 * Compute effective hourly rate for payroll calculations.
 * For monthly employees: monthlySalary / (avgWorkingDays × shiftHours).
 * Falls back to the stored hourlyRate if monthlySalary is not set.
 *
 * @param {number} workingDaysInPeriod  – actual working days in the payroll period
 * @param {number} scheduledHoursPerDay – hours per scheduled shift (default 8)
 */
employeeSchema.methods.getEffectiveHourlyRate = function (
  workingDaysInPeriod = 26,
  scheduledHoursPerDay = 8
) {
  if (this.salaryType === 'monthly' && this.monthlySalary) {
    return this.monthlySalary / (workingDaysInPeriod * scheduledHoursPerDay);
  }
  return this.hourlyRate;
};

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;