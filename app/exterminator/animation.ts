import type { Undercarriage } from "./terrain";
import { clamp } from "./game";
import type { Skin, SpritePart } from "./sprite-parts";
import type { BugVariant } from "./bugs";

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

// Resolve parent transforms once. Swapping a skin never changes the pose or bone geometry.
export function resolveRig(rig: Rig, skin: Skin, pose: Pose): ResolvedPart[] {
	const resolved = new Map<string, { x: number; y: number; angle: number; scaleX: number; scaleY: number; opacity: number }>();
	const parts: ResolvedPart[] = [];
	for (const bone of rig) {
		const local = pose[bone.id] ?? {}, parent = bone.parent ? resolved.get(bone.parent) : undefined;
		if (bone.parent && !parent) throw new Error(`Parent ${bone.parent} must precede ${bone.id}`);
		const px = (bone.x + (local.x ?? 0)) * (parent?.scaleX ?? 1), py = (bone.y + (local.y ?? 0)) * (parent?.scaleY ?? 1);
		const angle = parent?.angle ?? 0, cos = Math.cos(angle), sin = Math.sin(angle);
		const result = {
			x: (parent?.x ?? 0) + px * cos - py * sin, y: (parent?.y ?? 0) + px * sin + py * cos,
			angle: angle + (bone.angle ?? 0) + (local.angle ?? 0),
			scaleX: (parent?.scaleX ?? 1) * (local.scaleX ?? 1),
			scaleY: (parent?.scaleY ?? 1) * (local.scaleY ?? 1) * (bone.flipY ? -1 : 1),
			opacity: (parent?.opacity ?? 1) * (local.opacity ?? 1),
		};
		resolved.set(bone.id, result);
		const sprite = bone.slot ? skin[bone.slot] : undefined;
		if (sprite) parts.push({ ...result, bone: bone.id, sprite, layer: bone.layer });
	}
	return parts.sort((a, b) => a.layer - b.layer);
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
	if (variant === "flyer") return { elevation: (1 - progress) ** 2 * 90, scale: 1 + (1 - progress) * .3, opacity: .35 + progress * .65, reveal: 1 };
	return { elevation: 0, scale: .5 + progress * .5, opacity: .35 + progress * .65, reveal: clamp((progress - .25) / .75, 0, 1) };
}
