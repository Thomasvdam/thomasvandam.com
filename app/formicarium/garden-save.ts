import { MAX_NEST_NODES } from "./growth";
import { CELLS, Garden, HEIGHT, WIDTH } from "./garden";
export const SAVE_KEY = "formicarium.garden.v1";
export function encodeGarden(s: Garden) { return JSON.stringify(s, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value as Float32Array) : value); }
export function decodeGarden(raw: string): Garden {
  if (raw.length > 32_000_000) throw new Error("Save file is too large.");
  const s = JSON.parse(raw) as Garden;
  const assert = (ok: unknown) => { if (!ok) throw new Error("This is not a supported garden save."); };
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const point = (p: { x: number; y: number }) => p && finite(p.x) && finite(p.y) && p.x >= 0 && p.x <= WIDTH && p.y >= 0 && p.y <= HEIGHT;
  const numbers = (a: unknown, length: number, max = 100) => Array.isArray(a) && a.length === length && a.every(n => finite(n) && n >= 0 && n <= max);
  assert(s && s.version === 1 && Number.isInteger(s.tick) && s.tick >= 0 && finite(s.seed));
  for (const key of ["nextObject", "nextColony", "planted", "harvested"] as const) assert(Number.isInteger(s[key]) && s[key] >= 0);
  for (const key of ["water", "moisture", "fertility"] as const) { assert(numbers(s[key], CELLS, 1)); s[key] = new Float32Array(s[key]); }
  assert(numbers(s.channels, CELLS, 1) && Array.from(s.channels).every(n => n === 0 || n === 1)); s.channels = new Uint8Array(s.channels);
  assert(Array.isArray(s.objects) && s.objects.length <= 600 && new Set(s.objects.map(o => o.id)).size === s.objects.length);
  for (const o of s.objects) assert(point(o) && Number.isInteger(o.id) && ["berry", "flower", "log", "bridge", "fruit", "rock"].includes(o.kind) && [o.growth, o.food, o.age, o.condition, o.angle, o.pollen].every(finite) && o.growth >= 0 && o.growth <= 1 && o.food >= 0 && Array.isArray(o.visits) && o.visits.length <= 4 && o.visits.every(Number.isInteger));
  assert(Array.isArray(s.colonies) && s.colonies.length > 0 && s.colonies.length <= 4 && new Set(s.colonies.map(c => c.id)).size === s.colonies.length);
  for (const home of s.colonies) {
    assert(point(home) && Number.isInteger(home.id) && typeof home.name === "string" && home.name.length <= 80 && /^#[0-9a-f]{6}$/i.test(home.color) && finite(home.born) && finite(home.visits) && finite(home.sheltered));
    assert(numbers(home.trail, CELLS)); home.trail = new Float32Array(home.trail);
    const c = home.colony;
    assert(c && c.gardenSurface === true && ["alive", "lost"].includes(c.result) && finite(c.tick) && finite(c.seed) && finite(c.queenHealth) && finite(c.queenHunger) && finite(c.eggClock));
    assert(Array.isArray(c.nest) && c.nest.length >= 7 && c.nest.length <= MAX_NEST_NODES && Array.isArray(c.ants) && c.ants.length <= 400 && Array.isArray(c.brood) && c.brood.length <= 60 && c.ants.length + c.brood.length <= 400);
    const ids = new Set(c.nest.map(n => n.id));
    assert(ids.size === c.nest.length && [0, 1, 2, 3, 4, 5, 6].every(id => ids.has(id)) && c.nest.some(n => n.room === "queen"));
    const roles = ["forager", "nurse", "cleaner", "digger", "soldier"];
    for (const n of c.nest) assert(Number.isInteger(n.id) && n.id >= 0 && n.parent !== n.id && finite(n.x) && finite(n.y) && finite(n.size) && n.size > 0 && n.size <= 10 && finite(n.food) && finite(n.water) && finite(n.waste) && finite(n.traffic) && ["tunnel", "queen", "food", "nursery"].includes(n.room) && (n.parent === null || ids.has(n.parent)) && n.scent && (["home", "store", "food", "brood", "nursery", "work", "clean", "crowd", "alarm"] as const).every(k => finite(n.scent[k])) && (!n.excavation || [n.excavation.angle, n.excavation.remaining, n.excavation.dug].every(finite)));
    for (const n of c.nest) {
      let parent = n; const seen = new Set<number>();
      while (parent.parent !== null) { assert(!seen.has(parent.id)); seen.add(parent.id); parent = c.nest.find(p => p.id === parent.parent)!; }
      assert(parent.id === 0);
      assert(n.openedAt === undefined || finite(n.openedAt));
      assert(n.links === undefined || (Array.isArray(n.links) && n.links.length <= 8 && new Set(n.links).size === n.links.length && n.links.every(id => ids.has(id) && id !== n.id && id !== n.parent && c.nest.find(p => p.id === id)?.parent !== n.id && !c.nest.find(p => p.id === id)?.links?.includes(n.id))));
      assert(!n.excavation || ((n.excavation.room === undefined || ["tunnel", "queen", "food", "nursery"].includes(n.excavation.room)) && (n.excavation.target === undefined || ids.has(n.excavation.target))));
    }
    assert(new Set(c.ants.map(a => a.id)).size === c.ants.length);
    for (const a of c.ants) assert(point(a) && Number.isInteger(a.id) && roles.includes(a.role) && (a.zone === "surface" || a.zone === "nest") && (ids.has(a.node) || a.node === -1) && [a.hunger, a.health, a.angle, a.rest, a.speed, a.explored, a.stationary, a.waiting, a.recovery].every(finite) && a.speed > 0 && a.speed < 200 && Array.isArray(a.memory) && a.memory.length <= 300 && a.memory.every(point) && (!a.local || point(a.local)) && (!a.probe || (point(a.probe) && finite(a.probe.angle) && ids.has(a.probe.anchor))) && Array.isArray(a.recent) && typeof a.action === "string" && (!a.edge || ((ids.has(a.edge.from) || a.edge.from === -1) && (ids.has(a.edge.to) || a.edge.to === -1) && finite(a.edge.t))) && (!a.cargo || (["food", "soil", "water", "waste", "brood"].includes(a.cargo.kind) && finite(a.cargo.amount) && a.cargo.amount >= 0 && (a.cargo.kind !== "brood" || c.brood.some(b => b.id === a.cargo!.brood && b.carrier === a.id)))));
    for (const b of c.brood) assert(point(b) && roles.includes(b.role) && ids.has(b.node) && [b.age, b.fed, b.care, b.neglect].every(finite) && (b.carrier === null || c.ants.some(a => a.id === b.carrier)));
    for (const key of ["nextAnt", "nextBrood", "nextNode", "nextBatch"] as const) assert(Number.isInteger(c[key]) && c[key] >= 0);
    assert(c.nextAnt > Math.max(-1, ...c.ants.map(a => a.id)) && c.nextNode > Math.max(...ids) && roles.includes(c.nextRole));
    assert(c.totals && Object.values(c.totals).every(finite) && (["delivered", "eaten", "fed", "hatched", "soil", "waste", "water", "rain", "addedFood", "addedWater", "drained", "preparedFood", "casualties", "starved", "strikes"] as const).every(k => finite(c.totals[k])) && Array.isArray(c.log) && c.log.length <= 16);
    for (const key of ["trail", "alarm"] as const) { assert(numbers(c[key], 96 * 18)); c[key] = new Float32Array(c[key]); }
    assert(c.rival && Array.isArray(c.rival.ants) && c.rival.ants.length === 0);
    for (const key of ["trail", "raidTrail"] as const) { assert(numbers(c.rival[key], 96 * 18)); c.rival[key] = new Float32Array(c.rival[key]); }
    assert(Array.isArray(c.sources) && c.sources.length === 0 && Array.isArray(c.stones) && c.stones.length === 0 && Array.isArray(c.effects) && c.effects.length === 0 && Array.isArray(c.fallen) && c.fallen.length <= 600 && c.fallen.every(p => point(p) && finite(p.until)));
  }
  assert(Array.isArray(s.insects) && s.insects.length <= 12 && s.insects.every(i => point(i) && finite(i.angle) && finite(i.rest)));
  assert(Array.isArray(s.log) && s.log.length <= 50 && s.log.every(e => Number.isInteger(e.tick) && typeof e.text === "string" && e.text.length < 500) && typeof s.notice === "string");
  assert(s.nextObject > Math.max(-1, ...s.objects.map(o => o.id)) && s.nextColony > Math.max(...s.colonies.map(c => c.id)));
  return s;
}
