const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { v4: uuidv4 } = require('uuid');
const { generateTempPassword } = require('../utils/helpers');

// Middleware to verify admin
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

// Get all employees (with filtering and search)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { search, status, department, sort } = req.query;
    let query = { isDeleted: false, isArchived: false };
    
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { employeeNumber: new RegExp(search, 'i') }
      ];
    }
    
    if (status) query.status = status;
    if (department) query.department = department;
    
    let employees = await Employee.find(query).select('-password -tempPassword');
    
    if (sort === 'name') {
      employees.sort((a, b) => a.firstName.localeCompare(b.firstName));
    } else if (sort === 'date') {
      employees.sort((a, b) => new Date(b.joiningDate) - new Date(a.joiningDate));
    } else if (sort === 'rate') {
      employees.sort((a, b) => b.hourlyRate - a.hourlyRate);
    }
    
    res.json({ 
      total: employees.length, 
      employees 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single employee
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select('-password -tempPassword');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new employee (with invite)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { email, employeeNumber, firstName, lastName, joiningDate, department, shift, hourlyRate, bank } = req.body;
    
    // Check if employee exists
    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    
    const inviteToken = uuidv4();
    const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const employee = new Employee({
      email,
      employeeNumber,
      firstName,
      lastName,
      joiningDate,
      department,
      shift,
      hourlyRate,
      bank,
      status: 'Inactive',
      inviteToken,
      inviteTokenExpires
    });
    
    await employee.save();
    
    const joinLink = `${process.env.FRONTEND_URL}/join/${inviteToken}`;
    
    res.status(201).json({
      message: 'Employee created successfully',
      employee: {
        id: employee._id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        status: employee.status
      },
      joinLink
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update employee
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { firstName, lastName, shift, hourlyRate, department, bank } = req.body;
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        firstName,
        lastName,
        shift,
        hourlyRate,
        department,
        bank
      },
      { new: true }
    ).select('-password -tempPassword');
    
    res.json({
      message: 'Employee updated',
      employee
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Freeze/Unfreeze employee
router.patch('/:id/freeze', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    employee.status = employee.status === 'Frozen' ? 'Active' : 'Frozen';
    await employee.save();
    
    res.json({
      message: `Employee ${employee.status === 'Frozen' ? 'frozen' : 'unfrozen'}`,
      status: employee.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Archive employee (soft delete)
router.patch('/:id/archive', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isArchived: true, status: 'Inactive' },
      { new: true }
    );
    
    res.json({
      message: 'Employee archived',
      employee
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resend invite
router.post('/:id/resend-invite', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    const inviteToken = uuidv4();
    const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    employee.inviteToken = inviteToken;
    employee.inviteTokenExpires = inviteTokenExpires;
    await employee.save();
    
    const joinLink = `${process.env.FRONTEND_URL}/join/${inviteToken}`;
    
    res.json({
      message: 'Invite resent',
      joinLink
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset password
router.post('/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const tempPassword = generateTempPassword();
    const employee = await Employee.findById(req.params.id);
    
    employee.tempPassword = tempPassword;
    await employee.save();
    
    res.json({
      message: 'Temporary password generated',
      tempPassword
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;