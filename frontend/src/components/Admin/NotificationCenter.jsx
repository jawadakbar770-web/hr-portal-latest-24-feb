import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Calendar, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr; // already formatted string
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

export default function NotificationCenter() {
  const [activeBlock,         setActiveBlock]         = useState('leaves');
  const [leaveRequests,       setLeaveRequests]       = useState([]);
  const [correctionRequests,  setCorrectionRequests]  = useState([]);
  const [fromDate,            setFromDate]            = useState(
    new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [loading,      setLoading]      = useState(true);
  // FIX #5: reject modal state
  const [rejectModal,  setRejectModal]  = useState({ open: false, type: null, id: null });
  const [rejectReason, setRejectReason] = useState('');

  const fromDateRef = useRef(null);
  const toDateRef   = useRef(null);

  const getToken = () => localStorage.getItem('token');

  // ── Fetch from correct endpoint ───────────────────────────────────────────
  // FIX #1: was calling /api/notifications/pending which only returns Pending.
  // Use /api/requests/admin/pending so status filter actually works.
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      // FIX #1: correct endpoint that supports date-range (days param)
      const days = Math.ceil((new Date(toDate) - new Date(fromDate)) / 86400000) + 1;
      const response = await axios.get(`/api/requests/admin/pending?days=${Math.max(days, 1)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let leaves      = response.data.leaveRequests      || [];
      let corrections = response.data.correctionRequests || [];

      // FIX #2: /api/requests/admin/pending only returns Pending.
      // For Approved/Rejected we need a different approach — filter client-side
      // from a broader query isn't possible here. Show a note when non-Pending selected.
      // Status filter is kept for UI consistency but the endpoint is Pending-only.

      // Date filter (client-side narrowing within the returned window)
      const from = new Date(fromDate);
      const to   = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      leaves      = leaves.filter(r => { const d = new Date(r.createdAt); return d >= from && d <= to; });
      corrections = corrections.filter(r => { const d = new Date(r.createdAt); return d >= from && d <= to; });

      setLeaveRequests(leaves);
      setCorrectionRequests(corrections);
    } catch {
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ── Approve leave ─────────────────────────────────────────────────────────
  const handleApproveLeave = async (id) => {
    try {
      await axios.patch(`/api/requests/leave/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success('Leave approved');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve leave');
    }
  };

  // ── Approve correction ────────────────────────────────────────────────────
  const handleApproveCorrection = async (id) => {
    try {
      await axios.patch(`/api/requests/correction/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success('Correction approved');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve correction');
    }
  };

  // FIX #5: reject handlers — were empty onClick={() => {}}
  const openRejectModal = (type, id) => {
    setRejectModal({ open: true, type, id });
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    try {
      const endpoint = rejectModal.type === 'leave'
        ? `/api/requests/leave/${rejectModal.id}/reject`
        : `/api/requests/correction/${rejectModal.id}/reject`;

      await axios.patch(endpoint, { reason: rejectReason }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success(`${rejectModal.type === 'leave' ? 'Leave' : 'Correction'} rejected`);
      setRejectModal({ open: false, type: null, id: null });
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  // FIX #3: removed handleClearAll — /api/notifications/clear does not exist in backend

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Notification Center</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <div className="relative">
              <input type="date" ref={fromDateRef} value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none" />
              <div onClick={() => fromDateRef.current?.showPicker()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg flex items-center justify-between cursor-pointer bg-white">
                <span>{formatDateToDisplay(fromDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <div className="relative">
              <input type="date" ref={toDateRef} value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none" />
              <div onClick={() => toDateRef.current?.showPicker()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg flex items-center justify-between cursor-pointer bg-white">
                <span>{formatDateToDisplay(toDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
            </div>
          </div>
          {/* FIX #2: Status filter note — endpoint is Pending-only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status <span className="text-xs text-gray-400">(Pending only from API)</span>
            </label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={fetchRequests}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex border-b">
          <button onClick={() => setActiveBlock('leaves')}
            className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
              activeBlock === 'leaves'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}>
            Leave Requests ({leaveRequests.length})
          </button>
          <button onClick={() => setActiveBlock('corrections')}
            className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
              activeBlock === 'corrections'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}>
            Correction Requests ({correctionRequests.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* ── Leave Requests ─────────────────────────────────────────────── */}
          {activeBlock === 'leaves' && (
            <div className="overflow-x-auto">
              {leaveRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No pending leave requests</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-left">Leave Type</th>
                      {/* FIX #4: show both fromDate and toDate (not just date) */}
                      <th className="px-4 py-3 text-left">From</th>
                      <th className="px-4 py-3 text-left">To</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-left">Submitted</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaveRequests.map(r => (
                      <tr key={r._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-medium">{r.empName}</span>
                          <br />
                          <span className="text-xs text-gray-500">{r.empNumber}</span>
                        </td>
                        <td className="px-4 py-3">{r.leaveType}</td>
                        {/* FIX #4: use fromDateFormatted / toDateFormatted from backend */}
                        <td className="px-4 py-3">{r.fromDateFormatted || formatDateToDisplay(r.fromDate)}</td>
                        <td className="px-4 py-3">{r.toDateFormatted   || formatDateToDisplay(r.toDate)}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.reason}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDateToDisplay(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => handleApproveLeave(r._id)}
                              className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200" title="Approve">
                              <Check size={18} />
                            </button>
                            {/* FIX #5: reject button now opens modal */}
                            <button onClick={() => openRejectModal('leave', r._id)}
                              className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Reject">
                              <X size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Correction Requests ───────────────────────────────────────── */}
          {activeBlock === 'corrections' && (
            <div className="overflow-x-auto">
              {correctionRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No pending correction requests</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Original In</th>
                      <th className="px-4 py-3 text-left">Corrected In</th>
                      <th className="px-4 py-3 text-left">Original Out</th>
                      <th className="px-4 py-3 text-left">Corrected Out</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {correctionRequests.map(r => (
                      <tr key={r._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-medium">{r.empName}</span>
                          <br />
                          <span className="text-xs text-gray-500">{r.empNumber}</span>
                        </td>
                        {/* FIX #4: use dateFormatted from backend */}
                        <td className="px-4 py-3">{r.dateFormatted || formatDateToDisplay(r.date)}</td>
                        <td className="px-4 py-3">{r.correctionType}</td>
                        {/* FIX #8: show original times alongside corrected times */}
                        <td className="px-4 py-3 text-gray-500">{r.originalInTime  || '--'}</td>
                        <td className="px-4 py-3 font-medium">{r.correctedInTime  || '--'}</td>
                        <td className="px-4 py-3 text-gray-500">{r.originalOutTime || '--'}</td>
                        <td className="px-4 py-3 font-medium">{r.correctedOutTime || '--'}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.reason}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => handleApproveCorrection(r._id)}
                              className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200" title="Approve">
                              <Check size={18} />
                            </button>
                            {/* FIX #5: reject button now opens modal */}
                            <button onClick={() => openRejectModal('correction', r._id)}
                              className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Reject">
                              <X size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* FIX #5: Reject reason modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Reject {rejectModal.type === 'leave' ? 'Leave' : 'Correction'} Request
            </h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for rejection <span className="text-red-500">*</span>
            </label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Enter reason..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal({ open: false, type: null, id: null })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
                Cancel
              </button>
              <button onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}