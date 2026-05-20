# Chơi Online — Vercel + Render

**Vercel** phù hợp host **trang web tĩnh** (HTML/JS sau `vite build`).  
**Socket.io** cần máy chủ **chạy liên tục** (WebSocket) → deploy **`packages/server`** lên **Render**, **Railway**, hoặc **Fly.io** (không chạy game server trên Vercel Serverless).

## Tóm tắt

| Thành phần | Nơi deploy | URL ví dụ |
|------------|------------|-----------|
| Client (Vite) | **Vercel** | `https://your-game.vercel.app` |
| Server (Socket.io) | **Render** | `https://bto-server.onrender.com` |

## 1. Deploy server (Render)

Chi tiết từng bước: **[render-deploy.txt](./render-deploy.txt)**

### Cách nhanh (Root Directory = `packages/server`)

| Mục | Giá trị |
|-----|---------|
| Build Command | `cd ../.. && npm install && npm run build -w @bto/shared && npm run build -w @bto/server` |
| Start Command | `npm start` |
| Health Check | `/health` |
| `CORS_ORIGIN` | `https://<user>.github.io` (và localhost nếu test) |

> Chỉ `npm install` trong `packages/server` **không đủ** — server cần package `@bto/shared` đã build.

### Monorepo root (để trống Root Directory)

- Build: `npm install && npm run build -w @bto/shared && npm run build -w @bto/server`
- Start: `npm run start -w @bto/server`
- Hoặc Blueprint: `render.yaml` ở root hoặc `packages/server/render.yaml`

Kiểm tra: `https://YOUR-SERVICE.onrender.com/health` → `{"ok":true,"service":"bto-server"}`

## 2. Deploy client (Vercel)

1. [Vercel](https://vercel.com) → **Import** repo.
2. Framework: **Other** (đã có `vercel.json` ở root).
3. **Environment Variables** (Production):

   | Biến | Giá trị |
   |--------|---------|
   | `VITE_SOCKET_URL` | `https://YOUR-SERVICE.onrender.com` (không dấu `/` cuối) |

4. Deploy. Trang chủ: `https://your-game.vercel.app/`.

## 3. Chơi với bạn bè

1. Vào trang chủ → **Tạo phòng (Host)** → copy **mã phòng** hoặc **link mời**.
2. Bạn bè mở cùng trang Vercel → **nhập mã** → **Tham gia** (hoặc mở link).
3. Khi đủ 2 người, overlay “Chờ trận” biến mất → gửi quân từ dock **GỬI QUÂN**.

## Dev local (một máy)

```bash
npm install
npm run dev:server   # :3001
npm run dev            # :8080 — proxy /socket.io
```

Không cần `VITE_SOCKET_URL` khi dev (client dùng cùng origin + proxy Vite).

## Lưu ý Render free

- Service có thể **ngủ** sau vài phút không ai chơi — lần kết nối đầu có thể chậm ~30s.
- Nếu cần 24/7, nâng plan hoặc dùng Railway/Fly.

## Khắc phục

| Triệu chứng | Cách xử lý |
|-------------|------------|
| “Không kết nối được máy chủ” | Kiểm tra `VITE_SOCKET_URL`, server `/health`, `CORS_ORIGIN` trùng domain Vercel |
| Chờ mãi không bắt đầu | Cần đúng 2 tab/người cùng mã phòng; host và guest đều vào `game.html?mode=online&room=...` |
| Chỉ chơi một mình, không cần mạng | Dùng **Chiến đấu với AI** |
