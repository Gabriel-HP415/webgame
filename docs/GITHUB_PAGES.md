# Host trên GitHub Pages + Online 2 người

## 1. Bật Pages

1. Repo → **Settings** → **Pages** → Source: **GitHub Actions**
2. Push `main` → workflow **Deploy to GitHub Pages** chạy xong
3. URL game: `https://<user>.github.io/<repo>/` (ví dụ `.../webgame/`)

**Chế độ AI** chạy ngay, không cần server.

## 2. Online — cần máy chủ Socket (Render)

GitHub Pages **chỉ** host file HTML/JS. Tạo phòng cần server Node (`packages/server`).

### Bước A — Deploy server lên Render (miễn phí)

1. [render.com](https://render.com) → **New** → **Web Service** → chọn repo GitHub
2. **Build Command:**
   ```bash
   npm install && npm run build -w @bto/shared && npm run build -w @bto/server
   ```
3. **Start Command:**
   ```bash
   npm run start -w @bto/server
   ```
4. **Environment variables:**
   - `CORS_ORIGIN` = URL GitHub Pages của bạn, ví dụ:  
     `https://gabriel-hp415.github.io`  
     (có thể thêm nhiều domain, cách nhau bằng dấu phẩy)
5. Deploy xong → copy URL, ví dụ `https://bto-server.onrender.com`
6. Mở `https://YOUR-SERVICE.onrender.com/health` → phải thấy `{"ok":true,...}`

Hoặc dùng file `render.yaml` ở root repo (Blueprint).

### Bước B — Gắn URL vào game (không cần build lại)

1. Mở trang GitHub Pages (trang chủ game)
2. Ô **URL máy chủ game** → dán `https://....onrender.com`
3. **Lưu URL** → **Kiểm tra kết nối** (phải báo OK)
4. **Tạo phòng (Host)** → copy mã phòng / link cho bạn bè
5. Bạn bè: cùng URL server (Lưu trên máy họ) → **Tham gia** mã phòng

URL được lưu trong `localStorage` trình duyệt — mỗi người chơi cần Lưu cùng URL server một lần.

### Cách khác (tùy chọn)

Repo → **Settings** → **Secrets** → `VITE_SOCKET_URL` = URL Render → push lại `main` để nhúng sẵn vào bản build.

## 3. Docker trên máy (không cần Render)

```bash
docker compose up --build -d
```

Mở `http://localhost:8080` — **để trống** ô URL server → Online dùng Socket qua nginx.

## Khắc phục

| Lỗi | Cách xử lý |
|-----|------------|
| Không kết nối được máy chủ | Chưa có URL Render hoặc server đang ngủ — đợi ~30s, bấm Kiểm tra lại |
| Kiểm tra /health fail | Sai URL, hoặc `CORS_ORIGIN` trên Render chưa có domain `*.github.io` |
| Tạo phòng OK nhưng bạn không vào được | Bạn bè cũng phải **Lưu** cùng URL server |
