/**
 * ============================================================
 * FILE: axios.js — Cấu hình Axios cho toàn bộ Frontend
 * ============================================================
 * Chức năng:
 *   Tạo 1 instance Axios dùng chung cho tất cả các trang (POS, History, Login).
 *   Tự động xử lý 2 việc quan trọng:
 *   1. Gắn JWT Token vào mọi request gửi đi (Request Interceptor)
 *   2. Bóc lớp vỏ ApiResponse<T> của Backend, chỉ lấy phần 'result' (Response Interceptor)
 * ============================================================
 */
import axios from 'axios';

// 1. Tạo instance Axios hướng tới Base URL của Backend API.
// baseURL lấy từ file .env hoặc mặc định rỗng (vì các trang đã viết sẵn tiền tố '/api').
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  }
});

// 2. Request Interceptor: Tự động chèn JWT Token vào Header của mọi yêu cầu gửi đi.
// Điều này giúp chúng ta không cần phải truyền thủ công token trong mỗi lần gọi axios.
instance.interceptors.request.use(
  (config) => {
    // Lấy token đã lưu trong LocalStorage từ bước đăng nhập
    const token = localStorage.getItem('authToken');
    if (token) {
      // Đính kèm token theo chuẩn Bearer Token vào header Authorization
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Response Interceptor: Tự động bóc tách vỏ ApiResponse<T> của Backend và xử lý lỗi hệ thống.
instance.interceptors.response.use(
  (response) => {
    // Backend luôn trả về gói JSON dạng { code: 1000, message: "...", result: T }
    // Nếu trong phản hồi có trường 'result', ta tự động bóc lớp vỏ và lấy dữ liệu chính 'result' trả về cho giao diện.
    if (response.data && typeof response.data === 'object' && 'result' in response.data) {
      response.data = response.data.result;
    }
    return response;
  },
  (error) => {
    // Xử lý lỗi bảo mật: Lỗi 401 Unauthorized (Chưa đăng nhập hoặc Token hết hạn)
    if (error.response && error.response.status === 401) {
      // Xóa thông tin đăng nhập cũ trong localStorage để bảo mật thông tin
      localStorage.removeItem('activeEmployee');
      localStorage.removeItem('authToken');
      // Chuyển hướng người dùng về trang đăng nhập nếu họ chưa ở đó
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
