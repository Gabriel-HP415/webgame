# BATTLE TOWERS ONLINE — Technical Architecture

## 1. Stack Overview

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| **Game sim** | Phaser 3.80+ | Rendering, pathing, combat, VFX |
| **UI shell** | HTML + Tailwind (from `UI/`) | Menus, lobby, HUD chrome |
| **Menus (optional)** | React 18 | Lobby/settings if complexity grows |
| **Realtime** | Node 20 + Socket.io 4 | Rooms, matchmaking, event authority |
| **Shared** | TypeScript | Balance constants, map schema, event types |
| **Persistence** | localStorage → MongoDB later | Profile, MMR, talents |

---

## 2. Repository Structure

```
webgame/
├── docs/                    # GDD, architecture, balance
├── UI/                      # Static HTML mockups (Kinetic Ether)
│   ├── trangchu/            # Home
│   ├── timdoithu/           # Matchmaking
│   └── chiendau/            # Battle HUD reference
├── packages/
│   ├── shared/              # Types, balance, map JSON
│   ├── client/              # Phaser + Vite game
│   └── server/              # Socket.io authoritative server
└── package.json             # npm workspaces root
```

---

## 3. Client Architecture

### 3.1 Scene Graph

```
BootScene          → load minimal assets, fonts
MenuScene          → bridge to UI/trangchu (or embedded)
GameScene          → dual BoardController (player + opponent view)
UIScene (overlay)  → Phaser DOM Element OR HTML HUD on top
```

### 3.2 BoardController (per player field)

- **PathSystem** — waypoint following, progress `t ∈ [0,1]`
- **SlotSystem** — occupancy, build/upgrade/sell
- **TowerSystem** — targeting, firing, projectiles
- **EnemySystem** — spawn queue, aura, death bounty
- **EconomySystem** — gold, income timer
- **VFXSystem** — pooled particles, damage text

### 3.3 Deterministic Simulation

All gameplay randomness uses **seeded RNG** from server `matchSeed`:

```ts
rng = mulberry32(matchSeed + eventIndex)
```

Clients apply events in strict `seq` order. If local hash diverges (debug), soft resync from `state_snapshot` every 30s (Phase 2).

---

## 4. Event-Driven Networking Model

### 4.1 Principles
- **Never** stream transforms at 60Hz
- **Do** stream intent + timestamps
- Clients **predict** local builds; server confirms or rolls back (ranked only)

### 4.2 Event Envelope

```ts
interface GameEvent {
  seq: number;           // monotonic per match
  t: number;             // match time ms (server clock)
  playerId: string;
  type: GameEventType;
  payload: unknown;
}
```

### 4.3 Event Types

| Type | Payload | Authority |
|------|---------|-----------|
| `match.start` | `{ seed, mapId, players }` | Server |
| `tower.build` | `{ slotId, towerId }` | Server validates gold |
| `tower.upgrade` | `{ slotId, branch? }` | Server |
| `tower.sell` | `{ slotId }` | Server |
| `enemy.send` | `{ unitId, lane }` | Server |
| `enemy.spawn` | `{ unitId, lane, ownerId, t }` | Server schedules |
| `spell.cast` | `{ spellId, x, y }` | Server |
| `base.damage` | `{ playerId, amount }` | Server |
| `match.end` | `{ winnerId, stats }` | Server |

### 4.4 Example Flow — Send Tank

```
Client A                Server                  Client B
   |-- enemy.send ----->|                       |
   |                    | validate gold         |
   |                    | income_rate += boost  |
   |<--- event seq -----|---- relay ----------->|
   |                    |                       | spawn on B's board
   |                    |                       | sim path locally
```

### 4.5 Bandwidth Budget
- Average: **2–8 KB/s** per client
- Peak (spam sends): **15 KB/s** cap with server rate limit (max 3 sends / 2s)

---

## 5. Server Architecture

### 5.1 Modules

