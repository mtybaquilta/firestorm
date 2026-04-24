# Plan A — Scaffold + Content Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Firestorm Next.js + TypeScript + Phaser + Supabase scaffold and a working YAML content pipeline (Zod-validated loaders for damage-types, towers, creeps, maps, waves), validated in CI. No game logic yet.

**Architecture:** Next.js 15 App Router on the runtime side, but `src/game/sim/` is reserved for pure-Node simulation code (no Next/React imports — added in Plan B). Content lives as static YAML in `content/` and is loaded through Zod-validated schemas in `src/content-loader/`. A `validate-content` script parses every YAML file and exits non-zero on the first error; CI runs it on every push.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Phaser 3, `@supabase/supabase-js`, `@supabase/ssr`, Zod, Zustand, mitt, js-yaml, Vitest, Prettier, Next's built-in ESLint, GitHub Actions.

**Branch:** `FS-4`. Each commit prefixed `FS-4: `.

---

## File map

**Created in this plan:**

- `package.json`, `tsconfig.json`, `next.config.ts`, `.eslintrc.json` (or `eslint.config.mjs`), `.prettierrc.json`, `.gitignore`, `.env.example`, `vitest.config.ts`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/play/page.tsx` (placeholder)
- `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/types.ts`
- `src/lib/env.ts`
- `src/content-loader/schemas/damage-types.ts`
- `src/content-loader/schemas/tower.ts`
- `src/content-loader/schemas/creep.ts`
- `src/content-loader/schemas/wave.ts`
- `src/content-loader/schemas/map.ts`
- `src/content-loader/schemas/index.ts`
- `src/content-loader/load.ts` (filesystem + YAML parsing helpers)
- `src/content-loader/registry.ts` (typed lookup of all loaded content)
- `src/content-loader/__tests__/*.test.ts`
- `scripts/validate-content.ts`
- `content/damage-types.yaml`
- `content/towers/sample-arrow.yaml`
- `content/creeps/sample-scout.yaml`
- `content/maps/in-the-loop/map.yaml`
- `content/maps/in-the-loop/waves-easy.yaml`
- `content/maps/in-the-loop/waves-hard.yaml`
- `content/maps/logs/map.yaml`
- `content/maps/logs/waves-easy.yaml`
- `content/maps/logs/waves-hard.yaml`
- `.github/workflows/ci.yml`

**Modified:**

- `README.md` — add a "Getting started" section.

Why this layout: schemas are split one-per-file because we'll touch them frequently in isolation (tower schema changes when adding upgrades, creep schema changes when adding abilities, etc.). Loader/registry are split because the loader is pure I/O and the registry is pure indexing — easier to unit-test independently.

---

## Phase 1 — Scaffold

### Task 1: Initialize Next.js + TypeScript project

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`, `eslint.config.mjs`, `next-env.d.ts`, `postcss.config.mjs`, `app/globals.css` (whatever the generator produces).

- [ ] **Step 1: Run the Next.js generator into the current repo**

```bash
npx create-next-app@latest . \
  --ts --eslint --app --src-dir \
  --no-tailwind --no-import-alias --use-npm
```

When prompted to overwrite `README.md`, answer **No**. The generator should otherwise leave existing files (`docs/`, `content/`, `examples/`, `CLAUDE.md`) alone.

- [ ] **Step 2: Verify dev server boots**

```bash
npm run dev
```

Expected: Next.js prints `Local: http://localhost:3000` and serves the default page. Stop with Ctrl-C.

- [ ] **Step 3: Verify build + lint + typecheck pass**

```bash
npm run build
npm run lint
npx tsc --noEmit
```

All three must exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "FS-4: scaffold Next.js + TypeScript app"
```

---

### Task 2: Add runtime dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install phaser@^3.88 @supabase/supabase-js@^2 @supabase/ssr@^0.5 \
  zod@^3 zustand@^5 mitt@^3 js-yaml@^4
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest@^2 @vitest/ui@^2 \
  @types/js-yaml@^4 \
  prettier@^3 \
  tsx@^4
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "FS-4: add runtime + dev dependencies"
```

---

### Task 3: Configure Vitest with a smoke test

**Files:**

- Create: `vitest.config.ts`, `src/lib/__tests__/smoke.test.ts`
- Modify: `package.json` (add `test`, `test:watch` scripts)

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` object add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write smoke test `src/lib/__tests__/smoke.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json src/lib/__tests__/smoke.test.ts
git commit -m "FS-4: configure Vitest with smoke test"
```

---

### Task 4: Configure Prettier

**Files:**

- Create: `.prettierrc.json`, `.prettierignore`
- Modify: `package.json` (add `format`, `format:check` scripts)

- [ ] **Step 1: Write `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

- [ ] **Step 2: Write `.prettierignore`**

```
.next
node_modules
package-lock.json
content/**/*.yaml
```

(Content YAML is hand-edited by designers; let them format it freely.)

- [ ] **Step 3: Add scripts**

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 4: Run formatter**

```bash
npm run format
npm run format:check
```

Both should exit 0.

- [ ] **Step 5: Commit**

```bash
git add .prettierrc.json .prettierignore package.json
git add -u
git commit -m "FS-4: configure Prettier"
```

---

### Task 5: Environment variables

**Files:**

- Create: `.env.example`, `src/lib/env.ts`
- Modify: `.gitignore` (confirm `.env*.local` is ignored — Next's generator already does this; verify only)

- [ ] **Step 1: Write `.env.example`**

```
# Supabase — get these from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Write `src/lib/env.ts`**

