/**
 * ============================================================
 * FILE: POS.jsx — Trang Bán hàng tại quầy (Point of Sale)
 * ============================================================
 * Chức năng:
 *   Nhân viên bán hàng sử dụng trang này để:
 *   - Tìm kiếm thuốc theo tên, thành phần hoặc quét mã vạch (barcode)
 *   - Thêm thuốc vào giỏ hàng với đơn vị tính linh hoạt (viên/vỉ/hộp)
 *   - Tra cứu khách hàng bằng SĐT hoặc đăng ký khách mới
 *   - Thanh toán (tiền mặt / chuyển khoản) và in hóa đơn
 *
 * Bố cục giao diện: 3 cột
 *   Cột trái (44%)  — Danh mục sản phẩm + Tìm kiếm
 *   Cột giữa (32%)  — Giỏ hàng hiện tại
 *   Cột phải (24%)  — Thông tin khách hàng + Thanh toán
 *
 * Các kỹ thuật chính:
 *   - useMemo: Chỉ lọc/tính toán lại khi dữ liệu đầu vào thay đổi
 *   - Map (bảng băm): Tra cứu sản phẩm nhanh O(1) thay vì duyệt mảng O(n)
 *   - Quy đổi đơn vị: 1 Hộp = n Vỉ = m Viên, dùng conversionFactor
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

  // =============================================
  // PHẦN 1: KHAI BÁO CÁC BIẾN TRẠNG THÁI (STATE)
  // =============================================

  // --- Dữ liệu sản phẩm & Giỏ hàng ---
  const [products, setProducts] = useState([]);     // Danh sách sản phẩm lấy từ Backend
  const [searchTerm, setSearchTerm] = useState('');  // Từ khóa tìm kiếm sản phẩm
  const [cart, setCart] = useState([]);               // Giỏ hàng hiện tại

  /**
   * Đọc thông tin nhân viên đang đăng nhập từ LocalStorage.
   * Dùng useState(() => ...) với hàm khởi tạo → chỉ chạy 1 LẦN khi component hiển thị lần đầu.
   * Tránh parse JSON lặp lại mỗi khi component render.
   */
  const [activeEmployee] = useState(() => {
    const saved = localStorage.getItem('activeEmployee');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // --- Tra cứu & Tạo mới Khách hàng ---
  const [customerPhone, setCustomerPhone] = useState('');       // SĐT khách hàng nhập vào
  const [customer, setCustomer] = useState(null);               // Thông tin khách hàng tìm được
  const [customerSearchMsg, setCustomerSearchMsg] = useState(''); // Thông báo kết quả tìm kiếm
  const [showAddCustomer, setShowAddCustomer] = useState(false); // Hiển thị form thêm khách mới
  const [newCustLastName, setNewCustLastName] = useState('Nguyễn'); // Họ đệm khách mới
  const [newCustFirstName, setNewCustFirstName] = useState('');     // Tên khách mới
  const [newCustPhone, setNewCustPhone] = useState('');             // SĐT khách mới
  const [addCustomerError, setAddCustomerError] = useState('');     // Lỗi khi tạo khách

  // --- Thanh toán ---
  const [isBankTransfer, setIsBankTransfer] = useState(false);  // true = Chuyển khoản, false = Tiền mặt
  const [checkoutLoading, setCheckoutLoading] = useState(false); // Đang xử lý thanh toán
  const [checkoutError, setCheckoutError] = useState('');        // Lỗi khi thanh toán

  // --- Modal hóa đơn sau thanh toán ---
  const [showReceiptModal, setShowReceiptModal] = useState(false); // Hiển thị modal hóa đơn
  const [lastInvoice, setLastInvoice] = useState(null);            // Dữ liệu hóa đơn vừa tạo

  // --- Thông báo khi quét mã vạch ---
  const [toastMessage, setToastMessage] = useState('');

  // Ref để focus vào ô tìm kiếm
  const searchInputRef = useRef(null);

  // =============================================
  // PHẦN 2: TẢI DỮ LIỆU SẢN PHẨM TỪ BACKEND
  // =============================================

  /**
   * loadProducts — Tải danh sách sản phẩm từ Backend
   *
   * Cách hoạt động:
   *   1. Gọi GET /api/products để lấy danh sách sản phẩm
   *   2. Tính tổng tồn kho (totalQuantity) cho mỗi sản phẩm bằng cách
   *      cộng dồn quantity của tất cả các lô hàng (batches)
   *   3. Lưu vào state products để hiển thị trên giao diện
   */
  const loadProducts = async () => {
    try {
      const res = await axios.get('/api/products');

      // Kiểm tra dữ liệu trả về có phải mảng không
      if (Array.isArray(res.data)) {
        // Tính tổng tồn kho cho mỗi sản phẩm
        const processedProducts = res.data.map(prod => {
          const totalQuantity = (prod.batches || []).reduce(
            (sum, batch) => sum + (batch.quantity || 0), 0
          );
          return { ...prod, totalQuantity };
        });
        setProducts(processedProducts);
      } else {
        throw new Error('API trả về dữ liệu không hợp lệ');
      }
    } catch (err) {
      console.warn('Không thể tải danh sách sản phẩm:', err.message);
    }
  };

  // Tải danh sách sản phẩm khi component hiển thị lần đầu
  useEffect(() => {
    loadProducts();
  }, []);

  // =============================================
  // PHẦN 3: BẢNG TRA CỨU SẢN PHẨM NHANH (MAP)
  // =============================================

  /**
   * productMap — Bảng tra cứu sản phẩm theo ID, truy xuất O(1)
   *
   * Cấu trúc: Map<productId, product>
   * VD: productMap.get("SP-0001") → { id: "SP-0001", name: "Paracetamol", ... }
   *
   * Chỉ xây lại khi danh sách sản phẩm (products) thay đổi.
   */
  const productMap = React.useMemo(() => {
    const map = new Map();
    products.forEach(prod => map.set(prod.id, prod));
    return map;
  }, [products]);

  /**
   * resolveProduct — Tìm sản phẩm gốc từ chi tiết hóa đơn
   *
   * @param {Object} detail - Một dòng chi tiết hóa đơn (có productId và/hoặc unitId)
   * @returns {Object|null} - Sản phẩm tìm được, hoặc null nếu không tìm thấy
   *
   * Cách hoạt động (thử lần lượt 3 cách):
   *   Cách 1: Tra trực tiếp bằng productId từ Map → nhanh nhất, O(1)
   *   Cách 2: Suy ra productId từ unitId (VD: "DVT-0011-VI" → "SP-0011")
   *   Cách 3: Duyệt toàn bộ sản phẩm tìm unit khớp → chậm nhất, O(n)
   */
  const resolveProduct = (detail) => {
    // Cách 1: Tra trực tiếp bằng productId
    if (detail.productId) {
      const found = productMap.get(detail.productId);
      if (found) return found;
    }

    // Cách 2: Suy ra productId từ unitId
    // VD: unitId = "DVT-0011-VI" → tách lấy "0011" → productId = "SP-0011"
    if (detail.unitId) {
      const parts = detail.unitId.split('-');
      if (parts.length >= 2) {
        const derivedProductId = `SP-${parts[1]}`;
        const found = productMap.get(derivedProductId);
        if (found) return found;
      }
    }

    // Cách 3: Duyệt toàn bộ sản phẩm tìm unit khớp (fallback cuối cùng)
    if (detail.unitId) {
      return products.find(p =>
        p.units && p.units.some(u => u.unitId === detail.unitId)
      ) || null;
    }

    return null;
  };

  // =============================================
  // PHẦN 4: XỬ LÝ QUÉT MÃ VẠCH (BARCODE)
  // =============================================

  /**
   * handleSearchKeyPress — Xử lý khi nhấn phím Enter trong ô tìm kiếm
   *
   * @param {Event} e - Sự kiện bàn phím
   *
   * Nếu nội dung nhập trùng với mã vạch của sản phẩm nào đó,
   * tự động thêm sản phẩm đó vào giỏ hàng (đơn vị cơ bản).
   */
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchTerm.trim();
      if (!term) return;

      // Tìm sản phẩm có mã vạch trùng khớp
      const matchedProduct = products.find(p => p.barcodes && p.barcodes.includes(term));

      if (matchedProduct) {
        // Lấy đơn vị cơ bản (isBase = true) hoặc đơn vị đầu tiên
        const baseUnit = matchedProduct.units.find(u => u.isBase) || matchedProduct.units[0];
        addToCart(matchedProduct, baseUnit);
        setSearchTerm('');
        showScanToast(matchedProduct.name);
      }
    }
  };

  /**
   * showScanToast — Hiển thị thông báo nổi khi quét mã vạch thành công
   * Thông báo tự động biến mất sau 2.5 giây.
   */
  const showScanToast = (msg) => {
    setToastMessage(`Đã quét: ${msg}`);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // =============================================
  // PHẦN 5: THAO TÁC GIỎ HÀNG (THÊM / XÓA / SỬA)
  // =============================================

  /**
   * addToCart — Thêm sản phẩm vào giỏ hàng
   *
   * @param {Object} product - Sản phẩm cần thêm
   * @param {Object} unit - Đơn vị tính được chọn (viên/vỉ/hộp)
   *
   * Mỗi item trong giỏ được định danh bằng cặp (productId + unitId).
   * Nếu sản phẩm + đơn vị đã có trong giỏ → tăng số lượng lên 1.
   * Nếu chưa có → thêm dòng mới.
   */
  const addToCart = (product, unit) => {
    const existingIndex = cart.findIndex(
      item => item.productId === product.id && item.unitId === unit.unitId
    );

    if (existingIndex > -1) {
      // Đã có trong giỏ → tăng số lượng
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      // Chưa có → thêm dòng mới
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        type: product.type,
        unitId: unit.unitId,
        unitName: unit.name,
        price: unit.price,
        conversionFactor: unit.conversionFactor,
        quantity: 1,
        maxAvailableQty: product.totalQuantity // Tồn kho tính theo đơn vị cơ bản
      }]);
    }
  };

  /**
   * removeFromCart — Xóa một dòng sản phẩm khỏi giỏ hàng
   *
   * @param {string} productId - Mã sản phẩm
   * @param {string} unitId - Mã đơn vị tính
   */
  const removeFromCart = (productId, unitId) => {
    setCart(cart.filter(item => !(item.productId === productId && item.unitId === unitId)));
  };

  /**
   * updateQuantity — Cập nhật số lượng của một dòng trong giỏ hàng
   *
   * @param {string} productId - Mã sản phẩm
   * @param {string} unitId - Mã đơn vị tính
   * @param {number} newQty - Số lượng mới
   *
   * Kiểm tra tồn kho: số lượng mới × hệ số quy đổi ≤ tồn kho (đơn vị cơ bản)
   */
  const updateQuantity = (productId, unitId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId, unitId);
      return;
    }

    // Kiểm tra tồn kho
    const item = cart.find(i => i.productId === productId && i.unitId === unitId);
    const product = products.find(p => p.id === productId);
    if (item && product) {
      const requiredBaseQty = newQty * item.conversionFactor;
      if (requiredBaseQty > product.totalQuantity) {
        alert(`Số lượng yêu cầu (${newQty} ${item.unitName} = ${requiredBaseQty} Viên/Ống) vượt quá tồn kho (${product.totalQuantity} Viên/Ống).`);
        return;
      }
    }

    setCart(cart.map(item =>
      (item.productId === productId && item.unitId === unitId)
        ? { ...item, quantity: newQty }
        : item
    ));
  };

  /**
   * handleUnitChange — Đổi đơn vị tính của một dòng trong giỏ hàng
   *
   * @param {string} productId - Mã sản phẩm
   * @param {string} oldUnitId - Đơn vị cũ
   * @param {string} newUnitId - Đơn vị mới
   *
   * Nếu đơn vị mới đã có sẵn trong giỏ → gộp số lượng 2 dòng lại.
   * Nếu chưa có → chỉ thay đổi thông tin đơn vị và giá tiền.
   */
  const handleUnitChange = (productId, oldUnitId, newUnitId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newUnit = product.units.find(u => u.unitId === newUnitId);
    if (!newUnit) return;

    // Kiểm tra đơn vị mới đã có trong giỏ chưa
    const existingIndex = cart.findIndex(
      item => item.productId === productId && item.unitId === newUnitId
    );

    if (existingIndex > -1) {
      // Đã có → gộp số lượng
      const targetItem = cart.find(item => item.productId === productId && item.unitId === oldUnitId);
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += targetItem.quantity;
      // Xóa dòng cũ
      setCart(updatedCart.filter(item => !(item.productId === productId && item.unitId === oldUnitId)));
    } else {
      // Chưa có → đổi thông tin đơn vị
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

  // =============================================
  // PHẦN 6: TÍNH TOÁN TỔNG TIỀN
  // =============================================

  /**
   * cartSubtotal — Tổng tiền giỏ hàng
   * Công thức: Tổng (giá × số lượng) của tất cả các dòng trong giỏ
   */
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // =============================================
  // PHẦN 7: TRA CỨU & TẠO MỚI KHÁCH HÀNG
  // =============================================

  /**
   * handleSearchCustomer — Tìm khách hàng theo số điện thoại
   *
   * Cách hoạt động:
   *   1. Kiểm tra SĐT hợp lệ (10 chữ số, bắt đầu bằng 0)
   *   2. Gọi GET /api/customers/search?phone=...
   *   3. Nếu tìm thấy → lưu vào state customer
   *   4. Nếu không tìm thấy → hiện form thêm khách mới
   */
  const handleSearchCustomer = async () => {
    setCustomerSearchMsg('');
    setCustomer(null);
    setShowAddCustomer(false);

    const phone = customerPhone.trim();
    if (!phone) {
      setCustomerSearchMsg('Vui lòng nhập số điện thoại');
      return;
    }

    // Kiểm tra định dạng SĐT: 10 chữ số, bắt đầu bằng 0
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

  /**
   * handleAddCustomer — Tạo mới khách hàng
   *
   * @param {Event} e - Sự kiện submit của form
   *
   * Gửi POST /api/customers với { lastName, firstName, phone }
   * Nếu thành công → lưu khách hàng vừa tạo vào state customer
   */
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

  // =============================================
  // PHẦN 8: THANH TOÁN & TẠO HÓA ĐƠN
  // =============================================

  /** Kiểm tra giỏ hàng có thuốc kê đơn không (hiển thị cảnh báo) */
  const hasPrescriptionDrug = cart.some(item => item.type === 'THUOC_KE_DON');

  /**
   * handleCheckout — Xử lý thanh toán, tạo hóa đơn mới
   *
   * Cách hoạt động:
   *   1. Chuẩn bị dữ liệu hóa đơn (employeeId, customerId, details, totalAmount,...)
   *   2. Gửi POST /api/invoices
   *   3. Nếu thành công → hiển thị modal hóa đơn, xóa giỏ hàng, tải lại tồn kho
   *   4. Nếu thất bại → hiển thị lỗi
   */
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setCheckoutLoading(true);
    setCheckoutError('');

    // Chuẩn bị dữ liệu gửi lên Backend
    const invoiceData = {
      employeeId: activeEmployee?.id,
      customerId: customer ? customer.id : 'KH-00000', // KH-00000 = Khách vãng lai
      isBankTransfer,
      totalAmount: cartSubtotal,
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

      // Xóa giỏ hàng và thông tin khách hàng sau khi thanh toán thành công
      setCart([]);
      setCustomer(null);
      setCustomerPhone('');
      loadProducts(); // Tải lại tồn kho mới nhất từ Backend
    } catch (err) {
      setCheckoutError(err.response?.data?.message || 'Có lỗi xảy ra trong quá trình thanh toán.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // =============================================
  // PHẦN 9: LỌC & HIỂN THỊ SẢN PHẨM
  // =============================================

  /**
   * filteredProducts — Danh sách sản phẩm sau khi lọc theo từ khóa
   *
   * Tìm kiếm theo: tên sản phẩm, mã SP, thành phần hoạt chất, mã vạch
   * Dùng useMemo → chỉ lọc lại khi products hoặc searchTerm thay đổi.
   */
  const filteredProducts = React.useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return products;

    return products.filter(p => {
      return (
        p.name.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        (p.ingredients && p.ingredients.toLowerCase().includes(term)) ||
        (p.barcodes && p.barcodes.some(b => b.includes(term)))
      );
    });
  }, [products, searchTerm]);

  /**
   * getCategoryLabel — Chuyển đổi mã loại sản phẩm thành nhãn hiển thị
   *
   * @param {string} type - Mã loại (THUOC_KE_DON, THUOC_KHONG_KE_DON, THUC_PHAM_CHUC_NANG)
   * @returns {Object} - { text: 'Tên hiển thị', class: 'CSS class cho badge' }
   */
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

  // =============================================
  // PHẦN 10: GIAO DIỆN (JSX)
  // =============================================

  return (
    <div className="flex h-full w-full overflow-hidden p-4 gap-4 relative bg-slate-950">

      {/* Hiệu ứng nền trang trí */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/10 to-teal-500/5 blur-3xl pointer-events-none animate-liquid-1 z-0"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-gradient-to-br from-teal-500/10 to-emerald-500/5 blur-3xl pointer-events-none animate-liquid-2 z-0"></div>

      {/* Thông báo nổi khi quét mã vạch thành công */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-400 animate-bounce">
          <Barcode className="w-5 h-5" />
          {toastMessage}
        </div>
      )}

      {/* ==================== CỘT TRÁI: Danh mục sản phẩm ==================== */}
      <div className="w-[44%] flex flex-col h-full bg-slate-900 bg-opacity-40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">

        {/* Thanh tìm kiếm */}
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

        {/* Danh sách sản phẩm (cuộn được) */}
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
                  {/* Tên sản phẩm & Nhãn phân loại */}
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

                  {/* Thông tin lô hàng */}
                  <div className="mt-2 bg-slate-950 bg-opacity-40 rounded-lg p-2 border border-slate-800/40">
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex justify-between">
                      <span>Lô Hàng Hiện Có</span>
                      <span className="font-mono text-emerald-400">Tồn: {prod.totalQuantity}</span>
                    </div>
                    {prod.batches && prod.batches.length > 0 ? (
                      <div className="space-y-1">
                        {prod.batches.map(batch => {
                          const expDate = new Date(batch.expDate);
                          const isNearExp = expDate - new Date() < 1000 * 60 * 60 * 24 * 90; // Cận hạn < 90 ngày
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

                  {/* Nút chọn đơn vị bán */}
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

      {/* ==================== CỘT GIỮA: Giỏ hàng ==================== */}
      <div className="w-[32%] flex flex-col h-full bg-slate-900 bg-opacity-40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">

        {/* Tiêu đề giỏ hàng */}
        <div className="py-2.5 px-3.5 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-pharmacy-400" />
            <h2 className="font-semibold text-sm">Giỏ hàng hiện tại</h2>
          </div>
          <span className="bg-pharmacy-500 bg-opacity-10 border border-pharmacy-500/20 text-pharmacy-400 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} món
          </span>
        </div>

        {/* Cảnh báo thuốc kê đơn */}
        {hasPrescriptionDrug && (
          <div className="p-2 bg-red-500/10 border-b border-red-500/25 flex items-start gap-1.5 text-[11px] text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">CẢNH BÁO:</span> Giỏ hàng chứa thuốc kê đơn. Vui lòng yêu cầu và kiểm tra toa thuốc của bác sĩ điều trị.
            </div>
          </div>
        )}

        {/* Danh sách sản phẩm trong giỏ */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
              <ShoppingCart className="w-12 h-12 stroke-[1.5] text-slate-700 animate-pulse" />
              <p className="text-sm">Chưa có sản phẩm nào trong giỏ hàng</p>
            </div>
          ) : (
            cart.map((item) => {
              // Lấy danh sách đơn vị để hiển thị dropdown đổi đơn vị
              const productObj = products.find(p => p.id === item.productId);
              const units = productObj ? productObj.units : [];

              return (
                <div key={`${item.productId}-${item.unitId}`} className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 bg-opacity-35 space-y-2">

                  {/* Tên sản phẩm & Nút xóa */}
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

                  {/* Dropdown đơn vị + Điều chỉnh số lượng + Thành tiền */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">

                    {/* Dropdown đổi đơn vị tính */}
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

                    {/* Nút tăng/giảm số lượng */}
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

                    {/* Thành tiền của dòng này */}
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

      {/* ==================== CỘT PHẢI: Thanh toán & Khách hàng ==================== */}
      <div className="w-[24%] flex flex-col h-full bg-slate-900 bg-opacity-40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">

        {/* Tiêu đề cột */}
        <div className="py-2.5 px-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2">
          <User className="w-4 h-4 text-pharmacy-400" />
          <h2 className="font-semibold text-xs uppercase tracking-wider">Thanh toán & Khách hàng</h2>
        </div>

        {/* Khu vực tra cứu khách hàng */}
        <div className="p-3 border-b border-slate-800 bg-slate-950 bg-opacity-20 space-y-3">

          {/* Tìm khách hàng theo SĐT */}
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

          {/* Form thêm nhanh khách hàng mới */}
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

          {/* Hiển thị thông tin khách hàng đã chọn */}
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

        {/* Hình thức thanh toán & Nút thanh toán */}
        <div className="flex-1 p-3 flex flex-col justify-between overflow-y-auto space-y-3">

          <div className="space-y-3">
            {/* Lựa chọn hình thức thanh toán */}
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

          {/* Tổng tiền & Nút xác nhận thanh toán */}
          <div className="space-y-2.5 border-t border-slate-800/80 pt-2.5 bg-transparent mt-auto">
            {checkoutError && (
              <div className="text-xs text-red-400 p-2 rounded bg-red-500/10 border border-red-500/20 leading-normal">
                {checkoutError}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-100 font-bold border-t border-slate-800 pt-1.5 text-sm">
                <span>Tổng cộng</span>
                <span className="font-mono text-emerald-400 text-base">
                  {cartSubtotal.toLocaleString()}đ
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

      {/* ==================== MODAL HÓA ĐƠN SAU THANH TOÁN ==================== */}
      {showReceiptModal && lastInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 bg-opacity-80 p-4 overflow-y-auto no-print">
          <div className="relative w-full max-w-sm bg-white text-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-200 animate-fade-in flex flex-col justify-between">

            {/* Nút In & Đóng modal */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => window.print()}
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

            {/* Nội dung hóa đơn */}
            <div id="print-receipt" className="font-mono text-xs text-slate-800 space-y-4">

              {/* Header thương hiệu */}
              <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-300">
                <h2 className="text-sm font-bold tracking-widest text-slate-950">NHÀ THUỐC DƯỢC AN KHANG</h2>
                <p className="text-[10px] text-slate-500">12 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh</p>
                <p className="text-[10px] text-slate-500">Hotline: 1900 636 789</p>
                <div className="text-center font-bold text-slate-950 pt-2 text-[11px]">HÓA ĐƠN BÁN LẺ</div>
              </div>

              {/* Thông tin hóa đơn */}
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

              {/* Bảng sản phẩm đã mua */}
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

              {/* Tổng tiền thanh toán */}
              <div className="space-y-1.5 text-[10px] text-slate-600">
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

              {/* Chân hóa đơn */}
              <div className="text-center space-y-1 pt-4 border-t border-dashed border-slate-300 text-[9px] text-slate-400">
                <p>Cảm ơn Quý Khách. Hẹn gặp lại!</p>
                <p>Mẫu hóa đơn in ấn điện tử POS Dược An Khang</p>
              </div>

            </div>

            {/* Nút hoàn thành */}
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
