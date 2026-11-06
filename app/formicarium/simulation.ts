export const COLS = 16;
export const ROWS = 8;
export type Room = "tunnel" | "queen" | "food" | "nursery" | "waste";
export type Job = "foragers" | "nurses" | "diggers" | "guards";
export type Tile = { room: Room | null; queued: boolean; progress: number; water: number };
export type Colony = {
  tick: number; workers: number; brood: number; growth: number; food: number;
  health: number; waste: number; tiles: Tile[]; jobs: Record<Job, number>;
  range: "near" | "far"; laying: boolean; seed: number;
  log: { day: number; text: string }[]; result: "alive" | "won" | "lost";
};
export const dayOf = (s: Colony) => Math.floor(s.tick / 4) + 1;
export const seasonOf = (s: Colony) => ["Spring", "Summer", "Autumn", "Winter"][Math.min(3, Math.floor((dayOf(s) - 1) / 30))];
export const rainy = (s: Colony) => dayOf(s) % 17 >= 12 && dayOf(s) % 17 <= 14 && dayOf(s) <= 90;
export const spider = (s: Colony) => dayOf(s) % 19 >= 14 && dayOf(s) % 19 <= 17 && dayOf(s) <= 90;
export function createColony(seed = 731): Colony {
  const tiles: Tile[] = Array.from({ length: COLS * ROWS }, () => ({ room: null, queued: false, progress: 0, water: 0 }));
  for (const [i, room] of [[7, "tunnel"], [23, "tunnel"], [39, "tunnel"], [38, "queen"], [40, "food"], [41, "food"], [55, "nursery"], [56, "nursery"], [71, "tunnel"]] as [number, Room][]) tiles[i].room = room;
  return { tick: 0, workers: 24, brood: 6, growth: 0, food: 65, health: 100, waste: 0, tiles,
    jobs: { foragers: 5, nurses: 3, diggers: 2, guards: 1 }, range: "near", laying: true, seed,
    log: [{ day: 1, text: "The queen has settled. Build reserves before winter arrives on day 91." }], result: "alive" };
}
export function neighbors(i: number) {
  return [i % COLS > 0 ? i - 1 : -1, i % COLS < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS].filter(n => n >= 0 && n < COLS * ROWS);
}
export function queueDig(s: Colony, i: number): Colony {
  if (s.result !== "alive" || !s.tiles[i] || s.tiles[i].room || !neighbors(i).some(n => s.tiles[n].room)) return s;
  return { ...s, tiles: s.tiles.map((t, n) => n === i ? { ...t, queued: !t.queued, progress: 0 } : t) };
}
export function assignRoom(s: Colony, i: number, room: Room): Colony {
  if (s.result !== "alive" || room === "queen" || !s.tiles[i]?.room || s.tiles[i].room === "queen" || i === 7) return s;
  return { ...s, tiles: s.tiles.map((t, n) => n === i ? { ...t, room } : t) };
}
export function workforce(s: Colony): Record<Job, number> {
  const entries = Object.entries(s.jobs) as [Job, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  const counts = Object.fromEntries(entries.map(([j, w]) => [j, total ? Math.floor(s.workers * w / total) : 0])) as Record<Job, number>;
  let spare = total ? s.workers - Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  for (const [j, w] of entries) if (w && spare-- > 0) counts[j]++;
  return counts;
}
export const capacity = (s: Colony, room: Room) => s.tiles.filter(t => t.room === room && t.water < 0.6).length * (room === "food" ? 55 : room === "nursery" ? 8 : 1);
export function step(previous: Colony): Colony {
  if (previous.result !== "alive") return previous;
  const s: Colony = { ...previous, tick: previous.tick + 1, tiles: previous.tiles.map(t => ({ ...t })), log: [...previous.log] };
  const log = (text: string) => { s.log = [{ day: dayOf(s), text }, ...s.log].slice(0, 16); };
  const random = () => { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; };
  const jobs = workforce(s);
  const winter = dayOf(s) > 90;
  const wet = rainy(s);
  for (let i = 0; i < s.tiles.length; i++) {
    const t = s.tiles[i];
    if (t.room) t.water = Math.max(0, Math.min(1, t.water + (wet && i >= COLS * 4 ? 0.055 : -0.025) - jobs.diggers * 0.004));
  }
  const digging = s.tiles.find(t => t.queued);
  if (digging && jobs.diggers) {
    digging.progress += jobs.diggers * 0.075;
    if (digging.progress >= 1) { digging.room = "tunnel"; digging.queued = false; log("A new tunnel is ready. Select it to assign a chamber."); }
  }
  const travel = 1 + s.tiles.filter(t => t.room).length * 0.012;
  const haul = winter ? 0 : jobs.foragers * (s.range === "far" ? 0.38 : 0.24) * (wet ? 0.55 : 1) * (dayOf(s) > 60 ? 0.7 : 1) / travel;
  const consumption = s.workers * (winter ? 0.028 : 0.043) + s.brood * 0.025 + 0.12;
  s.food = Math.max(0, Math.min(capacity(s, "food"), s.food + haul - consumption));
  s.waste = Math.max(0, s.waste + s.workers * 0.013 + s.brood * 0.005 - Math.min(jobs.diggers * 0.12, capacity(s, "waste") * 0.5));
  const flooded = s.tiles.filter(t => t.room && t.water >= 0.6).length;
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
    if (s.waste > 25 && random() < 0.25) { s.workers = Math.max(0, s.workers - 1); log("Waste is spreading disease. Assign a refuse chamber and diggers."); }
    if (dayOf(s) === 12 || dayOf(s) % 17 === 12) { if (!winter) log("Rain is arriving. Deep chambers can flood; diggers pump water."); }
    if (dayOf(s) === 61) log("Autumn. Food outside is becoming scarce.");
    if (dayOf(s) === 91) log("Winter. Foraging has stopped. The colony must live on its reserves.");
  }
  if (s.health <= 0 || s.workers <= 0) { s.result = "lost"; log("The colony has fallen."); }
  else if (dayOf(s) > 120) { s.result = "won"; log("Spring has returned. Your colony survived its first winter."); }
  return s;
}