```
server/
├── index.ts              # HTTP + Socket.io bootstrap
├── match/MatchRoom.ts    # State machine per room
├── match/Matchmaker.ts   # Queue, MMR pairing
├── sim/CommandProcessor.ts
├── sim/EconomyValidator.ts
├── db/PlayerStore.ts     # optional persistence
└── types.ts              # imports from @bto/shared
```

### 5.2 Match Room State Machine

```
WAITING → LOADING → RUNNING → ENDED
```

- **WAITING:** 2 players or vs AI flag
- **LOADING:** clients ack `ready` with asset hash
- **RUNNING:** process events, emit ticks for income every 10s
- **ENDED:** persist stats, release room after 60s

### 5.3 Matchmaking Flow

```
join_queue { mode, mmr, mapVotes[] }
  → bucket by mode
  → pairwise | MMR ± 150 within 30s widening to 300
  → create room, emit match.found { roomId, token }
  → both connect room namespace
  → ready check → match.start
```

**AI Practice:** server runs `BotBrain` in same room with `playerId: 'bot'`.

---

## 6. Anti-Cheat Philosophy

Personal / learning project:
- Server is **authoritative** for gold, HP, cooldowns
- Client tampering (F12) allowed for sandbox experiments
- Ranked: server rejects impossible commands; no kernel-level AC
- Optional `debug.allowClientAuthority` flag for local dev

---

## 7. Optimization Strategy

### 7.1 Rendering
- **Single atlas** for towers/units (procedural placeholders in Phase 1)
- Object pooling for enemies, bullets, damage text
- `camera.setRenderToTexture` only for minimap
- Mobile: `pixelArt: true`, reduce particle cap, 30 FPS fallback

### 7.2 Loading
- Phaser from CDN in dev; bundle in prod
- Lazy-load map JSON per match
- Target **< 10MB** total assets Phase 3

### 7.3 Pathfinding
- **Fixed paths** only (no dynamic A* in combat hot path)
- Waypoint lists precomputed per map/lane

### 7.4 Network
- Binary optional later (`msgpack`) — JSON fine for v1
- Aggregate income ticks; don't send per-kill gold to opponent (only totals in HUD if desired)

---

## 8. Frontend Integration with UI Mockups

| Screen | Source | Integration |
|--------|--------|-------------|
| Home | `UI/trangchu/code.html` | Link "Play" → `/game` |
| Queue | `UI/timdoithu/code.html` | Socket `join_queue` |
| Battle | `packages/client/index.html` | Embeds dual Phaser canvases in left/right panes matching `UI/chiendau` layout |

Design tokens copied to `client/src/styles/tokens.css` from Kinetic Ether YAML.

---

## 9. Database Schema (Phase 2+)

```js
// players
{
  _id, username, mmr, xp, level,
  talents: { economy_t1: 2, ... },
  unlockedMaps: ['neon_grid', ...],
  stats: { wins, losses }
}

// matches (optional analytics)
{
  _id, players[], mapId, eventLog[], winnerId, duration, createdAt
}
```

---

## 10. Deployment Sketch

| Service | Host example |
|---------|--------------|
| Static client | Vercel / Cloudflare Pages |
| Game server | Fly.io / Railway (WebSocket support) |
| DB | MongoDB Atlas free tier |

**Env vars:** `PORT`, `MONGO_URI`, `CORS_ORIGIN`, `JWT_SECRET` (if accounts)

---

## 11. Testing Strategy

- **Unit:** economy formulas, damage matrix (`shared/tests`)
- **Integration:** two headless clients against server in CI
- **Soak:** 1000 spawn events, assert seq monotonic
- **Playtest:** balance spreadsheet + `/sandbox` mode

---

## 12. Security Notes (lightweight)

- Rate-limit socket events per IP
- Validate all coordinates within map bounds
- Room tokens signed JWT (short TTL) on `match.found`
- No secrets in client bundle
