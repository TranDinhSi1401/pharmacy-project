# Hướng dẫn Triển khai Cụm Kubernetes (K8s) với Mạng NAT & Host-Only + Ingress Nginx trên VirtualBox

Tài liệu này hướng dẫn chi tiết từ A-Z cách cài đặt và cấu hình cụm Kubernetes gồm **3 node** (1 Master Node, 2 Worker Nodes) chạy trên hệ điều hành **Ubuntu Server 22.04 LTS** sử dụng mô hình mạng **NAT + Host-Only** trên Oracle VM VirtualBox và tích hợp sẵn **Ingress Nginx Controller** làm cổng tiếp nhận duy nhất cho toàn bộ hệ thống.

Tài liệu này được thiết kế đặc biệt cho người mới bắt đầu, trên một máy tính hoàn toàn mới và 3 máy ảo mới khởi tạo trống trơn.

---

## 📌 Tại sao sử dụng mạng NAT + Host-Only & Ingress Nginx?

Khi chạy cụm Kubernetes trên máy tính cá nhân (Laptop/PC) để học tập hoặc phát triển:
1. Mạng **Bridge (Cầu nối)** rất dễ bị lỗi khi bạn di chuyển sang mạng Wi-Fi khác (ví dụ: từ nhà ra quán cafe), do IP của các máy ảo bị thay đổi. Cấu hình NAT + Host-Only giải quyết triệt để vấn đề này bằng cách cố định dải mạng nội bộ `192.168.56.x` cho cụm.
2. Việc sử dụng **Ingress Nginx** giúp bạn quản lý cổng vào của cụm K8s chuyên nghiệp như một hệ thống thực tế. Thay vì truy cập từng dịch vụ bằng các NodePort riêng lẻ khác nhau, mọi request sẽ đi qua Ingress và được định tuyến thông minh qua một **Tên miền ảo** (ví dụ: `http://pharmacy.local:30080`).

---

## 🛠️ PHẦN CHUẨN BỊ: THIẾT LẬP MẠNG & HỆ ĐIỀU HÀNH (VIRTUALBOX)

Trước khi cấu hình Kubernetes, bạn cần thực hiện thiết lập hạ tầng máy ảo và dải mạng Host-Only trên phần mềm Oracle VM VirtualBox theo các bước chi tiết sau:

### 1. Chuẩn bị trên máy tính Windows (Host)
Trước khi tạo máy ảo, bạn cần cài đặt VirtualBox và kiểm tra dải IP Host-Only mặc định:
1. Tải và cài đặt phần mềm **Oracle VM VirtualBox**.
2. Mở **PowerShell** hoặc Command Prompt trên Windows, gõ lệnh:
   ```cmd
   ipconfig
   ```
3. Tìm card mạng ảo có tên `VirtualBox Host-Only Network` (hoặc Ethernet adapter Ethernet 2).

![Kiểm tra card mạng ảo VirtualBox trên Windows](images/ipconfig_windows.png)

4. Ghi lại địa chỉ IPv4 hiển thị (Thường mặc định là `192.168.56.1`). Dải mạng nội bộ tĩnh của cụm máy ảo sẽ là `192.168.56.0/24`.

> [!IMPORTANT]
> **MÔ HÌNH PHÂN BỔ HOSTNAME VÀ IP TĨNH:**
> * **Master Node:** Hostname là `master-node` - IP Host-Only: `192.168.56.10`
> * **Worker Node 1:** Hostname là `worker-node-1` - IP Host-Only: `192.168.56.11`
> * **Worker Node 2:** Hostname là `worker-node-2` - IP Host-Only: `192.168.56.12`

---

### 2. Tạo máy ảo và cấu hình mạng trên VirtualBox
Hãy tiến hành tạo 3 máy ảo Ubuntu Server 22.04 LTS trên VirtualBox. Trước khi nhấn Start để khởi động máy ảo cài đặt hệ điều hành, bạn cần cấu hình card mạng cho từng máy ảo như sau để vừa có Internet vừa có IP tĩnh cố định:

1. Tại giao diện VirtualBox, chọn máy ảo -> Click **Settings** (Cấu hình) -> Chọn mục **Network** (Mạng).
2. Tại tab **Adapter 1** (Card 1):
   * Tích chọn **Enable Network Adapter**.
   * Attached to (Kết nối với): Chọn **NAT** (nhận IP động từ VirtualBox để máy ảo đi ra Internet tải thư viện, cài phần mềm).

![Cấu hình Card 1 ở chế độ mạng NAT](images/virtualbox_nat.png)

3. Tại tab **Adapter 2** (Card 2):
   * Tích chọn **Enable Network Adapter**.
   * Attached to (Kết nối với): Chọn **Host-Only Adapter** (Cạc mạng chỉ dành cho máy chủ - để gán IP tĩnh nội bộ kết nối giữa Windows Host và các máy ảo).
   * Name (Tên): Chọn **VirtualBox Host-Only Ethernet Adapter** (card tương ứng với dải `192.168.56.1` đã ghi nhận ở bước trên).

![Cấu hình Card 2 ở chế độ mạng Host-Only](images/virtualbox_hostonly.png)

4. Nhấn **OK**. Tiến hành bật máy ảo và cài đặt hệ điều hành Ubuntu Server 22.04 LTS bình thường.

---

