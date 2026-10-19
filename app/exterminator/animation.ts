import type { Undercarriage } from "./terrain";
import { clamp } from "./math";
import type { Skin, SpritePart } from "./sprite-parts";
import type { BugVariant } from "./bug-types";

export type Bone = { id: string; parent?: string; x: number; y: number; angle?: number; slot?: string; layer: number; flipY?: boolean };
export type Rig = readonly Bone[];
export type Transform = { x?: number; y?: number; angle?: number; scaleX?: number; scaleY?: number; opacity?: number };
export type Pose = Readonly<Record<string, Transform>>;
export type ResolvedPart = { bone: string; sprite: SpritePart; x: number; y: number; angle: number; scaleX: number; scaleY: number; opacity: number; layer: number };

export const MECH_RIG: Rig = [
	{ id: "base", x: 0, y: 0, layer: 0 },
	{ id: "footL", parent: "base", x: -3, y: -10, slot: "footL", layer: 0 },
	{ id: "footR", parent: "base", x: -3, y: 10, slot: "footR", layer: 0, flipY: true },
	{ id: "chassis", parent: "base", x: 0, y: 0, slot: "chassis", layer: 1 },
	{ id: "upper", x: 0, y: 0, layer: 2 },
	{ id: "torso", parent: "upper", x: 0, y: 0, slot: "torso", layer: 2 },
	{ id: "cooler", parent: "upper", x: -5, y: 7, slot: "cooler", layer: 3 },
	{ id: "weapon", parent: "upper", x: 7, y: -5, slot: "weapon", layer: 3 },
];
export const BUG_RIG: Rig = [
	{ id: "root", x: 0, y: 0, layer: 0 },
	...[-1, 1].flatMap(side => [-1, 0, 1].map((row, index): Bone => ({ id: `leg${side < 0 ? "L" : "R"}${index}`, parent: "root", x: row * 6, y: side * 6, angle: side * (Math.PI / 2 - row * .55), slot: "legs", layer: 0, flipY: side < 0 }))),
	{ id: "body", parent: "root", x: -2, y: 0, slot: "body", layer: 1 },
	{ id: "wingL", parent: "root", x: -4, y: -5, angle: -Math.PI / 2, slot: "wings", layer: 2, flipY: true },
	{ id: "wingR", parent: "root", x: -4, y: 5, angle: Math.PI / 2, slot: "wings", layer: 2 },
	{ id: "shell", parent: "root", x: -3, y: 0, slot: "shell", layer: 3 },
	{ id: "head", parent: "root", x: 10, y: 0, slot: "head", layer: 4 },
];

export const SPIDER_RIG: Rig = [BUG_RIG[0],
	...[-1, 1].flatMap(side => [-1.5, -.5, .5, 1.5].map((row, index): Bone => ({ id: `leg${side < 0 ? "L" : "R"}${index}`, parent: "root", x: row * 5, y: side * 6, angle: side * (Math.PI / 2 - row * .45), slot: "legs", layer: 0, flipY: side < 0 }))),
	...BUG_RIG.filter(bone => bone.id !== "root" && !bone.id.startsWith("leg")),
];
export const DRAGONFLY_RIG: Rig = [...BUG_RIG,
	{ id: "wingRearL", parent: "root", x: -9, y: -4, angle: -Math.PI / 3, slot: "wings", layer: 2, flipY: true },
	{ id: "wingRearR", parent: "root", x: -9, y: 4, angle: Math.PI / 3, slot: "wings", layer: 2 },
];

// Rigs are immutable. Validate hierarchy and sort paint order once, rather than per part/frame.
type CompiledRig = { parents: number[]; paintOrder: number[] };
const compiledRigs = new WeakMap<Rig, CompiledRig>();
function compileRig(rig: Rig): CompiledRig {
	const cached = compiledRigs.get(rig);
	if (cached) return cached;
	const indices = new Map<string, number>(), parents: number[] = [];
	for (const [i, bone] of rig.entries()) {
		const parent = bone.parent ? indices.get(bone.parent) : -1;
		if (parent === undefined) throw new Error(`Parent ${bone.parent} must precede ${bone.id}`);
		parents.push(parent); indices.set(bone.id, i);
	}
	const compiled = { parents, paintOrder: rig.map((_, i) => i).sort((a, b) => rig[a].layer - rig[b].layer) };
	compiledRigs.set(rig, compiled); return compiled;
}
export function resolveRig(rig: Rig, skin: Skin, pose: Pose): ResolvedPart[] {
	const { parents, paintOrder } = compileRig(rig);
	const resolved: { x: number; y: number; angle: number; scaleX: number; scaleY: number; opacity: number }[] = [];
	for (let i = 0; i < rig.length; i++) {
		const bone = rig[i], local = pose[bone.id] ?? {}, parent = resolved[parents[i]];
		const px = (bone.x + (local.x ?? 0)) * (parent?.scaleX ?? 1), py = (bone.y + (local.y ?? 0)) * (parent?.scaleY ?? 1);
		const angle = parent?.angle ?? 0, cos = Math.cos(angle), sin = Math.sin(angle);
		resolved.push({
			x: (parent?.x ?? 0) + px * cos - py * sin, y: (parent?.y ?? 0) + px * sin + py * cos,
			angle: angle + (bone.angle ?? 0) + (local.angle ?? 0),
			scaleX: (parent?.scaleX ?? 1) * (local.scaleX ?? 1),
			scaleY: (parent?.scaleY ?? 1) * (local.scaleY ?? 1) * (bone.flipY ? -1 : 1),
			opacity: (parent?.opacity ?? 1) * (local.opacity ?? 1),
		});
	}
	const parts: ResolvedPart[] = [];
	for (const i of paintOrder) {
		const bone = rig[i], sprite = bone.slot ? skin[bone.slot] : undefined;
		if (sprite) parts.push({ ...resolved[i], bone: bone.id, sprite, layer: bone.layer });
	}
	return parts;
}

