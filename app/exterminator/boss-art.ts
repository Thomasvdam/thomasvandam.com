import type { Bone, Pose, Rig, Transform } from "./animation";
import { drawRig } from "./rig-renderer";
import type { Sprites } from "./renderer";
import type { Skin, SpritePart } from "./sprite-parts";
import { isMillipedeWeak, MILLIPEDE_SEGMENT_COUNT, MILLIPEDE_SPACING, type Boss } from "./boss-types";

export type BossVariant = "rhinoceros" | "scorpion" | "millipede";
export const BOSS_SCALE: Record<BossVariant, number> = { rhinoceros: 2.7, scorpion: 2.4, millipede: 1.25 };

const SCORPION_TAIL_X = [-25 / 2.4, -18, -17, -15, -11] as const;
const SCORPION_TAIL_ANGLES = [-.45, -.45, -.5, -.55, -.45] as const;

// Bosses use intentionally bespoke silhouettes.  The ordinary bug rig is
// useful for small enemies, but these rigs expose the attack limbs that the
// boss collision code targets independently.
export const RHINOCEROS_RIG: Rig = [
	{ id: "root", x: 0, y: 0, layer: 0 },
	...[-1, 1].flatMap(side => [-1, 0, 1].map((row, index): Bone => ({
		id: `leg${side < 0 ? "L" : "R"}${index}`, parent: "root", x: (row * 17 - 7) / 2.7, y: side * 24 / 2.7,
		angle: side * (Math.PI / 2 - row * .36), slot: "legs", layer: 0, flipY: side < 0,
	}))),
	{ id: "body", parent: "root", x: -3, y: 0, slot: "body", layer: 1 },
	{ id: "shell", parent: "root", x: -4, y: 0, slot: "shell", layer: 2 },
	{ id: "head", parent: "root", x: 18, y: 0, slot: "head", layer: 3 },
	{ id: "horn", parent: "head", x: 8, y: 0, slot: "horn", layer: 4 },
];

export const SCORPION_RIG: Rig = [
	{ id: "root", x: 0, y: 0, layer: 0 },
	...[-1, 1].flatMap(side => [-1.5, -.5, .5, 1.5].map((row, index): Bone => ({
		id: `leg${side < 0 ? "L" : "R"}${index}`, parent: "root", x: (row * 13 - 9) / 2.4, y: side * 25 / 2.4,
		angle: side * (Math.PI / 2 - row * .3), slot: "legs", layer: 0, flipY: side < 0,
	}))),
	{ id: "tail0", parent: "root", x: SCORPION_TAIL_X[0], y: 0, angle: SCORPION_TAIL_ANGLES[0], slot: "tail", layer: 0 },
	{ id: "tail1", parent: "tail0", x: SCORPION_TAIL_X[1], y: 0, angle: SCORPION_TAIL_ANGLES[1], slot: "tail", layer: 1 },
	{ id: "tail2", parent: "tail1", x: SCORPION_TAIL_X[2], y: 0, angle: SCORPION_TAIL_ANGLES[2], slot: "tail", layer: 2 },
	{ id: "tail3", parent: "tail2", x: SCORPION_TAIL_X[3], y: 0, angle: SCORPION_TAIL_ANGLES[3], slot: "tail", layer: 3 },
	{ id: "stinger", parent: "tail3", x: SCORPION_TAIL_X[4], y: 0, angle: SCORPION_TAIL_ANGLES[4], slot: "stinger", layer: 4 },
	{ id: "body", parent: "root", x: -4, y: 0, slot: "body", layer: 1 },
	{ id: "shell", parent: "root", x: -5, y: 0, slot: "shell", layer: 2 },
	{ id: "head", parent: "root", x: 25, y: 0, slot: "head", layer: 3 },
	// These are pre-scale rig units.  At the 2.4 scorpion draw scale they
	// resolve to the collision centres (45,-38) and (45,38).
	{ id: "clawL", parent: "root", x: 45 / 2.4, y: -38 / 2.4, angle: -.18, slot: "claw", layer: 4 },
	{ id: "clawR", parent: "root", x: 45 / 2.4, y: 38 / 2.4, angle: .18, slot: "claw", layer: 4, flipY: true },
];

