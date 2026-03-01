import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Bell, Menu } from "lucide-react";
import { logout, getUser } from "../../services/auth";
import toast from "react-hot-toast";

export default function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const user = getUser();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    setShowDropdown(false);

    logout(); // clear localStorage FIRST
    toast.success("Logged out successfully");

    navigate("/", { replace: true }); // then navigate
    window.location.reload(); // ensure all state is reset
  };

  const handleProfile = () => {
    // FIX 2: read role from the stored user object, not a bare 'role' key
    const role = user?.role;
    navigate(
      role === "admin" || role === "superadmin"
        ? "/admin/profile"
        : "/employee/profile",
    );
    setShowDropdown(false);
  };

  const initials =
    `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <header className="bg-white shadow sticky top-0 z-40 border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        {/* Menu toggle */}
        <button
          onClick={onMenuClick}
          className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>

        {/* Brand */}
        <h1 className="text-lg md:text-xl font-bold text-gray-800 flex-1 text-center md:text-left ml-4 md:ml-0">
          NOORI
        </h1>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Bell */}
          <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition">
            <Bell size={20} />
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown((v) => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs select-none">
                {initials || "?"}
              </div>
              <span className="hidden md:inline text-sm font-medium text-gray-700">
                {user?.firstName}
              </span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg z-50 border border-gray-200 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="font-semibold text-gray-800 text-sm">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {user?.email}
                  </p>
                </div>

                {/* Profile */}
                <button
                  onClick={handleProfile}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition text-sm border-b border-gray-100"
                >
                  <User size={16} className="text-gray-400" />
                  My Profile
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition text-sm"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
