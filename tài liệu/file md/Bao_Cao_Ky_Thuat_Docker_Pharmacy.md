# TÀI LIỆU BÁO CÁO KỸ THUẬT: KIẾN TRÚC & TRIỂN KHAI DOCKER HỆ THỐNG PHARMACY

Tài liệu này được lập bởi **Software Architect** và **Technical Writer** nhằm cung cấp cái nhìn toàn diện, chi tiết và chuyên nghiệp về việc Docker hóa, quản lý cấu hình và quy trình triển khai cho hệ thống **Pharmacy Project** (Hệ Thống Quản Lý Dược An Khang).

---

## 1. THÔNG TIN TỔNG QUAN HỆ THỐNG

Hệ thống được thiết kế theo mô hình **Client-Server (3-Tier Architecture)** phân tách rõ ràng các tầng giao diện, xử lý nghiệp vụ và lưu trữ dữ liệu nhằm đảm bảo tính cô lập, dễ bảo trì và khả năng mở rộng.

*   **Kiến trúc:** Mô hình Client-Server hoạt động trong môi trường Dockerized.
*   **Frontend (Tầng Giao Diện):**
    *   **Công nghệ:** ReactJS tích hợp Vite (Build tool siêu tốc) và styling bằng TailwindCSS.
    *   **Máy chủ Web tĩnh:** Nginx (được cấu hình làm web server phục vụ file tĩnh và Reverse Proxy cho API).
*   **Backend (Tầng Nghiệp Vụ):**
    *   **Công nghệ:** Java Spring Boot (sử dụng Maven để quản lý thư viện và vòng đời build).
    *   **Phiên bản runtime:** Java 17 (Eclipse Temurin JRE).
*   **Database (Tầng Lưu Trữ):**
    *   **Công nghệ:** MongoDB 8.0 (Hệ quản trị cơ sở dữ liệu NoSQL dạng tài liệu - Document-oriented).
*   **Containerization (Đóng gói & Điều phối):**
    *   **Công nghệ:** Docker Engine và Docker Compose.
    *   **Môi trường vận hành hỗ trợ:** Phát triển cục bộ (Development) và Triển khai thực tế (Production).

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

Dưới đây là sơ đồ cây thư mục của dự án **Pharmacy Project**, thể hiện rõ vị trí của mã nguồn Frontend, Backend cùng các file cấu hình Docker, biến môi trường và script vận hành:

```text
pharmacy-project/
├── .env.example                # File môi trường mẫu (chứa các key cấu hình không có giá trị nhạy cảm)
├── docker-compose.yml          # File Docker Compose gốc (định nghĩa services, networks và volumes)
├── docker-compose.dev.yml      # File Docker Compose ghi đè cho môi trường Phát triển (Development)
├── docker-compose.prod.yml     # File Docker Compose ghi đè cho môi trường Vận hành (Production)
├── import_db.sh                # Script Bash nạp dữ liệu mẫu vào MongoDB container
├── README.md                   # Hướng dẫn tổng quan dự án
├── backend/                    # Mã nguồn tầng Backend (Java Spring Boot)
│   ├── pom.xml                 # File quản lý dependencies của Maven
│   ├── Dockerfile              # File cấu hình build/run Docker image cho Backend (Multi-stage)
│   ├── src/                    # Thư mục chứa mã nguồn Java
│   │   ├── main/
│   │   └── test/
│   └── target/                 # Thư mục build output (file .jar) của Maven (bị bỏ qua khi push)
├── frontend/                   # Mã nguồn tầng Frontend (ReactJS + Vite)
│   ├── package.json            # File khai báo dependencies và scripts của Node.js
│   ├── Dockerfile              # File cấu hình build/run Docker image cho Frontend (Multi-stage)
│   ├── nginx.conf              # File cấu hình máy chủ Nginx (Routing SPA và Reverse Proxy)
│   ├── vite.config.js          # File cấu hình Vite build tool
│   ├── tailwind.config.js      # File cấu hình TailwindCSS
│   ├── index.html              # Điểm nhập giao diện HTML chính
│   └── src/                    # Thư mục chứa mã nguồn component và logic React
├── json_data/                  # Dữ liệu JSON mẫu phục vụ việc import ban đầu
│   ├── employees.json
│   ├── products.json
│   ├── customers.json
│   └── invoices.json
└── tài liệu/                   # Thư mục tài liệu dự án
    └── file md/
        └── Pharmacy_Project_Huong_Dan_Docker_v2.0.md
```

---

## 3. CHI TIẾT FILE CẤU HÌNH & GIẢI THÍCH (CONFIGURATION FILES)

Trong phần này, toàn bộ nội dung của các file cấu hình cốt lõi sẽ được hiển thị chi tiết cùng phần cắt nghĩa kỹ thuật cho từng dòng hoặc khối lệnh quan trọng.

