"use client";

import { useEffect, useRef } from "react";
import { CELL, cellPoint, COLS, creekX, Garden, GardenObject, GardenTool, HEIGHT, WIDTH } from "./garden";
import { noise, Point } from "./nest";
import styles from "./garden.module.css";
export type Camera = Point & { width: number };
export type Selection = { kind: "object" | "colony" | "ground"; id?: number; point: Point };
const leaves = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, angle: number) => { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
function drawObject(ctx: CanvasRenderingContext2D, o: GardenObject) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
  ctx.fillStyle = "#0b1a1880"; ctx.beginPath(); ctx.ellipse(6, 10, o.kind === "bridge" ? 112 : 40, 22, -.1, 0, Math.PI * 2); ctx.fill();
  if (o.kind === "bridge") {
    ctx.strokeStyle = "#433b2e"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-108, -15); ctx.lineTo(108, -15); ctx.moveTo(-108, 15); ctx.lineTo(108, 15); ctx.stroke();
    for (let i = -100; i <= 100; i += 13) { ctx.fillStyle = i % 2 ? "#baa278" : "#a78d68"; ctx.fillRect(i, -20, 10, 40); ctx.strokeStyle = "#d7c29a77"; ctx.lineWidth = 1; ctx.strokeRect(i, -20, 10, 40); }
  } else if (o.kind === "log") {
    ctx.fillStyle = "#76513a"; ctx.beginPath(); ctx.roundRect(-65, -22, 130, 44, 15); ctx.fill();
    ctx.strokeStyle = "#af8e5a"; ctx.lineWidth = 2; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(-50, -15 + j * 10); ctx.bezierCurveTo(-20, -25 + j * 10, 22, -5 + j * 10, 62, -17 + j * 10); ctx.stroke(); }
    ctx.fillStyle = "#b79b6b"; ctx.beginPath(); ctx.ellipse(-61, 0, 10, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#745c3b"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-61, 0, 5, 12, 0, 0, Math.PI * 2); ctx.stroke();
    for (let j = 0; j < 12; j++) leaves(ctx, noise(o.id * 20 + j) * 100 - 50, noise(j + 77) * 25 - 12, 7, "#7d9252aa", j);
    if (o.age > 80) { ctx.fillStyle = "#d3c09b"; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse(22 + j * 11, -16 - j % 2 * 6, 8, 5, 0, Math.PI, Math.PI * 2); ctx.fill(); } }
  } else if (o.kind === "rock") {
    ctx.fillStyle = "#81857a"; ctx.strokeStyle = "#b2b39b"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-29, 4); ctx.lineTo(-19, -26); ctx.lineTo(8, -32); ctx.lineTo(29, -7); ctx.lineTo(25, 21); ctx.lineTo(-7, 27); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#555f55"; ctx.beginPath(); ctx.moveTo(8, -32); ctx.lineTo(0, 0); ctx.lineTo(25, 21); ctx.lineTo(29, -7); ctx.closePath(); ctx.fill();
  } else if (o.kind === "fruit") {
    const r = 17 + Math.sqrt(Math.max(0, o.food)) * 1.7; ctx.fillStyle = o.condition > .6 ? "#ba7950" : "#786443"; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .75, -.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#e8b67f"; ctx.beginPath(); ctx.ellipse(-r * .15, -r * .1, r * .65, r * .55, -.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#624b32"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(3, -r * .6); ctx.lineTo(12, -r); ctx.stroke();
  } else {
    const r = 9 + o.growth * (o.kind === "berry" ? 40 : 29);
    for (let j = 0; j < 15; j++) { const angle = j * 2.4; leaves(ctx, Math.cos(angle) * r * .5, Math.sin(angle) * r * .5, r * .6, ["#668b51", "#90a963", "#416b48", "#b0b875"][j % 4], angle); }
    if (o.growth > .6) for (let j = 0; j < 7; j++) {
      const x = Math.cos(j * 2.4) * r * .55, y = Math.sin(j * 2.4) * r * .55;
      if (o.kind === "flower") { for (let petal = 0; petal < 5; petal++) leaves(ctx, x + Math.cos(petal * 1.26) * 5, y + Math.sin(petal * 1.26) * 5, 5, "#eadcc0", petal * 1.26); ctx.fillStyle = "#dbab58"; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      else if (o.food > j * 2) { ctx.fillStyle = "#c08085"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#f0b4ac"; ctx.fillRect(x - 1, y - 2, 1.5, 1.5); }
    }
  }
  ctx.restore();
}
export default function GardenView({ garden, camera, onCamera, tool, signals, overlay, selected, onSelect, onAct }: { garden: Garden; camera: Camera; onCamera: (c: Camera) => void; tool: GardenTool; signals: boolean; overlay: "none" | "moisture" | "fertility"; selected: Selection | null; onSelect: (s: Selection) => void; onAct: (points: Point[]) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ garden, camera, signals, overlay, selected });
  useEffect(() => { latest.current = { garden, camera, signals, overlay, selected }; }, [garden, camera, signals, overlay, selected]);
  useEffect(() => {
    const fit = () => {
      const el = canvas.current; if (!el || !el.clientWidth) return;
      const c = latest.current.camera, width = Math.min(WIDTH, c.width), height = width * el.clientHeight / el.clientWidth;
      const next = { width, x: Math.max(0, Math.min(WIDTH - width, c.x)), y: Math.max(0, Math.min(Math.max(0, HEIGHT - height), c.y)) };
      if (next.width !== c.width || next.x !== c.x || next.y !== c.y) onCamera(next);
    };
    const frame = requestAnimationFrame(fit), observer = new ResizeObserver(fit); if (canvas.current) observer.observe(canvas.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [camera, onCamera]);
  const gesture = useRef<{ x: number; y: number; camera: Camera; points: Point[]; pan: boolean; moved: boolean } | null>(null);
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext("2d")!; let frame = 0; let dirty = true; let last: unknown[] = [];
    const background = document.createElement("canvas"); background.width = WIDTH; background.height = HEIGHT; const soil = background.getContext("2d")!; let terrainMoisture: Float32Array | null = null, terrainFertility: Float32Array | null = null;
    const resize = () => { el.width = Math.round(el.clientWidth * Math.min(2, devicePixelRatio)); el.height = Math.round(el.clientHeight * Math.min(2, devicePixelRatio)); dirty = true; };
    const glows = new Map<string, HTMLCanvasElement>();
    const stopWheel = (e: WheelEvent) => e.preventDefault(); el.addEventListener("wheel", stopWheel, { passive: false });
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const r = latest.current, s = r.garden, c = r.camera;
      const state = [s, c, r.signals, r.overlay, r.selected, gesture.current, gesture.current?.points.length]; if (!dirty && state.every((v, i) => v === last[i])) return; last = state; dirty = false;
      if (s.moisture !== terrainMoisture || s.fertility !== terrainFertility) {
        terrainMoisture = s.moisture; terrainFertility = s.fertility;
        soil.fillStyle = "#555b38"; soil.fillRect(0, 0, WIDTH, HEIGHT);
        for (let i = 0; i < s.moisture.length; i++) {
          const p = cellPoint(i), wet = s.moisture[i], fertile = s.fertility[i];
          soil.fillStyle = `rgb(${Math.round(104 - wet * 55 + noise(i) * 8)},${Math.round(94 - wet * 13 + fertile * 18)},${Math.round(59 - wet * 10)})`; soil.fillRect(p.x - 15, p.y - 15, CELL + 1, CELL + 1);
        }
        soil.filter = "blur(22px)"; soil.drawImage(background, 0, 0); soil.filter = "none";
        for (let i = 0; i < 3200; i++) {
          const x = noise(i + 500) * WIDTH, y = noise(i + 9000) * HEIGHT, wet = s.moisture[Math.floor(y / CELL) * COLS + Math.floor(x / CELL)];
          leaves(soil, x, y, 3 + noise(i + 1) * 10, wet > .4 ? "#a6b17625" : "#d1b08025", i);
        }
        // Soft vegetation patches break up the soil field without a visible grid.
        for (let i = 0; i < s.moisture.length; i++) if (s.moisture[i] > .33) {
          const p = cellPoint(i); const g = soil.createRadialGradient(p.x, p.y, 1, p.x, p.y, 35); g.addColorStop(0, `rgba(65,100,50,${s.moisture[i] * .45})`); g.addColorStop(1, "#41643200"); soil.fillStyle = g; soil.fillRect(p.x - 35, p.y - 35, 70, 70);
        }
      }
      const viewHeight = c.width * el.height / el.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#263f33"; ctx.fillRect(0, 0, el.width, el.height);
      ctx.setTransform(el.width / c.width, 0, 0, el.width / c.width, -c.x * el.width / c.width, -c.y * el.width / c.width);
      ctx.drawImage(background, 0, 0);
      // Stream, pond margins, and connected channels share the simulation's wet cells.
      ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.beginPath();
      for (let y = -30; y <= HEIGHT + 30; y += 20) { const x = creekX(y); if (y === -30) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = "#273e35"; ctx.lineWidth = 116; ctx.stroke(); ctx.strokeStyle = "#55776b"; ctx.lineWidth = 96; ctx.stroke(); ctx.strokeStyle = "#7caaa0"; ctx.lineWidth = 2; ctx.stroke();
      for (const p of [{ x: 590, y: 820, r: 65 }, { x: 1820, y: 520, r: 77 }]) { const g = ctx.createRadialGradient(p.x - 15, p.y - 20, 5, p.x, p.y, p.r); g.addColorStop(0, "#7daca2"); g.addColorStop(1, "#355d52"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#a6b78b66"; ctx.lineWidth = 4; ctx.stroke(); }
      for (let i = 0; i < s.channels.length; i++) if (s.channels[i] || (!s.channels[i] && s.water[i] > .05 && s.water[i] < .99)) {
        const p = cellPoint(i);
        if (s.channels[i]) {
          const x = i % COLS, adjacent = [x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1, i >= COLS ? i - COLS : -1, i + COLS < s.channels.length ? i + COLS : -1].filter(k => k >= 0 && s.channels[k]).map(k => cellPoint(k)).map(q => ({ x: (q.x + p.x) / 2, y: (q.y + p.y) / 2 }));
          ctx.beginPath();
          if (adjacent.length === 2) { ctx.moveTo(adjacent[0].x, adjacent[0].y); ctx.quadraticCurveTo(p.x, p.y, adjacent[1].x, adjacent[1].y); }
          else { for (const q of adjacent) { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); } }
          ctx.strokeStyle = "#4b5138"; ctx.lineWidth = 24; ctx.stroke(); ctx.strokeStyle = s.water[i] > .2 ? "#71968b" : "#49412b"; ctx.lineWidth = 16; ctx.stroke();
          if (adjacent.length < 2) { ctx.fillStyle = s.water[i] > .2 ? "#71968b" : "#49412b"; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill(); }
        } else { const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 24); g.addColorStop(0, "#71968b66"); g.addColorStop(1, "#71968b00"); ctx.fillStyle = g; ctx.fillRect(p.x - 24, p.y - 24, 48, 48); }
      }
      ctx.strokeStyle = "#c5ddd329"; ctx.lineWidth = 2;
      for (let i = 0; i < 34; i++) { const y = i * 47 + 8; ctx.beginPath(); ctx.moveTo(creekX(y) - 25, y); ctx.quadraticCurveTo(creekX(y) - 5, y + 10, creekX(y) + 17, y + 4); ctx.stroke(); }
      if (r.overlay !== "none") for (let i = 0; i < s.moisture.length; i++) { const p = cellPoint(i), v = r.overlay === "moisture" ? s.moisture[i] : s.fertility[i]; ctx.fillStyle = r.overlay === "moisture" ? `rgba(110,201,219,${v * .55})` : `rgba(200,178,105,${v * .55})`; ctx.fillRect(p.x - 15, p.y - 15, CELL, CELL); }
      for (const home of s.colonies) if (r.signals) for (let i = 0; i < home.trail.length; i++) if (home.trail[i] > .025) { const p = cellPoint(i); let glow = glows.get(home.color);
        if (!glow) { glow = document.createElement("canvas"); glow.width = 60; glow.height = 60; const gctx = glow.getContext("2d")!, gradient = gctx.createRadialGradient(30, 30, 0, 30, 30, 30); gradient.addColorStop(0, `${home.color}bb`); gradient.addColorStop(.4, `${home.color}55`); gradient.addColorStop(1, `${home.color}00`); gctx.fillStyle = gradient; gctx.fillRect(0, 0, 60, 60); glows.set(home.color, glow); }
        ctx.globalAlpha = Math.min(.7, home.trail[i] * .4); ctx.drawImage(glow, p.x - 30, p.y - 30); }
      ctx.globalAlpha = 1;
      for (const o of s.objects) drawObject(ctx, o);
      for (const home of s.colonies) {
        ctx.fillStyle = "#a58b5e"; ctx.beginPath(); ctx.ellipse(home.x, home.y, 32, 23, -.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#29352b"; ctx.beginPath(); ctx.ellipse(home.x, home.y - 3, 12, 9, -.2, 0, Math.PI * 2); ctx.fill();
        ctx.font = "600 15px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#14241caa"; ctx.fillRect(home.x - 49, home.y - 59, 98, 25); ctx.fillStyle = home.color; ctx.fillText(home.name, home.x, home.y - 41);
        for (const a of home.colony.ants) if (a.zone === "surface") {
          ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.angle); ctx.strokeStyle = home.color; ctx.lineWidth = .8; ctx.beginPath(); for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg++) { ctx.moveTo(leg * 2 - 2, 0); ctx.lineTo(leg * 3 - 5, side * 4); } ctx.stroke(); ctx.fillStyle = "#36271f"; ctx.beginPath(); ctx.ellipse(-4, 0, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = home.color; ctx.beginPath(); ctx.arc(3, 0, 2.4, 0, Math.PI * 2); ctx.fill();
          if (a.cargo) { ctx.fillStyle = a.cargo.kind === "food" ? "#f0d49a" : "#a8c1b8"; ctx.beginPath(); ctx.ellipse(7, 0, 3.5, 2, -.3, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
        }
      }
      for (const bee of s.insects) { ctx.save(); ctx.translate(bee.x, bee.y); ctx.rotate(bee.angle); leaves(ctx, -2, -4, 6, "#f1edcd88", -.7); leaves(ctx, -2, 4, 6, "#f1edcd88", .7); leaves(ctx, 0, 0, 6, "#d5b261", 0); ctx.strokeStyle = "#4a4031"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-2, 2); ctx.stroke(); ctx.restore(); }
      if (r.selected) { const p = r.selected.kind === "object" ? s.objects.find(o => o.id === r.selected!.id) ?? r.selected.point : r.selected.kind === "colony" ? s.colonies.find(h => h.id === r.selected!.id) ?? r.selected.point : r.selected.point; ctx.strokeStyle = "#f5dfaa"; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(p.x, p.y, 58, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.font = "16px sans-serif"; ctx.fillStyle = "#efe1b477"; ctx.textAlign = "left";
      for (const [name, x, y] of [["CEDAR BANK", 160, 1340], ["THE DRY REACH", 630, 400], ["WILLOW MEADOW", 1500, 1110], ["OCHRE GROVE", 1880, 250]] as const) ctx.fillText(name, x, y);
      if (gesture.current && !gesture.current.pan && gesture.current.points.length > 1) { ctx.strokeStyle = "#e9d4a5"; ctx.lineWidth = 13; ctx.setLineDash([4, 15]); ctx.beginPath(); gesture.current.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]); }
      const vignette = ctx.createRadialGradient(c.x + c.width / 2, c.y + viewHeight / 2, c.width * .15, c.x + c.width / 2, c.y + viewHeight / 2, c.width * .8); vignette.addColorStop(0, "#142a2000"); vignette.addColorStop(1, "#142a2088"); ctx.fillStyle = vignette; ctx.fillRect(c.x, c.y, c.width, viewHeight);
    };
    frame = requestAnimationFrame(draw); return () => { cancelAnimationFrame(frame); observer.disconnect(); el.removeEventListener("wheel", stopWheel); };
  }, []);
  const world = (x: number, y: number) => { const r = canvas.current!.getBoundingClientRect(); return { x: camera.x + (x - r.left) / r.width * camera.width, y: camera.y + (y - r.top) / r.width * camera.width }; };
  const inspect = (p: Point) => { const o = garden.objects.filter(o => Math.hypot(o.x - p.x, o.y - p.y) < 60).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; const c = garden.colonies.find(h => Math.hypot(h.x - p.x, h.y - p.y) < 50); onSelect(c ? { kind: "colony", id: c.id, point: c } : o ? { kind: "object", id: o.id, point: o } : { kind: "ground", point: p }); };
  return <canvas ref={canvas} className={styles.canvas} tabIndex={0} role="img" aria-label="Living garden. Drag to explore; select a tool to shape the ground. Keyboard arrows pan; plus and minus zoom. Location controls provide keyboard construction." data-camera-x={camera.x.toFixed(2)} data-camera-y={camera.y.toFixed(2)} data-camera-width={camera.width.toFixed(2)} data-garden-tick={garden.tick} data-object-count={garden.objects.length} style={{ cursor: tool === "observe" ? "grab" : "crosshair" }} onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); gesture.current = { x: e.clientX, y: e.clientY, camera, points: [world(e.clientX, e.clientY)], pan: tool === "observe" || e.button === 1 || e.button === 2, moved: false }; }} onPointerMove={e => { const g = gesture.current; if (!g) return; if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 5) g.moved = true; if (g.pan) { const scale = g.camera.width / e.currentTarget.clientWidth; onCamera({ ...g.camera, x: Math.max(0, Math.min(WIDTH - g.camera.width * .25, g.camera.x - (e.clientX - g.x) * scale)), y: Math.max(0, Math.min(HEIGHT - g.camera.width * .2, g.camera.y - (e.clientY - g.y) * scale)) }); } else if (tool === "channel") { const p = world(e.clientX, e.clientY); if (Math.hypot(p.x - g.points.at(-1)!.x, p.y - g.points.at(-1)!.y) > 12) g.points.push(p); } }} onPointerUp={e => { const g = gesture.current; gesture.current = null; if (!g) return; const p = world(e.clientX, e.clientY); if (g.pan) { if (!g.moved) inspect(p); } else onAct([...g.points, p]); }} onPointerCancel={() => { gesture.current = null; }} onWheel={e => { const next = Math.max(500, Math.min(2600, camera.width * (e.deltaY > 0 ? 1.1 : .9))); const p = world(e.clientX, e.clientY), t = next / camera.width; onCamera({ x: Math.max(0, p.x - (p.x - camera.x) * t), y: Math.max(0, p.y - (p.y - camera.y) * t), width: next }); }} onKeyDown={e => { const d = camera.width * .1; if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); onCamera({ ...camera, x: Math.max(0, Math.min(WIDTH - 100, camera.x + (e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0))), y: Math.max(0, Math.min(HEIGHT - 100, camera.y + (e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0))) }); } if (["+", "=", "-"].includes(e.key)) { e.preventDefault(); onCamera({ ...camera, width: Math.max(500, Math.min(2600, camera.width * (e.key === "-" ? 1.2 : .8))) }); } }}/>;
}
