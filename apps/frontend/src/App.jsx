import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, BarChart3, LogOut, Activity, User, Heart } from 'lucide-react';
import Login from './pages/Login';
import POS from './pages/POS';
import History from './pages/History';

// 1. Component bảo vệ định tuyến (Protected Route Wrapper)
// Mục đích: Nếu nhân viên chưa đăng nhập (không tìm thấy trong localStorage), 
// hệ thống sẽ tự động chuyển hướng về trang /login. Ngược lại mới hiển thị nội dung bên trong.
const ProtectedRoute = ({ children }) => {
  const employee = localStorage.getItem('activeEmployee');
  if (!employee) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// 2. Component Layout chính của bảng điều khiển (Dashboard Layout)
const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Khởi tạo state employee bằng cách đọc dữ liệu đã lưu trữ từ LocalStorage.
  // Dùng hàm ẩn danh (lazy initialization) để chỉ chạy việc đọc LocalStorage đúng 1 lần khi tải trang.
  const [employee, setEmployee] = useState(() => {
    const saved = localStorage.getItem('activeEmployee');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Lỗi phân tích JSON activeEmployee:', e);
      return null;
    }
  });

  // useEffect đồng bộ lại dữ liệu của employee khi có sự thay đổi
  useEffect(() => {
    if (!employee) {
      const saved = localStorage.getItem('activeEmployee');
      try {
        if (saved) setEmployee(JSON.parse(saved));
      } catch (e) {
        setEmployee(null);
      }
    }
  }, [employee]);

  // Hàm xử lý khi nhấn Đăng xuất
  const handleLogout = () => {
    // Xóa sạch thông tin lưu trữ của phiên làm việc hiện tại
    localStorage.removeItem('activeEmployee');
    localStorage.removeItem('authToken');
    // Chuyển hướng người dùng về màn hình đăng nhập
    navigate('/login');
  };

  if (!employee) return null;

  const navItems = [
    { path: '/', label: 'Bán hàng (POS)', icon: ShoppingBag },
    { path: '/history', label: 'Lịch sử & Thống kê', icon: BarChart3 }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">

      {/* Sidebar - Modern Dark Emerald Panel */}
      <aside className="w-60 flex-shrink-0 flex flex-col justify-between border-r border-slate-800 bg-slate-900 bg-opacity-70 backdrop-blur-md">

        {/* Top Part */}
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-pharmacy-500 text-slate-950 shadow-lg shadow-pharmacy-500/20">
              <Heart className="w-6 h-6 fill-current text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                DƯỢC AN KHANG
              </h1>
              <p className="text-xs text-slate-400">Pharmacy POS System</p>
            </div>
          </div>

          {/* Active Cashier Profile */}
          <div className="p-4 mx-4 mt-6 rounded-xl border border-slate-800 bg-slate-950 bg-opacity-50">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 text-pharmacy-400 border border-slate-700">
                <User className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h2 className="text-sm font-semibold truncate">
                  {employee.lastName} {employee.firstName}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {employee.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Roles tags */}
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800">
              {employee.account?.isAdmin && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                  Admin
                </span>
              )}
              {employee.account?.isBatchManager && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
                  Thủ kho
                </span>
              )}
              {!employee.account?.isAdmin && !employee.account?.isBatchManager && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-pharmacy-500/10 text-pharmacy-400 border border-pharmacy-500/20 font-medium">
                  Nhân viên
                </span>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-8 px-4 space-y-1.5">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${isActive
                    ? 'bg-pharmacy-500 bg-opacity-10 text-pharmacy-400 border-l-4 border-pharmacy-500 pl-3 shadow-glass-light'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                >
                  <IconComp className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Part: Logout Button */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 bg-opacity-20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500 hover:bg-opacity-10 transition-all font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Primary Workspace View Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        <Routes>
          <Route path="/" element={<POS />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>

    </div>
  );
};

// Root Router Setup
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
