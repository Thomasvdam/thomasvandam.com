export type Scent = "home" | "store" | "food" | "brood" | "nursery" | "work" | "clean" | "crowd";
export type Room = "tunnel" | "queen" | "food" | "nursery";
export type NestNode = { id: number; parent: number | null; x: number; y: number; room: Room; size: number; water: number; traffic: number; food: number; waste: number; scent: Record<Scent, number>; blocked?: number; playerFlood?: boolean; spoil?: number; excavation?: { angle: number; remaining: number; dug: number } };
export type Point = { x: number; y: number };
export const noise = (i: number) => {
  let n = Math.imul(i + 1, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
export const radius = (n: NestNode) => n.room === "tunnel" ? 9 : 25 * Math.sqrt(n.size);
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function segmentDistance(p: Point, a: Point, b: Point) {
  const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length)) : 0;
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}
export function tunnelPath(a: Point, b: Point, id: number, reverse = false) {
  const length = distance(a, b) || 1;
  const bend = (noise(id + 91) - .5) * 22 * Math.min(1, length / 70) * (reverse ? -1 : 1);
  const dx = (b.y - a.y) / length * bend; const dy = (a.x - b.x) / length * bend;
  return `M${a.x} ${a.y}C${a.x + (b.x - a.x) * .33 + dx} ${a.y + (b.y - a.y) * .33 + dy} ${a.x + (b.x - a.x) * .67 + dx} ${a.y + (b.y - a.y) * .67 + dy} ${b.x} ${b.y}`;
}
export function chamberPath(n: NestNode) {
  const rx = radius(n); const ry = rx * (.63 + noise(n.id + 12) * .15);
  const { x, y } = n;
  return `M${x - rx} ${y - 2}C${x - rx - 3} ${y - ry * .8} ${x - rx * .35} ${y - ry - 4} ${x + rx * .2} ${y - ry}S${x + rx + 5} ${y - ry * .5} ${x + rx} ${y + 2}S${x + rx * .25} ${y + ry + 3} ${x - rx * .25} ${y + ry}S${x - rx + 3} ${y + ry * .6} ${x - rx} ${y - 2}Z`;
}
// Movement and drawing share the same curve, so ants stay inside tunnels.
export function tunnelPoint(a: Point, b: Point, id: number, t: number, reverse = false) {
  const length = distance(a, b) || 1;
  const bend = (noise(id + 91) - .5) * 22 * Math.min(1, length / 70) * (reverse ? -1 : 1);
  const dx = (b.y - a.y) / length * bend; const dy = (a.x - b.x) / length * bend;
  const c1 = { x: a.x + (b.x - a.x) * .33 + dx, y: a.y + (b.y - a.y) * .33 + dy };
  const c2 = { x: a.x + (b.x - a.x) * .67 + dx, y: a.y + (b.y - a.y) * .67 + dy };
  const u = 1 - t;
  return { x: u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x, y: u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y };
}
