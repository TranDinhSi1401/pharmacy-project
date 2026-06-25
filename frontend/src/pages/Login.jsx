import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, Key, Heart } from 'lucide-react';
import axios from '../api/axios';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Hàm xử lý sự kiện Đăng nhập
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ mã nhân viên và mật khẩu.');
      return;
    }

    setLoading(true); // Trạng thái đang tải (hiển thị hiệu ứng xoay tròn)
    setError('');

    try {
      // >>> MOCK LOGIN BẰNG ADMIN - TIỆN CHO VIỆC TEST GIAO DIỆN NHANH >>>
      if (username.trim() === 'admin' && password.trim() === '123456') {
        const mockEmployee = {
          id: 'EMP-ADMIN-001',
          firstName: 'Quản trị viên',
          lastName: 'Admin',
          username: 'admin',
          account: { isAdmin: true, isBatchManager: false }
        };
        localStorage.setItem('activeEmployee', JSON.stringify(mockEmployee));
        localStorage.setItem('authToken', 'mock-jwt-token-admin');
        navigate('/');
        return;
      }
      // <<< MOCK LOGIN BẰNG ADMIN <<<

      // Gọi API đăng nhập thực tế của Backend
      // Backend DTO (AuthenticationRequest) cần trường 'employeeId' thay vì 'username'
      const response = await axios.post('/api/auth/login', {
        employeeId: username.trim(),
        password: password.trim()
      });
      
      const token = response.data.token; // Chuỗi token JWT được trả về
      const employee = response.data.employee; // Thông tin nhân viên được trả về
      
      // GIẢI MÃ JWT TOKEN ĐỂ LẤY VAI TRÒ (ROLE) NHÂN VIÊN
      // Chuỗi JWT gồm 3 phần phân cách bằng dấu chấm (header.payload.signature).
      // Phần thứ 2 (payload) được mã hóa Base64 và chứa thông tin vai trò ở trường 'scope'.
      let isAdmin = false;
      try {
        // atob() là hàm có sẵn của trình duyệt để giải mã chuỗi Base64
        const payloadDecoded = JSON.parse(atob(token.split('.')[1]));
        isAdmin = payloadDecoded.scope === 'ADMIN'; // Quyền hạn được cấu hình ở Backend là ADMIN hoặc USER
      } catch (e) {
        console.error('Lỗi giải mã JWT token:', e);
      }
      
      // Đồng bộ cấu trúc tài khoản để phù hợp với code xử lý phân quyền ở Frontend
      employee.account = {
        isAdmin: isAdmin,
        isBatchManager: false
      };
      
      // Lưu lại thông tin nhân viên và JWT Token vào LocalStorage để tái sử dụng ở các trang khác
      localStorage.setItem('activeEmployee', JSON.stringify(employee));
      localStorage.setItem('authToken', token);
      
      // Đăng nhập thành công, chuyển hướng nhân viên vào trang POS (Bán hàng)
      navigate('/');
    } catch (err) {
      // Hiển thị thông điệp lỗi trả về từ Backend hoặc lỗi mặc định
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false); // Hoàn thành đăng nhập, tắt hiệu ứng xoay tròn
    }
  };


  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center p-4 bg-slate-950 overflow-hidden">
      
      {/* Liquid Glass Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-emerald-500/15 to-teal-500/10 blur-3xl pointer-events-none animate-liquid-1"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-teal-500/15 to-emerald-500/10 blur-3xl pointer-events-none animate-liquid-2"></div>
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-gradient-to-r from-emerald-400/8 to-teal-400/8 blur-3xl pointer-events-none animate-liquid-3"></div>

      {/* Glassmorphic Form Card */}
      <div className="relative w-full max-w-md glass-panel rounded-2xl p-8 animate-fade-in shadow-2xl z-10">
        
        {/* Logo and Greeting */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 mb-4 shadow-lg shadow-emerald-500/25">
            <Heart className="w-8 h-8 fill-current text-slate-950" />
          </div>
          <h2 className="text-2xl font-bold tracking-wide bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
            HỆ THỐNG AN KHANG
          </h2>
          <p className="text-slate-400 text-sm mt-1">Đăng nhập cổng thông tin nhân viên</p>
        </div>

        {/* Action Error Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/20 text-red-300 text-sm leading-relaxed animate-pulse">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLogin} className="space-y-5">
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
