/**
 * ============================================================
 * FILE: POS.jsx — Trang Bán hàng (Point of Sale)
 * ============================================================
 *
 * 1. Mục tiêu chung:
 *    Trang này giải quyết bài toán BÁN HÀNG TẠI QUẦY của nhà thuốc.
 *    Nhân viên bán hàng có thể:
 *    - Tìm kiếm thuốc theo tên, thành phần, hoặc quét mã vạch (barcode)
 *    - Thêm thuốc vào giỏ hàng với đơn vị tính linh hoạt (viên/vỉ/hộp)
 *    - Tra cứu khách hàng bằng SĐT hoặc đăng ký khách mới
 *    - Áp dụng điểm tích lũy để giảm giá
 *    - Thanh toán (tiền mặt / chuyển khoản) và in hóa đơn
 *
 * 2. Tư duy cốt lõi (Ý tưởng thuật toán):
 *    - Layout 3 cột: Catalog (trái) | Giỏ hàng (giữa) | Thanh toán (phải)
 *    - useMemo() cho filteredProducts: chỉ lọc lại khi searchTerm thay đổi,
 *      không lọc lại khi thao tác giỏ hàng hay nhập SĐT khách hàng.
 *    - "Lookup Map" cho sản phẩm: tra cứu O(1) khi cần tìm thông tin.
 *    - DRY (Don't Repeat Yourself): resolveProduct() tách logic tìm sản phẩm
 *      dùng chung cho receipt modal (tránh lặp code).
 *    - Quy đổi đơn vị: 1 Hộp = n Vỉ = m Viên, dùng conversionFactor.
 * ============================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, UserCheck,
  UserPlus, CreditCard, DollarSign, Receipt, X, Printer,
  AlertTriangle, CheckCircle2, User, SearchCheck, Barcode
} from 'lucide-react';
import axios from '../api/axios';

const POS = () => {
  // Global & Local States
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);

  /* Nhân viên đang đăng nhập — đọc từ localStorage.
   *
   * TỐI ƯU: Dùng useState(() => ...) với "hàm khởi tạo" (initializer function).
   * Hàm khởi tạo chỉ chạy 1 LẦN DUY NHẤT khi component mount lần đầu.
   *
   * SO SÁNH với code cũ dùng IIFE (Immediately Invoked Function Expression):
   * - Code cũ: const x = (() => { ... })();  → chạy lại MỖI LẦN component render
   * - Code mới: const [x] = useState(() => { ... }); → chỉ chạy 1 lần
   *
   * Kết quả: Tránh parse JSON từ localStorage lặp lại vô ích mỗi render.
   */
  const [activeEmployee] = useState(() => {
    const saved = localStorage.getItem('activeEmployee');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Customer Search & Creation States
  const [customerPhone, setCustomerPhone] = useState('');
  const [customer, setCustomer] = useState(null);
  const [customerSearchMsg, setCustomerSearchMsg] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustLastName, setNewCustLastName] = useState('Nguyễn');
  const [newCustFirstName, setNewCustFirstName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [addCustomerError, setAddCustomerError] = useState('');

  // Payment states
  const [isBankTransfer, setIsBankTransfer] = useState(false);
  const [redeemedPoints, setRedeemedPoints] = useState(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  // Search input focus ref
  const searchInputRef = useRef(null);

  // >>> MOCK PRODUCTS - XÓA ĐOẠN NÀY KHI CÓ BACKEND >>>
  const MOCK_PRODUCTS = [
    {
      id: 'SP001',
      name: 'Paracetamol 500mg',
      type: 'THUOC_KHONG_KE_DON',
      ingredients: 'Paracetamol',
      barcodes: ['893460200101'],
      totalQuantity: 500,
      batches: [
        { batchId: 'LO-2025-001', expDate: '2026-12-31', quantity: 300 },
        { batchId: 'LO-2025-002', expDate: '2027-06-15', quantity: 200 }
      ],
      units: [
        { unitId: 'U1', name: 'Viên', price: 2000, conversionFactor: 1, isBase: true },
        { unitId: 'U2', name: 'Vỉ (10 viên)', price: 18000, conversionFactor: 10 },
        { unitId: 'U3', name: 'Hộp (10 vỉ)', price: 170000, conversionFactor: 100 }
      ]
    },
    {
      id: 'SP002',
      name: 'Amoxicillin 500mg',
      type: 'THUOC_KE_DON',
      ingredients: 'Amoxicillin trihydrate',
      barcodes: ['893460200102'],
      totalQuantity: 200,
      batches: [
        { batchId: 'LO-2025-003', expDate: '2026-09-30', quantity: 200 }
      ],
      units: [
        { unitId: 'U1', name: 'Viên', price: 5000, conversionFactor: 1, isBase: true },
        { unitId: 'U2', name: 'Vỉ (10 viên)', price: 45000, conversionFactor: 10 },
        { unitId: 'U3', name: 'Hộp (2 vỉ)', price: 85000, conversionFactor: 20 }
      ]
    },
    {
      id: 'SP003',
      name: 'Vitamin C 1000mg Effervescent',
      type: 'THUC_PHAM_CHUC_NANG',
      ingredients: 'Acid ascorbic, Kẽm gluconate',
      barcodes: ['893460200103'],
      totalQuantity: 150,
      batches: [
        { batchId: 'LO-2025-004', expDate: '2027-03-20', quantity: 150 }
      ],
      units: [
        { unitId: 'U1', name: 'Viên', price: 8000, conversionFactor: 1, isBase: true },
        { unitId: 'U2', name: 'Tuýp (10 viên)', price: 75000, conversionFactor: 10 }
      ]
    },
    {
      id: 'SP004',
      name: 'Omeprazole 20mg',
      type: 'THUOC_KHONG_KE_DON',
      ingredients: 'Omeprazole',
      barcodes: ['893460200104'],
      totalQuantity: 300,
      batches: [
        { batchId: 'LO-2025-005', expDate: '2026-08-15', quantity: 180 },
        { batchId: 'LO-2025-006', expDate: '2027-01-10', quantity: 120 }
      ],
      units: [
        { unitId: 'U1', name: 'Viên', price: 3500, conversionFactor: 1, isBase: true },
        { unitId: 'U2', name: 'Vỉ (10 viên)', price: 32000, conversionFactor: 10 },
        { unitId: 'U3', name: 'Hộp (3 vỉ)', price: 90000, conversionFactor: 30 }
      ]
    },
    {
      id: 'SP005',
      name: 'Ibuprofen 400mg',
      type: 'THUOC_KHONG_KE_DON',
      ingredients: 'Ibuprofen',
      barcodes: ['893460200105'],
      totalQuantity: 400,
      batches: [
        { batchId: 'LO-2025-007', expDate: '2027-05-20', quantity: 400 }
      ],
      units: [
        { unitId: 'U1', name: 'Viên', price: 3000, conversionFactor: 1, isBase: true },
        { unitId: 'U2', name: 'Vỉ (10 viên)', price: 28000, conversionFactor: 10 },
        { unitId: 'U3', name: 'Hộp (5 vỉ)', price: 130000, conversionFactor: 50 }
      ]
    }
  ];
  // <<< MOCK PRODUCTS - XÓA ĐOẠN NÀY KHI CÓ BACKEND <<<

  const loadProducts = async () => {
    try {
      const res = await axios.get('/api/products');
      // Kiểm tra dữ liệu trả về có phải mảng không (Vite dev server có thể trả HTML)
      if (Array.isArray(res.data)) {
        const processedProducts = res.data.map(prod => {
          const totalQuantity = (prod.batches || []).reduce((sum, batch) => sum + (batch.quantity || 0), 0);
          return { ...prod, totalQuantity };
        });
        setProducts(processedProducts);
      } else {
        throw new Error('API trả về dữ liệu không hợp lệ');
      }
    } catch (err) {
      console.warn('API chưa sẵn sàng, sử dụng dữ liệu mẫu:', err.message);
      // >>> MOCK FALLBACK - XÓA DÒNG NÀY KHI CÓ BACKEND >>>
      setProducts(MOCK_PRODUCTS);
      // <<< MOCK FALLBACK - XÓA DÒNG NÀY KHI CÓ BACKEND <<<
    }
  };

  // Tải danh sách sản phẩm lần đầu khi component được hiển thị (mount)
  useEffect(() => {
    loadProducts();
  }, []);

  /* ============================================================
   * MODULE: Lookup Map & resolveProduct — Tra cứu sản phẩm nhanh
   * ============================================================
   * 1. Mục tiêu chung:
   *    Tạo bảng tra cứu sản phẩm O(1) và hàm helper tìm sản phẩm
   *    từ nhiều nguồn ID (productId / unitId). Dùng trong receipt modal.
   *
   * 2. Tư duy cốt lõi:
   *    - Map<productId, product>: tra cứu tức thì O(1)
   *    - resolveProduct(): chiến lược "thử lần lượt" (fallback chain):
   *      Cách 1 thất bại → thử Cách 2 → thất bại → thử Cách 3
   * ============================================================ */

  // Map tra cứu: productId → object sản phẩm đầy đủ
  const productMap = React.useMemo(() => {
    const map = new Map();                          // Tạo Map rỗng
    products.forEach(prod => map.set(prod.id, prod)); // Nạp sản phẩm vào
    return map;
  }, [products]); // Chỉ xây lại khi danh sách sản phẩm thay đổi

  /**
   * Tìm sản phẩm gốc từ thông tin chi tiết hóa đơn.
   * Vì backend có thể trả về productId hoặc chỉ có unitId,
   * ta cần thử nhiều cách khác nhau.
   *
   * @param {Object} detail - 1 dòng chi tiết hóa đơn (có productId và/hoặc unitId)
   * @returns {Object|null} - Sản phẩm tìm được, hoặc null nếu không tìm thấy
   */
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

    // Cách 3 (chậm nhất, fallback cuối): Duyệt tìm sản phẩm có unit khớp
    if (detail.unitId) {
      return products.find(p =>
        p.units && p.units.some(u => u.unitId === detail.unitId)
      ) || null;
    }

    return null;
  };

  // Keyboard shortcut / barcode event listener simulation
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // Check if input is a barcode
      const term = searchTerm.trim();
      if (!term) return;

      // Scan barcode match
      const matchedProduct = products.find(p => p.barcodes && p.barcodes.includes(term));

      if (matchedProduct) {
        // Find base or first unit
        const baseUnit = matchedProduct.units.find(u => u.isBase) || matchedProduct.units[0];
        addToCart(matchedProduct, baseUnit);
        setSearchTerm(''); // clear barcode input
        // Quick visual toast or indicator
        showScanToast(matchedProduct.name);
      }
    }
  };

  // Temporary floating toast indicator for scanning
  const [toastMessage, setToastMessage] = useState('');
  const showScanToast = (msg) => {
    setToastMessage(`Đã quét: ${msg}`);
    setTimeout(() => setToastMessage(''), 2500);
  };

  /* ============================================================
   * MODULE: Cart Operations — Thao tác giỏ hàng (CRUD)
   * ============================================================
   * 1. Mục tiêu chung:
   *    Quản lý giỏ hàng: thêm/xóa/cập nhật số lượng/đổi đơn vị tính.
   *
   * 2. Tư duy cốt lõi:
   *    - Mỗi item trong cart được định danh bằng cặp (productId + unitId).
   *      Cùng 1 sản phẩm với 2 đơn vị khác nhau = 2 dòng riêng biệt.
   *    - updateQuantity kiểm tra tồn kho bằng quy đổi: SL × conversionFactor
   *    - handleUnitChange gộp item nếu đổi sang đơn vị đã có trong giỏ
   * ============================================================ */
  const addToCart = (product, unit) => {
    // Check if item is already in cart with the same unit
    const existingIndex = cart.findIndex(item => item.productId === product.id && item.unitId === unit.unitId);

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        type: product.type,
        unitId: unit.unitId,
        unitName: unit.name,
        price: unit.price,
        conversionFactor: unit.conversionFactor,
        quantity: 1,
        maxAvailableQty: product.totalQuantity // in base units
      }]);
    }
  };

  const removeFromCart = (productId, unitId) => {
    setCart(cart.filter(item => !(item.productId === productId && item.unitId === unitId)));
  };

  const updateQuantity = (productId, unitId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId, unitId);
      return;
    }

    // Check if new quantity exceeds stock in base units
    const item = cart.find(i => i.productId === productId && i.unitId === unitId);
    const product = products.find(p => p.id === productId);
    if (item && product) {
      const requiredBaseQty = newQty * item.conversionFactor;
      if (requiredBaseQty > product.totalQuantity) {
        alert(`Số lượng yêu cầu (${newQty} ${item.unitName} = ${requiredBaseQty} Viên/Ống) vượt quá số lượng tồn kho khả dụng (${product.totalQuantity} Viên/Ống).`);
        return;
      }
    }

    setCart(cart.map(item =>
      (item.productId === productId && item.unitId === unitId)
        ? { ...item, quantity: newQty }
        : item
    ));
  };

  const handleUnitChange = (productId, oldUnitId, newUnitId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newUnit = product.units.find(u => u.unitId === newUnitId);
    if (!newUnit) return;

    // Check if cart already has an item with this new unit
    const existingIndex = cart.findIndex(item => item.productId === productId && item.unitId === newUnitId);

    if (existingIndex > -1) {
      // Merge them
      const targetItem = cart.find(item => item.productId === productId && item.unitId === oldUnitId);
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += targetItem.quantity;
      // remove old one
      setCart(updatedCart.filter(item => !(item.productId === productId && item.unitId === oldUnitId)));
    } else {
      // Just swap the unit and update price
      setCart(cart.map(item =>
        (item.productId === productId && item.unitId === oldUnitId)
          ? {
            ...item,
            unitId: newUnit.unitId,
            unitName: newUnit.name,
            price: newUnit.price,
            conversionFactor: newUnit.conversionFactor
          }
          : item
      ));
    }
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = redeemedPoints * 1000; // 1 Point = 1,000 VND
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);

  // Loyalty Points Redemption logic
  const handlePointsChange = (val) => {
    const points = parseInt(val) || 0;
    if (points < 0) {
      setRedeemedPoints(0);
      return;
    }
    if (customer && points > customer.points) {
      setRedeemedPoints(customer.points);
      return;
    }
    // Cannot redeem more points than invoice subtotal
    const maxPointsAllowed = Math.floor(cartSubtotal / 1000);
    if (points > maxPointsAllowed) {
      setRedeemedPoints(maxPointsAllowed);
      return;
    }
    setRedeemedPoints(points);
  };

  // Customer Actions
  const handleSearchCustomer = async () => {
    setCustomerSearchMsg('');
    setCustomer(null);
    setRedeemedPoints(0);
    setShowAddCustomer(false);

    const phone = customerPhone.trim();
    if (!phone) {
      setCustomerSearchMsg('Vui lòng nhập số điện thoại');
      return;
    }

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
      setCustomerSearchMsg('SĐT phải gồm đúng 10 chữ số và bắt đầu bằng số 0.');
      return;
    }

    try {
      const res = await axios.get(`/api/customers/search`, { params: { phone } });
      setCustomer(res.data);
      setCustomerSearchMsg('');
    } catch (err) {
      setCustomer(null);
      setCustomerSearchMsg('Không tìm thấy khách hàng. Thêm mới?');
      setShowAddCustomer(true);
      setNewCustPhone(phone);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setAddCustomerError('');

    if (!newCustFirstName.trim()) {
      setAddCustomerError('Vui lòng nhập tên khách hàng.');
      return;
    }
    if (!newCustPhone.trim()) {
      setAddCustomerError('Vui lòng nhập số điện thoại.');
      return;
    }

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(newCustPhone.trim())) {
      setAddCustomerError('Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.');
      return;
    }

    try {
      const res = await axios.post('/api/customers', {
        lastName: newCustLastName.trim(),
        firstName: newCustFirstName.trim(),
        phone: newCustPhone.trim()
      });

      setCustomer(res.data);
      setCustomerPhone(newCustPhone.trim());
      setShowAddCustomer(false);
      setNewCustFirstName('');
      setAddCustomerError('');
    } catch (err) {
      setAddCustomerError(err.response?.data?.message || 'Không thể tạo khách hàng.');
    }
  };

  // Check if cart has prescription drug
  const hasPrescriptionDrug = cart.some(item => item.type === 'THUOC_KE_DON');

  // Submit checkout invoice
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setCheckoutLoading(true);
    setCheckoutError('');

    const invoiceData = {
      employeeId: activeEmployee?.id,
      customerId: customer ? customer.id : 'KH-00000', // Default guest customer
      isBankTransfer,
      totalAmount: cartTotal,
      details: cart.map(item => ({
        productId: item.productId,
        unitId: item.unitId,
        quantity: item.quantity,
        price: item.price
      }))
    };

    try {
      const res = await axios.post('/api/invoices', invoiceData);
      setLastInvoice(res.data);
      setShowReceiptModal(true);

      // Clear states on success
      setCart([]);
      setCustomer(null);
      setCustomerPhone('');
      setRedeemedPoints(0);
      loadProducts(); // Reload stocks
    } catch (err) {
      setCheckoutError(err.response?.data?.message || 'Có lỗi xảy ra trong quá trình thanh toán.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // TỐI ƯU HÓA: Dùng React.useMemo để việc tìm kiếm/lọc sản phẩm chỉ thực hiện lại
  // khi danh sách sản phẩm (products) hoặc từ khóa tìm kiếm (searchTerm) thay đổi.
  // Tránh tính toán lại lãng phí khi nhập thông tin khách hàng hoặc cập nhật giỏ hàng.
  const filteredProducts = React.useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return products; // Nếu từ khóa trống, trả về toàn bộ danh sách sản phẩm

    return products.filter(p => {
      return (
        p.name.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        (p.ingredients && p.ingredients.toLowerCase().includes(term)) ||
        (p.barcodes && p.barcodes.some(b => b.includes(term)))
      );
    });
  }, [products, searchTerm]); // Chỉ tính toán lại khi products hoặc searchTerm thay đổi

  // Category Translation Helper
  const getCategoryLabel = (type) => {
    switch (type) {
      case 'THUOC_KE_DON':
        return { text: 'Thuốc kê đơn', class: 'bg-red-500/10 text-red-400 border-red-500/20' };
      case 'THUOC_KHONG_KE_DON':
        return { text: 'Thuốc không kê đơn', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'THUC_PHAM_CHUC_NANG':
        return { text: 'TP Chức năng', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      default:
        return { text: 'Sản phẩm khác', class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden p-4 gap-4 relative bg-slate-950">

      {/* Liquid Glass Background Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/10 to-teal-500/5 blur-3xl pointer-events-none animate-liquid-1 z-0"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-gradient-to-br from-teal-500/10 to-emerald-500/5 blur-3xl pointer-events-none animate-liquid-2 z-0"></div>

      {/* Floating Scan Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-400 animate-bounce">
          <Barcode className="w-5 h-5" />
          {toastMessage}
        </div>
      )}

      {/* LEFT COLUMN - Product search & Catalog (col-span-5) */}
      <div className="w-[44%] flex flex-col h-full bg-slate-900 bg-opacity-40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">

        {/* Search header bar */}
        <div className="py-2.5 px-3 border-b border-slate-800 bg-slate-950/40">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nhập tên thuốc, thành phần, hoặc quét mã vạch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              className="w-full pl-9 pr-9 py-2 rounded-xl glass-input text-xs font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500 pl-1 font-mono">
            <Barcode className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Mẹo: Nhập barcode `893460200101` rồi bấm Enter để quét Paracetamol</span>
          </div>
        </div>

        {/* Products Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-medium">
              Không tìm thấy thuốc nào khớp với từ khóa
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const cat = getCategoryLabel(prod.type);
              const isOutOfStock = prod.totalQuantity <= 0;

              return (
                <div
                  key={prod.id}
                  className={`p-3 rounded-xl border transition-all ${isOutOfStock
                      ? 'bg-slate-950/20 border-slate-800/40 opacity-60'
                      : 'glass-card border-slate-800'
                    }`}
                >
                  {/* Title & Badge */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-100 text-xs leading-tight">
                        {prod.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hoạt chất: <span className="font-medium text-slate-300">{prod.ingredients || 'N/A'}</span>
                      </p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap ${cat.class}`}>
                      {cat.text}
                    </span>
                  </div>

                  {/* Batches Sub-section */}
                  <div className="mt-2 bg-slate-950 bg-opacity-40 rounded-lg p-2 border border-slate-800/40">
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex justify-between">
                      <span>Lô Hàng Hiện Có</span>
                      <span className="font-mono text-emerald-400">Tồn: {prod.totalQuantity}</span>
                    </div>
                    {prod.batches && prod.batches.length > 0 ? (
                      <div className="space-y-1">
                        {prod.batches.map(batch => {
                          const expDate = new Date(batch.expDate);
                          const isNearExp = expDate - new Date() < 1000 * 60 * 60 * 24 * 90; // 90 days
                          const baseUnit = prod.units ? prod.units.find(u => u.isBase) : null;
                          const baseUnitName = baseUnit ? baseUnit.name : 'viên';
                          return (
                            <div key={batch.batchId} className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                              <span className="truncate max-w-[130px]" title={batch.batchId}>{batch.batchId.split('-').slice(-2).join('-')}</span>
                              <div className="flex items-center gap-2">
                                <span className={isNearExp ? 'text-yellow-500 font-bold' : ''} title="Hạn sử dụng">
                                  HSD: {batch.expDate.split('T')[0] || batch.expDate}
                                </span>
                                <span className="text-slate-300">{batch.quantity} {baseUnitName}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[9px] text-red-400">Không có thông tin lô hàng</div>
                    )}
                  </div>

                  {/* Unit conversion buttons */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/50 flex justify-between items-center">
                    <span className="text-[11px] text-slate-400">Chọn đơn vị bán:</span>
                    <div className="flex flex-wrap gap-1">
                      {prod.units.map(unit => (
                        <button
                          key={unit.unitId}
                          onClick={() => !isOutOfStock && addToCart(prod, unit)}
                          disabled={isOutOfStock}
                          className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-medium text-slate-200 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span>{unit.name}</span>
                          <span className="font-semibold text-slate-400">
                            ({(unit.price / 1000).toFixed(0)}k)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* CENTER COLUMN - Cart Area (col-span-4) */}
      <div className="w-[32%] flex flex-col h-full bg-slate-900 bg-opacity-40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">

        {/* Cart Header */}
        <div className="py-2.5 px-3.5 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-pharmacy-400" />
            <h2 className="font-semibold text-sm">Giỏ hàng hiện tại</h2>
          </div>
          <span className="bg-pharmacy-500 bg-opacity-10 border border-pharmacy-500/20 text-pharmacy-400 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} món
          </span>
        </div>

        {/* Prescription Alert Badge */}
        {hasPrescriptionDrug && (
          <div className="p-2 bg-red-500/10 border-b border-red-500/25 flex items-start gap-1.5 text-[11px] text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">CẢNH BÁO:</span> Giỏ hàng chứa thuốc kê đơn. Vui lòng yêu cầu và kiểm tra toa thuốc của bác sĩ điều trị.
            </div>
          </div>
        )}

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
              <ShoppingCart className="w-12 h-12 stroke-[1.5] text-slate-700 animate-pulse" />
              <p className="text-sm">Chưa có sản phẩm nào trong giỏ hàng</p>
            </div>
          ) : (
            cart.map((item) => {
              // Find units list for unit conversions
              const productObj = products.find(p => p.id === item.productId);
              const units = productObj ? productObj.units : [];

              return (
                <div key={`${item.productId}-${item.unitId}`} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 bg-opacity-35 space-y-2">

                  {/* Name and Delete Button */}
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-xs font-semibold text-slate-200 leading-tight">
                      {item.name}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.productId, item.unitId)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-900"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Pricing dropdown and qty controller */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">

                    {/* Unit Changer */}
                    <select
                      value={item.unitId}
                      onChange={(e) => handleUnitChange(item.productId, item.unitId, e.target.value)}
                      className="bg-slate-900 text-xs border border-slate-800 rounded px-1.5 py-1 text-slate-300 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      {units.map(u => (
                        <option key={u.unitId} value={u.unitId}>
                          {u.name}
                        </option>
                      ))}
                    </select>

                    {/* Quantity controls */}
                    <div className="flex items-center border border-slate-850 rounded bg-slate-900">
                      <button
                        onClick={() => updateQuantity(item.productId, item.unitId, item.quantity - 1)}
                        className="px-2 py-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-l transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.productId, item.unitId, parseInt(e.target.value) || 1)}
                        className="w-10 text-center bg-transparent text-xs font-mono text-slate-200 font-semibold focus:outline-none"
                      />
                      <button
                        onClick={() => updateQuantity(item.productId, item.unitId, item.quantity + 1)}
                        className="px-2 py-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-r transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Item Total */}
                    <span className="text-xs font-mono text-emerald-400 font-bold whitespace-nowrap">
                      {(item.price * item.quantity).toLocaleString()}đ
                    </span>

                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* RIGHT COLUMN - Customer lookup & Billing (col-span-3) */}
      <div className="w-[24%] flex flex-col h-full bg-slate-900 bg-opacity-40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">

        {/* Column Title */}
        <div className="py-2.5 px-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2">
          <User className="w-4 h-4 text-pharmacy-400" />
          <h2 className="font-semibold text-xs uppercase tracking-wider">Thanh toán & Khách hàng</h2>
        </div>

        {/* Customer area */}
        <div className="p-3 border-b border-slate-800 bg-slate-950 bg-opacity-20 space-y-3">

          {/* Customer SĐT lookup */}
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
              Tìm khách hàng (SĐT)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nhập SĐT khách..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg glass-input text-xs font-medium focus:ring-1"
              />
              <button
                onClick={handleSearchCustomer}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer"
              >
                Tìm
              </button>
            </div>
            {customerSearchMsg && (
              <p className="text-[10px] text-yellow-400 mt-1 pl-1">{customerSearchMsg}</p>
            )}
          </div>

          {/* Quick-add Customer Form */}
          {showAddCustomer && (
            <form onSubmit={handleAddCustomer} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 bg-opacity-60 space-y-2 animate-fade-in">
              <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                Thêm nhanh khách hàng
              </div>
              {addCustomerError && (
                <div className="text-[10px] text-red-400 font-medium pl-1 leading-normal">{addCustomerError}</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    placeholder="Họ đệm..."
                    value={newCustLastName}
                    onChange={(e) => setNewCustLastName(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Tên *"
                    value={newCustFirstName}
                    onChange={(e) => setNewCustFirstName(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200"
                    required
                  />
                </div>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="SĐT *"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer text-center"
              >
                Đăng ký khách
              </button>
            </form>
          )}

          {/* Display active customer stats */}
          {customer ? (
            <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
              <div className="overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-bold truncate max-w-[120px] text-slate-200">
                    {customer.lastName} {customer.firstName}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 block pl-5 mt-0.5">{customer.phone}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Tích lũy</span>
                <span className="text-xs font-mono font-bold text-emerald-400">{customer.points} điểm</span>
              </div>
            </div>
          ) : (
            !showAddCustomer && (
              <div className="text-xs text-slate-500 text-center py-2 italic">
                Đang bán cho Khách Vãng Lai
              </div>
            )
          )}

        </div>

        {/* Loyalty Point Redemption & Payment Methods */}
        <div className="flex-1 p-3 flex flex-col justify-between overflow-y-auto space-y-3">

          <div className="space-y-3">
            {/* Loyalty points slider / input */}
            {customer && customer.points > 0 && (
              <div className="animate-fade-in">
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 flex justify-between">
                  <span>Quy đổi điểm tích lũy</span>
                  <span className="font-mono text-emerald-400">Max: {customer.points}</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={customer.points}
                    placeholder="Nhập số điểm cần quy đổi..."
                    value={redeemedPoints}
                    onChange={(e) => handlePointsChange(e.target.value)}
                    className="w-full pl-3 pr-16 py-1 rounded-lg glass-input text-xs font-mono font-bold"
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[10px] text-slate-500 font-bold uppercase">
                    điểm
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 pl-1 font-mono">
                  1 điểm = 1k. Giảm tương ứng: <span className="text-emerald-400 font-bold">{(redeemedPoints * 1000).toLocaleString()}đ</span>
                </div>
              </div>
            )}

            {/* Payment options */}
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                Hình thức thanh toán
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsBankTransfer(false)}
                  className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${!isBankTransfer
                      ? 'bg-emerald-500 bg-opacity-10 text-emerald-400 border-emerald-500/50 shadow-glass-light'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Tiền mặt
                </button>
                <button
                  onClick={() => setIsBankTransfer(true)}
                  className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${isBankTransfer
                      ? 'bg-emerald-500 bg-opacity-10 text-emerald-400 border-emerald-500/50 shadow-glass-light'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Chuyển khoản
                </button>
              </div>
            </div>
          </div>

          {/* Pricing totals & Checkout button */}
          <div className="space-y-2.5 border-t border-slate-800/80 pt-2.5 bg-transparent mt-auto">
            {checkoutError && (
              <div className="text-xs text-red-400 p-2 rounded bg-red-500/10 border border-red-500/20 leading-normal">
                {checkoutError}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Tạm tính</span>
                <span className="font-mono text-slate-300 font-medium">{cartSubtotal.toLocaleString()}đ</span>
              </div>
              {redeemedPoints > 0 && (
                <div className="flex justify-between text-yellow-500">
                  <span>Khấu trừ điểm ({redeemedPoints}đ)</span>
                  <span className="font-mono font-bold">-{(redeemedPoints * 1000).toLocaleString()}đ</span>
                </div>
              )}
              <div className="flex justify-between text-slate-100 font-bold border-t border-slate-850/60 pt-1.5 text-sm">
                <span>Tổng cộng</span>
                <span className="font-mono text-emerald-400 text-base">
                  {cartTotal.toLocaleString()}đ
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkoutLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold tracking-wide transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {checkoutLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  Xác Nhận & In Hóa Đơn
                </>
              )}
            </button>
          </div>

        </div>

      </div>

      {/* RENDER INVOICE PRINT RECEIPT POPUP MODAL */}
      {showReceiptModal && lastInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 bg-opacity-80 p-4 overflow-y-auto no-print">
          <div className="relative w-full max-w-sm bg-white text-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-200 animate-fade-in flex flex-col justify-between">

            {/* Modal Header actions */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => {
                  // Simulate print
                  window.print();
                }}
                className="p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="In hóa đơn"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setLastInvoice(null);
                }}
                className="p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Content container */}
            <div id="print-receipt" className="font-mono text-xs text-slate-800 space-y-4">

              {/* Brand logo header */}
              <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-300">
                <h2 className="text-sm font-bold tracking-widest text-slate-950">NHÀ THUỐC DƯỢC AN KHANG</h2>
                <p className="text-[10px] text-slate-500">12 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh</p>
                <p className="text-[10px] text-slate-500">Hotline: 1900 636 789</p>
                <div className="text-center font-bold text-slate-950 pt-2 text-[11px]">HÓA ĐƠN BÁN LẺ</div>
              </div>

              {/* Invoice Meta details */}
              <div className="space-y-1 text-[10px] text-slate-600 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span>Mã HĐ:</span>
                  <span className="font-bold text-slate-950">{lastInvoice.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ngày:</span>
                  <span>{new Date(lastInvoice.createdDate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nhân viên:</span>
                  <span className="font-medium text-slate-950">
                    {activeEmployee ? `${activeEmployee.lastName} ${activeEmployee.firstName}` : lastInvoice.employeeId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Khách hàng:</span>
                  <span className="font-medium text-slate-950">
                    {customer ? `${customer.lastName} ${customer.firstName}` : 'Khách Vãng Lai'}
                  </span>
                </div>
              </div>

              {/* Items purchase table */}
              <table className="w-full text-[10px] text-left border-b border-dashed border-slate-300 pb-3">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-1">Thuốc</th>
                    <th className="py-1 text-center">SL</th>
                    <th className="py-1 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {lastInvoice.details.map((item, index) => {
                    // Dùng helper resolveProduct() — DRY, tránh lặp lại 14 dòng code
                    const originalProduct = resolveProduct(item);

                    const unitName = originalProduct ? originalProduct.units.find(u => u.unitId === item.unitId)?.name : 'Viên';
                    return (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="py-1.5 leading-tight font-medium text-slate-950">
                          {originalProduct ? originalProduct.name.split(' (')[0] : 'Sản phẩm'} ({unitName})
                        </td>
                        <td className="py-1.5 text-center">{item.quantity}</td>
                        <td className="py-1.5 text-right font-mono font-bold text-slate-950">
                          {(item.price * item.quantity).toLocaleString()}đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pricing totals */}
              <div className="space-y-1.5 text-[10px] text-slate-600">

                {lastInvoice.redeemedPoints > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Điểm quy đổi:</span>
                    <span>-{(lastInvoice.redeemedPoints * 1000).toLocaleString()}đ</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-950 font-bold text-[11px] border-t border-slate-200 pt-2">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="font-mono text-slate-950 text-xs">
                    {lastInvoice.totalAmount.toLocaleString()}đ
                  </span>
                </div>

                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span>Hình thức:</span>
                  <span className="font-bold text-slate-950">{lastInvoice.isBankTransfer ? 'Chuyển khoản' : 'Tiền mặt'}</span>
                </div>

                {lastInvoice.pointsEarned !== undefined && (
                  <div className="bg-slate-50 p-2 rounded border border-dashed border-slate-200 text-center font-bold text-[9px] text-emerald-600 mt-2">
                    Điểm tích lũy hóa đơn này: +{lastInvoice.pointsEarned} điểm
                  </div>
                )}
              </div>

              {/* Footer notice */}
              <div className="text-center space-y-1 pt-4 border-t border-dashed border-slate-300 text-[9px] text-slate-400">
                <p>Cảm ơn Quý Khách. Hẹn gặp lại!</p>
                <p>Mẫu hóa đơn in ấn điện tử POS Dược An Khang</p>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setLastInvoice(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Hoàn thành
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default POS;
