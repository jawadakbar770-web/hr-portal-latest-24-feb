/**
 * CSV Import Service
 * Handles CSV file upload and processing
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export async function uploadCSVFile(file) {
  try {
    const formData = new FormData();
    formData.append('csvFile', file);

    const token = localStorage.getItem('token');
    
    if (!token) {
      return {
        success: false,
        error: 'No authentication token found',
        processingLog: [{
          type: 'ERROR',
          message: 'Authentication error: Please login again'
        }]
      };
    }

    const response = await axios.post(
      `${API_BASE_URL}/attendance/import-csv`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000 // 60 seconds timeout for large files
      }
    );

    return {
      success: true,
      data: response.data,
      processingLog: response.data.processingLog || []
    };
  } catch (error) {
    let errorMsg = error.message;
    let processingLogs = [];

    if (error.response) {
      errorMsg = error.response.data?.message || error.response.statusText;
      processingLogs = error.response.data?.processingLog || [];
    } else if (error.request) {
      errorMsg = 'No response from server. Please check your connection.';
    }

    return {
      success: false,
      error: errorMsg,
      processingLog: processingLogs.length > 0 ? processingLogs : [{
        type: 'ERROR',
        message: errorMsg
      }]
    };
  }
}

export async function getAttendanceRange(fromDate, toDate) {
  try {
    const token = localStorage.getItem('token');

    if (!token) {
      return {
        success: false,
        error: 'No authentication token found'
      };
    }

    const response = await axios.get(
      `${API_BASE_URL}/attendance/range?fromDate=${fromDate}&toDate=${toDate}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

const csvService = {
  uploadCSVFile,
  getAttendanceRange
};

export default csvService;