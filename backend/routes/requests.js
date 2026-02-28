// routes/requests.js

import express from 'express';
import LeaveRequest      from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import AttendanceLog     from '../models/AttendanceLog.js';
import Employee          from '../models/Employee.js';
import { auth, adminAuth, employeeAuth } from '../middleware/auth.js';
import { parseDDMMYYYY, formatDate } from '../utils/dateUtils.js';

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Minutes from "HH:mm" string */
const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Hours worked between two HH:mm strings (handles overnight) */
const calcHours = (inT, outT) => {
  if (!inT || !outT) return 0;
  let diff = toMin(outT) - toMin(inT);
  if (diff < 0) diff += 1440;
  return Math.max(0, diff / 60);
};

/** Scheduled shift hours (handles night-shift) */
const shiftHours = (shift) => calcHours(shift.start, shift.end) || 8;

/**
 * Determine correctionType from which corrected times are present.
 * Falls back to 'Both' when both are provided.
 */
const resolveCorrectionType = (correctedIn, correctedOut) => {
  if (correctedIn  && correctedOut) return 'Both';
  if (correctedIn  && !correctedOut) return 'In';
  if (!correctedIn && correctedOut)  return 'Out';
  return 'Both';
};

// ─── POST /api/requests/leave/submit  (employee) ─────────────────────────────

