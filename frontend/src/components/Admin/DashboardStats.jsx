import React from 'react';

export default function DashboardStats({ title, value, icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`${color} text-white rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow w-full`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-90">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </button>
  );
}