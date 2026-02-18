/**
 * Time Validation Utility
 * Handles 24-hour time format validation and formatting
 */

// Validate time format (HH:mm)
export function isValidTime(time) {
  if (!time) return false;
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

// Format time input (auto-format as user types)
export function formatTimeInput(input) {
  // Remove non-numeric except colon
  let cleaned = input.replace(/[^\d:]/g, '');

  // If no colon, add it after 2 digits
  if (!cleaned.includes(':') && cleaned.length > 2) {
    cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
  }

  // Limit to HH:mm format
  if (cleaned.length > 5) {
    cleaned = cleaned.slice(0, 5);
  }

  return cleaned;
}

// Validate and sanitize time
export function sanitizeTime(time) {
  if (!time) return '';

  const formatted = formatTimeInput(time);

  if (!isValidTime(formatted)) {
    return '';
  }

  return formatted;
}

// Convert time to minutes for comparison
export function timeToMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

// Check if time is late
export function isLate(inTime, shiftStartTime) {
  if (!inTime || !shiftStartTime) return false;
  return timeToMinutes(inTime) > timeToMinutes(shiftStartTime);
}

// Calculate delay in minutes
export function calculateDelayMinutes(inTime, shiftStartTime) {
  if (!inTime || !shiftStartTime) return 0;

  const inMinutes = timeToMinutes(inTime);
  const shiftMinutes = timeToMinutes(shiftStartTime);

  if (inMinutes <= shiftMinutes) return 0;

  return inMinutes - shiftMinutes;
}

// Calculate hours between two times
export function calculateHoursBetween(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const startMinutes = timeToMinutes(startTime);
  let endMinutes = timeToMinutes(endTime);

  // Handle overnight shift
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
}

// Validate time range
export function isValidTimeRange(startTime, endTime) {
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return false;
  }

  // Allow both same-day and overnight shifts
  return true;
}