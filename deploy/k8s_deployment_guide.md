# Hướng Dẫn Triển Khai Kubernetes Dự Án Pharmacy (3 Node - VirtualBox)

Tài liệu này tổng hợp toàn bộ quy trình chuẩn bị hạ tầng, cấu hình máy ảo, dựng cụm Kubernetes (1 Master + 2 Worker) và triển khai ứng dụng Pharmacy Project từ A-Z.

---

## 💻 1. Thông Tin Kiến Trúc & Cấu Hình Máy ẢO (VirtualBox)

### Cấu hình phần cứng khuyên dùng (Laptop 16GB RAM / Intel Core i5):
* **Hệ điều hành máy ảo**: **Ubuntu Server 22.04 LTS** (Bắt buộc dùng bản Server CLI để tiết kiệm RAM).
* **Ổ đĩa (VDI)**: Tạo tối thiểu **25 - 30 GB** cho mỗi máy ảo để tránh lỗi đầy đĩa (`disk-pressure`).

| Máy ảo (Node) | Tên máy (Hostname) | IP Ví dụ | Số vCPU | RAM | Ổ đĩa | Nhiệm vụ |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Master Node** | `master-node` | `192.168.1.10` | 2 vCPU | 2.0 GB | 25 GB | Điều phối hệ thống (Control Plane) |
| **Worker Node 1** | `worker-node-1` | `192.168.1.11` | 2 vCPU | 3.5 GB | 30 GB | Chạy Frontend + Backend + **MongoDB** |
| **Worker Node 2** | `worker-node-2` | `192.168.1.12` | 2 vCPU | 2.5 GB | 25 GB | Chạy Frontend + Backend |

---

## 🛠️ 2. GIAI ĐOẠN 1: Chuẩn Bị Hạ Tầng (Chạy trên TẤT CẢ 3 Máy Ảo)

Thực hiện lần lượt các lệnh sau trên cả **Master Node**, **Worker Node 1** và **Worker Node 2**:

### Bước 1.1: Đặt tên Hostname chuẩn
* **Trên Master Node**:
  ```bash
  sudo hostnamectl set-hostname master-node
  echo "127.0.1.1 master-node" | sudo tee -a /etc/hosts
  ```
* **Trên Worker Node 1**:
  ```bash
  sudo hostnamectl set-hostname worker-node-1
  echo "127.0.1.1 worker-node-1" | sudo tee -a /etc/hosts
  ```
* **Trên Worker Node 2**:
  ```bash
  sudo hostnamectl set-hostname worker-node-2
  echo "127.0.1.1 worker-node-2" | sudo tee -a /etc/hosts
  ```

### Bước 1.2: Tắt Swap (Bắt buộc với K8s)
```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

### Bước 1.3: Cấu hình Kernel Modules & Mạng Linux
```bash
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system
```

### Bước 1.4: Cài đặt Container Runtime (`containerd`)
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release containerd

sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml > /dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

sudo systemctl restart containerd
sudo systemctl enable containerd
```

### Bước 1.5: Cài đặt Bộ công cụ K8s (`kubelet`, `kubeadm`, `kubectl`)
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

---

## 🚀 3. GIAI ĐOẠN 2: Khởi Tạo Cluster & Kết Nối Các Node

### Bước 2.1: Khởi tạo Master Node (Chỉ chạy trên `master-node`)
1. Lấy IP của máy Master: `hostname -I` (Giả sử IP là `192.168.1.10`).
2. Khởi tạo cụm:
   ```bash
   sudo kubeadm init --pod-network-cidr=10.244.0.0/16 --apiserver-advertise-address=192.168.1.10
   ```
3. Copy và lưu lại dòng lệnh `sudo kubeadm join 192.168.1.10:6443 --token ...` hiển thị ở cuối màn hình.

### Bước 2.2: Cấu hình quyền `kubectl` (Chỉ chạy trên `master-node`)
```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

### Bước 2.3: Cài đặt Mạng Flannel CNI (Chỉ chạy trên `master-node`)
```bash
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

### Bước 2.4: Nối 2 máy Worker Node vào Cluster
Đăng nhập vào **Worker Node 1** và **Worker Node 2**, chạy lệnh `join` đã lưu ở Bước 2.1:
```bash
sudo kubeadm join 192.168.1.10:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>
```
*(Nếu lỡ quên lệnh join, trên máy Master gõ: `kubeadm token create --print-join-command`)*

### Bước 2.5: Kiểm tra hạ tầng
Đứng tại máy **Master Node**, gõ:
```bash
kubectl get nodes
```
Đợi cả 3 máy (`master-node`, `worker-node-1`, `worker-node-2`) hiển thị cột `STATUS` là **`Ready`**.

---

## 📦 4. GIAI ĐOẠN 3: Triển Khai Ứng Dụng Pharmacy

### Bước 3.1: Tạo thư mục dữ liệu MongoDB trên `worker-node-1`
Đăng nhập vào máy ảo **`worker-node-1`** và chạy:
```bash
sudo mkdir -p /mnt/data/mongo
sudo chmod 777 /mnt/data/mongo
```

### Bước 3.2: Tạo 4 File Cấu hình YAML trên máy `master-node`

