# 📦 Hướng dẫn Deploy: Supabase + Render

Hướng dẫn này giúp bạn deploy ứng dụng lên **Render** với database **Supabase PostgreSQL**.

---

## 📋 Bước 1: Cài đặt Supabase

### 1.1 Tạo tài khoản Supabase
1. Truy cập [supabase.com](https://supabase.com)
2. Đăng ký (hoặc đăng nhập bằng GitHub)
3. Tạo **New Project**
   - **Project Name**: `hoithao-voting`
   - **Database Password**: Chọn mật khẩu mạnh
   - **Region**: Singapore (gần nhất với Việt Nam)
4. Chờ project khởi tạo (~2 phút)

### 1.2 Tạo bảng Votes
1. Vào **SQL Editor** (menu bên trái)
2. Tạo query mới và chạy SQL sau:

```sql
-- Tạo bảng votes
CREATE TABLE votes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  image_id TEXT NOT NULL,
  ip_address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tạo index cho tìm kiếm nhanh
CREATE INDEX votes_image_id_idx ON votes(image_id);
CREATE INDEX votes_ip_address_idx ON votes(ip_address);
```

3. Chạy query (Ctrl+Enter hoặc nút Run)

### 1.3 Lấy Supabase Keys
1. Vào **Settings → API** (menu bên trái)
2. Copy 2 giá trị này:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: `eyJhbGciOiJI...` (dòng dài)
3. Giữ an toàn, sẽ dùng ở bước tiếp theo

---

## 🚀 Bước 2: Cập nhật code để dùng Supabase

### 2.1 Cài dependencies
```bash
npm install
```

Sẽ tự động cài: `@supabase/supabase-js` và `dotenv`

### 2.2 Tạo file .env
Tạo file `.env` trong thư mục app (cạnh `package.json`):

```
PORT=3000
HOST=0.0.0.0
INTERNAL_ONLY=false
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

**Thay giá trị từ Bước 1.3 vào đây**

### 2.3 Test local
```bash
npm start
```

Truy cập http://localhost:3000 để test. Nếu thấy app chạy bình thường → OK!

---

## ☁️ Bước 3: Deploy lên Render

### 3.1 Chuẩn bị GitHub
1. Đảm bảo tất cả code đã push lên GitHub:
```bash
git add .
git commit -m "Add Supabase database support"
git push
```

### 3.2 Tạo Web Service trên Render
1. Truy cập [render.com](https://render.com)
2. Đăng ký (hoặc đăng nhập bằng GitHub)
3. Tạo **New → Web Service**
4. Chọn **Deploy an existing repository** → `hoithao`
5. Điền thông tin:
   - **Name**: `hoithao-voting`
   - **Region**: Singapore (gần nhất)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3.3 Thêm Environment Variables
1. Kéo xuống phần **Environment**
2. Thêm các biến:
   - **SUPABASE_URL**: `https://xxxxx.supabase.co`
   - **SUPABASE_ANON_KEY**: `eyJhbGciOiJI...`
   - **INTERNAL_ONLY**: `false`

3. Click **Create Web Service**

### 3.4 Chờ deploy
- Render sẽ tự động build & deploy (~2-5 phút)
- Xem logs để theo dõi tiến trình
- Khi xong, mở URL được cấp (vd: `hoithao-voting.onrender.com`)

---

## ✅ Kiểm tra deployment

1. **Truy cập app**: https://hoithao-voting.onrender.com
2. **Test bình chọn**: Chọn một mẫu áo → kiểm tra vote tăng
3. **Kiểm tra database**: Vào Supabase → Tables → votes → kiểm tra dữ liệu

---

## 🐛 Troubleshooting

### "SUPABASE_URL undefined"
→ Kiểm tra lại Environment Variables trên Render có đúng không

### "Error: unable to reach database"
→ Kiểm tra Supabase project đã khởi tạo xong chưa

### App chạy nhưng votes không lưu
→ Kiểm tra Anon Key có đúng không (không phải Service Role Key)

---

## 📝 Lưu ý bảo mật

- **Không** commit file `.env` lên GitHub (đã trong `.gitignore`)
- **Không** share Supabase keys công khai
- Supabase có **Row Level Security (RLS)** → tạo policy nếu cần kiểm soát quyền truy cập

---

## 🎯 Các bước tiếp theo

1. **Thêm công kích DDoS**: Cấu hình Rate Limiting trên Render
2. **Custom domain**: Kết nối domain riêng với Render
3. **Backup database**: Cấu hình automatic backups trên Supabase

---

**Chúc mừng! App của bạn giờ đã deploy lên cloud! 🎉**