### 3. Cấu hình IP tĩnh vĩnh viễn trên Ubuntu Server (Netplan)
Sau khi cài đặt xong hệ điều hành, đăng nhập vào giao diện dòng lệnh (console) của từng máy ảo để thiết lập IP tĩnh vĩnh viễn.

#### Bước 3.1: Xác định tên các card mạng trên máy ảo
Chạy lệnh sau trên terminal của máy ảo:
```bash
ip a
```
Hệ thống sẽ liệt kê các card mạng (bỏ qua card `lo` mặc định). Thông thường trên VirtualBox:
* Card 1 (NAT) sẽ có tên là `enp0s3` (đã có sẵn IP động).
* Card 2 (Host-Only) sẽ có tên là `enp0s8` (đang ở trạng thái DOWN hoặc chưa có IP).

![Xác định tên card mạng enp0s3 và enp0s8](images/ip_a_ubuntu.png)

#### Bước 3.2: Vô hiệu hóa cấu hình tự động của hệ thống
Tránh việc hệ thống tự động ghi đè file cấu hình mạng cũ làm mất IP tĩnh sau khi khởi động lại:
```bash
sudo mv /etc/netplan/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml.bak
```

#### Bước 3.3: Soạn thảo cấu hình Netplan mới
Mở file cấu hình Netplan bằng trình soạn thảo `nano`:
```bash
sudo nano /etc/netplan/50-installer-config.yaml
```
Xóa sạch nội dung cũ trong file (nếu có) và dán nội dung cấu hình tương ứng bên dưới vào:

### 📄 Cấu hình `/etc/netplan/50-installer-config.yaml`

#### 1. Trên máy Master Node (`master-node`):

![Cấu hình Netplan cho Master Node](images/netplan_master.png)

```yaml
network:
  version: 2
  ethernets:
    enp0s3:
      dhcp4: true
    enp0s8:
      dhcp4: no
      addresses:
        - 192.168.56.10/24
```

#### 2. Trên máy Worker Node 1 (`worker-node-1`):

![Cấu hình Netplan cho Worker Node 1](images/netplan_worker1.png)

```yaml
network:
  version: 2
  ethernets:
    enp0s3:
      dhcp4: true
    enp0s8:
      dhcp4: no
      addresses:
        - 192.168.56.11/24
```

#### 3. Trên máy Worker Node 2 (`worker-node-2`):

![Cấu hình Netplan cho Worker Node 2](images/netplan_worker2.png)

```yaml
network:
  version: 2
  ethernets:
    enp0s3:
      dhcp4: true
    enp0s8:
      dhcp4: no
      addresses:
        - 192.168.56.12/24
```

#### Bước 3.4: Áp dụng cấu hình và Kiểm tra kết nối
1. Phân quyền bảo mật và áp dụng cấu hình Netplan mới:

![Chạy lệnh áp dụng cấu hình Netplan](images/netplan_apply.png)

```bash
sudo chmod 600 /etc/netplan/50-installer-config.yaml
sudo netplan apply
```

2. Kiểm tra IP đã nhận chính xác trên card `enp0s8` chưa:
```bash
ip a show enp0s8
```
*(Kết quả đúng: Card enp0s8 hiển thị chính xác IP tĩnh Host-Only tương ứng đã thiết lập).*

3. Kiểm tra kết nối Internet qua card NAT `enp0s3` để đảm bảo máy ảo vẫn tải được thư viện:
```bash
ping -c 3 google.com
```

![Kiểm tra internet thành công trên máy ảo](images/ping_google.png)
*(Kết quả đúng: Nhận được phản hồi từ Google với 0% packet loss).*

---

## 🛠️ PHẦN 1: CHUẨN BỊ HẠ TẦNG (Chạy trên CẢ 3 MÁY ẢO)

Bạn cần mở 3 cửa sổ Terminal (hoặc SSH) kết nối tương ứng vào 3 máy ảo và thực hiện lần lượt các bước sau:

### Bước 1.1: Đặt tên Hostname chuẩn và đồng bộ file `/etc/hosts`
Đăng nhập vào từng máy và chạy lệnh đổi tên máy:

* **Trên máy Master:**
  ```bash
  sudo hostnamectl set-hostname master-node
  exec bash
  ```
* **Trên máy Worker 1:**
  ```bash
  sudo hostnamectl set-hostname worker-node-1
  exec bash
  ```
* **Trên máy Worker 2:**
  ```bash
  sudo hostnamectl set-hostname worker-node-2
  exec bash
  ```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chụp màn hình đổi hostname và cấu hình file hosts (giống ảnh ở **Trang 2 - Bước 1.1** của tài liệu K8s cũ) vào đây.

* **Cấu hình file `/etc/hosts` (Sửa đồng bộ giống nhau trên cả 3 máy):**
  Mở file hosts bằng lệnh:
  ```bash
  sudo nano /etc/hosts
  ```
  Xóa sạch nội dung cũ và dán nội dung định danh chuẩn dưới đây vào:
  ```text
  127.0.0.1 localhost
  127.0.1.1 localhost
  
  # Kubernetes Cluster Hosts (Mạng Host-Only)
  192.168.56.10 master-node
  192.168.56.11 worker-node-1
  192.168.56.12 worker-node-2
  ```
  *(Nhấn `Ctrl + O` -> `Enter` để lưu, `Ctrl + X` để thoát nano).*

