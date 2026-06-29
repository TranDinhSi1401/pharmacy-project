# Hướng Dẫn Chi Tiết: Docker hóa & Triển khai Hệ Thống Quản Lý Bán Hàng Dược An Khang

Tài liệu này cung cấp cái nhìn toàn diện về việc sử dụng **Docker** và **Docker Compose** để đóng gói, cấu trúc và triển khai dự án **Pharmacy Project** (Hệ Thống Quản Lý Dược An Khang).

---

## 1. Docker là gì?
**Docker** là một nền tảng mã nguồn mở cho phép đóng gói ứng dụng và tất cả các phụ thuộc của nó (libraries, JRE, Node modules, cấu hình...) vào trong một đơn vị duy nhất gọi là **Container**.

```
+--------------------------------------------------------+
|                      ỨNG DỤNG                          |
|  (Frontend React + Backend Spring Boot + MongoDB)      |
+--------------------------------------------------------+
|           CONTAINER ENGINE (Docker Daemon)             |
+--------------------------------------------------------+
|                   HOST OS (Ubuntu Kernel)              |
+--------------------------------------------------------+
|                      PHẦN CỨNG                         |
+--------------------------------------------------------+
```

### So sánh nhanh: Container vs. Máy ảo (Virtual Machine)

| Đặc tính | Docker Container | Máy ảo (Virtual Machine) |
| :--- | :--- | :--- |
| **Kiến trúc** | Chia sẻ chung nhân (kernel) của Host OS. | Chạy một hệ điều hành khách (Guest OS) đầy đủ trên Hypervisor. |
| **Kích thước** | Rất nhỏ gọn (vài chục đến vài trăm MB). | Rất nặng (từ vài GB trở lên). |
| **Thời gian khởi động** | Gần như tức thì (tính bằng giây). | Chậm (tính bằng phút do phải boot OS). |
| **Hiệu suất** | Gần tương đương hiệu suất máy thật. | Bị hao phí tài nguyên cho việc chạy Guest OS. |

---

## 2. Tại sao chọn Docker cho Dự án Pharmacy?

1. **Nhất quán môi trường (Environment Consistency):**
   * Giải quyết triệt để lỗi kinh điển: *"Code chạy bình thường trên máy em (Windows) nhưng lỗi trên máy anh (Linux)"*.
   * Toàn bộ môi trường cài đặt Java JDK, Node.js, Nginx hay MongoDB đã được định nghĩa cứng trong file cấu hình. Bất kỳ máy chủ nào cài Docker đều chạy ra kết quả giống hệt nhau.
2. **Cô lập và bảo mật (Isolation):**
   * Mỗi service chạy trong một sandbox (hộp cát) riêng biệt. Lỗi hoặc lỗ hổng bảo mật của một service (ví dụ: frontend) sẽ không làm ảnh hưởng trực tiếp đến dữ liệu của database hay hệ thống file của Host OS.
3. **Tiết kiệm tài nguyên tối đa:**
   * Việc chạy cả 3 dịch vụ (Frontend, Backend, Database) trên cùng một máy chủ ảo (VPS) Ubuntu giá rẻ trở nên khả thi và mượt mà hơn nhờ việc loại bỏ overhead của việc cài nhiều hệ điều hành ảo hóa.
4. **Quy trình build và deploy tự động hóa dễ dàng:**
   * Chỉ với 1 lệnh duy nhất, hệ thống tự build code, cài dependencies, kết nối mạng và ánh xạ cổng.

---

## 3. Kiến trúc Container của Hệ Thống

Hệ thống được thiết kế theo mô hình **3-Tier** cô lập bên trong một mạng Docker nội bộ (Default Bridge Network):

```mermaid
graph TD
    Client["Trình duyệt Client (Máy Windows / Điện thoại)"]
    
    subgraph Docker_Network ["Docker Bridge Network (pharmacy-network)"]
        Nginx["pharmacy-frontend (Nginx)<br/>Cổng trong: 80<br/>Cổng ngoài: 8082"]
        Backend["pharmacy-backend (Spring Boot)<br/>Cổng trong: 8081<br/>Cổng ngoài: 8081"]
        MongoDB["pharmacy-mongo (MongoDB 8)<br/>Cổng trong: 27017<br/>Cổng ngoài: 27017"]
    end
    
    Volume[("Named Volume:<br/>mongo-data")]

    Client -->|HTTP Request - Cổng 8082| Nginx
    Nginx -->|Reverse Proxy /api/*| Backend
    Backend -->|MongoDB Protocol| MongoDB
    MongoDB <-->|Đọc/Ghi dữ liệu| Volume
```