---

### A. File cấu hình môi trường mẫu: `.env.example`

File này chứa danh sách các biến môi trường cấu hình cho hệ thống nhưng không đi kèm các giá trị thực tế nhạy cảm (như mật khẩu sản xuất). Khi triển khai, quản trị viên sẽ copy file này thành `.env` và điền giá trị phù hợp.

```bash
# Cấu hình container frontend
FRONTEND_IMAGE_TAG=

# Cấu hình container backend
SPRING_BOOT_IMAGE_TAG=
MONGODB_URI=
MONGODB_DATABASE=

# Cấu hình container mongodb
MONGO_INITDB_ROOT_USERNAME=
MONGO_INITDB_ROOT_PASSWORD=
MONGO_INITDB_DATABASE=
```

#### Giải thích chi tiết:
*   `FRONTEND_IMAGE_TAG`: Định nghĩa tag phiên bản cho Docker Image của Frontend (ví dụ: `2.0` hoặc `latest`).
*   `SPRING_BOOT_IMAGE_TAG`: Định nghĩa tag phiên bản cho Docker Image của Backend Spring Boot.
*   `MONGODB_URI`: Chuỗi kết nối từ Backend sang Database MongoDB (ví dụ: `mongodb://root:root@mongodb:27017/pharmacy?authSource=admin`).
*   `MONGODB_DATABASE`: Tên database mặc định mà Backend Spring Boot sẽ sử dụng để đọc ghi dữ liệu.
*   `MONGO_INITDB_ROOT_USERNAME` & `MONGO_INITDB_ROOT_PASSWORD`: Tài khoản quản trị tối cao (Root Administrator) được khởi tạo tự động khi container MongoDB chạy lần đầu tiên.
*   `MONGO_INITDB_DATABASE`: Tên cơ sở dữ liệu được Docker tự động tạo lúc khởi tạo MongoDB Engine.

---

### A2. File cấu hình môi trường chính thức: `.env`

Dưới đây là nội dung hoàn chỉnh của file `.env` chứa sẵn các giá trị cấu hình thực tế để khởi chạy hệ thống ngay lập tức:

```bash
# Cấu hình container frontend
FRONTEND_IMAGE_TAG=2.0

# Cấu hình container backend
SPRING_BOOT_IMAGE_TAG=2.0
MONGODB_URI=mongodb://root:root@mongodb:27017/pharmacy?authSource=admin
MONGODB_DATABASE=pharmacy

# Cấu hình container mongodb
MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=root
MONGO_INITDB_DATABASE=pharmacy
```

---

### B. Cấu hình Frontend Dockerfile: `frontend/Dockerfile`

Dockerfile của Frontend sử dụng phương pháp **Multi-stage Build** để chia quy trình đóng gói thành hai bước độc lập: Build mã nguồn React và Chạy ứng dụng tĩnh bằng Nginx.

