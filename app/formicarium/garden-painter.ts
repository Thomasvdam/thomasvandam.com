import { CELL, COLS, ROWS, Garden, GardenObject, HEIGHT, WIDTH } from "./garden";
import { noise } from "./nest";
import { paintWaterways } from "./waterways";

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
  f.putImageData(pixels, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "low"; ctx.drawImage(field, 0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = texture; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (ground) { ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = ground; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.restore(); }
  paintWaterways(ctx, s, texture, ground);
}
export function paintGarden(ctx: CanvasRenderingContext2D, terrain: HTMLCanvasElement, atlas: HTMLImageElement | null, s: Garden) {
  ctx.drawImage(terrain, 0, 0, WIDTH, HEIGHT);
  if (atlas) for (const o of [...s.objects].sort((a, b) => a.y - b.y)) drawGardenObject(ctx, o, atlas);
  for (const home of s.colonies) {
    const mound = ctx.createRadialGradient(home.x - 5, home.y - 7, 3, home.x, home.y, 34); mound.addColorStop(0, "#c2ac7c"); mound.addColorStop(.7, "#9f8b60"); mound.addColorStop(1, "#83794e00"); ctx.fillStyle = mound; ctx.beginPath(); ctx.ellipse(home.x, home.y, 40, 30, -.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#242b1d"; ctx.beginPath(); ctx.ellipse(home.x, home.y - 3, 10, 7, -.2, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 28; i++) { const a = noise(i + home.id) * Math.PI * 2, d = 12 + noise(i + 10) * 21; ctx.fillStyle = i % 2 ? "#d2ba89" : "#746748"; ctx.fillRect(home.x + Math.cos(a) * d, home.y + Math.sin(a) * d * .7, 1.5, 1); }
    ctx.font = "500 13px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#1e2d20df"; ctx.beginPath(); ctx.roundRect(home.x - 36, home.y - 57, 72, 23, 11); ctx.fill(); ctx.fillStyle = home.color; ctx.fillText(home.name, home.x, home.y - 41);
  }
}
export { CELL };