### Luồng xử lý request:
1. Người dùng truy cập giao diện qua địa chỉ `http://<IP_Ubuntu>:8082`. Request này chạm tới cổng `8082` trên Host OS, được Docker ánh xạ vào cổng `80` (Nginx) bên trong container `pharmacy-frontend`.
2. Khi người dùng thực hiện các thao tác gọi API (ví dụ: đăng nhập, thanh toán, tìm thuốc), frontend gửi request đến đường dẫn `/api/*`.
3. Cấu hình Nginx trong container frontend sẽ bắt các request `/api` và thực hiện **Reverse Proxy** chuyển tiếp trực tiếp sang container `pharmacy-backend` thông qua DNS nội bộ của Docker: `http://spring-boot:8081`.
4. Backend xử lý logic và truy vấn dữ liệu từ database thông qua kết nối tới container database `pharmacy-mongo` trên cổng nội bộ `27017`.
5. Dữ liệu của database MongoDB được đồng bộ liên tục ra vùng đĩa lưu trữ ngoài `mongo-data` volume để tránh mất mát khi container bị tắt.

---

## 4. Chi tiết File Compose (`docker-compose.yml`)

Dưới đây là nội dung cấu hình [docker-compose.yml](file:///d:/pharmacy-project_/docker-compose.yml) và phân tích chi tiết:

```yaml
services:
    # ------------------ DỊCH VỤ 1: FRONTEND ------------------
    frontend:
        image: vokhoaecho/pharmacy-frontend:2.0 # Tải trực tiếp image Frontend đã được build sẵn từ Docker Hub
        container_name: pharmacy-frontend      # Đặt tên container hiển thị trực quan
        restart: unless-stopped                # Tự khởi động lại nếu bị crash trừ khi chủ động tắt
        ports:
            - "8082:80"                        # Ánh xạ: Cổng 8082 Host -> Cổng 80 Container
        depends_on:
            - spring-boot                      # Yêu cầu khởi động Spring Boot trước frontend

    # ------------------ DỊCH VỤ 2: BACKEND (SPRING BOOT) -----
    spring-boot:
        image: dinhsi1401/pharmacy:2.0         # Tải trực tiếp image Backend đã được build sẵn từ Docker Hub
        container_name: pharmacy-backend
        restart: unless-stopped
        ports:
            - "8081:8081"                      # Ánh xạ: Cổng 8081 Host -> Cổng 8081 Container
        environment:                           # Cấu hình biến môi trường kết nối Database
            MONGODB_URI: mongodb://root:root@mongodb:27017/pharmacy?authSource=admin
            MONGODB_DATABASE: pharmacy
            SPRING_DATA_MONGODB_DATABASE: pharmacy
        depends_on:
            - mongodb                          # Yêu cầu MongoDB phải chạy trước backend

    # ------------------ DỊCH VỤ 3: DATABASE (MONGODB) --------
    mongodb: 
        image: mongo:8                         # Sử dụng MongoDB phiên bản mới nhất 8.0
        container_name: pharmacy-mongo
        restart: unless-stopped
        environment:                           # Cấu hình tài khoản root của Database
          MONGO_INITDB_ROOT_USERNAME: root
          MONGO_INITDB_ROOT_PASSWORD: root
          MONGO_INITDB_DATABASE: pharmacy
        ports:
          - "27017:27017"                      # Ánh xạ cổng MongoDB ra ngoài để tiện kết nối tool debug
        volumes:
          - mongo-data:/data/db                # Ánh xạ dữ liệu MongoDB vào Named Volume

# Khai báo Volume dùng chung để lưu trữ dữ liệu vĩnh viễn
volumes:
  mongo-data: 
```

---

## 5. Phân tích Volume, Network và Port

### A. Quản lý Port (Ánh xạ cổng)
Mỗi container chạy độc lập giống như một máy tính mini riêng biệt nên chúng có hệ thống cổng nội bộ riêng. Docker Compose thực hiện ánh xạ các cổng này ra Host OS:

| Tên Dịch Vụ | Tên Container | Cổng Nội Bộ (Inside) | Cổng Ánh Xạ Ngoài (Host) | Vai trò |
| :--- | :--- | :--- | :--- | :--- |
| **frontend** | `pharmacy-frontend` | `80` (Nginx) | **`8082`** | Giao diện người dùng Web |
| **spring-boot** | `pharmacy-backend` | `8081` | **`8081`** | API Service chính |
| **mongodb** | `pharmacy-mongo` | `27017` | **`27017`** | Cơ sở dữ liệu MongoDB |

### B. Mạng Nội Bộ (Docker Network)
* Khi chạy lệnh `docker compose up`, Docker tự động tạo ra một mạng ảo mặc định dạng **bridge** cho cả 3 container.
* **Cơ chế DNS nội bộ:** Các container trong cùng mạng có thể gọi nhau thông qua **Tên Dịch Vụ (Service Name)** được định nghĩa trong file compose, thay vì dùng địa chỉ IP động khó quản lý.
  * *Ví dụ:* Trong cấu hình môi trường của Backend, thay vì dùng `localhost:27017` (sẽ trỏ vào chính backend container), ta dùng `mongodb:27017` để Docker tự động định tuyến đến container `pharmacy-mongo`.
  * Trong cấu hình Nginx của Frontend, ta dùng `http://spring-boot:8081` để gửi các request API tới container `pharmacy-backend`.

### C. Lưu Trữ Bền Vững (Docker Volume)
* Theo mặc định, dữ liệu sinh ra bên trong container là dữ liệu tạm thời (**ephemeral**). Nếu container bị xóa đi để nâng cấp hoặc bảo trì, toàn bộ dữ liệu sẽ biến mất.
* Để giải quyết vấn đề này, ta khai báo `volumes: - mongo-data:/data/db`. 
* Khi đó, toàn bộ dữ liệu trong thư mục `/data/db` của MongoDB bên trong container sẽ được ghi và lưu trữ trực tiếp tại thư mục được Docker quản lý trên ổ đĩa của máy Host. Ngay cả khi container database bị xóa sạch hay build lại, dữ liệu cũ vẫn nguyên vẹn.

---

## 6. Quy Trình Triển Khai Hệ Thống

> [!IMPORTANT]
> Trước khi truyền file từ Windows sang Linux bằng WinSCP, hãy đảm bảo thư mục `frontend` của bạn đã xóa bỏ thư mục `node_modules` và thư mục `backend` đã xóa bỏ `target` để tối ưu hóa thời gian truyền file.

Các bước triển khai chi tiết trên máy chủ Ubuntu Server:

### Bước 1: Di chuyển vào thư mục dự án trên máy chủ
```bash
cd ~/pharmacy-project
```

### Bước 2: Khởi chạy các dịch vụ thông qua Docker Compose
Chạy lệnh sau để Docker tự động tải các image đã đóng gói sẵn từ Docker Hub và khởi động ngầm (`-d`):
```bash
sudo docker compose up -d --build
```
> [!NOTE]
> Trong cấu hình hiện tại, cả Frontend và Backend đều sử dụng image pre-built kéo từ Docker Hub (`vokhoaecho/pharmacy-frontend:2.0` và `dinhsi1401/pharmacy:2.0`). Do đó, cờ `--build` thực tế sẽ được Docker Compose bỏ qua (không thực hiện build gì ở local). Cờ này được giữ lại để phòng trường hợp tương lai bạn chuyển lại cấu hình sang build trực tiếp từ mã nguồn thông qua `build: ./frontend`.

### *Chi tiết: Cơ chế hoạt động của lệnh `docker compose up -d --build`*

Để hiểu sâu hơn về cách Docker Compose vận hành lệnh này bên dưới hệ thống, dưới đây là phân tích chi tiết:

#### A. Ý nghĩa các Flag và Phân tích Cấu hình
*   **`-d` (Detached mode)**: Giải phóng terminal bằng cách ngắt kết nối stream stdout/stderr của container với client. Các container sẽ chạy dưới dạng background processes do Docker Engine trực tiếp quản lý.
*   **`--build`**: Thường dùng để ép buộc Docker Compose build lại image từ local Dockerfile. Tuy nhiên, vì cấu hình hiện tại của bạn đã đổi sang sử dụng **image pre-built trên Docker Hub** cho cả frontend và backend, Docker Compose sẽ tự động bỏ qua bước build này.
*   **Thứ tự đọc cấu hình**: 
    1. Đọc và nạp các biến từ môi trường Host OS (ưu tiên cao nhất).
    2. Đọc file cấu hình môi trường `.env` trong thư mục hiện tại.
    3. Phân tích file [docker-compose.yml](file:///d:/pharmacy-project_/docker-compose.yml) và thực hiện nội suy các biến (Variable Interpolation).
    4. Hợp nhất cấu hình thành đặc tả hệ thống cuối cùng.

#### B. Sơ đồ 1 (Sequence Diagram) - Trình tự thời gian và luồng dữ liệu
Sơ đồ dưới đây thể hiện cách thức Docker Client gửi thông tin qua REST API, kiểm tra và tải các image từ Docker Hub, sau đó so sánh cấu hình và khởi chạy các container theo thứ tự phụ thuộc.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as DevOps Engineer / System Admin
    participant Client as Docker Client (CLI)
    participant Daemon as Docker Daemon (Engine)
    participant Registry as Docker Registry (Hub)

    Admin->>Client: Chạy `sudo docker compose up -d --build`
    activate Client
    
    Note over Client: BƯỚC 1: XỬ LÝ CẤU HÌNH CỤC BỘ
    Client->>Client: Đọc biến từ file .env
    Client->>Client: Phân tích & nội suy docker-compose.yml
    Client->>Client: Xây dựng Đồ thị phụ thuộc (DAG)
    
    Note over Client: BƯỚC 2: KIỂM TRA & TẢI ẢNH (IMAGES PRE-BUILT)
    Client->>Daemon: Kiểm tra sự tồn tại của các image (frontend:2.0, backend:2.0, mongo:8)
    activate Daemon
    alt Các image chưa có sẵn ở local
        Daemon->>Registry: Pull các image từ Docker Hub
        Registry-->>Daemon: Tải về các Layers của Image
    end
    Daemon-->>Client: Xác nhận các Images đã sẵn sàng ở local
    deactivate Daemon

    Note over Client: BƯỚC 3: THIẾT LẬP HẠ TẦNG & CONTAINER (Theo DAG)
    Client->>Daemon: Yêu cầu triển khai hệ thống
    activate Daemon
    Daemon->>Daemon: Tạo Docker Bridge Network (nếu chưa có)
    Daemon->>Daemon: Tạo Named Volume mongo-data (nếu chưa có)
    
    Note over Daemon: 1. Triển khai mongodb (Không phụ thuộc ai)
    Daemon->>Daemon: So sánh config -> Phát hiện container cũ -> Stop & Remove
    Daemon->>Daemon: Tạo và Start Container pharmacy-mongo
    
    Note over Daemon: 2. Triển khai spring-boot (Đợi mongodb)
    Daemon->>Daemon: So sánh config -> Phát hiện container cũ -> Stop & Remove
    Daemon->>Daemon: Tạo và Start Container pharmacy-backend
    
    Note over Daemon: 3. Triển khai frontend (Đợi spring-boot)
    Daemon->>Daemon: So sánh config -> Phát hiện container cũ (nếu có Image ID mới/Config thay đổi) -> Stop & Remove
    Daemon->>Daemon: Tạo và Start Container pharmacy-frontend

    Daemon-->>Client: Trả về trạng thái: Khởi chạy thành công toàn bộ
    deactivate Daemon

    Client-->>Admin: Hiển thị trạng thái Done & Giải phóng Terminal (-d)
    deactivate Client
```

#### C. Sơ đồ 2 (Component Diagram) - Kiến trúc điều phối của Docker Daemon
Sơ đồ này mô tả mô hình hộp thể hiện Docker Engine quản lý và điều phối các đối tượng (Containers, Images, Networks, Volumes) trong Host OS:

```mermaid
graph TB
    subgraph Host_OS ["Hệ điều hành Host OS"]
        Docker_CLI["Docker CLI Client"]
        
        subgraph Docker_Engine ["Docker Daemon (Engine)"]
            direction TB
            Core_Engine["Core Engine & API Server"]

            subgraph Networks_Mgr ["Quản lý Mạng"]
                Bridge_Net["Bridge Network (pharmacy-network)"]
                Host_Net["Host Network"]
                DNS_Resolver["Embedded DNS Service"]
            end

            subgraph Volumes_Mgr ["Quản lý Bộ nhớ"]
                Named_Vol[("Named Volume: mongo-data")]
                Bind_Mounts["Bind Mounts"]
            end

            subgraph Images_Mgr ["Quản lý Ảnh"]
                Img_Frontend["Image: vokhoaecho/pharmacy-frontend:2.0"]
                Img_Backend["Image: dinhsi1401/pharmacy:2.0"]
                Img_Mongo["Image: mongo:8"]
            end

            subgraph Containers_Mgr ["Quản lý Container"]
                Cont_Frontend["Container: pharmacy-frontend"]
                Cont_Backend["Container: pharmacy-backend"]
                Cont_Mongo["Container: pharmacy-mongo"]
            end
        end

        Docker_CLI ==>|Gửi REST API Requests| Core_Engine
        
        Cont_Frontend -.->|Instance của| Img_Frontend
        Cont_Backend -.->|Instance của| Img_Backend
        Cont_Mongo -.->|Instance của| Img_Mongo

        Cont_Frontend ===>|Gắn vào| Bridge_Net
        Cont_Backend ===>|Gắn vào| Bridge_Net
        Cont_Mongo ===>|Gắn vào| Bridge_Net
        Bridge_Net --- DNS_Resolver

        Cont_Mongo ===>|Ghi dữ liệu bền vững| Named_Vol
        
        Host_Port_8082["Cổng Host: 8082"] ===>|Ánh xạ Port| Cont_Frontend
        Host_Port_8081["Cổng Host: 8081"] ===>|Ánh xạ Port| Cont_Backend
        Host_Port_27017["Cổng Host: 27017"] ===>|Ánh xạ Port| Cont_Mongo
    end
```

#### D. Thứ tự khởi tạo Container (Topological Sorting)
Docker Compose xây dựng **Đồ thị chỉ hướng không chu trình (DAG)** từ các chỉ thị `depends_on`. Dựa trên thuật toán sắp xếp Topo (Topological Sort), Docker biết rõ container nào cần tạo và khởi chạy trước:
1. `mongodb` không phụ thuộc dịch vụ nào ➔ Khởi chạy trước tiên.
2. `spring-boot` phụ thuộc vào `mongodb` ➔ Đợi `mongodb` khởi chạy xong mới chạy.
3. `frontend` phụ thuộc `spring-boot` ➔ Khởi chạy cuối cùng.

---

### Bước 3: Cài đặt công cụ nạp dữ liệu vào MongoDB Container
Do container MongoDB 8 được lược giản dung lượng, ta cần cài đặt công cụ dòng lệnh `mongodb-database-tools` để sử dụng lệnh `mongoimport`:
```bash
# 1. Cập nhật danh sách gói trong container MongoDB
sudo docker exec -u 0 -it pharmacy-mongo apt-get update

# 2. Cài đặt các công cụ database tools
sudo docker exec -u 0 -it pharmacy-mongo apt-get install -y mongodb-database-tools
```

### Bước 4: Thực thi Script nhập cơ sở dữ liệu mẫu
Nhập toàn bộ thông tin nhân viên, sản phẩm thuốc, khách hàng và hóa đơn mẫu vào database:
```bash
bash import_db.sh
```

---

## 7. Quy Trình Kiểm Thử & Xác Minh Hoạt Động

Sau khi triển khai, quản trị viên cần thực hiện kiểm thử theo các bước dưới đây để đảm bảo hệ thống hoạt động đúng thiết kế:

### 1. Kiểm tra trạng thái chạy của các container
```bash
sudo docker ps
```
**Kết quả mong muốn:** Cả 3 container `pharmacy-frontend`, `pharmacy-backend`, và `pharmacy-mongo` đều có trạng thái `Up` (Running) và không bị restart liên tục.

### 2. Kiểm tra log hệ thống (Đặc biệt là Backend và Nginx)
Để xem log kết nối cơ sở dữ liệu của Spring Boot:
```bash
sudo docker logs -f pharmacy-backend
```
* **Kết quả mong muốn:** Trong log xuất hiện thông báo khởi động Spring Boot thành công và kết nối thành công tới MongoDB:
  `Opened connection [connectionId{localValue:1, serverValue:1}] to mongodb:27017`

Để xem log traffic truy cập của frontend Nginx:
```bash
sudo docker logs -f pharmacy-frontend
```

### 3. Kiểm thử cổng kết nối và bảo mật
Sử dụng công cụ `curl` hoặc truy cập trực tiếp từ máy Client:
* **Kiểm tra cổng Frontend:** `curl -I http://localhost:8082` -> Phải nhận về HTTP 200.
* **Kiểm tra cổng Backend:** Truy cập `http://<IP_Server>:8081/api` -> Nhận về phản hồi từ Spring Boot API (hoặc HTTP 404/401 tùy route thay vì Connection Refused).
* **Kiểm tra kết nối DB:** Sử dụng phần mềm MongoDB Compass kết nối từ máy ngoài bằng URI `mongodb://root:root@<IP_Server>:27017/pharmacy?authSource=admin`.

### 4. Đăng nhập hệ thống chạy thử
Mở trình duyệt truy cập `http://<IP_Ubuntu>:8082` và đăng nhập bằng tài khoản mẫu:
* **Mã nhân viên (Username):** `NV-0001`
* **Mật khẩu (Password):** `Votienkhoa123@`
* **Nghiệp vụ cần test:** 
  - Xem danh sách thuốc (Products).
  - Thêm một sản phẩm mới vào giỏ hàng và tạo hóa đơn (Invoices).
  - Kiểm tra xem hóa đơn mới có được lưu lại và hiển thị trên giao diện không.

---

## 8. Đánh Giá Ưu và Nhược Điểm Thực Tế của Docker

Áp dụng Docker mang lại nhiều lợi ích thực tế nhưng cũng đi kèm với một số đánh đổi kỹ thuật.

### 👍 Ưu điểm (Pros)
1. **Rút ngắn thời gian Setup môi trường:**
   * Thay vì mất nửa ngày để cài đặt JDK 17, cấu hình Node, cấu hình Nginx, phân quyền MongoDB và mở port thủ công trên Ubuntu, lập trình viên chỉ cần chạy 1 lệnh duy nhất và hệ thống sẵn sàng sau 3-5 phút.
2. **Quản lý phiên bản sạch sẽ:**
   * Mọi thư viện phục vụ build và run đều nằm gói gọn trong container. Khi không sử dụng dự án nữa, chỉ cần lệnh `docker compose down -v` là toàn bộ máy chủ Ubuntu sẽ được dọn dẹp sạch sẽ, không để lại rác hay xung đột thư viện với các dự án khác.
3. **Cơ chế Multi-stage Build tối ưu hóa dung lượng:**
   * Dockerfile của Frontend chia làm 2 giai đoạn: Giai đoạn 1 dùng image Node.js nặng để build ứng dụng React, giai đoạn 2 chỉ copy các file tĩnh đã build vào image Nginx siêu nhẹ (Nginx Alpine chỉ khoảng 20-30MB). Giúp image chạy thực tế cực kỳ nhỏ gọn và bảo mật do không chứa mã nguồn gốc hay các file build thừa.

### 👎 Nhược điểm & Thách thức (Cons)
1. **Tiêu hao dung lượng ổ đĩa (Disk Space):**
   * Docker lưu trữ các layer của image trên đĩa. Qua nhiều lần chỉnh sửa code và chạy lệnh `up -d --build`, các image cũ không còn dùng (dangling images) sẽ chiếm nhiều dung lượng đĩa của VPS.
   * *Giải pháp:* Định kỳ chạy lệnh dọn dẹp hệ thống Docker:
     ```bash
     sudo docker system prune -f
     sudo docker image prune -a -f
     ```
2. **Khó khăn hơn trong việc Debug sâu:**
   * Khi code chạy bên trong container, các tool profiler hoặc debugger của IDE khó gắn (attach) trực tiếp vào tiến trình (process) hơn so với việc chạy local trực tiếp.
   * Cần cấu hình mở thêm cổng debug (ví dụ Java Remote Debug Port 5005) nếu muốn debug từ xa.
3. **Rủi ro bảo mật từ các cấu hình mặc định:**
   * Việc mở cổng MongoDB ra ngoài Host (`27017:27017`) giúp dev dễ kết nối tool Compass từ Windows để xem database, nhưng nếu quên bật tường lửa (UFW) trên Ubuntu để chặn các IP lạ hoặc sử dụng mật khẩu quá yếu (`root/root`), database có thể bị quét và lấy cắp dữ liệu tự động bởi các botnet trên internet.
   * *Khuyến nghị:* Trong môi trường sản xuất (Production), hãy xóa dòng ports `27017:27017` trong file compose của MongoDB để chỉ cho phép backend kết nối nội bộ thông qua mạng ảo Docker.