export const MILLIPEDE_RIG: Rig = [
	{ id: "root", x: 0, y: 0, layer: 0 },
	...Array.from({ length: MILLIPEDE_SEGMENT_COUNT }, (_, index): Bone[] => {
		const segment = `segment${index}`;
		return [
			{ id: segment, parent: "root", x: -(index + 1) * MILLIPEDE_SPACING / BOSS_SCALE.millipede, y: 0, layer: 0 },
			{ id: `legL${index}`, parent: segment, x: 0, y: -12 / BOSS_SCALE.millipede, angle: -.8, slot: `legsL${index}`, layer: 0, flipY: true },
			{ id: `legR${index}`, parent: segment, x: 0, y: 12 / BOSS_SCALE.millipede, angle: .8, slot: `legsR${index}`, layer: 0 },
			{ id: `segmentBody${index}`, parent: segment, x: 0, y: 0, slot: `body${index}`, layer: 1 },
			{ id: `segmentShell${index}`, parent: segment, x: 0, y: 0, slot: `shell${index}`, layer: 2 },
		];
	}).flat(),
	{ id: "head", parent: "root", x: 0, y: 0, slot: "head", layer: 4 },
];

const RHINO_SKIN: Skin = { body: "bossRhinoBody", shell: "bossRhinoShell", head: "bossRhinoHead", horn: "bossRhinoHorn", legs: "bossRhinoLeg" };
const SCORPION_SKIN: Skin = { body: "bossScorpionBody", shell: "bossScorpionShell", head: "bossScorpionHead", claw: "bossScorpionClaw", tail: "bossScorpionTail", stinger: "bossScorpionStinger", legs: "bossScorpionLeg" };

export function bossRig(variant: BossVariant): Rig {
	return variant === "rhinoceros" ? RHINOCEROS_RIG : variant === "scorpion" ? SCORPION_RIG : MILLIPEDE_RIG;
}

const MILLIPEDE_SKIN: Skin = (() => {
	const skin: Record<string, SpritePart | undefined> = { head: "bossMillipedeHead" };
	const shells: readonly SpritePart[] = ["bossMillipedeShellA", "bossMillipedeShellB", "bossMillipedeShellC", "bossMillipedeShellD", "bossMillipedeShellE", "bossMillipedeShellF"];
	for (let index = 0; index < MILLIPEDE_SEGMENT_COUNT; index++) {
		const weak = isMillipedeWeak(index);
		const front = index < 2, tail = index === MILLIPEDE_SEGMENT_COUNT - 1;
		skin[`body${index}`] = weak ? "bossMillipedeBodyWeak" : front ? "bossMillipedeNeckBody" : tail ? "bossMillipedeTailBody" : "bossMillipedeBody";
		skin[`shell${index}`] = weak ? "bossMillipedeShellWeak" : front ? "bossMillipedeNeckShell" : tail ? "bossMillipedeTailShell" : shells[index % shells.length];
		skin[`legsL${index}`] = "bossMillipedeLeg";
		skin[`legsR${index}`] = "bossMillipedeLeg";
	}
	return skin;
})();

export function bossSkin(variant: BossVariant): Skin {
	return variant === "rhinoceros" ? RHINO_SKIN : variant === "scorpion" ? SCORPION_SKIN : MILLIPEDE_SKIN;
}

function stride(distance: number, time: number, offset: number, speed = 1) {
	return Math.sin(distance / 22 + time * speed + offset);
}

function rhinoPose(boss: Boss, time: number): Pose {
	const pose: Record<string, Transform> = { root: { angle: boss.angle }, body: { y: Math.abs(stride(boss.walkDistance, time, 0)) * .7 }, shell: { y: Math.abs(stride(boss.walkDistance, time, 0)) * .7 } };
	const charge = boss.phase === "charge" ? 1 : boss.phase === "chargeWindup" ? .45 : 0;
	for (let side = 0; side < 2; side++) for (let row = 0; row < 3; row++) {
		const step = stride(boss.walkDistance, time, (side + row) * Math.PI, charge ? 2.2 : 1);
		pose[`leg${side === 0 ? "L" : "R"}${row}`] = { x: step * (charge ? 2.4 : 1.5), angle: step * .12 + (boss.phase === "stuck" ? (side ? -.08 : .08) : 0), scaleX: .72 };
	}
	const sweep = boss.phase === "sweepWindup" ? -.16 : boss.phase === "sweep" ? .2 : 0;
	const lift = boss.phase === "liftWindup" ? -.08 : boss.phase === "lift" ? .15 : 0;
	pose.head = { y: sweep * 14 + lift * 5, angle: sweep + lift };
	pose.horn = { angle: sweep * 1.6 + lift * 1.2 };
	return pose;
}

