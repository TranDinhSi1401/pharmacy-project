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
