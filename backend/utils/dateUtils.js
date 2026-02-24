/**
 * Date Utility Functions
 * All dates are in dd/mm/yyyy format for API and UI
 */

/**
 * Parse dd/mm/yyyy string to Date object (UTC midnight)
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;

  const trimmed = String(dateStr).trim();
  const parts = trimmed.split('/');

  if (parts.length !== 3) return null;

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  if (year < 1900 || year > 2100) return null;

  // Create date at UTC midnight
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Validate date is real (e.g., not Feb 30)
  if (date.getUTCDate() !== day) return null;

  return date;
}

/**
 * Format Date object to dd/mm/yyyy string
 */
export function formatDate(date) {
  if (!date) return '';

  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format Date object to dd/mm/yyyy HH:mm string for display
 */
export function formatDateTimeForDisplay(date) {
  if (!date) return '';

  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Convert Date to ISO string for API transmission
 */
export function formatDateISO(date) {
  if (!date) return null;
  return date.toISOString();
}

/**
 * Format timestamp for last modified display (dd/mm/yyyy HH:mm)
 */
export function formatLastModified(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return formatDateTimeForDisplay(date);
  } catch {
    return '';
  }
}

/**
 * Get today's date in dd/mm/yyyy format
 */
export function getTodayDate() {
  return formatDate(new Date());
}

/**
 * Get date minus days in dd/mm/yyyy format
 */
export function getDateMinusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

export default {
  parseDate,
  formatDate,
  formatDateTimeForDisplay,
  formatDateISO,
  formatLastModified,
  getTodayDate,
  getDateMinusDays
};