```ts
import { z } from 'zod';

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const ServerEnvSchema = PublicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function readPublicEnv() {
  return PublicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function readServerEnv() {
  return ServerEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
```

- [ ] **Step 3: Verify `.gitignore` ignores `.env*.local`**

```bash
grep -E '\.env' .gitignore
```

Expected: line containing `.env*.local` (Next's default).

- [ ] **Step 4: Commit**

```bash
git add .env.example src/lib/env.ts
git commit -m "FS-4: add env schema and example"
```

---

### Task 6: Supabase client modules

**Files:**

- Create: `src/lib/supabase/types.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`

- [ ] **Step 1: Write `src/lib/supabase/types.ts`**

Placeholder Database type — will be replaced with generated types in a later plan.

```ts
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
```

- [ ] **Step 2: Write `src/lib/supabase/browser.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';
import { readPublicEnv } from '@/lib/env';
import type { Database } from './types';

export function createSupabaseBrowserClient() {
  const env = readPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

- [ ] **Step 3: Write `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readPublicEnv } from '@/lib/env';
import type { Database } from './types';

export async function createSupabaseServerClient() {
  const env = readPublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Verify typecheck passes**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase
git commit -m "FS-4: add Supabase server + browser client modules"
```

---

### Task 7: Placeholder `/play` route

**Files:**

- Create: `src/app/play/page.tsx`

- [ ] **Step 1: Write the placeholder page**

```tsx
export default function PlayPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Firestorm</h1>
      <p>Game canvas will live here.</p>
    </main>
  );
}
```

- [ ] **Step 2: Verify it renders**

```bash
npm run dev
```

Visit `http://localhost:3000/play`. Expected: heading + paragraph render. Ctrl-C to stop.

- [ ] **Step 3: Commit**

```bash
git add src/app/play/page.tsx
git commit -m "FS-4: add placeholder /play route"
```

---

## Phase 2 — Content schemas

For all schema tasks the discipline is the same:

1. Write a failing Vitest test that exercises the schema + a fixture YAML file.
2. Write the schema until it passes.
3. Add at least one negative-case test (rejects invalid input).
4. Commit.

### Task 8: Damage-types schema + fixture

**Files:**

- Create: `src/content-loader/schemas/damage-types.ts`
- Create: `content/damage-types.yaml`
- Create: `src/content-loader/__tests__/damage-types.test.ts`

- [ ] **Step 1: Write `content/damage-types.yaml`**

```yaml
# Multipliers: 1.0 = neutral, 0.5 = resisted, 1.5 = weak, 0 = immune.
# Rows = damage type; columns = resistance class.
resistanceClasses: [light, heavy, magical]
damageTypes:
  physical:
    light: 1.0
    heavy: 0.5
    magical: 1.0
  magic:
    light: 1.0
    heavy: 1.0
    magical: 0.5
  true:
    light: 1.0
    heavy: 1.0
    magical: 1.0
```

