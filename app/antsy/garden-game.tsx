"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Bug, ChevronDown, Droplets, Download, Eye, Flower2, Hand, Leaf, Map, Mountain, Pause, Play, Plus, RotateCcw, Save, Shovel, Sprout, TreePine, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { createGarden, creekX, GardenObject, GardenTool, HEIGHT, quality, totalAnts, totalFood, WIDTH } from "./garden";
import { decodeGarden, encodeGarden, SAVE_KEY } from "./garden-save";
import GardenView, { Camera, Selection } from "./garden-view";
import { Point } from "./nest";
import { DT, storedFood } from "./simulation";
import { useGardenRuntime } from "./use-garden-runtime";
import NestExplorer from "./nest-explorer";
import styles from "./garden.module.css";

const tools: { key: GardenTool; label: string; icon: typeof Eye; hint: string }[] = [
  { key: "observe", label: "Explore", icon: Hand, hint: "Drag to look around. Select an ant colony, object, or patch of ground for a closer look." },
  { key: "berry", label: "Berry bush", icon: Leaf, hint: "Plant on damp ground. Once grown, bushes keep producing berries." },
  { key: "flower", label: "Flowers", icon: Flower2, hint: "Flowers feed ants. Visiting insects help plants grow more food." },
  { key: "log", label: "Fallen wood", icon: TreePine, hint: "Ants can shelter under wood. It keeps the ground damp and slowly enriches the soil." },
  { key: "bridge", label: "Bridge", icon: Plus, hint: "Put a bridge across water so ants can cross. Select it to move or turn it." },
  { key: "channel", label: "Channel", icon: Shovel, hint: "Dig from a pond or stream to bring water to dry ground. Plant along the edges." },
  { key: "water", label: "Water", icon: Droplets, hint: "Wet a patch of ground. It will dry out again unless a channel brings more water." },
  { key: "fruit", label: "Fruit", icon: Sprout, hint: "Drop some food for ants to find. Leftovers rot and enrich the soil." },
  { key: "rock", label: "Rock", icon: Mountain, hint: "Put a rock in the way. Ants will have to go around it." },
  { key: "found", label: "New colony", icon: Bug, hint: "Start a colony near food and fallen wood, on damp ground." },
  { key: "remove", label: "Remove", icon: X, hint: "Remove an object or fill in a channel." },
];
const names = { berry: "Berry bush", flower: "Flower patch", log: "Fallen wood", bridge: "Wooden bridge", fruit: "Fallen fruit", rock: "Rock" };
const clock = (tick: number) => `${Math.floor(tick * DT / 60)}:${Math.floor(tick * DT % 60).toString().padStart(2, "0")}`;
const subscribe = () => () => {};
function initial() {
  try { const raw = localStorage.getItem(SAVE_KEY); return { garden: raw ? decodeGarden(raw) : createGarden(), saved: raw ? "Loaded your saved garden" : "Not saved yet", protected: false }; }
  catch { return { garden: createGarden(), saved: "Couldn't load your saved garden. Autosave is off. Import a backup or start fresh.", protected: true }; }
}
export default function GardenGame() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  if (!ready) return <div className={styles.loading}>Opening the garden…</div>;
  return <LivingGarden/>;
}
function LivingGarden() {
  const [loaded] = useState(initial);
  const { garden, latest, error, dispatch, replace, playback, snapshot } = useGardenRuntime(loaded.garden);
  const landmarks = [{ label: "Cedar bank", x: garden.colonies[0].x, y: garden.colonies[0].y }, { label: "Dry reach", x: 800, y: 620 }, { label: "Stream crossing", x: creekX(860), y: 860 }, { label: "Willow meadow", x: 1530, y: 1040 }, { label: "Ochre grove", x: garden.colonies[1]?.x ?? garden.colonies[0].x, y: garden.colonies[1]?.y ?? garden.colonies[0].y }];
  const [saveStatus, setSaveStatus] = useState(loaded.saved);
  const [canSave, setCanSave] = useState(!loaded.protected);
  const [speed, setSpeed] = useState(1);
  const [tool, setTool] = useState<GardenTool>("observe");
  const [moving, setMoving] = useState<number | undefined>();
  const [selected, setSelected] = useState<Selection | null>({ kind: "colony", id: 0, point: loaded.garden.colonies[0] });
  const [camera, setCamera] = useState<Camera>({ x: 500, y: 570, width: 1500 });
  const [overlay, setOverlay] = useState<"none" | "moisture" | "fertility">("none");
  const [signals, setSignals] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const [target, setTarget] = useState<Point>(landmarks[1]);
  const [start, setStart] = useState<Point | null>(null);
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(false);
  const [observed, setObserved] = useState(-1);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const control = () => playback(speed, !document.hidden && !reset && !help);
    control(); document.addEventListener("visibilitychange", control);
    return () => { document.removeEventListener("visibilitychange", control); playback(0, false); };
  }, [speed, reset, help, playback]);
  const save = async () => { if (!canSave) { setSaveStatus("Your old save is still safe. Import a backup or start a new garden to save again."); return; } try { localStorage.setItem(SAVE_KEY, encodeGarden(await snapshot())); setSaveStatus("Saved in this browser"); } catch { setSaveStatus("Couldn't save in this browser. Export a copy to keep your garden."); } };
  useEffect(() => {
    if (!canSave) return;
    const persist = () => { try { localStorage.setItem(SAVE_KEY, encodeGarden(latest.current)); setSaveStatus(previous => previous.startsWith("Could not import") || previous.startsWith("Save file is too large") ? previous : "Saved in this browser"); } catch { setSaveStatus("Couldn't save in this browser. Export a copy to keep your garden."); } };
    const timer = setInterval(persist, 5000); window.addEventListener("pagehide", persist); document.addEventListener("visibilitychange", persist);
    return () => { clearInterval(timer); window.removeEventListener("pagehide", persist); document.removeEventListener("visibilitychange", persist); };
  }, [canSave, latest]);
  const chooseTool = (key: GardenTool) => { setTool(key); setView(null); setStart(null); if (key !== "move") setMoving(undefined); };
  const act = (points: Point[]) => { dispatch({ type: "act", tool, points, moving }); setTarget(points.at(-1)!); if (tool === "move") { setTool("observe"); setMoving(undefined); } };
  const focus = (p: Point) => { setCamera(c => ({ ...c, x: Math.max(0, Math.min(WIDTH - c.width * .6, p.x - c.width / 2)), y: Math.max(0, Math.min(HEIGHT - 200, p.y - c.width * .3)) })); setView(null); setTarget(p); };
  const chosenObject = selected?.kind === "object" ? garden.objects.find(o => o.id === selected.id) : undefined;
  const chosenColony = garden.colonies.find(c => c.id === (view ?? (selected?.kind === "colony" ? selected.id : 0))) ?? garden.colonies[0];
  const point = chosenObject ?? (selected?.kind === "colony" ? chosenColony : selected?.point) ?? target;
  const q = quality(garden, point);
  const established = garden.objects.filter(o => (o.kind === "berry" || o.kind === "flower") && o.growth >= .75).length;
  const turnObject = (o: GardenObject) => dispatch({ type: "rotate", id: o.id });
  const exportSave = async () => { try { const saved = await snapshot(); const url = URL.createObjectURL(new Blob([encodeGarden(saved)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "antsy-garden.json"; a.click(); URL.revokeObjectURL(url); } catch { setSaveStatus("Couldn't export your garden. Pause and try again."); } };
  const observedAnt = chosenColony.colony.ants.find(a => a.id === observed);
  return <div className={styles.game}>
    <div inert={help || reset}>
      <header className={styles.header}><div className={styles.brand}><Link href="/" aria-label="Back to homepage"><ArrowLeft size={18}/></Link><Bug size={26}/><div><h1>antsy</h1></div></div><div className={styles.headerButtons}><button onClick={() => setHelp(true)}>Help</button><button onClick={save} aria-label="Save garden"><Save size={17}/></button><button onClick={exportSave} aria-label="Export garden"><Download size={17}/></button><button onClick={() => upload.current?.click()} aria-label="Import garden"><Upload size={17}/></button><button onClick={() => setReset(true)} aria-label="New garden"><RotateCcw size={17}/></button></div></header>
      <input ref={upload} type="file" accept="application/json,.json" className={styles.file} aria-label="Garden save file" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; if (file.size > 32_000_000) { setSaveStatus("Save file is too large."); return; } try { const next = decodeGarden(await file.text()); replace(next); setCanSave(true); setSpeed(0); setView(null); setSelected({ kind: "colony", id: next.colonies[0].id, point: next.colonies[0] }); setSaveStatus("Garden loaded. It'll save here automatically."); } catch { setSaveStatus("Could not import this file. You're still in your current garden."); } }}/>
      <div className={styles.topline}><div><strong>{totalAnts(garden)}</strong><span>ants · {garden.colonies.length} colonies</span></div><div><strong>{established}</strong><span>plants ready</span></div><div><strong>{Math.round(totalFood(garden))}</strong><span>food in nests</span></div><div><strong>{clock(garden.tick)}</strong><span>time</span></div><p role="status">{saveStatus}</p></div>
      {error && <p role="alert" className={styles.notice}>Something went wrong. Export your garden, then reload to try again.</p>}
      <div className={styles.layout}>
        <section className={styles.workspace} aria-label="Garden workspace">
          <div className={styles.mapbar}><div className={styles.viewTabs}><button aria-pressed={view === null} onClick={() => setView(null)}><Map size={15}/>Garden</button>{garden.colonies.map(c => <button key={c.id} aria-pressed={view === c.id} onClick={() => { setView(c.id); setObserved(-1); setSelected({ kind: "colony", id: c.id, point: c }); }}><i style={{ background: c.color }}/>{c.name} nest</button>)}</div><div className={styles.playback}><button aria-label={speed ? "Pause garden" : "Play garden"} onClick={() => setSpeed(speed ? 0 : 1)}>{speed ? <Pause size={15}/> : <Play size={15}/>}</button>{[1, 3, 8].map(n => <button key={n} aria-pressed={speed === n} onClick={() => setSpeed(n)}>{n}×</button>)}</div></div>
          {view === null ? <>
            <div className={styles.tools} aria-label="Garden tools">{tools.map(t => { const Icon = t.icon; return <button key={t.key} title={t.hint} aria-label={`${t.label} tool`} aria-pressed={tool === t.key} onClick={() => chooseTool(t.key)}><Icon size={17}/><span>{t.label}</span></button>; })}</div>

            <div className={styles.surface}><GardenView garden={garden} camera={camera} onCamera={setCamera} tool={tool} signals={signals} overlay={overlay} selected={selected} onSelect={s => { setSelected(s); setTarget(s.point); }} onAct={act}/>
              <div className={styles.zoom}><button aria-label="Zoom in" onClick={() => setCamera(c => ({ ...c, width: Math.max(500, c.width * .75) }))}><ZoomIn size={18}/></button><button aria-label="Zoom out" onClick={() => setCamera(c => ({ ...c, width: Math.min(2600, c.width * 1.3) }))}><ZoomOut size={18}/></button><button aria-label="Show whole garden" onClick={() => setCamera({ x: 0, y: 0, width: 2400 })}><Map size={18}/></button></div>
              {!speed && <span className={styles.paused}>PAUSED</span>}
              <button className={styles.minimap} aria-label="Move to this part of the garden" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); focus({ x: (e.clientX - r.left) / r.width * WIDTH, y: (e.clientY - r.top) / r.height * HEIGHT }); }}><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true"><rect width={WIDTH} height={HEIGHT} fill="#52634a"/><path d="M1190 0Q1300 390 1140 780T1190 1560" stroke="#91b6a1" strokeWidth="100" fill="none"/>{garden.colonies.map(c => <circle key={c.id} cx={c.x} cy={c.y} r="55" fill={c.color}/>)}<rect x={camera.x} y={camera.y} width={camera.width} height={camera.width * .65} fill="#f1dfab15" stroke="#f1dfab" strokeWidth="16"/></svg></button>
            </div>
            <div className={styles.mapFooter}><label><input type="checkbox" checked={signals} onChange={e => setSignals(e.target.checked)}/>Pheromone trails</label><label>Ground<select aria-label="Ground overlay" value={overlay} onChange={e => setOverlay(e.target.value as typeof overlay)}><option value="none">Off</option><option value="moisture">Moisture</option><option value="fertility">Fertility</option></select></label><span>24 × 15.6 m</span></div>
            <div className={styles.location}><label>Location<select aria-label="Garden location" onChange={e => { const p = landmarks[Number(e.target.value)]; setTarget(p); focus(p); }} defaultValue="1">{landmarks.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}</select></label><label>X<input aria-label="Garden X" type="number" min={0} max={WIDTH - 1} value={Math.round(target.x)} onChange={e => setTarget(p => ({ ...p, x: Math.max(0, Math.min(WIDTH - 1, Number(e.target.value))) }))}/></label><label>Y<input aria-label="Garden Y" type="number" min={0} max={HEIGHT - 1} value={Math.round(target.y)} onChange={e => setTarget(p => ({ ...p, y: Math.max(0, Math.min(HEIGHT - 1, Number(e.target.value))) }))}/></label>{tool === "channel" && <button onClick={() => setStart(target)}>{start ? "Change start" : "Set channel start"}</button>}<button onClick={() => tool === "observe" ? setSelected({ kind: "ground", point: target }) : act(tool === "channel" && start ? [start, target] : [target])}>{tool === "observe" ? "Inspect" : tool === "channel" ? "Dig channel" : "Place here"}</button></div>
          </> : <div className={styles.cutaway}><div className={styles.cutawayHeader}><div><h2>{chosenColony.name} · underground</h2></div><button onClick={() => focus(chosenColony)}>Find entrance</button></div>{observedAnt && <div className={styles.antReadout}><strong>{observedAnt.role} #{observedAnt.id}</strong><span>{observedAnt.action}</span><span>{observedAnt.zone === "surface" ? "Outside in the garden" : "Inside the nest"}{observedAnt.cargo ? ` · carrying ${observedAnt.cargo.kind}` : ""}</span></div>}<NestExplorer key={chosenColony.id} colony={chosenColony.colony} selected={observed} onSelect={setObserved} signals={signals}/></div>}
          {garden.notice && <div className={styles.notice} role="status">{garden.notice}</div>}
        </section>
        <aside className={styles.sidebar}>
          <section className={styles.panel}><div className={styles.panelHeading}><h2>{chosenObject ? names[chosenObject.kind] : selected?.kind === "colony" ? `${chosenColony.name} colony` : "Ground"}</h2><Eye size={16}/></div>
            {selected?.kind === "colony" ? <><p>{chosenColony.colony.result === "lost" ? chosenColony.colony.queenHealth <= 0 ? chosenColony.colony.queenHunger > 1 ? "The queen starved." : "The queen died." : "No workers left." : `${chosenColony.colony.ants.filter(a => a.zone === "surface").length} outside · ${chosenColony.colony.ants.filter(a => a.zone === "nest").length} underground`}</p><dl><div><dt>Queen health</dt><dd>{Math.round(chosenColony.colony.queenHealth)}%{chosenColony.colony.result === "alive" && chosenColony.colony.queenHunger > .8 ? " · hungry" : ""}</dd></div><div><dt>Hungry workers</dt><dd>{chosenColony.colony.ants.filter(a => a.hunger >= .65).length}</dd></div><div><dt>Stored food</dt><dd>{Math.floor(storedFood(chosenColony.colony))}</dd></div><div><dt>Food carried home</dt><dd>{chosenColony.colony.totals.delivered}</dd></div><div><dt>Brood / ants hatched</dt><dd>{chosenColony.colony.brood.length} / {chosenColony.colony.totals.hatched}</dd></div><div><dt>Shelter visits</dt><dd>{chosenColony.sheltered}</dd></div><div><dt>Starved</dt><dd>{chosenColony.colony.totals.starved}</dd></div><div><dt>Lost in fights</dt><dd>{chosenColony.colony.totals.casualties}</dd></div></dl><button className={styles.primary} onClick={() => setView(chosenColony.id)}>Open nest</button></> : <>
              <dl><div><dt>Moisture</dt><dd>{Math.round(q.moisture * 100)}% · {q.moisture < .29 ? "dry" : q.moisture > .93 ? "waterlogged" : "damp"}</dd></div><div><dt>Soil fertility</dt><dd>{Math.round(q.fertility * 100)}%</dd></div><div><dt>Cover</dt><dd>{Math.round(q.cover * 100)}%</dd></div>{chosenObject && <><div><dt>{chosenObject.kind === "berry" || chosenObject.kind === "flower" ? "Growth" : "Condition"}</dt><dd>{Math.round((chosenObject.kind === "berry" || chosenObject.kind === "flower" ? chosenObject.growth : chosenObject.condition) * 100)}%</dd></div><div><dt>Food left</dt><dd>{Math.floor(chosenObject.food)}</dd></div><div><dt>Discovered by</dt><dd>{chosenObject.visits.map(id => garden.colonies.find(c => c.id === id)?.name).join(", ") || "No colony yet"}</dd></div>{chosenObject.pollen > .05 && <div><dt>Pollination</dt><dd>More food growing</dd></div>}</>}</dl>
              {chosenObject && <div className={styles.objectActions}><button onClick={() => { setMoving(chosenObject.id); chooseTool("move"); }}>Move</button>{["log", "bridge"].includes(chosenObject.kind) && <button onClick={() => turnObject(chosenObject)}>Rotate</button>}<button onClick={() => { dispatch({ type: "act", tool: "remove", points: [chosenObject], moving: chosenObject.id }); setSelected({ kind: "ground", point: chosenObject }); }}>Remove</button></div>}
              {!chosenObject && <p>{q.moisture < .29 ? "Too dry to plant here. Dig a channel from the stream, or add some water." : q.moisture > .93 ? "Too wet for plants here. Try the bank instead." : "Damp enough to plant here. Fallen wood adds shelter and enriches the soil."}</p>}
            </>}
          </section>
          <section className={styles.panel}><div className={styles.panelHeading}><h2>Colonies</h2><Bug size={17}/></div>{garden.colonies.map(c => <button className={styles.colonyRow} key={c.id} onClick={() => { setSelected({ kind: "colony", id: c.id, point: c }); focus(c); }}><i style={{ background: c.color }}/><span><strong>{c.name}</strong><small>{c.colony.result === "lost" ? "Abandoned nest" : `${c.colony.ants.length} ants · ${Math.floor(storedFood(c.colony))} food`}</small></span><ChevronDown size={14}/></button>)}</section>

        </aside>
      </div>
      <section className={styles.history}><div><h2>What happened</h2><span>{garden.harvested} food collected · {garden.planted} plants added</span></div><div role="log" aria-live="off">{garden.log.slice(0, 5).map((e, i) => <p key={`${e.tick}-${i}`}><time>{clock(e.tick)}</time>{e.text}</p>)}</div></section>

    </div>
    {(help || reset) && <div className={styles.scrim}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="garden-dialog" onKeyDown={e => { if (e.key === "Escape") { setHelp(false); setReset(false); } if (e.key === "Tab") { const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button"), first = buttons[0], last = buttons[buttons.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }}><h2 id="garden-dialog">{reset ? "Start a fresh garden?" : "How to play"}</h2>{reset ? <><p>Your saved garden will be replaced. Export a copy first if you want to keep it.</p><button autoFocus className={styles.primary} onClick={() => { const next = createGarden(); replace(next); setCanSave(true); setSelected({ kind: "colony", id: 0, point: next.colonies[0] }); setView(null); setTool("observe"); setCamera({ x: 500, y: 570, width: 1500 }); setReset(false); setSaveStatus("Started a new garden."); }}>Start fresh</button><button onClick={() => setReset(false)}>Keep this garden</button></> : <><p>Drag to look around and scroll to zoom. Pick a tool to change the garden. Dig channels from the stream or a pond to bring water to your plants.</p><p>Colonies fight when they meet. Food and bridges can bring them together. Nurses raise new ants based on what the nest needs, as long as there’s enough food.</p><p>Your garden saves automatically in this browser. Export a copy to keep a backup or play elsewhere. The game pauses when you switch tabs.</p><button autoFocus className={styles.primary} onClick={() => setHelp(false)}>Back to the garden</button></>}</section></div>}
  </div>;
}