### Bước 1.2: Tắt Swap (Bắt buộc đối với Kubernetes)
Chạy 2 lệnh này trên cả 3 máy để tắt phân vùng Swap:
```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chụp màn hình chạy lệnh tắt Swap (giống ảnh ở **Trang 2 - Bước 1.2** của tài liệu K8s cũ) vào đây.

### Bước 1.3: Cấu hình Kernel Modules & Mạng Linux
Chạy cụm lệnh sau trên cả 3 máy để thiết lập mạng cầu nối cho Container (sử dụng lệnh `echo` thay vì `cat <<EOF` để tránh bị treo terminal do lỗi xuống dòng khi copy-paste từ Windows):
```bash
# 1. Tạo file cấu hình load modules
echo -e "overlay\nbr_netfilter" | sudo tee /etc/modules-load.d/k8s.conf

# 2. Kích hoạt trực tiếp các modules
sudo modprobe overlay
sudo modprobe br_netfilter

# 3. Cấu hình các tham số sysctl mạng
echo -e "net.bridge.bridge-nf-call-iptables = 1\nnet.bridge.bridge-nf-call-ip6tables = 1\nnet.ipv4.ip_forward = 1" | sudo tee /etc/sysctl.d/k8s.conf

# 4. Áp dụng cấu hình sysctl
sudo sysctl --system
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chụp màn hình cấu hình Kernel & sysctl (giống ảnh ở **Trang 3 - Bước 1.3** của tài liệu K8s cũ) vào đây.

### Bước 1.4: Cài đặt Container Runtime (containerd)
Chạy chuỗi lệnh sau trên cả 3 máy để cài đặt containerd và cấu hình Systemd Cgroup (giúp quản lý tài nguyên hệ thống ổn định):
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release containerd

sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml > /dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

sudo systemctl restart containerd
sudo systemctl enable containerd
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chạy lệnh cài containerd & cấu hình SystemdCgroup (giống ảnh ở **Trang 4 - Bước 1.4** của tài liệu K8s cũ) vào đây.

### Bước 1.5: Cài đặt Bộ công cụ K8s (kubelet, kubeadm, kubectl v1.30)
Chạy chuỗi lệnh sau trên cả 3 máy để thêm kho lưu trữ và cài đặt K8s:
```bash
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gpg
sudo mkdir -p -m 755 /etc/apt/keyrings

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg --yes

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
sudo systemctl enable --now kubelet
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chụp màn hình tải keyrings & cài đặt bộ công cụ K8s (giống ảnh ở **Trang 5 - Bước 1.5** của tài liệu K8s cũ) vào đây.

### 🚨 Bước 1.6 (CỰC KỲ QUAN TRỌNG): Chỉ định IP Host-Only cho Kubelet
Mặc định, Kubelet sẽ tự nhận diện IP của card mạng NAT (`10.0.2.15`), khiến cả 3 máy ảo bị trùng IP trong cụm K8s và không thể liên lạc với nhau. Chúng ta cần ép Kubelet nhận IP Host-Only tĩnh.

* **Trên máy Master (`master-node`):**
  ```bash
  echo "KUBELET_EXTRA_ARGS=--node-ip=192.168.56.10" | sudo tee /etc/default/kubelet
  sudo systemctl daemon-reload
  sudo systemctl restart kubelet
  ```
* **Trên máy Worker 1 (`worker-node-1`):**
  ```bash
  echo "KUBELET_EXTRA_ARGS=--node-ip=192.168.56.11" | sudo tee /etc/default/kubelet
  sudo systemctl daemon-reload
  sudo systemctl restart kubelet
  ```
* **Trên máy Worker 2 (`worker-node-2`):**
  ```bash
  echo "KUBELET_EXTRA_ARGS=--node-ip=192.168.56.12" | sudo tee /etc/default/kubelet
  sudo systemctl daemon-reload
  sudo systemctl restart kubelet
  ```

---

## 🚀 PHẦN 2: KHỞI TẠO CLUSTER & KẾT NỐI CÁC NODE

### Bước 2.1: Khởi tạo Master Node (Chỉ chạy trên máy `master-node`)
Tại terminal của máy **Master**, chạy lệnh khởi tạo cụm. Chúng ta chỉ định địa chỉ quảng bá (advertise address) là IP Host-Only của Master và dải IP mạng Pod (Flannel):
```bash
sudo kubeadm init --pod-network-cidr=10.244.0.0/16 --apiserver-advertise-address=192.168.56.10
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh kết quả chạy lệnh `kubeadm init` thành công và in ra dòng join command (giống ảnh ở **Trang 5 - Bước 2.1** của tài liệu K8s cũ) vào đây.

Sau khi chạy xong, màn hình sẽ hiển thị thông báo thành công và một đoạn mã để các node Worker gia nhập cụm (join command) có dạng:
```bash
kubeadm join 192.168.56.10:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>
```
> [!TIP]
> Hãy copy và lưu lại dòng `kubeadm join...` này ra một file nháp trên máy Windows của bạn để dùng ở Bước 2.4.

