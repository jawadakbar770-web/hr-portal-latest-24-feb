const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

async function adminAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Employee.findById(decoded.id);

    if (!admin || admin.department !== 'Manager') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    req.admin = admin;
    req.userId = decoded.id;
    req.role = 'admin';
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

async function employeeAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const employee = await Employee.findById(decoded.id);

    if (!employee || employee.status !== 'Active') {
      return res.status(403).json({ message: 'Employee access denied' });
    }

    req.employee = employee;
    req.userId = decoded.id;
    req.role = 'employee';
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

/**
 * ✅ NEW: Shared Auth (Admin OR Employee)
 * This fixes employee-side 403 without weakening admin security.
 * Use this only for READ endpoints that both admin & employee can access.
 */
async function authAny(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);

    if (!user || user.isDeleted || user.isArchived) {
      return res.status(403).json({ message: 'Access denied' });
    }

    req.user = user;
    req.userId = decoded.id;

    // Detect role dynamically (no schema changes needed)
    if (user.department === 'Manager') {
      req.role = 'admin';
      req.admin = user;
    } else {
      req.role = 'employee';
      req.employee = user;
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    req.userId = decoded.id;
    req.role = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = { adminAuth, employeeAuth, auth, authAny };
