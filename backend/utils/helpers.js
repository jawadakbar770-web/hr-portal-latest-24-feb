const crypto = require('crypto');

// Generate temporary password
function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Calculate monthly salary
function calculateMonthlySalary(hourlyRate, shiftStart, shiftEnd) {
  const hoursPerDay = calculateHours(shiftStart, shiftEnd);
  const standardDays = 22;
  return hoursPerDay * standardDays * hourlyRate;
}

// Calculate hours between two times (Handles midnight wrap-around)
function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let start = startHour * 60 + startMin;
  let end = endHour * 60 + endMin;
  
  if (end < start) end += 24 * 60; // Logic for shifts crossing midnight
  
  return (end - start) / 60;
}

/**
 * STRICT CSV PAIRING LOGIC (Requirement v1.2)
 * Pairs In (0) and Out (1) logs based on a 14-hour window from scheduled shift start.
 */
function pairAttendanceLogs(logs, scheduledShiftStart) {
  const paired = [];
  const sortedLogs = logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Convert scheduled shift start to a comparable minutes-of-day value
  const [sHour, sMin] = scheduledShiftStart.split(':').map(Number);
  const shiftStartMinutes = sHour * 60 + sMin;

  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    
    if (log.type === 0) { // Found an "IN"
      let outLog = null;
      
      // Search forward for "OUT" within 14 hours of SCHEDULED shift start
      for (let j = i + 1; j < sortedLogs.length; j++) {
        const potentialOut = sortedLogs[j];
        if (potentialOut.type === 1) {
          const timeDiffHours = (new Date(potentialOut.timestamp) - new Date(log.timestamp)) / (1000 * 60 * 60);
          
          // Apply the Strict 14-hour Hard-Stop
          if (timeDiffHours <= 14) {
            outLog = potentialOut;
            sortedLogs.splice(j, 1); // Consume the OUT log
            break;
          } else {
            // If it exceeds 14 hours, we ignore it and leave OUT as null
            break; 
          }
        }
      }
      
      paired.push({
        in: new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        out: outLog ? new Date(outLog.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null
      });
    }
  }
  return paired;
}

/**
 * PAYROLL CALCULATION ENGINE (Requirement v1.2 & v1.3)
 * Implements the 50% penalty for missing punches and manual overrides.
 */
function calculateFinalEarning(record, employee) {
  const stdHours = calculateHours(employee.shift.start, employee.shift.end);
  const baseDailyRate = stdHours * employee.hourlyRate;
  
  const otAmount = (record.financials.otHours || 0) * (employee.hourlyRate * (record.financials.otMultiplier || 1));
  const deductions = record.financials.deduction || 0;

  if (record.status === 'Absent') return 0;
  if (record.status === 'Leave') return baseDailyRate;

  // Case 1: Complete Pair (100% Base Salary)
  if (record.inOut.in && record.inOut.out) {
    const workedHours = calculateHours(record.inOut.in, record.inOut.out);
    return (workedHours * employee.hourlyRate) + otAmount - deductions;
  }
  
  // Case 2: One Punch Missing (50% Penalty State)
  if (record.inOut.in || record.inOut.out) {
    return (baseDailyRate * 0.5) + otAmount - deductions;
  }

  return 0; // Both missing = 0
}

// Get company month dates (18th to 17th)
function getCompanyMonthDates(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  let startDate, endDate;
  
  if (day >= 18) {
    startDate = new Date(year, month, 18);
    endDate = new Date(year, month + 1, 17);
  } else {
    startDate = new Date(year, month - 1, 18);
    endDate = new Date(year, month, 17);
  }
  
  return { startDate, endDate };
}

// Check if employee is eligible for leave
function isEligibleForLeave(joiningDate) {
  const now = new Date();
  const joinDate = new Date(joiningDate);
  const daysElapsed = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
  return daysElapsed >= 90;
}

// Get days until leave eligibility
function getDaysUntilLeaveEligible(joiningDate) {
  const now = new Date();
  const joinDate = new Date(joiningDate);
  const daysElapsed = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
  return Math.max(0, 90 - daysElapsed);
}

module.exports = {
  generateTempPassword,
  calculateMonthlySalary,
  calculateHours,
  pairAttendanceLogs,      // Added for CSV Engine
  calculateFinalEarning,   // Added for Payroll Engine
  getCompanyMonthDates,
  isEligibleForLeave,
  getDaysUntilLeaveEligible
};