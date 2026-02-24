/**
 * Time Normalizer
 * Accepts flexible time input and normalizes to HH:mm
 */

export function normalizeTime(timeInput) {
  if (!timeInput) return null;

  const trimmed = String(timeInput).trim();
  if (!trimmed) return null;

  // Already in proper format HH:mm
  if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed)) {
    return trimmed;
  }

  // Flexible format: 9:00, 9:5, 09:00, 09:05, 900, 0900, etc.
  const colonParts = trimmed.split(':');
  
  if (colonParts.length === 2) {
    const hours = parseInt(colonParts[0]);
    const minutes = parseInt(colonParts[1]);

    if (isNaN(hours) || isNaN(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // Without colon: 900, 0900, 1800, etc.
  if (/^[0-9]{3,4}$/.test(trimmed)) {
    let hours, minutes;
    
    if (trimmed.length === 3) {
      hours = parseInt(trimmed[0]);
      minutes = parseInt(trimmed.substring(1));
    } else {
      hours = parseInt(trimmed.substring(0, 2));
      minutes = parseInt(trimmed.substring(2));
    }

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  return null;
}

export function isValidTime(time) {
  if (!time) return false;
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

export function formatTimeDisplay(time) {
  if (!time) return '--:--';
  return time;
}

const timeUtils = {
  normalizeTime,
  isValidTime,
  formatTimeDisplay
};

export default timeUtils;