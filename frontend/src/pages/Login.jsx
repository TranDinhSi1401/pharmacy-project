/**
 * ============================================================
 * FILE: Login.jsx — Trang Đăng nhập hệ thống
 * ============================================================
 * Chức năng:
 *   Cho phép nhân viên đăng nhập bằng Mã NV + Mật khẩu.
 *   Gọi API Backend để xác thực, nhận JWT Token và thông tin nhân viên.
 *   Lưu token + thông tin nhân viên vào LocalStorage để dùng ở các trang khác.
 *
 * Luồng hoạt động:
 *   1. Nhân viên nhập Mã NV (VD: NV-0001) và Mật khẩu
 *   2. Gọi POST /api/auth/login → nhận { token, employee }
 *   3. Giải mã JWT để lấy vai trò (ADMIN / USER)
 *   4. Lưu vào LocalStorage → chuyển hướng đến trang POS
 * ============================================================
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, Key, Heart } from 'lucide-react';
import axios from '../api/axios';

const Login = () => {
  const navigate = useNavigate();

  // === CÁC BIẾN TRẠNG THÁI (STATE) ===
  const [username, setUsername] = useState('');       // Mã nhân viên người dùng nhập
  const [password, setPassword] = useState('');       // Mật khẩu người dùng nhập
  const [showPassword, setShowPassword] = useState(false); // Ẩn/hiện mật khẩu
  const [error, setError] = useState('');             // Thông báo lỗi hiển thị trên giao diện
  const [loading, setLoading] = useState(false);      // Trạng thái đang xử lý (hiệu ứng loading)

  /**
   * handleLogin — Xử lý sự kiện khi nhân viên nhấn nút "Đăng nhập"
   *
   * @param {Event} e - Sự kiện submit của form
   *
   * Cách hoạt động:
   *   1. Kiểm tra dữ liệu đầu vào (không được bỏ trống)
   *   2. Gọi API đăng nhập: POST /api/auth/login
   *   3. Nhận phản hồi chứa JWT Token và thông tin nhân viên
   *   4. Giải mã phần payload của JWT để lấy vai trò (scope = "ADMIN" hoặc "USER")
   *   5. Lưu thông tin vào LocalStorage
   *   6. Chuyển hướng vào trang bán hàng (POS)
   */
  const handleLogin = async (e) => {
    e.preventDefault();

    // Bước 1: Kiểm tra dữ liệu đầu vào cơ bản
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ mã nhân viên và mật khẩu.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Bước 2: Gọi API đăng nhập
      // Backend nhận trường 'employeeId' (không phải 'username')
      const response = await axios.post('/api/auth/login', {
        employeeId: username.trim(),
        password: password.trim()
      });

      // Bước 3: Lấy dữ liệu từ phản hồi
      const token = response.data.token;       // Chuỗi JWT Token
      const employee = response.data.employee; // Thông tin nhân viên (id, firstName, lastName,...)

      // Bước 4: Giải mã JWT Token để lấy vai trò nhân viên
      // Chuỗi JWT gồm 3 phần: header.payload.signature (phân cách bằng dấu chấm)
      // Phần payload (phần thứ 2) được mã hóa Base64, chứa trường 'scope' là vai trò
      let isAdmin = false;
      try {
        const payloadDecoded = JSON.parse(atob(token.split('.')[1]));
        isAdmin = payloadDecoded.scope === 'ADMIN';
      } catch (e) {
        console.error('Lỗi giải mã JWT token:', e);
      }

      // Gắn thông tin vai trò vào object employee để dùng ở các trang khác
      employee.account = {
        isAdmin: isAdmin,
        isBatchManager: false
      };

      // Bước 5: Lưu thông tin vào LocalStorage
      localStorage.setItem('activeEmployee', JSON.stringify(employee));
      localStorage.setItem('authToken', token);

      // Bước 6: Chuyển hướng vào trang POS (Bán hàng)
      navigate('/');
    } catch (err) {
      // Hiển thị thông báo lỗi từ Backend hoặc lỗi mặc định
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // === PHẦN GIAO DIỆN (JSX) ===
  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center p-4 bg-slate-950 overflow-hidden">

      {/* Hiệu ứng nền trang trí (Background Blobs) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-emerald-500/15 to-teal-500/10 blur-3xl pointer-events-none animate-liquid-1"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-teal-500/15 to-emerald-500/10 blur-3xl pointer-events-none animate-liquid-2"></div>
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-gradient-to-r from-emerald-400/8 to-teal-400/8 blur-3xl pointer-events-none animate-liquid-3"></div>

      {/* Khung đăng nhập chính (Glassmorphic Card) */}
      <div className="relative w-full max-w-md glass-panel rounded-2xl p-8 animate-fade-in shadow-2xl z-10">

        {/* Logo và tiêu đề */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 mb-4 shadow-lg shadow-emerald-500/25">
            <Heart className="w-8 h-8 fill-current text-slate-950" />
          </div>
          <h2 className="text-2xl font-bold tracking-wide bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
            HỆ THỐNG AN KHANG
          </h2>
          <p className="text-slate-400 text-sm mt-1">Đăng nhập cổng thông tin nhân viên</p>
        </div>

        {/* Hiển thị thông báo lỗi (nếu có) */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/20 text-red-300 text-sm leading-relaxed animate-pulse">
            {error}
          </div>
        )}

        {/* Form đăng nhập */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Ô nhập Mã nhân viên */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              Mã nhân viên
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Nhập mã nhân viên..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-medium focus:ring-1 focus:ring-emerald-500"
                disabled={loading}
              />
            </div>
          </div>

          {/* Ô nhập Mật khẩu */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 pl-1">
              Mật khẩu
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-xl glass-input text-sm font-medium focus:ring-1 focus:ring-emerald-500"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nút Đăng nhập */}
          <button
            type="submit"
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-semibold tracking-wide hover:from-emerald-400 hover:to-teal-400 transition-all duration-300 transform active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2 cursor-pointer"
            disabled={loading}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Đăng Nhập Hệ Thống
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
