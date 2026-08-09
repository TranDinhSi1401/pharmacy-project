## ☸️ PHẦN B: VẬN HÀNH TRÊN CỤM KUBERNETES (K8S)

Tài liệu này chứa hướng dẫn nhanh để quản trị và thao tác dữ liệu trên cụm K8s Lab.

---

### 🚀 Hướng dẫn Đổ Dữ liệu Tự động vào MongoDB (Import Data)

Để đổ dữ liệu mẫu từ các file JSON (nằm trong thư mục `data/`) vào cơ sở dữ liệu MongoDB đang chạy trong cụm K8s, bạn thực hiện theo các bước dưới đây:

#### Bước 1: Sao chép thư mục dự án sang máy ảo Master Node
Bạn thực hiện sao chép toàn bộ thư mục dự án này (chứa file `import-data.sh` và thư mục con `data/`) từ Windows sang máy ảo **Master Node** (ví dụ đặt tại đường dẫn `/home/khoavo/pharmacy-project/`).

#### Bước 2: Chạy Script trên máy ảo Master Node
Mở cửa sổ terminal/SSH kết nối vào máy ảo **`master-node`** và chạy lần lượt các lệnh sau:

1. **Di chuyển vào thư mục dự án trên máy ảo:**
   ```bash
   cd /home/khoavo/'dự án pharmacy'/
   ```
2. **Cấp quyền thực thi cho file script:**
   ```bash
   chmod +x import-data.sh
   ```
3. **Chạy script để tự động đổ dữ liệu:**
   ```bash
   ./import-data.sh
   ```

---

Sau khi import xong, bạn chạy lại lệnh thống kê của chúng ta để kiểm tra xem đã có dữ liệu chưa:

bash
kubectl exec -it mongodb-85c575dc67-nzj6v -- mongosh -u root -p SuperSecretPassword123 --eval "
db.getSiblingDB('pharmacy').getCollectionNames().forEach(function(coll) {
  print(coll + ': ' + db.getSiblingDB('pharmacy').getCollection(coll).countDocuments() + ' bản ghi');
});"
>>>>>>> Stashed changes
