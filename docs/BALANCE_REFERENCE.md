# BATTLE TOWERS ONLINE — Balance Reference

All values are **v1 targets** for playtesting. Tune via `packages/shared/src/balance.ts`.

---

## 1. Economy Constants

| Constant | Value |
|----------|-------|
| `STARTING_GOLD` | 400 |
| `STARTING_INCOME` | 12 / 10s |
| `INCOME_TICK_MS` | 10000 |
| `SELL_REFUND_RATE` | 0.6 |
| `BASE_HP` | 20 |
| `LEAK_DAMAGE_DEFAULT` | 1 |

### Send Income Boost (permanent per send)

| Unit | Send Cost | Income +/10s |
|------|-----------|----------------|
| Scout | 80 | +2 |
| Tanker | 140 | +4 |
| Flying | 120 | +3 |
| Support | 100 | +3 |

### Kill Bounties

| Unit | Bounty |
|------|--------|
| Scout | 12 |
| Tanker | 28 |
| Flying | 18 |
| Support | 22 |

---

## 2. Towers

### 2.1 Build / Upgrade Costs

| Tower | Build | L2 | L3 | Branch |
|-------|-------|----|----|--------|
| Mortar | 120 | 80 | 120 | 100 |
| Machine Gun | 100 | 70 | 100 | 100 |
| Laser | 150 | 100 | 150 | 120 |
| Barracks | 110 | 75 | 110 | 90 |

### 2.2 Base Stats (Level 1)

| Tower | DPS | Range | ROF/s | Special |
|-------|-----|-------|-------|---------|
| Mortar | 18 (AoE r=48) | 160 | 0.5 | Splash |
| Machine Gun | 22 | 140 | 4.0 | Single |
| Laser | 8→40 ramp | 180 | continuous | +4 dmg/stack, max 5 |
| Barracks | — | — | — | Spawns 2 robots 60 HP |

### 2.3 Level Scaling (+ per level)

| Tower | Damage | Range |
|-------|--------|-------|
| Mortar | +15% | +8% |
| Machine Gun | +12% | +5% |
| Laser | +10% ramp cap | +6% |
| Barracks | +1 robot | +10% robot HP |

### 2.4 Branches (L3 → choose one)

**Mortar**
- *Cluster:* +30% splash radius
- *Siege:* +35% damage vs Heavy

**Machine Gun**
- *Anti-Air:* can target air, +25% vs air
- *AP Rounds:* +50% vs Heavy, −10% vs Light

**Laser**
- *Overcharge:* max stacks 8
- *Pulse:* every 5s releases 100 AoE burst

**Barracks**
- *Shieldbots:* robots gain 20 shield HP
- *Stun Field:* robots slow 20% on hit

---

## 3. Enemies

| Unit | HP | Speed px/s | Armor | Air | Leak |
|------|-----|------------|-------|-----|------|
| Scout | 45 | 95 | Light | No | 1 |
| Tanker | 220 | 42 | Heavy | No | 2 |
| Flying | 80 | 70 | Light | Yes | 1 |
| Support | 90 | 50 | None | No | 1 |

---

## 4. Damage Matrix

```ts
// multiplier[damageType][armorType]
BALLISTIC:  { light: 1.0, heavy: 0.7, shielded: 0.5 }
EXPLOSIVE:  { light: 0.8, heavy: 1.0, shielded: 0.9 }
ENERGY:     { light: 1.0, heavy: 0.85, shielded: 1.2 }
```

---

## 5. Global Spells

| ID | CD (s) | Gold | Effect |
|----|--------|------|--------|
| cryo | 45 | 0 | 60% slow, 4s, r=120 |
| emp | 60 | 0 | disable towers 3s, r=100 |
| orbital | 90 | 50 | 200 dmg, r=80 |
| overclock | 50 | 0 | +30% ROF, 6s global |
| repair | 70 | 0 | +3 base HP |

---

## 6. MMR & Ranked

- Start MMR: **1000**
- K-factor: **32**
- Tiers: Bronze <900, Silver 900–1099, Gold 1100–1299, Platinum 1300+

---

## 7. Talent Modifiers (per point, max 5 per node)

| Node | Effect per rank |
|------|-----------------|
| tower_discount | −1% build cost |
| base_hp | +0.2 max HP (display rounds up) |
| income_growth | +1% income tick |
| spell_haste | −2% spell CD |

---

## 8. Map Modifiers

| Map ID | Modifier |
|--------|----------|
| neon_grid | none |
| dust_veil | tower range ×0.8 |
| magma_flow | enemies on hazard tiles −2 HP/s |
| shift_corridor | path index swaps every 90s |
| twin_rift | teleport at wp index 4 |
