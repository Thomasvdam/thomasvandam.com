import { BOSS_ATTACKS } from "./boss-patterns";
import type { Boss, BossSegment, MillipedePattern, SafeZone } from "./boss-types";
import { MILLIPEDE_SEGMENT_COUNT, MILLIPEDE_SPACING, millipedeSectionRadius } from "./boss-types";
import { clamp, distanceToSegment, segmentHitTime, type Vector } from "./math";
import { FIELD, type Game } from "./game";
import { inFlame } from "./remains";
import { attackDamage, hurtPlayer } from "./player-damage";

export const MILLIPEDE_RAMPAGE_TIME = 8;
export const MILLIPEDE_RETURN_TIME = 3;
export const MILLIPEDE_SWIPE = BOSS_ATTACKS.millipedeSwipe;
export const MILLIPEDE_TELL_TIME = BOSS_ATTACKS.crossing.windup;
export const ACID_POOL_LIFETIME = 10;
export const ACID_POOL_RADIUS = 52;
export const ACID_POOL_TICK = .5;
export const ACID_BOMB_FLIGHT = 1.1;
export const MILLIPEDE_PATTERNS: readonly MillipedePattern[] = ["zigzag", "lattice", "diagonal"];

export function insideSafeZone(point: Vector, safe: SafeZone, margin = 0) {
	return point.x >= safe.x - margin && point.x <= safe.x + safe.width + margin && point.y >= safe.y - margin && point.y <= safe.y + safe.height + margin;
}
export function rampageSafeZone(pattern: MillipedePattern, player: Vector): SafeZone {
	// The opening is reachable from the starting position, but never centred on
	// it: reading the tell and moving is required, even without acid or terrain.
	const x = clamp(player.x + (player.x < FIELD.width / 2 ? 260 : -260), 190, FIELD.width - 190);
	const y = clamp(player.y + (player.y < FIELD.height / 2 ? 240 : -240), 205, FIELD.height - 205);
	if (pattern === "diagonal") return { x: clamp(player.x, 120, FIELD.width - 120) - 90, y: clamp(player.y + (player.y < FIELD.height / 2 ? 240 : -240), 110, FIELD.height - 110) - 70, width: 180, height: 140 };
	if (pattern === "zigzag") return { x: 0, y: y - 85, width: FIELD.width, height: 170 };
	return { x: x - 110, y: y - 90, width: 220, height: 180 };
}
export function initMillipede(boss: Boss) {
	boss.x = FIELD.width / 2; boss.y = 185; boss.angle = Math.PI / 2; boss.phase = "emerge"; boss.remaining = 2;
	boss.millipede = { rampages: 0, pattern: "zigzag", safe: rampageSafeZone("zigzag", boss), elapsed: 0, acidTime: 0, shotTimer: .6, bombTimer: 2.8, swipeTimer: 1, headHidden: false, poolTick: 0, bombs: [], pools: [] };
	boss.segments = Array.from({ length: MILLIPEDE_SEGMENT_COUNT }, () => ({ x: 0, y: 0 }));
	positionMillipede(boss);
}

