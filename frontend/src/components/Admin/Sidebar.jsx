import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Clock, BarChart3, Bell, LogOut, ChevronDown } from 'lucide-react';

export default function Sidebar({ isOpen, toggleSidebar }) {
  const navigate = useNavigate();
  const [expandedMenu, setExpandedMenu] = React.useState(null);

  const menuItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/admin/dashboard' },
    { label: 'Manage Employees', icon: <Users size={20} />, path: '/admin/employees' },
    { label: 'Manual Attendance', icon: <Clock size={20} />, path: '/admin/attendance' },
    { label: 'Payroll Reports', icon: <BarChart3 size={20} />, path: '/admin/payroll' },
    { label: 'Notifications', icon: <Bell size={20} />, path: '/admin/notifications' }
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-20"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative w-64 bg-gray-900 text-white h-screen transition-transform duration-300 z-30 md:z-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold text-blue-400">HR Portal</h2>
        </div>

        <nav className="space-y-2 px-4">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                toggleSidebar();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors text-left"
            >
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-6 left-4 right-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-left"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}