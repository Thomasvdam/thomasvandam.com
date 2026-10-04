export const BRICK_TYPES = {
	speed: { symbol: "S", label: "Speed brick", hits: 1, color: "#ff657f", description: "S · breaking it permanently speeds up that ball by 20%" },
	slow: { symbol: "L", label: "Slow brick", hits: 1, color: "#7bdcf9", description: "L · breaking it slows that ball for four seconds" },
	moving: { symbol: "M", label: "Moving brick", hits: 3, color: "#d3aeff", description: "M · three hits · surviving hits push it away" },
	phase: { symbol: "O", label: "Phasing brick", hits: 1, color: "#a9b8d3", description: "O · solidifies after a ball passes completely through" },
	shock: { symbol: "E", label: "Shock brick", hits: 1, color: "#ffe65a", description: "E · drops a charge that stuns your paddle for one second" },
	void: { symbol: "V", label: "Void brick", hits: 2, color: "#b283d9", description: "V · two hits · consumes ball powers and always bounces" },
	indestructible: { symbol: "I", label: "Indestructible brick", hits: 1, color: "#71839b", description: "I · cannot break · does not count towards completion" },
};
export type BrickType = keyof typeof BRICK_TYPES;
