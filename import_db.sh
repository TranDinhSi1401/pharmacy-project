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
