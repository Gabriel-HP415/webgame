# Host trên GitHub Pages

## Bật Pages (một lần)

1. Repo GitHub → **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions**
3. Push lên nhánh `main` → workflow **Deploy to GitHub Pages** chạy tự động

Game sẽ ở: `https://<username>.github.io/<tên-repo>/`  
(ví dụ: `https://gabriel-hp415.github.io/webgame/`)

## Chế độ chơi

| Chế độ | GitHub Pages |
|--------|----------------|
| **AI** | Hoạt động (không cần server) |
| **PvP luyện (2 bàn)** | Hoạt động (một máy, hai tab) |
| **Online 2 người** | Cần server Socket riêng (xem bên dưới) |

## Online với bạn bè (tùy chọn)

GitHub Pages **không** chạy Socket.io. Thêm server miễn phí (Render) rồi:

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. New secret: `VITE_SOCKET_URL` = `https://your-app.onrender.com`
3. Push lại `main` để build lại

Chi tiết server: [DEPLOY_ONLINE.md](./DEPLOY_ONLINE.md)

## Sửa lỗi build CI

Workflow cũ `webpack.yml` đã xóa (project dùng **Vite**, không Webpack).  
Workflow mới: `.github/workflows/deploy-pages.yml`