// Six full passes build behind a fast front and keep flowing between edges.
// Detached sections wrap only off-screen; withdrawal stops feeding each pass.
const PER_PASS = MILLIPEDE_SEGMENT_COUNT / 6;
const PASS_LENGTH = PER_PASS * MILLIPEDE_SPACING;
const PATH_LENGTH = PASS_LENGTH * 6;
const TRAVEL_TIME = PATH_LENGTH / BOSS_ATTACKS.crossing.speed;
export function millipedeNormalPhase(boss: Boss) {
	return boss.phase === "acid" || boss.phase === "bombWindup" || boss.phase === "sweepWindup" || boss.phase === "sweep";
}
// Distribute whole passes on either side of the opening; never cut a pass.
function lane(index: number, count: number, min: number, max: number, gapMin: number, gapMax: number) {
	const left = Math.max(0, Math.min(max, gapMin) - min), rightStart = Math.max(min, gapMax);
	const right = Math.max(0, max - rightStart), along = (index + .5) / count * (left + right);
	return along < left ? min + along : rightStart + along - left;
}
export function millipedePathPoint(pattern: MillipedePattern, pass: number, along: number, point: BossSegment = { x: 0, y: 0 }, safe = rampageSafeZone(pattern, { x: 560, y: 360 })) {
	const direction = pass % 2 ? -1 : 1;
	if (pattern === "diagonal") {
		const slope = .48, margin = 64 * (1 + slope);
		const intercept = lane(pass, 6, -slope * FIELD.width + 30, FIELD.height - 30, safe.y - slope * (safe.x + safe.width) - margin, safe.y + safe.height - slope * safe.x + margin);
		const startX = Math.max(-80, (-80 - intercept) / slope), endX = Math.min(FIELD.width + 80, (FIELD.height + 80 - intercept) / slope);
		const ux = 1 / Math.hypot(1, slope), distance = along * direction;
		point.x = (direction > 0 ? startX : endX) + distance * ux; point.y = slope * point.x + intercept;
		point.angle = Math.atan(slope) + (direction > 0 ? 0 : Math.PI);
	} else if (pattern === "lattice" && pass >= 3) {
		point.x = lane(pass - 3, 3, 38, FIELD.width - 38, safe.x - 64, safe.x + safe.width + 64);
		point.y = direction > 0 ? -368 + along : FIELD.height + 368 - along; point.angle = direction * Math.PI / 2;
	} else {
		point.x = direction > 0 ? -168 + along : FIELD.width + 168 - along;
		point.y = lane(pass, pattern === "lattice" ? 3 : 6, 38, FIELD.height - 38, safe.y - 64, safe.y + safe.height + 64);
		point.angle = direction > 0 ? 0 : Math.PI;
	}
	return point;
}
export function millipedeCoilPoint(index: number, point: BossSegment = { x: 0, y: 0 }) {
	if (index < 6) { point.x = FIELD.width / 2 + Math.sin(index / 5 * Math.PI) * 30; point.y = 185 - (index + 1) * 25; point.angle = Math.PI / 2; }
	else {
		const t = index - 6, angle = -Math.PI / 2 + t * .28, radius = 127 + t * .8;
		point.x = FIELD.width / 2 + Math.cos(angle) * radius * 1.2; point.y = 60 + Math.sin(angle) * radius * .42; point.angle = Math.atan2(-Math.cos(angle) * .42, Math.sin(angle) * 1.2);
	}
	return point;
}
export const MILLIPEDE_DRAIN_TIME = PASS_LENGTH / BOSS_ATTACKS.crossing.speed;
// Follow the coil backwards from an off-screen feeder, ending at the raised head.
// Every section follows the same continuous curve instead of appearing in place.
export function millipedeReturningPoint(boss: Boss, index: number, point: BossSegment = { x: 0, y: 0 }) {
	const t = clamp(((boss.millipede?.elapsed ?? 0) - MILLIPEDE_DRAIN_TIME) / (MILLIPEDE_RETURN_TIME - MILLIPEDE_DRAIN_TIME), 0, 1);
	const sample = index + (1 - t) * 100;
	if (sample > 75) { millipedeCoilPoint(75, point); point.y -= (sample - 75) * 26; point.angle = Math.PI / 2; }
	else if (sample < 0) { point.x = FIELD.width / 2; point.y = 160 - sample * 25; point.angle = Math.PI / 2; }
	else {
		const from = Math.floor(sample), blend = sample - from;
		millipedeCoilPoint(from, point);
		// Smooth the join between the last neck section and the coil.
		{
			const next = millipedeCoilPoint(from + 1); point.x += (next.x - point.x) * blend; point.y += (next.y - point.y) * blend;
			point.angle = Math.atan2(point.y - next.y, point.x - next.x);
		}
	}
	return point;
}
// Paint trailing sections first even after a detached pass wraps off-screen.
// Otherwise the array seam draws a round leading plate in the middle of a pass.
export function millipedePaintIndex(boss: Boss, paint: number) {
	if (boss.phase !== "crossing" && boss.phase !== "return") return paint;
	const pass = Math.floor(paint / PER_PASS), order = PER_PASS - 1 - paint % PER_PASS;
	const distance = (boss.phase === "return" ? MILLIPEDE_RAMPAGE_TIME : boss.millipede?.elapsed ?? 0) * BOSS_ATTACKS.crossing.speed - pass * PASS_LENGTH;
	const local = distance < PASS_LENGTH ? PER_PASS - 1 - order : ((Math.floor((distance % PASS_LENGTH) / MILLIPEDE_SPACING) - order) % PER_PASS + PER_PASS) % PER_PASS;
	return pass * PER_PASS + local;
}
type PassGeometry = { x: number; y: number; angle: number; ux: number; uy: number };
const passCache = new WeakMap<NonNullable<Boss["millipede"]>, { key: string; passes: PassGeometry[] }>();
function cachedPasses(state: NonNullable<Boss["millipede"]>) {
	const safe = state.safe, key = `${state.pattern}:${safe.x}:${safe.y}:${safe.width}:${safe.height}`;
	let cached = passCache.get(state);
	if (!cached || cached.key !== key) {
		cached = { key, passes: Array.from({ length: 6 }, (_, pass) => {
			const point = millipedePathPoint(state.pattern, pass, 0, undefined, safe), angle = point.angle!;
			return { x: point.x, y: point.y, angle, ux: Math.cos(angle), uy: Math.sin(angle) };
		}) }; passCache.set(state, cached);
	}
	return cached.passes;
}
function placeOnPass(point: BossSegment, pass: PassGeometry, along: number) {
	point.x = pass.x + pass.ux * along; point.y = pass.y + pass.uy * along; point.angle = pass.angle;
}
export function positionMillipede(boss: Boss) {
	const state = boss.millipede; if (!state) return;
	const crossing = boss.phase === "crossing", returning = boss.phase === "return";
	const passes = crossing || returning ? cachedPasses(state) : null;
	let previousAlong = 0;
	for (let index = 0; index < boss.segments.length; index++) {
		const point = boss.segments[index];
		if (!crossing && !returning && index >= 76) { point.hidden = true; point.breakBefore = true; continue; }
		if (crossing || returning) {
			const pass = Math.floor(index / PER_PASS), local = index % PER_PASS;
			const time = returning ? MILLIPEDE_RAMPAGE_TIME : state.elapsed;
			const distance = time * BOSS_ATTACKS.crossing.speed - pass * PASS_LENGTH;
			let along = distance - local * MILLIPEDE_SPACING;
			// Wrapping happens only beyond the entry/exit edges. Each individual
			// section travels continuously through the complete visible pass.
			if (distance >= PASS_LENGTH) along = ((along % PASS_LENGTH) + PASS_LENGTH) % PASS_LENGTH;
			if (returning) along += state.elapsed * BOSS_ATTACKS.crossing.speed;
			placeOnPass(point, passes![pass], along);
			point.hidden = distance < 0 || along < 0;
			const previous = boss.segments[index - 1];
			point.breakBefore = local === 0 || point.hidden || previous.hidden || Math.abs(along - previousAlong) > MILLIPEDE_SPACING * 2;
			previousAlong = along;
		} else {
			millipedeCoilPoint(index, point); point.hidden = false; point.breakBefore = index === 6;
		}
	}
	if (crossing) {
		const front = state.elapsed * BOSS_ATTACKS.crossing.speed, pass = Math.min(5, Math.floor(front / PASS_LENGTH));
		placeOnPass(boss, passes![pass], front - pass * PASS_LENGTH);
		state.headHidden = front >= PATH_LENGTH;
	} else if (returning) {
		millipedeReturningPoint(boss, -1, boss); state.headHidden = state.elapsed <= MILLIPEDE_DRAIN_TIME;
	} else {
		boss.x = FIELD.width / 2; boss.y = 185;
		if (boss.phase !== "sweepWindup" && boss.phase !== "sweep") boss.angle = Math.PI / 2;
		state.headHidden = false;
	}
}
function startRampage(game: Game, boss: Boss) {
	const state = boss.millipede!;
	state.pattern = MILLIPEDE_PATTERNS[((game.runSeed >>> 0) + state.rampages) % MILLIPEDE_PATTERNS.length];
	state.safe = rampageSafeZone(state.pattern, game.player); state.rampages++; state.elapsed = 0;
	boss.phase = "crossingWindup"; boss.remaining = MILLIPEDE_TELL_TIME;
	positionMillipede(boss);
}
function stepAcidPools(game: Game, boss: Boss, dt: number) {
	const state = boss.millipede!;
	state.bombs = state.bombs.filter(bomb => {
		bomb.age += dt;
		if (bomb.age < ACID_BOMB_FLIGHT) return true;
		state.pools.push({ ...bomb.target, bornAt: game.time });
		if (state.pools.length > 16) state.pools.shift();
		return false;
	});
	state.pools = state.pools.filter(pool => game.time - pool.bornAt < ACID_POOL_LIFETIME);
	const exposed = state.pools.some(pool => Math.hypot(pool.x - game.player.x, pool.y - game.player.y) <= ACID_POOL_RADIUS + 14);
	if (!exposed) { state.poolTick = 0; return; }
	if (game.time + .00000001 >= state.poolTick) {
		// DOT has one shared tick clock, so overlapping puddles do not stack or
		// grant the normal hit invulnerability that could shield against a rampage.
		game.player.health = Math.max(0, game.player.health - attackDamage(3, game.hivesCleared, game.parts.armour));
		state.poolTick = game.time + ACID_POOL_TICK;
	}
}
function acidVolley(game: Game, boss: Boss, wide = false) {
	const angle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
	const spreads = wide ? Array.from({ length: 11 }, (_, i) => (i - 5) * .22) : [-.18, 0, .18];
	for (const spread of spreads) if (game.acid.length < 64) game.acid.push({ id: game.nextId++, owner: -1, x: boss.x + Math.cos(angle) * 26, y: boss.y + Math.sin(angle) * 26, vx: Math.cos(angle + spread) * 300, vy: Math.sin(angle + spread) * 300, life: 4.5 });
}
export function stepMillipede(game: Game, boss: Boss, dt: number) {
	const state = boss.millipede; if (!state) return;
	stepAcidPools(game, boss, dt); state.elapsed += dt;
	const thresholds = Math.min(4, Math.floor((1 - boss.health / boss.maxHealth + .000001) * 5));
	if (millipedeNormalPhase(boss) && thresholds > state.rampages) { startRampage(game, boss); return; }
	if (boss.phase === "emerge" || boss.phase === "return") {
		if (!boss.remaining) {
			boss.phase = "acid"; state.elapsed = 0; state.acidTime = 0; state.shotTimer = .95; state.bombTimer = 2.5; state.swipeTimer = .8;
			positionMillipede(boss); acidVolley(game, boss, true);
		}
	} else if (boss.phase === "crossingWindup") {
		if (!boss.remaining) { boss.phase = "crossing"; boss.remaining = MILLIPEDE_RAMPAGE_TIME; state.elapsed = 0; }
	} else if (boss.phase === "crossing") {
		if (!boss.remaining) { boss.phase = "return"; boss.remaining = MILLIPEDE_RETURN_TIME; state.elapsed = 0; }
	} else {
		state.acidTime += dt; state.swipeTimer -= dt;
		state.shotTimer -= dt; state.bombTimer -= dt;
		if (boss.phase === "sweepWindup") {
			if (!boss.remaining) { boss.phase = "sweep"; boss.remaining = MILLIPEDE_SWIPE.active; }
		} else if (boss.phase === "sweep") {
			if (!boss.remaining) { boss.phase = "acid"; state.swipeTimer = 1.7; }
		} else if (Math.hypot(game.player.x - boss.x, game.player.y - boss.y) < 195 && state.swipeTimer <= 0) {
			boss.angle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x); boss.phase = "sweepWindup"; boss.remaining = MILLIPEDE_SWIPE.windup;
		} else if (boss.phase === "bombWindup") {
			if (!boss.remaining) { state.bombs.push({ from: { x: boss.x, y: boss.y }, target: { ...boss.target }, age: 0 }); state.bombTimer = 3.5; boss.phase = "acid"; }
		} else if (state.bombTimer <= 0) {
			boss.target = { x: game.player.x, y: game.player.y }; boss.phase = "bombWindup"; boss.remaining = .75;
		} else if (state.shotTimer <= 0) { acidVolley(game, boss); state.shotTimer = .95; }
	}
	if (boss.phase === "sweep" && inFlame(game.player, 14, boss, boss.angle, MILLIPEDE_SWIPE.range, MILLIPEDE_SWIPE.halfAngle)) hurtPlayer(game, MILLIPEDE_SWIPE.damage);
	boss.walkDistance += dt * (boss.phase === "crossing" || boss.phase === "return" ? PATH_LENGTH / TRAVEL_TIME : 10);
	positionMillipede(boss);
}

