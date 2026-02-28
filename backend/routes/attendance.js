// routes/attendance.js

import express from 'express';
import multer from 'multer';
import AttendanceLog from '../models/AttendanceLog.js';
import Employee from '../models/Employee.js';
import { adminAuth } from '../middleware/auth.js';
import validateCSVFile from '../middleware/csvValidator.js';
import { parseCSV, groupByEmployeeAndDate, mergeTimes } from '../utils/csvParser.js';
import { formatDate, formatDateTimeForDisplay, parseDDMMYYYY } from '../utils/dateUtils.js';

const router = express.Router();

// ─── multer ───────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.includes('csv') ||
               file.mimetype.includes('text') ||
               file.originalname.endsWith('.csv');
    cb(ok ? null : new Error('Invalid file type'), ok);
  }
});

// ─── pure helpers (no DB) ─────────────────────────────────────────────────────

/** "HH:mm" → minutes from midnight */
const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Hours worked between inTime and outTime.
 * outNextDay=true adds 24 h to handle night-shift crossings.
 */
function calcHours(inTime, outTime, outNextDay = false) {
  if (!inTime || !outTime) return 0;
  let diff = toMin(outTime) - toMin(inTime);
  if (outNextDay || diff < 0) diff += 1440;
  return Math.max(0, diff / 60);
}

/** Scheduled shift hours (handles night-shift correctly) */
function shiftHours(shift) {
  return calcHours(shift.start, shift.end, toMin(shift.end) < toMin(shift.start));
}

/** Returns true if inTime is strictly after shiftStart */
function isLate(inTime, shiftStart) {
  if (!inTime || !shiftStart) return false;
  return toMin(inTime) > toMin(shiftStart);
}

/**
 * 14-hour pairing rule for CSV import (req #4).
 *
 * Given an employee's shift start and all raw punch times from the CSV
 * for that date-key, find:
 *   inTime  = earliest punch >= shiftStart (within the shift window)
 *   outTime = first punch found within 14 h of shiftStart (not of check-in)
 *
 * Night-shift example: shift 22:00–06:00
 *   shiftStartMin = 22*60 = 1320
 *   14-h window   = 1320 + 14*60 = 2160 (= 36:00 on a 48-h timeline)
 *   Any punch with normalised minutes <= 2160 is a candidate for out.
 *
 * Returns { inTime, outTime, outNextDay }
 */
function applyNightShiftPairing(shiftStart, punchTimes) {
  if (!punchTimes || punchTimes.length === 0) {
    return { inTime: null, outTime: null, outNextDay: false };
  }

  const shiftStartMin = toMin(shiftStart);
  const windowEnd     = shiftStartMin + 14 * 60;   // 14 h from shift start

  // Normalise each punch to a "shift timeline" minute value.
  // Punches that appear to be before shift start (e.g. 02:00 for a 22:00 shift)
  // are treated as next-day by adding 1440.
  const normalised = punchTimes.map((t) => {
    let m = toMin(t);
    if (m < shiftStartMin) m += 1440;
    return { time: t, norm: m };
  }).sort((a, b) => a.norm - b.norm);

  // inTime: first punch within the 14-h window
  const inEntry = normalised.find(p => p.norm >= shiftStartMin && p.norm <= windowEnd);
  if (!inEntry) return { inTime: null, outTime: null, outNextDay: false };

  const inTime = inEntry.time;

  // outTime: first punch AFTER inEntry that is still within the window
  const outEntry = normalised.find(p => p.norm > inEntry.norm && p.norm <= windowEnd);
  if (!outEntry) return { inTime, outTime: null, outNextDay: false };

  const outNextDay = toMin(outEntry.time) < toMin(inTime); // raw time wrapped past midnight
  return { inTime, outTime: outEntry.time, outNextDay };
}

/**
 * Build the financials sub-document consistently.
 * Used by both CSV import and save-row so the logic is never duplicated.
 */
