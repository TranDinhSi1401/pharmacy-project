#!/bin/bash

# 1. Tự động tìm tên Pod MongoDB đang chạy trong cụm K8s
POD_NAME=$(kubectl get pods -l app=mongodb -o jsonpath="{.items[0].metadata.name}")

if [ -z "$POD_NAME" ]; then
    echo "❌ Lỗi: Không tìm thấy Pod MongoDB nào đang hoạt động!"
    exit 1
fi

echo "✅ Đã tìm thấy Pod MongoDB: $POD_NAME"

# Xác định đường dẫn thư mục hiện tại của script để định vị thư mục data
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [ ! -d "$SCRIPT_DIR/data" ]; then
    echo "❌ Lỗi: Không tìm thấy thư mục 'data' chứa các file JSON tại: $SCRIPT_DIR/data"
    exit 1
fi

# 2. Sao chép thư mục data vào bên trong Pod
echo "📦 Đang sao chép dữ liệu từ $SCRIPT_DIR/data vào thư mục /tmp/ của Pod..."
kubectl cp "$SCRIPT_DIR/data" "$POD_NAME":/tmp/

# 3. Khai báo danh sách các file cần import
collections=("customers" "employees" "products" "invoices")

# 4. Vòng lặp tự động import từng file vào collection tương ứng
for coll in "${collections[@]}"; do
    echo "--------------------------------------------------"
    echo "🚀 Đang nạp dữ liệu cho bảng: $coll..."
    
    kubectl exec -i "$POD_NAME" -- mongoimport \
      -u root -p SuperSecretPassword123 \
      --authenticationDatabase admin \
      --db pharmacy \
      --collection "$coll" \
      --file "/tmp/data/$coll.json" \
      --jsonArray
done

# 5. Xem thống kê kết quả sau khi hoàn thành
echo "--------------------------------------------------"
echo "🎉 QUÁ TRÌNH HOÀN TẤT! THỐNG KÊ BẢN GHI ĐÃ NẠP:"
kubectl exec -i "$POD_NAME" -- mongosh -u root -p SuperSecretPassword123 --eval "
db.getSiblingDB('pharmacy').getCollectionNames().forEach(function(coll) {
  print(coll + ': ' + db.getSiblingDB('pharmacy').getCollection(coll).countDocuments() + ' bản ghi');
});"