Tạo từng file bằng trình soạn thảo `nano` (Sau khi dán nội dung: bấm `Ctrl + O` -> `Enter` để lưu, bấm `Ctrl + X` để thoát).

#### 1. File `k8s-config.yaml`
Chạy lệnh tạo file:
```bash
nano k8s-config.yaml
```
Dán nội dung cấu hình dưới đây:
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
  jwt-secret: "MySuperLongAndSecureJWTTokenKey1234567890" 
  mongo-uri: "mongodb://root:SuperSecretPassword123@mongodb:27017/pharmacy?authSource=admin" 
```

#### 2. File `k8s-mongodb.yaml`
Chạy lệnh tạo file:
```bash
nano k8s-mongodb.yaml
```
Dán nội dung cấu hình dưới đây:
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

#### 3. File `k8s-backend.yaml`
Chạy lệnh tạo file:
```bash
nano k8s-backend.yaml
```
Dán nội dung cấu hình dưới đây:
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
          image: dinhsi1401/pharmacy:2.0 
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

#### 4. File `k8s-frontend.yaml`
Chạy lệnh tạo file:
```bash
nano k8s-frontend.yaml
```
Dán nội dung cấu hình dưới đây:
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
  type: NodePort 
  ports: 
    - port: 80 
      targetPort: 80 
      nodePort: 30080 
  selector: 
    app: frontend 
```

### Bước 3.3: Apply các fileManifest trên `master-node`
```bash
kubectl apply -f k8s-config.yaml
kubectl apply -f k8s-mongodb.yaml
kubectl apply -f k8s-backend.yaml
kubectl apply -f k8s-frontend.yaml
```

---

## 🌐 5. Kiểm Tra & Truy Cập Ứng Dụng

1. Kiểm tra các Pod đã ở trạng thái **`Running`**:
   ```bash
   kubectl get pods -o wide
   ```
2. Mở trình duyệt trên máy Windows thật và truy cập:
   * **`http://192.168.1.11:30080`** (IP Worker Node 1)
   * hoặc **`http://192.168.1.12:30080`** (IP Worker Node 2)

---

## 🛠️ 6. Xử Lý Các Sự Cố Thường Gặp (Troubleshooting)

### 1. Lỗi `Port 10250 is in use` hoặc `/var/lib/etcd is not empty` khi `init` / `join`:
* **Nguyên nhân**: Máy ảo hoặc node đã từng khởi tạo K8s trước đó (hoặc do clone máy ảo), khiến cổng 10250 bị chiếm và dữ liệu etcd cũ chưa dọn dẹp.
* **Cách xử lý** (Chạy trên máy bị lỗi):
  ```bash
  # Reset cấu hình Kubernetes
  sudo kubeadm reset -f

  # Dọn dẹp dữ liệu etcd, mạng CNI và config cũ
  sudo rm -rf /var/lib/etcd /etc/cni/net.d $HOME/.kube

  # Khởi động lại containerd
  sudo systemctl restart containerd
  ```

### 2. Lỗi Worker Node báo `NotReady` (`cni plugin not initialized`):
* **Nguyên nhân**: Plugin mạng Flannel CNI chưa được cài đặt hoặc Pod Flannel đang kẹt ở bước tải image (`Init:1/2`).
* **Cách xử lý**:
  1. Trên máy **Master Node**, kiểm tra các Pod mạng Flannel:
     ```bash
     kubectl get pods -n kube-flannel
     ```
  2. Nếu chưa áp dụng mạng Flannel, chạy:
     ```bash
     kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
     ```
  3. Nếu Pod Flannel bị kẹt tải lâu, trên các máy **Worker Node** chạy:
     ```bash
     sudo mkdir -p /opt/cni/bin
     sudo systemctl restart containerd
     ```

### 3. Lỗi các Pod ứng dụng ở trạng thái `Pending`:
* **Nguyên nhân**: Các máy Worker Node chưa join vào cụm hoặc đang ở trạng thái `NotReady`.
* **Cách xử lý**: Kiểm tra trạng thái node bằng `kubectl get nodes`. Đảm bảo tất cả các Worker Node hiển thị **`Ready`** thì Pod mới được xếp lịch và chuyển sang `ContainerCreating` -> `Running`.

### 4. Lỗi Pod bị `Pending` do `disk-pressure` (Ổ đĩa máy ảo bị đầy > 85%):
* **Nguyên nhân**: Bộ nhớ tạm của containerd phình to chiếm hết dung lượng đĩa.
* **Cách xử lý**: Xóa sạch bộ nhớ tạm containerd phình to trên máy ảo bị lỗi:
  ```bash
  sudo systemctl stop kubelet containerd
  sudo rm -rf /var/lib/containerd/*
  sudo systemctl start containerd kubelet
  ```

### 5. Lỗi `kubectl` báo connection refused (`localhost:8080`):
* **Nguyên nhân**: Thiếu file cấu hình quản trị `admin.conf` cho user hiện tại.
* **Cách xử lý**: Chạy lại các lệnh cấp quyền:
  ```bash
  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config
  ```

### 6. Lỗi Worker Node cũ từng join bị trùng cấu hình:
* **Cách xử lý**: Dọn dẹp cấu hình K8s cũ trước khi join lại:
  ```bash
  sudo kubeadm reset -f
  ```
