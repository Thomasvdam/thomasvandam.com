import { canPlace, distance, NestNode, noise, radius, Room, segmentDistance } from "./nest";
export type { Room } from "./nest";
export type Job = "foragers" | "nurses" | "diggers" | "guards";
export type Build = "expansion" | "food" | "nursery" | "waste";
export type Project = { node: NestNode; upgrade: boolean; progress: number; hardness: number };
export type Colony = {
  tick: number; workers: number; brood: number; growth: number; food: number;
  health: number; waste: number; nest: NestNode[]; jobs: Record<Job, number>;
  construction: Record<Build, number>; projects: Partial<Record<Build, Project>>;
  depth: "shallow" | "balanced" | "deep"; nextId: number; terrainSeed: number;
  range: "near" | "far"; laying: boolean; seed: number;
  log: { day: number; text: string }[]; result: "alive" | "won" | "lost";
};
export const dayOf = (s: Colony) => Math.floor(s.tick / 4) + 1;
export const seasonOf = (s: Colony) => ["Spring", "Summer", "Autumn", "Winter"][Math.min(3, Math.floor((dayOf(s) - 1) / 30))];
export const rainy = (s: Colony) => dayOf(s) % 17 >= 12 && dayOf(s) % 17 <= 14 && dayOf(s) <= 90;
export const spider = (s: Colony) => dayOf(s) % 19 >= 14 && dayOf(s) % 19 <= 17 && dayOf(s) <= 90;
export function createColony(seed = 731): Colony {
  const nest: NestNode[] = [
    { id: 0, parent: null, x: 450, y: 198, room: "tunnel", size: 1, water: 0, traffic: 0 },
    { id: 1, parent: 0, x: 464, y: 266, room: "tunnel", size: 1, water: 0, traffic: 0 },
    { id: 2, parent: 1, x: 428, y: 350, room: "tunnel", size: 1, water: 0, traffic: 0 },
    { id: 3, parent: 2, x: 332, y: 371, room: "queen", size: 2.5, water: 0, traffic: 0 },
    { id: 4, parent: 1, x: 573, y: 298, room: "food", size: 2, water: 0, traffic: 0 },
    { id: 5, parent: 2, x: 510, y: 432, room: "nursery", size: 2, water: 0, traffic: 0 },
    { id: 6, parent: 2, x: 396, y: 469, room: "tunnel", size: 1, water: 0, traffic: 0 },
  ];
  return { tick: 0, workers: 24, brood: 6, growth: 0, food: 65, health: 100, waste: 0, nest,
    jobs: { foragers: 5, nurses: 3, diggers: 2, guards: 1 }, range: "near", laying: true, seed, terrainSeed: seed,
    construction: { expansion: 1, food: 3, nursery: 1, waste: 3 }, projects: {}, depth: "balanced", nextId: 7,
    log: [{ day: 1, text: "The queen has settled. Guide the diggers with construction priorities; winter arrives on day 91." }], result: "alive" };
}
export function workforce(s: Colony): Record<Job, number> {
  const entries = Object.entries(s.jobs) as [Job, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  const counts = Object.fromEntries(entries.map(([j, w]) => [j, total ? Math.floor(s.workers * w / total) : 0])) as Record<Job, number>;
  let spare = total ? s.workers - Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  for (const [j, w] of entries) if (w && spare-- > 0) counts[j]++;
  return counts;
}

export const capacity = (s: Colony, room: Room) => Math.floor(s.nest.filter(n => n.room === room && n.water < .6).reduce((sum, n) => sum + n.size, 0) * (room === "food" ? 55 : room === "nursery" ? 8 : 1));
export function constructionLabor(s: Colony) {
  const total = Object.values(s.construction).reduce((a, b) => a + b, 0);
  const diggers = workforce(s).diggers;
  const active = (Object.keys(s.construction) as Build[]).reduce((sum, kind) => sum + (s.projects[kind] ? s.construction[kind] : 0), 0);
  const building = total ? diggers * Math.min(.65, total / 20) * active / total : 0;
  return { building, maintenance: diggers - building, total, active };
}
export function planProject(s: Colony, kind: Build): Project | null {
  const occupied = [...s.nest.map(n => Object.values(s.projects).find(p => p.upgrade && p.node.id === n.id)?.node ?? n), ...Object.values(s.projects).filter(p => !p.upgrade).map(p => p.node)];
  if (kind !== "expansion") {
    const existing = s.nest.filter(n => n.room === kind && n.size < 2.6 && n.water < .6 && !Object.values(s.projects).some(p => p.node.id === n.id)).sort((a, b) => a.size - b.size);
    for (const n of existing) {
      const enlarged = { ...n, size: n.size + .6 };
      if (occupied.some(other => other.id !== n.id && distance(other, enlarged) < radius(other) + radius(enlarged) + 12)) continue;
      if (occupied.some(other => other.parent !== null && other.id !== n.id && other.parent !== n.id && segmentDistance(enlarged, occupied.find(p => p.id === other.parent)!, other) < radius(enlarged) + 15)) continue;
      return { node: enlarged, upgrade: true, progress: 0, hardness: 1 };
    }
  }
  if (occupied.length >= 48) return null;
  const targetDepth = s.depth === "shallow" ? 285 : s.depth === "deep" ? 530 : 395;
  const anchors = s.nest.filter(n => n.room === "tunnel" && n.id !== 0 && occupied.filter(p => p.parent === n.id).length < 3);
  const candidates: { node: NestNode; hardness: number; score: number }[] = [];
  for (const anchor of anchors) for (let k = 0; k < 36; k++) {
    const salt = s.terrainSeed + s.nextId * 107 + anchor.id * 313 + k;
    const angle = noise(salt) * Math.PI * 2;
    const length = 78 + noise(salt + 90) * 52;
    const node: NestNode = { id: s.nextId, parent: anchor.id, x: Math.round(anchor.x + Math.cos(angle) * length), y: Math.round(anchor.y + Math.sin(angle) * length), room: kind === "expansion" ? "tunnel" : kind, size: 1, water: 0, traffic: 0 };
    if (!canPlace(occupied, node)) continue;
    const hardness = 1 + noise(Math.floor(node.x / 35) + Math.floor(node.y / 35) * 29 + s.terrainSeed) * .8 + Math.max(0, node.y - 350) / 600;
    const separation = kind === "waste" ? -distance(node, s.nest[3]) * .005 : kind === "food" ? distance(node, s.nest[0]) * .003 : 0;
    candidates.push({ node, hardness, score: Math.abs(node.y - targetDepth) * .012 + hardness + separation });
  }
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates.length) return null;
  const { node, hardness } = candidates[0];
  return { node, hardness, upgrade: false, progress: 0 };
}
export function step(previous: Colony): Colony {
  if (previous.result !== "alive") return previous;
  const s: Colony = { ...previous, tick: previous.tick + 1, nest: previous.nest.map(n => ({ ...n })), projects: Object.fromEntries(Object.entries(previous.projects).map(([kind, p]) => [kind, { ...p, node: { ...p.node } }])), log: [...previous.log] };
  const log = (text: string) => { s.log = [{ day: dayOf(s), text }, ...s.log].slice(0, 16); };
  const random = () => { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; };
  const jobs = workforce(s);
  const winter = dayOf(s) > 90;
  const wet = rainy(s);
  for (const kind of Object.keys(s.construction) as Build[]) {
    if (!s.construction[kind] || !jobs.diggers || s.projects[kind]) continue;
    const plan = planProject(s, kind);
    if (!plan) continue;
    s.projects[kind] = plan;
    if (!plan.upgrade) s.nextId++;
  }
  const labor = constructionLabor(s);
  for (const node of s.nest) {
    node.water = Math.max(0, Math.min(1, node.water + (wet && node.y > 410 ? .055 : -.025) - labor.maintenance * .006));
  }
  for (const kind of Object.keys(s.construction) as Build[]) {
    if (!s.construction[kind] || !labor.building || !s.projects[kind]) continue;
    const project = s.projects[kind]!;
    project.progress = Math.min(1, project.progress + labor.building * s.construction[kind] / labor.active * .07 / project.hardness);
    if (project.progress >= 1) {
      if (project.upgrade) {
        const n = s.nest.find(n => n.id === project.node.id)!;
        n.size = project.node.size;
      } else s.nest.push(project.node);
      delete s.projects[kind];
      log(`${project.upgrade ? "Enlarged" : "Completed"} ${kind === "expansion" ? "a branching tunnel" : kind === "food" ? "a food store" : kind === "nursery" ? "a nursery" : "an isolated refuse chamber"}.`);
    }
  }
  const flows = new Map(s.nest.map(n => [n.id, n.room === "food" ? jobs.foragers : n.room === "nursery" ? jobs.nurses : n.room === "waste" ? labor.maintenance : n.room === "queen" ? 1 : 0]));
  for (const n of [...s.nest].reverse()) {
    const flow = flows.get(n.id)!;
    n.traffic = Math.min(1, n.traffic + flow * .0004);
    if (n.parent !== null) flows.set(n.parent, flows.get(n.parent)! + flow);
  }
  const tunnelLength = s.nest.reduce((sum, n) => sum + (n.parent === null ? 0 : distance(n, s.nest.find(p => p.id === n.parent)!) / (1 + n.traffic * .15)), 0);
  const travel = 1 + tunnelLength / 5000;
  const haul = winter ? 0 : jobs.foragers * (s.range === "far" ? 0.38 : 0.24) * (wet ? 0.55 : 1) * (dayOf(s) > 60 ? 0.7 : 1) / travel;
  const consumption = s.workers * (winter ? 0.028 : 0.043) + s.brood * 0.025 + 0.12;
  s.food = Math.max(0, Math.min(capacity(s, "food"), s.food + haul - consumption));
  s.waste = Math.max(0, s.waste + s.workers * 0.013 + s.brood * 0.005 - Math.min(labor.maintenance * 0.18, capacity(s, "waste") * 0.5));
  const flooded = s.nest.filter(n => n.water >= 0.6).length;
  s.health = Math.max(0, Math.min(100, s.health + (s.food > 0 ? 0.14 : -1.5) - Math.max(0, s.waste - 12) * 0.045 - flooded * 0.12));
  if (s.laying && !winter && s.food > 12 && jobs.nurses >= 2 && s.tick % 12 === 0 && s.brood < capacity(s, "nursery")) { s.brood++; s.food -= 1; }
  if (s.brood && jobs.nurses && s.food > 0) {
    s.growth += Math.min(s.brood, jobs.nurses * 2) * 0.018;
    if (s.growth >= 1) { const born = Math.min(s.brood, Math.floor(s.growth)); s.workers += born; s.brood -= born; s.growth -= born; }
  }
  if (s.tick % 4 === 0) {
    if (spider(s) && jobs.foragers && random() < (s.range === "far" ? 0.75 : 0.3) / (1 + jobs.guards * 0.7)) {
      const lost = Math.min(s.workers, s.range === "far" ? 2 : 1); s.workers -= lost; log(`A spider caught ${lost} ${lost === 1 ? "forager" : "foragers"}. Guards reduce losses.`);
    }
    if (s.food === 0) { if (s.brood) { s.brood = Math.max(0, s.brood - 2); log("Starvation: the colony has lost brood."); } else s.workers = Math.max(0, s.workers - 1); }
    if (s.waste > 25 && random() < 0.25) { s.workers = Math.max(0, s.workers - 1); log("Waste is spreading disease. Raise refuse construction and digger priorities."); }
    if (dayOf(s) === 12 || dayOf(s) % 17 === 12) { if (!winter) log("Rain is arriving. Deep chambers can flood; diggers pump water."); }
    if (dayOf(s) === 61) log("Autumn. Food outside is becoming scarce.");
    if (dayOf(s) === 91) log("Winter. Foraging has stopped. The colony must live on its reserves.");
  }
  if (s.health <= 0 || s.workers <= 0) { s.result = "lost"; log("The colony has fallen."); }
  else if (dayOf(s) > 120) { s.result = "won"; log("Spring has returned. Your colony survived its first winter."); }
  return s;
}
