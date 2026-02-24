/**
 * CSV Helper Functions
 * Utilities for CSV file handling on frontend
 */

export function generateCSVTemplate() {
  const headers = ['empid', 'firstname', 'lastname', 'date(dd/mm/yyyy)', 'time(HH:mm)', 'status(0=in,1=out)'];
  const exampleRows = [
    ['EMP001', 'John', 'Doe', '23/02/2026', '09:00', '0'],
    ['EMP001', 'John', 'Doe', '23/02/2026', '18:00', '1'],
    ['EMP002', 'Jane', 'Smith', '23/02/2026', '09:15', '0'],
    ['EMP002', 'Jane', 'Smith', '23/02/2026', '17:45', '1']
  ];

  return [headers, ...exampleRows].map(row => row.join('|')).join('\n');
}

export function downloadCSVTemplate() {
  const template = generateCSVTemplate();
  const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'attendance_template.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function validateCSVFormat(content) {
  const lines = content.trim().split('\n');
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split('|');
    if (parts.length < 6) {
      errors.push({
        row: i + 1,
        message: `Invalid format. Expected 6 columns, got ${parts.length}`
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function formatCSVForDisplay(logs) {
  return logs.map(log => {
    let icon = '';
    if (log.type === 'ERROR') icon = '❌';
    if (log.type === 'WARN') icon = '⚠️';
    if (log.type === 'SUCCESS') icon = '✓';
    if (log.type === 'INFO') icon = 'ℹ️';
    if (log.type === 'SUMMARY') icon = '✅';

    return `${icon} ${log.message}`;
  }).join('\n');
}

const csvHelpers = {
  generateCSVTemplate,
  downloadCSVTemplate,
  validateCSVFormat,
  formatCSVForDisplay
};

export default csvHelpers;