### Bước 2.2: Cấu hình quyền quản trị kubectl (Chỉ chạy trên máy `master-node`)
Để có thể chạy các lệnh quản lý cụm bằng `kubectl` với tư cách user thường, hãy chạy các lệnh sau tại máy **Master**:
```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh cấu hình quyền quản trị kubectl (giống ảnh ở **Trang 6 - Bước 2.2** của tài liệu K8s cũ) vào đây.

### 🚨 Bước 2.3: Tải và Cấu hình Mạng Flannel CNI trên Card Host-Only (Chỉ chạy trên máy `master-node`)
Thông thường, Flannel sẽ chạy qua card NAT `enp0s3` dẫn đến lỗi mất kết nối giữa các Pod trên các node khác nhau. Chúng ta phải tải cấu hình về, thêm tham số `--iface=enp0s8` để ép Flannel chạy trên card Host-Only.

Tại terminal máy **Master**, chạy lần lượt 3 lệnh sau:
```bash
# 1. Tải file cấu hình Flannel chính thức
curl -sSL https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml -o kube-flannel.yml

# 2. Tự động chèn cấu hình card mạng enp0s8 vào phần đối số khởi động flanneld
sed -i 's/- --kube-subnet-mgr/- --kube-subnet-mgr\n        - --iface=enp0s8/g' kube-flannel.yml

# 3. Tiến hành áp dụng cấu hình mạng vào cụm K8s
kubectl apply -f kube-flannel.yml
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh áp dụng mạng Flannel (giống ảnh ở **Trang 6 - Bước 2.3** của tài liệu K8s cũ) vào đây.

### Bước 2.4: Nối 2 máy Worker Node vào Cluster (Chạy trên `worker-node-1` and `worker-node-2`)

* **Trên máy Worker 1 (`worker-node-1`):**
  Lấy dòng lệnh `kubeadm join...` đã lưu ở Bước 2.1, thêm từ khóa `sudo` ở đầu và chạy:
  ```bash
  sudo kubeadm join 192.168.56.10:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>
  ```
* **Trên máy Worker 2 (`worker-node-2`):**
  Thực hiện tương tự:
  ```bash
  sudo kubeadm join 192.168.56.10:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>
  ```

*(Nếu lỡ quên hoặc làm mất lệnh join, tại máy **Master** gõ lệnh sau để lấy lại: `kubeadm token create --print-join-command`)*

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh các Worker gia nhập thành công vào cụm (giống ảnh ở **Trang 7 - Bước 2.4** của tài liệu K8s cũ) vào đây.

### Bước 2.5: Kiểm tra trạng thái hạ tầng (Chạy trên máy `master-node`)
Tại máy **Master**, chạy lệnh sau để kiểm tra xem các node đã kết nối thành công chưa:
```bash
kubectl get nodes -o wide
```

**Kết quả mong đợi:**
* Cả 3 máy `master-node`, `worker-node-1`, `worker-node-2` đều hiển thị trạng thái `Ready`.
* Cột `INTERNAL-IP` của các node hiển thị chính xác địa chỉ IP mạng Host-Only lần lượt là `192.168.56.10`, `192.168.56.11`, `192.168.56.12` (không phải là `10.0.2.15`).

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh kết quả kiểm tra `kubectl get nodes` (giống ảnh ở **Trang 8 - Bước 2.5** của tài liệu K8s cũ) vào đây.

---

## 🌐 PHẦN 3: CÀI ĐẶT & THIẾT LẬP INGRESS NGINX CONTROLLER (Chạy trên máy `master-node`)

Ta cài đặt Ingress Nginx Controller trước khi deploy ứng dụng để làm cổng tiếp nhận duy nhất cho toàn bộ traffic bên ngoài.

### Bước 3.1: Cài đặt Ingress Nginx Controller
Ta sử dụng manifest chính thức của Ingress Nginx dành cho môi trường Bare-metal (không phải Cloud Provider):
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/baremetal/deploy.yaml
```

Kiểm tra trạng thái cài đặt và chờ cho tất cả các Pod trong namespace `ingress-nginx` chuyển sang trạng thái `Running`:
```bash
kubectl get pods -n ingress-nginx -w
```
*(Nhấn `Ctrl + C` để thoát chế độ theo dõi `-w` khi thấy các Pod đã Running).*

### Bước 3.2: Cố định cổng NodePort HTTP thành `30080` cho Ingress Nginx
Mặc định, Ingress Nginx Controller sẽ dùng một cổng NodePort ngẫu nhiên. Ta cần gán cố định nó vào cổng `30080` để từ Windows có thể truy cập trực tiếp bằng cổng này:
```bash
kubectl patch service ingress-nginx-controller -n ingress-nginx --type='json' -p='[{"op": "replace", "path": "/spec/ports/0/nodePort", "value": 30080}]'
```

---

## 📦 PHẦN 4: TRIỂN KHAI ỨNG DỤNG PHARMACY & ĐỊNH TUYẾN INGRESS

Sau khi hạ tầng K8s và Ingress Nginx đã sẵn sàng ở chế độ mạng NAT + Host-Only, ta tiến hành triển khai ứng dụng.

### Bước 4.1: Tạo thư mục chứa dữ liệu MongoDB (Chỉ chạy trên máy `worker-node-1`)
Do cấu hình Database được gán cứng (nodeSelector) chạy trên máy `worker-node-1`, hãy đăng nhập vào terminal máy **Worker 1** và tạo thư mục:
```bash
sudo mkdir -p /mnt/data/mongo
sudo chmod 777 /mnt/data/mongo
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chạy lệnh tạo thư mục lưu trữ DB trên Worker 1 (giống ảnh ở **Trang 8 - Bước 3.1** của tài liệu K8s cũ) vào đây.

### Bước 4.2: Tạo các File cấu hình YAML trên Master Node (Chỉ chạy trên máy `master-node`)
Quay lại máy **Master**, tạo 5 file cấu hình YAML bằng trình soạn thảo `nano`.

