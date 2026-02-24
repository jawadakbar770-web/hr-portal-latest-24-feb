import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export default function CSVProcessingLog({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return null;
  }

  const getLogIcon = (type) => {
    switch (type) {
      case 'ERROR':
        return <AlertCircle size={16} className="text-red-600 flex-shrink-0" />;
      case 'WARN':
        return <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0" />;
      case 'SUCCESS':
        return <CheckCircle size={16} className="text-green-600 flex-shrink-0" />;
      case 'INFO':
        return <Info size={16} className="text-blue-600 flex-shrink-0" />;
      case 'SUMMARY':
        return <CheckCircle size={16} className="text-purple-600 flex-shrink-0" />;
      default:
        return null;
    }
  };

  const getLogBgColor = (type) => {
    switch (type) {
      case 'ERROR':
        return 'bg-red-50 border-red-200';
      case 'WARN':
        return 'bg-yellow-50 border-yellow-200';
      case 'SUCCESS':
        return 'bg-green-50 border-green-200';
      case 'INFO':
        return 'bg-blue-50 border-blue-200';
      case 'SUMMARY':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getLogTextColor = (type) => {
    switch (type) {
      case 'ERROR':
        return 'text-red-700';
      case 'WARN':
        return 'text-yellow-700';
      case 'SUCCESS':
        return 'text-green-700';
      case 'INFO':
        return 'text-blue-700';
      case 'SUMMARY':
        return 'text-purple-700 font-bold';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-800 mb-3">📊 Processing Log</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={`flex gap-3 p-3 rounded border ${getLogBgColor(log.type)}`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getLogIcon(log.type)}
            </div>
            <div className={`text-xs ${getLogTextColor(log.type)} flex-1 whitespace-pre-wrap`}>
              {log.message}
              {log.rowNumber && (
                <span className="text-xs opacity-75 block">Row {log.rowNumber}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}