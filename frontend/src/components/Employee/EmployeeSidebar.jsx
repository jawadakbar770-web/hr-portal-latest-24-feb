import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Clock, FileText, DollarSign, User, LogOut } from 'lucide-react';
import { logout } from '../../services/auth';

export default function EmployeeSidebar({ isOpen, toggleSidebar }) {
  const navigate = useNavigate();

  const menuItems = [
    { label: 'My Dashboard', icon: <LayoutDashboard size={20} />, path: '/employee/dashboard' },
    { label: 'Attendance History', icon: <Clock size={20} />, path: '/employee/attendance' },
    { label: 'My Requests', icon: <FileText size={20} />, path: '/employee/requests' },
    { label: 'My Salary', icon: <DollarSign size={20} />, path: '/employee/salary' },
    { label: 'Profile', icon: <User size={20} />, path: '/employee/profile' }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Overlay */}
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
          <p className="text-sm text-gray-400 mt-2">Employee Portal</p>
        </div>

        <nav className="space-y-2 px-4">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                toggleSidebar();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors text-left text-sm font-medium"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-6 left-4 right-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-left text-sm font-medium"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}