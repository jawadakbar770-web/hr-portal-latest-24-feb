/**
 * Date Formatting Utility
 * Handles date display and manipulation in a consistent format
 */

// Format date for display (YYYY-MM-DD)
export function formatDateDisplay(date) {
  if (!date) return '';

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Format date for input field
export function formatDateInput(date) {
  return formatDateDisplay(date);
}

// Format date for human readable display
export function formatDateReadable(date) {
  if (!date) return '';

  const d = new Date(date);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return d.toLocaleDateString('en-US', options);
}

// Normalize date to midnight UTC
export function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get company month dates (18th to 17th)
export function getCompanyMonthDates(date = new Date()) {
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

// Check if date is in current company month
export function isInCurrentCompanyMonth(date) {
  const { startDate, endDate } = getCompanyMonthDates();
  const d = new Date(date);

  return d >= startDate && d <= endDate;
}

// Get days difference
export function getDaysDifference(date1, date2) {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);

  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

// Format date range for display
export function formatDateRange(startDate, endDate) {
  const start = formatDateReadable(startDate);
  const end = formatDateReadable(endDate);

  return `${start} - ${end}`;
}