1. **Tạo file `k8s-config.yaml`:**
   ```bash
   nano k8s-config.yaml
   ```
   *Nhập nội dung cấu hình ConfigMap và Secret của hệ thống:*
   ```yaml
   apiVersion: v1 
   kind: ConfigMap 
   metadata: 
     name: pharmacy-config 
   data: 
     MONGODB_DATABASE: "pharmacy" 
     SPRING_PROFILES_ACTIVE: "prod" 
   --- 
   apiVersion: v1 
   kind: Secret 
   metadata: 
     name: pharmacy-secrets 
   type: Opaque 
   stringData:
     db-password: "SuperSecretPassword123" 
     jwt-secret: "MySuperLongAndSecureJWTTokenKey1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12" 
     mongo-uri: "mongodb://root:SuperSecretPassword123@mongodb:27017/pharmacy?authSource=admin" 
   ```

2. **Tạo file `k8s-mongodb.yaml`:**
   ```bash
   nano k8s-mongodb.yaml
   ```
   *Nhập nội dung cấu hình Volume, Service và Deployment cho MongoDB:*
   ```yaml
   apiVersion: v1 
   kind: PersistentVolume 
   metadata: 
     name: mongo-pv 
   spec: 
     capacity: 
       storage: 10Gi 
     accessModes: 
       - ReadWriteOnce 
     persistentVolumeReclaimPolicy: Retain 
     hostPath: 
       path: /mnt/data/mongo 
   --- 
   apiVersion: v1 
   kind: PersistentVolumeClaim 
   metadata: 
     name: mongo-pvc 
   spec: 
     accessModes: 
       - ReadWriteOnce 
     resources: 
       requests: 
         storage: 10Gi 
   --- 
   apiVersion: v1 
   kind: Service 
   metadata: 
     name: mongodb 
   spec: 
     ports: 
       - port: 27017 
         targetPort: 27017 
     selector: 
       app: mongodb 
   --- 
   apiVersion: apps/v1 
   kind: Deployment 
   metadata: 
     name: mongodb 
   spec:
     replicas: 1 
     selector: 
       matchLabels: 
         app: mongodb 
     template: 
       metadata: 
         labels: 
           app: mongodb 
       spec: 
         nodeSelector: 
           kubernetes.io/hostname: worker-node-1 
         containers: 
           - name: mongodb 
             image: mongo:6.0 
             ports: 
               - containerPort: 27017 
             env: 
               - name: MONGO_INITDB_ROOT_USERNAME 
                 value: "root" 
               - name: MONGO_INITDB_ROOT_PASSWORD 
                 valueFrom: 
                   secretKeyRef: 
                     name: pharmacy-secrets 
                     key: db-password 
             resources: 
               limits: 
                 cpu: "1.0" 
                 memory: 1Gi 
               requests: 
                 cpu: "0.3" 
                 memory: 256Mi 
             volumeMounts: 
               - name: mongo-storage 
                 mountPath: /data/db 
         volumes: 
           - name: mongo-storage 
             persistentVolumeClaim: 
               claimName: mongo-pvc
   ```

3. **Tạo file `k8s-backend.yaml`:**
   ```bash
   nano k8s-backend.yaml
   ```
   *Nhập cấu hình Deployment và Service cho Backend (Spring Boot):*
   ```yaml
   apiVersion: apps/v1 
   kind: Deployment 
   metadata: 
     name: spring-boot 
   spec: 
     replicas: 2 
     selector: 
       matchLabels: 
         app: spring-boot 
     template: 
       metadata: 
         labels: 
           app: spring-boot 
       spec: 
         affinity: 
           podAntiAffinity: 
             preferredDuringSchedulingIgnoredDuringExecution: 
               - weight: 100 
                 podAffinityTerm: 
                   labelSelector: 
                     matchExpressions: 
                       - key: app 
                         operator: In 
                         values: 
                           - spring-boot 
                   topologyKey: "kubernetes.io/hostname" 
         containers: 
           - name: spring-boot 
             image: dinhsi1401/pharmacy:3.0 
             ports: 
               - containerPort: 8081 
             env: 
               - name: MONGODB_DATABASE 
                 valueFrom: 
                   configMapKeyRef: 
                     name: pharmacy-config 
                     key: MONGODB_DATABASE 
               - name: SPRING_PROFILES_ACTIVE 
                 valueFrom: 
                   configMapKeyRef: 
                     name: pharmacy-config 
                     key: SPRING_PROFILES_ACTIVE 
               - name: mongo_uri 
                 valueFrom: 
                   secretKeyRef: 
                     name: pharmacy-secrets 
                     key: mongo-uri 
               - name: jwt 
                 valueFrom: 
                   secretKeyRef: 
                     name: pharmacy-secrets 
                     key: jwt-secret 
             resources: 
               limits: 
                 cpu: "1.0" 
                 memory: 512Mi 
               requests: 
                 cpu: "0.3" 
                 memory: 256Mi 
             readinessProbe: 
               tcpSocket: 
                 port: 8081 
               initialDelaySeconds: 15 
               periodSeconds: 10 
             livenessProbe: 
               tcpSocket: 
                 port: 8081 
               initialDelaySeconds: 20 
               periodSeconds: 20 
   --- 
   apiVersion: v1 
   kind: Service 
   metadata: 
     name: spring-boot 
   spec: 
     ports: 
       - port: 8081 
         targetPort: 8081 
     selector: 
       app: spring-boot 
   ```

