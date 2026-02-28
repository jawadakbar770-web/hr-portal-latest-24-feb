// routes/payroll.js

import express from 'express';
import AttendanceLog from '../models/AttendanceLog.js';
import Employee      from '../models/Employee.js';
import { adminAuth, employeeAuth } from '../middleware/auth.js';
import { buildDateRange, formatDate } from '../utils/dateUtils.js';
import { isLate, getCompanyMonthDates, getRecentPayPeriods } from '../utils/timeCalculator.js';

const router = express.Router();

// ─── shared helpers ───────────────────────────────────────────────────────────

/**
 * Accept dd/mm/yyyy OR YYYY-MM-DD for both params.
 * Delegates to the shared buildDateRange so parsing logic lives in one place.
 * Returns { start, end } or null.
 */
function parseDateRange(fromDate, toDate) {
  const range = buildDateRange(fromDate, toDate);  // handles both formats + validation
  if (!range) return null;
  return { start: range.$gte, end: range.$lte };
}

const n      = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
const round2 = (v) => parseFloat(n(v).toFixed(2));

/** Count Mon–Fri working days between two dates inclusive */
function workingDaysBetween(start, end) {
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Build per-employee payroll totals from their AttendanceLog records.
 * Monthly salary is pro-rated by (presentDays + leaveDays) / workingDays.
 */
function calcEmployeeTotals(emp, records, workingDays) {
  const presentDays = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const leaveDays   = records.filter(r => r.status === 'Leave').length;
  const absentDays  = records.filter(r => r.status === 'Absent').length;
  const lateDays    = records.filter(r => r.status === 'Late').length;

  const totalDeduction = records.reduce((s, r) => s + n(r.financials?.deduction), 0);
  const totalOt        = records.reduce((s, r) => s + n(r.financials?.otAmount),   0);
  const totalOtHours   = records.reduce((s, r) => s + n(r.financials?.otHours),    0);

  let baseSalary;
  if (emp.salaryType === 'monthly' && emp.monthlySalary) {
    baseSalary = (emp.monthlySalary / (workingDays || 1)) * (presentDays + leaveDays);
  } else {
    baseSalary = records.reduce((s, r) => s + n(r.financials?.basePay), 0);
  }

  const netPayable = Math.max(0, baseSalary - totalDeduction + totalOt);

  return {
    empId:          emp._id,
    empNumber:      emp.employeeNumber,
    name:           `${emp.firstName} ${emp.lastName}`,
    department:     emp.department,
    salaryType:     emp.salaryType   || 'hourly',
    hourlyRate:     emp.hourlyRate,
    monthlySalary:  emp.monthlySalary || null,
    presentDays, leaveDays, absentDays, lateDays,
    workingDays,
    baseSalary:     round2(baseSalary),
    totalDeduction: round2(totalDeduction),
    totalOt:        round2(totalOt),
    totalOtHours:   round2(totalOtHours),
    netPayable:     round2(netPayable),
    recordCount:    records.length
  };
}

/**
 * Build per-day breakdown rows.
 * Shared by admin detail view and employee salary page — no duplication.
 */
function buildDailyBreakdown(records) {
  return records.map(r => ({
    date:             formatDate(r.date),
    dateRaw:          r.date,
    status:           r.status,
    inTime:           r.inOut?.in          || '--',
    outTime:          r.inOut?.out         || '--',
    outNextDay:       r.inOut?.outNextDay  || false,
    hoursWorked:      round2(n(r.financials?.hoursWorked)),   // correct field (not hoursPerDay)
    basePay:          round2(n(r.financials?.basePay)),
    deduction:        round2(n(r.financials?.deduction)),
    otHours:          round2(n(r.financials?.otHours)),
    otAmount:         round2(n(r.financials?.otAmount)),
    finalDayEarning:  round2(n(r.financials?.finalDayEarning)),
    deductionDetails: r.financials?.deductionDetails || [],
    otDetails:        r.financials?.otDetails        || []
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE ROUTES  (req #7)
// Registered BEFORE /:empId param routes — prevents Express swallowing /my/*
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/payroll/my/periods ─────────────────────────────────────────────

router.get('/my/periods', employeeAuth, async (req, res) => {
  try {
    const periods = getRecentPayPeriods(6).map(p => ({
      startDate:   formatDate(p.startDate),
      endDate:     formatDate(p.endDate),
      periodLabel: p.periodLabel
    }));
    return res.json({ success: true, periods });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/payroll/my/summary  (req #7) ───────────────────────────────────
// Employee selects a date range and sees their own:
// baseSalary | deductions | OT | netSalary  +  day-by-day breakdown

router.get('/my/summary', employeeAuth, async (req, res) => {
  try {
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate required (dd/mm/yyyy or YYYY-MM-DD)'
      });
    }
    const { start, end } = range;

    const [emp, records] = await Promise.all([
      Employee.findById(req.userId).lean(),
      AttendanceLog.find({
        empId: req.userId, date: { $gte: start, $lte: end }, isDeleted: false
      }).sort({ date: 1 }).lean()
    ]);

    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    const workingDays    = workingDaysBetween(start, end);
    const totals         = calcEmployeeTotals(emp, records, workingDays);
    const dailyBreakdown = buildDailyBreakdown(records);

    return res.json({
      success: true,
      summary: {
        empName:          totals.name,
        empNumber:        totals.empNumber,
        department:       totals.department,
        salaryType:       totals.salaryType,
        periodStart:      formatDate(start),
        periodEnd:        formatDate(end),
        totalWorkingDays: workingDays,
        presentDays:      totals.presentDays,
        lateDays:         totals.lateDays,
        absentDays:       totals.absentDays,
        leaveDays:        totals.leaveDays,
        baseSalary:       totals.baseSalary,
        totalDeduction:   totals.totalDeduction,
        totalOtHours:     totals.totalOtHours,
        totalOtAmount:    totals.totalOt,
        netSalary:        totals.netPayable
      },
      dailyBreakdown
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/payroll/attendance-overview ────────────────────────────────────

router.post('/attendance-overview', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, filterType } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' });
    const { start, end } = range;

    const [employees, allLogs] = await Promise.all([
      Employee.find({ status: 'Active', isArchived: false, isDeleted: false }).lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false }).lean()
    ]);

    const logMap = {};
    for (const log of allLogs) {
      logMap[`${log.empId}_${log.date.toISOString().slice(0, 10)}`] = log;
    }

    const statusCount  = { 'On-time': 0, Late: 0, Leave: 0, Absent: 0 };
    const detailedList = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso  = d.toISOString().slice(0, 10);
      const disp = formatDate(new Date(d));

      for (const emp of employees) {
        const record = logMap[`${emp._id}_${iso}`];
        let status = 'Absent', delayMinutes = 0, note = 'No record found';

        if (record) {
          if (record.status === 'Leave') {
            status = 'Leave'; note = 'Approved leave';
          } else if (record.status === 'Absent') {
            status = 'Absent'; note = record.metadata?.notes || 'Absent';
          } else if (record.inOut?.in) {
            if (isLate(record.inOut.in, record.shift.start)) {
              const [ih, im] = record.inOut.in.split(':').map(Number);
              const [sh, sm] = record.shift.start.split(':').map(Number);
              delayMinutes   = ih * 60 + im - (sh * 60 + sm);
              status = 'Late'; note = `Late by ${delayMinutes} min`;
            } else {
              status = 'On-time'; note = 'On time';
            }
          }
        }

        statusCount[status]++;

        if (!filterType || status.toLowerCase() === filterType.toLowerCase()) {
          detailedList.push({
            date: disp, empId: emp.employeeNumber,
            name: `${emp.firstName} ${emp.lastName}`,
            type: status, reason: note, delayMinutes
          });
        }
      }
    }

    const total = Object.values(statusCount).reduce((a, b) => a + b, 0);
    const chartData = Object.entries(statusCount).map(([name, value]) => ({
      name, value,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
    }));

    return res.json({ success: true, chartData, detailedList, summary: statusCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/payroll/performance-overview  (req #2) ─────────────────────────

router.post('/performance-overview', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' });
    const { start, end } = range;

    const [employees, allLogs] = await Promise.all([
      Employee.find({ status: 'Active', isArchived: false, isDeleted: false }).lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false }).lean()
    ]);

    const workingDays = workingDaysBetween(start, end);
    const logsByEmp   = {};
    for (const log of allLogs) {
      const key = String(log.empId);
      (logsByEmp[key] ??= []).push(log);
    }

    const performance = employees.map(emp => {
      const records      = logsByEmp[String(emp._id)] || [];
      const presentDays  = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
      const leaveDays    = records.filter(r => r.status === 'Leave').length;
      const absentDays   = records.filter(r => r.status === 'Absent').length;
      const lateDays     = records.filter(r => r.status === 'Late').length;
      const totalOtHours = records.reduce((s, r) => s + n(r.financials?.otHours), 0);

      const attendanceRate  = workingDays > 0
        ? ((presentDays + leaveDays) / workingDays) * 100 : 0;
      const punctualityRate = presentDays > 0
        ? ((presentDays - lateDays) / presentDays) * 100 : 100;
      const otScore = Math.min(100, (totalOtHours / Math.max(1, workingDays)) * 100);

      const score = Math.round(
        attendanceRate * 0.5 + punctualityRate * 0.3 + otScore * 0.2
      );

      return {
        empId:            emp.employeeNumber,
        empObjectId:      emp._id,
        name:             `${emp.firstName} ${emp.lastName}`,
        department:       emp.department,
        performanceScore: score,
        attendanceRate:   round2(attendanceRate),
        punctualityRate:  round2(punctualityRate),
        presentDays, leaveDays, absentDays, lateDays,
        totalOtHours:     round2(totalOtHours),
        workingDays,
        rating: score >= 90 ? 'Excellent'
               : score >= 75 ? 'Good'
               : score >= 60 ? 'Average'
               : 'Poor'
      };
    });

    const ratingCounts = { Excellent: 0, Good: 0, Average: 0, Poor: 0 };
    performance.forEach(p => ratingCounts[p.rating]++);

    const pieData = Object.entries(ratingCounts).map(([name, value]) => ({
      name, value,
      percentage: performance.length > 0
        ? ((value / performance.length) * 100).toFixed(1) : '0.0'
    }));

    return res.json({ success: true, performance, pieData, workingDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/payroll/salary-summary  (req #1) ───────────────────────────────

router.post('/salary-summary', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' });
    const { start, end } = range;

    const [employees, allLogs] = await Promise.all([
      Employee.find({ status: 'Active', isArchived: false, isDeleted: false }).lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false }).lean()
    ]);

    const workingDays = workingDaysBetween(start, end);
    const logsByEmp   = {};
    for (const log of allLogs) {
      const key = String(log.empId);
      (logsByEmp[key] ??= []).push(log);
    }

    const summary = employees
      .map(emp => calcEmployeeTotals(emp, logsByEmp[String(emp._id)] || [], workingDays))
      .sort((a, b) => a.name.localeCompare(b.name));

    const totals = {
      totalBaseSalary: round2(summary.reduce((s, e) => s + e.baseSalary,     0)),
      totalOT:         round2(summary.reduce((s, e) => s + e.totalOt,        0)),
      totalDeductions: round2(summary.reduce((s, e) => s + e.totalDeduction, 0)),
      totalNetPayable: round2(summary.reduce((s, e) => s + e.netPayable,     0))
    };

    return res.json({ success: true, summary, totals, workingDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/payroll/report ─────────────────────────────────────────────────

router.post('/report', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, search = '' } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' });
    const { start, end } = range;

    const [employees, allLogs] = await Promise.all([
      Employee.find({ status: 'Active', isArchived: false, isDeleted: false })
        .sort({ firstName: 1, lastName: 1 }).lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false })
        .sort({ date: 1 }).lean()
    ]);

    const workingDays = workingDaysBetween(start, end);
    const term        = search.trim().toLowerCase();
    const logsByEmp   = {};
    for (const log of allLogs) {
      const key = String(log.empId);
      (logsByEmp[key] ??= []).push(log);
    }

    const report = employees
      .filter(emp => {
        if (!term) return true;
        const full = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        return full.includes(term) || emp.employeeNumber.toLowerCase().includes(term);
      })
      .map(emp => {
        const records = logsByEmp[String(emp._id)] || [];
        return {
          ...calcEmployeeTotals(emp, records, workingDays),
          dailyAttendance: buildDailyBreakdown(records)  // shared helper, no duplication
        };
      });

    const grandTotals = {
      totalBaseSalary: round2(report.reduce((s, e) => s + e.baseSalary,     0)),
      totalOT:         round2(report.reduce((s, e) => s + e.totalOt,        0)),
      totalDeductions: round2(report.reduce((s, e) => s + e.totalDeduction, 0)),
      totalNetPayable: round2(report.reduce((s, e) => s + e.netPayable,     0))
    };

    return res.json({ success: true, report, grandTotals, workingDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/payroll/employee-breakdown/:empId ───────────────────────────────

router.get('/employee-breakdown/:empId', adminAuth, async (req, res) => {
  try {
    const range = parseDateRange(req.query.fromDate, req.query.toDate);
    if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' });
    const { start, end } = range;

    const [emp, records] = await Promise.all([
      Employee.findOne({ _id: req.params.empId, isDeleted: false }).lean(),
      AttendanceLog.find({
        empId: req.params.empId, date: { $gte: start, $lte: end }, isDeleted: false
      }).sort({ date: 1 }).lean()
    ]);

    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    const workingDays    = workingDaysBetween(start, end);
    const empTotals      = calcEmployeeTotals(emp, records, workingDays);
    const dailyBreakdown = buildDailyBreakdown(records);

    return res.json({
      success: true,
      employee: {
        id:             emp._id,
        name:           `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeNumber,
        department:     emp.department,
        salaryType:     emp.salaryType   || 'hourly',
        hourlyRate:     emp.hourlyRate,
        monthlySalary:  emp.monthlySalary || null,
        shift:          emp.shift
      },
      dailyBreakdown,
      totals: {
        baseSalary:     empTotals.baseSalary,
        totalDeduction: empTotals.totalDeduction,
        totalOt:        empTotals.totalOt,
        totalOtHours:   empTotals.totalOtHours,
        netPayable:     empTotals.netPayable,
        presentDays:    empTotals.presentDays,
        leaveDays:      empTotals.leaveDays,
        absentDays:     empTotals.absentDays,
        lateDays:       empTotals.lateDays,    // was missing from original totals object
        workingDays
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/payroll/live-payroll ────────────────────────────────────────────

router.get('/live-payroll', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = getCompanyMonthDates();
    const now = new Date();

    const logs = await AttendanceLog.find({
      date: { $gte: startDate, $lte: now }, isDeleted: false
    }).lean();

    const totalPayroll = round2(
      logs.reduce((s, r) => s + n(r.financials?.finalDayEarning), 0)
    );

    return res.json({
      success:     true,
      totalPayroll,
      periodStart: formatDate(startDate),
      periodEnd:   formatDate(endDate),
      asOf:        formatDate(now)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/payroll/export ─────────────────────────────────────────────────

router.post('/export', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, format = 'json' } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' });
    const { start, end } = range;

    const [employees, allLogs] = await Promise.all([
      Employee.find({ status: 'Active', isArchived: false, isDeleted: false }).lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false }).lean()
    ]);

    const workingDays = workingDaysBetween(start, end);
    const logsByEmp   = {};
    for (const log of allLogs) {
      const key = String(log.empId);
      (logsByEmp[key] ??= []).push(log);
    }

    const rows = employees
      .map(emp => calcEmployeeTotals(emp, logsByEmp[String(emp._id)] || [], workingDays))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (format === 'csv') {
      // All columns present — lateDays and OT Hours were missing from original
      const headers = [
        'Employee Number', 'Name', 'Department', 'Salary Type',
        'Working Days', 'Present Days', 'Leave Days', 'Absent Days', 'Late Days',
        'Base Salary', 'OT Hours', 'OT Amount', 'Deductions', 'Net Payable'
      ];
      const lines = rows.map(e =>
        [
          e.empNumber,
          `"${e.name}"`,     // quoted — handles commas in names
          e.department,
          e.salaryType,
          e.workingDays,
          e.presentDays,
          e.leaveDays,
          e.absentDays,
          e.lateDays,        // was missing
          e.baseSalary,
          e.totalOtHours,    // was missing
          e.totalOt,
          e.totalDeduction,
          e.netPayable
        ].join(',')
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payroll_${fromDate}_${toDate}.csv"`);
      return res.send([headers.join(','), ...lines].join('\n'));
    }

    return res.json({ success: true, summary: rows, workingDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;