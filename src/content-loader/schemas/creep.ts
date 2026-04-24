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
