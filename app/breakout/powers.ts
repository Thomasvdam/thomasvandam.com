export const BALL_POWER_TYPES = ["piercing", "fire", "ghost", "homing"] as const;
export type BallPower = typeof BALL_POWER_TYPES[number];
export const POWER_TYPES = ["wide", "duplicate", "sight", ...BALL_POWER_TYPES, "sticky", "laser", "armour", "shrink", "rewind"] as const;
export type Power = typeof POWER_TYPES[number];

export const POWER_COLORS = { wide: 0xb2f078, duplicate: 0xc3a0ff, sight: 0xff87b7, piercing: 0xf9ea62, fire: 0xff744b, ghost: 0xb9d8ef, homing: 0x6ca8ff, random: 0xeaf1f8, shock: 0xffe65a, sticky: 0xf4a8df, laser: 0xff596c, armour: 0x82aaff, shrink: 0xd78a52, rewind: 0x72f1bf };