4. **Tạo file `k8s-frontend.yaml` (CẤU HÌNH TRỰC TIẾP LÀM CLUSTERIP):**
   ```bash
   nano k8s-frontend.yaml
   ```
   *Nhập nội dung cấu hình Service của Frontend trực tiếp dưới dạng **ClusterIP** (thay vì NodePort như tài liệu cũ để tránh xung đột cổng `30080`):*
   
   ```yaml
   apiVersion: apps/v1 
   kind: Deployment 
   metadata: 
     name: frontend 
   spec: 
     replicas: 2 
     selector: 
       matchLabels: 
         app: frontend 
     template: 
       metadata: 
         labels: 
           app: frontend 
       spec: 
         affinity: 
           podAntiAffinity: 
             preferredDuringSchedulingIgnoredDuringExecution: 
               - weight: 100 
                 podAffinityTerm: 
                   labelSelector: 
                     matchExpressions: 
                       - key: app 
                         operator: In 
                         values: 
                           - frontend 
                   topologyKey: "kubernetes.io/hostname" 
         containers: 
           - name: frontend 
             image: vokhoaecho/pharmacy-frontend:2.0 
             ports: 
               - containerPort: 80 
             resources: 
               limits: 
                 cpu: "0.5" 
                 memory: 128Mi 
               requests: 
                 cpu: "0.1" 
                 memory: 64Mi 
             readinessProbe: 
               httpGet: 
                 path: / 
                 port: 80 
               initialDelaySeconds: 5 
               periodSeconds: 5 
   --- 
   apiVersion: v1 
   kind: Service 
   metadata: 
     name: frontend 
   spec: 
     type: ClusterIP 
     ports: 
       - port: 80 
         targetPort: 80 
     selector: 
       app: frontend 
   ```

5. **Tạo file cấu hình Ingress `k8s-ingress.yaml`:**
   ```bash
   nano k8s-ingress.yaml
   ```
   *Nhập cấu hình Ingress định tuyến tên miền ảo `pharmacy.local` trỏ về service `frontend` trong cụm:*
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: pharmacy-ingress
     namespace: default
   spec:
     ingressClassName: nginx
     rules:
     - host: pharmacy.local
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: frontend
               port:
                 number: 80
   ```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chạy lệnh `nano` tạo các file YAML (giống ảnh ở **Trang 13 - Bước 3.2** của tài liệu K8s cũ) vào đây.

### Bước 4.3: Triển khai toàn bộ tài nguyên lên cụm (Chỉ chạy trên máy `master-node`)
Tại máy **Master**, chạy lần lượt các lệnh apply để kích hoạt ứng dụng và Ingress:
```bash
kubectl apply -f k8s-config.yaml
kubectl apply -f k8s-mongodb.yaml
kubectl apply -f k8s-backend.yaml
kubectl apply -f k8s-frontend.yaml
kubectl apply -f k8s-ingress.yaml
```

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chạy các lệnh apply tài nguyên (giống ảnh ở **Trang 14 - Bước 3.3** của tài liệu K8s cũ) vào đây.

### Bước 4.4: Kiểm tra trạng thái ứng dụng (Chỉ chạy trên máy `master-node`)
Chạy lệnh sau để kiểm tra xem các Container đã chạy ổn định chưa:
```bash
kubectl get pods -o wide
```
**Kết quả mong đợi:** Tất cả các pod `frontend`, `spring-boot`, và `mongodb` đều ở trạng thái `Running` và đã phân bổ đều trên các worker node.

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh kiểm tra trạng thái hoạt động của các Pod (giống ảnh ở **Trang 14 - Mục 5 - Bước 1** của tài liệu K8s cũ) vào đây.

### Bước 4.5: Cấu hình file Hosts trên máy tính Windows thật (Windows Host)
Để máy tính Windows của bạn hiểu và phân giải được tên miền ảo `pharmacy.local`, hãy trỏ tên miền này về IP Host-Only của các Worker Node:

1. Trên Windows, mở phần mềm **Notepad** bằng cách click chuột phải -> chọn **Run as Administrator** (Chạy dưới quyền quản trị viên).
2. Mở file hosts theo đường dẫn: `C:\Windows\System32\drivers\etc\hosts`
3. Thêm 2 dòng sau vào cuối file:
   ```text
   192.168.56.11 pharmacy.local
   192.168.56.12 pharmacy.local
   ```
4. Lưu file lại.

---

## 🖥️ TRUY CẬP ỨNG DỤNG TỪ MÁY WINDOWS (HOST)

Từ trình duyệt Chrome, Firefox trên máy tính Windows thật của bạn, bạn có thể truy cập trực tiếp vào ứng dụng bằng tên miền ảo vô cùng chuyên nghiệp qua cổng `30080` (được Ingress Nginx tiếp nhận và cân bằng tải):

👉 **[http://pharmacy.local:30080](http://pharmacy.local:30080)**

> 📸 **[HÌNH ẢNH MINH HỌA]:** Dán ảnh chụp màn hình trang web giao diện đăng nhập ứng dụng (giống ảnh ở **Trang 15** của tài liệu K8s cũ) vào đây.

---

## 🔍 KHẮC PHỤC SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 1. Lỗi các Node bị trùng IP `10.0.2.15`
* **Triệu chứng:** Chạy `kubectl get nodes -o wide` thấy cột `INTERNAL-IP` của cả 3 node đều hiển thị giống nhau là `10.0.2.15`. Cụm hoạt động không ổn định.
* **Cách sửa:** Bạn chưa chạy **Bước 1.6**. Hãy kiểm tra lại file cấu hình `/etc/default/kubelet` trên từng máy xem đã khai báo đúng IP tĩnh Host-Only của máy đó chưa. Sau đó khởi động lại kubelet:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl restart kubelet
  ```

