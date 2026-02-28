// routes/employees.js

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Employee from '../models/Employee.js';
import { adminAuth } from '../middleware/auth.js';
import { parseDDMMYYYY } from '../utils/dateUtils.js';

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const generateInviteToken = () => uuidv4();

const constructInviteLink = (token) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base}/join/${token}`;
};

/** Safe employee payload — never expose password hashes */
const publicEmployee = (emp) => {
  const obj = emp.toObject ? emp.toObject() : { ...emp };
  delete obj.password;
  delete obj.tempPassword;
  delete obj.inviteToken;
  delete obj.inviteTokenExpires;
  return obj;
};

// ─── GET /api/employees ───────────────────────────────────────────────────────

router.get('/', adminAuth, async (req, res) => {
  try {
    const {
      status,
      department,
      search,
      includeArchived = 'false',
      page  = 1,
      limit = 20
    } = req.query;

    const query = { isDeleted: false };

    // By default hide archived employees unless admin explicitly asks
    if (includeArchived !== 'true') {
      query.isArchived = false;
    }

    if (status)     query.status     = status;
    if (department) query.department = department;

    if (search) {
      query.$or = [
        { firstName:      { $regex: search, $options: 'i' } },
        { lastName:       { $regex: search, $options: 'i' } },
        { email:          { $regex: search, $options: 'i' } },
        { employeeNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const [employees, total] = await Promise.all([
      Employee.find(query)
        .select('-password -tempPassword -inviteToken -inviteTokenExpires')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Employee.countDocuments(query)
    ]);

    return res.json({
      success: true,
      employees,
      pagination: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────

router.get('/:id', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id:       req.params.id,
      isDeleted: false
    }).select('-password -tempPassword -inviteToken -inviteTokenExpires');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    return res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees ──────────────────────────────────────────────────────

router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      email, employeeNumber, firstName, lastName,
      department, joiningDate, shift,
      salaryType, hourlyRate, monthlySalary,
      bank
    } = req.body;

    // Basic required-field check
    if (!email || !employeeNumber || !firstName || !lastName || !department || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: 'email, employeeNumber, firstName, lastName, department, and joiningDate are required'
      });
    }

    // Duplicate check must exclude soft-deleted records
    // (a deleted employee's email/number should be reusable)
    const existing = await Employee.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { employeeNumber: employeeNumber.trim() }
      ],
      isDeleted: false   // ← old code was missing this, so deleted employees blocked re-use
    });

    if (existing) {
      const field = existing.email === email.toLowerCase().trim()
        ? 'Email' : 'Employee number';
      return res.status(409).json({ success: false, message: `${field} already exists` });
    }

    // Date parsing — accept both dd/mm/yyyy (legacy) and ISO 8601
    let parsedJoiningDate = parseDDMMYYYY(joiningDate);
    if (!parsedJoiningDate) {
      parsedJoiningDate = new Date(joiningDate);
    }
    if (!parsedJoiningDate || isNaN(parsedJoiningDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid joiningDate. Use dd/mm/yyyy or YYYY-MM-DD'
      });
    }

    // salaryType validation
    const resolvedSalaryType = salaryType || 'hourly';
    if (!['hourly', 'monthly'].includes(resolvedSalaryType)) {
      return res.status(400).json({
        success: false,
        message: "salaryType must be 'hourly' or 'monthly'"
      });
    }

    if (resolvedSalaryType === 'monthly' && !monthlySalary) {
      return res.status(400).json({
        success: false,
        message: 'monthlySalary is required when salaryType is monthly'
      });
    }

    const inviteToken   = generateInviteToken();
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);  // 7 days

    const employee = new Employee({
      email:              email.toLowerCase().trim(),
      employeeNumber:     employeeNumber.trim(),
      firstName:          firstName.trim(),
      lastName:           lastName.trim(),
      department,
      role:               'employee',
      joiningDate:        parsedJoiningDate,
      shift:              shift || { start: '09:00', end: '18:00' },
      salaryType:         resolvedSalaryType,
      hourlyRate:         parseFloat(hourlyRate) || 0,
      monthlySalary:      resolvedSalaryType === 'monthly' ? parseFloat(monthlySalary) : null,
      status:             'Inactive',
      inviteToken,
      inviteTokenExpires: inviteExpires,
      bank:               bank || {}
    });

    await employee.save();

    const inviteLink = constructInviteLink(inviteToken);

    return res.status(201).json({
      success:    true,
      message:    'Employee created. Invite link generated.',
      employee:   publicEmployee(employee),
      inviteLink
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/:id ───────────────────────────────────────────────────

router.put('/:id', adminAuth, async (req, res) => {
  try {
    // Admin cannot edit their own record via this endpoint
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot edit your own employee record. Contact another admin.'
      });
    }

    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // ── scalar fields safe to update ─────────────────────────────────────────
    const scalarFields = ['firstName', 'lastName', 'department', 'shift', 'bank'];
    scalarFields.forEach(f => {
      if (req.body[f] !== undefined) employee[f] = req.body[f];
    });

    // ── salary fields — keep consistent ──────────────────────────────────────
    if (req.body.salaryType !== undefined) {
      if (!['hourly', 'monthly'].includes(req.body.salaryType)) {
        return res.status(400).json({
          success: false,
          message: "salaryType must be 'hourly' or 'monthly'"
        });
      }
      employee.salaryType = req.body.salaryType;
    }

    if (req.body.hourlyRate !== undefined) {
      employee.hourlyRate = parseFloat(req.body.hourlyRate);
    }

    if (req.body.monthlySalary !== undefined) {
      employee.monthlySalary = req.body.monthlySalary
        ? parseFloat(req.body.monthlySalary) : null;
    }

    // If switching to monthly but no monthlySalary provided, reject
    if (employee.salaryType === 'monthly' && !employee.monthlySalary) {
      return res.status(400).json({
        success: false,
        message: 'monthlySalary is required when salaryType is monthly'
      });
    }

    // ── joining date ──────────────────────────────────────────────────────────
    if (req.body.joiningDate) {
      let parsed = parseDDMMYYYY(req.body.joiningDate);
      if (!parsed) parsed = new Date(req.body.joiningDate);
      if (!parsed || isNaN(parsed)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid joiningDate. Use dd/mm/yyyy or YYYY-MM-DD'
        });
      }
      employee.joiningDate = parsed;
    }

    await employee.save();

    return res.json({
      success:  true,
      message:  'Employee updated',
      employee: publicEmployee(employee)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/employees/:id/freeze ─────────────────────────────────────────

router.patch('/:id/freeze', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You cannot freeze your own account' });
    }

    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Toggle: Active ↔ Frozen  (Inactive stays Inactive — must be activated first)
    if (employee.status === 'Inactive') {
      return res.status(400).json({
        success: false,
        message: 'Cannot freeze an inactive account. Employee must activate first.'
      });
    }

    employee.status = employee.status === 'Frozen' ? 'Active' : 'Frozen';
    await employee.save();

    return res.json({
      success: true,
      message:  `Employee ${employee.status === 'Frozen' ? 'frozen' : 'unfrozen'} successfully`,
      employee: publicEmployee(employee)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/employees/:id/archive ────────────────────────────────────────

router.patch('/:id/archive', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You cannot archive your own account' });
    }

    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    employee.isArchived = !employee.isArchived;
    await employee.save();

    return res.json({
      success: true,
      message:  `Employee ${employee.isArchived ? 'archived' : 'unarchived'}`,
      employee: publicEmployee(employee)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees/:id/resend-invite ────────────────────────────────────

router.post('/:id/resend-invite', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (employee.status === 'Active') {
      return res.status(400).json({ success: false, message: 'Employee is already activated' });
    }

    employee.inviteToken        = generateInviteToken();
    employee.inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await employee.save();

    const inviteLink = constructInviteLink(employee.inviteToken);

    return res.json({ success: true, message: 'Invite resent', inviteLink });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees/:id/reset-password ───────────────────────────────────
// Generates a temp password.
// IMPORTANT: in production this should be emailed — NEVER returned in the API
// response. We return it here only for development convenience; set
// RETURN_TEMP_PASSWORD=false in production .env to suppress it.

router.post('/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Generate a readable temp password: 4 chars + "-" + 4 chars + "-" + 4 chars
    const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    const tempPassword = `${seg()}-${seg()}-${seg()}`;

    // Store hashed (pre-save hook handles hashing)
    employee.tempPassword = tempPassword;
    await employee.save();

    // In production: email the tempPassword to employee.email here.
    // Never log or return it unless explicitly enabled for dev.
    const revealInDev = process.env.NODE_ENV !== 'production' ||
                        process.env.RETURN_TEMP_PASSWORD === 'true';

    return res.json({
      success: true,
      message: 'Temporary password generated. Employee should change it on next login.',
      ...(revealInDev && { tempPassword })   // only included outside production
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/employees/:id — soft delete ──────────────────────────────────

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You cannot delete your own account' });
    }

    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    employee.isDeleted  = true;
    employee.isArchived = true;
    employee.status     = 'Inactive';
    await employee.save();

    return res.json({ success: true, message: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;