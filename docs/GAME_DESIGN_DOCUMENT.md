# BATTLE TOWERS ONLINE — Game Design Document

**Version:** 1.0  
**Genre:** Real-time competitive 1v1 PvP tower defense  
**Platform:** Modern browsers (desktop + mobile)  
**Engine:** Phaser 3 + Node.js + Socket.io  
**Design system:** Kinetic Ether (`UI/*/DESIGN.md`)

---

## 1. Vision & Pillars

### 1.1 Elevator Pitch
Two commanders defend mirrored battlefields with fixed tower slots while sending waves of units to pressure the opponent’s economy and base HP. Victory comes from macro (income sends), micro (spell timing), and counter-building—not from one dominant strategy.

### 1.2 Design Pillars
| Pillar | Meaning |
|--------|---------|
| **Readable combat** | Damage types, armor, and movement are visible at a glance |
| **Double economy tension** | Gold (active) vs Income (passive snowball) |
| **Counter depth** | Every tower and unit has a counter; no hard counters without outs |
| **Event-driven netcode** | Clients simulate; server validates intent |
| **Esports clarity** | Split HUD, mono stats, cyan/amber team identity |

### 1.3 Inspirations
- **Legion TD** — send income, defend lanes, PvP pressure
- **Bloons TD Battles** — real-time sends, readable counters
- **Clash Royale** — pacing spikes, spell windows
- **RTS** — scouting opponent board, adaptation

### 1.4 Non-Goals (v1)
- Hard anti-cheat (F12 sandbox allowed)
- Heavy 3D or >10MB initial load
- Full 2v2 / replay (documented as Phase 3+)

---

## 2. Core Gameplay Loop

```
┌─────────────────────────────────────────────────────────────────┐
│  MATCH START → starting gold + base income tick                 │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  ECONOMY LOOP (every ~10s)                                      │
│  • Passive INCOME tick                                          │
│  • Spend GOLD: build / upgrade / repair                         │
│  • Spend GOLD: SEND enemies → boosts permanent income           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  DEFENSE LOOP (continuous)                                      │
│  • Enemies path on lanes → leak = base damage                   │
│  • Towers on fixed slots target by rules                        │
│  • Kills grant GOLD bounty                                        │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  ADAPTATION LOOP                                                │
│  • Scout opponent board (right pane)                            │
│  • Branch upgrades at max tower level                           │
│  • Cast global spells on cooldown                               │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
              Base HP = 0  →  DEFEAT  |  Opponent HP = 0 → VICTORY
```

**Session length target:** 8–14 minutes (ranked), 5–8 minutes (casual).

---

## 3. Screen Layout & UX Flow

### 3.1 Split-Screen PvP (reference: `UI/chiendau/code.html`)

| Zone | Content |
|------|---------|
| **Left 50%** | Player battlefield (Phaser canvas), cyan accent |
| **Right 50%** | Opponent battlefield (read-only mirror), amber accent, slight desaturation |
| **Center spine** | Wave timer, match clock, optional latency badge |
| **Left dock (desktop)** | Tower deploy tabs, upgrade panel, enemy send list |
| **Top HUD (per side)** | Base HP, Gold, Income rate |
| **Bottom center** | Global spell bar + cooldown overlays |

### 3.2 App Flow

```
Home (UI/trangchu) → Mode select
  ├─ Casual PvP → Matchmaking (UI/timdoithu) → Battle (client/game)
  ├─ Ranked PvP → Matchmaking (MMR) → Battle
  ├─ AI Practice → Skirmish (local sim + bot sends)
  └─ Sandbox → Full cheats, solo board
```

### 3.3 Wireframe (ASCII)

