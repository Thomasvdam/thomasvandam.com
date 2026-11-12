import { CELL, COLS, ROWS, cellPoint, creekX, Garden, GardenObject, HEIGHT, WIDTH } from "./garden";
import { noise } from "./nest";

// Alpha bounds within the six 512px cells of the botanical atlas.
const sprites = {
  berry: [20, 23, 467, 463], flower: [527, 27, 474, 453], log: [1035, 162, 491, 200],
  rock: [20, 554, 457, 422], fruit: [567, 555, 403, 420], bridge: [1031, 638, 496, 255],
} as const;
export function drawGardenObject(ctx: CanvasRenderingContext2D, o: GardenObject, atlas: HTMLImageElement) {
  const [sx, sy, sw, sh] = sprites[o.kind];
  const width = o.kind === "bridge" ? 216 : o.kind === "log" ? 140 : o.kind === "rock" ? 78 : o.kind === "fruit" ? 36 + Math.sqrt(Math.max(0, o.food)) * 3 : (o.kind === "berry" ? 115 : 94) * (.3 + o.growth * .7);
  // Bridge deck and the traversable span use the same dimensions.
  const height = o.kind === "bridge" ? 52 : width * sh / sw;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
  ctx.fillStyle = "#18201935"; ctx.beginPath(); ctx.ellipse(4, 7, width * .43, height * .35, 0, 0, Math.PI * 2); ctx.fill();
  if (o.condition < .6) ctx.filter = "saturate(.45) sepia(.3)";
  else if (o.kind === "berry" && o.food < 1) ctx.filter = "saturate(.6)";
  ctx.drawImage(atlas, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
  ctx.restore();
}
export function soilTexture() {
  const tile = document.createElement("canvas"); tile.width = tile.height = 512; const ctx = tile.getContext("2d")!;
  for (let i = 0; i < 10000; i++) {
    const x = noise(i + 70) * 512, y = noise(i + 980) * 512;
    ctx.fillStyle = i % 3 ? "#ecd7ae20" : "#18211730"; ctx.fillRect(x, y, noise(i + 2) * 2 + .5, noise(i + 7) * 1.5 + .5);
  }
  for (let i = 0; i < 200; i++) {
    const x = noise(i + 110) * 512, y = noise(i + 400) * 512;
    ctx.strokeStyle = i % 2 ? "#bfb27522" : "#374b3025"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 5, x + 13, y - 2); ctx.stroke();
  }
  return tile;
}
export function paintTerrain(ctx: CanvasRenderingContext2D, field: HTMLCanvasElement, texture: CanvasPattern, s: Garden, ground: CanvasPattern | null) {
  const f = field.getContext("2d")!, pixels = f.createImageData(COLS, ROWS);
  for (let i = 0; i < s.moisture.length; i++) {
    const wet = s.moisture[i], fertile = s.fertility[i], grain = noise(i) * 6;
    pixels.data.set([125 - wet * 48 - fertile * 13 + grain, 111 - wet * 11 + fertile * 9 + grain, 76 - wet * 12 + grain, 255], i * 4);
  }
  f.putImageData(pixels, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(field, 0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = texture; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (ground) { ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = .85; ctx.fillStyle = ground; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.restore(); }
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); for (let y = -30; y <= HEIGHT + 30; y += 10) { if (y === -30) ctx.moveTo(creekX(y), y); else ctx.lineTo(creekX(y), y); }
  // Soft banks and irregular shallows keep the stream legible without road-like bands.
  for (const [color, width] of [["#66704a", 128], ["#9a9470", 116], ["#405a46", 104], ["#618d7c", 95]] as const) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  for (const p of [{ x: 590, y: 820, r: 65 }, { x: 1820, y: 520, r: 77 }]) {
    const g = ctx.createRadialGradient(p.x - 15, p.y - 20, 5, p.x, p.y, p.r); g.addColorStop(0, "#83a99a"); g.addColorStop(.8, "#4a796b"); g.addColorStop(1, "#364c39"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * .92, -.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#7d8056"; ctx.lineWidth = 5; ctx.stroke();
  }
  for (let i = 0; i < s.channels.length; i++) if (s.channels[i]) {
    const p = cellPoint(i), x = i % COLS;
    const adjacent = [x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1, i >= COLS ? i - COLS : -1, i + COLS < s.channels.length ? i + COLS : -1].filter(k => k >= 0 && s.channels[k]).map(cellPoint).map(q => ({ x: (q.x + p.x) / 2, y: (q.y + p.y) / 2 }));
    ctx.beginPath(); if (adjacent.length === 2) { ctx.moveTo(adjacent[0].x, adjacent[0].y); ctx.quadraticCurveTo(p.x, p.y, adjacent[1].x, adjacent[1].y); } else for (const q of adjacent) { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
    ctx.strokeStyle = "#a29770"; ctx.lineWidth = 25; ctx.stroke(); ctx.strokeStyle = "#48573c"; ctx.lineWidth = 20; ctx.stroke(); ctx.strokeStyle = s.water[i] > .2 ? "#6d9584" : "#635b40"; ctx.lineWidth = 13; ctx.stroke();
    if (adjacent.length < 2) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2); ctx.fill(); }
  }
  // Small stones and bank plants are deterministic scenery, never obstacles.
  for (let i = 0; i < 190; i++) {
    const y = noise(i + 500) * HEIGHT, side = i % 2 ? -1 : 1, x = creekX(y) + side * (59 + noise(i + 51) * 17);
    ctx.fillStyle = i % 4 ? "#748151" : "#b0ac89"; ctx.beginPath(); ctx.ellipse(x, y, 2 + noise(i + 2) * 4, 1 + noise(i + 8) * 3, noise(i) * 6, 0, Math.PI * 2); ctx.fill();
    if (i % 3) { ctx.strokeStyle = "#a6b47b80"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 2, y - 7, x - 6, y - 9); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 2, y - 9, x + 5, y - 12); ctx.stroke(); }
  }
  for (let i = 0; i < 90; i++) {
    const y = noise(i + 1800) * HEIGHT, side = i % 2 ? -1 : 1, x = creekX(y) + side * (37 + noise(i + 71) * 8);
    ctx.fillStyle = i % 3 ? "#b1b39540" : "#334f4038"; ctx.beginPath(); ctx.ellipse(x, y, 2 + noise(i) * 5, 3 + noise(i + 81) * 9, -.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "#c9e3ce36"; ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) { const y = i * 39 + 8; ctx.beginPath(); ctx.moveTo(creekX(y) - 25, y); ctx.quadraticCurveTo(creekX(y) - 5, y + 7, creekX(y) + 17, y + 4); ctx.stroke(); }
}
export function paintGarden(ctx: CanvasRenderingContext2D, terrain: HTMLCanvasElement, atlas: HTMLImageElement | null, s: Garden) {
  ctx.drawImage(terrain, 0, 0);
  if (atlas) for (const o of [...s.objects].sort((a, b) => a.y - b.y)) drawGardenObject(ctx, o, atlas);
  for (const home of s.colonies) {
    const mound = ctx.createRadialGradient(home.x - 5, home.y - 7, 3, home.x, home.y, 34); mound.addColorStop(0, "#c2ac7c"); mound.addColorStop(.7, "#9f8b60"); mound.addColorStop(1, "#83794e00"); ctx.fillStyle = mound; ctx.beginPath(); ctx.ellipse(home.x, home.y, 40, 30, -.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#242b1d"; ctx.beginPath(); ctx.ellipse(home.x, home.y - 3, 10, 7, -.2, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 28; i++) { const a = noise(i + home.id) * Math.PI * 2, d = 12 + noise(i + 10) * 21; ctx.fillStyle = i % 2 ? "#d2ba89" : "#746748"; ctx.fillRect(home.x + Math.cos(a) * d, home.y + Math.sin(a) * d * .7, 1.5, 1); }
    ctx.font = "500 13px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#1e2d20df"; ctx.beginPath(); ctx.roundRect(home.x - 36, home.y - 57, 72, 23, 11); ctx.fill(); ctx.fillStyle = home.color; ctx.fillText(home.name, home.x, home.y - 41);
  }
}
export { CELL };
