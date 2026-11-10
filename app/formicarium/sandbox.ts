import { BATCH_FOOD, BATCH_SIZE, batchStatus, Brood, Colony, elapsed, nurserySlots, Role, storedFood } from "./simulation";
import { distance, Point, radius, tunnelPoint } from "./nest";
export type Tool = "observe" | "food" | "water" | "passage";
const message = (s: Colony, text: string, point: Point | null = null): Colony => ({ ...s, notice: { text, point: point ? { x: point.x, y: point.y } : null } });
function changed(s: Colony, text: string, point: Point): Colony {
  return { ...message(s, text, point), log: [{ time: elapsed(s), text }, ...s.log].slice(0, 16) };
}
export function batchProblem(s: Colony): string | null {
  if (s.result !== "alive") return "Start a new colony to raise brood.";
  if (batchStatus(s)?.remaining) return "Let the current batch hatch first.";
  if (s.ants.length + s.brood.length + BATCH_SIZE > 400) return "The colony is at its population limit.";
  if (storedFood(s) < BATCH_FOOD) return `Needs ${BATCH_FOOD} stored food. Add food to a store or let foragers deliver it.`;
  if (!s.nest.some(n => n.room === "nursery" && n.water <= .3 && nurserySlots(n) - s.brood.filter(b => b.node === n.id).length >= BATCH_SIZE)) return "Needs a dry nursery with room for 12 brood. Drain a nursery or let diggers enlarge it.";
  return null;
}
export function prepareBatch(previous: Colony, role: Role): Colony {
  const problem = batchProblem(previous); if (problem) return message(previous, problem);
  const s: Colony = { ...previous, nest: previous.nest.map(n => ({ ...n })), brood: [...previous.brood], nextRole: role };
  const nursery = s.nest.find(n => n.room === "nursery" && n.water <= .3 && nurserySlots(n) - s.brood.filter(b => b.node === n.id).length >= BATCH_SIZE)!;
  let cost = BATCH_FOOD;
  for (const n of s.nest) { const spent = Math.min(n.food, cost); n.food -= spent; cost -= spent; if (!cost) break; }
  const batch = { id: s.nextBatch++, role, total: BATCH_SIZE, hatched: 0, started: elapsed(s) };
  s.batch = batch;
  const offset = s.brood.filter(b => b.node === nursery.id && b.carrier === null).length;
  for (let i = 0; i < BATCH_SIZE; i++) {
    const slot = offset + i;
    const b: Brood = { id: s.nextBrood++, role, node: nursery.id, carrier: null, x: nursery.x - 22.5 + slot % 6 * 9, y: nursery.y - 12 + Math.floor(slot / 6) % 4 * 8, fed: 1, care: 0, age: 0, neglect: 0, batch: batch.id };
    s.brood.push(b);
  }
  // The player prepares a fed tray; ordinary brood still receives carried meals.
  s.totals = { ...s.totals, preparedFood: s.totals.preparedFood + BATCH_FOOD };
  return changed(s, `Prepared 12 ${role}s for 12 food. Nurses must tend them before they hatch.`, nursery);
}
export function passageAt(s: Colony, point: Point) {
  let best = 25; let found: { id: number; point: Point } | null = null;
  for (const n of s.nest) {
    if (n.parent === null || n.excavation) continue;
    const parent = s.nest.find(p => p.id === n.parent)!;
    for (let i = 2; i <= 8; i++) {
      const p = tunnelPoint(parent, n, n.id, i / 10); const d = distance(point, p);
      if (d < best) { best = d; found = { id: n.id, point: tunnelPoint(parent, n, n.id, .5) }; }
    }
  }
  return found;
}
export function intervene(previous: Colony, tool: Tool, point: Point): Colony {
  if (previous.result !== "alive" || tool === "observe") return previous;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return message(previous, "Choose a point in the habitat.");
  const s: Colony = { ...previous, nest: previous.nest.map(n => ({ ...n })), sources: previous.sources.map(f => ({ ...f })), totals: { ...previous.totals } };
  const chamber = s.nest.filter(n => n.room !== "tunnel" && distance(n, point) < radius(n) + 20).sort((a, b) => distance(a, point) - distance(b, point))[0];
  if (tool === "food") {
    if (point.y <= 180 && point.x >= 0 && point.x <= 960 && point.y >= 0) {
      const p = { x: Math.max(20, Math.min(940, point.x)), y: Math.max(110, Math.min(172, point.y)) };
      const patch = s.sources.find(f => distance(f, p) < 24);
      if (patch) { patch.amount += 60; patch.initial += 60; }
      else if (s.sources.length < 64) s.sources.push({ id: Math.max(-1, ...s.sources.map(f => f.id)) + 1, ...p, amount: 60, initial: 60 });
      else return message(previous, "Food patch limit reached. Refill an existing patch.");
      s.totals.addedFood += 60;
      return changed(s, "Added 60 seeds. Foragers must discover this patch and carry them home.", p);
    }
    if (chamber?.room === "food") {
      const amount = Math.max(0, Math.min(30, Math.floor(chamber.size * 55) - chamber.food));
      if (!amount) return message(previous, "This store is full. Add a surface patch or wait for more space.", chamber);
      chamber.food += amount; s.totals.addedFood += amount;
      return changed(s, `You placed ${amount} food directly in the store.`, chamber);
    }
    return message(previous, "Place food on the forest floor or inside a food store.");
  }
  if (tool === "water") {
    if (!chamber) return message(previous, "Tap a highlighted chamber to flood or drain it.");
    if (chamber.water > .3) {
      const amount = chamber.water; chamber.water = 0; chamber.playerFlood = false; s.totals.drained += amount;
      return changed(s, "You drained this chamber. Brood can recover here again.", chamber);
    }
    chamber.water += .8; chamber.playerFlood = true; s.totals.addedWater += .8;
    return changed(s, "Chamber flooded. Cleaners must carry water out; tap again to drain it yourself.", chamber);
  }
  const target = passageAt(s, point);
  if (!target) return message(previous, "Tap a highlighted passage to block it or reopen it.");
  const node = s.nest.find(n => n.id === target.id)!;
  if (node.blocked) { node.blocked = 0; return changed(s, "You reopened the passage. Ants can pass again.", target.point); }
  node.blocked = 12;
  return changed(s, "Passage blocked with rubble. Diggers can clear it, or tap again to reopen it.", target.point);
}
