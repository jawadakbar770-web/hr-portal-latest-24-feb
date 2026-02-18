import React, { useState } from 'react';
import { Edit2, Lock, Eye, Trash2, Send, MoreVertical, X } from 'lucide-react';
import EditEmployeeModal from './EditEmployeeModal';
import GhostModeView from './GhostModeView';

export default function EmployeeActionsMenu({
  employee,
  onFreeze,
  onArchive,
  onEdit,
  onClose,
  onResendInvite,
  onRefresh
}) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGhostMode, setShowGhostMode] = useState(false);

  const handleEdit = () => {
    setShowEditModal(true);
    onClose();
  };

  const handleGhostMode = () => {
    setShowGhostMode(true);
    onClose();
  };

  const handleFreeze = () => {
    onFreeze();
    onClose();
  };

  const handleArchive = () => {
    if (window.confirm('Are you sure you want to archive this employee?')) {
      onArchive();
      onClose();
    }
  };

  const handleResendInvite = () => {
    onResendInvite();
    onClose();
  };

  return (
    <>
      {/* Menu Dropdown */}
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-40 border border-gray-200">
        {/* Edit Option */}
        <button
          onClick={handleEdit}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b text-sm transition"
        >
          <Edit2 size={18} className="text-blue-600" />
          <span className="text-gray-700 font-medium">Edit Information</span>
        </button>

        {/* Ghost Mode Option */}
        <button
          onClick={handleGhostMode}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b text-sm transition"
        >
          <Eye size={18} className="text-purple-600" />
          <span className="text-gray-700 font-medium">Ghost Mode</span>
        </button>

        {/* Freeze/Unfreeze Option */}
        <button
          onClick={handleFreeze}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b text-sm transition"
        >
          <Lock size={18} className={employee.status === 'Frozen' ? 'text-green-600' : 'text-orange-600'} />
          <span className="text-gray-700 font-medium">
            {employee.status === 'Frozen' ? 'Unfreeze Account' : 'Freeze Account'}
          </span>
        </button>

        {/* Archive Option */}
        <button
          onClick={handleArchive}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 border-b text-sm transition"
        >
          <Trash2 size={18} className="text-red-600" />
          <span className="text-red-700 font-medium">Archive Employee</span>
        </button>

        {/* Resend Invite Option (only for Inactive) */}
        {employee.status === 'Inactive' && (
          <button
            onClick={handleResendInvite}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 text-sm transition"
          >
            <Send size={18} className="text-green-600" />
            <span className="text-gray-700 font-medium">Resend Invite</span>
          </button>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditEmployeeModal
          employee={employee}
          onClose={() => {
            setShowEditModal(false);
            onRefresh?.();
          }}
          onSave={() => {
            onRefresh?.();
          }}
        />
      )}

      {/* Ghost Mode View */}
      {showGhostMode && (
        <GhostModeView
          employee={employee}
          onClose={() => setShowGhostMode(false)}
        />
      )}
    </>
  );
}