### 2. Lỗi Pod Flannel ở trạng thái `Init:0/1` hoặc `Error`
* **Triệu chứng:** Pod CNI của Flannel bị treo hoặc báo lỗi, các node ở trạng thái `NotReady`.
* **Cách sửa:** Bạn chưa sửa file `kube-flannel.yml` để gán card mạng `enp0s8` (Bước 2.3). Hãy thực hiện reset lại cấu hình mạng bằng cách áp dụng lại file cấu hình Flannel đã sửa đổi:
  ```bash
  kubectl delete -f kube-flannel.yml
  kubectl apply -f kube-flannel.yml
  ```

### 3. Muốn làm lại từ đầu (Khởi động lại cụm)
Nếu cấu hình lỗi và muốn dọn dẹp sạch cụm K8s để cài đặt lại:
* **Trên cả 3 máy ảo:**
  ```bash
  sudo kubeadm reset -f
  sudo rm -rf /etc/cni/net.d /var/lib/etcd $HOME/.kube
  sudo systemctl restart containerd
  ```
* Sau khi dọn dẹp xong, thực hiện lại từ **Bước 2.1** (Khởi tạo Master Node).

---

## 🚀 PHẦN 5: KIỂM THỬ CÁC TÍNH NĂNG CỐT LÕI CỦA KUBERNETES

Để hiểu rõ hơn về các tính năng vượt trội mà Kubernetes (K8s) mang lại so với các giải pháp quản lý container truyền thống, chúng ta sẽ thực hiện kiểm thử 4 tính năng cốt lõi sau trực tiếp trên cụm K8s Lab (VirtualBox) vừa cài đặt:

| Chức năng | Mô tả chi tiết |
| :--- | :--- |
| **Tự chữa lành (Self-healing)** | Tự động khởi động lại container bị lỗi, thay thế, tiêu hủy các container không phản hồi kiểm tra sức khỏe (health check), và chỉ điều hướng traffic đến các container sẵn sàng. |
| **Cân bằng tải & Phát hiện dịch vụ** | Tự động gán địa chỉ IP và tên miền nội bộ cho tập hợp container, đồng thời cân bằng tải (load balancing) lượng truy cập để ứng dụng luôn ổn định. |
| **Tự động co giãn (Auto-scaling)** | - **HPA (Horizontal Pod Autoscaler)**: Tăng/giảm số lượng container dựa trên CPU, RAM hoặc custom metrics.<br>- **Cluster Autoscaler**: Tăng/giảm số lượng máy chủ (Node) trong cụm khi cần thiết. |
| **Triển khai & Cập nhật không gián đoạn** | Hỗ trợ cập nhật ứng dụng theo dạng cuốn chiếu (Rolling Update) hoặc triển khai Canary/Blue-Green. Nếu phiên bản mới bị lỗi, K8s cho phép Rollback về phiên bản cũ ngay lập tức. |

### 5.1. Kiểm thử Tính năng Tự chữa lành (Self-healing)
Khi một container hoặc Pod bị xóa thủ công hoặc gặp lỗi hệ thống, Kubernetes sẽ phát hiện trạng thái thực tế lệch với trạng thái cấu hình mong muốn (`replicas: 2`) và tự động tạo lại Pod mới để thay thế.

* **Bước 1:** Trên terminal máy **Master Node**, kiểm tra danh sách các Pod frontend đang chạy:
  ```bash
  kubectl get pods -l app=frontend
  ```
* **Bước 2:** Chọn ngẫu nhiên tên một Pod trong danh sách kết quả (ví dụ: `frontend-7b6fc57f6b-abcde`) và thực hiện xóa nó đi để giả lập sự cố đột ngột:
  ```bash
  kubectl delete pod <tên_pod_của_bạn>
  ```
* **Bước 3:** Ngay lập tức, chạy lệnh giám sát trạng thái thay đổi Pod:
  ```bash
  kubectl get pods -l app=frontend -w
  ```
* **Kết quả kiểm thử:** Bạn sẽ thấy Pod cũ bị chuyển sang trạng thái `Terminating` (Đang tiêu hủy) và một Pod mới hoàn toàn khác tên sẽ lập tức được tự động khởi tạo (`ContainerCreating` -> `Running`) trên Worker Node để đảm bảo số lượng replicas luôn đúng bằng 2. Hệ thống tự sửa chữa chỉ trong vài giây mà không cần con người can thiệp.

### 5.2. Kiểm thử Tính năng Cân bằng tải & Phát hiện dịch vụ (Load Balancing & Service Discovery)
Kubernetes tích hợp CoreDNS tự động gán tên miền nội bộ cho Service. Kube-proxy chịu trách nhiệm cân bằng tải (load balancing) lưu lượng truy cập đi vào Service tới các Pod ngầm.

* **Bước 1:** Khởi tạo một Pod kiểm thử tạm thời chạy bằng shell trên máy **Master Node**:
  ```bash
  kubectl run curl-test --image=radial/busyboxplus:curl -i --tty --rm
  ```
