/**
 * CSV Validation Middleware
 * Validates CSV file before processing
 */

export function validateCSVFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No CSV file provided',
        error: 'CSV_FILE_MISSING',
        success: false
      });
    }

    // Check file type
    const validTypes = ['text/csv', 'text/plain', 'application/csv'];
    const isValidType = validTypes.includes(req.file.mimetype) || 
                        req.file.originalname.endsWith('.csv');
    
    if (!isValidType) {
      return res.status(400).json({
        message: 'Invalid file type. Please upload a CSV file.',
        error: 'INVALID_FILE_TYPE',
        success: false
      });
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({
        message: 'File size exceeds 5MB limit',
        error: 'FILE_SIZE_EXCEEDED',
        success: false
      });
    }

    // Check file is not empty
    if (req.file.size === 0) {
      return res.status(400).json({
        message: 'CSV file is empty',
        error: 'FILE_EMPTY',
        success: false
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      message: 'Error validating CSV file',
      error: error.message,
      success: false
    });
  }
}

export default validateCSVFile;