function buildFinancials({
  status, inTime, outTime, outNextDay = false,
  shift, hourlyRate,
  otHours = 0, otMultiplier = 1, otDetails = [],
  deduction = 0, deductionDetails = []
}) {
  let hoursWorked   = 0;
  let scheduledHrs  = shiftHours(shift);
  let basePay       = 0;

  if (status === 'Leave') {
    hoursWorked = scheduledHrs;
    basePay     = hoursWorked * hourlyRate;
  } else if ((status === 'Present' || status === 'Late') && inTime && outTime) {
    hoursWorked = calcHours(inTime, outTime, outNextDay);
    basePay     = hoursWorked * hourlyRate;
  } else if (inTime && !outTime) {
    // Only check-in: 50 % of scheduled pay
    hoursWorked = scheduledHrs;
    basePay     = hoursWorked * hourlyRate * 0.5;
  } else if (!inTime && outTime) {
    // Only check-out: 50 % of scheduled pay
    hoursWorked = scheduledHrs;
    basePay     = hoursWorked * hourlyRate * 0.5;
  }
  // Absent: basePay stays 0

  // OT: prefer detail array if populated
  const otAmount = otDetails.length
    ? otDetails.reduce((s, e) =>
        s + (e.type === 'manual' ? e.amount : e.hours * e.rate * hourlyRate), 0)
    : otHours * hourlyRate * otMultiplier;

  // Deduction: prefer detail array if populated
  const totalDeduction = deductionDetails.length
    ? deductionDetails.reduce((s, e) => s + e.amount, 0)
    : deduction;

  const finalDayEarning = Math.max(0, basePay - totalDeduction + otAmount);

  return {
    hoursWorked,
    scheduledHours: scheduledHrs,
    basePay,
    deduction:        totalDeduction,
    deductionDetails,
    otMultiplier:     otMultiplier || 1,
    otHours:          otDetails.length
                        ? otDetails.reduce((s, e) => s + (e.hours || 0), 0)
                        : otHours,
    otAmount,
    otDetails,
    finalDayEarning
  };
}

// ─── POST /api/attendance/import-csv ─────────────────────────────────────────

