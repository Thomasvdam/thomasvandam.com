"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Move, ZoomIn, ZoomOut, Eye } from "lucide-react";
import { Colony } from "./simulation";
import { nestGrowth } from "./growth";
import { radius } from "./nest";
import NestView from "./nest-view";
import styles from "./garden.module.css";
type View = { x: number; y: number; width: number; height: number };
export function fitNest(s: Colony): View {
  const minX = Math.floor(Math.min(...s.nest.map(n => n.x - radius(n))) / 64) * 64;
  const maxX = Math.ceil(Math.max(...s.nest.map(n => n.x + radius(n))) / 64) * 64;
  const maxY = Math.ceil(Math.max(...s.nest.map(n => n.y + radius(n))) / 64) * 64;
  const width = Math.max(800, maxX - minX + 160, (maxY - 180 + 100) * 1.6);
  return { x: Math.max(0, (minX + maxX - width) / 2), y: 180, width, height: width / 1.6 };
}
export default function NestExplorer({ colony, selected, onSelect, signals }: { colony: Colony; selected: number; onSelect: (id: number) => void; signals: boolean }) {
  const [mode, setMode] = useState<"fit" | "free" | "follow">("fit");
  const [manual, setManual] = useState<View>(() => fitNest(colony));
  const ant = colony.ants.find(a => a.id === selected);
  const fit = fitNest(colony);
  const view = mode === "fit" ? fit : mode === "follow" && ant?.zone === "nest" ? { x: Math.max(0, ant.x - manual.width / 2), y: Math.max(180, ant.y - manual.height / 2), width: manual.width, height: manual.height } : manual;
  const pane = useRef<HTMLDivElement>(null), current = useRef(view);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null), suppressClick = useRef(false);
  const { x, y, width, height } = view;
  useEffect(() => { current.current = { x, y, width, height }; }, [x, y, width, height]);
  useEffect(() => { const el = pane.current!; const stop = (e: WheelEvent) => e.preventDefault(); el.addEventListener("wheel", stop, { passive: false }); return () => el.removeEventListener("wheel", stop); }, []);
  const zoom = (factor: number) => { const c = current.current, width = Math.max(320, Math.min(3400, c.width * factor)), height = width / 1.6; setManual({ x: Math.max(0, c.x + (c.width - width) / 2), y: Math.max(180, c.y + (c.height - height) / 2), width, height }); setMode("free"); };
  const stats = nestGrowth(colony);
  return <div className={styles.nestExplorer}>
    <div className={styles.nestControls}><div><strong>{stats.rooms} chambers</strong><span>{stats.passages} passages · {stats.faces} active faces · {stats.bypasses} bypasses</span></div><div><button aria-label="Fit whole nest" aria-pressed={mode === "fit"} onClick={() => setMode("fit")}><Expand size={15}/>Overview</button><button aria-label="Follow selected ant" aria-pressed={mode === "follow"} disabled={!ant || ant.zone !== "nest"} onClick={() => { setManual({ ...view, width: 500, height: 312.5 }); setMode("follow"); }}><Eye size={15}/>Follow</button><button aria-label="Zoom into nest" onClick={() => zoom(.8)}><ZoomIn size={16}/></button><button aria-label="Zoom out of nest" onClick={() => zoom(1.25)}><ZoomOut size={16}/></button></div></div>
    <div ref={pane} className={styles.nestPane} data-nest-nodes={colony.nest.length} data-nest-faces={stats.faces} data-nest-view={`${view.x} ${view.y} ${view.width} ${view.height}`} onPointerDown={e => { if (!(e.target instanceof HTMLCanvasElement)) return; drag.current = { x: e.clientX, y: e.clientY, view, moved: false }; }} onPointerMove={e => { const d = drag.current; if (!d) return; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5 && !d.moved) return; d.moved = true; e.currentTarget.setPointerCapture(e.pointerId); const scale = d.view.width / e.currentTarget.clientWidth; setManual({ ...d.view, x: Math.max(0, Math.min(1900, d.view.x - (e.clientX - d.x) * scale)), y: Math.max(180, Math.min(1450, d.view.y - (e.clientY - d.y) * scale)) }); setMode("free"); }} onPointerUp={() => { suppressClick.current = !!drag.current?.moved; drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onClickCapture={e => { if (suppressClick.current) { suppressClick.current = false; e.stopPropagation(); } }} onWheel={e => zoom(e.deltaY > 0 ? 1.08 : .92)} onKeyDown={e => { if (!(e.target instanceof HTMLCanvasElement)) return; const key = e.key.toLowerCase(); if (["w", "a", "s", "d"].includes(key)) { e.preventDefault(); const c = current.current, d = c.width * .1; setManual({ ...c, x: Math.max(0, Math.min(1900, c.x + (key === "a" ? -d : key === "d" ? d : 0))), y: Math.max(180, Math.min(1450, c.y + (key === "w" ? -d : key === "s" ? d : 0))) }); setMode("free"); } else if (["+", "=", "-"].includes(key)) { e.preventDefault(); zoom(key === "-" ? 1.25 : .8); } else if (key === "home") { e.preventDefault(); setMode("fit"); } }}>
      <NestView colony={{ ...colony, ants: colony.ants.filter(a => a.zone === "nest"), sources: [] }} selected={selected} onSelect={onSelect} zoom={false} signals={signals} tool="observe" onInteract={() => {}} undergroundOnly viewport={`${view.x} ${view.y} ${view.width} ${view.height}`}/>
    </div>
    <div className={styles.nestLegend}><span><Move size={12}/>Drag or WASD to pan · arrows select ants</span><span><i/>Digging face</span><span>{colony.totals.soil} soil loads carried outside</span></div>
  </div>;
}
