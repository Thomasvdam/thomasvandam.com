export const BALL_POWER_TYPES = ["piercing", "fire", "ghost", "homing"] as const;
export type BallPower = typeof BALL_POWER_TYPES[number];
export const POWER_TYPES = ["wide", "duplicate", "sight", "top", ...BALL_POWER_TYPES, "sticky", "laser", "armour", "shrink", "rewind"] as const;
export type Power = typeof POWER_TYPES[number];
