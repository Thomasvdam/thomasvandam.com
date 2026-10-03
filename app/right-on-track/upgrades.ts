export const PRECISION_WINDOW = 0.05;
export const UPGRADE_INTERVAL = 10;
const rewards = ["A splendid top hat", "Golden trim", "Rainbow smoke · 20%", "Wagon bunting", "Golden boiler", "Rainbow smoke · 40%", "Party hat", "Wagon lanterns", "Golden cab roof", "Rainbow smoke · 60%", "Engineer’s crown", "Golden wheels", "Rainbow smoke · 80%", "Wagon rosettes", "Rainbow smoke · 100%", "Golden front bumper"];
export function upgradeLabel(level: number) {
	return level <= rewards.length ? rewards[Math.max(0, level - 1)] : "A fresh coat of celebration";
}
export function upgradeAppearance(level: number) {
	return {
		hat: level < 1 ? "none" : level < 7 ? "top" : level < 11 ? "party" : level <= 16 ? "crown" : (["top", "party", "crown"] as const)[(level - 17) % 3],
		gold: [2, 5, 9, 12, 16].filter(at => level >= at).length,
		rainbow: [3, 6, 10, 13, 15].filter(at => level >= at).length / 5,
		wagon: [4, 8, 14].filter(at => level >= at).length,
		color: Math.max(0, level - 16) % 6,
	};
}
export const RAINBOW = ["#ef687d", "#f5ad59", "#eddb6c", "#77c993", "#7ebbe4", "#bd92e4"];
// Decide once per emitted puff, without frame-dependent randomness or color flicker.
export function rainbowPuff(seed: number, puff: number, emission: number, chance: number) {
	const hash = Math.imul(seed ^ Math.imul(puff + 1, 0x45d9f3b) ^ Math.imul(emission + 1, 0x51ed270b), 0x27d4eb2d) >>> 0;
	return hash / 4294967296 < chance;
}
