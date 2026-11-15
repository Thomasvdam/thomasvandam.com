import { COLS, cellPoint, creekX, Garden, HEIGHT, WIDTH } from "./garden";
import { noise, Point } from "./nest";

type Sample = Point & { width: number; wet: number };
type Reach = { points: Sample[]; closed: boolean };
const materials = new WeakMap<CanvasRenderingContext2D, { source: CanvasPattern; bed: CanvasPattern; water: CanvasPattern }>();
function waterMaterials(ctx: CanvasRenderingContext2D, source: CanvasPattern, textured: boolean) {
  let cached = materials.get(ctx); if (cached?.source === source) return cached;
  const make = (color: string, strength: number) => {
    const tile = document.createElement("canvas"); tile.width = tile.height = textured ? 384 : 512; const paint = tile.getContext("2d")!;
    paint.fillStyle = color; paint.fillRect(0, 0, tile.width, tile.height);
    paint.globalCompositeOperation = "soft-light"; paint.globalAlpha = strength; paint.fillStyle = source; paint.fillRect(0, 0, tile.width, tile.height);
    return ctx.createPattern(tile, "repeat")!;
  };
  cached = { source, bed: make("#696347", .7), water: make("#628473", .4) }; materials.set(ctx, cached); return cached;
}
// Trace each connection once so bends and junctions share a continuous bank.
function channelReaches(s: Garden): Reach[] {
  const neighbors = s.channels.map((dug, i) => !dug ? 0 :
    (i % COLS > 0 && s.channels[i - 1] ? 1 : 0) |
    (i % COLS < COLS - 1 && s.channels[i + 1] ? 2 : 0) |
    (i >= COLS && s.channels[i - COLS] ? 4 : 0) |
    (i + COLS < s.channels.length && s.channels[i + COLS] ? 8 : 0));
  const used = new Uint8Array(s.channels.length), reaches: Reach[] = [];
  const directions = [{ bit: 1, back: 2, step: -1 }, { bit: 2, back: 1, step: 1 }, { bit: 4, back: 8, step: -COLS }, { bit: 8, back: 4, step: COLS }];
  const degree = (i: number) => directions.reduce((sum, d) => sum + (neighbors[i] & d.bit ? 1 : 0), 0);
  const trace = (start: number, direction: typeof directions[number]) => {
    const cells = [start]; let i = start, d = direction;
    do {
      used[i] |= d.bit; i += d.step; used[i] |= d.back; cells.push(i);
      if (i === start || degree(i) !== 2) break;
      d = directions.find(next => (neighbors[i] & next.bit) && !(used[i] & next.bit))!;
    } while (d);
    const closed = cells.at(-1) === start;
    let raw = cells.map(k => ({ ...cellPoint(k), width: 7.2, wet: s.water[k] }));
    // Relax the raster staircase into a flowing centreline; junctions and endpoints stay fixed.
    for (let pass = 0; pass < 3; pass++) raw = raw.map((p, j) => {
      if (!closed && (j === 0 || j === raw.length - 1)) return p;
      const a = raw[j - 1] ?? raw[raw.length - 2], b = raw[j + 1] ?? raw[1];
      return { ...p, x: (a.x + p.x * 2 + b.x) / 4, y: (a.y + p.y * 2 + b.y) / 4 };
    });
    // Subdivide the whole reach, rather than rounding each cell separately.
    const points: Sample[] = [];
    for (let j = 0; j < raw.length - 1; j++) {
      const a = raw[j], b = raw[j + 1], before = raw[j - 1] ?? (closed ? raw[raw.length - 2] : a), after = raw[j + 2] ?? (closed ? raw[1] : b);
      for (let n = 0; n < 4; n++) {
        const t = n / 4, t2 = t * t, t3 = t2 * t;
        const curve = (key: "x" | "y") => .5 * (2 * a[key] + (-before[key] + b[key]) * t + (2 * before[key] - 5 * a[key] + 4 * b[key] - after[key]) * t2 + (-before[key] + 3 * a[key] - 3 * b[key] + after[key]) * t3);
        points.push({ x: curve("x"), y: curve("y"), width: 7.2, wet: a.wet + (b.wet - a.wet) * t });
      }
    }
    points.push(raw.at(-1)!); reaches.push({ points, closed });
  };
  for (let i = 0; i < s.channels.length; i++) if (s.channels[i]) {
    if (!neighbors[i]) reaches.push({ points: [{ ...cellPoint(i), width: 7.2, wet: s.water[i] }], closed: false });
    else if (degree(i) !== 2) for (const d of directions) if ((neighbors[i] & d.bit) && !(used[i] & d.bit)) trace(i, d);
  }
  // A ring has no endpoint or junction from which to start tracing.
  for (let i = 0; i < s.channels.length; i++) for (const d of directions) if ((neighbors[i] & d.bit) && !(used[i] & d.bit)) trace(i, d);
  return reaches;
}