```dockerfile
# Bước 1: Build mã nguồn React sử dụng Node.js
FROM node:20-alpine AS build

WORKDIR /app

# Copy package.json và package-lock.json để cài đặt dependencies trước (tối ưu cache Docker)
COPY package*.json ./
RUN npm install

# Copy toàn bộ mã nguồn frontend và build bản production
COPY . .
RUN npm run build

# Bước 2: Dùng Nginx để chạy bản build
FROM nginx:alpine

# Copy file cấu hình Nginx custom vào container
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy thư mục build từ bước 1 vào thư mục chứa static files của Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Giải thích chi tiết:
*   `FROM node:20-alpine AS build`: Khởi tạo giai đoạn build (Stage 1) sử dụng môi trường Node.js phiên bản 20 trên nền hệ điều hành Alpine Linux siêu nhẹ nhằm tiết kiệm bộ nhớ. Giai đoạn này được đặt danh danh (alias) là `build`.
*   `COPY package*.json ./` & `RUN npm install`: Copy các file định nghĩa thư viện trước rồi mới cài đặt. Quy trình này giúp tận dụng tối đa cơ chế lưu cache layer của Docker; nếu `package.json` không thay đổi, Docker sẽ bỏ qua bước tải thư viện ở các lần build sau, giảm thời gian build từ vài phút xuống vài giây.
*   `RUN npm run build`: Biên dịch mã nguồn React (JSX, ES6, CSS) thành các file tĩnh (`HTML`, `JS`, `CSS`) trong thư mục `/app/dist`.
*   `FROM nginx:alpine`: Bắt đầu giai đoạn chạy (Stage 2). Docker sẽ vứt bỏ toàn bộ môi trường Node.js và các file source code nặng nề ở bước 1, chỉ lấy một image Nginx Alpine siêu nhẹ (chỉ khoảng 20-30MB) làm runtime nền tảng.
*   `COPY nginx.conf /etc/nginx/conf.d/default.conf`: Ghi đè file cấu hình mặc định của Nginx bằng file cấu hình custom của dự án để hỗ trợ routing cho Single Page Application (SPA) và reverse proxy.
*   `COPY --from=build /app/dist /usr/share/nginx/html`: Sao chép kết quả build tĩnh (`/app/dist` ở Stage 1) vào thư mục phân phối file tĩnh của Nginx (`/usr/share/nginx/html`).
*   `EXPOSE 80`: Khai báo container sẽ lắng nghe yêu cầu kết nối ở cổng 80.
*   `CMD ["nginx", "-g", "daemon off;"]`: Lệnh khởi chạy Nginx dưới dạng tiến trình chính ở foreground. Nếu Nginx dừng, container sẽ dừng theo.

---

### C. Cấu hình Nginx Custom: `frontend/nginx.conf`

File cấu hình này giải quyết hai vấn đề sống còn của ứng dụng React: routing phía client và định tuyến API gọi đến Backend.

```nginx
server {
    listen 80;
    server_name localhost;

    # Thư mục chứa các file static đã build của React
    root /usr/share/nginx/html;
    index index.html;

    # Xử lý Routing SPA (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy ngược (Reverse Proxy) các request API sang container Spring Boot
    location /api {
        proxy_pass http://spring-boot:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache cấu hình cho assets tĩnh
    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|cur|gz|svg|svgz|mp4|ogg|ogv|webm|htc)$ {
        expires 1M;
        access_log off;
        add_header Cache-Control "public";
    }
}
```

#### Giải thích chi tiết:
*   `try_files $uri $uri/ /index.html;`: Khi client truy cập các route ảo của React Router (ví dụ: `/dashboard`, `/invoices`), Nginx sẽ không tìm thấy các thư mục vật lý tương ứng trên đĩa cứng. Dòng này yêu cầu Nginx chuyển hướng tất cả các request không tìm thấy file về lại `index.html` để React Router tự xử lý routing phía client, tránh lỗi `404 Not Found`.
*   `location /api`: Đánh dấu các request bắt đầu bằng `/api/*` (ví dụ: client gọi API lấy danh sách thuốc tại `http://localhost/api/products`).
*   `proxy_pass http://spring-boot:8081;`: Cơ chế **Reverse Proxy**. Nginx sẽ chuyển tiếp request API này đến container backend chạy Spring Boot tại địa chỉ nội bộ `http://spring-boot:8081` trong mạng Docker. Client hoàn toàn không biết backend đang chạy ở đâu.
*   `proxy_set_header X-Real-IP $remote_addr`: Truyền địa chỉ IP thực của client về cho backend ghi log hoặc xử lý bảo mật (nếu không có, backend chỉ nhận được IP nội bộ của Nginx container).

---

### D. Cấu hình Backend Dockerfile: `backend/Dockerfile`

Tương tự Frontend, Backend Spring Boot cũng được đóng gói qua **Multi-stage Build** nhằm giảm kích thước image từ hàng GB (chứa Maven và JDK đầy đủ) xuống chỉ khoảng 150MB (chỉ chứa JRE).

```dockerfile
# stage 1
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -B

# stage 2
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### Giải thích chi tiết:
*   `FROM maven:3.9-eclipse-temurin-17 AS builder`: Giai đoạn build (Stage 1). Sử dụng image Maven chính thức tích hợp sẵn OpenJDK 17 (Temurin phân phối) để tiến hành biên dịch ứng dụng Java.
*   `RUN mvn dependency:go-offline -B`: Tải trước toàn bộ các file thư viện `.jar` được khai báo trong `pom.xml` về local repository của container. Tham số `-B` (Batch-mode) tắt bớt log tải file rườm rà.
*   `RUN mvn package -DskipTests -B`: Biên dịch mã nguồn Java và đóng gói thành file thực thi duy nhất `.jar`. Cờ `-DskipTests` bỏ qua việc chạy unit test để tăng tốc độ đóng gói.
*   `FROM eclipse-temurin:17-jre`: Giai đoạn chạy (Stage 2). Sử dụng image Java Runtime Environment (JRE) chính thức, lược bỏ trình biên dịch JDK và Maven để giảm dung lượng đĩa tối đa và tăng tính an toàn (giảm bề mặt tấn công bảo mật).
*   `COPY --from=builder /build/target/*.jar app.jar`: Sao chép file `.jar` đã build thành công từ Stage 1 sang Stage 2 và đặt tên ngắn gọn là `app.jar`.
*   `ENTRYPOINT ["java", "-jar", "app.jar"]`: Lệnh cố định để chạy file JAR khi container bắt đầu khởi động.

---

### E. File Docker Compose gốc: `docker-compose.yml`

File này đóng vai trò như bản vẽ quy hoạch kiến trúc điều phối, liên kết các thành phần Frontend, Backend và Database vào một hệ thống thống nhất.

```yaml
services:
    frontend:
        image: vokhoaecho/pharmacy-frontend:${FRONTEND_IMAGE_TAG}
        container_name: pharmacy-frontend
        depends_on:
            - spring-boot
        networks:
            - frontend-net

    spring-boot:
        image: dinhsi1401/pharmacy:${SPRING_BOOT_IMAGE_TAG}
        container_name: pharmacy-backend
        environment:
            MONGODB_URI: ${MONGODB_URI}
            MONGODB_DATABASE: ${MONGODB_DATABASE}
        depends_on:
            mongodb:
                condition: service_healthy 
        networks:
            - frontend-net
            - backend-net

    mongodb: 
        image: mongo:8  
        container_name: pharmacy-mongo
        environment:
            MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
            MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD}
            MONGO_INITDB_DATABASE: ${MONGO_INITDB_DATABASE}
        healthcheck:
            test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
            interval: 10s
            timeout: 5s
            retries: 5
            start_period: 20s
        volumes:
            - mongo-data:/data/db 
        networks:
            - backend-net
          
volumes:
    mongo-data: 
  
networks:
    frontend-net:
    backend-net:
```

#### Giải thích chi tiết:
*   `image: vokhoaecho/pharmacy-frontend:${FRONTEND_IMAGE_TAG}`: Docker Compose sẽ lấy giá trị biến môi trường `FRONTEND_IMAGE_TAG` trong file `.env` để kéo đúng phiên bản image từ Docker Hub về chạy.
*   `depends_on`:
    *   `frontend` phụ thuộc `spring-boot`: Đảm bảo backend được khởi tạo trước frontend.
    *   `spring-boot` phụ thuộc `mongodb` với điều kiện `service_healthy`: Backend sẽ không khởi chạy cho đến khi tiến trình kiểm tra sức khỏe (`healthcheck`) của MongoDB báo trạng thái "khỏe mạnh" (đã sẵn sàng nhận kết nối). Việc này ngăn chặn lỗi crash của Spring Boot do cố kết nối vào Database khi DB chưa khởi động xong.
*   `healthcheck`: Đoạn mã chạy thử lệnh `mongosh --eval "db.adminCommand('ping')"` định kỳ 10 giây/lần bên trong container MongoDB để xác nhận Database đã hoàn toàn hoạt động bình thường.
*   `volumes: - mongo-data:/data/db`: Ánh xạ vùng dữ liệu `/data/db` của container vào volume `mongo-data` do Docker quản lý trên máy Host. Điều này đảm bảo dữ liệu của nhà thuốc được lưu trữ bền vững (không bị mất đi khi xóa container).
*   `networks`: Phân chia hệ thống thành hai mạng ảo cô lập:
    *   `frontend-net`: Nơi `frontend` và `spring-boot` nói chuyện với nhau.
    *   `backend-net`: Nơi `spring-boot` truy vấn dữ liệu từ `mongodb`.
    *   *Mục đích bảo mật:* Container `frontend` hoàn toàn không có kết nối tới `backend-net`, nghĩa là kẻ tấn công từ bên ngoài nếu chiếm quyền kiểm soát được container frontend cũng không thể quét mạng hay tấn công trực tiếp vào cơ sở dữ liệu MongoDB.

---

### F. File Docker Compose Phát triển: `docker-compose.dev.yml`

File cấu hình bổ sung (override) này dùng để cấu hình cổng kết nối công khai khi chạy trên môi trường phát triển cục bộ (Development) của lập trình viên.

```yaml
services:
    frontend:
        ports:
            - "8082:80"
            restart: unless-stopped
    
    # map port Spring ra ngoài để test api
    spring-boot:
        ports:
            - "8081:8081"
        restart: unless-stopped
        
    # map port Mongo ra ngoài để dùng DB Tool (DbSchema, Compass...) kiểm tra
    mongodb:
        ports:
            - "27017:27017"
        restart: unless-stopped
```

#### Giải thích chi tiết:
*   `ports: - "8082:80"`: Ánh xạ cổng 8082 của máy Host vào cổng 80 của container Frontend. Lập trình viên có thể truy cập giao diện qua địa chỉ `http://localhost:8082`.
*   `ports: - "8081:8081"`: Mở cổng API của Backend ra ngoài máy Host để kiểm thử các endpoint bằng các công cụ độc lập như Postman hoặc Insomnia.
*   `ports: - "27017:27017"`: Mở cổng cơ sở dữ liệu để dev sử dụng các phần mềm quản trị trực quan như MongoDB Compass hoặc DbSchema kết nối trực tiếp vào DB đang chạy trong Docker.

---

### G. File Docker Compose Sản xuất: `docker-compose.prod.yml`

File cấu hình bổ sung này ghi đè các cấu hình nhằm phục vụ môi trường vận hành thực tế (Production), tối ưu hóa tài nguyên phần cứng và tăng cường bảo mật.

```yaml
services:
    frontend:
        restart: unless-stopped
        ports:
            - "80:80"
        logging:
            driver: "json-file"
            options:
                max-size: "10m"
                max-file: "3"
        deploy:
            resources:
                limits:
                    cpus: "0.5"
                    memory: 256M

    spring-boot:
        restart: unless-stopped
        logging:
            driver: "json-file"
            options:
                max-size: "10m"
                max-file: "3"
        deploy:
            resources:
                limits:
                    cpus: "1.0"
                    memory: 768M

    mongodb:
        restart: unless-stopped
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
```

#### Giải thích chi tiết:
*   `ports: - "80:80"`: Ánh xạ cổng chuẩn HTTP (80) ra ngoài internet. Người dùng chỉ cần truy cập địa chỉ IP của server hoặc domain mà không cần chỉ định cổng.
*   **Không mở cổng Backend (`8081`) và Database (`27017`):** Trong production, hai dịch vụ này được ẩn hoàn toàn khỏi internet. Frontend Nginx sẽ lo việc proxy API vào trong mạng nội bộ Docker. Điều này loại bỏ hoàn toàn các cuộc tấn công quét cổng từ bên ngoài vào database và server nghiệp vụ.
*   `logging`: Giới hạn log ghi ra đĩa cứng của mỗi container tối đa 10 Megabytes (`10m`) và lưu tối đa 3 file xoay vòng (`max-file: "3"`). Việc này ngăn ngừa lỗi máy chủ bị hết dung lượng đĩa do log hệ thống ghi vô tội vạ qua nhiều tháng hoạt động.
*   `deploy.resources.limits`: Giới hạn phần cứng tối đa mà container được phép sử dụng (CPU và RAM). Việc giới hạn này ngăn ngừa trường hợp một service bị lỗi rò rỉ bộ nhớ (memory leak) tiêu thụ sạch tài nguyên của máy chủ vật lý, làm sập toàn bộ các dịch vụ khác chạy chung.

---

### H. Script Nạp Dữ Liệu Tự Động: `import_db.sh`

Script shell này tự động hóa việc import dữ liệu mẫu dạng JSON vào database MongoDB đang chạy bên trong container Docker.

```bash
#!/bin/bash

# Script nhập dữ liệu JSON vào MongoDB Container
echo "============================================="
echo "BẮT ĐẦU NHẬP DỮ LIỆU JSON VÀO MONGODB"
echo "============================================="

# 1. Sao chép thư mục json_data vào trong container MongoDB
echo "1. Đang copy dữ liệu vào container pharmacy-mongo..."
sudo docker cp json_data pharmacy-mongo:/tmp/json_data

# 2. Thực hiện import cho từng bảng (collection)
echo "2. Đang import bảng employees (Nhân viên)..."
sudo docker exec -i pharmacy-mongo mongoimport --username root --password root --authenticationDatabase admin --db pharmacy --collection employees --file /tmp/json_data/employees.json --jsonArray

echo "3. Đang import bảng products (Sản phẩm)..."
sudo docker exec -i pharmacy-mongo mongoimport --username root --password root --authenticationDatabase admin --db pharmacy --collection products --file /tmp/json_data/products.json --jsonArray

echo "4. Đang import bảng customers (Khách hàng)..."
sudo docker exec -i pharmacy-mongo mongoimport --username root --password root --authenticationDatabase admin --db pharmacy --collection customers --file /tmp/json_data/customers.json --jsonArray

echo "5. Đang import bảng invoices (Hóa đơn)..."
sudo docker exec -i pharmacy-mongo mongoimport --username root --password root --authenticationDatabase admin --db pharmacy --collection invoices --file /tmp/json_data/invoices.json --jsonArray

echo "============================================="
echo "HOÀN THÀNH NHẬP DỮ LIỆU THÀNH CÔNG!"
echo "============================================="
```

#### Giải thích chi tiết:
*   `sudo docker cp json_data pharmacy-mongo:/tmp/json_data`: Sao chép thư mục chứa các file JSON dữ liệu mẫu từ máy host vật lý vào thư mục `/tmp` bên trong container MongoDB có tên `pharmacy-mongo`.
*   `sudo docker exec -i pharmacy-mongo mongoimport...`: Chạy lệnh `mongoimport` (thuộc bộ công cụ `mongodb-database-tools`) trực tiếp bên trong container.
*   `--username root --password root --authenticationDatabase admin`: Truyền thông tin xác thực tài khoản quản trị tối cao đã được tạo lúc khởi dựng database.
*   `--db pharmacy --collection employees`: Chỉ định import dữ liệu vào cơ sở dữ liệu `pharmacy`, bảng (collection) tương ứng là `employees`.
*   `--file /tmp/json_data/employees.json --jsonArray`: Đường dẫn tới file chứa dữ liệu nguồn trong container, kèm cờ `--jsonArray` báo hiệu file JSON này chứa một mảng danh sách các bản ghi (documents).

---

## 4. HƯỚNG DẪN TRIỂN KHAI VÀ QUY TRÌNH CHỤP ẢNH MÀN HÌNH (DEPLOYMENT & SCREENSHOTS)

Để triển khai hệ thống thành công và ghi nhận kết quả dưới dạng nhật ký vận hành, vui lòng thực hiện tuần tự các bước dưới đây và tiến hành chụp ảnh minh chứng tại các vị trí đã đánh dấu.

---

### BƯỚC 1: Chuẩn bị môi trường hệ thống
Đảm bảo máy chủ hoặc máy tính cá nhân đã cài đặt sẵn Docker Engine và Docker Compose CLI.

*   Mở terminal (trên Linux/macOS) hoặc PowerShell (trên Windows) chạy hai lệnh kiểm tra:
    ```bash
    docker --version
    docker compose version
    ```
*   **[Vị Trí Đặt Ảnh Chụp Màn Hình 1]**
    *   *Mô tả ảnh yêu cầu:* Capture toàn bộ cửa sổ terminal hiển thị rõ kết quả trả về của hai câu lệnh trên. Thông tin phiên bản Docker (ví dụ: `Docker version 24.x.x` hoặc mới hơn) và Docker Compose (ví dụ: `Docker Compose version v2.x.x`) phải hiển thị rõ ràng, không có thông báo lỗi command not found.

---

### BƯỚC 2: Khởi chạy hệ thống bằng Docker Compose
Tạo file cấu hình môi trường `.env` và kích hoạt toàn bộ các container dịch vụ hoạt động ở chế độ chạy ngầm.

1. Sao chép cấu hình môi trường mẫu:
   ```bash
   cp .env.example .env
   ```
2. Mở file `.env` bằng trình soạn thảo (ví dụ: `nano .env`) và điền các giá trị tag (ví dụ: `FRONTEND_IMAGE_TAG=2.0`, `SPRING_BOOT_IMAGE_TAG=2.0`).
3. Khởi chạy hệ thống trên môi trường phát triển cục bộ bằng cách gộp file compose gốc và file dev:
   ```bash
   sudo docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
   ```
*   **[Vị Trí Đặt Ảnh Chụp Màn Hình 2]**
    *   *Mô tả ảnh yêu cầu:* Capture màn hình terminal đang chạy lệnh khởi tạo trên. Ảnh chụp cần hiển thị quá trình Docker Compose đang tải các layer của các image (`mongo:8`, `dinhsi1401/pharmacy:2.0`,...) từ Docker Hub và hiển thị các bước build (nếu có).
4. Kiểm tra trạng thái hoạt động của các container:
   ```bash
   sudo docker ps
   ```
*   **[Vị Trí Đặt Ảnh Chụp Màn Hình 3]**
    *   *Mô tả ảnh yêu cầu:* Màn hình terminal hiển thị kết quả của lệnh `docker ps`. Bảng kết quả phải hiển thị đủ 3 dòng tương ứng với 3 container: `pharmacy-frontend`, `pharmacy-backend`, và `pharmacy-mongo`. Cột `STATUS` phải ghi nhận trạng thái hoạt động ổn định (`Up ... seconds/minutes`) và hiển thị đúng các cổng ánh xạ tương ứng (ví dụ: `0.0.0.0:8082->80/tcp`, `0.0.0.0:8081->8081/tcp`, `0.0.0.0:27017->27017/tcp`).

---

### BƯỚC 3: Cài đặt Tool và Nhập dữ liệu mẫu vào MongoDB
Thực hiện cài đặt công cụ cần thiết vào container database và chạy script nạp dữ liệu.

1. Truy cập vào container `pharmacy-mongo` dưới quyền root để cài đặt công cụ import:
   ```bash
   sudo docker exec -u 0 -it pharmacy-mongo apt-get update
   sudo docker exec -u 0 -it pharmacy-mongo apt-get install -y mongodb-database-tools
   ```
2. Thực thi script import dữ liệu mẫu từ thư mục gốc của dự án trên máy host:
   ```bash
   bash import_db.sh
   ```
3. Sử dụng công cụ **MongoDB Compass** trên máy tính cá nhân kết nối vào cơ sở dữ liệu theo URI:
   `mongodb://root:root@<IP_Server>:27017/pharmacy?authSource=admin`
*   **[Vị Trí Đặt Ảnh Chụp Màn Hình 4]**
    *   *Mô tả ảnh yêu cầu:* Ảnh chụp giao diện phần mềm MongoDB Compass sau khi kết nối thành công. Cây thư mục bên trái phải hiển thị cơ sở dữ liệu tên `pharmacy` và chứa đủ 4 collections: `employees`, `products`, `customers`, và `invoices` kèm theo số lượng bản ghi đã được import tự động thành công.

---

### BƯỚC 4: Kiểm tra kết nối API Backend
Đảm bảo API Backend của hệ thống kết nối thành công tới MongoDB và sẵn sàng phản hồi chính xác yêu cầu từ client.

*   Mở phần mềm kiểm thử API (như Postman / Insomnia) hoặc gõ trực tiếp lệnh `curl` trong terminal máy khách:
    ```bash
    curl -i http://<IP_Server>:8081/api/products
    ```
*   **[Vị Trí Đặt Ảnh Chụp Màn Hình 5]**
    *   *Mô tả ảnh yêu cầu:* Ảnh chụp cửa sổ Postman hoặc terminal chạy `curl` kiểm thử. Kết quả trả về phải hiển thị HTTP Status Code `200 OK` (hoặc `201 Created`), header phản hồi và phần nội dung (Body) trả về định dạng JSON chứa danh sách thông tin các sản phẩm thuốc mẫu lấy ra từ database.

---

### BƯỚC 5: Kiểm tra giao diện người dùng (Frontend -> Backend)
Xác thực luồng hoạt động khép kín (End-to-End) của ứng dụng từ giao diện người dùng tới database.

1. Mở trình duyệt Web (Chrome, Edge hoặc Firefox) truy cập địa chỉ: `http://<IP_Server>:8082`.
2. Đăng nhập hệ thống với tài khoản nhân viên mẫu:
   *   **Username:** `NV-0001`
   *   **Password:** `Votienkhoa123@`
3. Thực hiện thao tác thêm mới một sản phẩm thuốc vào giỏ hàng hoặc tạo đơn hàng mới.
*   **[Vị Trí Đặt Ảnh Chụp Màn Hình 6]**
    *   *Mô tả ảnh yêu cầu:* Ảnh chụp màn hình trình duyệt hiển thị giao diện chính của hệ thống Pharmacy sau khi đăng nhập thành công. Ảnh cần bắt được khoảnh khắc hệ thống hiển thị thông báo pop-up thông báo thành công (ví dụ: *"Tạo hóa đơn thành công"* hoặc *"Thêm sản phẩm thành công"*) và dữ liệu mới cập nhật hiển thị ngay trên bảng danh sách của giao diện.

---

## 5. KIẾN TRÚC & GIẢI PHÁP NÂNG CAO (SOFTWARE ARCHITECT INSIGHTS)

Phần này phân tích sâu hơn các giải pháp kiến trúc đã được áp dụng trong Pharmacy Project nhằm giải quyết các bài toán vận hành thực tế của các ứng dụng doanh nghiệp.

### A. Sơ đồ Luồng Dữ liệu & Điều phối Mạng Container

Sơ đồ Mermaid dưới đây biểu diễn cách thức các request từ ngoài internet đi vào hệ thống qua Nginx và được định tuyến đến các phân vùng mạng an toàn bên trong Docker Engine:

```mermaid
graph TD
    Client["Trình duyệt Client (Máy ngoài Host)"]
    
    subgraph Docker_Engine ["Docker Host Runtime Engine"]
        subgraph Net_Front ["Mạng ảo cô lập: frontend-net"]
            Nginx["pharmacy-frontend (Nginx Server)<br/>Cổng trong: 80 | Cổng ngoài: 8082/80"]
            Backend["pharmacy-backend (Spring Boot)<br/>Cổng trong: 8081"]
        end
        
        subgraph Net_Back ["Mạng ảo cô lập: backend-net"]
            MongoDB["pharmacy-mongo (MongoDB 8.0)<br/>Cổng trong: 27017"]
        end
        
        Volume[("Named Volume lưu trữ:<br/>mongo-data")]
    end
    
    Client -->|1. HTTP Request - Giao diện| Nginx
    Client -->|2. Gọi API - /api/*| Nginx
    Nginx -->|3. Reverse Proxy - DNS: spring-boot:8081| Backend
    Backend -->|4. Query DB - DNS: mongodb:27017| MongoDB
    MongoDB <-->|5. Đồng bộ đĩa cứng| Volume
```

---

### B. Cơ chế Reverse Proxy & Giải quyết triệt để lỗi CORS

#### Vấn đề CORS (Cross-Origin Resource Sharing):
Nếu Frontend chạy trên một cổng riêng (ví dụ `8082`) và gọi API trực tiếp tới Backend chạy ở cổng khác (`8081`), trình duyệt web của client theo chính sách bảo mật Same-Origin Policy sẽ chặn cuộc gọi này, báo lỗi CORS và làm sập ứng dụng.

#### Giải pháp Reverse Proxy của Nginx:
*   Trong dự án này, toàn bộ request của Client (giao diện tĩnh và request API) đều chỉ gửi đến **một cổng duy nhất** của Frontend container (ví dụ cổng `8082` trong dev hoặc cổng `80` trong production).
*   Khi client gửi request API dạng `/api/products`, máy chủ Nginx bắt được request này nhờ khối lệnh:
    ```nginx
    location /api {
        proxy_pass http://spring-boot:8081;
    }
    ```
*   Nginx tự đóng vai trò "người trung gian", chuyển tiếp request này qua mạng nội bộ Docker tới Backend Spring Boot (`http://spring-boot:8081`) và lấy kết quả trả về cho client.
*   *Kết quả:* Đối với trình duyệt client, toàn bộ ứng dụng (cả giao diện lẫn API) đều có vẻ như chạy chung trên một nguồn gốc (cùng IP, cùng cổng). Vấn đề CORS được giải quyết hoàn toàn ở tầng hạ tầng mạng mà không cần lập trình viên phải viết code cấu hình CORS phức tạp, kém an toàn trong mã nguồn Java Spring Boot.

---

### C. Tối ưu hóa dung lượng đĩa bằng Multi-stage Build

Đóng gói thông thường tạo ra các Docker Image cực kỳ nặng vì chúng phải mang theo tất cả các công cụ phục vụ quá trình build (như NPM package manager, cache node_modules, Maven builder, Java Compiler JDK,...).

Pharmacy Project áp dụng kỹ thuật **Multi-stage Build** trong cả Frontend và Backend để lọc sạch các thành phần thừa:

1.  **Đối với Frontend:**
    *   *Stage 1 (Build):* Node.js tải hàng trăm MB thư viện trong `node_modules` và chạy lệnh build.
    *   *Stage 2 (Run):* Chỉ copy thư mục `/app/dist` (khoảng vài MB chứa HTML/JS đã nén) vào image Nginx. Image cuối cùng xuất bản có dung lượng cực kỳ nhỏ gọn (~30MB), giúp tải nhanh từ registry về server khi triển khai.
2.  **Đối với Backend:**
    *   *Stage 1 (Build):* Maven tải hàng trăm file thư viện `.jar` từ internet để biên dịch mã nguồn Java.
    *   *Stage 2 (Run):* Chỉ sao chép duy nhất file đóng gói `app.jar` vào image chạy JRE (không chứa Maven hay trình biên dịch). Kích thước image giảm hơn 80%, giảm thiểu diện tích bề mặt dễ bị tấn công bảo mật (Attack Surface Area) do không có các công cụ phát triển thừa bên trong container production.

---

### D. Lưu trữ dữ liệu bền vững (Data Persistence) & Quản lý Bảo mật

#### 1. Cơ chế Docker Volume cho MongoDB:
Dữ liệu ghi trong thư mục `/data/db` của container MongoDB theo mặc định sẽ biến mất nếu container bị tắt hoặc xóa.
*   Cấu hình `volumes: - mongo-data:/data/db` chỉ định cho Docker Engine tạo ra một phân vùng ổ đĩa riêng (`mongo-data`) trên máy Host.
*   Bất kỳ thay đổi dữ liệu nào từ MongoDB đều được ghi đồng thời xuống vùng đĩa cứng của máy Host này. Khi container bị sập, khởi động lại, hoặc thậm chí bị xóa đi và tạo mới bằng một image MongoDB phiên bản cao hơn, container mới chỉ cần mount lại volume `mongo-data` cũ để tiếp tục làm việc với đầy đủ dữ liệu nhà thuốc mà không mất mát bất cứ bản ghi nào.

#### 2. Bảo mật thông tin qua biến môi trường (.env):
Không bao giờ được hardcode (viết cứng) thông tin nhạy cảm như tên đăng nhập, mật khẩu database, hay secret key vào mã nguồn hoặc file compose rồi đẩy lên Git repository.
*   Các file cấu hình Docker trong dự án sử dụng cú pháp nội suy biến: `${MONGO_INITDB_ROOT_PASSWORD}`.
*   Khi chạy lệnh `docker compose up`, Docker Engine sẽ tự động đọc file ẩn `.env` cục bộ trên server, lấy giá trị mật khẩu thực tế đưa vào container. Điều này cho phép bảo mật tuyệt đối mã nguồn khi chia sẻ giữa các lập trình viên hoặc đưa lên các kho lưu trữ công khai như GitHub/GitLab.
