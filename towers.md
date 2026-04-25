# Firestorm — Tower Roster (MVP)

Single damage type — no resistance matrix. Tower differentiation comes from behavior and status effects.

All numbers below are **first-pass starting values**. Every effect parameter (slow %, splash ratio, poison curve, durations, etc.) is intended to live in YAML so balance can iterate without code changes.

## Cross-cutting rules

- **Projectile speed:** reserved as a `projectileSpeed` field on every tower in YAML, but **not implemented in the sim yet**. All towers behave as if damage applies on fire. Field exists to avoid a future schema migration when per-tower travel time is added.
- **Movement debuff stacking:** a creep can only have one active movement debuff — the **strongest wins**. This applies both within Slow towers and across Slow + Freeze.
- **Status effects in general:** re-application by another tower of the same type **refreshes** (resets duration / decay), it does **not stack** the magnitude.

---

## 1. Archer — basic single-target DPS

The starter tower. Cheap, reliable, balanced.

- **Role:** Round-1 viable, stays useful as cheap filler. The DPS-per-cash king on single targets.
- **Cost:** ~100
- **Damage:** 5 per shot
- **Fire rate:** 2/s (10 DPS)
- **Range:** medium-short
- **Effects:** none
- **Fiction:** crossbow / watchtower archer / auto-gun (fantasy-military mix)

## 2. Sniper — heavy single-target DPS

Slow, expensive, hits hard. Anti-boss / anti-armored-singleton.

- **Role:** Mid-to-late single-target answer. Pairs with Poison for boss-killing.
- **Cost:** ~600
- **Damage:** 150 per shot
- **Fire rate:** 0.5/s (75 DPS)
- **Range:** very long / global
- **Effects:** none
- **Fiction:** longbow / sharpshooter / aimed-bolt mage

## 3. Mortar — radial AoE / splash

Arcing-style cannonball. Direct hit + splash to nearby creeps.

- **Role:** Mid-tier anti-cluster / anti-swarm. Synergizes with Slow and Freeze (bunched creeps → bigger splash value).
- **Cost:** ~275
- **Direct damage:** 20 (full to primary target)
- **Splash damage:** 25% of direct damage to all other creeps in radius (`splashRatio: 0.25` in YAML)
- **Splash radius:** ~80px
- **Fire rate:** 0.7/s
- **Range:** medium
- **Aim:** predictive — damage applies to target and splash on fire (no travel time in sim, despite reserved `projectileSpeed`)
- **Fiction:** mortar / cannon / fireball mage

## 4. Slow (Frost / Snare) — movement debuff

Pure utility tower. Token damage, big strategic value.

- **Role:** Force multiplier — slows creeps so other towers get more shots in, bunches creeps for Mortar splash.
- **Cost:** ~200
- **Damage:** 1 per hit (token, configurable)
- **Slow:** -35% movement speed (configurable)
- **Slow duration:** 2s, refreshed on every hit
- **Fire rate:** 1.5/s
- **Range:** short
- **Stacking:** multiple Slow towers do **not** stack the %; they refresh duration. Strongest debuff wins (Freeze overrides Slow).
- **Fiction:** frost mage / cryo emitter / tar-pit launcher

## 5. Poison (Plague / Toxin) — damage-over-time

Fire-and-forget DoT. Front-loaded but lingers.

- **Role:** Anti-tank / sustained damage. Pairs with Sniper for boss-killing.
- **Cost:** ~250
- **Impact damage:** 1
- **Poison DoT:**
  - 1s tick cadence
  - Flat **10 dmg/tick for 5 ticks** (5s)
  - Then linear decay: **8 → 6 → 4 → 2 → 0** over the next 5 ticks (5s)
  - Total duration: 10s. Total damage if uninterrupted: **80**.
  - Re-application by any Poison tower resets the curve to t=0 (full damage). **No magnitude stacking** between towers.
- **Fire rate:** 1/s
- **Range:** medium
- **Fiction:** plague mage / toxic dart launcher / chemical mortar

## 6. Freeze (Cryomancer / Blizzard) — AoE hard CC

The panic button. Big rhythmic moments.

- **Role:** Screen-clearing crowd control on a long cooldown. Synergizes with Mortar (frozen creeps clump perfectly for splash).
- **Cost:** ~400
- **Damage:** 0 (configurable — leaves room for damage-dealing freeze variants later)
- **Effect:** on fire, applies a **-80% movement slow** to **every creep in range** (AoE)
- **Slow duration:** 2s (configurable)
- **Fire rate:** 0.15/s (one shot every ~6.5s)
- **Range:** medium
- **Stacking:** -80% overrides any weaker movement debuff. Strongest wins.
- **Fiction:** cryomancer / blizzard cannon

---

## Open questions / not yet designed

- **Upgrade trees** for each tower (linear chain at MVP per spec).
- **Creep roster** — armored/swarm/fast/heavy/flying classes; what each tower struggles or excels against.
- Whether Archer should remain late-game-viable via upgrades, or be designed as an explicit "starter you replace."
- Numbers above are starting points only — expect heavy iteration once Plan B sim + a creep roster exist to playtest against.
