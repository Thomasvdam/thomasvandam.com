"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Ant, Colony, FIELD_COLS, ROLES, elapsed } from "./simulation";
import { energy, SEEK_FOOD, WEAK_HUNGER } from "./nutrition";
import { Point } from "./nest";
import type { Tool } from "./sandbox";
import { antSprite, cargoKinds, roleColors } from "./ant-sprites";
import styles from "./game.module.css";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const actors = (s: Colony) => [...s.ants, ...s.rival.ants];

function glow(color: string) {
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext("2d")!; const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, `${color}bb`); g.addColorStop(.45, `${color}66`); g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32); return canvas;
}

export default function AntLayer({ colony, selected, onSelect, signals, view, tool, onInteract }: {
  colony: Colony; selected: number; onSelect: (id: number) => void; signals: boolean; view: string; tool: Tool; onInteract: (point: Point) => void;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef({ colony, previous: new Map(actors(colony).map(a => [a.id, a])), selected, signals, view, changed: 0, interval: 200, dirty: true });
  useEffect(() => {
    const r = runtime.current;
    if (r.colony !== colony) { r.previous = new Map(actors(r.colony).map(a => [a.id, a])); r.interval = Math.max(50, Math.min(250, performance.now() - r.changed)); r.changed = performance.now(); r.colony = colony; }
    r.selected = selected; r.signals = signals; r.view = view; r.dirty = true;
  }, [colony, selected, signals, view]);
  useEffect(() => {
    if (!ready) return;
    const el = canvas.current!; const ctx = el.getContext("2d")!;
    const images = new Map<string, HTMLCanvasElement>();
    for (const team of ["home", "rival"] as const) for (const role of ROLES) for (const cargo of cargoKinds) images.set(`${team}-${role}-${cargo}`, antSprite(role, cargo, team));
    const glows = [glow("#c5e89b"), glow("#ed9ab7"), glow("#ff8b6f")]; let frame = 0; let lastPainted: Colony | null = null;
    const resize = () => { const ratio = Math.min(1.5, window.devicePixelRatio || 1); el.width = Math.max(1, Math.round(el.clientWidth * ratio)); el.height = Math.max(1, Math.round(el.clientHeight * ratio)); runtime.current.dirty = true; };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw); if (document.hidden) return;
      const r = runtime.current; const t = Math.min(1, Math.max(0, (now - r.changed) / r.interval));
      if (!r.dirty && lastPainted === r.colony && t === 1) return;
      const [vx, vy, vw, vh] = r.view.split(" ").map(Number);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, el.width, el.height);
      ctx.setTransform(el.width / vw, 0, 0, el.height / vh, -vx * el.width / vw, -vy * el.height / vh);
      if (r.signals) {
        const fields = [r.colony.trail, r.colony.rival.trail, r.colony.rival.raidTrail, r.colony.alarm];
        for (let f = 0; f < fields.length; f++) for (let i = 0; i < fields[f].length; i++) {
          const strength = fields[f][i]; if (strength < .025) continue;
          ctx.globalAlpha = Math.min(.8, strength * .6); ctx.drawImage(glows[f === 0 ? 0 : f === 3 ? 2 : 1], i % FIELD_COLS * 10 - 5, Math.floor(i / FIELD_COLS) * 10 - 5, 20, 20);
        }
        ctx.globalAlpha = 1;
        for (const n of r.colony.nest) for (const [cue, color] of [["crowd", "230,164,106"], ["brood", "222,195,218"], ["clean", "133,210,215"], ["alarm", "255,120,97"]] as const) {
          ctx.fillStyle = `rgba(${color},${Math.min(.24, n.scent[cue] * .12)})`; ctx.beginPath(); ctx.arc(n.x, n.y, 12 + n.scent[cue] * 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const a of actors(r.colony)) {
        const old = r.previous.get(a.id);
        const before = old && old.zone === a.zone && Math.hypot(old.x - a.x, old.y - a.y) < 180 ? old : a;
        const x = before.x + (a.x - before.x) * t; const y = before.y + (a.y - before.y) * t;
        if (x < vx - 20 || x > vx + vw + 20 || y < vy - 20 || y > vy + vh + 20) continue;
        if (a.bornAt !== undefined && elapsed(r.colony) - a.bornAt < 6) { ctx.strokeStyle = roleColors[a.role]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke(); }
        if (a.id === r.selected) { ctx.strokeStyle = "#efdca7"; ctx.fillStyle = "#efdca711"; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        const angle = Math.atan2(Math.sin(a.angle - before.angle), Math.cos(a.angle - before.angle));
        ctx.save(); ctx.translate(x, y); ctx.rotate(before.angle + angle * t); if (a.role === "soldier") ctx.scale(1.15, 1.15); ctx.drawImage(images.get(`${a.team}-${a.role}-${a.cargo?.kind ?? "none"}`)!, -20, -16, 40, 32); ctx.restore();
        if (a.fighting) { ctx.strokeStyle = "#ffd18f"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - 5, y - 9); ctx.lineTo(x + 5, y + 9); ctx.moveTo(x + 5, y - 9); ctx.lineTo(x - 5, y + 9); ctx.stroke(); }
        if (a.hunger >= SEEK_FOOD) {
          ctx.fillStyle = "#211c16"; ctx.fillRect(x - 7, y + 11, 14, 2.5);
          ctx.fillStyle = a.hunger >= WEAK_HUNGER ? "#ff9b68" : "#e9c67b"; ctx.fillRect(x - 7, y + 11, 14 * energy(a.hunger) / 100, 2.5);
          if (a.hunger >= WEAK_HUNGER) { ctx.strokeStyle = "#ff9b6877"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke(); }
        }
        const health = a.health / (a.role === "soldier" ? 3.2 : 1.2);
        if (health < .98) { ctx.fillStyle = "#201a16"; ctx.fillRect(x - 7, y - 13, 14, 2); ctx.fillStyle = a.team === "rival" ? "#ef8e98" : "#c9d68d"; ctx.fillRect(x - 7, y - 13, 14 * health, 2); }
      }
      r.dirty = t < 1; lastPainted = r.colony;
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [ready]);
  const ants = actors(colony);
  const focus = ants.find(a => a.id === selected);
  const pick = (x: number, y: number) => {
    const bounds = canvas.current!.getBoundingClientRect(); const [vx, vy, vw, vh] = view.split(" ").map(Number);
    const world = { x: vx + (x - bounds.left) / bounds.width * vw, y: vy + (y - bounds.top) / bounds.height * vh };
    if (tool !== "observe") { onInteract(world); return; }
    let closest: Ant | null = null; let best = 18;
    for (const a of ants) { const d = Math.hypot(world.x - a.x, world.y - a.y); if (d < best) { closest = a; best = d; } }
    if (closest) onSelect(closest.id);
  };
  if (!ready) return null;
  return <canvas ref={canvas} className={styles.antCanvas} style={{ cursor: tool === "hand" ? colony.held ? "grabbing" : "grab" : tool === "observe" ? "crosshair" : "cell" }} tabIndex={0} role="img" aria-label={tool === "observe" ? `Live colony of ${colony.ants.length} friendly and ${colony.rival.ants.length} rival ants. Select an ant with the pointer or use arrow keys to follow ants.` : `${tool} tool active. Tap the habitat or use the intervention target control.`} data-ant-count={colony.ants.length} data-rival-count={colony.rival.ants.length} data-selected-x={focus?.x.toFixed(2)} data-selected-y={focus?.y.toFixed(2)} data-selected-cargo={focus?.cargo?.kind ?? "none"} onClick={e => pick(e.clientX, e.clientY)} onKeyDown={e => {
    if (tool !== "observe") return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault(); const index = ants.findIndex(a => a.id === selected); const direction = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const next = ants[(index + direction + ants.length) % ants.length]; if (next) onSelect(next.id);
    }
  }}/>;
}