* **Bước 2:** Khi terminal hiển thị shell của container (dấu nhắc lệnh `[ nslookup ]`), hãy gõ lệnh kiểm tra DNS nội bộ:
  ```bash
  nslookup spring-boot
  ```
  **Kết quả phát hiện dịch vụ:** DNS Server nội bộ của K8s lập tức phân giải tên miền `spring-boot` thành địa chỉ ClusterIP tương ứng (ví dụ: `10.96.100.200`).
* **Bước 3:** Chạy lệnh curl liên tục để gửi request truy cập Backend API từ bên trong Pod kiểm thử:
  ```bash
  curl http://spring-boot:8081/api/health
  ```
* **Bước 4:** Gõ lệnh `exit` để thoát khỏi Pod kiểm thử. Trên máy Master Node, chạy lệnh xem log hoạt động phân bổ request của các Pod Spring Boot:
  ```bash
  kubectl logs -l app=spring-boot --tail=15
  ```
  **Kết quả cân bằng tải:** Bạn sẽ thấy các bản ghi nhật ký (log) truy cập được chia đều lần lượt cho cả 2 Pod của Backend Spring Boot nhờ thuật toán cân bằng tải mặc định.

### 5.3. Kiểm thử Tính năng Tự động co giãn (Auto-scaling)
Horizontal Pod Autoscaler (HPA) tự động điều chỉnh số lượng Pod chạy dựa trên tải sử dụng CPU thực tế.

* **Bước 1:** Kích hoạt Metrics Server trên máy **Master Node** để theo dõi chỉ số tài nguyên cụm:
  ```bash
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  ```
* **Bước 2:** Cho phép Metrics Server hoạt động với chứng chỉ SSL tự ký của card mạng Host-Only:
  ```bash
  kubectl edit deployment metrics-server -n kube-system
  ```
  Tìm đến phần cấu hình `spec.template.spec.containers[0].args` (dòng chứa tham số khởi động) và chèn thêm dòng sau:
  ```yaml
  - --kubelet-insecure-tls
  ```
* **Bước 3:** Tạo cấu hình co giãn HPA cho Frontend (ngưỡng 50% CPU, tối thiểu 2 Pod, tối đa 10 Pod):
  ```bash
  kubectl autoscale deployment frontend --cpu-percent=50 --min=2 --max=10
  ```
* **Bước 4:** Giả lập quá tải hệ thống bằng cách chạy một Pod load generator gửi yêu cầu dồn dập vào Frontend:
  ```bash
  kubectl run load-generator --image=busybox:1.28 --rm -it -- sh -c "while true; do wget -q -O- http://frontend; done"
  ```
* **Bước 5:** Mở thêm một cửa sổ terminal song song trên máy Master Node và theo dõi sự thay đổi của HPA:
  ```bash
  kubectl get hpa -w
  ```
* **Kết quả kiểm thử HPA:** Khi CPU của Frontend vượt ngưỡng 50%, cột `REPLICAS` trên terminal sẽ tự động nhảy số tăng dần từ 2 lên 4, 6, 8... rồi đạt đỉnh tối đa 10 Pod để cùng chia tải. Khi bạn tắt Pod stress-test (load-generator), CPU giảm xuống và K8s sẽ tự động giảm số Pod (scale-down) về lại 2 sau khoảng thời gian nguội (thường là 5 phút).

> [!NOTE]
> **Lưu ý về Cluster Autoscaler:** Trong môi trường Lab cục bộ chạy trên máy ảo VirtualBox, hệ thống không hỗ trợ co giãn máy chủ vật lý (Cluster Autoscaler) do thiếu liên kết API với hạ tầng đám mây (AWS, Azure, GCP).

### 5.4. Kiểm thử Triển khai & Cập nhật không gián đoạn (Rolling Update & Rollback)
Cơ chế Rolling Update cập nhật ứng dụng bằng cách lần lượt thay thế các Pod cũ bằng các Pod mới, bảo đảm không có thời gian chết (zero downtime). Nếu phiên bản mới có lỗi, rollback sẽ đưa cụm về trạng thái cũ ngay lập tức.

* **Bước 1:** Thực hiện cập nhật image mới cho Frontend (ví dụ: lên phiên bản giả lập `3.0`):
  ```bash
  kubectl set image deployment/frontend frontend=vokhoaecho/pharmacy-frontend:3.0 --record
  ```
* **Bước 2:** Theo dõi tiến trình cập nhật cuốn chiếu không gián đoạn:
  ```bash
  kubectl rollout status deployment/frontend
  ```
* **Bước 3:** Kiểm tra lịch sử các phiên bản đã cập nhật trên cụm:
  ```bash
  kubectl rollout history deployment/frontend
  ```
* **Bước 4:** Giả sử phiên bản mới cập nhật bị lỗi nghiêm trọng, thực hiện quay xe về phiên bản cũ ngay lập tức:
  ```bash
  kubectl rollout undo deployment/frontend
  ```
* **Kết quả kiểm thử:** Cụm K8s sẽ lập tức thay đổi cấu hình trỏ ngược về phiên bản cũ (2.0) đang hoạt động ổn định. Người dùng bên ngoài khi truy cập ứng dụng sẽ không nhận ra bất kỳ sự cố dừng hoạt động nào (downtime) của dịch vụ.

