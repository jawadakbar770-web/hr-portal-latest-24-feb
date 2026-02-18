const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    enum: ['IT', 'Customer Support', 'Manager', 'Marketing', 'HR', 'Finance'],
    required: true
  },
  joiningDate: {
    type: Date,
    required: true
  },

  // Shift Times (24-hour format HH:mm)
  shift: {
    start: {
      type: String,
      required: true,
      default: '09:00',
      validate: {
        validator: function(v) {
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Shift time must be in HH:mm format (24-hour)'
      }
    },
    end: {
      type: String,
      required: true,
      default: '18:00',
      validate: {
        validator: function(v) {
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Shift time must be in HH:mm format (24-hour)'
      }
    }
  },

  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Frozen'],
    default: 'Inactive'
  },

  isArchived: {
    type: Boolean,
    default: false
  },

  password: String,
  tempPassword: String,
  inviteToken: String,
  inviteTokenExpires: Date,

  bank: {
    bankName: String,
    accountName: String,
    accountNumber: String
  },

  securityQuestions: [{
    question: String,
    answer: String
  }],

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

// Hash password before saving
employeeSchema.pre('save', async function(next) {
  if (!this.isModified('password') && !this.isModified('tempPassword')) return next();
  
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  if (this.tempPassword) {
    const salt = await bcrypt.genSalt(10);
    this.tempPassword = await bcrypt.hash(this.tempPassword, salt);
  }
  
  next();
});

employeeSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Employee', employeeSchema);