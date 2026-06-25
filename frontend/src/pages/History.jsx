/**
 * ============================================================
 * FILE: History.jsx — Trang Lịch sử Hóa đơn & Thống kê Doanh thu
 * ============================================================
 *
 * 1. Mục tiêu chung:
 *    Trang này giải quyết bài toán QUẢN LÝ VÀ PHÂN TÍCH DOANH SỐ BÁN HÀNG
 *    của nhà thuốc. Người quản lý có thể:
 *    - Xem danh sách tất cả hóa đơn đã bán (lọc theo ngày, nhân viên, SĐT)
 *    - Theo dõi KPI: tổng hóa đơn, tổng doanh thu, giá trị trung bình/đơn
 *    - Trực quan hóa xu hướng doanh thu qua biểu đồ cột (theo ngày hoặc tháng)
 *    - Phân tích cơ cấu doanh thu theo nhóm thuốc qua biểu đồ tròn
 *
 * 2. Tư duy cốt lõi (Ý tưởng thuật toán):
 *    - "Lookup Map" (bảng băm): Thay vì duyệt mảng O(n) mỗi lần cần tìm
 *      tên nhân viên/khách hàng, ta xây bảng Map<id, object> để tra cứu O(1).
 *      Giống như tra từ điển theo chữ cái thay vì đọc từ đầu đến cuối.
 *    - React.useMemo(): "Ghi nhớ" kết quả tính toán. Chỉ tính lại khi dữ liệu
 *      đầu vào thực sự thay đổi, không tính lại khi click nút hay mở modal.
 *    - DRY (Don't Repeat Yourself): Logic tìm sản phẩm bị lặp 3 nơi, tách
 *      thành hàm resolveProduct() để dùng chung.
 * ============================================================
 */
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Search, Calendar, Filter, FileText, DollarSign,
  Users, CreditCard, ShoppingBag, X, User, Clock, Check
} from 'lucide-react';
import axios from '../api/axios';

const COLORS = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b'];

