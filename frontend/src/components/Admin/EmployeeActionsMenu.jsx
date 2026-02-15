import React from 'react';
import { Edit2, Lock, Eye, Trash2, Send } from 'lucide-react';

export default function EmployeeActionsMenu({ employee, onFreeze, onArchive, onEdit, onResend, onGhostMode, onClose }) {
  return (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
      <button
        onClick={() => { onEdit(employee); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 border-b text-sm"
      >
        <Edit2 size={18} className="text-blue-500" />
        Edit Information
      </button>

      {/* Ghost Mode Button */}
      <button
        onClick={() => { onGhostMode(employee); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 border-b text-sm"
      >
        <Eye size={18} className="text-purple-500" />
        Ghost Mode
      </button>

      <button
        onClick={() => { onFreeze(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 border-b text-sm"
      >
        <Lock size={18} className="text-orange-500" />
        {employee.status === 'Frozen' ? 'Unfreeze' : 'Freeze'}
      </button>

      {/* Resend/View Invite Link */}
      <button
        onClick={() => { onResend(employee._id); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 border-b text-sm"
      >
        <Send size={18} className="text-green-500" />
        Get Invite Link
      </button>

      <button
        onClick={() => { onArchive(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 text-sm text-red-600"
      >
        <Trash2 size={18} />
        Archive
      </button>
    </div>
  );
}