function ribbon({ points, closed }: Reach, margin: number, water = false) {
  const shape = new Path2D();
  const widths = points.map(p => Math.max(0, p.width + margin + Math.sin(p.x / 37 + p.y / 51) * .8 + Math.sin(p.x / 13 - p.y / 29) * .35) * (water ? Math.min(1, Math.max(0, (p.wet - .025) * 2)) : 1));
  if (points.length === 1) { shape.arc(points[0].x, points[0].y, widths[0], 0, -Math.PI * 2, true); return shape; }
  const normals = points.map((p, i) => {
    const a = points[i - 1] ?? (closed ? points[points.length - 2] : p), b = points[i + 1] ?? (closed ? points[1] : p);
    return Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
  });
  for (let i = 0; i < points.length; i++) { const p = points[i], x = p.x + Math.cos(normals[i]) * widths[i], y = p.y + Math.sin(normals[i]) * widths[i]; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }
  const end = points.length - 1;
  if (closed) shape.closePath();
  else shape.arc(points[end].x, points[end].y, widths[end], normals[end], normals[end] - Math.PI, true);
  for (let i = end; i >= 0; i--) { const p = points[i], x = p.x - Math.cos(normals[i]) * widths[i], y = p.y - Math.sin(normals[i]) * widths[i]; if (closed && i === end) shape.moveTo(x, y); else shape.lineTo(x, y); }
  if (!closed) shape.arc(points[0].x, points[0].y, widths[0], normals[0] + Math.PI, normals[0], true);
  shape.closePath(); return shape;
}
function pond(x: number, y: number, radius: number, margin: number) {
  const shape = new Path2D();
  for (let i = 0; i <= 80; i++) { const a = -i / 80 * Math.PI * 2, r = radius + margin + Math.sin(a * 3 + x) * 2 + Math.cos(a * 5 + y) * 1.3; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) shape.lineTo(px, py); else shape.moveTo(px, py); }
  shape.closePath(); return shape;
}
function drawWaterways(ctx: CanvasRenderingContext2D, s: Garden, grain: CanvasPattern, ground: CanvasPattern | null) {
  const creek: Reach = { points: [], closed: false };
  for (let y = -40; y <= HEIGHT + 40; y += 8) creek.points.push({ x: creekX(y), y, width: 47, wet: 1 });
  const reaches = [...channelReaches(s), creek], pools = [{ x: 590, y: 820, r: 63 }, { x: 1820, y: 520, r: 75 }];
  const banks = new Path2D(), bed = new Path2D(), water = new Path2D();
  for (const reach of reaches) { banks.addPath(ribbon(reach, 4)); bed.addPath(ribbon(reach, 1)); water.addPath(ribbon(reach, -1, true)); }
  for (const p of pools) { banks.addPath(pond(p.x, p.y, p.r, 6)); bed.addPath(pond(p.x, p.y, p.r, 2)); water.addPath(pond(p.x, p.y, p.r, -1)); }
  const material = waterMaterials(ctx, ground ?? grain, !!ground);
  ctx.fillStyle = "#777b4b55"; ctx.fill(banks);
  ctx.fillStyle = material.bed; ctx.fill(bed);
  ctx.fillStyle = material.water; ctx.fill(water);
  // Sparse highlights and sediment replace the repeated cross-stream stripes.
  for (let i = 0; i < 115; i++) {
    const y = noise(i + 1800) * HEIGHT, x = creekX(y) + (noise(i + 71) - .5) * 78;
    ctx.strokeStyle = i % 3 ? "#c0c9a326" : "#293f3026"; ctx.lineWidth = .5 + noise(i) * 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 3, y + 4, x + 1, y + 9 + noise(i + 30) * 12); ctx.stroke();
  }
  for (const reach of reaches) for (let i = 2; i < reach.points.length - 1; i += reach === creek ? 5 : 7) {
    const p = reach.points[i], next = reach.points[i + 1], side = noise(i + Math.round(p.x)) > .5 ? -1 : 1, a = Math.atan2(next.y - p.y, next.x - p.x) + Math.PI / 2;
    const d = p.width + 2, x = p.x + Math.cos(a) * d * side, y = p.y + Math.sin(a) * d * side;
    ctx.fillStyle = i % 3 ? "#b9ab7b55" : "#343e2766"; ctx.beginPath(); ctx.ellipse(x, y, .8 + noise(i) * 1.5, .5 + noise(i + 2), a, 0, Math.PI * 2); ctx.fill();
    const seed = Math.round(p.x * 3 + p.y * 7);
    if (p.wet > .2 && noise(seed) > .55) { ctx.strokeStyle = noise(seed + 1) > .5 ? "#98a26788" : "#44593699"; ctx.lineWidth = .7; ctx.beginPath(); for (let blade = 0; blade < 3; blade++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + blade * 2 - 2, y - 4, x + blade * 4 - 4, y - 5 - noise(seed + blade + 2) * 4); } ctx.stroke(); }
  }
}

const layers = new WeakMap<CanvasRenderingContext2D, { canvas: HTMLCanvasElement; key: string; source: CanvasPattern | null }>();
export function paintWaterways(ctx: CanvasRenderingContext2D, s: Garden, grain: CanvasPattern, ground: CanvasPattern | null) {
  let layer = layers.get(ctx);
  if (!layer) { const canvas = document.createElement("canvas"); canvas.width = WIDTH / 2; canvas.height = HEIGHT / 2; layer = { canvas, key: "", source: null }; layers.set(ctx, layer); }
  // Subpixel depth changes do not require rasterising every bank again.
  let key = "water";
  for (let i = 0; i < s.channels.length; i++) if (s.channels[i]) key += `:${i}.${Math.floor(Math.min(1, Math.max(0, (s.water[i] - .025) * 2)) * 16)}`;
  if (layer.key !== key || layer.source !== (ground ?? grain)) {
    const paint = layer.canvas.getContext("2d")!; paint.setTransform(.5, 0, 0, .5, 0, 0); paint.clearRect(0, 0, WIDTH, HEIGHT);
    drawWaterways(paint, s, grain, ground); layer.key = key; layer.source = ground ?? grain;
  }
  ctx.drawImage(layer.canvas, 0, 0, WIDTH, HEIGHT);
}
