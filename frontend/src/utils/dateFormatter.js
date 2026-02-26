/**
 * Date Formatter Utility
 * All dates use dd/mm/yyyy format consistently
 */

/**
 * Parse dd/mm/yyyy string to Date object
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

  const date = new Date(year, month - 1, day);
  
  // Validate date is real
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Format Date object to dd/mm/yyyy
 */
export function formatDate(date) {
  if (!date) return '';

  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format Date object to dd/mm/yyyy HH:mm for display
 */
export function formatDateTime(date) {
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
 * Get today's date in dd/mm/yyyy
 */
export function getTodayDate() {
  return formatDate(new Date());
}

/**
 * Get date minus days in dd/mm/yyyy
 */
export function getDateMinusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

/**
 * Convert JavaScript Date to ISO string
 */
export function toISO(date) {
  if (!date) return null;
  return new Date(date).toISOString();
}

export function formatToDDMMYYYY(dateStr) {
  if (!dateStr) return "";

  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

const dateUtils = {
  parseDate,
  formatDate,
  formatDateTime,
  getTodayDate,
  getDateMinusDays,
  toISO
};

export default dateUtils;