function scorpionPose(boss: Boss, time: number): Pose {
	const pose: Record<string, Transform> = { root: { angle: boss.angle } };
	for (let side = 0; side < 2; side++) for (let row = 0; row < 4; row++) {
		const step = stride(boss.walkDistance, time, (side + row) * Math.PI, 1.15);
		pose[`leg${side === 0 ? "L" : "R"}${row}`] = { x: step * 1.7, angle: step * .18, scaleX: .72 };
	}
	const clawHealth = boss.claws ?? [1, 1];
	const clawAction = boss.phase === "clawWindup" ? -.25 : boss.phase === "claw" ? .18 : 0;
	const activeClaw = (boss.attackIndex - 1 + 3) % 3;
	pose.clawL = { angle: activeClaw === 0 ? clawAction : 0, opacity: clawHealth[0] > 0 ? 1 : 0 };
	pose.clawR = { angle: activeClaw === 1 ? -clawAction : 0, opacity: clawHealth[1] > 0 ? 1 : 0 };
	const sting = boss.phase === "stingWindup" ? -.22 : boss.phase === "sting" ? .28 : boss.phase === "embedded" ? .42 : 0;
	pose.tail0 = { angle: sting * .25 };
	pose.tail1 = { angle: sting * .35 };
	pose.tail2 = { angle: sting * .45 };
	pose.tail3 = { angle: sting * .55 };

	// During a sting the tail tip reaches the locked target.  The offset is
	// expressed in the tail3 parent frame because resolveRig applies each
	// child transform before the final boss scale and root rotation.
	if (boss.phase === "stingWindup" || boss.phase === "sting" || boss.phase === "embedded") {
		const reach = boss.phase === "stingWindup" ? Math.max(0, Math.min(1, 1 - boss.remaining / 1.15)) : 1;
		const scale = BOSS_SCALE.scorpion;
		const dx = (boss.target.x - boss.x) / scale, dy = (boss.target.y - boss.y) / scale;
		const c = Math.cos(boss.angle), s = Math.sin(boss.angle);
		const targetX = dx * c + dy * s, targetY = -dx * s + dy * c;

		// Stretch the entire tail along a shallow curve. Moving only the leaf
		// stinger leaves it disconnected from the coiled tail at long targets.
		const rest: { x: number; y: number }[] = [{ x: SCORPION_TAIL_X[0], y: 0 }];
		const restAngles: number[] = [SCORPION_TAIL_ANGLES[0]];
		for (let index = 1; index < SCORPION_TAIL_X.length; index++) {
			const parentAngle = restAngles[index - 1];
			const parent = rest[index - 1];
			rest.push({ x: parent.x + Math.cos(parentAngle) * SCORPION_TAIL_X[index], y: parent.y + Math.sin(parentAngle) * SCORPION_TAIL_X[index] });
			restAngles.push(parentAngle + SCORPION_TAIL_ANGLES[index]);
		}
		const pathX = targetX - rest[0].x, pathY = targetY - rest[0].y, pathLength = Math.hypot(pathX, pathY) || 1;
		const curve = Math.min(2, pathLength * .03), normalX = -pathY / pathLength, normalY = pathX / pathLength;
		const strike = rest.map((point, index) => {
			const t = index / (rest.length - 1);
			return { x: rest[0].x + pathX * t + normalX * Math.sin(Math.PI * t) * curve, y: rest[0].y + pathY * t + normalY * Math.sin(Math.PI * t) * curve };
		});
		const chain = rest.map((point, index) => ({ x: point.x + (strike[index].x - point.x) * reach, y: point.y + (strike[index].y - point.y) * reach }));
		const chainAngles: number[] = [];
		for (let index = 0; index < 4; index++) {
			const parent = index === 0 ? { x: 0, y: 0 } : chain[index - 1];
			const parentAngle = index === 0 ? 0 : chainAngles[index - 1];
			const child = chain[index], localX = child.x - parent.x, localY = child.y - parent.y;
			const desiredAngle = Math.atan2(localY, localX);
			pose[`tail${index}`] = {
				x: localX * Math.cos(parentAngle) + localY * Math.sin(parentAngle) - SCORPION_TAIL_X[index],
				y: -localX * Math.sin(parentAngle) + localY * Math.cos(parentAngle),
				angle: desiredAngle - parentAngle - SCORPION_TAIL_ANGLES[index],
			};
			chainAngles.push(desiredAngle);
		}
		const tailParent = chain[3], tailParentAngle = chainAngles[3], stinger = chain[4];
		const stingerDX = stinger.x - tailParent.x, stingerDY = stinger.y - tailParent.y;
		pose.stinger = {
			x: stingerDX * Math.cos(tailParentAngle) + stingerDY * Math.sin(tailParentAngle) - SCORPION_TAIL_X[4],
			y: -stingerDX * Math.sin(tailParentAngle) + stingerDY * Math.cos(tailParentAngle),
			angle: Math.atan2(stingerDY, stingerDX) - tailParentAngle - SCORPION_TAIL_ANGLES[4],
		};
	} else {
		pose.stinger = { angle: 0 };
	}
	return pose;
}

