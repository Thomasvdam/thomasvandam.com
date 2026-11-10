import { Stone, surfaceMove } from "./surface";
import { distance, NestNode, noise, Point, radius, Scent, segmentDistance, tunnelPoint } from "./nest";
export type Role = "forager" | "nurse" | "digger" | "cleaner" | "soldier";
export const ROLES: Role[] = ["forager", "nurse", "digger", "cleaner", "soldier"];
export const DT = .05;
export const BATCH_SIZE = 12;
export const BATCH_FOOD = 12;
export const BATCH_SECONDS = 12;
export const FIELD_COLS = 96;
export const FIELD_ROWS = 18;
export const ENTRANCE: Point = { x: 450, y: 175 };
export const RIVAL_HOME: Point = { x: 890, y: 175 };
export const DUMP: Point = { x: 365, y: 170 };
export type Cargo = { kind: "food" | "soil" | "water" | "waste" | "brood"; amount: number; brood?: number };
export type Ant = Point & {
  id: number; role: Role; team: "home" | "rival"; health: number; fighting: boolean; reportNest: boolean; raid: boolean; angle: number; zone: "nest" | "surface"; node: number; previous: number;
  edge: { from: number; to: number; t: number } | null; local: Point | null;
  cargo: Cargo | null; memory: Point[]; returning: boolean; explored: number;
  probe?: Point & { angle: number; anchor: number };
  bornAt?: number;
  hunger: number; rest: number; stationary: number; waiting: number; recovery: number; recent: number[]; action: string; speed: number;
};
export type Brood = Point & { id: number; role: Role; node: number; carrier: number | null; fed: number; care: number; age: number; neglect: number; batch?: number };
export type FoodSource = Point & { id: number; amount: number; initial: number; lifted?: boolean };
export type Colony = {
  tick: number; seed: number; nest: NestNode[]; ants: Ant[]; brood: Brood[]; sources: FoodSource[];
  alarm: Float32Array; stones: Stone[]; held: { kind: "food" | "stone"; id: number } | null;
  effects: (Point & { kind: "wash" | "strike"; until: number })[];
  fallen: (Point & { team: "home" | "rival"; until: number })[];
  rival: { enabled: boolean; ants: Ant[]; trail: Float32Array; raidTrail: Float32Array; stored: number; delivered: number; eaten: number; broodFood: number; alert: number; nestDiscovered: boolean; nextAnt: number; broodClock: number; defeated: number; stolen: number };
  trail: Float32Array; nextRole: Role; nextAnt: number; nextBrood: number; nextNode: number;
  nextBatch: number; batch: { id: number; role: Role; total: number; hatched: number; started: number } | null;
  notice: { text: string; point: Point | null } | null;
  eggClock: number; queenHealth: number; queenHunger: number; result: "alive" | "lost";
  totals: { delivered: number; eaten: number; fed: number; hatched: number; soil: number; waste: number; water: number; rain: number; addedFood: number; addedWater: number; drained: number; preparedFood: number; casualties: number; strikes: number };
  log: { time: number; text: string }[];
};
const SCENTS: Scent[] = ["home", "store", "food", "brood", "nursery", "work", "clean", "crowd", "alarm"];
export const emptyScents = (): Record<Scent, number> => ({ home: 0, store: 0, food: 0, brood: 0, nursery: 0, work: 0, clean: 0, crowd: 0, alarm: 0 });
export const elapsed = (s: Colony) => s.tick * DT;
export const rainy = (s: Colony) => elapsed(s) >= 150 && elapsed(s) % 180 < 28;
export const storedFood = (s: Colony) => s.nest.reduce((sum, n) => sum + n.food, 0);
export const counts = (s: Colony) => Object.fromEntries(ROLES.map(role => [role, s.ants.filter(a => a.role === role).length])) as Record<Role, number>;
export const fieldIndex = (x: number, y: number) => Math.max(0, Math.min(FIELD_ROWS - 1, Math.floor(y / 10))) * FIELD_COLS + Math.max(0, Math.min(FIELD_COLS - 1, Math.floor(x / 10)));
const random = (s: Colony) => { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; };
const journal = (s: Colony, text: string) => { s.log = [{ time: elapsed(s), text }, ...s.log].slice(0, 16); };
const nodeAt = (s: Colony, id: number): Point => id === -1 ? ENTRANCE : s.nest.find(n => n.id === id)!;
export function newAnt(id: number, role: Role, n: Point & { id?: number }, zone: Ant["zone"] = "nest"): Ant {
  return { id, role, team: "home", health: role === "soldier" ? 3.2 : 1.2, fighting: false, reportNest: false, raid: false, x: n.x, y: n.y, angle: noise(id + 31) * Math.PI * 2, zone, node: n.id ?? 0, previous: -2,
    edge: null, local: null, cargo: null, memory: zone === "surface" ? [{ ...ENTRANCE }] : [], returning: false, explored: 0,
    hunger: noise(id + 71) * .5, rest: noise(id + 51), stationary: 0, waiting: 0, recovery: 0, recent: [], action: role === "forager" ? "Exploring" : "Sensing nearby signals", speed: 27 + noise(id + 13) * 10 };
}
function cloneAnt(a: Ant): Ant {
  return { ...a, edge: a.edge ? { ...a.edge } : null, local: a.local ? { ...a.local } : null, cargo: a.cargo ? { ...a.cargo } : null, memory: [...a.memory], probe: a.probe ? { ...a.probe } : undefined, recent: [...a.recent] };
}
export function newRival(id: number, role: Role, point: Point = RIVAL_HOME): Ant {
  const a = newAnt(id, role, point, "surface");
  a.team = "rival"; a.angle = Math.PI; a.memory = [{ ...RIVAL_HOME }]; a.action = "Scouting for the rival colony";
  return a;
}
function returnTarget(s: Colony, a: Ant, home: Point) {
  // A stone can cover an old breadcrumb. Skip only waypoints obstructed by a
  // stone the ant can currently sense, so a moved obstacle cannot trap its memory.
  while (a.memory.length > 1 && s.stones.some(o => !o.lifted && distance(a, o) < o.radius + 40 && distance(a.memory.at(-1)!, o) < o.radius + 3)) a.memory.pop();
  return a.memory.at(-1) ?? home;
}
function rivalSurface(s: Colony, a: Ant) {
  if (a.cargo || a.returning || a.reportNest) {
    a.action = a.reportNest ? "Carrying a nest-discovery trail home" : a.cargo ? "Carrying a seed to the rival nest" : "Returning to the rival nest";
    const k = fieldIndex(a.x, a.y);
    if (a.cargo?.kind === "food") s.rival.trail[k] = Math.min(6, s.rival.trail[k] + DT * 1.5);
    if (a.reportNest) s.rival.raidTrail[k] = Math.min(6, s.rival.raidTrail[k] + DT * 3);
    const target = returnTarget(s, a, RIVAL_HOME);
    if (!surfaceMove(a, target, s.stones, DT)) return;
    if (a.memory.length) { a.memory.pop(); return; }
    if (a.reportNest) {
      s.rival.alert = 1; s.rival.nestDiscovered = true;
      journal(s, "A scout reached the rival nest with your entrance's scent. Raiders can now follow its trail.");
    }
    if (a.cargo?.kind === "food") { s.rival.stored += a.cargo.amount; s.rival.delivered += a.cargo.amount; a.cargo = null; }
    if (a.hunger > .5 && s.rival.stored >= 1) { s.rival.stored--; s.rival.eaten++; a.hunger = Math.max(0, a.hunger - .6); }
    a.reportNest = false; a.returning = false; a.explored = 0; a.memory = [{ ...RIVAL_HOME }]; a.angle = Math.PI; a.rest = .6;
    a.raid = s.rival.alert > .1 && (a.role === "soldier" || noise(a.id) > .6);
    return;
  }
  // Recruitment happens at the rival entrance, after a scout has physically returned.
  if (distance(a, RIVAL_HOME) < 22 && s.rival.alert > .1 && (a.role === "soldier" || noise(a.id) > .6)) a.raid = true;
  // The entrance odor is local: raiders approach the doorway only inside its plume.
  if (distance(a, ENTRANCE) < 65) {
    if (a.raid) { a.action = "Entering your colony's tunnels"; if (surfaceMove(a, ENTRANCE, s.stones, DT)) { a.reportNest = true; enterNest(a); } }
    else { a.reportNest = true; a.returning = true; a.action = "Discovered an unfamiliar nest · returning to report"; }
    return;
  }
  if (!a.raid && a.role === "forager") {
    const food = s.sources.find(f => !f.lifted && f.amount > 0 && distance(a, f) < 14);
    if (food) { food.amount--; a.cargo = { kind: "food", amount: 1 }; a.returning = true; return; }
  }
  if (a.hunger > .8) a.returning = true;
  exploreSurface(s, a, a.raid ? s.rival.raidTrail : s.rival.trail);
  if (a.raid) a.action = "Searching along the scout's invasion trail";
  else if (a.role === "soldier") a.action = "Scouting the rival territory";
}
function guardSurface(s: Colony, a: Ant) {
  if (distance(a, ENTRANCE) < 28 && s.nest[0].scent.alarm > .08) {
    a.action = "Entering the nest after sensing an alarm at its doorway"; if (surfaceMove(a, ENTRANCE, s.stones, DT)) enterNest(a); return;
  }
  let strongest = .025; let target: Point | null = null;
  // A soldier samples only the alarm within its own sensory radius.
  for (let dx = -30; dx <= 30; dx += 10) for (let dy = -20; dy <= 20; dy += 10) {
    const p = { x: a.x + dx, y: Math.max(108, Math.min(175, a.y + dy)) };
    const value = s.alarm[fieldIndex(p.x, p.y)] / (1 + Math.hypot(dx, dy) / 45);
    if (value > strongest) { strongest = value; target = p; }
  }
  if (target && distance(a, target) > 3) { a.action = "Following a nearby alarm pheromone"; surfaceMove(a, target, s.stones, DT); return; }
  const patrol = { x: ENTRANCE.x + Math.cos(elapsed(s) * .16 + a.id * 2) * 65, y: 145 + Math.sin(elapsed(s) * .23 + a.id) * 17 };
  a.action = "Patrolling around the nest entrance"; surfaceMove(a, patrol, s.stones, DT);
}
function canMeet(a: Ant, b: Ant) {
  if (a.zone !== b.zone) return false;
  if (a.zone === "surface") return true;
  if (!a.edge && !b.edge) return a.node === b.node;
  if (a.edge && b.edge) return (a.edge.from === b.edge.from && a.edge.to === b.edge.to) || (a.edge.from === b.edge.to && a.edge.to === b.edge.from);
  const edge = (a.edge ?? b.edge)!; const other = a.edge ? b : a;
  return edge.from === other.node || edge.to === other.node;
}
function raiseAlarm(s: Colony, a: Ant) {
  if (a.zone === "surface") s.alarm[fieldIndex(a.x, a.y)] = Math.min(6, s.alarm[fieldIndex(a.x, a.y)] + DT * 6);
  else {
    const n = s.nest.find(n => n.id === (a.edge ? a.edge.t < .5 ? a.edge.from : a.edge.to : a.node));
    if (n) n.scent.alarm = Math.min(4, n.scent.alarm + DT * 6);
  }
}
function combat(s: Colony) {
  const busy = new Set<number>(); const damage = new Map<number, number>();
  const all = [...s.ants, ...s.rival.ants];
  for (const a of all) a.fighting = false;
  for (const a of all) {
    if (a.health <= 0) continue;
    const enemies = a.team === "home" ? s.rival.ants : s.ants;
    let foe: Ant | undefined; let nearest = a.team === "home" ? a.role === "soldier" ? 42 : 24 : a.reportNest || a.cargo ? 24 : 9;
    for (const b of enemies) if (b.health > 0 && canMeet(a, b)) {
      const d = distance(a, b); if (d < nearest && !(a.zone === "surface" && s.stones.some(o => !o.lifted && segmentDistance(o, a, b) < o.radius))) { nearest = d; foe = b; }
    }
    if (!foe) continue;
    if (a.team === "home") raiseAlarm(s, a);
    if (nearest < 9) {
      a.fighting = true; a.rest = 0; a.action = a.team === "home" ? "Biting an invader · releasing alarm" : "Fighting the defending colony";
      a.angle = Math.atan2(foe.y - a.y, foe.x - a.x); busy.add(a.id);
      damage.set(foe.id, (damage.get(foe.id) ?? 0) + DT * (a.role === "soldier" ? 1.1 : .12));
    } else if (a.zone === "surface") {
      if (a.role === "soldier" || (a.team === "rival" && a.raid && !a.cargo)) { surfaceMove(a, foe, s.stones, DT); a.action = "Approaching a nearby enemy"; }
      else { surfaceMove(a, { x: a.x + (a.x - foe.x) * 2, y: a.y + (a.y - foe.y) * 2 }, s.stones, DT); a.action = "Retreating from an enemy · leaving alarm"; }
      busy.add(a.id);
    }
  }
  for (const a of all) { a.health = Math.max(0, a.health - (damage.get(a.id) ?? 0)); if (busy.has(a.id)) a.hunger += DT * (a.role === "soldier" ? .004 : .002); }
  return busy;
}
function rivalBrood(s: Colony) {
  if (!s.rival.enabled || !s.rival.ants.some(a => a.health > 0 && a.hunger <= 1.5)) return;
  s.rival.broodClock -= DT;
  if (s.rival.broodClock > 0) return;
  if (s.rival.stored >= 8 && s.rival.ants.length < 48) {
    s.rival.stored -= 8; s.rival.broodFood += 8;
    for (const role of ["forager", "soldier"] as Role[]) if (s.rival.ants.length < 48) s.rival.ants.push(newRival(s.rival.nextAnt++, role));
  }
  s.rival.broodClock = 16;
}
export function dropCargo(s: Colony, a: Ant) {
  if (!a.cargo) return;
  const cargo = a.cargo;
  const n = s.nest.find(n => n.id === (a.edge ? a.edge.t < .5 ? a.edge.from : a.edge.to : a.node)) ?? s.nest[0];
  if (cargo.kind === "brood") {
    const b = s.brood.find(b => b.id === cargo.brood);
    if (b) { b.carrier = null; b.node = n.id; b.x = a.x; b.y = a.y; }
  } else if (a.zone === "nest") {
    if (cargo.kind === "food") n.food += cargo.amount;
    else if (cargo.kind === "soil") n.spoil = (n.spoil ?? 0) + cargo.amount;
    else n[cargo.kind === "water" ? "water" : "waste"] += cargo.amount;
  } else if (cargo.kind === "food") {
    const source = s.sources.find(f => !f.lifted && distance(a, f) < 15);
    if (source) { source.amount += cargo.amount; source.initial += cargo.amount; }
    else s.sources.push({ id: Math.max(-1, ...s.sources.map(f => f.id)) + 1, x: a.x, y: a.y, amount: cargo.amount, initial: cargo.amount });
  } else if (cargo.kind === "soil" || cargo.kind === "water" || cargo.kind === "waste") s.totals[cargo.kind] += cargo.amount;
  a.cargo = null;
}