- [ ] **Step 2: Write the failing test `src/content-loader/__tests__/damage-types.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { DamageTypesSchema } from '@/content-loader/schemas/damage-types';

function loadFixture() {
  const file = path.resolve(__dirname, '../../../content/damage-types.yaml');
  return yaml.load(readFileSync(file, 'utf8'));
}

describe('DamageTypesSchema', () => {
  it('parses the bundled damage-types.yaml', () => {
    const parsed = DamageTypesSchema.parse(loadFixture());
    expect(parsed.resistanceClasses).toContain('light');
    expect(parsed.damageTypes.physical.heavy).toBe(0.5);
  });

  it('rejects a damage type missing a resistance class entry', () => {
    const bad = {
      resistanceClasses: ['light', 'heavy'],
      damageTypes: { physical: { light: 1 } },
    };
    expect(() => DamageTypesSchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 3: Run the test, confirm it fails**

```bash
npm test -- damage-types
```

Expected: failure (`Cannot find module '@/content-loader/schemas/damage-types'`).

- [ ] **Step 4: Write the schema `src/content-loader/schemas/damage-types.ts`**

```ts
import { z } from 'zod';

export const DamageTypesSchema = z
  .object({
    resistanceClasses: z.array(z.string().min(1)).min(1),
    damageTypes: z.record(z.string(), z.record(z.string(), z.number().min(0))),
  })
  .superRefine((value, ctx) => {
    const classes = new Set(value.resistanceClasses);
    for (const [typeName, row] of Object.entries(value.damageTypes)) {
      for (const cls of classes) {
        if (!(cls in row)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `damage type "${typeName}" is missing entry for resistance class "${cls}"`,
            path: ['damageTypes', typeName, cls],
          });
        }
      }
    }
  });

export type DamageTypes = z.infer<typeof DamageTypesSchema>;
```

- [ ] **Step 5: Re-run test**

```bash
npm test -- damage-types
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/content-loader/schemas/damage-types.ts \
  content/damage-types.yaml \
  src/content-loader/__tests__/damage-types.test.ts
git commit -m "FS-4: add damage-types schema and fixture"
```

---

### Task 9: Tower schema + fixture

**Files:**

- Create: `src/content-loader/schemas/tower.ts`
- Create: `content/towers/sample-arrow.yaml`
- Create: `src/content-loader/__tests__/tower.test.ts`

- [ ] **Step 1: Write `content/towers/sample-arrow.yaml`**

```yaml
id: arrow
name: Arrow Tower
cost: 100
damageType: physical
targetableLayers: [ground]
baseStats:
  damage: 10
  attackSpeed: 1.0 # attacks per second
  range: 150 # pixels
  projectileBehavior: single-target
targetingDefaults:
  priority: first # first | last | strong | close
upgrades:
  - id: arrow-1
    requires: []
    cost: 80
    statDeltas:
      damage: 5
  - id: arrow-2
    requires: [arrow-1]
    cost: 200
    statDeltas:
      damage: 10
      range: 30
```

- [ ] **Step 2: Write failing test `src/content-loader/__tests__/tower.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { TowerSchema } from '@/content-loader/schemas/tower';

function loadFixture() {
  const file = path.resolve(__dirname, '../../../content/towers/sample-arrow.yaml');
  return yaml.load(readFileSync(file, 'utf8'));
}

