export const SEEK_FOOD = .65;
export const WEAK_HUNGER = 1.05;
export const FATAL_HUNGER = 1.5;
export const MEAL = .6;
export const hungerRate = (role: string) => role === "soldier" ? .02 : .01;
export const energy = (hunger: number) => Math.max(0, Math.min(100, Math.round((1 - hunger / FATAL_HUNGER) * 100)));
export const movementSpeed = (a: { speed: number; hunger?: number }) => a.speed * (1 - Math.min(.35, Math.max(0, (a.hunger ?? 0) - WEAK_HUNGER) / (FATAL_HUNGER - WEAK_HUNGER) * .35));