router.post(
  '/import-csv',
  adminAuth,
  upload.single('csvFile'),
  validateCSVFile,
  async (req, res) => {
    const log = [];
    let rowsProcessed = 0, rowsSuccess = 0, rowsSkipped = 0;
    let recordsCreated = 0, recordsUpdated = 0;

    try {
      const csvContent = req.file.buffer.toString('utf-8');
      log.push({ type: 'INFO', message: `📁 File: ${req.file.originalname} (${req.file.size} bytes)` });

      const { parsed, errors } = parseCSV(csvContent);
      errors.forEach(e => log.push({ type: 'ERROR', message: `Row ${e.rowNumber}: ${e.error}` }));

      rowsProcessed = parsed.length;

      if (parsed.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid rows found in CSV file',
          processingLog: log,
          summary: { total: 0, success: 0, failed: errors.length, skipped: 0, recordsCreated: 0, recordsUpdated: 0 }
        });
      }

      log.push({ type: 'INFO', message: `✓ Parsed ${parsed.length} valid row(s)` });

      // Pre-load all referenced employees in one query to avoid N+1
      const empNumbers = [...new Set(parsed.map(r => r.empId))];
      const employees  = await Employee.find({
        employeeNumber: { $in: empNumbers },
        isDeleted: false
      }).lean();
      const empMap = Object.fromEntries(employees.map(e => [e.employeeNumber, e]));

      const grouped = groupByEmployeeAndDate(parsed);
      log.push({ type: 'INFO', message: `📦 ${Object.keys(grouped).length} employee-date group(s)` });

      for (const [, groupData] of Object.entries(grouped)) {
        const { empId, firstName, lastName, dateStr, date, rows } = groupData;

        log.push({ type: 'INFO', message: `\n👤 ${empId} (${firstName} ${lastName}) — ${dateStr}` });

        const employee = empMap[empId];
        if (!employee) {
          log.push({ type: 'WARN', message: `  ⚠️ Employee #${empId} not found. Skipped.` });
          rowsSkipped += rows.length;
          continue;
        }

        // ── apply 14-hour pairing rule (req #4) ──────────────────────────────
        // Pass ALL punch times for this group to the pairing function.
        // It will correctly handle night-shift crossings.
        const punchTimes = rows.map(r => r.time).filter(Boolean);
        const merged     = mergeTimes(rows);   // csvParser groups in/out if already typed

        let inTime, outTime, outNextDay;

        // If csvParser already has typed IN/OUT use them; otherwise apply 14-h rule
        if (merged.inTime || merged.outTime) {
          inTime     = merged.inTime;
          outTime    = merged.outTime;
          outNextDay = merged.outNextDay || false;
        } else {
          // Raw punch list — apply 14-h window from shift start
          ({ inTime, outTime, outNextDay } = applyNightShiftPairing(employee.shift.start, punchTimes));
        }

        if (inTime)  log.push({ type: 'INFO', message: `  ✓ In:  ${inTime}` });
        if (outTime) log.push({ type: 'INFO', message: `  ✓ Out: ${outTime}${outNextDay ? ' (next day)' : ''}` });

        // ── determine status ──────────────────────────────────────────────────
        let status = 'Absent';
        if (inTime || outTime) {
          status = (inTime && isLate(inTime, employee.shift.start)) ? 'Late' : 'Present';
        }

        // ── build financials ──────────────────────────────────────────────────
        const financials = buildFinancials({
          status, inTime, outTime, outNextDay,
          shift: employee.shift, hourlyRate: employee.hourlyRate
        });

        log.push({ type: 'INFO', message: `  💰 ${hoursLabel(financials)} | Status: ${status}` });

        // ── upsert attendance log ─────────────────────────────────────────────
        try {
          const existing = await AttendanceLog.findOne({ empId: employee._id, date });

          const payload = {
            empNumber:     employee.employeeNumber,
            empName:       `${employee.firstName} ${employee.lastName}`,
            department:    employee.department,
            status,
            inOut:         { in: inTime || null, out: outTime || null, outNextDay: outNextDay || false },
            shift: {
              start:       employee.shift.start,
              end:         employee.shift.end,
              isNightShift: toMin(employee.shift.end) < toMin(employee.shift.start)
            },
            hourlyRate:    employee.hourlyRate,
            financials,
            manualOverride: false,          // CSV is not a manual override
            metadata: {
              source:        'csv',
              lastUpdatedBy: req.userId,
              lastModifiedAt: new Date()
            }
          };

          if (existing) {
            // Preserve any existing manual deductions / OT added by admin
            if (existing.manualOverride) {
              log.push({ type: 'WARN', message: `  ⚠️ Skipped — record has manual override. Use save-row to update.` });
              rowsSkipped += rows.length;
              continue;
            }
            await AttendanceLog.updateOne({ _id: existing._id }, { $set: payload });
            recordsUpdated++;
            log.push({ type: 'SUCCESS', message: `  ✓ Updated (${status})` });
          } else {
            await AttendanceLog.create({ date, empId: employee._id, ...payload });
            recordsCreated++;
            log.push({ type: 'SUCCESS', message: `  ✓ Created (${status})` });
          }

          rowsSuccess += rows.length;
        } catch (dbErr) {
          log.push({ type: 'ERROR', message: `  ✗ DB error: ${dbErr.message}` });
        }
      }

      log.push({
        type: 'SUMMARY',
        message: `✅ DONE — Rows: ${rowsProcessed} | OK: ${rowsSuccess} | Skipped: ${rowsSkipped} | Errors: ${errors.length} | Created: ${recordsCreated} | Updated: ${recordsUpdated}`
      });

      return res.json({
        success: true,
        message: 'CSV import complete',
        processingLog: log,
        summary: { total: rowsProcessed, success: rowsSuccess, failed: errors.length, skipped: rowsSkipped, recordsCreated, recordsUpdated }
      });

    } catch (err) {
      log.push({ type: 'ERROR', message: `Fatal: ${err.message}` });
      return res.status(500).json({
        success: false,
        message: 'Error processing CSV file',
        error: err.message,
        processingLog: log,
        summary: { total: rowsProcessed, success: rowsSuccess, failed: 0, skipped: rowsSkipped, recordsCreated, recordsUpdated }
      });
    }
  }
);

// ─── GET /api/attendance/range ────────────────────────────────────────────────

