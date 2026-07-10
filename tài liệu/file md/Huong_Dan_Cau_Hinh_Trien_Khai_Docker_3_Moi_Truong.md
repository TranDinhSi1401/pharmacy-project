# TÀI LIỆU HƯỚNG DẪN CẤU HÌNH VÀ TRIỂN KHAI DOCKER ĐA MÔI TRƯỜNG (DEV, UAT, PRODUCTION)

Quy trình phát triển phần mềm hiện đại đòi hỏi một ứng dụng phải đi qua các môi trường khác nhau trước khi tiếp cận người dùng cuối. Tài liệu này hướng dẫn chi tiết cách thiết lập, quản lý và triển khai hệ thống phần mềm chạy trên Docker qua 3 môi trường: **Development (Dev)**, **User Acceptance Testing (UAT)**, và **Production (Prod)** theo mô hình kế thừa và ghi đè cấu hình chuyên nghiệp.

---

## 1. BẢNG SO SÁNH TỔNG QUAN 3 MÔI TRƯỜNG (DEV, UAT, PRODUCTION)

Dưới đây là bảng phân tích so sánh chi tiết các tiêu chí hạ tầng, bảo mật, vận hành giữa 3 môi trường:

| Tiêu chí | Môi trường DEV (Development) | Môi trường UAT (Testing / Staging) | Môi trường PRODUCTION (Prod) |
| :--- | :--- | :--- | :--- |
| **Mục đích sử dụng** | Phục vụ lập trình viên (Developers) viết code, sửa lỗi, và tích hợp các tính năng mới một cách nhanh nhất. | Phục vụ QA/QC, Product Owner (PO) và khách hàng chạy thử nghiệm, kiểm thử và nghiệm thu sản phẩm. | Phục vụ người dùng cuối (End-users). Cung cấp dịch vụ ổn định, liên tục và có giá trị thương mại. |
| **Cấu hình phần cứng & Hạ tầng** | - Máy tính cá nhân (PC/Laptop) của Lập trình viên.<br>- Hoặc 1 VPS chung cấu hình tối thiểu (2 Cores CPU, 4GB RAM, SSD thường). | - VPS / Server Staging riêng biệt.<br>- Cấu hình khuyến nghị bằng 50% Prod (e.g., 2-4 Cores CPU, 8GB RAM, SSD). | - Hệ thống Cluster / Multiple Nodes (AWS, GCP, Azure, Bare-metal).<br>- Khuyến nghị cao (e.g., 4-8+ Cores, 16-32GB+ RAM, ổ cứng SSD NVMe tốc độ cao). |
| **Mức độ bảo mật (Security)** | - Thấp. Sử dụng mật khẩu mặc định hoặc đơn giản.<br>- **Expose ports** của Database (e.g. `27017`) và Backend (e.g. `5000`) ra ngoài máy host để dev dễ debug.<br>- Không bắt buộc cấu hình SSL/TLS. | - Trung bình. Sử dụng mật khẩu mạnh riêng biệt.<br>- **Tuyệt đối đóng port DB**, chỉ mở port của Frontend/Nginx.<br>- Giới hạn quyền truy cập bằng VPN, IP Whitelist hoặc HTTP Basic Auth.<br>- Sử dụng SSL miễn phí (Let's Encrypt). | - Cao nhất. Sử dụng mật khẩu cực mạnh mã hóa hoặc lưu trữ tập trung tại Key Vault (AWS Secrets Manager, HashiCorp Vault).<br>- Đóng kín toàn bộ port DB/Backend. Chỉ mở port HTTP (80) và HTTPS (443) đi qua Reverse Proxy.<br>- Sử dụng SSL có phí (Commercial SSL) và Cloudflare bảo vệ. |
| **Log & Monitoring** | - Xuất trực tiếp ra Console của Container để theo dõi thời gian thực (Real-time).<br>- Log level ở mức debug (Verbose).<br>- Theo dõi tài nguyên thủ công qua lệnh `docker stats`. | - Log được lưu vào các file cục bộ trong Container/Host, log level ở mức `info` hoặc `warn`.<br>- Giám sát tài nguyên cơ bản thông qua các script tự động. | - Hệ thống thu thập log tập trung (**Centralized Logging** như EFK Stack, Grafana Loki, Datadog).<br>- Giám sát tài nguyên tự động 24/7 (**Prometheus + Grafana**) kèm hệ thống cảnh báo tức thời qua Slack/Telegram khi tài nguyên quá tải. |
| **Chiến lược Backup dữ liệu** | - Không cần backup tự động.<br>- Dữ liệu mẫu (Mock data) có thể tự động tạo lại bất kỳ lúc nào bằng script hoặc migrations. | - Backup hàng tuần hoặc backup trước/sau mỗi đợt chạy thử nghiệm UAT lớn.<br>- Thường backup thủ công hoặc lưu file backup cục bộ trên server. | - **Backup tự động hoàn toàn** hàng giờ hoặc hàng ngày (Daily/Hourly backups).<br>- Nén dữ liệu và chuyển về lưu trữ an toàn bên ngoài (Offsite backup như AWS S3, Google Cloud Storage).<br>- Lưu trữ lịch sử backup tối thiểu 30 ngày. |

---

## 2. PHÂN TÍCH CẤU TRÚC FILE GIỮA CÁC MÔI TRƯỜNG (GIỐNG & KHÁC NHAU)

Để tối ưu hóa quy trình triển khai CI/CD và đảm bảo tính nhất quán (Consistent), cấu trúc file cấu hình được phân bổ theo nguyên tắc: **Đóng gói ứng dụng giống nhau, cấu hình môi trường khác nhau**.

### 2.1. Các File Giống Nhau Hoàn Toàn (Dùng chung và được commit lên Git)
*   **Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`):** Chứa các chỉ dẫn xây dựng Image cho Frontend và Backend. Tuân thủ nguyên tắc vàng: *"Build Once, Run Anywhere"* (Build một lần, chạy mọi nơi). Image sau khi build ở server CI/CD sẽ được deploy giống hệt nhau lên cả UAT và Production mà không cần sửa code.
*   **Mã nguồn chính của ứng dụng:** Toàn bộ thư mục code Backend (`backend/`) và Frontend (`frontend/`).
*   **File cấu hình Docker Compose Base (`docker-compose.base.yml`):** Định nghĩa cấu trúc khung của toàn bộ hệ thống gồm tên các service (`frontend`, `backend`, `mongodb`), cấu hình mạng nội bộ (`networks`), và các biến môi trường dạng placeholder (như `${MONGO_URI}`) để Docker Compose nạp dữ liệu động từ file `.env` khi chạy.
*   **File khai báo mẫu biến môi trường (`.env.example`):** Định nghĩa các khóa biến môi trường cần thiết phục vụ cho dự án nhưng không điền giá trị cụ thể, đóng vai trò tài liệu hướng dẫn cho lập trình viên mới.

### 2.2. Các File Bắt Buộc Phải Khác Nhau (Cấu hình riêng theo từng môi trường)
*   **Các file biến môi trường thực tế (`.env.dev`, `.env.uat`, `.env.prod`):**
    *   Chứa các giá trị cụ thể cho từng môi trường (ví dụ mật khẩu DB, URI kết nối DB, API Key, Client Secret, JWT Secret, Domain ứng dụng).
    *   *Lưu ý quan trọng:* Chỉ có `.env.dev` được phép commit lên Git (vì chứa thông số thử nghiệm không nhạy cảm). Các file `.env.uat` và `.env.prod` chứa thông số bảo mật cao nên bắt buộc phải nằm trong `.gitignore` và được phân phối an toàn trực tiếp lên server đích hoặc qua biến bí mật của CI/CD (GitHub Secrets, GitLab Variables).
*   **Các file Docker Compose Override (`docker-compose.dev.yml`, `docker-compose.uat.yml`, `docker-compose.prod.yml`):**
    *   Mỗi môi trường đòi hỏi cách vận hành container khác nhau. File override sẽ ghi đè các cấu hình đặc thù lên file base như ánh xạ cổng (ports), phân quyền (environment), chính sách khởi động lại (restart policy), log driver, giới hạn phần cứng (RAM/CPU) và phân tách volume.

---

## 3. SƠ ĐỒ CẤU TRÚC THƯ MỤC TỔNG QUAN (PROJECT STRUCTURE)

Dưới đây là sơ đồ tổ chức cây thư mục chuẩn DevOps cho dự án hỗ trợ đa môi trường:

```text
my-project/ (Root Workspace)
├── backend/                  # Thư mục mã nguồn Backend (Node.js/Express)
│   ├── src/                  # Mã nguồn chính API Backend
│   ├── package.json          # Quản lý thư viện Node.js
│   ├── package-lock.json     # Khóa phiên bản thư viện cài đặt
│   └── Dockerfile            # Dockerfile build backend image
├── frontend/                 # Thư mục mã nguồn Frontend (React/Vite/HTML)
│   ├── src/                  # Mã nguồn chính Giao diện Frontend
│   ├── package.json          # Quản lý thư viện Frontend
│   ├── package-lock.json     # Khóa phiên bản thư viện cài đặt
│   └── Dockerfile            # Dockerfile build frontend image (dùng Nginx phục vụ tĩnh)
├── docker/                   # Thư mục chứa cấu hình Docker tập trung (tuỳ chọn để giữ root gọn gàng)
│   ├── nginx/                # File cấu hình Nginx Reverse Proxy cho từng môi trường
│   │   ├── nginx.dev.conf
│   │   ├── nginx.uat.conf
│   │   └── nginx.prod.conf
│   └── scripts/              # Các script hỗ trợ tự động hóa
│       ├── backup_db.sh      # Script tự động backup database
│       └── restore_db.sh     # Script tự động khôi phục database
├── .env.example              # Khai báo danh sách biến môi trường mẫu (Commit lên Git)
├── .env.dev                  # Biến môi trường cho DEV local (Có thể commit)
├── .env.uat                  # Biến môi trường cho UAT server (Bị bỏ qua bởi Git)
├── .env.prod                 # Biến môi trường cho PRODUCTION server (Bị bỏ qua bởi Git, bảo mật tuyệt đối)
├── docker-compose.base.yml   # File Docker Compose nền tảng (chứa khung xương dịch vụ)
├── docker-compose.dev.yml    # File Docker Compose Override cho môi trường DEV
├── docker-compose.uat.yml    # File Docker Compose Override cho môi trường UAT
└── docker-compose.prod.yml   # File Docker Compose Override cho môi trường PRODUCTION
```

---

## 4. THIẾT KẾ CẤU HÌNH DOCKER COMPOSE ĐA MÔI TRƯỜNG

Ví dụ minh họa sử dụng hệ thống gồm 3 thành phần chính: **Frontend Web**, **Backend Node.js/Express**, và **MongoDB Database**.

### 4.1. File Docker Compose Chung: `docker-compose.base.yml`
File này đóng vai trò nền móng, định nghĩa các dịch vụ chính, Image tags và liên kết mạng (`networks`), nhưng không chứa thông số cổng hay phân bổ tài nguyên vật lý.

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: myapp-frontend:${FRONTEND_IMAGE_TAG:-latest}
    container_name: app-frontend
    networks:
      - frontend-net

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    image: myapp-backend:${BACKEND_IMAGE_TAG:-latest}
    container_name: app-backend
    environment:
      NODE_ENV: ${NODE_ENV}
      MONGO_URI: ${MONGO_URI}
      PORT: ${BACKEND_PORT}
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - frontend-net
      - backend-net

  mongodb:
    image: mongo:6.0
    container_name: app-mongodb
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    networks:
      - backend-net

networks:
  frontend-net:
  backend-net:
```

### 4.2. File Docker Compose Môi trường DEV: `docker-compose.dev.yml`
Bật tính năng **Bind Mount** để lập trình viên sửa code ở máy host thì code trong container lập tức thay đổi theo (Hot-Reload). Mở port DB để kết nối bằng GUI Tool từ máy cá nhân.

```yaml
version: '3.8'

services:
  frontend:
    ports:
      - "3000:80" # Truy cập UI trực tiếp tại http://localhost:3000
    volumes:
      - ./frontend/src:/app/src # Mount source code frontend để tự động cập nhật giao diện (hot-reload)
    restart: "no"

  backend:
    ports:
      - "5000:5000" # Truy cập API tại http://localhost:5000 phục vụ viết code và test Postman
    volumes:
      - ./backend/src:/app/src # Mount code backend, kết hợp nodemon trong Container để tự động restart ứng dụng
    restart: "no"

  mongodb:
    ports:
      - "27017:27017" # Mở cổng DB để devs kết nối trực tiếp qua MongoDB Compass ở máy host
    environment:
      MONGO_INITDB_DATABASE: app_dev # Khởi tạo Database dev mặc định không cần mật khẩu phức tạp
    volumes:
      - dev-db-data:/data/db # Sử dụng named volume nội bộ đơn giản
    restart: "no"

volumes:
  dev-db-data:
```

### 4.3. File Override Môi trường UAT: `docker-compose.uat.yml`
Tắt chế độ mount thư mục code (sử dụng code tĩnh đã build trong image), đóng hoàn toàn port DB. Bật xác thực Database và giới hạn tài nguyên máy chủ Staging để kiểm thử hiệu năng.

```yaml
version: '3.8'

services:
  frontend:
    ports:
      - "8080:80" # UAT chạy trên cổng 8080 để kiểm thử viên truy cập
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M

  backend:
    # Không expose port backend ra ngoài host, chỉ cho frontend gọi thông qua mạng nội bộ Docker
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  mongodb:
    # Cấm expose port DB ra ngoài internet để giả lập độ bảo mật cao
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: app_uat
    volumes:
      - uat-db-data:/data/db # Named volume do Docker quản lý
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

volumes:
  uat-db-data:
```

### 4.4. File Override Môi trường PRODUCTION: `docker-compose.prod.yml`
Bảo mật tối đa, cấu hình log rotation để tránh đầy dung lượng ổ đĩa. Giới hạn tài nguyên chặt chẽ và lưu trữ dữ liệu tại phân vùng đĩa SSD được mã hóa chuyên dụng.

```yaml
version: '3.8'

services:
  frontend:
    ports:
      - "80:80" # Hoặc 443 nếu tích hợp chứng chỉ SSL
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m" # Giới hạn mỗi file log tối đa 10MB
        max-file: "3"   # Giữ lại tối đa 3 file log cũ để tránh làm tràn đĩa cứng
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M

  backend:
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G

  mongodb:
    # Tuyệt đối đóng kín cổng DB, cấu hình thông số mật khẩu siêu mạnh qua file env.prod
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: app_prod
    volumes:
      # Liên kết named volume ra thư mục mount ổ đĩa cứng SSD chuyên dụng của hệ thống
      - prod-db-data:/data/db
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 2G

volumes:
  # Cấu hình named volume trỏ ra một phân vùng ổ cứng ngoài (SSD chuyên dụng) đã được mã hóa trên Host
  prod-db-data:
    driver: local
    driver_opts:
      type: 'none'
      o: 'bind'
      device: '/mnt/prod-secure-ssd/mongodb-data'
```

> [!NOTE]
> **Khuyến nghị kiến trúc cho Production:** 
> Trong các dự án thực tế quy mô lớn, việc tự chạy Container Database độc lập trên Production bằng Docker Compose tiềm ẩn nhiều rủi ro mất mát dữ liệu hoặc thắt nút cổ chai hiệu năng. Khuyến nghị loại bỏ cấu hình service `mongodb` khỏi file `docker-compose.prod.yml` và thay thế biến cấu hình `MONGO_URI` trực tiếp tới một dịch vụ Database Managed chuyên nghiệp (như MongoDB Atlas, AWS DocumentDB) để có độ ổn định tuyệt đối và cơ chế backup tự động cao cấp.

---

## 5. GIẢI THÍCH CHI TIẾT VÀ CÁCH CHẠY LỆNH

### 5.1. Cơ Chế Ghi Đè (Override) Của Docker Compose
Khi chạy lệnh Docker Compose kết hợp nhiều file bằng cờ `-f` (file), Docker Compose sẽ đọc tuần tự từ trái qua phải.
*   **File đầu tiên** (`docker-compose.base.yml`) đóng vai trò nền tảng.
*   **File tiếp theo** (`docker-compose.dev.yml`, `docker-compose.uat.yml`, hoặc `docker-compose.prod.yml`) sẽ ghi đè lên các giá trị trùng lặp của file base (ví dụ ghi đè cấu hình `ports`, `volumes`, `deploy.resources`), đồng thời giữ lại các giá trị cấu hình không bị khai báo lại ở file base (như cấu trúc service, networks...).
*   Cờ `--env-file` chỉ định cho Docker Compose nạp các giá trị biến môi trường tương ứng thay vì nạp file `.env` mặc định.

### 5.2. Các Lệnh Khởi Chạy Hệ Thống Ở Từng Môi Trường

#### A. Triển khai tại môi trường DEV (Local)
Trước khi chạy, lập trình viên tạo file `.env.dev` từ mẫu `.env.example` và điền cấu hình local. Sau đó chạy lệnh:
```bash
# Khởi chạy các container ở chế độ chạy ngầm (Detached) và tự động build lại Image nếu có thay đổi
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml --env-file .env.dev up -d --build
```
*Để dừng hệ thống DEV:*
```bash
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml down
```

#### B. Triển khai tại môi trường UAT (Testing)
Tạo file `.env.uat` trên máy chủ Staging và chạy lệnh:
```bash
# Khởi chạy hệ thống UAT trên VPS Testing
docker compose -f docker-compose.base.yml -f docker-compose.uat.yml --env-file .env.uat up -d --build
```
*Để dừng hệ thống UAT:*
```bash
docker compose -f docker-compose.base.yml -f docker-compose.uat.yml down
```

#### C. Triển khai tại môi trường PRODUCTION (Live Server)
Chuẩn bị file `.env.prod` chứa mật khẩu tuyệt mật trực tiếp trên Live Server. Sau đó chạy lệnh:
```bash
# Khởi chạy môi trường Production thực tế
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
*Để dừng hệ thống Production (khi cần bảo trì):*
```bash
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down
```
*Để xem log hệ thống Production thời gian thực:*
```bash
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f --tail=100
```

---
*Tài liệu được thiết kế và kiểm duyệt bởi Chuyên gia DevOps & System Architect của dự án.*
