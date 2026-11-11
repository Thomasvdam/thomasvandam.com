import type { Colony, Ant } from "./simulation";
import { distance, NestNode, Point, radius, Room, segmentDistance, tunnelPoint } from "./nest";
export const MAX_NEST_NODES = 128;
export const NEST_BOUNDS = { left: 60, right: 1900, top: 225, bottom: 1500 };
export function adjacentNodes(nodes: NestNode[], n: NestNode) {
  return nodes.filter(p => p.parent === n.id || p.id === n.parent || n.links?.includes(p.id) || p.links?.includes(n.id));
}
export function nestPassages(nodes: NestNode[]) {
  return nodes.flatMap(n => [
    ...(n.parent !== null ? [{ from: n.parent, to: n.id, id: n.id, link: false }] : []),
    ...(n.links ?? []).map(to => ({ from: n.id, to, id: 10000 + n.id * 256 + to, link: true })),
  ]);
}
export function passageGeometry(nodes: NestNode[], from: number, to: number) {
  const a = nodes.find(n => n.id === from), b = nodes.find(n => n.id === to);
  if (a?.parent === to) return { id: from, reverse: true, barrier: a };
  if (b?.parent === from) return { id: to, reverse: false, barrier: b };
  if (a?.links?.includes(to)) return { id: 10000 + from * 256 + to, reverse: false, barrier: undefined };
  return { id: 10000 + to * 256 + from, reverse: true, barrier: undefined };
}
export function growthNeed(s: Colony, n: NestNode): Room | null {
  if (n.id === 0 || n.room === "queen" || n.excavation || n.water > .4) return null;
  const local = s.brood.filter(b => b.node === n.id).length;
  const rooms = adjacentNodes(s.nest, n).filter(p => !p.excavation && p.id !== n.parent);
  if (n.room === "food" && n.food > n.size * 55 * .5 && rooms.filter(p => p.room === "food").length < 2) return "food";
  if ((local >= Math.max(3, n.size * 2) || n.scent.brood > .18) && rooms.filter(p => p.room === "nursery").length < 2) return "nursery";
  if ((n.food > n.size * 55 * .5 || n.scent.food > .4) && rooms.filter(p => p.room === "food").length < 2) return "food";
  if ((n.traffic > .12 || n.scent.crowd > .22) && rooms.length < 3) return "tunnel";
  return null;
}
export function clearSoil(s: Colony, p: Point, anchor: number, self = -1, target = -1) {
  if (p.x < NEST_BOUNDS.left || p.x > NEST_BOUNDS.right || p.y < NEST_BOUNDS.top || p.y > NEST_BOUNDS.bottom) return false;
  for (const n of s.nest) if (n.id !== anchor && n.id !== self && n.id !== target && distance(p, n) < radius(n) + 14) return false;
  const origin = s.nest.find(n => n.id === anchor)!;
  for (const edge of nestPassages(s.nest)) {
    if (edge.to === self || edge.from === self) continue;
    const a = s.nest.find(n => n.id === edge.from)!, b = s.nest.find(n => n.id === edge.to)!;
    const goal = s.nest.find(n => n.id === target);
    if (goal && (a.id === target || b.id === target) && distance(p, goal) < radius(goal) + 25) continue;
    if ((a.id === anchor || b.id === anchor) && distance(p, origin) < radius(origin) + 25) continue;
    let last = a as Point;
    for (let i = 1; i <= 8; i++) { const next = tunnelPoint(a, b, edge.id, i / 8); if (segmentDistance(p, last, next) < 14) return false; last = next; }
  }
  return true;
}
export function planGrowth(s: Colony, a: Ant, n: NestNode, random: () => number, bypassOnly = false) {
  if (s.nest.length >= MAX_NEST_NODES || s.nest.filter(p => p.excavation).length >= 6 || s.nest.filter(p => p.parent === n.id && p.excavation).length >= 2) return null;
  const need = growthNeed(s, n);
  // A bypass targets a busy junction remembered from this ant's own recent walk.
  const remembered = s.nest.filter(p => a.recent.includes(p.id) && p.id !== n.id && p.id !== 0 && p.room !== "queen" && !p.excavation && !adjacentNodes(s.nest, n).includes(p) && distance(p, n) > 75 && distance(p, n) < 210 && p.traffic > .08).sort((a, b) => distance(a, n) - distance(b, n))[0];
  if ((!need || bypassOnly) && !remembered) return null;
  const parent = s.nest.find(p => p.id === n.parent);
  const base = parent ? Math.atan2(n.y - parent.y, n.x - parent.x) : Math.PI / 2;
  for (let attempt = 0; attempt < 18; attempt++) {
    const target = attempt === 0 && n.traffic > .12 ? remembered : undefined;
    if ((!need || bypassOnly) && !target) continue;
    const angle = target ? Math.atan2(target.y - n.y, target.x - n.x) : base + (random() - .5) * Math.PI * 1.7;
    const wallDistance = radius(n) * (n.room === "tunnel" ? 1 : .8);
    const wall = { x: n.x + Math.cos(angle) * wallDistance, y: n.y + Math.sin(angle) * wallDistance };
    const length = target ? distance(wall, target) - radius(target) - 8 : 75 + random() * 65;
    if (length < 30) continue;
    let clear = true;
    for (let d = 12; d <= length; d += 12) if (!clearSoil(s, { x: wall.x + Math.cos(angle) * d, y: wall.y + Math.sin(angle) * d }, n.id, -1, target?.id)) { clear = false; break; }
    if (!clear) continue;
    return { ...wall, angle, anchor: n.id, length, room: target ? "tunnel" as const : need === "tunnel" ? (n.scent.brood > n.scent.food ? "nursery" as const : "food" as const) : need!, target: target?.id };
  }
  return null;
}
export function nestGrowth(s: Colony) {
  const passages = nestPassages(s.nest);
  return { rooms: s.nest.filter(n => n.room !== "tunnel").length, passages: passages.length, faces: s.nest.filter(n => n.excavation).length, bypasses: passages.filter(p => p.link).length, length: passages.reduce((sum, p) => sum + distance(s.nest.find(n => n.id === p.from)!, s.nest.find(n => n.id === p.to)!), 0) };
}
