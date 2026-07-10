# CHƯƠNG 3: CHI TIẾT ĐÓNG GÓI CONTAINER VÀ QUY HOẠCH TRIỂN KHAI ĐA MÔI TRƯỜNG

Để kiểm soát dung lượng lưu trữ, chuẩn hóa quy trình triển khai và nâng cao tính an toàn bảo mật cho hệ thống Pharmacy, mã nguồn của cả hai phân hệ Frontend và Backend đều áp dụng phương pháp Multi-stage Build (Xây dựng đa tầng) trong cấu hình Dockerfile. Phương pháp này hỗ trợ tách biệt môi trường biên dịch mã nguồn (chứa các công cụ phát triển) ra khỏi môi trường vận hành runtime cuối cùng (chỉ chứa các thành phần cốt lõi để chạy ứng dụng).

---

## 3.1. Cấu hình Đóng gói Container (Multi-stage Build)

### 3.1.1. Cấu hình tầng Frontend
Dockerfile của Frontend chịu trách nhiệm chuyển hóa mã nguồn ReactJS + Vite từ dạng mã phát triển thành các tệp tin tĩnh đã được tối ưu, sau đó phân phối chúng qua máy chủ web Nginx phiên bản tối giản.

* **Nội dung file cấu hình:** [apps/frontend/Dockerfile](file:///d:/pharmacy-project_/c%E1%BA%A5u%20tr%C3%BAc%20th%C6%B0%20m%E1%BB%A5c/apps/frontend/Dockerfile)

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

#### Giải thích chi tiết mã lệnh kỹ thuật:
* **`FROM node:20-alpine AS build`**: Khởi tạo giai đoạn một (Stage 1) sử dụng môi trường Node.js phiên bản 20 trên nền hệ điều hành Alpine Linux tối giản nhằm tiết kiệm tài nguyên. Giai đoạn này được đặt bí danh (alias) là `build` nhằm phục vụ việc tham chiếu dữ liệu ở giai đoạn sau.
* **`COPY package*.json ./` và `RUN npm install`**: Sao chép các tệp định nghĩa thư viện phụ thuộc vào container trước khi chép toàn bộ mã nguồn. Quy trình tách biệt này giúp tận dụng cơ chế lưu bộ đệm lớp (layer cache) của Docker. Nếu danh sách thư viện trong `package.json` không thay đổi, Docker sẽ bỏ qua bước tải và cài đặt lại ở các lần build sau, giảm thời gian build hệ thống.
* **`RUN npm run build`**: Tiến hành biên dịch toàn bộ mã nguồn ReactJS (JSX, ES6, CSS) thành các tệp tin tĩnh (gồm HTML, JS, CSS) và lưu trữ tập trung tại thư mục `/app/dist`.
* **`FROM nginx:alpine`**: Khởi động giai đoạn hai (Stage 2) - môi trường chạy thực tế. Tại bước này, Docker sẽ loại bỏ môi trường Node.js cùng toàn bộ mã nguồn gốc ở Stage 1, chỉ giữ lại một image Nginx Alpine dung lượng thấp làm nền tảng vận hành.
* **`COPY nginx.conf /etc/nginx/conf.d/default.conf`**: Ghi đè tệp tin cấu hình mặc định của Nginx bằng file cấu hình tùy chỉnh (`nginx.conf`) của dự án để thiết lập các chính sách định tuyến SPA và cổng kết nối ngược (Reverse Proxy).
* **`COPY --from=build /app/dist /usr/share/nginx/html`**: Lệnh chuyển giao tài nguyên giữa các stage. Docker trích xuất duy nhất thư mục sản phẩm tĩnh `/app/dist` từ giai đoạn build trước đó và sao chép vào thư mục phân phối tệp static công khai của Nginx (`/usr/share/nginx/html`).
* **`EXPOSE 80`**: Khai báo cổng lắng nghe của container là cổng 80 (cổng HTTP tiêu chuẩn).
* **`CMD ["nginx", "-g", "daemon off;"]`**: Chỉ thị khởi chạy Nginx dưới dạng một tiến trình chính ở chế độ foreground. Điều này đảm bảo container sẽ duy trì trạng thái hoạt động liên tục; nếu tiến trình Nginx gặp sự cố dừng lại, container cũng sẽ tự động dừng theo để hệ thống ghi nhận lỗi.

---

### 3.1.2. Cấu hình tầng Backend
Tương tự như phân hệ giao diện, tầng nghiệp vụ Java Spring Boot cũng được đóng gói thông qua cơ chế Multi-stage Build nhằm cô lập quy trình quản lý dependencies của Maven và kiểm soát dung lượng đĩa bằng cách loại bỏ bộ cài đặt JDK ở môi trường chạy cuối cùng.

* **Nội dung file cấu hình:** `apps/backend/Dockerfile`

```dockerfile
# Stage 1: Biên dịch mã nguồn với Maven và JDK
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -B

# Stage 2: Vận hành ứng dụng với JRE tối giản
FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### Giải thích chi tiết mã lệnh kỹ thuật:
* **`FROM maven:3.9-eclipse-temurin-17 AS builder`**: Khởi tạo giai đoạn biên dịch mã nguồn (Stage 1). Image gốc sử dụng công cụ quản lý Maven phiên bản 3.9 tích hợp sẵn bộ phát triển OpenJDK 17 phân phối bởi Eclipse Temurin, đặt tên định danh cho tầng này là `builder`.
* **`RUN mvn dependency:go-offline -B`**: Ra lệnh cho Maven tải trước toàn bộ các tệp tin thư viện cấu thành (`.jar`) được khai báo trong `pom.xml` về kho lưu trữ nội bộ của container. Tham số `-B` (Batch-mode) được kích hoạt để tắt bớt các dòng nhật ký (logs) tải file không cần thiết, giúp tiến trình build gọn gàng hơn.
* **`RUN mvn package -DskipTests -B`**: Thực hiện biên dịch toàn bộ các lớp mã nguồn Java và đóng gói chúng thành một tệp tin thực thi duy nhất dạng `.jar` nằm trong thư mục `target/`. Cờ `-DskipTests` được truyền vào nhằm bỏ qua việc chạy các kịch bản kiểm thử (unit tests) trong lúc đóng gói, hỗ trợ rút ngắn thời gian build.
* **`FROM eclipse-temurin:17-jre`**: Khởi tạo giai đoạn runtime (Stage 2). Bằng việc chuyển sang cấu hình Java Runtime Environment (JRE) thuần túy và loại bỏ bộ công cụ biên dịch JDK cùng Maven của Stage 1, hệ thống tiết kiệm dung lượng lưu trữ, đồng thời hạn chế diện tích bề mặt tấn công về mặt bảo mật.
* **`COPY --from=builder /build/target/*.jar app.jar`**: Thực hiện sao chép tệp tin thực thi sau cùng. Docker trích xuất duy nhất tệp tin `.jar` đã build thành công từ giai đoạn `builder` sang giai đoạn runtime mới và đổi tên thành `app.jar`.
* **`EXPOSE 8081`**: Khai báo cổng dịch vụ nội bộ của ứng dụng Spring Boot là 8081.
* **`ENTRYPOINT ["java", "-jar", "app.jar"]`**: Cấu hình lệnh cố định không thể bị ghi đè khi container khởi động. Lệnh này kích hoạt máy ảo Java thực thi gói ứng dụng `app.jar` để đưa các dịch vụ nghiệp vụ của nhà thuốc vào trạng thái sẵn sàng phục vụ.

---

## 3.2. Quy hoạch Cấu trúc Host Machine và Cấu hình Nginx theo Môi trường

Để hạn chế sự lặp lại cấu hình và kiểm soát tài nguyên phần cứng, hệ thống quy hoạch chi tiết sơ đồ thư mục trên máy chủ vật lý/máy ảo (Host Machine), đồng thời tùy biến file cấu hình máy chủ Nginx kết hợp với tệp tin ghi đè docker-compose riêng biệt cho từng môi trường vận hành cụ thể.

---

### 3.2.1. Môi trường Phát triển Cục bộ (DEV - Local Machine)
Môi trường DEV tập trung vào sự linh hoạt, hỗ trợ nhà phát triển dễ dàng theo dõi luồng dữ liệu và thực hiện kiểm thử nhanh.

#### Sơ đồ thư mục trên máy Host (DEV)
Tại máy cục bộ, cấu trúc thư mục và các tệp cấu hình được quy hoạch như sau:

```
pharmacy-project/ (Root Workspace)
├── .gitignore                      # Định nghĩa các file và thư mục bị bỏ qua bởi Git
├── README.md                       # Tài liệu hướng dẫn dự án tổng quát
├── apps/                           # Chứa mã nguồn của các phân hệ chính
│   ├── backend/                    # Thư mục mã nguồn Backend (Spring Boot)
│   └── frontend/                   # Thư mục mã nguồn Frontend (ReactJS / Vite)
│       ├── public/                 # Các tài nguyên static của frontend (favicon, icons, etc.)
│       ├── src/                    # Mã nguồn giao diện chính (App.jsx, main.jsx, pages, api, assets)
│       ├── Dockerfile              # Chỉ dẫn đóng gói Frontend
│       ├── nginx.conf              # File cấu hình Nginx nội bộ cho Frontend
│       └── package.json            # Quản lý thư viện phụ thuộc Frontend
└── deploy/                         # Chứa toàn bộ cấu hình phục vụ việc triển khai
    ├── .env.example                # Khai báo các biến môi trường mẫu chung
    ├── docker-compose.yml          # File cấu hình Docker Compose gốc (Khung xương dịch vụ)
    └── dev/                        # Thư mục cấu hình cho môi trường DEV
        ├── .env.dev                # Khai báo biến môi trường thực tế chạy DEV cục bộ
        ├── docker-compose.dev.yml  # Docker Compose override cho DEV (mount volume, mở ports)
        └── data/                   # Dữ liệu mẫu dùng cho DEV
            ├── import_db.sh        # Script import cơ sở dữ liệu mẫu nhanh vào container
            └── json_data/          # Dữ liệu JSON mẫu (employees, products, customers, invoices)
                ├── customers.json
                ├── employees.json
                ├── invoices.json
                └── products.json
```

#### Cấu cấu hình Nginx trong Frontend (`apps/frontend/nginx.conf`)
Cấu hình này xử lý định tuyến Single Page Application (SPA) và chuyển tiếp các yêu cầu API về container Backend:

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

##### Giải thích chi tiết các khối cấu hình:
1. **Cấu hình chung của Server block**:
   * **`listen 80;`**: Chỉ định Nginx lắng nghe các yêu cầu (requests) HTTP gửi đến qua cổng tiêu chuẩn 80.
   * **`server_name localhost;`**: Xác định tên miền mà block server này sẽ áp dụng (ở đây là máy cục bộ hiện tại).
2. **Khối định tuyến Frontend (`location /`)**:
   * **`root /usr/share/nginx/html;`**: Định nghĩa thư mục gốc chứa các file tĩnh (HTML, CSS, JS) sau khi build của ứng dụng ReactJS trong container Nginx.
   * **`index index.html;`**: Chỉ định file mặc định sẽ được trả về đầu tiên khi người dùng truy cập.
   * **`try_files $uri $uri/ /index.html;`**: Cấu hình hỗ trợ các ứng dụng Single Page Application (SPA) sử dụng React Router. Nginx sẽ lần lượt tìm kiếm file vật lý tương ứng với đường dẫn (`$uri`) hoặc thư mục tương ứng (`$uri/`). Nếu không tìm thấy (như khi reload một URL ảo do React Router quản lý như `/dashboard`), Nginx điều hướng request về `/index.html` để Client-side Router tiếp quản và hiển thị component tương ứng.
3. **Khối định tuyến API Backend (`location /api`)**:
   * **`proxy_pass http://spring-boot:8081;`**: Đóng vai trò Reverse Proxy, chuyển tiếp các request có dạng `/api/...` sang container chứa ứng dụng backend Spring Boot đang chạy ở cổng 8081 thông qua mạng nội bộ Docker.
   * **`proxy_set_header Host $host;`**: Giữ nguyên thông tin domain/host gốc của request khi gửi đến Spring Boot.
   * **`proxy_set_header X-Real-IP $remote_addr;`** và **`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`**: Truyền địa chỉ IP thực tế của client về cho backend, hỗ trợ Spring Boot nhận biết chính xác nguồn gốc request để xử lý logic bảo mật hoặc ghi log.
   * **`proxy_set_header X-Forwarded-Proto $scheme;`**: Truyền giao thức kết nối gốc (HTTP hoặc HTTPS) để backend hiểu đúng định dạng request.
4. **Khối Cache cấu hình tĩnh**:
   * **`location ~* \.(?:css|js|...)$`**: Định nghĩa bộ nhớ đệm (Cache) cho các tệp tĩnh như CSS, JS, hình ảnh để tối ưu tài nguyên mạng và tăng tốc độ phản hồi cho trình duyệt. Thời gian lưu cache được đặt là 1 tháng (`expires 1M`) và tắt việc ghi nhật ký truy cập (`access_log off`).

#### Cấu hình ghi đè trong `deploy/dev/docker-compose.dev.yml`
```yaml
services:
    # Service frontend sử dụng ReactJs  
    frontend:
        ports:
            - "8082:80"
        restart: unless-stopped
        depends_on:
            - spring-boot
        networks:
            - frontend-net
    
    # Service backend sử dụng Spring Boot    
    spring-boot:
        environment:
            MONGODB_URI: ${MONGODB_URI}
            MONGODB_DATABASE: ${MONGODB_DATABASE}
            SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE}
        # Cho phép kết nối ra ngoài để dùng Postman 
        ports:
            - "8081:8081"
        restart: unless-stopped
        depends_on:
            mongodb:
                condition: service_healthy
        networks:
            - frontend-net
            - backend-net
            
    # Service mongodb 
    mongodb:
        environment:
            MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
            MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD}
            MONGO_INITDB_DATABASE: ${MONGO_INITDB_DATABASE}
        # Cho phép kết nối ra ngoài để dùng công cụ như Mongo Compass
        ports:
            - "27017:27017"
        restart: unless-stopped
        volumes: 
            - mongo_data_dev:/data/db
        healthcheck:
            test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
            interval: 10s
            timeout: 5s
            retries: 5
        networks:
            - backend-net

volumes:
    mongo_data_dev:
    
networks:
    frontend-net:
    backend-net:
```

##### Giải thích chi tiết các dịch vụ:
* **Dịch vụ Frontend**: Ánh xạ cổng 8082 trên máy Host vào cổng 80 của container. Người phát triển có thể truy cập giao diện thông qua địa chỉ `http://localhost:8082`. Thuộc tính `restart: unless-stopped` giúp tự động khởi chạy lại container trong trường hợp có lỗi xảy ra.
* **Dịch vụ Backend (Spring Boot)**: Ánh xạ cổng 8081 để hỗ trợ nhà phát triển kiểm thử độc lập các API qua các công cụ như Postman hoặc tiến hành debug trực tiếp mã nguồn backend từ IDE. Thiết lập `SPRING_PROFILES_ACTIVE=dev` nạp file cấu hình dành riêng cho môi trường phát triển (như bật log chi tiết, tắt bớt ràng buộc bảo mật nghiêm ngặt).
* **Dịch vụ Cơ sở dữ liệu (MongoDB)**: Ánh xạ cổng mặc định 27017, cho phép nhà phát triển sử dụng các công cụ quản lý trực quan (như MongoDB Compass, Studio 3T) để kết nối trực tiếp vào cơ sở dữ liệu bên trong container từ máy Host.
* **Cơ chế cô lập mạng (Networks Isolation)**: Bằng cách sử dụng hai mạng riêng biệt `frontend-net` (giữa Frontend và Backend) và `backend-net` (giữa Backend và MongoDB), container Database hoàn toàn được bảo vệ khỏi sự tiếp cận trực tiếp từ phân hệ Frontend, nâng cao tính bảo mật nội bộ.
* **Ràng buộc phụ thuộc (`depends_on` với `condition: service_healthy`)**: Spring Boot chỉ khởi chạy sau khi container MongoDB hoàn tất quá trình khởi tạo và phản hồi trạng thái khỏe mạnh (`healthy`) thông qua lệnh ping thử nghiệm `mongosh`.

#### Script nhập dữ liệu mẫu DEV (`deploy/dev/data/import_db.sh`)
Script này giúp tự động hóa quá trình khởi tạo cấu trúc dữ liệu cho cơ sở dữ liệu MongoDB trong môi trường phát triển:

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

##### Giải thích chi tiết kịch bản:
* **Sao chép dữ liệu**: Sử dụng lệnh `docker cp` sao chép các tệp tin chứa dữ liệu mẫu dạng JSON từ máy host vào thư mục tạm `/tmp` của container cơ sở dữ liệu `pharmacy-mongo`.
* **Nạp cơ sở dữ liệu**: Lệnh `mongoimport` với tài khoản quản trị `root` sẽ phân tích các tệp tin JSON và đưa dữ liệu trực tiếp vào 4 collections chính là: `employees` (Nhân viên), `products` (Sản phẩm), `customers` (Khách hàng) và `invoices` (Hóa đơn) của database `pharmacy`.

##### Đánh giá ưu điểm cấu hình DEV:
* **Đóng gói và cô lập**: Giúp đóng gói các cấu hình phụ thuộc (phiên bản Node, Java SDK, cơ sở dữ liệu) vào trong các container riêng biệt, giảm thiểu xung đột môi trường trên các máy cá nhân của đội ngũ phát triển.
* **Hỗ trợ Debug**: Việc mở (expose) các cổng (8082, 8081, 27017) ra ngoài máy Host giúp tăng tốc độ kiểm thử và sửa lỗi trong quá trình xây dựng hệ thống.

---

### 3.2.2. Môi trường Kiểm thử Tích hợp (UAT - Staging VPS)
Môi trường UAT giả lập cấu trúc deploy thực tế bằng image đóng gói sẵn, sử dụng mạng phủ Overlay và chế độ Docker Swarm để nâng cao độ ổn định.

#### Sơ đồ thư mục trên máy Host (UAT)
Hệ thống không chạy bằng code live trực tiếp mà tải image từ Registry. Toàn bộ tài nguyên được tổ chức trong thư mục `/deploy/uat/`:

```
/deploy/uat/
├── docker-compose.uat.yml          # File Docker Compose cấu hình cho UAT (Swarm Mode)
├── nginx/
│   └── nginx.conf                  # File cấu hình Nginx phục vụ môi trường UAT
└── data/                           # Thư mục chứa tài nguyên khởi tạo CSDL
    ├── import_db.sh                # Script import cơ sở dữ liệu mẫu nhanh cho UAT
    └── json_data/                  # Dữ liệu JSON mẫu phục vụ UAT
        ├── customers.json
        ├── employees.json
        ├── invoices.json
        └── products.json
```

#### Cấu hình Nginx UAT (`deploy/uat/nginx/nginx.conf`)
File cấu hình Nginx phục vụ môi trường UAT tương tự như Frontend nhằm phân phối tệp tĩnh và proxy ngược yêu cầu đến Spring Boot:

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

#### Cấu hình ghi đè trong `deploy/uat/docker-compose.uat.yml`
```yaml
services:
    frontend:
        ports:
            - "80:80"
        configs:
            - source: nginx_config
              target: /etc/nginx/conf.d/default.conf
        logging:
            driver: "json-file"
            options:
                max-size: "10m"
                max-file: "3"
        deploy:
            restart_policy:
                condition: on-failure
            replicas: 3
            resources:
                limits:
                    cpus: "0.5"
                    memory: 256M
                reservations:
                    cpus: "0.25"
                    memory: 128M
            update_config:
                parallelism: 1
                delay: 10s
                order: start-first
        networks:
            - pharmacy-net
        healthcheck:
            test: ["CMD", "wget", "-q", "--spider", "http://localhost/"]
            interval: 10s
            timeout: 5s
            retries: 3
            start_period: 10s

    spring-boot:
        environment:
            MONGODB_DATABASE: ${MONGODB_DATABASE}
            SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE}
        secrets:
            - mongo_uri
            - jwt
        logging:
            driver: "json-file"
            options:
                max-size: "10m"
                max-file: "3"
        deploy:
            restart_policy:
                condition: on-failure
            replicas: 3
            resources:
                limits:
                    cpus: "1.0"
                    memory: 768M
                reservations:
                    cpus: "0.5"
                    memory: 384M
            update_config:
                parallelism: 1
                delay: 10s
                order: start-first
        networks:
            - pharmacy-net
        healthcheck:
            test: ["CMD", "curl", "-f", "http://localhost:8081/api/actuator/health"]
            interval: 10s
            timeout: 5s
            retries: 3
            start_period: 40s

    mongodb:
        environment:
            MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
            MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/db_password
            MONGO_INITDB_DATABASE: ${MONGO_INITDB_DATABASE}
        secrets:
            - db_password
        logging:
            driver: "json-file"
            options:
                max-size: "10m"
                max-file: "3"
        deploy:
            restart_policy:
                condition: on-failure
            replicas: 1
            resources:
                limits:
                    cpus: "2.0"
                    memory: 1G
                reservations:
                    cpus: '1.0'
                    memory: 0.5G
                placement:
                    constraints:
                        - node.role == manager
        networks:
            - pharmacy-net
        volumes:
            - mongo_data_prod:/data/db
        healthcheck:
            test: ["CMD-SHELL", "echo 'db.runCommand(\"ping\").ok' | mongosh localhost:27017/test --quiet"]
            interval: 10s
            timeout: 5s
            retries: 5
            start_period: 20s

networks:
    pharmacy-net:
        driver: overlay 
        
volumes:
    mongo_data_prod:
        driver: local
    
configs:
    nginx_config:
        file: ./nginx/nginx.conf
    
secrets:
    db_password:
        file: ./secrets/db_password.txt
    jwt:
        file: ./secrets/jwt.txt
    mongo_uri:
        file: ./secrets/mongo_uri.txt
```

##### Giải thích chi tiết cấu hình và cơ chế vận hành:
* **Docker Swarm Mode & Mạng Overlay**: Môi trường UAT sử dụng mạng phủ `pharmacy-net` với driver `overlay` để kết nối các container trên các node khác nhau trong Swarm cluster, tăng khả năng mở rộng hệ thống.
* **Số lượng bản sao (Replicas)**: Thiết lập `replicas: 3` cho Frontend và Spring Boot nhằm đảm bảo tính sẵn sàng cao (High Availability). Trình cân bằng tải tích hợp của Docker Swarm sẽ tự động phân phối các yêu cầu đến các replica đang hoạt động.
* **Giới hạn tài nguyên (Resource Limits)**:
  * `frontend`: Giới hạn tối đa 0.5 CPU và 256MB RAM.
  * `spring-boot`: Giới hạn tối đa 1.0 CPU và 768MB RAM.
  * `mongodb`: Giới hạn tối đa 2.0 CPU và 1GB RAM.
* **Docker Configs & Docker Secrets**:
  * **`configs`**: Mount tệp cấu hình Nginx tùy chỉnh (`./nginx/nginx.conf`) vào container frontend tại đường dẫn `/etc/nginx/conf.d/default.conf` thông qua cấu hình `nginx_config` mà không cần xây dựng lại image.
  * **`secrets`**: Cung cấp mật khẩu cơ sở dữ liệu (`db_password`), chuỗi kết nối (`mongo_uri`), và khóa JWT (`jwt`) cho container một cách bảo mật. Giá trị của các secret được giải mã trực tiếp trong bộ nhớ RAM (`/run/secrets/`) và chỉ các service được khai báo mới có quyền truy cập.
* **Chiến lược cập nhật (Rolling Update)**:
  * Cấu hình `update_config` chỉ định quá trình nâng cấp ứng dụng sẽ diễn ra lần lượt từng container một (`parallelism: 1`), cách nhau 10 giây (`delay: 10s`), đồng thời khởi động container mới trước khi tắt container cũ (`order: start-first`), giúp hệ thống hoạt động liên tục không bị gián đoạn (Zero Downtime).
* **Kiểm tra trạng thái (Healthcheck)**:
  * Kiểm tra trạng thái của Frontend thông qua yêu cầu tải thử file tĩnh (`wget`).
  * Kiểm tra trạng thái của Spring Boot thông qua endpoint `/api/actuator/health`.
  * Kiểm tra trạng thái của MongoDB thông qua lệnh ping nội bộ `mongosh`.

##### Đánh giá ưu điểm cấu hình UAT:
* **Tăng cường bảo mật**: Việc sử dụng Docker Secrets giúp loại bỏ việc lưu trữ mật khẩu hay thông tin nhạy cảm ở dạng plain-text trong tệp cấu hình hoặc mã nguồn.
* **Kiểm thử sát thực tế**: Cấu hình này buộc toàn bộ hệ thống phải vận hành dưới dạng một cụm dịch vụ phân tán, giúp phát hiện sớm các lỗi về định tuyến API, tính đồng bộ và chịu tải trước khi đưa sản phẩm lên môi trường Production.

---

### 3.2.3. Môi trường Vận hành Chính thức (PRODUCTION - Live Server)
Môi trường vận hành chính thức đặt tiêu chí an toàn bảo mật dữ liệu, khả năng dự phòng lỗi cao, và quản lý tài nguyên nghiêm ngặt lên hàng đầu.

#### Sơ đồ thư mục trên máy Host (PRODUCTION)
Dữ liệu của cơ sở dữ liệu được tách biệt và lưu trữ bền vững trên ổ đĩa SSD được mã hóa chuyên dụng. Cấu trúc thư mục `/deploy/prod/` trên live server:

```
/deploy/prod/
├── docker-compose.prod.yml         # File Docker Compose cấu hình cho Production (Swarm Mode)
├── nginx/
│   └── nginx.conf                  # File cấu hình Nginx phục vụ môi trường Production
└── data/                           # Thư mục chứa dữ liệu khởi tạo ban đầu
    ├── import_db.sh                # Script import cơ sở dữ liệu mẫu nhanh cho Production
    └── json_data/                  # Dữ liệu JSON mẫu
        ├── customers.json
        ├── employees.json
        ├── invoices.json
        └── products.json
```

#### Cấu hình Nginx Production (`deploy/prod/nginx/nginx.conf`)
Cấu hình máy chủ Nginx trên Production hoạt động tương tự như các môi trường khác, xử lý định tuyến ứng dụng và phân chia luồng request API:

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

#### Cấu hình ghi đè trong `deploy/prod/docker-compose.prod.yml`
```yaml
services:
    frontend:
        ports:
            - "80:80"
        configs:
            - source: nginx_config
              target: /etc/nginx/conf.d/default.conf
        logging:
            driver: "json-file"
            options:
                max-size: "10m"
                max-file: "3"
        deploy:
            restart_policy:
                condition: on-failure
            replicas: 3
            resources:
                limits:
                    cpus: "0.5"
                    memory: 256M
                reservations:
                    cpus: "0.25"
                    memory: 128M
            update_config:
                parallelism: 1
                delay: 10s
                order: start-first
        networks:
            - pharmacy-net
        healthcheck:
            test: ["CMD", "wget", "-q", "--spider", "http://localhost/"]
            interval: 10s
            timeout: 5s
            retries: 3
            start_period: 10s

    spring-boot:
        environment:
            MONGODB_DATABASE: ${MONGODB_DATABASE}
            SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE}
        secrets:
            - mongo_uri
            - jwt
        logging:
            driver: "json-file"
            options:
                max-size: "10m"
                max-file: "3"
        deploy:
            restart_policy:
                condition: on-failure
            replicas: 3
            resources:
                limits:
                    cpus: "1.0"
                    memory: 768M
                reservations:
                    cpus: "0.5"
                    memory: 384M
            update_config:
                parallelism: 1
                delay: 10s
                order: start-first
        networks:
            - pharmacy-net
        healthcheck:
            test: ["CMD", "curl", "-f", "http://localhost:8081/api/actuator/health"]
            interval: 10s
            timeout: 5s
            retries: 3
            start_period: 40s

    mongodb:
        environment:
            MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
            MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/db_password
            MONGO_INITDB_DATABASE: ${MONGO_INITDB_DATABASE}
        secrets:
            - db_password
        logging:
            driver: "json-file"
            options:
                max-size: "10m"
                max-file: "3"
        deploy:
            restart_policy:
                condition: on-failure
            replicas: 1
            resources:
                limits:
                    cpus: "2.0"
                    memory: 1G
                reservations:
                    cpus: '1.0'
                    memory: 0.5G
                placement:
                    constraints:
                        - node.role == manager
        networks:
            - pharmacy-net
        volumes:
            - mongo_data_prod:/data/db
        healthcheck:
            test: ["CMD-SHELL", "echo 'db.runCommand(\"ping\").ok' | mongosh localhost:27017/test --quiet"]
            interval: 10s
            timeout: 5s
            retries: 5
            start_period: 20s

networks:
    pharmacy-net:
        driver: overlay 
        
volumes:
    mongo_data_prod:
        driver: local
    
configs:
    nginx_config:
        file: ./nginx/nginx.conf
    
secrets:
    db_password:
        file: ./secrets/db_password.txt
    jwt:
        file: ./secrets/jwt.txt
    mongo_uri:
        file: ./secrets/mongo_uri.txt
```

##### Giải thích các điểm cấu hình dịch vụ tối ưu trên Production:
1. **Lưu trữ dữ liệu bền vững (Data Persistence)**:
   * MongoDB được cấu hình phân vùng đĩa cứng bền vững thông qua volume `mongo_data_prod` có driver là `local`. Dữ liệu nghiệp vụ bán hàng thực tế sẽ được bảo vệ tuyệt đối ngay cả khi container cơ sở dữ liệu bị xoá hoặc cập nhật lại phiên bản image.
2. **Cơ chế xoay vòng nhật ký (Log Rotation)**:
   * Cấu hình `logging` giới hạn kích thước tệp log tối đa là 10 Megabytes (`max-size: "10m"`) và chỉ lưu giữ 3 tệp tin log xoay vòng gần nhất (`max-file: "3"`). Thiết lập này ngăn chặn triệt để nguy cơ tệp tin log phát triển vô hạn gây tràn dung lượng ổ đĩa SSD của VPS Production.
3. **Giới hạn cứng tài nguyên hệ thống (Resource Limits)**:
   * **Frontend**: Giới hạn tối đa 50% CPU và 256MB RAM để tối ưu hóa chi phí.
   * **Backend**: Giới hạn tối đa 1.5 core CPU và khống chế cứng RAM ở mức 768MB nhằm kiểm soát hoạt động của JVM (Java Virtual Machine), chủ động hạn chế hiện tượng rò rỉ bộ nhớ (Memory Leak) gây ảnh hưởng đến hệ điều hành của máy chủ.
   * **Database**: Giới hạn tối đa 2.0 CPU và 1GB RAM để MongoDB thực thi các tác vụ lập chỉ mục và truy vấn nhanh chóng mà không lấn chiếm tài nguyên của các dịch vụ khác.

##### Đánh giá ưu điểm của cấu hình Production:
* **Tối ưu hóa chi phí hạ tầng Cloud**: Bằng việc thiết lập các hạn mức tài nguyên chi tiết cho từng container, hệ thống có thể vận hành ổn định trên các gói cấu hình VPS tầm trung mà không sợ lỗi lặp vô hạn hay rò rỉ bộ nhớ gây sập máy chủ.
* **Bảo mật đa tầng (Defense in Depth)**: Sự kết hợp giữa Docker Secrets để giấu mật khẩu, cơ chế cô lập mạng thông qua các subnet nội bộ, và bảo vệ dữ liệu bằng phân vùng SSD chuyên dụng giúp nâng cao đáng kể khả năng an toàn thông tin của chuỗi nhà thuốc.