// Preserve head, endpoint, bridge order without constructing temporary capsules.
function capsuleEnd(boss: Boss, index: number): Vector { return index === 0 ? boss : boss.segments[Math.ceil(index / 2) - 1]; }
function capsuleStart(boss: Boss, index: number, end: Vector): Vector {
	return index > 0 && index % 2 === 0 ? index === 2 ? boss : boss.segments[index / 2 - 2] : end;
}

// Sweep the mech against connected body capsules, then resolve body motion into it.
export function resolveMillipedeBarrier(boss: Boss, player: Vector, previous: Vector, radius = 14) {
	if (boss.variant !== "millipede" || boss.health <= 0 || (boss.phase === "emerge" || boss.phase === "crossingWindup" || boss.phase === "return")) return false;
	const count = 1 + boss.segments.length * 2;
	const minX = Math.min(previous.x, player.x), maxX = Math.max(previous.x, player.x);
	const minY = Math.min(previous.y, player.y), maxY = Math.max(previous.y, player.y);
	let contact = false, hit = Infinity;
	for (let i = 0; i < count; i++) {
		const to = capsuleEnd(boss, i);
		if ((i === 0 && boss.millipede?.headHidden) || (i > 0 && (boss.segments[Math.ceil(i / 2) - 1].hidden || (i % 2 === 0 && boss.segments[i / 2 - 1].breakBefore)))) continue;
		const from = capsuleStart(boss, i, to), required = (i ? millipedeSectionRadius(boss) : 24) + radius;
		if (maxX < Math.min(from.x, to.x) - required || minX > Math.max(from.x, to.x) + required || maxY < Math.min(from.y, to.y) - required || minY > Math.max(from.y, to.y) + required) continue;
		if (distanceToSegment(previous, from, to) <= required + .1) continue;
		hit = Math.min(hit, segmentHitTime(player, previous, from, to, required));
	}
	if (hit <= 1) { const t = Math.max(0, hit - .001); player.x = previous.x + (player.x - previous.x) * t; player.y = previous.y + (player.y - previous.y) * t; contact = true; }
	for (let iteration = 0; iteration < 6; iteration++) {
		let changed = false;
		for (let i = 0; i < count; i++) {
			const to = capsuleEnd(boss, i);
			if ((i === 0 && boss.millipede?.headHidden) || (i > 0 && (boss.segments[Math.ceil(i / 2) - 1].hidden || (i % 2 === 0 && boss.segments[i / 2 - 1].breakBefore)))) continue;
			const from = capsuleStart(boss, i, to), required = (i ? millipedeSectionRadius(boss) : 24) + radius;
			if (player.x < Math.min(from.x, to.x) - required || player.x > Math.max(from.x, to.x) + required || player.y < Math.min(from.y, to.y) - required || player.y > Math.max(from.y, to.y) + required) continue;
			const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
			const t = length ? clamp(((player.x - from.x) * dx + (player.y - from.y) * dy) / length, 0, 1) : 0;
			const x = from.x + dx * t, y = from.y + dy * t, distance = Math.hypot(player.x - x, player.y - y);
			if (distance >= required) continue;
			let nx = player.x - x, ny = player.y - y;
			if (distance < .001) { nx = previous.x - x; ny = previous.y - y; if (Math.hypot(nx, ny) < .001) { nx = -dy || 1; ny = dx; } }
			const normal = Math.hypot(nx, ny); player.x = x + nx / normal * (required + .05); player.y = y + ny / normal * (required + .05); changed = true; contact = true;
		}
		player.x = clamp(player.x, radius, FIELD.width - radius); player.y = clamp(player.y, radius, FIELD.height - radius);
		if (!changed) break;
	}
	return contact;
}
