import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, CalendarDays, Clock, TrendingDown, ChevronRight, FileText, ClipboardEdit } from 'lucide-react';
import toast from 'react-hot-toast';

// ── date helpers ──────────────────────────────────────────────────────────────

/** Format a JS Date → "dd/mm/yyyy" (what /api/payroll/my/summary expects) */
const toApiDate = (date) => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

/**
 * Company pay period: 18th of previous month → 17th of current month.
 * If today is before the 18th we're still in the previous cycle.
 */
const getCurrentPayPeriod = () => {
  const today = new Date();
  const day   = today.getDate();
  const year  = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  let periodStart, periodEnd;

  if (day >= 18) {
    // cycle started this month on the 18th, ends next month on the 17th
    periodStart = new Date(year, month, 18);
    periodEnd   = new Date(year, month + 1, 17);
  } else {
    // cycle started last month on the 18th, ends this month on the 17th
    periodStart = new Date(year, month - 1, 18);
    periodEnd   = new Date(year, month, 17);
  }

  // Cap end to today so we only fetch data that exists
  const effectiveEnd = periodEnd > today ? today : periodEnd;

  return {
    startDate:    toApiDate(periodStart),
    endDate:      toApiDate(effectiveEnd),
    nextPayDate:  `17th ${new Date(year, day >= 18 ? month + 1 : month, 1)
                    .toLocaleString('en-US', { month: 'long', year: 'numeric' })}`
  };
};

// ─────────────────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const navigate = useNavigate();

  const [showEarnings, setShowEarnings]   = useState(true);
  const [currentEarnings, setCurrentEarnings] = useState(0);
  const [stats, setStats] = useState({
    daysWorked:      0,
    otHours:         0,
    totalDeductions: 0,
    nextPayDate:     '—',
  });
  const [loading, setLoading] = useState(true);
  const [user,    setUser]    = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');

      // FIX 1: correct route  → GET /api/payroll/my/summary  (employeeAuth, no :id)
      // FIX 2: correct params → startDate / endDate  (not fromDate / toDate)
      const { startDate, endDate, nextPayDate } = getCurrentPayPeriod();

      const response = await axios.get('/api/payroll/my/summary', {
        params:  { startDate, endDate },
        headers: { Authorization: `Bearer ${token}` },
      });

      const { summary, dailyBreakdown = [] } = response.data;

      // FIX 3: hoursWorked  (not hoursPerDay)
      const daysWorked = dailyBreakdown.filter(d => (d.hoursWorked ?? 0) > 0).length;

      // FIX 4: sum d.otHours  (not count days where otAmount > 0)
      const otHours = dailyBreakdown.reduce((sum, d) => sum + (d.otHours ?? 0), 0);

      // FIX 5: totalDeduction  (not deductionTotal)
      const totalDeductions = summary?.totalDeduction ?? 0;

      setCurrentEarnings(summary?.netSalary ?? 0);
      setStats({ daysWorked, otHours: parseFloat(otHours.toFixed(2)), totalDeductions, nextPayDate });
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to load dashboard data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // FIX 6: quick-action buttons now navigate
  const quickActions = [
    {
      label:    'View Attendance',
      sub:      'Check your records',
      icon:     <CalendarDays size={20} className="text-blue-600" />,
      onClick:  () => navigate('/employee/attendance'),
    },
    {
      label:    'Submit Request',
      sub:      'Leave or correction',
      icon:     <ClipboardEdit size={20} className="text-purple-600" />,
      onClick:  () => navigate('/employee/requests'),
    },
    {
      label:    'Salary Details',
      sub:      'Detailed breakdown',
      icon:     <FileText size={20} className="text-green-600" />,
      onClick:  () => navigate('/employee/salary'),
    },
  ];

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-white shadow sticky top-0 z-30">
        <div className="flex items-center justify-between p-4 md:p-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Dashboard</h1>
            {user && (
              <p className="text-sm text-gray-500 mt-0.5">
                Welcome back, {user.firstName} {user.lastName}
              </p>
            )}
          </div>
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}` : '?'}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="p-4 md:p-6">
        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading…</div>
        ) : (
          <div className="space-y-6">

            {/* ── Earnings card ── */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl shadow-lg p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-blue-200 text-sm mb-1">Current Earnings (This Period)</p>
                  <h2 className="text-4xl font-bold tracking-tight">
                    {showEarnings
                      ? `PKR ${currentEarnings.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '••••••'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowEarnings(!showEarnings)}
                  className="p-2.5 bg-white/15 rounded-lg hover:bg-white/25 transition"
                  title={showEarnings ? 'Hide earnings' : 'Show earnings'}
                >
                  {showEarnings ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-blue-200 text-sm">
                Next payout: <span className="text-white font-medium">{stats.nextPayDate}</span>
              </p>
            </div>

            {/* ── Stats grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                icon={<CalendarDays size={20} className="text-blue-600" />}
                label="Days Worked"
                value={stats.daysWorked}
                bg="bg-blue-50"
              />
              <StatCard
                icon={<Clock size={20} className="text-amber-600" />}
                label="OT Hours"
                value={stats.otHours}
                bg="bg-amber-50"
              />
              <StatCard
                icon={<TrendingDown size={20} className="text-red-500" />}
                label="Total Deductions"
                value={`PKR ${stats.totalDeductions.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`}
                valueClass="text-red-600"
                bg="bg-red-50"
              />
            </div>

            {/* ── Quick actions ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg group-hover:scale-105 transition-transform">
                        {action.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{action.label}</p>
                        <p className="text-xs text-gray-500">{action.sub}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

// ── Small reusable stat card ──────────────────────────────────────────────────
function StatCard({ icon, label, value, valueClass = 'text-gray-800', bg = 'bg-gray-50' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>{icon}</div>
      <p className="text-gray-500 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}