describe('TowerSchema', () => {
  it('parses the sample-arrow tower', () => {
    const tower = TowerSchema.parse(loadFixture());
    expect(tower.id).toBe('arrow');
    expect(tower.upgrades).toHaveLength(2);
    expect(tower.targetableLayers).toEqual(['ground']);
  });

  it('rejects an upgrade requiring an unknown prereq', () => {
    const bad = {
      ...(loadFixture() as object),
      upgrades: [{ id: 'a', requires: ['nonexistent'], cost: 10, statDeltas: {} }],
    };
    expect(() => TowerSchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 3: Run, confirm failure**

```bash
npm test -- tower
```

- [ ] **Step 4: Write `src/content-loader/schemas/tower.ts`**

```ts
import { z } from 'zod';

export const MovementLayerSchema = z.enum(['ground', 'water', 'air']);
export type MovementLayer = z.infer<typeof MovementLayerSchema>;

export const TargetingPrioritySchema = z.enum(['first', 'last', 'strong', 'close']);

export const ProjectileBehaviorSchema = z.enum([
  'single-target',
  'splash',
  'piercing',
  'chain',
  'dot',
  'slow-debuff',
  'support-buff',
]);

const StatDeltasSchema = z
  .object({
    damage: z.number().optional(),
    attackSpeed: z.number().optional(),
    range: z.number().optional(),
  })
  .strict();

const UpgradeNodeSchema = z.object({
  id: z.string().min(1),
  requires: z.array(z.string()),
  cost: z.number().int().nonnegative(),
  statDeltas: StatDeltasSchema,
});

export const TowerSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    cost: z.number().int().nonnegative(),
    damageType: z.string().min(1),
    targetableLayers: z.array(MovementLayerSchema).default(['ground']),
    baseStats: z.object({
      damage: z.number().nonnegative(),
      attackSpeed: z.number().positive(),
      range: z.number().positive(),
      projectileBehavior: ProjectileBehaviorSchema,
    }),
    targetingDefaults: z.object({
      priority: TargetingPrioritySchema,
    }),
    upgrades: z.array(UpgradeNodeSchema),
  })
  .superRefine((tower, ctx) => {
    const ids = new Set(tower.upgrades.map((u) => u.id));
    for (const upgrade of tower.upgrades) {
      for (const req of upgrade.requires) {
        if (!ids.has(req)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `upgrade "${upgrade.id}" requires unknown upgrade "${req}"`,
            path: ['upgrades'],
          });
        }
      }
    }
  });

export type Tower = z.infer<typeof TowerSchema>;
```

- [ ] **Step 5: Re-run test**

```bash
npm test -- tower
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/content-loader/schemas/tower.ts \
  content/towers/sample-arrow.yaml \
  src/content-loader/__tests__/tower.test.ts
git commit -m "FS-4: add tower schema and fixture"
```

---

### Task 10: Creep schema + fixture

**Files:**

- Create: `src/content-loader/schemas/creep.ts`
- Create: `content/creeps/sample-scout.yaml`
- Create: `src/content-loader/__tests__/creep.test.ts`

- [ ] **Step 1: Write `content/creeps/sample-scout.yaml`**

```yaml
id: scout
name: Scout
hp: 50
speed: 80 # pixels per second
movementLayer: ground
resistanceClass: light
bounty: 5
leakDamage: 1
abilities: []
```

- [ ] **Step 2: Write failing test `src/content-loader/__tests__/creep.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { CreepSchema } from '@/content-loader/schemas/creep';

function loadFixture() {
  const file = path.resolve(__dirname, '../../../content/creeps/sample-scout.yaml');
  return yaml.load(readFileSync(file, 'utf8'));
}

describe('CreepSchema', () => {
  it('parses the sample-scout creep', () => {
    const creep = CreepSchema.parse(loadFixture());
    expect(creep.id).toBe('scout');
    expect(creep.movementLayer).toBe('ground');
    expect(creep.abilities).toEqual([]);
  });

  it('parses a spawnOnDeath ability', () => {
    const data = {
      ...(loadFixture() as object),
      abilities: [{ type: 'spawnOnDeath', spawn: 'tinyScout', count: 3 }],
    };
    const creep = CreepSchema.parse(data);
    const ability = creep.abilities[0];
    if (ability.type !== 'spawnOnDeath') throw new Error('discriminated union broken');
    expect(ability.spawn).toBe('tinyScout');
    expect(ability.count).toBe(3);
  });

  it('rejects an unknown ability type', () => {
    const bad = { ...(loadFixture() as object), abilities: [{ type: 'teleport' }] };
    expect(() => CreepSchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 3: Run, confirm failure**

```bash
npm test -- creep
```

- [ ] **Step 4: Write `src/content-loader/schemas/creep.ts`**

```ts
import { z } from 'zod';
import { MovementLayerSchema } from './tower';

const RegenAbility = z.object({
  type: z.literal('regen'),
  rate: z.number().positive(),
});

const ShieldAbility = z.object({
  type: z.literal('shield'),
  hp: z.number().positive(),
});

const SpawnOnDeathAbility = z.object({
  type: z.literal('spawnOnDeath'),
  spawn: z.string().min(1),
  count: z.number().int().positive(),
});

export const CreepAbilitySchema = z.discriminatedUnion('type', [
  RegenAbility,
  ShieldAbility,
  SpawnOnDeathAbility,
]);

export type CreepAbility = z.infer<typeof CreepAbilitySchema>;

export const CreepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hp: z.number().positive(),
  speed: z.number().positive(),
  movementLayer: MovementLayerSchema.default('ground'),
  resistanceClass: z.string().min(1),
  bounty: z.number().int().nonnegative(),
  leakDamage: z.number().int().positive(),
  abilities: z.array(CreepAbilitySchema).default([]),
});

export type Creep = z.infer<typeof CreepSchema>;
```

- [ ] **Step 5: Re-run test**

```bash
npm test -- creep
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/content-loader/schemas/creep.ts \
  content/creeps/sample-scout.yaml \
  src/content-loader/__tests__/creep.test.ts
git commit -m "FS-4: add creep schema and fixture"
```

---

### Task 11: Wave schema + fixtures

**Files:**

- Create: `src/content-loader/schemas/wave.ts`
- Create: `content/maps/in-the-loop/waves-easy.yaml`, `content/maps/in-the-loop/waves-hard.yaml`
- Create: `content/maps/logs/waves-easy.yaml`, `content/maps/logs/waves-hard.yaml`
- Create: `src/content-loader/__tests__/wave.test.ts`

- [ ] **Step 1: Write `content/maps/in-the-loop/waves-easy.yaml`**

```yaml
waves:
  - groups:
      - { creep: scout, count: 5, spacing: 0.8, delay: 0 }
  - groups:
      - { creep: scout, count: 8, spacing: 0.6, delay: 0 }
```

- [ ] **Step 2: Stub the other three wave files**

`content/maps/in-the-loop/waves-hard.yaml`, `content/maps/logs/waves-easy.yaml`, `content/maps/logs/waves-hard.yaml` all contain:

```yaml
waves: []
```

(Real waves authored later in the parallel content stream.)

- [ ] **Step 3: Write failing test `src/content-loader/__tests__/wave.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { WaveFileSchema } from '@/content-loader/schemas/wave';

function load(file: string) {
  return yaml.load(readFileSync(path.resolve(__dirname, '../../../', file), 'utf8'));
}

describe('WaveFileSchema', () => {
  it('parses in-the-loop easy waves', () => {
    const data = WaveFileSchema.parse(load('content/maps/in-the-loop/waves-easy.yaml'));
    expect(data.waves).toHaveLength(2);
    expect(data.waves[0].groups[0].creep).toBe('scout');
  });

  it('accepts an empty wave list (stubbed difficulty)', () => {
    const data = WaveFileSchema.parse(load('content/maps/in-the-loop/waves-hard.yaml'));
    expect(data.waves).toEqual([]);
  });

  it('rejects negative spacing', () => {
    expect(() =>
      WaveFileSchema.parse({
        waves: [{ groups: [{ creep: 'scout', count: 1, spacing: -1, delay: 0 }] }],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 4: Run, confirm failure**

```bash
npm test -- wave
```

- [ ] **Step 5: Write `src/content-loader/schemas/wave.ts`**

```ts
import { z } from 'zod';

export const WaveGroupSchema = z.object({
  creep: z.string().min(1),
  count: z.number().int().positive(),
  spacing: z.number().nonnegative(),
  delay: z.number().nonnegative(),
});

export const WaveSchema = z.object({
  groups: z.array(WaveGroupSchema).min(1),
});

export const WaveFileSchema = z.object({
  waves: z.array(WaveSchema),
});

export type WaveFile = z.infer<typeof WaveFileSchema>;
```

- [ ] **Step 6: Re-run test**

```bash
npm test -- wave
```

Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add src/content-loader/schemas/wave.ts \
  content/maps/in-the-loop/waves-easy.yaml \
  content/maps/in-the-loop/waves-hard.yaml \
  content/maps/logs/waves-easy.yaml \
  content/maps/logs/waves-hard.yaml \
  src/content-loader/__tests__/wave.test.ts
git commit -m "FS-4: add wave schema and fixtures"
```

---

### Task 12: Map schema + fixtures

**Files:**

- Create: `src/content-loader/schemas/map.ts`
- Create: `content/maps/in-the-loop/map.yaml`, `content/maps/logs/map.yaml`
- Create: `src/content-loader/__tests__/map.test.ts`

- [ ] **Step 1: Write `content/maps/in-the-loop/map.yaml`**

Uses placeholder image paths and a placeholder path polyline. Real values come during the content authoring stream.

```yaml
id: in-the-loop
name: In The Loop
background: /assets/maps/in-the-loop/background.webp
placementMask: /assets/maps/in-the-loop/mask.png
path:
  - { x: 0, y: 100 }
  - { x: 200, y: 100 }
  - { x: 200, y: 300 }
  - { x: 800, y: 300 }
difficulty:
  easy:
    startCash: 650
    startLives: 100
    waves: waves-easy.yaml
  hard:
    startCash: 500
    startLives: 60
    waves: waves-hard.yaml
```

- [ ] **Step 2: Write `content/maps/logs/map.yaml`**

```yaml
id: logs
name: Logs
background: /assets/maps/logs/background.webp
placementMask: /assets/maps/logs/mask.png
path:
  - { x: 0, y: 200 }
  - { x: 400, y: 200 }
  - { x: 400, y: 500 }
  - { x: 800, y: 500 }
difficulty:
  easy:
    startCash: 650
    startLives: 100
    waves: waves-easy.yaml
  hard:
    startCash: 500
    startLives: 60
    waves: waves-hard.yaml
```

- [ ] **Step 3: Write failing test `src/content-loader/__tests__/map.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { MapSchema } from '@/content-loader/schemas/map';

function load(file: string) {
  return yaml.load(readFileSync(path.resolve(__dirname, '../../../', file), 'utf8'));
}

describe('MapSchema', () => {
  it.each(['content/maps/in-the-loop/map.yaml', 'content/maps/logs/map.yaml'])(
    'parses %s',
    (file) => {
      const map = MapSchema.parse(load(file));
      expect(map.path.length).toBeGreaterThanOrEqual(2);
      expect(map.difficulty.easy.startLives).toBeGreaterThan(0);
    },
  );

  it('rejects a path with fewer than 2 points', () => {
    expect(() =>
      MapSchema.parse({
        id: 'x',
        name: 'X',
        background: '/x.png',
        placementMask: '/x.png',
        path: [{ x: 0, y: 0 }],
        difficulty: {
          easy: { startCash: 1, startLives: 1, waves: 'waves-easy.yaml' },
          hard: { startCash: 1, startLives: 1, waves: 'waves-hard.yaml' },
        },
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 4: Run, confirm failure**

```bash
npm test -- map
```

- [ ] **Step 5: Write `src/content-loader/schemas/map.ts`**

```ts
import { z } from 'zod';

const PointSchema = z.object({ x: z.number(), y: z.number() });

const DifficultySchema = z.object({
  startCash: z.number().int().nonnegative(),
  startLives: z.number().int().positive(),
  waves: z.string().min(1),
});

export const MapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  background: z.string().min(1),
  placementMask: z.string().min(1),
  path: z.array(PointSchema).min(2),
  waterPath: z.array(PointSchema).optional(),
  difficulty: z.object({
    easy: DifficultySchema,
    hard: DifficultySchema,
  }),
});

export type GameMap = z.infer<typeof MapSchema>;
```

- [ ] **Step 6: Re-run test**

```bash
npm test -- map
```

Expected: 3 passed (2 parametrized + 1 negative).

- [ ] **Step 7: Commit**

```bash
git add src/content-loader/schemas/map.ts \
  content/maps/in-the-loop/map.yaml \
  content/maps/logs/map.yaml \
  src/content-loader/__tests__/map.test.ts
git commit -m "FS-4: add map schema and fixtures"
```

---

### Task 13: Schema barrel + content loader

**Files:**

- Create: `src/content-loader/schemas/index.ts`, `src/content-loader/load.ts`, `src/content-loader/__tests__/load.test.ts`

- [ ] **Step 1: Write `src/content-loader/schemas/index.ts`**

```ts
export * from './damage-types';
export * from './tower';
export * from './creep';
export * from './wave';
export * from './map';
```

- [ ] **Step 2: Write failing test `src/content-loader/__tests__/load.test.ts`**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';

const CONTENT_ROOT = path.resolve(__dirname, '../../../content');

describe('loadAllContent', () => {
  it('loads damage types, towers, creeps, and maps from the repo content directory', async () => {
    const content = await loadAllContent(CONTENT_ROOT);

    expect(content.damageTypes.damageTypes.physical).toBeDefined();
    expect(content.towers.find((t) => t.id === 'arrow')).toBeDefined();
    expect(content.creeps.find((c) => c.id === 'scout')).toBeDefined();

    const inTheLoop = content.maps.find((m) => m.map.id === 'in-the-loop');
    expect(inTheLoop).toBeDefined();
    expect(inTheLoop!.wavesEasy.waves.length).toBeGreaterThan(0);
    expect(inTheLoop!.wavesHard.waves).toEqual([]);
  });
});
```

- [ ] **Step 3: Run, confirm failure**

```bash
npm test -- load
```

- [ ] **Step 4: Write `src/content-loader/load.ts`**

```ts
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  CreepSchema,
  DamageTypesSchema,
  MapSchema,
  TowerSchema,
  WaveFileSchema,
  type Creep,
  type DamageTypes,
  type GameMap,
  type Tower,
  type WaveFile,
} from './schemas';

export interface LoadedMap {
  map: GameMap;
  wavesEasy: WaveFile;
  wavesHard: WaveFile;
}

export interface LoadedContent {
  damageTypes: DamageTypes;
  towers: Tower[];
  creeps: Creep[];
  maps: LoadedMap[];
}

async function readYaml(file: string): Promise<unknown> {
  return yaml.load(await readFile(file, 'utf8'));
}

async function readDirYaml<T>(dir: string, parse: (raw: unknown, file: string) => T): Promise<T[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
    .map((e) => path.join(dir, e.name));
  return Promise.all(
    files.map(async (file) => {
      try {
        return parse(await readYaml(file), file);
      } catch (err) {
        throw new Error(`Failed to load ${file}: ${(err as Error).message}`);
      }
    }),
  );
}

export async function loadAllContent(contentRoot: string): Promise<LoadedContent> {
  const damageTypes = DamageTypesSchema.parse(
    await readYaml(path.join(contentRoot, 'damage-types.yaml')),
  );

  const towers = await readDirYaml(path.join(contentRoot, 'towers'), (raw) =>
    TowerSchema.parse(raw),
  );

  const creeps = await readDirYaml(path.join(contentRoot, 'creeps'), (raw) =>
    CreepSchema.parse(raw),
  );

  const mapsDir = path.join(contentRoot, 'maps');
  const mapDirs = (await readdir(mapsDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => path.join(mapsDir, e.name));

  const maps = await Promise.all(
    mapDirs.map(async (dir): Promise<LoadedMap> => {
      const map = MapSchema.parse(await readYaml(path.join(dir, 'map.yaml')));
      const wavesEasy = WaveFileSchema.parse(
        await readYaml(path.join(dir, map.difficulty.easy.waves)),
      );
      const wavesHard = WaveFileSchema.parse(
        await readYaml(path.join(dir, map.difficulty.hard.waves)),
      );
      return { map, wavesEasy, wavesHard };
    }),
  );

  return { damageTypes, towers, creeps, maps };
}
```

- [ ] **Step 5: Re-run test**

```bash
npm test -- load
```

Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add src/content-loader/schemas/index.ts \
  src/content-loader/load.ts \
  src/content-loader/__tests__/load.test.ts
git commit -m "FS-4: add content loader"
```

---

### Task 14: Cross-reference registry

**Files:**

- Create: `src/content-loader/registry.ts`, `src/content-loader/__tests__/registry.test.ts`

The registry indexes loaded content by id and validates cross-references that span files: every tower's `damageType` must exist in the damage-types matrix; every creep's `resistanceClass` must exist; every wave group's `creep` must reference a known creep; every creep ability with `spawnOnDeath` must reference a known creep.

- [ ] **Step 1: Write failing test `src/content-loader/__tests__/registry.test.ts`**

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllContent } from '@/content-loader/load';
import { buildRegistry } from '@/content-loader/registry';

const CONTENT_ROOT = path.resolve(__dirname, '../../../content');

describe('buildRegistry', () => {
  it('indexes loaded content and resolves cross-references', async () => {
    const content = await loadAllContent(CONTENT_ROOT);
    const registry = buildRegistry(content);

    expect(registry.towersById.get('arrow')?.name).toBe('Arrow Tower');
    expect(registry.creepsById.get('scout')?.hp).toBeGreaterThan(0);
    expect(registry.mapsById.get('in-the-loop')?.map.name).toBe('In The Loop');
  });

  it('throws when a tower references an unknown damage type', async () => {
    const content = await loadAllContent(CONTENT_ROOT);
    content.towers.push({
      ...content.towers[0],
      id: 'broken',
      damageType: 'nonexistent',
    });
    expect(() => buildRegistry(content)).toThrow(/damageType/);
  });

  it('throws when a wave references an unknown creep', async () => {
    const content = await loadAllContent(CONTENT_ROOT);
    const map = content.maps[0];
    map.wavesEasy.waves.push({
      groups: [{ creep: 'ghost-creep-id', count: 1, spacing: 1, delay: 0 }],
    });
    expect(() => buildRegistry(content)).toThrow(/ghost-creep-id/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm test -- registry
```

- [ ] **Step 3: Write `src/content-loader/registry.ts`**

```ts
import type { LoadedContent, LoadedMap } from './load';
import type { Creep, Tower } from './schemas';

export interface ContentRegistry {
  damageTypes: LoadedContent['damageTypes'];
  towersById: Map<string, Tower>;
  creepsById: Map<string, Creep>;
  mapsById: Map<string, LoadedMap>;
}

function indexById<T extends { id: string }>(items: T[], kind: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) {
      throw new Error(`Duplicate ${kind} id: ${item.id}`);
    }
    map.set(item.id, item);
  }
  return map;
}

export function buildRegistry(content: LoadedContent): ContentRegistry {
  const towersById = indexById(content.towers, 'tower');
  const creepsById = indexById(content.creeps, 'creep');
  const mapsById = indexById(
    content.maps.map((m) => ({ id: m.map.id, ...m })),
    'map',
  ) as unknown as Map<string, LoadedMap>;

  const damageTypeNames = new Set(Object.keys(content.damageTypes.damageTypes));
  const resistanceClasses = new Set(content.damageTypes.resistanceClasses);

  for (const tower of towersById.values()) {
    if (!damageTypeNames.has(tower.damageType)) {
      throw new Error(`Tower "${tower.id}" damageType "${tower.damageType}" is not defined`);
    }
  }

  for (const creep of creepsById.values()) {
    if (!resistanceClasses.has(creep.resistanceClass)) {
      throw new Error(
        `Creep "${creep.id}" resistanceClass "${creep.resistanceClass}" is not defined`,
      );
    }
    for (const ability of creep.abilities) {
      if (ability.type === 'spawnOnDeath' && !creepsById.has(ability.spawn)) {
        throw new Error(
          `Creep "${creep.id}" spawnOnDeath references unknown creep "${ability.spawn}"`,
        );
      }
    }
  }

  for (const loadedMap of mapsById.values()) {
    for (const file of [loadedMap.wavesEasy, loadedMap.wavesHard]) {
      for (const wave of file.waves) {
        for (const group of wave.groups) {
          if (!creepsById.has(group.creep)) {
            throw new Error(
              `Map "${loadedMap.map.id}" wave references unknown creep "${group.creep}"`,
            );
          }
        }
      }
    }
  }

  return { damageTypes: content.damageTypes, towersById, creepsById, mapsById };
}
```

- [ ] **Step 4: Re-run test**

```bash
npm test -- registry
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/content-loader/registry.ts \
  src/content-loader/__tests__/registry.test.ts
git commit -m "FS-4: add content registry with cross-reference validation"
```

---

### Task 15: `validate-content` CLI script

**Files:**

- Create: `scripts/validate-content.ts`
- Modify: `package.json` (add `validate-content` script)

- [ ] **Step 1: Write `scripts/validate-content.ts`**

```ts
import path from 'node:path';
import { loadAllContent } from '../src/content-loader/load';
import { buildRegistry } from '../src/content-loader/registry';

async function main() {
  const root = path.resolve(__dirname, '..', 'content');
  const content = await loadAllContent(root);
  const registry = buildRegistry(content);
  console.log(
    `OK: ${registry.towersById.size} towers, ${registry.creepsById.size} creeps, ${registry.mapsById.size} maps.`,
  );
}

main().catch((err) => {
  console.error('Content validation FAILED:');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script to `package.json`**

```json
"validate-content": "tsx scripts/validate-content.ts"
```

- [ ] **Step 3: Run it**

```bash
npm run validate-content
```

Expected output (counts may vary): `OK: 1 towers, 1 creeps, 2 maps.`

- [ ] **Step 4: Verify it fails on broken content**

Temporarily break a tower:

```bash
sed -i.bak 's/damageType: physical/damageType: nonexistent/' content/towers/sample-arrow.yaml
npm run validate-content || echo "EXIT $?"
mv content/towers/sample-arrow.yaml.bak content/towers/sample-arrow.yaml
```

Expected: validation prints `Content validation FAILED:` with a message about `damageType "nonexistent"` and exits 1.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-content.ts package.json
git commit -m "FS-4: add validate-content CLI script"
```

---

### Task 16: GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: ['**']
  pull_request:
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run validate-content
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "FS-4: add CI workflow"
```

- [ ] **Step 3: Run all checks locally to confirm CI will pass**

```bash
npm run format:check && npm run lint && npx tsc --noEmit && npm test && npm run validate-content
```

All must exit 0.

---

### Task 17: README — getting started

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Append a "Getting started" section at the end of `README.md`**

````markdown
## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys when you have them
npm run dev                  # http://localhost:3000
```
````

### Useful scripts

- `npm test` — Vitest
- `npm run validate-content` — schema-validate everything in `content/`
- `npm run lint` / `npm run format:check`

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "FS-4: README getting-started section"
````

---

## Done check

After all tasks, the repo should:

- `npm run dev` boots and `/play` renders.
- `npm test` is all green.
- `npm run validate-content` reports `OK: 1 towers, 1 creeps, 2 maps.`
- `npm run lint`, `npx tsc --noEmit`, `npm run format:check` all pass.
- CI workflow exists and would run the same checks.
- No game logic, no rendering, no auth — those are Plans B–F.
