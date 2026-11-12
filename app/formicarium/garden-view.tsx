"use client";

import { useEffect, useRef } from "react";
import { CELL, cellPoint, COLS, Garden, GardenTool, HEIGHT, ROWS, WIDTH } from "./garden";
import { Point } from "./nest";
import { antSprite, cargoKinds } from "./ant-sprites";
import { paintGarden, paintTerrain, soilTexture } from "./garden-painter";
import { ROLES } from "./simulation";
import styles from "./garden.module.css";
export type Camera = Point & { width: number };
export type Selection = { kind: "object" | "colony" | "ground"; id?: number; point: Point };
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
    const el = canvas.current!, ctx = el.getContext("2d")!;
    const terrain = document.createElement("canvas"), scenery = document.createElement("canvas"), field = document.createElement("canvas");
    terrain.width = scenery.width = WIDTH; terrain.height = scenery.height = HEIGHT; field.width = COLS; field.height = ROWS;
    const soil = terrain.getContext("2d")!, scene = scenery.getContext("2d")!, texture = soil.createPattern(soilTexture(), "repeat")!;
    let groundTexture: CanvasPattern | null = null; const ground = new Image(); ground.onload = () => { groundTexture = soil.createPattern(ground, "repeat"); groundTexture?.setTransform(new DOMMatrix().scale(.5)); terrainState = null; dirty = true; }; ground.src = "/images/formicarium/garden-soil.webp";
    const atlas = new Image(); let art: HTMLImageElement | null = null, dirty = true, frame = 0;
    atlas.onload = () => { art = atlas; dirty = true; }; atlas.src = "/images/formicarium/garden-atlas.webp";
    const images = new Map<string, HTMLCanvasElement>();
    for (const role of ROLES) for (const cargo of cargoKinds) images.set(`${role}-${cargo}`, antSprite(role, cargo, "home"));
    let previous = new Map(latest.current.garden.colonies.flatMap(h => h.colony.ants.map(a => [`${h.id}-${a.id}`, a] as const)));
    let snapshot = latest.current.garden, changed = performance.now(), interval = 200, terrainAt = -Infinity, terrainState: Garden | null = null;
    let last: unknown[] = [], painted: unknown[] = [];
    const resize = () => { el.width = Math.max(1, Math.round(el.clientWidth * Math.min(1.5, devicePixelRatio))); el.height = Math.max(1, Math.round(el.clientHeight * Math.min(1.5, devicePixelRatio))); dirty = true; };
    const stopWheel = (e: WheelEvent) => e.preventDefault(); el.addEventListener("wheel", stopWheel, { passive: false });
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw); if (document.hidden) return;
      const r = latest.current, s = r.garden, c = r.camera;
      if (s !== snapshot) {
        previous = new Map(snapshot.colonies.flatMap(h => h.colony.ants.map(a => [`${h.id}-${a.id}`, a] as const)));
        interval = Math.max(50, Math.min(250, now - changed)); changed = now; snapshot = s;
      }
      const t = Math.min(1, (now - changed) / interval);
      const state = [s, c, r.signals, r.overlay, r.selected, gesture.current, gesture.current?.points.length];
      if (!dirty && t === 1 && state.every((v, i) => v === last[i])) return; last = state;
      const sceneState = [s, r.signals, r.overlay, art];
      if (dirty || sceneState.some((v, i) => v !== painted[i])) {
        if (!terrainState || s.tick < terrainState.tick || now - terrainAt > 500 || s.channels.some((v, i) => v !== terrainState!.channels[i])) {
          paintTerrain(soil, field, texture, s, groundTexture); terrainAt = now; terrainState = s;
        }
        paintGarden(scene, terrain, art, s);
        if (r.overlay !== "none") for (let i = 0; i < s.moisture.length; i++) { const p = cellPoint(i), v = r.overlay === "moisture" ? s.moisture[i] : s.fertility[i]; scene.fillStyle = r.overlay === "moisture" ? `rgba(110,201,219,${v * .45})` : `rgba(220,194,115,${v * .45})`; scene.fillRect(p.x - 15, p.y - 15, CELL, CELL); }
        if (r.signals) for (const home of s.colonies) for (let i = 0; i < home.trail.length; i++) if (home.trail[i] > .05) {
          const p = cellPoint(i); scene.globalAlpha = Math.min(.35, home.trail[i] * .15); scene.fillStyle = home.color; scene.beginPath(); scene.ellipse(p.x, p.y, 12, 9, 0, 0, Math.PI * 2); scene.fill();
        }
        scene.globalAlpha = 1; painted = sceneState;
      }
      dirty = false;
      const scale = el.width / c.width, viewHeight = c.width * el.height / el.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#6b7450"; ctx.fillRect(0, 0, el.width, el.height);
      ctx.setTransform(scale, 0, 0, scale, -c.x * scale, -c.y * scale);
      ctx.drawImage(scenery, 0, 0);
      for (const home of s.colonies) for (const a of home.colony.ants) if (a.zone === "surface") {
        const before = previous.get(`${home.id}-${a.id}`), from = before?.zone === "surface" ? before : a;
        // A reset/zone transition must not animate an ant across the whole garden.
        const blend = Math.hypot(a.x - from.x, a.y - from.y) > 180 ? 1 : t;
        const x = from.x + (a.x - from.x) * blend, y = from.y + (a.y - from.y) * blend;
        if (x < c.x - 20 || x > c.x + c.width + 20 || y < c.y - 20 || y > c.y + viewHeight + 20) continue;
        const angle = from.angle + Math.atan2(Math.sin(a.angle - from.angle), Math.cos(a.angle - from.angle)) * blend;
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle); if (a.role === "soldier") ctx.scale(1.15, 1.15); ctx.drawImage(images.get(`${a.role}-${a.cargo?.kind ?? "none"}`)!, -16, -12.8, 32, 25.6); ctx.restore();
      }
      for (const bee of s.insects) {
        if (bee.x < c.x || bee.x > c.x + c.width || bee.y < c.y || bee.y > c.y + viewHeight) continue;
        ctx.save(); ctx.translate(bee.x, bee.y); ctx.rotate(bee.angle); ctx.fillStyle = "#f2efd4aa"; ctx.beginPath(); ctx.ellipse(-1, -3, 4, 2.5, -.5, 0, Math.PI * 2); ctx.ellipse(-1, 3, 4, 2.5, .5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d9b66b"; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#453c29"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-2, 2); ctx.stroke(); ctx.restore();
      }
      if (r.selected) { const p = r.selected.kind === "object" ? s.objects.find(o => o.id === r.selected!.id) ?? r.selected.point : r.selected.kind === "colony" ? s.colonies.find(h => h.id === r.selected!.id) ?? r.selected.point : r.selected.point; ctx.strokeStyle = "#fff0bd"; ctx.lineWidth = 1.5 / Math.max(.6, scale); ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.arc(p.x, p.y, 54, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      if (gesture.current && !gesture.current.pan && gesture.current.points.length > 1) { ctx.strokeStyle = "#f2e3bc"; ctx.lineWidth = 10; ctx.setLineDash([4, 15]); ctx.beginPath(); gesture.current.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]); }
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); el.removeEventListener("wheel", stopWheel); atlas.onload = null; ground.onload = null; };

  }, []);
  const world = (x: number, y: number) => { const r = canvas.current!.getBoundingClientRect(); return { x: camera.x + (x - r.left) / r.width * camera.width, y: camera.y + (y - r.top) / r.width * camera.width }; };
  const inspect = (p: Point) => { const o = garden.objects.filter(o => Math.hypot(o.x - p.x, o.y - p.y) < 60).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; const c = garden.colonies.find(h => Math.hypot(h.x - p.x, h.y - p.y) < 50); onSelect(c ? { kind: "colony", id: c.id, point: c } : o ? { kind: "object", id: o.id, point: o } : { kind: "ground", point: p }); };
  return <canvas ref={canvas} className={styles.canvas} tabIndex={0} role="img" aria-label="Living garden. Drag to explore; select a tool to shape the ground. Keyboard arrows pan; plus and minus zoom. Location controls provide keyboard construction." data-camera-x={camera.x.toFixed(2)} data-camera-y={camera.y.toFixed(2)} data-camera-width={camera.width.toFixed(2)} data-garden-tick={garden.tick} data-object-count={garden.objects.length} style={{ cursor: tool === "observe" ? "grab" : "crosshair" }} onContextMenu={e => e.preventDefault()} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); gesture.current = { x: e.clientX, y: e.clientY, camera, points: [world(e.clientX, e.clientY)], pan: tool === "observe" || e.button === 1 || e.button === 2, moved: false }; }} onPointerMove={e => { const g = gesture.current; if (!g) return; if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 5) g.moved = true; if (g.pan) { const scale = g.camera.width / e.currentTarget.clientWidth; onCamera({ ...g.camera, x: Math.max(0, Math.min(WIDTH - g.camera.width * .25, g.camera.x - (e.clientX - g.x) * scale)), y: Math.max(0, Math.min(HEIGHT - g.camera.width * .2, g.camera.y - (e.clientY - g.y) * scale)) }); } else if (tool === "channel") { const p = world(e.clientX, e.clientY); if (Math.hypot(p.x - g.points.at(-1)!.x, p.y - g.points.at(-1)!.y) > 12) g.points.push(p); } }} onPointerUp={e => { const g = gesture.current; gesture.current = null; if (!g) return; const p = world(e.clientX, e.clientY); if (g.pan) { if (!g.moved) inspect(p); } else onAct([...g.points, p]); }} onPointerCancel={() => { gesture.current = null; }} onWheel={e => { const next = Math.max(500, Math.min(2600, camera.width * (e.deltaY > 0 ? 1.1 : .9))); const p = world(e.clientX, e.clientY), t = next / camera.width; onCamera({ x: Math.max(0, p.x - (p.x - camera.x) * t), y: Math.max(0, p.y - (p.y - camera.y) * t), width: next }); }} onKeyDown={e => { const d = camera.width * .1; if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); onCamera({ ...camera, x: Math.max(0, Math.min(WIDTH - 100, camera.x + (e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0))), y: Math.max(0, Math.min(HEIGHT - 100, camera.y + (e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0))) }); } if (["+", "=", "-"].includes(e.key)) { e.preventDefault(); onCamera({ ...camera, width: Math.max(500, Math.min(2600, camera.width * (e.key === "-" ? 1.2 : .8))) }); } }}/>;
}
