import { BATCH_FOOD, BATCH_SIZE, batchStatus, Brood, Colony, dropCargo, elapsed, fieldIndex, FIELD_COLS, nurserySlots, Role, storedFood } from "./simulation";
import { distance, Point, radius, tunnelPoint } from "./nest";
export type Tool = "observe" | "hand" | "food" | "stone" | "water" | "passage" | "strike";
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
export function releaseHeld(previous: Colony): Colony {
  if (!previous.held) return previous;
  return { ...previous, held: null, sources: previous.sources.map(f => ({ ...f, lifted: false })), stones: previous.stones.map(o => ({ ...o, lifted: false })) };
}
export function intervene(previous: Colony, tool: Tool, point: Point): Colony {
  if (previous.result !== "alive" || tool === "observe") return previous;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return message(previous, "Choose a point in the habitat.");
  const s: Colony = { ...previous, nest: previous.nest.map(n => ({ ...n })), sources: previous.sources.map(f => ({ ...f })), totals: { ...previous.totals }, stones: previous.stones.map(o => ({ ...o })), effects: [...previous.effects] };
  const chamber = s.nest.filter(n => n.room !== "tunnel" && distance(n, point) < radius(n) + 20).sort((a, b) => distance(a, point) - distance(b, point))[0];
  const floor = point.y >= 0 && point.y <= 180 && point.x >= 0 && point.x <= 960;
  const landing = { x: Math.max(20, Math.min(940, point.x)), y: Math.max(110, Math.min(172, point.y)) };
  if (tool === "hand") {
    if (s.held) {
      if (!floor) return message(previous, "Place the held object on the forest floor, or put it back.");
      const item = s.held.kind === "food" ? s.sources.find(f => f.id === s.held!.id) : s.stones.find(o => o.id === s.held!.id);
      if (!item) return releaseHeld(s);
      item.x = landing.x; item.y = landing.y; item.lifted = false; s.held = null;
      return changed(s, "Object moved. The ants must discover its new location; old trails will fade.", landing);
    }
    const options = [...s.sources.filter(f => f.amount > 0).map(f => ({ kind: "food" as const, item: f })), ...s.stones.map(o => ({ kind: "stone" as const, item: o }))].filter(o => distance(o.item, point) < 28).sort((a, b) => distance(a.item, point) - distance(b.item, point));
    const picked = options[0];
    if (!picked) return message(previous, "Pick up a food patch or stone on the forest floor.");
    picked.item.lifted = true; s.held = { kind: picked.kind, id: picked.item.id };
    return changed(s, `Holding ${picked.kind === "food" ? "a food patch" : "a stone"}. Tap the forest floor to place it.`, picked.item);
  }
  if (tool === "stone") {
    if (!floor) return message(previous, "Place stones on the forest floor. A stone over the entrance blocks both colonies.");
    const existing = s.stones.find(o => !o.lifted && distance(o, landing) < o.radius + 8);
    if (existing) { s.stones = s.stones.filter(o => o.id !== existing.id); return changed(s, "Stone lifted. Both colonies can use this route again.", existing); }
    if (s.stones.length >= 12) return message(previous, "Lift or move an existing stone first.");
    s.stones.push({ id: Math.max(-1, ...s.stones.map(o => o.id)) + 1, ...landing, radius: 20 });
    return changed(s, "Stone placed. It obstructs workers and invaders alike.", landing);
  }
  if (tool === "strike") {
    s.ants = s.ants.map(a => ({ ...a, cargo: a.cargo ? { ...a.cargo } : null }));
    s.rival = { ...s.rival, ants: s.rival.ants.map(a => ({ ...a, cargo: a.cargo ? { ...a.cargo } : null })) };
    s.brood = s.brood.map(b => ({ ...b })); s.fallen = [...s.fallen];
    const struck = [...s.ants, ...s.rival.ants].filter(a => distance(a, point) < 18);
    if (!struck.length) return message(previous, "No ants within reach. Strike close to an ant.");
    for (const a of struck) { dropCargo(s, a); s.fallen.push({ x: a.x, y: a.y, team: a.team, until: elapsed(s) + 8 }); }
    const friends = struck.filter(a => a.team === "home").length;
    s.ants = s.ants.filter(a => !struck.includes(a)); s.rival.ants = s.rival.ants.filter(a => !struck.includes(a));
    s.totals.casualties += friends; s.rival.defeated += struck.length - friends; s.totals.strikes++;
    s.effects.push({ ...point, kind: "strike", until: elapsed(s) + 3 });
    if (!s.ants.length) s.result = "lost";
    return changed(s, `Struck ${struck.length - friends} ${struck.length - friends === 1 ? "invader" : "invaders"}${friends ? ` and ${friends} of your own ants` : ""}. Dropped loads remain in the habitat.`, point);
  }
  if (tool === "food") {
    if (point.y <= 180 && point.x >= 0 && point.x <= 960 && point.y >= 0) {
      const p = { x: Math.max(20, Math.min(940, point.x)), y: Math.max(110, Math.min(172, point.y)) };
      const patch = s.sources.find(f => !f.lifted && distance(f, p) < 24);
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
    if (floor) {
      s.trail = s.trail.slice(); s.alarm = s.alarm.slice();
      s.rival = { ...s.rival, trail: s.rival.trail.slice(), raidTrail: s.rival.raidTrail.slice() };
      for (let i = 0; i < s.trail.length; i++) {
        const p = { x: i % FIELD_COLS * 10 + 5, y: Math.floor(i / FIELD_COLS) * 10 + 5 };
        if (distance(p, landing) <= 55) { const k = fieldIndex(p.x, p.y); s.trail[k] = 0; s.alarm[k] = 0; s.rival.trail[k] = 0; s.rival.raidTrail[k] = 0; }
      }
      const runoff = distance(landing, { x: 450, y: 175 }) < 75;
      if (runoff) { s.nest[0].water += .3; s.totals.addedWater += .3; }
      s.effects.push({ ...landing, kind: "wash", until: elapsed(s) + 5 });
      return changed(s, `Washed away nearby food, alarm, and invasion trails.${runoff ? " Runoff entered your nest." : " Ants can lay fresh trails."}`, landing);
    }
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