export function mechPose(state: { distance: number; walkBlend: number; moveAngle: number; aimAngle: number; shotAge: number; time: number; undercarriage?: Undercarriage }): Pose {
	const stride = state.undercarriage && state.undercarriage !== "legs" ? 0 : Math.sin(state.distance / 44 * Math.PI * 2) * state.walkBlend;
	const recoil = Math.max(0, 1 - state.shotAge / .12);
	const bob = Math.abs(stride) * .7;
	return {
		base: { angle: state.moveAngle },
		footL: { x: stride * 4, angle: stride * .09 }, footR: { x: -stride * 4, angle: -stride * .09 },
		upper: { angle: state.aimAngle, y: -bob },
		weapon: { x: -recoil * 3, scaleX: 1 - recoil * .08 },
		cooler: { y: Math.sin(state.time * 6) * .3 + recoil * .7 },
	};
}
export function bugPose(state: { distance: number; angle: number; time: number; spawnProgress?: number; deathProgress?: number; rolling?: boolean; spitCharge?: number }): Pose {
	const phase = state.distance / 32 * Math.PI * 2;
	const spawn = state.spawnProgress ?? 1, death = state.deathProgress ?? 0;
	const pose: Record<string, Transform> = {
		root: { angle: state.angle, scaleX: 1 - death * .35, scaleY: 1 - death * .5, opacity: 1 - death },
		body: { y: Math.sin(phase * 2) * .45 }, shell: { y: Math.sin(phase * 2) * .45 },
		head: { x: Math.sin(phase) * .5 - death * 3 },
		wingL: { angle: Math.sin(state.time * 25) * .2 * (1 - spawn), scaleY: .35 + (1 - spawn) * .65 },
		wingR: { angle: -Math.sin(state.time * 25) * .2 * (1 - spawn), scaleY: .35 + (1 - spawn) * .65 },
	};
	for (let side = 0; side < 2; side++) for (let row = 0; row < 3; row++) {
		const stride = Math.sin(phase + (side + row) % 2 * Math.PI);
		pose[`leg${side === 0 ? "L" : "R"}${row}`] = { angle: stride * .17 + (side === 0 ? 1 : -1) * death * .9, x: stride * .7, scaleX: 1 - death * .25 };
	}
	if (state.spitCharge) {
		pose.shell = { ...pose.shell, scaleY: 1 + state.spitCharge * .16 };
		pose.head = { ...pose.head, x: -state.spitCharge * 2, scaleX: 1 + state.spitCharge * .12 };
	}
	if (state.rolling) {
		const roll = .65 + Math.sin(state.time * 16) * .15;
		pose.legL2 = { angle: roll, x: 2 }; pose.legR2 = { angle: -roll, x: 2 };
	}
	return pose;
}
export function spawnAppearance(variant: BugVariant, progress: number) {
	progress = clamp(progress, 0, 1);
	if (variant === "flyer" || variant === "dragonfly" || variant === "moth" || variant === "courier" || variant === "parasitoidWasp") return { elevation: (1 - progress) ** 2 * 90, scale: 1 + (1 - progress) * .3, opacity: .35 + progress * .65, reveal: 1 };
	return { elevation: 0, scale: .5 + progress * .5, opacity: .35 + progress * .65, reveal: clamp((progress - .25) / .75, 0, 1) };
}

export function spiderPose(state: Parameters<typeof bugPose>[0]): Pose {
	const pose: Record<string, Transform> = { ...bugPose(state) }, phase = state.distance / 32 * Math.PI * 2, death = state.deathProgress ?? 0;
	for (let side = 0; side < 2; side++) for (let row = 0; row < 4; row++) {
		const stride = Math.sin(phase + (side + row) % 2 * Math.PI);
		pose[`leg${side === 0 ? "L" : "R"}${row}`] = { angle: stride * .17 + (side === 0 ? 1 : -1) * death * .9, x: stride * .7, scaleX: 1 - death * .25 };
	}
	return pose;
}
export function dragonflyPose(state: Parameters<typeof bugPose>[0]): Pose {
	const pose: Record<string, Transform> = { ...bugPose(state) }, flutter = Math.sin(state.time * 45) * .25;
	for (const [name, sign] of [["wingL", 1], ["wingR", -1], ["wingRearL", -1], ["wingRearR", 1]] as const) pose[name] = { angle: sign * flutter, scaleY: .8 + Math.sin(state.time * 45) * .15 };
	for (let row = 0; row < 3; row++) { pose[`legL${row}`] = { scaleX: .6 }; pose[`legR${row}`] = { scaleX: .6 }; }
	return pose;
}

// Live bugs and their death snapshots share exactly the same species-specific pose.
export const bugRig = (variant: BugVariant): Rig => variant === "bolasSpider" ? SPIDER_RIG : variant === "dragonfly" ? DRAGONFLY_RIG : BUG_RIG;
export function speciesPose(variant: BugVariant, state: Parameters<typeof bugPose>[0]): Pose {
	let pose = variant === "bolasSpider" ? spiderPose(state) : variant === "dragonfly" ? dragonflyPose(state) : bugPose(state);
	if (variant === "slug" || variant === "velvetWorm" || variant === "larva") {
		const glide = Math.sin(state.distance / 8) * .06;
		pose = { ...pose, body: { scaleX: 1 + glide, scaleY: 1 - glide }, shell: { scaleY: 1 + glide } };
	}
	if (variant === "egg") pose = { ...pose, body: { scaleX: 1 + Math.sin(state.time * 4) * .03 } };
	return pose;
}
