import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Filter, X } from 'lucide-react';
import LeaveRequestModal from './LeaveRequestModal';
import CorrectionRequestModal from './CorrectionRequestModal';
import toast from 'react-hot-toast';

export default function MyRequests() {
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [fromDate, setFromDate] = useState(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [fromDate, toDate, statusFilter, typeFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/requests/my-requests', {
        params: {
          fromDate,
          toDate,
          status: statusFilter !== 'All' ? statusFilter : undefined,
          type: typeFilter !== 'All' ? typeFilter.toLowerCase() : undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      const combined = [
        ...response.data.leaveRequests.map(r => ({ ...r, type: 'Leave' })),
        ...response.data.correctionRequests.map(r => ({ ...r, type: 'Correction' }))
      ];

      combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRequests(combined);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch requests');
      setLoading(false);
    }
  };

  const handleRequestSubmitted = () => {
    fetchRequests();
  };

  const filteredRequests = requests.filter(req =>
    req.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.empName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">My Requests</h1>

      {/* Action Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-2 border-transparent hover:border-blue-500"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Apply for Leave</h3>
          <p className="text-gray-600 text-sm">Submit a leave request</p>
        </button>

        <button
          onClick={() => setShowCorrectionModal(true)}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer border-2 border-transparent hover:border-blue-500"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Request Correction</h3>
          <p className="text-gray-600 text-sm">Correct your attendance times</p>
        </button>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="Leave">Leave</option>
              <option value="Correction">Correction</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchRequests}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Show List
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">Loading...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-600">No requests found</div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">In-Time</th>
                    <th className="px-4 py-3 text-left font-semibold">Out-Time</th>
                    <th className="px-4 py-3 text-left font-semibold">Reason</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRequests.map((request) => (
                    <tr key={request._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {new Date(request.fromDate || request.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium">{request.type}</td>
                      <td className="px-4 py-3">
                        {request.type === 'Leave' ? (
                          <span className="text-gray-500">Shift Default</span>
                        ) : (
                          request.correctedInTime || '--'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {request.type === 'Leave' ? (
                          <span className="text-gray-500">Shift Default</span>
                        ) : (
                          request.correctedOutTime || '--'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{request.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4">
              {filteredRequests.map((request) => (
                <div key={request._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{request.type}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(request.fromDate || request.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{request.reason}</p>
                  {request.type === 'Correction' && (
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      {request.correctedInTime} - {request.correctedOutTime}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showLeaveModal && (
        <LeaveRequestModal
          onClose={() => setShowLeaveModal(false)}
          onSubmit={handleRequestSubmitted}
        />
      )}
      {showCorrectionModal && (
        <CorrectionRequestModal
          onClose={() => setShowCorrectionModal(false)}
          onSubmit={handleRequestSubmitted}
        />
      )}
    </div>
  );
}