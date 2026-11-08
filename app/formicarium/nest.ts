export type Room = "tunnel" | "queen" | "food" | "nursery" | "waste";
export type NestNode = { id: number; parent: number | null; x: number; y: number; room: Room; size: number; water: number; traffic: number };
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
function crossing(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}
export function tunnelPath(a: Point, b: Point, id: number, reverse = false) {
  const bend = (noise(id + 91) - .5) * 22 * (reverse ? -1 : 1);
  const length = distance(a, b) || 1;
  const dx = (b.y - a.y) / length * bend; const dy = (a.x - b.x) / length * bend;
  return `M${a.x} ${a.y}C${a.x + (b.x - a.x) * .33 + dx} ${a.y + (b.y - a.y) * .33 + dy} ${a.x + (b.x - a.x) * .67 + dx} ${a.y + (b.y - a.y) * .67 + dy} ${b.x} ${b.y}`;
}
export function chamberPath(n: NestNode) {
  const rx = radius(n); const ry = rx * (.63 + noise(n.id + 12) * .15);
  const { x, y } = n;
  return `M${x - rx} ${y - 2}C${x - rx - 3} ${y - ry * .8} ${x - rx * .35} ${y - ry - 4} ${x + rx * .2} ${y - ry}S${x + rx + 5} ${y - ry * .5} ${x + rx} ${y + 2}S${x + rx * .25} ${y + ry + 3} ${x - rx * .25} ${y + ry}S${x - rx + 3} ${y + ry * .6} ${x - rx} ${y - 2}Z`;
}
export function canPlace(nodes: NestNode[], candidate: NestNode) {
  const parent = nodes.find(n => n.id === candidate.parent);
  if (!parent || candidate.x < 55 || candidate.x > 905 || candidate.y < 235 || candidate.y > 600) return false;
  if (nodes.some(n => distance(n, candidate) < radius(n) + radius(candidate) + 16)) return false;
  for (const n of nodes) {
    if (n.id !== parent.id && segmentDistance(n, parent, candidate) < radius(n) + 19) return false;
    if (n.parent === null) continue;
    const from = nodes.find(p => p.id === n.parent)!;
    if (n.id !== parent.id && from.id !== parent.id && crossing(parent, candidate, from, n)) return false;
    if (segmentDistance(candidate, from, n) < radius(candidate) + 15) return false;
  }
  return true;
}