router.post('/leave/submit', employeeAuth, async (req, res) => {
  try {
    const { fromDate, toDate, leaveType, reason } = req.body;

    if (!fromDate || !toDate || !leaveType || !reason) {
      return res.status(400).json({
        success: false,
        message: 'fromDate, toDate, leaveType, and reason are required'
      });
    }

    // Accept dd/mm/yyyy or ISO
    let parsedFrom = parseDDMMYYYY(fromDate) || new Date(fromDate);
    let parsedTo   = parseDDMMYYYY(toDate)   || new Date(toDate);

    if (!parsedFrom || isNaN(parsedFrom) || !parsedTo || isNaN(parsedTo)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use dd/mm/yyyy or YYYY-MM-DD' });
    }

    if (parsedTo < parsedFrom) {
      return res.status(400).json({ success: false, message: 'toDate must be on or after fromDate' });
    }

    // ── 90-day eligibility check ──────────────────────────────────────────────
    const daysElapsed = Math.floor((Date.now() - new Date(req.user.joiningDate)) / 86_400_000);
    if (daysElapsed < 90) {
      return res.status(400).json({
        success: false,
        message: `Leave not eligible yet. ${90 - daysElapsed} day(s) remaining.`,
        daysUntilEligible: 90 - daysElapsed
      });
    }

    // ── overlap check — no two Pending/Approved leaves on the same dates ─────
    const overlap = await LeaveRequest.findOne({
      empId:    req.user._id,
      status:   { $in: ['Pending', 'Approved'] },
      fromDate: { $lte: parsedTo },
      toDate:   { $gte: parsedFrom },
      isDeleted: false
    });

    if (overlap) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request (Pending or Approved) overlapping these dates.'
      });
    }

    const leaveRequest = new LeaveRequest({
      empId:     req.user._id,
      empNumber: req.user.employeeNumber,
      empName:   `${req.user.firstName} ${req.user.lastName}`,
      leaveType,
      fromDate:  parsedFrom,
      toDate:    parsedTo,
      reason,
      status:    'Pending'
    });

    await leaveRequest.save();

    return res.status(201).json({
      success:   true,
      message:   'Leave request submitted',
      requestId: leaveRequest._id,
      request:   { ...leaveRequest.toObject(), fromDateFormatted: formatDate(parsedFrom), toDateFormatted: formatDate(parsedTo) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/requests/correction/submit  (employee) ────────────────────────

router.post('/correction/submit', employeeAuth, async (req, res) => {
  try {
    const { date, correctedInTime, correctedOutTime, reason } = req.body;

    if (!date || !reason) {
      return res.status(400).json({ success: false, message: 'date and reason are required' });
    }

    if (!correctedInTime && !correctedOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one of correctedInTime or correctedOutTime'
      });
    }

    let parsedDate = parseDDMMYYYY(date) || new Date(date);
    if (!parsedDate || isNaN(parsedDate)) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    parsedDate.setHours(0, 0, 0, 0);

    // ── duplicate pending correction for same date ────────────────────────────
    const existing = await CorrectionRequest.findOne({
      empId:     req.user._id,
      date:      parsedDate,
      status:    'Pending',
      isDeleted: false
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending correction request for this date.'
      });
    }

    // Fetch original times from attendance log (may be null if no record yet)
    const attendance = await AttendanceLog.findOne({
      empId: req.user._id,
      date:  parsedDate
    }).lean();

    const correctionType = resolveCorrectionType(correctedInTime, correctedOutTime);

    const correctionRequest = new CorrectionRequest({
      empId:           req.user._id,
      empNumber:       req.user.employeeNumber,
      empName:         `${req.user.firstName} ${req.user.lastName}`,
      date:            parsedDate,
      correctionType,
      originalInTime:  attendance?.inOut?.in  || null,
      correctedInTime: correctedInTime  || null,
      originalOutTime: attendance?.inOut?.out || null,
      correctedOutTime: correctedOutTime || null,
      reason,
      status: 'Pending'
    });

    await correctionRequest.save();

    return res.status(201).json({
      success:   true,
      message:   'Correction request submitted',
      requestId: correctionRequest._id,
      request:   { ...correctionRequest.toObject(), dateFormatted: formatDate(parsedDate) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/requests/my-requests  (employee) ───────────────────────────────

router.get('/my-requests', employeeAuth, async (req, res) => {
  try {
    const { status, type, fromDate, toDate } = req.query;

    const baseQuery = { empId: req.user._id, isDeleted: false };

    // Optional date filter applies to createdAt
    if (fromDate && toDate) {
      const start = parseDDMMYYYY(fromDate) || new Date(fromDate);
      const end   = parseDDMMYYYY(toDate)   || new Date(toDate);
      if (start && end) {
        end.setHours(23, 59, 59, 999);
        baseQuery.createdAt = { $gte: start, $lte: end };
      }
    }

    const leaveQuery      = { ...baseQuery, ...(status ? { status } : {}) };
    const correctionQuery = { ...baseQuery, ...(status ? { status } : {}) };

    const [leaveRequests, correctionRequests] = await Promise.all([
      (!type || type === 'leave')      ? LeaveRequest.find(leaveQuery).sort({ createdAt: -1 }).lean()      : Promise.resolve([]),
      (!type || type === 'correction') ? CorrectionRequest.find(correctionQuery).sort({ createdAt: -1 }).lean() : Promise.resolve([])
    ]);

    return res.json({
      success: true,
      leaveRequests:      leaveRequests.map(r => ({ ...r, fromDateFormatted: formatDate(r.fromDate), toDateFormatted: formatDate(r.toDate) })),
      correctionRequests: correctionRequests.map(r => ({ ...r, dateFormatted: formatDate(r.date) })),
      total: leaveRequests.length + correctionRequests.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/requests/admin/pending  (admin) ────────────────────────────────

router.get('/admin/pending', adminAuth, async (req, res) => {
  try {
    // Default window: last 45 days (configurable via query param)
    const days    = Math.min(Number(req.query.days) || 45, 180);
    const cutoff  = new Date(Date.now() - days * 86_400_000);

    const [leaveRequests, correctionRequests] = await Promise.all([
      LeaveRequest.find({ status: 'Pending', isDeleted: false, createdAt: { $gte: cutoff } })
        .populate('empId', 'firstName lastName employeeNumber department')
        .sort({ createdAt: -1 })
        .lean(),
      CorrectionRequest.find({ status: 'Pending', isDeleted: false, createdAt: { $gte: cutoff } })
        .populate('empId', 'firstName lastName employeeNumber department')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return res.json({
      success: true,
      leaveRequests:      leaveRequests.map(r => ({ ...r, fromDateFormatted: formatDate(r.fromDate), toDateFormatted: formatDate(r.toDate) })),
      correctionRequests: correctionRequests.map(r => ({ ...r, dateFormatted: formatDate(r.date) })),
      counts: {
        leave:      leaveRequests.length,
        correction: correctionRequests.length,
        total:      leaveRequests.length + correctionRequests.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/requests/leave/:requestId/approve  (admin) ───────────────────

router.patch('/leave/:requestId/approve', adminAuth, async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    });
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${leaveRequest.status.toLowerCase()}` });
    }

    leaveRequest.status     = 'Approved';
    leaveRequest.approvedBy = req.userId;
    leaveRequest.approvedAt = new Date();
    await leaveRequest.save();

    // ── load employee ONCE outside loop (fix N+1) ─────────────────────────────
    const employee = await Employee.findById(leaveRequest.empId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const schedHours = shiftHours(employee.shift);
    const basePay    = schedHours * employee.hourlyRate;

    // ── upsert one AttendanceLog per leave day ────────────────────────────────
    const ops = [];
    for (let d = new Date(leaveRequest.fromDate); d <= new Date(leaveRequest.toDate); d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);

      ops.push(
        AttendanceLog.findOneAndUpdate(
          { empId: leaveRequest.empId, date: day },
          {
            $setOnInsert: {
              empId:      leaveRequest.empId,
              date:       day,
              empNumber:  employee.employeeNumber,
              empName:    `${employee.firstName} ${employee.lastName}`,
              department: employee.department
            },
            $set: {
              status:     'Leave',
              inOut:      { in: null, out: null, outNextDay: false },
              shift:      employee.shift,
              hourlyRate: employee.hourlyRate,
              financials: {
                hoursWorked:      schedHours,   // correct field name (not hoursPerDay)
                scheduledHours:   schedHours,
                basePay,
                deduction:        0,
                deductionDetails: [],
                otMultiplier:     1,
                otHours:          0,
                otAmount:         0,
                otDetails:        [],
                finalDayEarning:  basePay
              },
              manualOverride: false,
              'metadata.source':         'leave_approval',
              'metadata.lastUpdatedBy':  req.userId,
              'metadata.lastModifiedAt': new Date()
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).catch(() => null)
      );
    }
    await Promise.all(ops);

    return res.json({
      success: true,
      message: 'Leave request approved and attendance updated',
      leaveRequest: { ...leaveRequest.toObject(), fromDateFormatted: formatDate(leaveRequest.fromDate), toDateFormatted: formatDate(leaveRequest.toDate) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/requests/leave/:requestId/reject  (admin) ────────────────────

router.patch('/leave/:requestId/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const leaveRequest = await LeaveRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    });
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${leaveRequest.status.toLowerCase()}` });
    }

    leaveRequest.status          = 'Rejected';
    leaveRequest.approvedBy      = req.userId;
    leaveRequest.approvedAt      = new Date();
    leaveRequest.rejectionReason = reason || 'Rejected by admin';
    await leaveRequest.save();

    return res.json({ success: true, message: 'Leave request rejected', leaveRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/requests/correction/:requestId/approve  (admin) ──────────────

router.patch('/correction/:requestId/approve', adminAuth, async (req, res) => {
  try {
    const correctionRequest = await CorrectionRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    });
    if (!correctionRequest) {
      return res.status(404).json({ success: false, message: 'Correction request not found' });
    }
    if (correctionRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${correctionRequest.status.toLowerCase()}` });
    }

    correctionRequest.status     = 'Approved';
    correctionRequest.approvedBy = req.userId;
    correctionRequest.approvedAt = new Date();
    await correctionRequest.save();

    // ── apply correction to attendance record ─────────────────────────────────
    const employee = await Employee.findById(correctionRequest.empId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const dateObj = new Date(correctionRequest.date);
    dateObj.setHours(0, 0, 0, 0);

    // Load existing record to PRESERVE any admin-added deductions and OT
    // Old code wiped these — a zero deduction/OT was written unconditionally
    let record = await AttendanceLog.findOne({ empId: correctionRequest.empId, date: dateObj });

    if (!record) {
      // No existing record — create a minimal one
      record = new AttendanceLog({
        empId:      correctionRequest.empId,
        date:       dateObj,
        empNumber:  employee.employeeNumber,
        empName:    `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        shift:      employee.shift,
        hourlyRate: employee.hourlyRate
      });
    }

    // Apply only the corrected fields
    if (correctionRequest.correctionType === 'In' || correctionRequest.correctionType === 'Both') {
      record.inOut = { ...(record.inOut?.toObject?.() || record.inOut || {}), in: correctionRequest.correctedInTime };
    }
    if (correctionRequest.correctionType === 'Out' || correctionRequest.correctionType === 'Both') {
      record.inOut = { ...(record.inOut?.toObject?.() || record.inOut || {}), out: correctionRequest.correctedOutTime };
    }

    // Recompute hours + basePay with the new times
    const inTime  = record.inOut?.in;
    const outTime = record.inOut?.out;

    if (inTime && outTime) {
      const hours   = calcHours(inTime, outTime);
      const base    = hours * employee.hourlyRate;

      // Preserve existing deduction + OT — only update hours/base/final
      const existingDeduction = record.financials?.deduction  || 0;
      const existingOtAmount  = record.financials?.otAmount   || 0;

      record.financials = {
        ...(record.financials?.toObject?.() || record.financials || {}),
        hoursWorked:      hours,           // correct field (not hoursPerDay)
        scheduledHours:   shiftHours(employee.shift),
        basePay:          base,
        finalDayEarning:  Math.max(0, base - existingDeduction + existingOtAmount)
      };

      // Re-evaluate status — corrected times may change Late → Present
      record.status = toMin(inTime) > toMin(record.shift?.start || employee.shift.start)
        ? 'Late' : 'Present';
    }

    record.manualOverride          = false;
    record.metadata = {
      ...(record.metadata?.toObject?.() || record.metadata || {}),
      source:         'correction_approval',
      lastUpdatedBy:  req.userId,
      lastModifiedAt: new Date()
    };

    await record.save();

    return res.json({
      success:    true,
      message:    'Correction approved and attendance updated',
      correctionRequest,
      updatedAttendance: record
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/requests/correction/:requestId/reject  (admin) ───────────────

router.patch('/correction/:requestId/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const correctionRequest = await CorrectionRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    });
    if (!correctionRequest) {
      return res.status(404).json({ success: false, message: 'Correction request not found' });
    }
    if (correctionRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${correctionRequest.status.toLowerCase()}` });
    }

    correctionRequest.status          = 'Rejected';
    correctionRequest.approvedBy      = req.userId;
    correctionRequest.approvedAt      = new Date();
    correctionRequest.rejectionReason = reason || 'Rejected by admin';
    await correctionRequest.save();

    return res.json({ success: true, message: 'Correction request rejected', correctionRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;