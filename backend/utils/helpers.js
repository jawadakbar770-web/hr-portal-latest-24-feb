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
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const [endHour, endMin] = shiftEnd.split(':').map(Number);
  const hoursPerDay = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
  const standardDays = 22;
  return hoursPerDay * standardDays * hourlyRate;
}

// Calculate hours between two times
function calculateHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let start = startHour * 60 + startMin;
  let end = endHour * 60 + endMin;
  
  if (end < start) end += 24 * 60;
  
  return (end - start) / 60;
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
  getCompanyMonthDates,
  isEligibleForLeave,
  getDaysUntilLeaveEligible
};