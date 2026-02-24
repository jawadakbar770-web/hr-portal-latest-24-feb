/**
 * Time Normalizer Utility
 * Normalizes flexible time input to HH:mm format
 * Accepts: 9:00, 9:5, 09:00, 09:05, 900, 0900, etc.
 */

export function normalizeTime(timeInput) {
  if (!timeInput) return null;

  const trimmed = String(timeInput).trim();
  if (!trimmed) return null;

  // Already in HH:mm format
  if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed)) {
    return trimmed;
  }

  // Flexible HH:mm with single digits (9:5, 9:00, etc.)
  if (/^([0-1]?[0-9]|2[0-3]):[0-5]?[0-9]$/.test(trimmed)) {
    const parts = trimmed.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  // Time without colon (e.g., "900" or "0900" or "1800")
  if (/^[0-9]{3,4}$/.test(trimmed)) {
    let hours, minutes;
    
    if (trimmed.length === 3) {
      // 900 -> 09:00
      hours = parseInt(trimmed[0]);
      minutes = parseInt(trimmed.substring(1));
    } else if (trimmed.length === 4) {
      // 0900 -> 09:00 or 1800 -> 18:00
      hours = parseInt(trimmed.substring(0, 2));
      minutes = parseInt(trimmed.substring(2));
    }
    
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  return null;
}

export function isValidNormalizedTime(time) {
  if (!time) return false;
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

export function formatTimeForDisplay(time) {
  if (!time) return '--:--';
  return time;
}

export default {
  normalizeTime,
  isValidNormalizedTime,
  formatTimeForDisplay
};