router.get('/range', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate required' });
    }

    const from = parseDDMMYYYY(fromDate);
    const to   = parseDDMMYYYY(toDate);

    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use dd/mm/yyyy' });
    }

    to.setHours(23, 59, 59, 999);

    const records = await AttendanceLog.find({
      date: { $gte: from, $lte: to },
      isDeleted: false
    })
      .populate('empId', 'firstName lastName email employeeNumber shift')
      .sort({ date: -1, empNumber: 1 })
      .lean();

    const attendance = records.map(r => ({
      ...r,
      dateFormatted: formatDate(r.date),
      inTime:        r.inOut?.in   || '--',
      outTime:       r.inOut?.out  || '--',
      outNextDay:    r.inOut?.outNextDay || false,
      financials: {
        ...r.financials,
        deductionDetails: r.financials?.deductionDetails || [],
        otDetails:        r.financials?.otDetails        || []
      },
      lastModified:    r.metadata?.lastModifiedAt ? formatDateTimeForDisplay(r.metadata.lastModifiedAt) : '--',
      lastModifiedRaw: r.metadata?.lastModifiedAt || null
    }));

    return res.json({ success: true, attendance, total: attendance.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/attendance/worksheet ──────────────────────────────────────────
// Generates a full grid: every active employee × every working day in range.
// Virtual rows (no DB record yet) are marked isVirtual: true.

router.post('/worksheet', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate required' });
    }

    const start = parseDDMMYYYY(fromDate);
    const end   = parseDDMMYYYY(toDate);

    if (!start || !end || isNaN(start) || isNaN(end)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use dd/mm/yyyy' });
    }

    end.setHours(23, 59, 59, 999);

    // ── load employees once ───────────────────────────────────────────────────
    const employees = await Employee.find({
      status: 'Active', isArchived: false, isDeleted: false
    }).sort({ employeeNumber: 1 }).lean();

    if (employees.length === 0) {
      return res.json({ success: true, worksheet: [], total: 0 });
    }

    // ── load ALL attendance for the range in ONE query (fix N+1) ─────────────
    const empIds = employees.map(e => e._id);

    const logs = await AttendanceLog.find({
      empId:     { $in: empIds },
      date:      { $gte: start, $lte: end },
      isDeleted: false
    }).lean();

    // Index: "empId_YYYY-MM-DD" → log document
    const logMap = {};
    for (const log of logs) {
      const key = `${log.empId}_${log.date.toISOString().slice(0, 10)}`;
      logMap[key] = log;
    }

    // ── build worksheet grid ──────────────────────────────────────────────────
    const worksheet = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso  = d.toISOString().slice(0, 10);
      const disp = formatDate(new Date(d));

      for (const emp of employees) {
        const key      = `${emp._id}_${iso}`;
        const existing = logMap[key];

        if (existing) {
          worksheet.push({
            _id:           existing._id,
            date:          disp,
            dateRaw:       existing.date,
            empId:         emp._id,
            empNumber:     emp.employeeNumber,
            empName:       `${emp.firstName} ${emp.lastName}`,
            department:    emp.department,
            shift:         emp.shift,
            hourlyRate:    emp.hourlyRate,
            status:        existing.status,
            inOut:         existing.inOut,
            financials: {
              ...existing.financials,
              deductionDetails: existing.financials?.deductionDetails || [],
              otDetails:        existing.financials?.otDetails        || []
            },
            manualOverride: existing.manualOverride,
            lastModified:   existing.metadata?.lastModifiedAt
                              ? formatDateTimeForDisplay(existing.metadata.lastModifiedAt)
                              : '--',
            lastModifiedRaw: existing.metadata?.lastModifiedAt || null,
            isVirtual:  false,
            isModified: false
          });
        } else {
          worksheet.push({
            date:       disp,
            dateRaw:    new Date(d),
            empId:      emp._id,
            empNumber:  emp.employeeNumber,
            empName:    `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift:      emp.shift,
            hourlyRate: emp.hourlyRate,
            status:     'Absent',
            inOut:      { in: null, out: null, outNextDay: false },
            financials: {
              hoursWorked: 0, scheduledHours: shiftHours(emp.shift),
              basePay: 0, deduction: 0, deductionDetails: [],
              otMultiplier: 1, otHours: 0, otAmount: 0, otDetails: [],
              finalDayEarning: 0
            },
            manualOverride:  false,
            lastModified:    '--',
            lastModifiedRaw: null,
            isVirtual:  true,
            isModified: false
          });
        }
      }
    }

    // Sort: date ASC, then empNumber ASC
    worksheet.sort((a, b) => {
      const dc = new Date(a.dateRaw) - new Date(b.dateRaw);
      return dc !== 0 ? dc : a.empNumber.localeCompare(b.empNumber);
    });

    return res.json({ success: true, worksheet, total: worksheet.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/attendance/save-row ───────────────────────────────────────────
// Admin edits a single attendance row.
// Always recomputes finalDayEarning so the table stays consistent (req #3).

router.post('/save-row', adminAuth, async (req, res) => {
  try {
    const {
      empId, date, status,
      inTime, outTime, outNextDay,
      otHours, otMultiplier, otDetails,
      deduction, deductionDetails
    } = req.body;

    const employee = await Employee.findById(empId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const dateObj = parseDDMMYYYY(date);
    if (!dateObj || isNaN(dateObj)) {
      return res.status(400).json({ success: false, message: 'Invalid date (dd/mm/yyyy required)' });
    }

    // ── sanitise arrays ───────────────────────────────────────────────────────
    const cleanDeductionDetails = (Array.isArray(deductionDetails) ? deductionDetails : [])
      .map(e => ({ amount: Number(e?.amount) || 0, reason: String(e?.reason || '').trim() }))
      .filter(e => e.amount >= 0 && e.reason);

    const cleanOtDetails = (Array.isArray(otDetails) ? otDetails : [])
      .map(e => ({
        type:   e?.type === 'manual' ? 'manual' : 'calc',
        amount: Number(e?.amount) || 0,
        hours:  Number(e?.hours)  || 0,
        rate:   [1, 1.5, 2].includes(Number(e?.rate)) ? Number(e.rate) : 1,
        reason: String(e?.reason || '').trim()
      }))
      .filter(e => e.reason && (e.type === 'manual' ? e.amount >= 0 : e.hours > 0));

    // ── build financials (centralised helper) ────────────────────────────────
    const financials = buildFinancials({
      status:           status || 'Present',
      inTime:           inTime  || null,
      outTime:          outTime || null,
      outNextDay:       Boolean(outNextDay),
      shift:            employee.shift,
      hourlyRate:       employee.hourlyRate,
      otHours:          Number(otHours)      || 0,
      otMultiplier:     Number(otMultiplier) || 1,
      otDetails:        cleanOtDetails,
      deduction:        Number(deduction)    || 0,
      deductionDetails: cleanDeductionDetails
    });

    // ── upsert ────────────────────────────────────────────────────────────────
    let record = await AttendanceLog.findOne({ empId: employee._id, date: dateObj });

    if (!record) {
      record = new AttendanceLog({ empId: employee._id, date: dateObj });
    }

    record.empNumber     = employee.employeeNumber;
    record.empName       = `${employee.firstName} ${employee.lastName}`;
    record.department    = employee.department;
    record.status        = status || 'Present';
    record.inOut         = { in: inTime || null, out: outTime || null, outNextDay: Boolean(outNextDay) };
    record.shift         = {
      start:       employee.shift.start,
      end:         employee.shift.end,
      isNightShift: toMin(employee.shift.end) < toMin(employee.shift.start)
    };
    record.hourlyRate    = employee.hourlyRate;
    record.financials    = financials;
    record.manualOverride = true;
    record.metadata      = {
      ...(record.metadata?.toObject?.() || record.metadata || {}),
      source:         'manual',
      lastUpdatedBy:  req.userId,
      lastModifiedAt: new Date()
    };

    await record.save();   // pre-save hook also recomputes finalDayEarning as safety net

    return res.json({
      success: true,
      message: 'Attendance saved',
      record,
      lastModified: formatDateTimeForDisplay(new Date())
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── tiny label helper (only used for log messages) ──────────────────────────
const hoursLabel = (f) =>
  `Hours: ${(f.hoursWorked || 0).toFixed(2)} | Base: ${(f.basePay || 0).toFixed(2)} | OT: ${(f.otAmount || 0).toFixed(2)} | Final: ${(f.finalDayEarning || 0).toFixed(2)}`;

export default router;