```
┌──────────────────────────────────────────────────────────────────┐
│ NETH-STRIKE COMMAND                    [wallet][income][hp icons] │
├───┬──────────────────────────────────────────────┬───────────────┤
│ D │  PLAYER HP ████████    Gold 1240  Inc +150   │  (opponent)   │
│ E │  ┌─────────────────────────────────────┐   │               │
│ P │  │  ● slots   ═══ path ═══>  BASE      │   │  mirror view  │
│ L │  │     towers    enemies               │   │  amber HUD    │
│ O │  └─────────────────────────────────────┘   │               │
│ Y │         [EMP][Shield][Nuke]                │               │
├───┴──────────────────│ WAVE 5  0:45 │─────────┴───────────────┤
│     ENEMY SENDS: Scout Tank Fly Support                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Fixed Slot Tower System

### 4.1 Rules
- Each map defines **slot nodes** (id, x, y, lane affinity, size).
- Empty slot: click → tower picker → deduct gold → spawn tower entity.
- **Max base level:** 3. At level 3, player picks **one branch** (permanent).
- Selling returns 60% of total gold invested (ranked); 100% in sandbox.

### 4.2 Tower Roster (summary — full stats in `BALANCE_REFERENCE.md`)

| Tower | Role | Damage type | Targets |
|-------|------|-------------|---------|
| **Mortar** | AoE splash | Explosive | Ground, slow |
| **Machine Gun** | Single-target DPS | Ballistic | Ground; branch → air |
| **Laser** | Ramp beam | Energy | Ground + Air |
| **Barracks** | Spawns blockers | — | Stall / body-block |

### 4.3 Branching Example — Machine Gun L3
- **AA Spec:** +range vs air, can target flying
- **AP Spec:** +50% vs Heavy armor, −10% vs Light

### 4.4 Targeting Priority (default)
Flying (in range) → Support → Scout → Standard → Tanker → nearest on path

---

## 5. Double Economy System

### 5.1 Resources

| Resource | Source | Uses |
|----------|--------|------|
| **GOLD** | Kill bounties, round bonuses | Build, upgrade, repair, send enemies |
| **INCOME** | Passive tick every `T_income` seconds | Adds gold each tick (not stored separately) |

### 5.2 Formulas

**Income tick payout:**
```
gold_gain_tick = floor(income_rate * (1 + talent_income_bonus))
```

**Income rate after sends:**
```
income_rate = base_income + sum(send_tier_contribution)
```

Each enemy send tier adds permanent income (see balance doc). Sending is the primary snowball lever.

**Kill bounty:**
```
gold_bounty = enemy.bounty * (1 + talent_bounty_bonus)
```

**Repair base (per HP):**
```
repair_cost = 5 * hp_missing  (gold)
```

### 5.3 Starting Values (Ranked default)
- Gold: `400`
- Income rate: `12` per 10s
- Base HP: `20` (1 leak damage = 1 HP by default; tank leaks can be 2)

---

## 6. Enemy Sending System

### 6.1 Send Flow
1. Player selects unit in dock → pays `send_cost` gold.
2. Server emits `spawn` event with `unitId`, `lane`, `matchTime`.
3. Unit appears on **opponent’s** path after `travel_delay` (0.5s telegraph).
4. Sender’s `income_rate` increases by unit’s `income_boost`.

### 6.2 Unit Roles

| Unit | Speed | Armor | Movement | Countered by |
|------|-------|-------|----------|--------------|
| **Scout** | Very high | Light | Ground | MG, Laser |
| **Tanker** | Low | Heavy | Ground | Laser ramp, AP MG |
| **Flying** | Medium | Light | Air path | AA branch, Laser |
| **Support** | Low | None | Ground | Focus fire, AoE |

**Support aura:** +15% max HP and +10% speed to allies in 80px radius.

### 6.3 Send Economy Risk
Aggressive sends increase future ticks but spend current gold—opponent may punish with spell or tower spike during your low-gold window.

---

## 7. Counter System (Rock-Paper-Scissors)

### 7.1 Damage vs Armor Matrix

|  | Light | Heavy | Shielded |
|--|-------|-------|----------|
| **Ballistic** | 100% | 70% | 50% |
| **Explosive** | 80% | 100% | 90% |
| **Energy** | 100% | 85% | 120% |

### 7.2 Movement Tags
- **Ground** — follows waypoint path
- **Air** — beeline to base; ignores ground blockers
- **Phasing** (map-specific) — ignores barracks block

### 7.3 Design Rule
If a player commits to 4 Mortars, opponent sends Scouts + Flying. If MG spam, opponent sends Tankers. Support punishes single-target without AoE.

---

## 8. Global Spells

| Spell | Effect | CD | Cost |
|-------|--------|-----|------|
| **Cryo Field** | −60% speed 4s in radius | 45s | 0 |
| **EMP** | Disable towers 3s in zone | 60s | 0 |
| **Orbital Strike** | 200 dmg AoE | 90s | 50 gold |
| **Overclock** | +30% tower ROF 6s | 50s | 0 |
| **Repair Pulse** | +3 base HP (cap max) | 70s | 0 |

Spells are **intent events**; VFX plays client-side. Server stores cooldown timestamps per player.

---

## 9. Map System

### 9.1 Map JSON Schema
See `packages/shared/maps/neon_grid.json` — includes `paths`, `slots`, `modifiers`.

### 9.2 Launch Maps

| Map | Mechanic | Unlock |
|-----|----------|--------|
| **Neon Grid** | Standard dual-lane | Default |
| **Dust Veil** | −20% vision range (fog) | Rank Bronze |
| **Magma Flow** | Lane tiles deal 2 DPS | Rank Silver |
| **Shift Corridor** | Path rotates every 90s | Rank Gold |
| **Twin Rift** | Teleport gates swap lanes | Rank Platinum |

### 9.3 Rank & Mode Gating
- Casual: all owned maps in rotation vote
- Ranked: map pool by average MMR tier
- Sandbox: any map, modifier sliders

---

## 10. Progression & Talents

### 10.1 Account XP
- Match completion: `50 + performance_bonus`
- Win: `+30`; S-rank (no leaks 5 min): `+20`

### 10.2 Talent Points
1 point per level (cap 50). Respec free in sandbox only.

### 10.3 Talent Tree (examples)

| Branch | Tier 1 | Tier 2 | Tier 3 |
|--------|--------|--------|--------|
| **Economy** | −5% tower cost | +5% income growth | +10% send income boost |
| **Fortress** | +1 base HP | −10% repair cost | +5% tower HP |
| **Warfare** | −5% spell CD | +5% spell radius | +5% unit send speed |

**Storage v1:** `localStorage` key `bto_profile_v1`  
**Storage v2:** MongoDB `players` collection (optional)

---

## 11. Game Modes

| Mode | Matchmaking | Notes |
|------|-------------|-------|
| **Casual PvP** | Quick queue, no MMR loss | Map vote |
| **Ranked PvP** | MMR ± K=32 | Seasonal reset |
| **AI Practice** | Instant | Bot sends on timer script |
| **Sandbox** | Solo | Infinite gold toggle |

**Future:** 2v2 shared income, spectator websocket channel, replay from event log.

---

## 12. Game Feel (Juice)

| Effect | Trigger |
|--------|---------|
| Screen shake | Mortar impact, base hit |
| Damage numbers | On hit (pooled text) |
| Impact flash | Crit / explosive |
| Laser beam | Line renderer + bloom |
| Particles | Death, upgrade |
| UI tick sound | Gold/income change |
| Flicker stat | Large gold swing |

Keep particle counts `< 80` active mobile.

---

## 13. AI Practice Bot

**States:** `ECON_BUILD` → `SCOUT_PLAYER` → `COUNTER_SEND` → `SPELL_WINDOW`

- Reads opponent tower composition every 15s
- Sends counter unit mix (see §7)
- Difficulty scales send frequency and spell accuracy

---

## 14. Development Roadmap

### Phase 1 — Offline Prototype ✅ (in progress)
- [x] Map paths + slots rendering
- [x] Tower placement + targeting
- [x] Enemy pathing + leaks
- [x] Gold + income tick
- [ ] Branch upgrades UI
- [ ] All four tower types

### Phase 2 — Online PvP
- Socket.io rooms, matchmaking
- Event sync for spawns/builds/spells
- Split-screen dual canvas

### Phase 3 — Polish
- VFX/SFX pass, balance telemetry
- Ranked seasons, talents, extra maps

---

## 15. Success Metrics

- **TTFF** (time to first frame): < 3s on 4G
- **Bundle** (gzip): client < 2MB excluding Phaser CDN
- **Tick rate:** simulation 60 FPS render; net events ~10–20/s peak
- **Retention proxy:** rematch rate > 40% casual

---

## 16. Related Documents

- `docs/TECHNICAL_ARCHITECTURE.md` — networking, folders, anti-cheat philosophy
- `docs/BALANCE_REFERENCE.md` — numeric tables
- `UI/*/DESIGN.md` — Kinetic Ether visual spec
