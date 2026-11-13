import type { Garden, GardenColony } from "./garden";
import { Ant, DT } from "./simulation";
import { distance, segmentDistance } from "./nest";

type Actor = { ant: Ant; home: GardenColony };
export function gardenConflict(s: Garden) {
  const buckets = new Map<string, Actor[]>(), busy = new Set<Ant>(), damage = new Map<Ant, number>();
  for (const home of s.colonies) if (home.colony.result === "alive") for (const ant of home.colony.ants) if (ant.zone === "surface") {
    const key = `${Math.floor(ant.x / 100)},${Math.floor(ant.y / 100)}`;
    const list = buckets.get(key) ?? []; list.push({ ant, home }); buckets.set(key, list);
  }
  for (const list of buckets.values()) for (const { ant: a, home } of list) {
    let target: Actor | undefined, nearest = a.role === "soldier" ? 100 : 15;
    const x = Math.floor(a.x / 100), y = Math.floor(a.y / 100);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const other of buckets.get(`${x + dx},${y + dy}`) ?? []) {
      if (other.home.id === home.id) continue;
      const d = distance(a, other.ant);
      if (d >= nearest || s.objects.some(o => o.kind === "rock" && segmentDistance(o, a, other.ant) < 30)) continue;
      // Contact cannot cross deep water, even when both ants stand on opposite banks.
      let clear = true;
      for (let t = .2; t < 1; t += .2) { const px = a.x + (other.ant.x - a.x) * t, py = a.y + (other.ant.y - a.y) * t; const k = Math.floor(py / 30) * 80 + Math.floor(px / 30); if (s.water[k] >= .65 && !s.objects.some(o => o.kind === "bridge" && segmentDistance({ x: px, y: py }, { x: o.x - Math.cos(o.angle) * 105, y: o.y - Math.sin(o.angle) * 105 }, { x: o.x + Math.cos(o.angle) * 105, y: o.y + Math.sin(o.angle) * 105 }) < 20)) { clear = false; break; } }
      if (clear) { target = other; nearest = d; }
    }
    if (!target) continue;
    a.reportNest = true;
    if (nearest <= 13) {
      const text = home.id < target.home.id ? `${home.name} and ${target.home.name} clashed.` : `${target.home.name} and ${home.name} clashed.`;
      if (!s.log.some(e => e.text === text && s.tick - e.tick < 600)) { s.log = [{ tick: s.tick, text }, ...s.log].slice(0, 50); s.notice = text; }
      busy.add(a); a.fighting = true; a.action = `Fighting ${target.home.name}`; a.angle = Math.atan2(target.ant.y - a.y, target.ant.x - a.x);
      damage.set(target.ant, (damage.get(target.ant) ?? 0) + DT * (a.role === "soldier" ? .95 : .22));
    } else if (a.role === "soldier") { a.local = { x: target.ant.x, y: target.ant.y }; }
  }
  for (const [ant, amount] of damage) ant.health -= amount;
  for (const home of s.colonies) {
    const dead = home.colony.ants.filter(a => a.health <= 0);
    for (const a of dead) {
      if (a.cargo?.kind === "food") { const patch = s.objects.find(o => o.kind === "fruit" && distance(o, a) < 30); if (patch) patch.food += a.cargo.amount; else s.objects.push({ id: s.nextObject++, x: a.x, y: a.y, kind: "fruit", food: a.cargo.amount, age: 0, condition: 0, growth: 1, visits: [], pollen: 0, angle: 0 }); }
      home.colony.fallen.push({ x: a.x, y: a.y, team: "home", until: home.colony.tick * DT + 8 });
    }
    if (dead.length) { home.colony.totals.casualties += dead.length; home.colony.ants = home.colony.ants.filter(a => a.health > 0); if (!home.colony.ants.length) home.colony.result = "lost"; }
  }
  return busy;
}
