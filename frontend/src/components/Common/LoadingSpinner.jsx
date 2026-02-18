import React from 'react';

export default function LoadingSpinner({ size = 'md', message = 'Loading...' }) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`${sizes[size]} animate-spin rounded-full border-4 border-gray-300 border-t-blue-600`}></div>
      {message && <p className="mt-4 text-gray-600 font-medium">{message}</p>}
    </div>
  );
}