const History = () => {
  // Database States
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);

  const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const getCurrentDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Filter States
  const [startDate, setStartDate] = useState(getFirstDayOfCurrentMonth());
  const [endDate, setEndDate] = useState(getCurrentDateStr());
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  const availableYears = React.useMemo(() => {
    if (invoices.length === 0) return [new Date().getFullYear()];
    const years = invoices.map(inv => new Date(inv.createdDate).getFullYear());
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const result = [];
    for (let y = minYear; y <= maxYear; y++) {
      result.push(y);
    }
    return result;
  }, [invoices]);

  const handleStartDateChange = (val) => {
    setStartDate(val);
    setSelectedYear('');
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    setSelectedYear('');
  };

  const handleYearChange = (val) => {
    setSelectedYear(val);
    if (val) {
      setStartDate('');
      setEndDate('');
    } else {
      setStartDate(getFirstDayOfCurrentMonth());
      setEndDate(getCurrentDateStr());
    }
  };


  // Selected Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  /* ============================================================
   * MODULE: fetchData — Tải dữ liệu từ Backend
   * ============================================================
   * 1. Mục tiêu chung:
   *    Gọi 4 API cùng lúc để lấy: hóa đơn, sản phẩm, nhân viên, khách hàng.
   *
   * 2. Tư duy cốt lõi:
   *    Dùng Promise.allSettled() — gọi 4 API ĐỒNG THỜI (song song).
   *    Khác Promise.all(): nếu 1 API lỗi, các API khác vẫn trả kết quả.
   *    VD: API sản phẩm lỗi nhưng API hóa đơn vẫn hoạt động bình thường.
   * ============================================================ */
  const fetchData = async () => {
    try {
      const [invRes, prodRes, empRes, custRes] = await Promise.allSettled([
        axios.get('/api/invoices'),
        axios.get('/api/products'),
        axios.get('/api/employees'),
        axios.get('/api/customers')
      ]);

      const loadedInvoices = invRes.status === 'fulfilled' && Array.isArray(invRes.value.data) ? invRes.value.data : [];
      const loadedProducts = prodRes.status === 'fulfilled' && Array.isArray(prodRes.value.data)
        ? prodRes.value.data.map(prod => {
          const totalQuantity = (prod.batches || []).reduce((sum, batch) => sum + (batch.quantity || 0), 0);
          return { ...prod, totalQuantity };
        })
        : [];
      const loadedEmployees = empRes.status === 'fulfilled' && Array.isArray(empRes.value.data) ? empRes.value.data : [];
      const loadedCustomers = custRes.status === 'fulfilled' && Array.isArray(custRes.value.data) ? custRes.value.data : [];

      setInvoices(loadedInvoices);
      setProducts(loadedProducts);
      setEmployees(loadedEmployees);
      setCustomers(loadedCustomers);
    } catch (err) {
      console.warn('API chưa sẵn sàng, dữ liệu lịch sử sẽ trống:', err.message);
    }
  };

  // Load Data
  useEffect(() => {
    fetchData();
  }, []);

  /* ============================================================
   * MODULE: Lookup Maps — Bảng tra cứu nhanh O(1)
   * ============================================================
   * 1. Mục tiêu chung:
   *    Khi hiển thị bảng hóa đơn, mỗi dòng cần tra tên nhân viên, tên khách
   *    hàng, tên sản phẩm. Nếu dùng Array.find() mỗi lần → phải duyệt cả
   *    mảng → chậm O(n). Với 100 hóa đơn × 3 lần tra = 300 lần duyệt mảng!
   *
   * 2. Tư duy cốt lõi:
   *    Dùng cấu trúc dữ liệu Map (bảng băm / hash map):
   *    - Bước 1: Xây bảng tra 1 lần duy nhất khi dữ liệu thay đổi
   *      VD: Map { "NV-001" → {tên: "Nguyễn Văn A", ...} }
   *    - Bước 2: Tra cứu bằng map.get("NV-001") → kết quả ngay O(1)
   *
   *    useMemo() đảm bảo Map chỉ xây lại khi mảng gốc thay đổi,
   *    không xây lại khi người dùng click nút hay mở modal.
   * ============================================================ */

  // Map tra cứu nhân viên: employeeId → object nhân viên
  // VD: employeeMap.get("NV-001") → { id: "NV-001", firstName: "A", lastName: "Nguyễn" }
  const employeeMap = React.useMemo(() => {
    const map = new Map();                        // Tạo Map rỗng
    employees.forEach(emp => map.set(emp.id, emp)); // Nạp từng nhân viên vào Map
    return map;
  }, [employees]); // Chỉ xây lại khi danh sách nhân viên thay đổi

  // Map tra cứu khách hàng: customerId → object khách hàng
  const customerMap = React.useMemo(() => {
    const map = new Map();
    customers.forEach(cust => map.set(cust.id, cust));
    return map;
  }, [customers]);

  // Map tra cứu sản phẩm: productId → object sản phẩm
  const productMap = React.useMemo(() => {
    const map = new Map();
    products.forEach(prod => map.set(prod.id, prod));
    return map;
  }, [products]);

  /* --- Các hàm tiện ích tra cứu thông tin (dùng Map O(1)) --- */

  const getEmployeeName = (id) => {
    const emp = employeeMap.get(id); // O(1) thay vì Array.find() O(n)
    return emp ? `${emp.lastName} ${emp.firstName}` : id;
  };

  const getCustomerName = (id) => {
    const cust = customerMap.get(id);
    return cust ? `${cust.lastName} ${cust.firstName}` : 'Khách Vãng Lai';
  };

  const getCustomerPhone = (id) => {
    const cust = customerMap.get(id);
    return cust ? cust.phone : 'N/A';
  };

  /* ============================================================
   * MODULE: resolveProduct — Tìm sản phẩm từ nhiều nguồn ID
   * ============================================================
   * 1. Mục tiêu chung:
   *    Trong hóa đơn, mỗi dòng chi tiết có thể chứa productId hoặc chỉ có
   *    unitId. Ta cần tìm ra sản phẩm gốc từ bất kỳ thông tin nào có sẵn.
   *    Logic này bị LẶP LẠI ở 3 nơi: biểu đồ tròn, modal chi tiết, receipt.
   *    → Tách ra 1 hàm duy nhất theo nguyên tắc DRY.
   *
   * 2. Tư duy cốt lõi:
   *    Chiến lược "thử lần lượt" (fallback chain):
   *    Cách 1 → thất bại → thử Cách 2 → thất bại → thử Cách 3
   * ============================================================ */
  const resolveProduct = (detail) => {
    // Cách 1 (nhanh nhất): Tra trực tiếp bằng productId từ Map → O(1)
    if (detail.productId) {
      const found = productMap.get(detail.productId);
      if (found) return found;
    }

    // Cách 2: Suy ra productId từ unitId
    // VD: unitId = "DVT-0011-VI" → tách lấy "0011" → productId = "SP-0011"
    if (detail.unitId) {
      const parts = detail.unitId.split('-'); // ["DVT", "0011", "VI"]
      if (parts.length >= 2) {
        const derivedProductId = `SP-${parts[1]}`; // → "SP-0011"
        const found = productMap.get(derivedProductId);
        if (found) return found;
      }
    }

    // Cách 3 (chậm nhất, fallback cuối): Duyệt toàn bộ sản phẩm tìm unit khớp
    if (detail.unitId) {
      return products.find(p =>
        p.units && p.units.some(u => u.unitId === detail.unitId)
      ) || null;
    }

    return null; // Không tìm thấy sản phẩm nào
  };

  /* ============================================================
   * MODULE: filteredInvoices — Lọc hóa đơn theo bộ lọc người dùng
   * ============================================================
   * 1. Mục tiêu chung:
   *    Lọc hóa đơn theo: khoảng ngày, năm, nhân viên bán, SĐT khách hàng.
   *    Kết quả sau lọc được dùng cho: bảng danh sách, KPI, và cả 2 biểu đồ.
   *
   * 2. Tư duy cốt lõi:
   *    - Array.filter() với nhiều điều kiện AND (tất cả đều phải thỏa)
   *    - Bọc trong useMemo → chỉ lọc lại khi bộ lọc hoặc dữ liệu thay đổi
   *    - Không lọc lại khi mở modal, click nút xem chi tiết...
   * ============================================================ */
  const filteredInvoices = React.useMemo(() => {
    return invoices.filter(inv => {
      const createdDate = new Date(inv.createdDate);

      // 1. Lọc theo Năm hoặc Lọc theo khoảng ngày lập hóa đơn
      if (selectedYear) {
        if (createdDate.getFullYear() !== parseInt(selectedYear)) {
          return false;
        }
      } else {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (createdDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (createdDate > end) return false;
        }
      }

      // 2. Lọc theo ID nhân viên bán hàng
      if (selectedEmployeeId && inv.employeeId !== selectedEmployeeId) {
        return false;
      }

      // 3. Lọc theo Số điện thoại của khách hàng mua hàng
      if (searchPhone.trim()) {
        const phone = getCustomerPhone(inv.customerId);
        if (!phone.includes(searchPhone.trim())) return false;
      }

      return true;
    });
  }, [invoices, startDate, endDate, selectedYear, selectedEmployeeId, searchPhone, customers]);

  // Tính toán các chỉ số thống kê (KPIs)
  const totalInvoicesCount = filteredInvoices.length;
  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const averageOrderValue = totalInvoicesCount > 0 ? totalRevenue / totalInvoicesCount : 0;
  const totalCustomersRegistered = customers.length; // Số lượng khách hàng đăng ký tích lũy

  /* ============================================================
   * MODULE: dailyRevenueData — Dữ liệu biểu đồ doanh thu
   * ============================================================
   * 1. Mục tiêu chung:
   *    Chuẩn bị mảng dữ liệu cho biểu đồ cột (BarChart) Recharts.
   *    Có 2 chế độ xem:
   *    - Chế độ NĂM: hiển thị 12 cột theo tháng
   *    - Chế độ KHOẢNG NGÀY: hiển thị cột theo từng ngày
   *
   * 2. Tư duy cốt lõi:
   *    - Chế độ Năm: Lọc hóa đơn theo năm → gom theo tháng → tính tổng
   *    - Chế độ Ngày: Dùng filteredInvoices (đã lọc sẵn) → so khớp ngày
   *    - useMemo cache kết quả, chỉ tính lại khi bộ lọc thay đổi
   * ============================================================ */
  const dailyRevenueData = React.useMemo(() => {
    // Mode 1: Yearly view (selectedYear is set)
    if (selectedYear) {
      const yearInt = parseInt(selectedYear);
      const invoicesInYear = invoices.filter(inv => {
        const createdDate = new Date(inv.createdDate);
        return createdDate.getFullYear() === yearInt;
      });

      // Find the months that have sales in this year
      const monthsWithSalesSet = new Set();
      invoicesInYear.forEach(inv => {
        const createdDate = new Date(inv.createdDate);
        monthsWithSalesSet.add(createdDate.getMonth() + 1); // 1-12
      });

      const sortedMonths = Array.from(monthsWithSalesSet).sort((a, b) => a - b);

      const data = sortedMonths.map(m => {
        const total = invoicesInYear
          .filter(inv => new Date(inv.createdDate).getMonth() + 1 === m)
          .filter(inv => {
            if (selectedEmployeeId && inv.employeeId !== selectedEmployeeId) return false;
            if (searchPhone.trim()) {
              const phone = getCustomerPhone(inv.customerId);
              if (!phone.includes(searchPhone.trim())) return false;
            }
            return true;
          })
          .reduce((sum, inv) => sum + inv.totalAmount, 0);

        return {
          name: `Tháng ${m}`,
          'Doanh thu': total
        };
      });

      return data;
    }

    // Mode 2: Daily range view
    if (!startDate || !endDate) return [];

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) return [];

    const daysList = [];
    const current = new Date(start);
    while (current <= end) {
      daysList.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const dailyData = daysList.map(date => {
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const label = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;

      const total = filteredInvoices.reduce((sum, inv) => {
        const invDate = new Date(inv.createdDate);
        if (
          invDate.getDate() === day &&
          invDate.getMonth() + 1 === month &&
          invDate.getFullYear() === date.getFullYear()
        ) {
          return sum + inv.totalAmount;
        }
        return sum;
      }, 0);

      return {
        name: label,
        'Doanh thu': total
      };
    });

    return dailyData;
  }, [filteredInvoices, invoices, selectedYear, startDate, endDate, selectedEmployeeId, searchPhone, customers]);

  /* ============================================================
   * MODULE: categoryData — Dữ liệu biểu đồ tròn nhóm thuốc
   * ============================================================
   * 1. Mục tiêu chung:
   *    Phân tích doanh thu theo 3 nhóm: Thuốc kê đơn, Thuốc không kê đơn,
   *    Thực phẩm chức năng. Kết quả hiển thị trên biểu đồ tròn (PieChart).
   *
   * 2. Tư duy cốt lõi:
   *    - Duyệt qua chi tiết hóa đơn → dùng resolveProduct() tìm loại thuốc
   *    - Cộng dồn doanh thu vào đúng nhóm (object categoryTotals)
   *    - Cuối cùng chuyển sang format Recharts: [{name, value}, ...]
   * ============================================================ */
  const categoryData = React.useMemo(() => {
    const categoryTotals = {
      THUOC_KE_DON: 0,
      THUOC_KHONG_KE_DON: 0,
      THUC_PHAM_CHUC_NANG: 0
    };

    filteredInvoices.forEach(inv => {
      inv.details.forEach(item => {
        // Dùng helper resolveProduct() thay vì lặp lại 14 dòng code tìm sản phẩm
        // (nguyên tắc DRY — xem định nghĩa hàm ở phần Lookup Maps phía trên)
        const prod = resolveProduct(item);

        const cat = prod ? prod.type : 'OTHER';
        const lineTotal = item.price * item.quantity;

        if (categoryTotals[cat] !== undefined) {
          categoryTotals[cat] += lineTotal;
        } else {
          // Lô hàng mặc định xếp vào thuốc không kê đơn nếu không khớp danh mục
          categoryTotals.THUOC_KHONG_KE_DON += lineTotal;
        }
      });
    });

    // Định dạng cấu trúc đầu ra phù hợp với biểu đồ PieChart của thư viện Recharts
    return [
      { name: 'Thuốc kê đơn', value: categoryTotals.THUOC_KE_DON },
      { name: 'Thuốc không kê đơn', value: categoryTotals.THUOC_KHONG_KE_DON },
      { name: 'Thực phẩm chức năng', value: categoryTotals.THUC_PHAM_CHUC_NANG }
    ].filter(item => item.value > 0); // Chỉ hiển thị các nhóm có doanh thu thực tế
  }, [filteredInvoices, products]);

  // Reset all filters
  const handleClearFilters = () => {
    setStartDate(getFirstDayOfCurrentMonth());
    setEndDate(getCurrentDateStr());
    setSelectedYear('');
    setSelectedEmployeeId('');
    setSearchPhone('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-slate-950">

      {/* Liquid Glass Background Blobs */}
      <div className="absolute top-[5%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-emerald-500/8 to-teal-500/4 blur-3xl pointer-events-none animate-liquid-1 z-0"></div>
      <div className="absolute bottom-[5%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-teal-500/8 to-emerald-500/4 blur-3xl pointer-events-none animate-liquid-2 z-0"></div>

      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold tracking-wide text-slate-100">Lịch sử Hóa đơn & Thống kê doanh thu</h2>
        <p className="text-xs text-slate-400 mt-1">
          Theo dõi doanh số bán hàng, lọc đơn hàng và trực quan hóa cơ cấu sản phẩm.
        </p>
      </div>

      {/* KPI METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

        {/* KPI: Total Invoices */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 bg-opacity-40 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Tổng Số Hóa Đơn</span>
            <span className="text-2xl font-bold font-mono text-slate-100 block mt-0.5">{totalInvoicesCount}</span>
          </div>
        </div>

        {/* KPI: Total Revenue */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 bg-opacity-40 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Tổng Doanh Thu</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 block mt-0.5">{totalRevenue.toLocaleString()}đ</span>
          </div>
        </div>

        {/* KPI: Average Order Value */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 bg-opacity-40 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Doanh Thu TB / Đơn</span>
            <span className="text-2xl font-bold font-mono text-slate-100 block mt-0.5">{Math.round(averageOrderValue).toLocaleString()}đ</span>
          </div>
        </div>

        {/* KPI: Total Customers */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 bg-opacity-40 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Khách Hàng Tích Lũy</span>
            <span className="text-2xl font-bold font-mono text-slate-100 block mt-0.5">{totalCustomersRegistered}</span>
          </div>
        </div>

      </div>

      {/* FILTER PANEL */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 bg-opacity-30 backdrop-blur-md space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Filter className="w-4 h-4 text-emerald-400" />
          Bộ lọc hóa đơn
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {/* Start Date */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 pl-1">
              Từ ngày
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-input text-xs font-semibold"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 pl-1">
              Đến ngày
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-input text-xs font-semibold"
              />
            </div>
          </div>

          {/* Year selection dropdown */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 pl-1">
              Thống kê theo năm
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-input text-xs font-semibold focus:outline-none"
              >
                <option value="">Xem theo khoảng ngày</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cashier selection dropdown */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 pl-1">
              Nhân viên bán
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User className="w-3.5 h-3.5" />
              </span>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-input text-xs font-semibold focus:outline-none"
              >
                <option value="">Tất cả nhân viên</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.lastName} {emp.firstName} ({emp.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer lookup phone search */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 pl-1">
              SĐT khách hàng
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Tìm SĐT..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl glass-input text-xs font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Clear filter triggers */}
        <div className="flex justify-end pt-0.5">
          <button
            onClick={handleClearFilters}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 py-1 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-750 transition-colors border border-slate-700 cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* CHARTS CONTAINER SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Daily Revenue Bar Chart (col-span-2) */}
        <div className="md:col-span-2 p-4 rounded-2xl border border-slate-800 bg-slate-900 bg-opacity-40 flex flex-col h-64">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 pl-1">Xu hướng Doanh thu hàng ngày</h3>
          <div className="flex-1 w-full text-xs font-medium">
            {dailyRevenueData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 italic">Không có dữ liệu hiển thị biểu đồ</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                    formatter={(v) => [`${v.toLocaleString()}đ`, 'Doanh thu']}
                  />
                  <Bar dataKey="Doanh thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Product Category Revenue Pie Chart (col-span-1) */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 bg-opacity-40 flex flex-col h-64">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 pl-1">Cơ cấu Doanh thu nhóm thuốc</h3>
          <div className="flex-1 w-full text-xs font-medium relative">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 italic">Không có dữ liệu phân loại sản phẩm</div>
            ) : (
              <div className="h-full flex flex-col justify-between">
                <div className="flex-1 min-h-[110px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                        formatter={(v) => [`${v.toLocaleString()}đ`, entry => entry]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Labels legend representation list */}
                <div className="space-y-1 bg-slate-950/40 p-2 rounded-xl border border-slate-800/40 text-[9px]">
                  {categoryData.map((entry, index) => (
                    <div key={entry.name} className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        <span className="text-slate-400 font-medium">{entry.name}</span>
                      </div>
                      <span className="font-mono text-slate-200 font-bold">{entry.value.toLocaleString()}đ</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* INVOICES TABLE VIEW GRID */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 bg-opacity-40 overflow-hidden flex flex-col">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 pl-1">Danh sách hóa đơn giao dịch</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/30">
                <th className="p-4 rounded-l-lg">Mã Hóa Đơn</th>
                <th className="p-4">Thời gian</th>
                <th className="p-4">Nhân viên bán</th>
                <th className="p-4">Khách hàng</th>
                <th className="p-4 text-right">Tổng tiền</th>
                <th className="p-4">Thanh toán</th>
                <th className="p-4 rounded-r-lg text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500 font-medium">
                    Không tìm thấy hóa đơn nào khớp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="p-4 font-mono font-bold text-slate-200">{inv.id}</td>
                    <td className="p-4 font-mono text-[11px] text-slate-400">
                      {new Date(inv.createdDate).toLocaleString()}
                    </td>
                    <td className="p-4 font-medium text-slate-300">{getEmployeeName(inv.employeeId)}</td>
                    <td className="p-4">
                      <div className="font-medium text-slate-300">{getCustomerName(inv.customerId)}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">{getCustomerPhone(inv.customerId)}</div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-400">
                      {inv.totalAmount.toLocaleString()}đ
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${inv.isBankTransfer
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                        }`}>
                        {inv.isBankTransfer ? 'Chuyển khoản' : 'Tiền mặt'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setShowDetailModal(true);
                        }}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL DRILL DOWN VIEW */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 bg-opacity-80 p-4">
          <div className="relative w-full max-w-lg glass-panel rounded-2xl shadow-2xl p-5 border border-slate-800 animate-fade-in max-h-[90vh] overflow-y-auto">

            {/* Modal close */}
            <button
              onClick={() => {
                setShowDetailModal(false);
                setSelectedInvoice(null);
              }}
              className="absolute top-4 right-4 p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal title */}
            <div className="flex items-center gap-2 pb-4 border-b border-slate-850">
              <FileText className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-sm text-slate-200">Chi tiết Hóa đơn {selectedInvoice.id}</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Lập lúc: {new Date(selectedInvoice.createdDate).toLocaleString()}
                </p>
              </div>
            </div>

            {/* General context */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-850 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Thông tin nhân viên</span>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{getEmployeeName(selectedInvoice.employeeId)}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 block">Mã NV: {selectedInvoice.employeeId}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Thông tin khách hàng</span>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{getCustomerName(selectedInvoice.customerId)}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 block">SĐT: {getCustomerPhone(selectedInvoice.customerId)}</span>
              </div>
            </div>

            {/* Items details table */}
            <div className="py-4 border-b border-slate-850">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-3 pl-1">Danh sách sản phẩm mua</span>
              <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1.5">
                {selectedInvoice.details.map((item, idx) => {
                  // Dùng helper resolveProduct() — DRY, tránh lặp lại 14 dòng code
                  const productObj = resolveProduct(item);
                  const unitName = productObj ? productObj.units.find(u => u.unitId === item.unitId)?.name : 'Viên';
                  return (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-lg border border-slate-850 bg-slate-950/40 text-xs">
                      <div>
                        <span className="font-semibold text-slate-200 leading-tight block">
                          {productObj ? productObj.name.split(' (')[0] : 'Sản phẩm'}
                        </span>
                        <div className="flex gap-2 text-[10px] text-slate-400 mt-1">
                          <span>ĐVT: {unitName}</span>
                          <span>Đơn giá: {item.price.toLocaleString()}đ</span>
                          <span>SL: {item.quantity}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-200">
                        {(item.price * item.quantity).toLocaleString()}đ
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals & Payments summaries */}
            <div className="pt-4 space-y-2.5 text-xs">

              {selectedInvoice.redeemedPoints > 0 && (
                <div className="flex justify-between text-yellow-500 font-medium">
                  <span>Khấu trừ điểm tích lũy:</span>
                  <span className="font-mono">-{(selectedInvoice.redeemedPoints * 1000).toLocaleString()}đ</span>
                </div>
              )}

              <div className="flex justify-between text-slate-100 font-bold text-sm">
                <span>Tổng tiền thực nhận:</span>
                <span className="font-mono text-emerald-400 text-base">
                  {selectedInvoice.totalAmount.toLocaleString()}đ
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-850 pt-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  Phương thức: <strong className="text-slate-400">{selectedInvoice.isBankTransfer ? 'Chuyển khoản' : 'Tiền mặt'}</strong>
                </span>

                {selectedInvoice.pointsEarned !== undefined && (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <Check className="w-3.5 h-3.5" />
                    Tích lũy hóa đơn: <strong>+{selectedInvoice.pointsEarned} điểm</strong>
                  </span>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default History;