export function createColony(seed = 731, rivals = true): Colony {
  const nest: NestNode[] = [
    { id: 0, parent: null, x: 450, y: 198, room: "tunnel", size: 1 },
    { id: 1, parent: 0, x: 464, y: 266, room: "tunnel", size: 1 },
    { id: 2, parent: 1, x: 428, y: 350, room: "tunnel", size: 1 },
    { id: 3, parent: 2, x: 332, y: 371, room: "queen", size: 2.5 },
    { id: 4, parent: 1, x: 573, y: 298, room: "food", size: 2 },
    { id: 5, parent: 2, x: 510, y: 432, room: "nursery", size: 2 },
    { id: 6, parent: 2, x: 396, y: 469, room: "tunnel", size: 1 },
  ].map(n => ({ ...n, room: n.room as NestNode["room"], water: 0, traffic: 0, food: n.id === 4 ? 90 : 0, waste: 0, scent: emptyScents() }));
  const ants: Ant[] = [];
  const initial: [Role, number][] = [["forager", 40], ["nurse", 16], ["digger", 24], ["cleaner", 16], ["soldier", 2]];
  for (const [role, amount] of initial) for (let i = 0; i < amount; i++) {
    const id = ants.length;
    if (role === "soldier" && i < 2) {
      const a = newAnt(id, role, { x: 425 + i * 50, y: 164 }, "surface"); a.action = "Guarding the entrance"; ants.push(a);
    } else if (role === "forager" && i < 40) {
      const a = newAnt(id, role, { x: 300 + noise(id + 21) * 300, y: 125 + noise(id + 9) * 47 }, "surface");
      a.angle = i % 2 ? 0 : Math.PI; ants.push(a);
    } else {
      const n = nest[role === "nurse" ? i % 3 === 0 ? 3 : 5 : role === "digger" ? 2 : i % nest.length];
      const a = newAnt(id, role, n); a.local = { x: n.x + (noise(id) - .5) * radius(n), y: n.y + (noise(id + 3) - .5) * radius(n) * .8 }; ants.push(a);
    }
  }
  const brood: Brood[] = Array.from({ length: 4 }, (_, id) => ({ id, role: ROLES[id % 4], node: 5, carrier: null, x: 487.5 + id % 6 * 9, y: 420 + Math.floor(id / 6) * 8, fed: 0, care: 0, age: 20 + id * 3, neglect: 0 }));
  const rivalAnts = rivals ? Array.from({ length: 12 }, (_, i) => newRival(10000 + i, i < 8 ? "forager" : "soldier", { x: i === 0 ? 620 : 790 + i * 8, y: 140 + i % 3 * 10 })) : [];
  return { tick: 0, seed, nest, ants, brood,
    alarm: new Float32Array(FIELD_COLS * FIELD_ROWS), stones: [], held: null, effects: [], fallen: [],
    rival: { enabled: rivals, ants: rivalAnts, trail: new Float32Array(FIELD_COLS * FIELD_ROWS), raidTrail: new Float32Array(FIELD_COLS * FIELD_ROWS), stored: 12, delivered: 0, eaten: 0, broodFood: 0, alert: 0, nestDiscovered: false, nextAnt: 10012, broodClock: 16, defeated: 0, stolen: 0 }, sources: [
    { id: 0, x: 220, y: 145, amount: 180, initial: 180 }, { id: 1, x: 740, y: 128, amount: 240, initial: 240 },
    { id: 2, x: 65, y: 115, amount: 300, initial: 300 }, { id: 3, x: 895, y: 158, amount: 200, initial: 200 },
  ], trail: new Float32Array(FIELD_COLS * FIELD_ROWS), nextRole: "forager", nextAnt: ants.length, nextBrood: 4, nextNode: 7, nextBatch: 1, batch: null, notice: null,
    eggClock: 8, queenHealth: 100, queenHunger: 0, result: "alive", totals: { delivered: 0, eaten: 0, fed: 0, hatched: 0, soil: 0, waste: 0, water: 0, rain: 0, addedFood: 0, addedWater: 0, drained: 0, preparedFood: 0, casualties: 0, strikes: 0 },
    log: [{ time: 0, text: "A rival nest is exploring the forest floor. Protect your colony, reshape the terrain, or let the ants respond." }] };
}
function walk(a: Ant, p: Point, dt: number) {
  const d = distance(a, p); const move = a.speed * dt;
  if (d > .00001) a.angle = Math.atan2(p.y - a.y, p.x - a.x);
  if (d <= move) { a.x = p.x; a.y = p.y; return true; }
  a.x += (p.x - a.x) / d * move; a.y += (p.y - a.y) / d * move; return false;
}
function surface(s: Colony, a: Ant) {
  if (a.team === "rival") { rivalSurface(s, a); return; }
  if (a.role === "soldier" && !a.cargo && a.hunger <= .8) { guardSurface(s, a); return; }
  if (a.role !== "forager") {
    if (a.cargo) {
      a.action = `Carrying ${a.cargo.kind} outside`;
      if (surfaceMove(a, DUMP, s.stones, DT)) {
        const kind = a.cargo.kind;
        if (kind === "soil" || kind === "waste" || kind === "water") s.totals[kind] += a.cargo.amount;
        a.cargo = null; a.returning = true;
      }
    } else if (surfaceMove(a, ENTRANCE, s.stones, DT)) enterNest(a);
    return;
  }
  if (a.hunger > .8 && !a.cargo) a.returning = true;
  if (a.returning || a.cargo) {
    a.action = a.cargo ? "Carrying food home · marking a trail" : "Returning to the nest";
    if (a.cargo?.kind === "food") {
      const k = fieldIndex(a.x, a.y);
      s.trail[k] = Math.min(6, s.trail[k] + DT * 1.5);
    }
    const target = returnTarget(s, a, ENTRANCE);
    if (surfaceMove(a, target, s.stones, DT)) {
      if (a.memory.length) a.memory.pop();
      else { a.returning = false; a.explored = 0; enterNest(a); }
    }
    return;
  }
  // Only sources within an ant's short sensory range are visible to it.
  const found = s.sources.find(food => !food.lifted && food.amount > 0 && distance(a, food) < 14);
  if (found) {
    found.amount--; a.cargo = { kind: "food", amount: 1 }; a.returning = true;
    if (found.amount === 0) journal(s, "A food patch is exhausted. Its unreplenished trail will fade.");
    return;
  }
  exploreSurface(s, a, s.trail);
}
function exploreSurface(s: Colony, a: Ant, field: Float32Array) {
  const sense = (angle: number) => field[fieldIndex(a.x + Math.cos(angle) * 13, a.y + Math.sin(angle) * 13)];
  const forward = sense(a.angle); const left = sense(a.angle - .65); const right = sense(a.angle + .65);
  const following = Math.max(left, right, forward) > .035;
  if (following && random(s) > .12) {
    if (left > forward && left > right) a.angle -= .22;
    else if (right > forward) a.angle += .22;
    a.angle += (random(s) - .5) * .12;
  } else a.angle += (random(s) - .5) * (a.team === "rival" ? .16 : .48);
  a.action = following ? "Following a food pheromone trail" : "Exploring for food";
  const heading = a.angle;
  surfaceMove(a, { x: a.x + Math.cos(heading) * 20, y: a.y + Math.sin(heading) * 20 }, s.stones, DT);
  if (a.x <= 16 || a.x >= 944) a.angle = Math.PI - a.angle;
  if (a.y <= 108 || a.y >= 175) a.angle = -a.angle;
  const last = a.memory[a.memory.length - 1] ?? (a.team === "rival" ? RIVAL_HOME : ENTRANCE);
  if (distance(a, last) > 10) a.memory.push({ x: a.x, y: a.y });
  a.explored += DT;
  if (a.explored > 55 || a.memory.length >= 250) a.returning = true;
}
function enterNest(a: Ant) { a.zone = "nest"; a.node = -1; a.edge = { from: -1, to: 0, t: 0 }; a.local = null; }
function adjacent(s: Colony, n: NestNode) { return s.nest.filter(other => other.parent === n.id || other.id === n.parent); }
function blockedBetween(a: NestNode, b: NestNode) { return (a.parent === b.id ? a.blocked : b.blocked) ?? 0; }
function neighbors(s: Colony, n: NestNode) { return adjacent(s, n).filter(other => !blockedBetween(n, other)); }
export const nurserySlots = (n: NestNode) => Math.floor(n.size * 12);
export const foodNeeded = (b: Brood) => b.batch === undefined ? 3 : 1;
export const careNeeded = (b: Brood) => b.batch === undefined ? 16 : 2;
export const hatchAge = (b: Brood) => b.batch === undefined ? 45 : BATCH_SECONDS;
export function batchStatus(s: Colony) {
  if (!s.batch) return null;
  const brood = s.brood.filter(b => b.batch === s.batch!.id);
  return { ...s.batch, remaining: brood.length, cared: brood.filter(b => b.care >= careNeeded(b)).length, wet: brood.filter(b => (s.nest.find(n => n.id === b.node)?.water ?? 0) > .3).length, seconds: Math.max(0, BATCH_SECONDS - (elapsed(s) - s.batch.started)) };
}
function moveEdge(s: Colony, a: Ant) {
  const edge = a.edge!; const from = nodeAt(s, edge.from); const to = nodeAt(s, edge.to);
  if (edge.t === 0 && distance(a, from) > .00001) { walk(a, from, DT); return; }
  const nextT = Math.min(1, edge.t + a.speed * DT / Math.max(1, distance(from, to) * 1.15));
  const reverse = edge.from !== -1 && edge.to !== -1 && (from as NestNode).parent === edge.to;
  const child = reverse ? edge.from : edge.to;
  const barrier = s.nest.find(n => n.id === child);
  const stop = Math.max(.05, .5 - 8 / Math.max(1, distance(from, to)));
  const entranceBlocked = (edge.from === -1 || edge.to === -1) && s.stones.some(o => !o.lifted && distance(o, ENTRANCE) < o.radius + 4);
  if ((barrier?.blocked || entranceBlocked) && edge.t < .5 && nextT >= stop) {
    if (barrier?.blocked && a.team === "home" && a.role === "digger" && !a.cargo) {
      barrier.blocked = Math.max(0, barrier.blocked - 1); a.cargo = { kind: "soil", amount: 1 }; a.rest = .35;
      a.action = "Removing rubble from a blocked passage";
      if (!barrier.blocked) {
        const text = "Diggers cleared a blocked passage. Traffic can flow again.";
        journal(s, text); s.notice = { text, point: tunnelPoint(from, to, child, .5, reverse) };
      }
    } else a.action = entranceBlocked ? "Entrance obstructed by a stone · turning back" : "Passage blocked · turning back";
    a.edge = { from: edge.to, to: edge.from, t: 1 - edge.t }; a.local = null; a.previous = -2; a.recovery = 3;
    return;
  }
  const p = edge.from === -1 || edge.to === -1 ? { x: from.x + (to.x - from.x) * nextT, y: from.y + (to.y - from.y) * nextT } : tunnelPoint(from, to, child, nextT, reverse);
  if (!walk(a, p, DT)) return;
  edge.t = nextT;
  if (edge.t >= 1) {
    a.previous = edge.from; a.node = edge.to; a.edge = null; a.recent = [...a.recent.slice(-5), a.node];
    if (a.node === -1) { a.zone = "surface"; if (a.team === "home") a.memory = [{ ...ENTRANCE }]; a.explored = 0; a.returning = a.team === "rival" && !!a.cargo; a.angle = random(s) < .5 ? -.5 : Math.PI + .5; }
  }
}
function chooseNeighbor(s: Colony, a: Ant, n: NestNode, cue: Scent) {
  const options: { id: number; scent: number }[] = neighbors(s, n).map(p => ({ id: p.id, scent: p.scent[cue] }));
  if (n.id === 0 && cue === "home") options.push({ id: -1, scent: 2 });
  if (!options.length) { a.action = "Isolated by rubble · needs a digger or an open passage"; a.rest = .8; return; }
  const strongest = options.reduce((best, p) => p.scent > best.scent ? p : best);
  if (a.cargo && a.recovery <= 0 && strongest.scent > n.scent[cue] * 1.05 + .01 && random(s) < .95) {
    a.edge = { from: n.id, to: strongest.id, t: 0 }; a.local = null; return;
  }
  const weights = options.map(p => a.recovery > 0 ? (p.id === a.previous ? .2 : 1) : (Math.max(.006, p.scent - n.scent[cue] * .55) * (p.id === a.previous ? .25 : 1) / (1 + a.recent.filter(id => id === p.id).length * .8) + .012) * (random(s) > .07 ? 1 : 4));
  let choice = random(s) * weights.reduce((sum, w) => sum + w, 0);
  let target = options[options.length - 1].id;
  for (let i = 0; i < options.length; i++) { choice -= weights[i]; if (choice <= 0) { target = options[i].id; break; } }
  a.edge = { from: n.id, to: target, t: 0 }; a.local = null;
}
function broodSlot(s: Colony, n: NestNode): Point {
  const count = s.brood.filter(b => b.node === n.id && b.carrier === null).length;
  return { x: n.x - 22.5 + count % 6 * 9, y: n.y - 12 + Math.floor(count / 6) % 4 * 8 };
}
function interactBrood(s: Colony, a: Ant, n: NestNode) {
  if (a.cargo?.kind === "brood") {
    const b = s.brood.find(b => b.id === a.cargo!.brood)!;
    if (n.room === "nursery" && n.water <= .3 && s.brood.filter(other => other.node === n.id && other.carrier === null).length < nurserySlots(n)) {
      const slot = broodSlot(s, n); if (!walk(a, slot, DT)) return true;
      b.carrier = null; b.node = n.id; b.x = slot.x; b.y = slot.y; a.cargo = null; a.rest = .7; a.action = "Settling brood in a nursery"; return true;
    }
    return false;
  }
  const local = s.brood.filter(b => b.node === n.id && b.carrier === null);
  if (!a.cargo && (n.room === "queen" || n.water > .3)) {
    const egg = local[0];
    if (egg) { if (!walk(a, egg, DT)) return true; a.cargo = { kind: "brood", amount: 1, brood: egg.id }; egg.carrier = a.id; a.action = "Carrying brood to a nursery"; return true; }
  }
  const hungry = local.find(b => b.fed < foodNeeded(b));
  if (a.cargo?.kind === "food" && hungry) {
    a.action = "Delivering food to hungry brood";
    if (!walk(a, hungry, DT)) return true;
    hungry.fed++; hungry.neglect = 0; a.cargo = null; a.rest = 1; n.waste += .01; s.totals.fed++; return true;
  }
  if (a.cargo?.kind === "food" && n.room === "queen" && s.queenHunger > .25) {
    a.action = "Feeding the queen";
    if (!walk(a, n, DT)) return true;
    s.queenHunger = Math.max(0, s.queenHunger - .5); s.queenHealth = Math.min(100, s.queenHealth + 4); a.cargo = null; s.totals.fed++; a.rest = 1; return true;
  }
  const needsCare = local.find(b => b.fed >= foodNeeded(b) && b.care < careNeeded(b));
  if (a.cargo?.kind === "food" && !hungry && needsCare && n.water <= .3) {
    a.action = "Caching a spare meal before tending brood";
    if (!walk(a, n, DT)) return true;
    n.food += a.cargo.amount; a.cargo = null; return true;
  }
  if (!a.cargo && n.room === "nursery" && n.water <= .3 && needsCare) {
    a.action = "Tending a larva"; if (!walk(a, needsCare, DT)) return true;
    needsCare.care += 2; needsCare.neglect = 0; a.rest = 1.5;
    return true;
  }
  return false;
}
function startDig(s: Colony, a: Ant, n: NestNode) {
  // Probe only nearby soil. A new passage requires reaching the wall and
  // physically picking up its first load, just like every subsequent advance.
  if (s.nest.length >= 42 || s.nest.some(p => p.parent === n.id && p.excavation)) { a.probe = undefined; return false; }
  if (a.probe?.anchor !== n.id) a.probe = undefined;
  if (a.probe) {
    a.action = "Approaching a crowded tunnel wall";
    if (!walk(a, a.probe, DT)) return true;
    const { angle } = a.probe;
    s.nest.push({ id: s.nextNode++, parent: n.id, x: a.x + Math.cos(angle) * 1.5, y: a.y + Math.sin(angle) * 1.5, room: "tunnel", size: .5, water: 0, traffic: 0, food: 0, waste: 0, scent: { ...emptyScents(), work: 1 }, excavation: { angle, remaining: 60 + random(s) * 35, dug: 1 } });
    a.cargo = { kind: "soil", amount: 1 }; a.probe = undefined; a.rest = .5; a.action = "Carrying the first soil from a new tunnel"; return true;
  }
  const parent = s.nest.find(p => p.id === n.parent);
  const base = parent ? Math.atan2(n.y - parent.y, n.x - parent.x) : Math.PI / 2;
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = base + (random(s) - .5) * Math.PI * 1.5;
    const r = radius(n) * .92;
    const wall = { x: n.x + Math.cos(angle) * r, y: n.y + Math.sin(angle) * r * (n.room === "tunnel" ? 1 : .63 + noise(n.id + 12) * .15) };
    const soil = { x: wall.x + Math.cos(angle) * 18, y: wall.y + Math.sin(angle) * 18 };
    if (!soilIsClear(s, soil, n.id)) continue;
    a.probe = { ...wall, angle, anchor: n.id }; a.action = "Probing soil beside congestion"; return true;
  }
  return false;
}
function soilIsClear(s: Colony, p: Point, parentId: number, selfId = -1) {
  if (p.x < 60 || p.x > 900 || p.y < 225 || p.y > 590) return false;
  for (const n of s.nest) {
    if (n.id === parentId || n.id === selfId) continue;
    if (distance(n, p) < radius(n) + 15) return false;
    if (n.parent !== null && n.parent !== selfId) {
      const parent = s.nest.find(a => a.id === n.parent)!;
      const junction = s.nest.find(a => a.id === parentId)!;
      if (distance(p, junction) > radius(junction) + 12 && segmentDistance(p, parent, n) < 15) return false;
    }
  }
  return true;
}
function dig(s: Colony, a: Ant, n: NestNode) {
  const task = n.excavation;
  if (a.cargo) return false;
  if (!task) {
    if ((n.room !== "food" && n.room !== "nursery") || n.size >= 4 || n.scent.crowd < .65) return false;
    const angle = noise(a.id + 183) * Math.PI * 2;
    const wall = { x: n.x + Math.cos(angle) * radius(n) * .85, y: n.y + Math.sin(angle) * radius(n) * .55 };
    a.action = "Enlarging a crowded chamber";
    if (!walk(a, wall, DT)) return true;
    const size = Math.min(4, n.size + .04);
    if (s.nest.some(other => other.id !== n.id && distance(other, n) < radius(other) + 25 * Math.sqrt(size) + 5)) return false;
    n.size = size; a.cargo = { kind: "soil", amount: 1 }; a.rest = .7;
    return true;
  }
  a.action = "Excavating soil at the tunnel face";
  if (!walk(a, n, DT)) return true;
  const next = { x: n.x + Math.cos(task.angle) * 1.5, y: n.y + Math.sin(task.angle) * 1.5 };
  if (task.remaining > 0 && soilIsClear(s, next, n.parent!, n.id)) {
    n.x = next.x; n.y = next.y; task.remaining -= 1.5;
  } else {
    task.remaining = 0;
    const size = Math.min(1.8, n.size + .035);
    const blocked = s.nest.some(other => other.id !== n.id && distance(other, n) < radius(other) + 25 * Math.sqrt(size) + 5);
    if (blocked || n.size >= 1.8) {
      if (n.size > .7) {
        const parent = s.nest.find(p => p.id === n.parent)!;
        n.room = parent.scent.brood > parent.scent.food ? "nursery" : "food";
        journal(s, `Diggers opened a new ${n.room === "nursery" ? "nursery" : "food chamber"}.`);
      }
      delete n.excavation;
      return false;
    }
    n.size = size;
  }
  a.cargo = { kind: "soil", amount: 1 }; task.dug++;
  a.rest = .5;
  return true;
}
function nestBehavior(s: Colony, a: Ant) {
  if (a.edge) { moveEdge(s, a); return; }
  const n = s.nest.find(n => n.id === a.node)!;
  if (!n) return;
  if (a.local) { if (walk(a, a.local, DT)) a.local = null; return; }
  if (a.team === "rival") {
    if (n.room === "queen" && !a.cargo) { a.action = "Attacking the queen"; if (walk(a, n, DT)) s.queenHealth = Math.max(0, s.queenHealth - DT * 1.4); return; }
    if (!a.cargo && n.food >= 1) { a.action = "Stealing a seed"; if (!walk(a, n, DT)) return; n.food--; a.cargo = { kind: "food", amount: 1 }; s.rival.stolen++; return; }
    a.action = a.cargo ? "Escaping with stolen food" : "Following brood and food odors into the nest";
    chooseNeighbor(s, a, n, a.cargo ? "home" : n.scent.brood > n.scent.food ? "brood" : "food"); return;
  }
  if (a.hunger > .8 && n.food >= 1 && !a.cargo) {
    if (!walk(a, n, DT)) return;
    n.food--; a.hunger = Math.max(0, a.hunger - .6); n.waste += .02; s.totals.eaten++; a.rest = 1; a.action = "Eating stored food"; return;
  }
  if (a.hunger > .8 && !a.cargo) { a.action = "Following food scent to find a meal"; chooseNeighbor(s, a, n, "food"); return; }
  if (a.role === "soldier") { a.action = n.scent.alarm > .02 ? "Following an alarm through the nest" : "Heading out to guard the entrance"; chooseNeighbor(s, a, n, n.scent.alarm > .02 ? "alarm" : "home"); return; }
  if (a.role === "forager") {
    if (a.cargo?.kind === "food" && n.room === "food" && n.food + a.cargo.amount <= Math.floor(n.size * 55)) {
      a.action = "Depositing food in the store";
      if (!walk(a, n, DT)) return;
      n.food += a.cargo.amount; a.cargo = null; s.totals.delivered++;
      if (s.totals.delivered === 1) journal(s, "The first seed has been carried from a food patch into storage.");
      a.rest = .6; return;
    }
    if (a.cargo?.kind === "food" && n.room === "food" && n.food + 1 > Math.floor(n.size * 55)) {
      if (neighbors(s, n).some(p => p.scent.store > n.scent.store * 1.15 + .01)) {
        a.action = "Following scent toward another food store"; chooseNeighbor(s, a, n, "store"); return;
      }
      if (a.waiting > 5) { a.waiting = 0; a.recovery = 4; a.action = "Store full · trying another passage"; chooseNeighbor(s, a, n, "store"); return; }
      a.action = "Store full · waiting for space or a digger";
      const angle = noise(a.id + 118) * Math.PI * 2;
      if (walk(a, { x: n.x + Math.cos(angle) * radius(n) * .7, y: n.y + Math.sin(angle) * radius(n) * .4 }, DT)) a.rest = 1;
      return;
    }
    a.action = a.cargo ? "Carrying food to a store" : "Following the nest-exit scent";
    chooseNeighbor(s, a, n, a.cargo ? "store" : "home"); return;
  }
  if (a.role === "nurse") {
    if (interactBrood(s, a, n)) return;
    if (!a.cargo && n.food >= 1) { if (!walk(a, n, DT)) return; n.food--; a.cargo = { kind: "food", amount: 1 }; a.action = "Fetching food for brood"; return; }
    a.action = a.cargo?.kind === "brood" ? "Following nursery scent with brood" : a.cargo ? "Following hungry brood scent" : "Looking for food or brood to tend";
    chooseNeighbor(s, a, n, a.cargo?.kind === "brood" ? "nursery" : a.cargo ? "brood" : "food"); return;
  }
  const rubble = adjacent(s, n).find(p => blockedBetween(n, p) > 0);
  if (a.role === "digger" && rubble && a.cargo?.kind === "soil") {
    if (!walk(a, n, DT)) return;
    n.spoil = (n.spoil ?? 0) + a.cargo.amount; a.cargo = null; a.action = "Putting soil down to clear a blocked route"; a.rest = .3; return;
  }
  if (a.role === "digger" && rubble && !a.cargo) {
    a.action = "Approaching rubble to reopen a passage"; a.edge = { from: n.id, to: rubble.id, t: 0 }; return;
  }
  if (!a.cargo && (n.spoil ?? 0) > 0) {
    if (!walk(a, n, DT)) return;
    n.spoil = (n.spoil ?? 0) - 1; a.cargo = { kind: "soil", amount: 1 }; a.action = "Collecting loose soil"; a.rest = .3; return;
  }
  if (a.cargo) { a.action = `Carrying ${a.cargo.kind} to the surface`; chooseNeighbor(s, a, n, "home"); return; }
  if (a.role === "cleaner") {
    if (n.water > .025 || n.waste > .01) {
      a.action = n.water > .025 ? "Collecting water" : "Collecting refuse";
      if (!walk(a, n, DT)) return;
      if (n.water > .025) { const amount = Math.min(.04, n.water); n.water -= amount; a.cargo = { kind: "water", amount }; }
      else { const amount = Math.min(.04, n.waste); n.waste -= amount; a.cargo = { kind: "waste", amount }; }
      a.rest = .5; return;
    }
    if (n.room !== "tunnel" && n.scent.clean < .015 && neighbors(s, n).every(p => p.scent.clean < .015)) {
      a.action = "Resting · no cleaning needed nearby"; a.rest = 2;
      a.local = { x: n.x + (noise(a.id) - .5) * radius(n), y: n.y + radius(n) * .3 }; return;
    }
    a.action = "Following damp or refuse scent"; chooseNeighbor(s, a, n, "clean"); return;
  }
  if (dig(s, a, n)) return;
  if (a.probe && startDig(s, a, n)) return;
  if (n.scent.crowd > 1 && n.id !== 0 && s.ants.filter(other => other.role !== "digger" && other.zone === "nest" && distance(other, n) < radius(n) + 6).length >= 5 && startDig(s, a, n)) return;
  a.action = "Sensing congestion or disturbed soil";
  chooseNeighbor(s, a, n, n.scent.work > .04 ? "work" : "crowd");
}
function signals(s: Colony) {
  const previous = s.nest.map(n => ({ ...n.scent }));
  for (let i = 0; i < s.nest.length; i++) {
    const n = s.nest[i]; const localBrood = s.brood.filter(b => b.node === n.id && b.carrier === null);
    const nearby = s.ants.filter(a => a.zone === "nest" && distance(a, n) < radius(n) + 6).length;
    const density = nearby / (n.room === "tunnel" ? 4 : n.size * 14);
    const emission: Record<Scent, number> = {
      home: n.id === 0 ? 1 : 0, store: n.room === "food" ? Math.max(0, 1 - n.food / (n.size * 55)) : 0,
      food: Math.min(1, n.food / 12), brood: Math.min(1.5, localBrood.filter(b => b.fed < foodNeeded(b) || b.care < careNeeded(b)).length * .3 + (n.room === "queen" ? s.queenHunger : 0)),
      nursery: n.room === "nursery" && n.water <= .3 ? Math.max(0, 1 - localBrood.length / nurserySlots(n)) : 0,
      work: n.excavation || adjacent(s, n).some(p => blockedBetween(n, p)) ? 1 : 0, alarm: 0, clean: Math.min(1, n.waste * 3 + n.water * 4), crowd: Math.min(2, density),
    };
    const adjacentIndices = s.nest.flatMap((p, j) => (p.parent === n.id || p.id === n.parent) && !blockedBetween(n, p) ? [j] : []);
    for (const cue of SCENTS) {
      const neighbor = Math.max(0, ...adjacentIndices.map(j => previous[j][cue])) * .82;
      const target = Math.max(emission[cue], neighbor);
      n.scent[cue] += (target - n.scent[cue]) * DT * (cue === "crowd" ? .6 : 1.6);
    }
  }
}
function water(s: Colony) {
  if (rainy(s)) { s.nest[0].water += DT * .018; s.totals.rain += DT * .018; }
  // Gravity transfers water through physical connections; it never deletes it.
  const levels = s.nest.map(n => n.water);
  const transfers = s.nest.map(() => 0);
  for (let i = 0; i < s.nest.length; i++) {
    const n = s.nest[i]; if (levels[i] <= .01) continue;
    const downhill = s.nest.map((p, j) => ({ p, j })).filter(({ p }) => (p.parent === n.id || p.id === n.parent) && !blockedBetween(n, p) && p.y > n.y + 4);
    if (!downhill.length) continue;
    const amount = Math.min(levels[i], DT * .03);
    transfers[i] -= amount;
    for (const { j } of downhill) transfers[j] += amount / downhill.length;
  }
  s.nest.forEach((n, i) => { n.water = Math.max(0, n.water + transfers[i]); });
}
export function step(previous: Colony): Colony {
  if (previous.result !== "alive") return previous;
  const s: Colony = { ...previous, tick: previous.tick + 1,
    ants: previous.ants.map(cloneAnt),
    brood: previous.brood.map(b => ({ ...b })), sources: previous.sources.map(f => ({ ...f })),
    nest: previous.nest.map(n => ({ ...n, scent: { ...n.scent }, excavation: n.excavation ? { ...n.excavation } : undefined })),
    rival: { ...previous.rival, ants: previous.rival.ants.map(cloneAnt), trail: previous.rival.trail.slice(), raidTrail: previous.rival.raidTrail.slice() },
    alarm: previous.alarm.slice(), stones: previous.stones.map(o => ({ ...o })), effects: previous.effects.filter(e => e.until > elapsed(previous)), fallen: previous.fallen.filter(e => e.until > elapsed(previous)),
    batch: previous.batch ? { ...previous.batch } : null, trail: previous.trail.slice(), totals: { ...previous.totals }, log: [...previous.log],
  };
  const evaporation = Math.exp(-DT / 22);
  for (let i = 0; i < s.trail.length; i++) { s.trail[i] *= evaporation; s.alarm[i] *= Math.exp(-DT / 9); s.rival.trail[i] *= evaporation; s.rival.raidTrail[i] *= Math.exp(-DT / 40); }
  s.rival.alert = Math.max(0, s.rival.alert - DT / 55);
  signals(s); water(s);
  // Alarm escapes through the physical doorway; guards cannot sense remote rooms.
  const doorway = fieldIndex(ENTRANCE.x, ENTRANCE.y);
  s.alarm[doorway] = Math.min(6, s.alarm[doorway] + DT * s.nest[0].scent.alarm * 2);
  const busy = combat(s);
  // Tick order rotates to avoid permanently favoring ants with lower ids.
  const start = s.tick % Math.max(1, s.ants.length);
  for (let i = 0; i < s.ants.length; i++) {
    const a = s.ants[(i + start) % s.ants.length];
    if (busy.has(a.id) || a.health <= 0) continue;
    a.hunger += DT * (a.role === "soldier" ? .004 : .002);
    if (a.hunger > .85 && a.cargo?.kind === "food") {
      a.cargo = null; a.hunger = Math.max(0, a.hunger - .6); s.totals.eaten++; a.rest = 1; a.action = "Eating a carried seed";
    }
    a.waiting = a.action === "Store full · waiting for space or a digger" ? a.waiting + DT : 0;
    a.recovery = Math.max(0, a.recovery - DT);
    if (a.rest > 0) { a.rest -= DT; continue; }
    const before = { x: a.x, y: a.y };
    if (a.zone === "surface") surface(s, a); else nestBehavior(s, a);
    a.stationary = distance(before, a) < .05 ? a.stationary + DT : 0;
    if (a.stationary > 4 && !a.action.includes("Isolated") && !a.action.includes("Store full") && !a.action.startsWith("Resting")) {
      a.local = null; a.probe = undefined; a.recovery = 5; a.stationary = 0; a.previous = -2;
      a.action = "No progress · exploring another approach";
      if (a.zone === "nest" && !a.edge) chooseNeighbor(s, a, s.nest.find(n => n.id === a.node)!, a.cargo ? "home" : "crowd");
    }
  }
  for (const a of s.rival.ants) {
    if (busy.has(a.id) || a.health <= 0) continue;
    a.hunger += DT * (a.role === "soldier" ? .004 : .002);
    if (a.rest > 0) { a.rest -= DT; continue; }
    if (a.zone === "surface") rivalSurface(s, a); else nestBehavior(s, a);
  }
  rivalBrood(s);
  for (const b of s.brood) {
    b.age += DT; b.neglect += DT * ((s.nest.find(n => n.id === b.node)?.water ?? 0) > .4 ? 3 : 1);
    if (b.carrier !== null) { const carrier = s.ants.find(a => a.id === b.carrier); if (carrier) { b.x = carrier.x; b.y = carrier.y; } }
  }
  for (const b of [...s.brood]) if (b.carrier === null && b.node !== 3 && b.fed >= foodNeeded(b) && b.care >= careNeeded(b) && b.age >= hatchAge(b) && (s.nest.find(n => n.id === b.node)?.water ?? 0) <= .3) {
    const ant = newAnt(s.nextAnt++, b.role, { id: b.node, x: b.x, y: b.y });
    ant.bornAt = elapsed(s); s.ants.push(ant); s.brood = s.brood.filter(other => other.id !== b.id); s.totals.hatched++;
    if (b.batch !== undefined && s.batch?.id === b.batch) {
      s.batch.hatched++;
      if (s.batch.hatched === s.batch.total) {
        const text = `Batch ready: ${s.batch.total} new ${s.batch.role}s joined the colony.`;
        journal(s, text); s.notice = { text, point: { x: b.x, y: b.y } };
      }
    } else journal(s, `A ${b.role} hatched where a nurse fed and tended its brood.`);
  }
  const neglected = s.brood.filter(b => b.neglect > 150 && b.carrier === null);
  if (neglected.length) {
    s.brood = s.brood.filter(b => !neglected.includes(b)); journal(s, "Neglected brood died without enough nurse visits.");
    if (s.batch && neglected.some(b => b.batch === s.batch!.id) && !s.brood.some(b => b.batch === s.batch!.id)) {
      s.notice = { text: `Batch ended: ${s.batch.hatched} of ${s.batch.total} survived. Add nurses or keep the nursery dry next time.`, point: null };
    }
  }
  s.queenHunger += DT * .0015;
  const queen = s.nest.find(n => n.room === "queen")!;
  if (s.queenHunger > 1 || queen.waste > .6 || queen.water > .6) s.queenHealth = Math.max(0, s.queenHealth - DT * .35);
  s.eggClock -= DT;
  if (s.eggClock <= 0) {
    const waiting = s.brood.filter(b => b.node === queen.id && b.carrier === null).length;
    if (s.brood.length < 36 && s.ants.length + s.brood.length < 400 && waiting < 4 && s.queenHunger < .9) {
      const id = s.nextBrood++;
      s.brood.push({ id, role: s.nextRole, node: queen.id, carrier: null, x: queen.x - 10 + id % 3 * 8, y: queen.y + 10, fed: 0, care: 0, age: 0, neglect: 0 });
    }
    s.eggClock = 12;
  }
  for (const n of s.nest) if (n.playerFlood && n.water <= .3) {
    n.playerFlood = false;
    const text = "Flood subsided. This chamber is usable again.";
    journal(s, text); s.notice = { text, point: { x: n.x, y: n.y } };
  }
  const dying = s.ants.filter(a => a.hunger > 1.5 || a.health <= 0);
  for (const a of dying) { dropCargo(s, a); s.fallen.push({ x: a.x, y: a.y, team: "home", until: elapsed(s) + 8 }); }
  const killed = dying.filter(a => a.health <= 0).length;
  if (killed) { s.totals.casualties += killed; journal(s, `${killed} ${killed === 1 ? "ant fell" : "ants fell"} defending the colony.`); }
  const starved = dying.length - killed;
  if (starved) journal(s, `${starved} ${starved === 1 ? "ant starved" : "ants starved"} before reaching a meal.`);
  s.ants = s.ants.filter(a => a.hunger <= 1.5 && a.health > 0);
  const lostRivals = s.rival.ants.filter(a => a.health <= 0 || a.hunger > 1.5);
  for (const a of lostRivals) { dropCargo(s, a); s.fallen.push({ x: a.x, y: a.y, team: "rival", until: elapsed(s) + 8 }); }
  s.rival.defeated += lostRivals.length;
  s.rival.ants = s.rival.ants.filter(a => a.health > 0 && a.hunger <= 1.5);
  if (s.queenHealth <= 0 || !s.ants.length) { s.result = "lost"; journal(s, "The colony has fallen."); }
  return s;
}
