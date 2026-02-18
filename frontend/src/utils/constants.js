export const DEPARTMENTS = [
  'IT',
  'Customer Support',
  'Manager',
  'Marketing',
  'HR',
  'Finance'
];

export const LEAVE_TYPES = [
  'Holiday Leave',
  'Sick Leave',
  'Casual Leave'
];

export const ATTENDANCE_STATUS = [
  'Present',
  'Late',
  'Leave',
  'Absent'
];

export const OT_MULTIPLIERS = [1, 1.5, 2];

export const TIME_FORMAT = 'HH:mm';

export const DATE_FORMAT = 'YYYY-MM-DD';

export const API_TIMEOUT = 30000; // 30 seconds

export const PAGINATION_LIMIT = 20;

export const TOAST_DURATION = 3000;

export const MESSAGES = {
  SUCCESS: {
    LOGIN: 'Logged in successfully!',
    CREATE: 'Created successfully!',
    UPDATE: 'Updated successfully!',
    DELETE: 'Deleted successfully!',
    SAVE: 'Saved successfully!'
  },
  ERROR: {
    NETWORK: 'Network error. Please try again.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    VALIDATION: 'Please check your input and try again.'
  },
  INFO: {
    LOADING: 'Loading...',
    PROCESSING: 'Processing...'
  }
};