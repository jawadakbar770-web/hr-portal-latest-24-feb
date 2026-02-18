const express = require('express');
const router = express.Router();
const AttendanceLog = require('../models/AttendanceLog');
const Employee = require('../models/Employee');
const { adminAuth, employeeAuth, authAny } = require('../middleware/auth'); // ✅ Added authAny
const csv = require('csv-parse');
const { v4: uuidv4 } = require('uuid');

// Helper: Calculate hours between two times (24-hour safe)
function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let start = startHour * 60 + startMin;
  let end = endHour * 60 + endMin;
  
  // Handle overnight shift
  if (end < start) {
    end += 24 * 60;
  }
  
  return (end - start) / 60;
}

// Helper: Validate time format (HH:mm)
function isValidTime(time) {
  if (!time) return false;
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

// Helper: Check if time is late
function isLate(inTime, shiftStart) {
  if (!inTime || !shiftStart) return false;
  
  const [inH, inM] = inTime.split(':').map(Number);
  const [shiftH, shiftM] = shiftStart.split(':').map(Number);
  
  const inMinutes = inH * 60 + inM;
  const shiftMinutes = shiftH * 60 + shiftM;
  
  return inMinutes > shiftMinutes;
}

// **1. Generate Worksheet (No Gaps)**
router.post('/worksheet', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'From and To dates required' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    // Get all active employees
    const employees = await Employee.find({
      status: 'Active',
      isArchived: false,
      isDeleted: false
    }).sort({ employeeNumber: 1, firstName: 1 });

    const worksheet = [];

    // Iterate through all dates
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      currentDate.setHours(0, 0, 0, 0);

      // Iterate through all employees
      for (const emp of employees) {
        // Find existing record
        const existing = await AttendanceLog.findOne({
          empId: emp._id,
          date: currentDate
        });

        if (existing) {
          // Use existing record
          worksheet.push({
            _id: existing._id,
            date: existing.date,
            empId: emp._id,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift: emp.shift,
            hourlyRate: emp.hourlyRate,
            status: existing.status,
            inOut: existing.inOut,
            financials: existing.financials,
            manualOverride: existing.manualOverride,
            isVirtual: false,
            isModified: false
          });
        } else {
          // Create virtual row
          worksheet.push({
            date: currentDate,
            empId: emp._id,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift: emp.shift,
            hourlyRate: emp.hourlyRate,
            status: 'Absent',
            inOut: { in: null, out: null },
            financials: {
              hoursPerDay: 0,
              basePay: 0,
              deduction: 0,
              otMultiplier: 1,
              otHours: 0,
              otAmount: 0,
              finalDayEarning: 0
            },
            manualOverride: false,
            isVirtual: true,
            isModified: false
          });
        }
      }
    }

    // Sort: Date ascending, then EmpNumber, then Name
    worksheet.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      const empCompare = a.empNumber.localeCompare(b.empNumber);
      if (empCompare !== 0) return empCompare;
      
      return a.empName.localeCompare(b.empName);
    });

    res.json({ worksheet, total: worksheet.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **2. Save Attendance Row (Upsert)**
router.post('/save-row', adminAuth, async (req, res) => {
  try {
    const {
      empId,
      date,
      status,
      inTime,
      outTime,
      otHours,
      otMultiplier,
      deduction
    } = req.body;

    const employee = await Employee.findById(empId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    // Calculate financials
    let hoursPerDay = 0;
    let basePay = 0;
    let otAmount = 0;
    let finalDayEarning = 0;

    if (status === 'Leave') {
      hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
      basePay = hoursPerDay * employee.hourlyRate;
      finalDayEarning = basePay;
    } else if (status === 'Absent' || (!inTime && !outTime)) {
      finalDayEarning = 0;
    } else if (inTime && outTime) {
      hoursPerDay = calculateHours(inTime, outTime);
      basePay = hoursPerDay * employee.hourlyRate;
      otAmount = (otHours || 0) * employee.hourlyRate * (otMultiplier || 1);
      finalDayEarning = basePay + otAmount - (deduction || 0);
      finalDayEarning = Math.max(0, finalDayEarning);
    } else if (inTime || outTime) {
      hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
      basePay = hoursPerDay * employee.hourlyRate;
      otAmount = (otHours || 0) * employee.hourlyRate * (otMultiplier || 1);
      finalDayEarning = (basePay * 0.5) + otAmount - (deduction || 0);
      finalDayEarning = Math.max(0, finalDayEarning);
    }

    const attendance = await AttendanceLog.findOneAndUpdate(
      { empId: employee._id, date: dateObj },
      {
        $set: {
          empNumber: employee.employeeNumber,
          empName: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          status: status || 'Present',
          inOut: {
            in: inTime || null,
            out: outTime || null
          },
          shift: employee.shift,
          hourlyRate: employee.hourlyRate,
          financials: {
            hoursPerDay,
            basePay,
            deduction: deduction || 0,
            otMultiplier: otMultiplier || 1,
            otHours: otHours || 0,
            otAmount,
            finalDayEarning
          },
          manualOverride: true,
          metadata: {
            lastUpdatedBy: req.admin._id,
            source: 'manual'
          },
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      message: 'Attendance saved successfully',
      record: attendance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **3. Save All (Bulk Upsert)**
router.post('/save-batch', adminAuth, async (req, res) => {
  try {
    const { attendanceData } = req.body;

    if (!attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ message: 'Invalid attendance data' });
    }

    const bulkOps = [];

    for (const record of attendanceData) {
      const employee = await Employee.findById(record.empId);
      if (!employee) continue;

      const dateObj = new Date(record.date);
      dateObj.setHours(0, 0, 0, 0);

      let hoursPerDay = 0;
      let basePay = 0;
      let otAmount = 0;
      let finalDayEarning = 0;

      if (record.status === 'Leave') {
        hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
        basePay = hoursPerDay * employee.hourlyRate;
        finalDayEarning = basePay;
      } else if (record.status === 'Absent' || (!record.inOut?.in && !record.inOut?.out)) {
        finalDayEarning = 0;
      } else if (record.inOut?.in && record.inOut?.out) {
        hoursPerDay = calculateHours(record.inOut.in, record.inOut.out);
        basePay = hoursPerDay * employee.hourlyRate;
        otAmount = (record.financials?.otHours || 0) * employee.hourlyRate * (record.financials?.otMultiplier || 1);
        finalDayEarning = basePay + otAmount - (record.financials?.deduction || 0);
        finalDayEarning = Math.max(0, finalDayEarning);
      }

      bulkOps.push({
        updateOne: {
          filter: { empId: employee._id, date: dateObj },
          update: {
            $set: {
              empNumber: employee.employeeNumber,
              empName: `${employee.firstName} ${employee.lastName}`,
              department: employee.department,
              status: record.status,
              inOut: record.inOut || { in: null, out: null },
              shift: employee.shift,
              hourlyRate: employee.hourlyRate,
              financials: {
                hoursPerDay,
                basePay,
                deduction: record.financials?.deduction || 0,
                otMultiplier: record.financials?.otMultiplier || 1,
                otHours: record.financials?.otHours || 0,
                otAmount,
                finalDayEarning
              },
              manualOverride: true,
              metadata: {
                lastUpdatedBy: req.admin._id,
                source: 'manual'
              },
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length > 0) {
      await AttendanceLog.bulkWrite(bulkOps);
    }

    res.json({
      message: `${bulkOps.length} attendance records saved successfully`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **4. CSV Import (Deterministic, Progressive Completion)**
router.post('/csv-import', adminAuth, async (req, res) => {
  try {
    const { csvContent } = req.body;

    if (!csvContent) {
      return res.status(400).json({ message: 'CSV content required' });
    }

    const batchId = uuidv4();
    const rows = csvContent.trim().split('\n').slice(1);
    const parsed = [];

    for (const row of rows) {
      const [empId, name, dateTime, type] = row.split('|').map(s => s.trim());

      if (!empId || !dateTime || type === undefined) continue;

      const [datePart, timePart] = dateTime.split(' ');
      const [month, day, year] = datePart.split('/');
      const date = new Date(year, parseInt(month) - 1, day);
      date.setHours(0, 0, 0, 0);

      parsed.push({
        empId: empId.trim(),
        name: name.trim(),
        date,
        time: timePart.trim(),
        type: parseInt(type)
      });
    }

    parsed.sort((a, b) => {
      const dateCompare = a.date - b.date;
      if (dateCompare !== 0) return dateCompare;

      const empCompare = a.empId.localeCompare(b.empId);
      if (empCompare !== 0) return empCompare;

      if (a.type !== b.type) return a.type - b.type;

      return a.time.localeCompare(b.time);
    });

    const bulkOps = [];
    const processed = {};

    for (let i = 0; i < parsed.length; i++) {
      const record = parsed[i];
      const employee = await Employee.findOne({ employeeNumber: record.empId });
      if (!employee) continue;

      const key = `${employee._id}-${record.date.toISOString()}`;

      if (!processed[key]) {
        processed[key] = { in: null, out: null, date: record.date, empId: employee._id };
      }

      if (record.type === 0) {
        if (!processed[key].in) processed[key].in = record.time;
      } else if (record.type === 1) {
        const [shiftH, shiftM] = employee.shift.start.split(':').map(Number);
        const shiftStartMinutes = shiftH * 60 + shiftM;

        const [outH, outM] = record.time.split(':').map(Number);
        const outMinutes = outH * 60 + outM;

        const diffMinutes = (outMinutes - shiftStartMinutes + 1440) % 1440;

        if (diffMinutes <= 14 * 60) {
          if (!processed[key].out) processed[key].out = record.time;
        }
      }
    }

    for (const key in processed) {
      const { in: csvIn, out: csvOut, date, empId } = processed[key];
      const employee = await Employee.findById(empId);

      const existing = await AttendanceLog.findOne({ empId, date });

      let finalIn = csvIn;
      let finalOut = csvOut;

      if (existing && !existing.manualOverride) {
        finalIn = csvIn && existing.inOut.in ?
          (csvIn < existing.inOut.in ? csvIn : existing.inOut.in) :
          (csvIn || existing.inOut.in);

        finalOut = csvOut && existing.inOut.out ?
          (csvOut > existing.inOut.out ? csvOut : existing.inOut.out) :
          (csvOut || existing.inOut.out);
      }

      let hoursPerDay = 0;
      let basePay = 0;
      let finalDayEarning = 0;

      if (finalIn && finalOut) {
        hoursPerDay = calculateHours(finalIn, finalOut);
        basePay = hoursPerDay * employee.hourlyRate;
        finalDayEarning = basePay;
      } else if ((finalIn && !finalOut) || (!finalIn && finalOut)) {
        hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
        basePay = hoursPerDay * employee.hourlyRate;
        finalDayEarning = basePay * 0.5;
      }

      bulkOps.push({
        updateOne: {
          filter: { empId, date },
          update: {
            $set: {
              empNumber: employee.employeeNumber,
              empName: `${employee.firstName} ${employee.lastName}`,
              department: employee.department,
              status: finalIn && finalOut ? 
                (isLate(finalIn, employee.shift.start) ? 'Late' : 'Present') : 'Absent',
              inOut: { in: finalIn || null, out: finalOut || null },
              shift: employee.shift,
              hourlyRate: employee.hourlyRate,
              financials: {
                hoursPerDay,
                basePay,
                deduction: 0,
                otMultiplier: 1,
                otHours: 0,
                otAmount: 0,
                finalDayEarning
              },
              manualOverride: false,
              csvSource: {
                importedAt: new Date(),
                csvBatch: batchId
              },
              metadata: {
                lastUpdatedBy: req.admin._id,
                source: 'csv'
              },
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length > 0) await AttendanceLog.bulkWrite(bulkOps);

    res.json({
      message: `CSV imported: ${bulkOps.length} records processed`,
      batchId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **5. Get Attendance Range (Admin or Employee)**
// ✅ UPDATED: Changed from a try/catch hack to the authAny middleware
router.get('/range', authAny, async (req, res) => {
  try {
    const { fromDate, toDate, empId } = req.query;

    // ✅ Security check: If not admin, force filter by logged-in user's ID
    const targetEmpId = req.role === 'admin' ? (empId || req.userId) : req.userId;

    const query = {
      date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
      empId: targetEmpId,
      isDeleted: false
    };

    const attendance = await AttendanceLog.find(query)
      .populate('empId', 'firstName lastName email')
      .sort({ date: 1 });

    return res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;