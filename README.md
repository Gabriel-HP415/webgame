# Battle Towers Online

Real-time competitive **1v1 PvP tower defense** for the browser. Two commanders build on fixed slots, send counter-units, and snowball **Gold** + **Income** until one base falls.

## Documentation

| Doc | Description |
|-----|-------------|
| [Game Design Document](docs/GAME_DESIGN_DOCUMENT.md) | Vision, loops, systems, roadmap |
| [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md) | Networking, folders, optimization |
| [Balance Reference](docs/BALANCE_REFERENCE.md) | Towers, units, formulas |
| [Matchmaking Flow](docs/MATCHMAKING_AND_FLOW.md) | Queues, states, UI mapping |

## Phase 1 Prototype (Playable)

**Neon Grid** map with real paths, tower slots, economy ticks, tower combat, and AI waves.

### Một cổng **8080** (khuyến nghị)

| Môi trường | Cách chạy | Trình duyệt |
|------------|-----------|--------------|
| **Docker** | `docker compose up --build -d` | Chỉ mở **http://localhost:8080** — trang chủ, game, mockup `/ui/...`, API **`/api/...`**, Socket.io **`/socket.io/`** đều qua nginx. Server Node **không** mở cổng ra máy host. |
| **Dev local** | Terminal 1: `npm run dev:server` · Terminal 2: `npm run dev` | **http://127.0.0.1:8080/** — Vite proxy `/api` và `/socket.io` → `127.0.0.1:3001`. |

```bash
npm install
npm run dev:server   # cổng 3001 nội bộ
npm run dev        # cổng 8080 — mở trình duyệt tại đây
```

| Trang | URL (dev & Docker) |
|--------|---------------------|
| **Trang chủ** | http://127.0.0.1:8080/ |
| **Chiến đấu với AI** | http://127.0.0.1:8080/game.html?mode=ai |
| **Luyện PvP** | http://127.0.0.1:8080/game.html?mode=pvp |
| **Health API (qua proxy)** | http://127.0.0.1:8080/api/health |
| **Mockup UI (Docker)** | http://127.0.0.1:8080/ui/trangchu/code.html |

Trong **dev** không có nginx: thư mục mockup HTML gốc vẫn là `UI/` trong repo. **`UI/chiendau/code.html` chỉ là giao diện tĩnh** (div không gắn game); để chơi thật dùng **`/game.html`** sau khi chạy `npm run dev` hoặc Docker.

### Không mở được trang (Simple Browser / Cursor)

1. **Phải chạy dev server** (`npm run dev`); nếu dùng API/Socket: chạy thêm `npm run dev:server`.
2. Thử **`http://127.0.0.1:8080`** thay vì `localhost`.
3. Tab Browser nhúng trong IDE đôi khi không nối được máy local — dùng **Chrome/Edge**.
4. Trang **game** trắng: F12 → Console; Vite đã cấu hình đọc `packages/shared`.

- Chọn tháp ở dock trái → click slot trống → chuột phải để bán  
- **AI:** không có nút gửi quân; đợt quân tấn công định kỳ  
- **PvP luyện:** gửi quân tốn vàng, sinh quân trên bàn đối thủ; AI vẫn tấn công bàn của bạn  

Tên hiển thị (trang chủ) lưu `localStorage`, gắn `?name=` khi vào trận.

## Project Structure

```
packages/shared   # Balance data, map JSON, event types
packages/client   # Phaser 3 + Vite (split-screen battle)
packages/server   # Socket.io stub (Phase 2)
docs/             # GDD & architecture
UI/               # HTML/CSS mockups
```

## Chơi Online (Vercel + bạn bè)

- Trang chủ → **Tạo phòng** / **Tham gia** (mã 6 ký tự).
- **Client** deploy **Vercel**; **server Socket.io** deploy **Render** (miễn phí).
- Chi tiết: [docs/DEPLOY_ONLINE.md](docs/DEPLOY_ONLINE.md)

## Roadmap

1. **Phase 1** — Offline sim (current): slots, pathing, economy, basic combat
2. **Phase 2** — Online PvP: phòng 2 người, sync gửi quân (đang có); thêm đồng bộ tháp / kết thúc trận
3. **Phase 3** — VFX/SFX, talents, ranked, extra maps

## Tech Stack

- **Phaser 3** — 2D battlefield
- **Vite** — client bundler
- **Node + Socket.io** — multiplayer (stub in `packages/server`)
- **TypeScript** — shared types across client/server

## Docker

```bash
cp .env.example .env
docker compose up --build -d
```

Chỉ cần **một cổng trên máy**: **8080** (biến `CLIENT_PORT` trong `.env`). Game, mockup `/ui/`, **`/api/*`**, **`/socket.io/`** đều qua container **client** (nginx) → **server** chỉ trong mạng Docker.

| Đường dẫn | Ý nghĩa |
|-----------|---------|
| http://localhost:8080/ | Trang chủ |
| http://localhost:8080/game.html?mode=ai | Chế độ AI |
| http://localhost:8080/api/health | Health server (proxy) |
| ws://localhost:8080/socket.io/ | Socket.io qua nginx |

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

Biến `.env`: **`CLIENT_PORT`** (mặc định 8080), **`CORS_ORIGIN`** (mặc định gồm `http://localhost:8080` và `http://127.0.0.1:8080`).

## License

Personal / learning project — playful sandbox; no hard anti-cheat.