function millipedePose(boss: Boss, time: number): Pose {
	const pose: Record<string, Transform> = { root: { angle: boss.angle } };
	const segments = boss.segments ?? [];
	const gait = boss.phase === "crossing" ? 1.8 : boss.phase === "turn" ? 1.05 : 1.35;
	const c = Math.cos(boss.angle), s = Math.sin(boss.angle), scale = BOSS_SCALE.millipede;
	for (let index = 0; index < MILLIPEDE_SEGMENT_COUNT; index++) {
		const expectedDistance = (index + 1) * MILLIPEDE_SPACING;
		const segment = segments[index] ?? { x: boss.x - c * expectedDistance, y: boss.y - s * expectedDistance };
		const dx = segment.x - boss.x, dy = segment.y - boss.y;
		const x = dx * c + dy * s, y = -dx * s + dy * c;
		const leader = index === 0 ? boss : segments[index - 1] ?? boss;
		const segmentAngle = Math.atan2(leader.y - segment.y, leader.x - segment.x) - boss.angle;
		const baseX = -(index + 1) * MILLIPEDE_SPACING / scale;
		const liveSegment = segments[index];
		const visible = liveSegment !== undefined;
		pose[`segment${index}`] = { x: x / scale - baseX, y: y / scale, angle: segmentAngle, opacity: visible ? 1 : 0 };
		const step = stride(boss.walkDistance + index * 6, time, index * .9, gait);
		pose[`legL${index}`] = { angle: -.8 + step * .18, x: step * 1.3, scaleY: visible ? 1 : 0 };
		pose[`legR${index}`] = { angle: .8 - step * .18, x: -step * 1.3, scaleY: visible ? 1 : 0 };
	}
	pose.head = { y: Math.sin(time * 3) * .8, angle: boss.phase === "turn" ? .15 : 0 };
	return pose;
}

export function bossPose(boss: Boss, time: number): Pose {
	return boss.variant === "rhinoceros" ? rhinoPose(boss, time) : boss.variant === "scorpion" ? scorpionPose(boss, time) : millipedePose(boss, time);
}

/** Draw a live boss or its static portrait. The caller supplies world/portrait coordinates in boss.x/y. */
export function drawBoss(ctx: CanvasRenderingContext2D, sprites: Sprites, boss: Boss, time: number, _portrait = false) {
	const variant = boss.variant as BossVariant;
	const skin = bossSkin(variant);
	const rig = bossRig(variant);
	drawRig(ctx, sprites, rig, skin, bossPose(boss, time), boss.x, boss.y, BOSS_SCALE[variant]);
}
