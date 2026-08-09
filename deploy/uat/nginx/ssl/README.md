# Thư mục lưu trữ chứng chỉ SSL cho môi trường Production

Hãy đặt các file chứng chỉ SSL của bạn vào đây với tên file tương ứng:
1. `domain.crt` - File chứng chỉ (Certificate)
2. `domain.key` - File khóa bảo mật (Private Key)

*Lưu ý:* Thư mục này được mount vào Nginx container tại `/etc/nginx/ssl` theo cấu hình trong file `docker-compose.prod.yml`.
