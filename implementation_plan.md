# Sửa lỗi game Battle Towers Online

Sau khi đọc toàn bộ codebase, tôi phát hiện **8 bugs** ở nhiều mức độ nghiêm trọng khác nhau. Dự án build & chạy dev server thành công (Vite khởi động OK), nhưng có nhiều lỗi logic, gameplay, và UX runtime.

## Tổng quan các lỗi phát hiện

| # | Mức độ | File | Mô tả |
|---|--------|------|-------|
| 1 | 🔴 Critical | [BoardScene.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardScene.ts#L118-L120) | `bootBoard()` trả về scene **trước khi Phaser khởi tạo xong** → `scene.state` = `undefined` ở dòng 227 `main.ts`, crash ngay lập tức |
| 2 | 🔴 Critical | [BoardScene.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardScene.ts#L152) | Tháp **laser** hardcode luôn bắn được quân bay, bỏ qua điều kiện `targetsAir` trong balance → phá vỡ hệ thống counter |
| 3 | 🟠 Major | [BoardState.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardState.ts#L156) | `applyDamage()` dùng `Math.floor` bên trong nhưng damage raw tính theo `dt` (frame-dependent) → **tháp DPS thay đổi theo FPS** (60fps ≠ 144fps ≠ lag spike) |
| 4 | 🟠 Major | [BoardState.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardState.ts#L171-L173) | Khi quân bị giết, `filter` tìm theo `best!.id` nhưng **nếu cùng frame 2 tháp giết cùng 1 quân** → `bounty` trả 2 lần, quân bị filter 2 lần |
| 5 | 🟠 Major | [main.ts](file:///d:/NHP/webgame/packages/client/src/main.ts#L169-L174) | PvP: `playerScene.trySend` bị monkey-patch nhưng **opponentScene chưa init xong** (same race condition as bug #1) |
| 6 | 🟡 Medium | [BoardScene.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardScene.ts#L64-L71) | Click chuột phải để bán tháp nhưng **trình duyệt hiện context menu** → trải nghiệm xấu |
| 7 | 🟡 Medium | [BoardState.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardState.ts#L63-L70) | Game không có **game-over check** → khi `baseHp = 0`, game vẫn chạy tiếp, quân tiếp tục tấn công, vàng vẫn cộng |
| 8 | 🟡 Medium | [main.ts](file:///d:/NHP/webgame/packages/client/src/main.ts#L190-L198) | AI wave chạy bằng `setInterval` toàn cục → **không dừng khi game over**, cứ spawn quân mãi |

---

## Proposed Changes

### 1. 🔴 Fix race condition: `bootBoard` trả scene trước khi init

#### [MODIFY] [main.ts](file:///d:/NHP/webgame/packages/client/src/main.ts)

**Vấn đề**: `game.scene.getScene(key)` trả về scene object nhưng `init()` + `create()` chưa chạy → `scene.state` = `undefined` → `refreshDockAffordability(playerScene.state)` ở dòng 227 crash.

**Fix**: Thay đổi `bootBoard` thành async, sử dụng event `Phaser.Scenes.Events.CREATE` để đợi scene khởi tạo xong trước khi trả về. Wrap toàn bộ game initialization trong async IIFE.

---

### 2. 🔴 Fix laser hardcode bỏ qua `targetsAir` 

#### [MODIFY] [BoardScene.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardScene.ts)

**Vấn đề** (dòng 152):
```typescript
if (e.flying && !def.targetsAir && tower.towerId !== 'laser') continue;
```
Điều kiện hardcode `tower.towerId !== 'laser'` có nghĩa laser **luôn** bypass check `targetsAir`. Nhưng trong balance data, laser đã có `targetsAir: true` rồi. Nếu sau này thêm tower mới cũng bắn air, code sẽ sai.

**Fix**: Xóa hardcode `tower.towerId !== 'laser'`, chỉ dùng `def.targetsAir`:
```typescript
if (e.flying && !def.targetsAir) continue;
```

---

### 3. 🟠 Fix DPS frame-rate dependent 

#### [MODIFY] [BoardState.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardState.ts)

**Vấn đề**: 
```typescript
const raw = def.baseDamage * dmgMult * def.fireRate * dt * (def.aoeRadius ? 1.2 : 1);
best.hp -= applyDamage(raw, def.damageType, udef.armor);
```
`applyDamage` dùng `Math.floor()`. Khi `dt` nhỏ (FPS cao), `raw` rất nhỏ → `Math.floor` truncate nhiều → **DPS thực tế thấp hơn ở FPS cao**. Ví dụ: machine_gun baseDamage=5.5, fireRate=4, dt=0.0067 (150fps) → raw=0.147 → `floor(0.147)` = **0 damage**!

**Fix**: Tích lũy damage vào accumulator, chỉ apply khi đủ 1+ damage:
- Thêm `damageAccum` vào `TowerInstance`
- Tích lũy raw damage theo dt
- Trừ HP chỉ khi accum >= 1

---

### 4. 🟠 Fix double-kill bounty 

#### [MODIFY] [BoardState.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardState.ts)

**Vấn đề**: Trong `tickCombat`, mỗi tháp loop qua `state.enemies` và filter khi giết. Nhưng nếu tháp A giết quân X → filter xóa X khỏi array → tháp B vẫn có thể tìm thấy X vì loop tháp dùng `for (const [, tower] of state.towers)` và enemies chưa filter ở iteration tháp A (chỉ filter ở `state.enemies = state.enemies.filter(...)` ngay lập tức). Thực tế `state.enemies` được gán lại ngay, nên tháp B sẽ **không** thấy quân đã chết. Tuy nhiên vấn đề là **quân có HP <= 0 nhưng chưa bị remove** vẫn bị tháp tiếp theo bắn thêm (tốn tính toán vô ích).

**Fix**: Kiểm tra `e.hp > 0` trước khi chọn target. Dùng Set để track quân đã chết trong tick.

---

### 5. 🟠 Fix PvP monkey-patch race condition

#### [MODIFY] [main.ts](file:///d:/NHP/webgame/packages/client/src/main.ts)

**Vấn đề**: Ở dòng 174-181, `playerScene.trySend` bị monkey-patch khi `opponentScene` chưa chắc đã init xong. Cùng vấn đề race condition với bug #1.

**Fix**: Gộp vào async flow cùng bug #1.

---

### 6. 🟡 Fix context menu khi right-click bán tháp

#### [MODIFY] [BoardScene.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardScene.ts)

**Vấn đề**: Chuột phải bán tháp → trình duyệt hiện context menu che game.

**Fix**: Thêm `preventDefault` cho event `contextmenu` trên Phaser canvas.

---

### 7. 🟡 Thêm game-over check

#### [MODIFY] [BoardState.ts](file:///d:/NHP/webgame/packages/client/src/game/BoardState.ts)

**Vấn đề**: Khi `baseHp <= 0`, game không dừng. Quân tiếp tục di chuyển, tháp vẫn bắn, vàng vẫn cộng.

**Fix**: 
- Thêm field `gameOver: boolean` vào `BoardState`
- Check đầu `tickEconomy`, `tickEnemies`, `tickCombat`: nếu `gameOver` thì return sớm
- Set `gameOver = true` khi `baseHp <= 0` trong `tickEnemies`
- Hiển thị overlay "GAME OVER" trên canvas

---

### 8. 🟡 Fix AI wave không dừng khi game over

#### [MODIFY] [main.ts](file:///d:/NHP/webgame/packages/client/src/main.ts)

**Vấn đề**: `setInterval(runHostileWave, aiIntervalMs)` chạy mãi, không có điều kiện dừng.

**Fix**: Kiểm tra `playerScene.state.gameOver` trước khi spawn wave. Clear interval khi game kết thúc.

---

## Verification Plan

### Automated Tests
- Chạy `npm run dev` → mở `http://localhost:8080/game.html?mode=ai` trong browser
- Verify: game không crash khi load (fix bug #1)
- Xây tháp laser → verify bắn được quân bay (bug #2 - đã đúng, chỉ clean code)
- Verify: right-click bán tháp, không hiện context menu (bug #6)
- Để quân leak hết HP → verify hiện "GAME OVER" và game dừng (bug #7, #8)
- Test ở FPS khác nhau → verify DPS nhất quán (bug #3)

### Manual Verification
- Chơi thử chế độ AI 2-3 phút
- Chơi thử chế độ PvP, gửi quân qua bàn đối thủ
- Kiểm tra console browser không có lỗi

## Open Questions

> [!IMPORTANT]
> **Game Over UI**: Khi game over, bạn muốn hiển thị gì? Tôi đề xuất: overlay tối + text "GAME OVER" + nút "Chơi lại" quay về trang chủ. Bạn có muốn phong cách khác không?

> [!NOTE]
> **Bug #1 (race condition)** là lỗi nghiêm trọng nhất — có thể khiến game trắng trang ngay khi load. Nếu game hiện tại bạn chơi được bình thường, có thể Phaser init đủ nhanh nên race condition chưa trigger, nhưng trên máy chậm/tab nặng thì sẽ crash.
