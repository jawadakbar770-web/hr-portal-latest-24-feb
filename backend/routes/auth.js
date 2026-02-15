const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { auth } = require('../middleware/auth');

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const admin = await Employee.findOne({ email, department: 'Manager' });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials' });
    
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    
    const token = jwt.sign(
      { id: admin._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({
      token,
      user: {
        id: admin._id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: 'admin'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Employee Onboarding (Join via Token)
router.post('/employee/onboard', async (req, res) => {
  try {
    const { token, firstName, lastName, password, bankDetails } = req.body;
    
    const employee = await Employee.findOne({
      inviteToken: token,
      inviteTokenExpires: { $gt: Date.now() }
    });
    
    if (!employee) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    employee.firstName = firstName;
    employee.lastName = lastName;
    employee.password = password;
    employee.bank = bankDetails;
    employee.status = 'Active';
    employee.inviteToken = undefined;
    employee.inviteTokenExpires = undefined;
    
    await employee.save();
    
    const authToken = jwt.sign(
      { id: employee._id, role: 'employee' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({
      message: 'Onboarding complete',
      token: authToken,
      user: {
        id: employee._id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: 'employee'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Employee Login
router.post('/employee/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const employee = await Employee.findOne({ email, status: 'Active' });
    if (!employee) return res.status(401).json({ message: 'Invalid credentials' });
    
    const isMatch = await employee.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    
    const token = jwt.sign(
      { id: employee._id, role: 'employee' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({
      token,
      user: {
        id: employee._id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department,
        role: 'employee'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Validate Token
router.post('/validate-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id).select('-password -tempPassword');
    
    res.json({ valid: true, user, role: decoded.role });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Change Password (Employee)
router.post('/change-password', auth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const employee = await Employee.findById(req.userId);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.password = newPassword;
    await employee.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;