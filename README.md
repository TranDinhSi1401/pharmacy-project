# Hướng Dẫn Triển Khai Hệ Thống Quản Lý Bán Hàng & POS Dược An Khang Lên Ubuntu Server.

Tài liệu này hướng dẫn chi tiết từng bước cách chuyển mã nguồn dự án từ máy tính Windows sang máy ảo Ubuntu Server, cấu hình chạy Docker và nạp cơ sở dữ liệu để chạy thử ứng dụng.

---

## 📌 Các Thành Phần Hệ Thống
* **Frontend (React - Nginx):** Cổng chạy `8082` (đã được cấu hình tự động proxy API `/api` sang backend).
* **Backend (Spring Boot):** Cổng chạy `8081`.
* **Database (MongoDB 8.0):** Cổng chạy `27017` (yêu cầu xác thực tài khoản `root` / `root`).

---

## 🛠️ Yêu Cầu Chuẩn Bị
1. Máy ảo **Ubuntu Server** đã được cài đặt Docker và Docker Compose (Nếu chưa có, xem hướng dẫn cài đặt ở **Phụ lục**).
2. Phần mềm **WinSCP** đã cài đặt trên máy Windows để truyền file.
3. Thư mục mã nguồn dự án trên Windows đã sẵn sàng (đã bao gồm các file `docker-compose.yml`, `import_db.sh` và thư mục `json_data`).

---

## 🚀 Các Bước Thực Hiện Chi Tiết

### BƯỚC 1: Dọn Dẹp Và Kéo Dự Án Từ Windows Sang Ubuntu Bằng WinSCP

1. **Dọn dẹp code trên Windows trước khi truyền:**
   * Vào thư mục `frontend`, nếu có thư mục `node_modules` thì **hãy xóa nó đi**.
   * *Giải thích:* `node_modules` chứa hàng chục nghìn file nhỏ rất nặng, truyền qua WinSCP sẽ mất hàng giờ. Khi chạy bằng Docker trên Ubuntu, Docker sẽ tự động tải và cài đặt lại các thư viện này bên trong container.

2. **Kết nối WinSCP vào máy ảo Ubuntu:**
   * Mở WinSCP trên Windows.
   * Chọn giao thức kết nối: **SFTP**.
   * **Host name (Tên máy chủ):** Nhập địa chỉ IP của máy ảo Ubuntu (Để xem IP trên máy ảo, gõ lệnh `hostname -I`).
   * **User name & Password:** Nhập tài khoản và mật khẩu đăng nhập của máy ảo Ubuntu (Ví dụ: `khoavo`).
   * Nhấn **Login**.

3. **Truyền file (Kéo thả):**
   * Phía bên trái giao diện WinSCP (Windows), tìm đến thư mục `pharmacy-project`.
   * Phía bên phải (Ubuntu), di chuyển vào thư mục cá nhân của bạn (mặc định là `/home/tên-user/` hoặc viết tắt là `~/`).
   * Kéo thư mục `pharmacy-project` từ bên trái thả sang bên phải và đợi WinSCP truyền file hoàn thành.

---

### BƯỚC 2: Khởi Chạy Các Container Bằng Docker Compose

1. Mở Terminal trên máy ảo Ubuntu (hoặc dùng SSH kết nối vào).
2. Di chuyển vào thư mục dự án vừa tải lên:
   ```bash
   cd ~/pharmacy-project
   ```
3. Chạy lệnh xây dựng và khởi động các container chạy ngầm (`-d`):
   ```bash
   sudo docker compose up -d --build
   ```
   *Lệnh này sẽ tải các image MongoDB, Spring Boot, đồng thời tự động build mã nguồn Frontend bằng Nginx và khởi chạy.*

---

### BƯỚC 3: Cài Đặt Công Cụ Nạp Dữ Liệu (Database Tools) Vào Container

Do các phiên bản MongoDB mới trong Docker (từ bản 4.4 trở đi) đã lược bỏ sẵn các công cụ dòng lệnh để giảm dung lượng, ta cần cài đặt thủ công công cụ `mongodb-database-tools` (chứa lệnh `mongoimport`) vào trong container MongoDB để nạp dữ liệu.

Chạy lần lượt 2 lệnh sau trên Terminal của Ubuntu (chạy với tư cách quyền root `-u 0` của container):

```bash
# 1. Cập nhật danh sách gói bên trong container MongoDB
sudo docker exec -u 0 -it pharmacy-mongo apt-get update

# 2. Cài đặt bộ công cụ database tools
sudo docker exec -u 0 -it pharmacy-mongo apt-get install -y mongodb-database-tools
```

---

### BƯỚC 4: Chạy File Script Nạp Dữ Liệu Mẫu (Seed Data)

Tôi đã viết sẵn một script [import_db.sh](import_db.sh) để tự động hóa việc copy các file JSON từ thư mục `json_data` vào container và nạp vào cơ sở dữ liệu `pharmacy`.

Chạy lệnh sau trên Terminal của Ubuntu:
```bash
bash import_db.sh
```

**Màn hình sẽ hiển thị thông báo thành công tương tự như sau:**
```text
1. Đang copy dữ liệu vào container pharmacy-mongo...
Successfully copied ... to pharmacy-mongo:/tmp/json_data
2. Đang import bảng employees (Nhân viên)...
4 document(s) imported successfully.
3. Đang import bảng products (Sản phẩm)...
50 document(s) imported successfully.
...
HOÀN THÀNH NHẬP DỮ LIỆU THÀNH CÔNG!
```

---

### BƯỚC 5: Kiểm Tra Và Đăng Nhập Hệ Thống

1. Mở trình duyệt trên máy Windows của bạn.
2. Truy cập địa chỉ IP của máy ảo kèm theo cổng `8082` (Cổng của Frontend):
   ```text
   http://<IP_MÁY_ẢO_UBUNTU>:8082
   ```
3. Tiến hành đăng nhập hệ thống bằng tài khoản nhân viên có sẵn trong file JSON:
   * **Mã nhân viên (Username):** `NV-0001`
   * **Mật khẩu (Password):** `Votienkhoa123@`

---

## 📋 Phụ Lục: Các Lệnh Hữu Ích

### 1. Hướng dẫn cài đặt Docker và Docker Compose trên Ubuntu (nếu chưa có):
```bash
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Mở cổng tường lửa Ubuntu (nếu không truy cập được web):
```bash
sudo ufw allow 8082/tcp
```

### 3. Các lệnh quản lý Docker Compose thông dụng:
* **Xem danh sách các container đang chạy:**
  ```bash
  sudo docker ps
  ```
* **Xem nhật ký hoạt động (Logs) để debug lỗi:**
  ```bash
  sudo docker compose logs -f
  ```
* **Khởi động lại toàn bộ hệ thống:**
  ```bash
  sudo docker compose restart
  ```
* **Dừng toàn bộ hệ thống (không mất dữ liệu):**
  ```bash
  sudo docker compose stop
  ```
* **Dừng và xóa các container:**
  ```bash
  sudo docker compose down
  ```
