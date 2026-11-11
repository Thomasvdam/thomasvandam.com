"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Bug, ChevronDown, Droplets, Download, Eye, Flower2, Hand, Leaf, Map, Mountain, Pause, Play, Plus, RotateCcw, Save, Shovel, Sprout, TreePine, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { actGarden, createGarden, creekX, GardenObject, GardenTool, HEIGHT, quality, stepGarden, totalAnts, totalFood, WIDTH } from "./garden";
import { decodeGarden, encodeGarden, SAVE_KEY } from "./garden-save";
import GardenView, { Camera, Selection } from "./garden-view";
import { Point } from "./nest";
import { batchProblem, prepareBatch } from "./sandbox";
import { batchStatus, DT, Role, storedFood } from "./simulation";
import NestExplorer from "./nest-explorer";
import styles from "./garden.module.css";

const tools: { key: GardenTool; label: string; icon: typeof Eye; hint: string }[] = [
  { key: "observe", label: "Explore", icon: Hand, hint: "Drag to explore. Select an object, colony, or patch of ground to inspect it." },
  { key: "berry", label: "Berry bush", icon: Leaf, hint: "Plant on damp ground beside a channel. Mature bushes provide renewable food." },
  { key: "flower", label: "Flowers", icon: Flower2, hint: "Flowers feed ants and attract pollinators, which improve plant yields." },
  { key: "log", label: "Fallen wood", icon: TreePine, hint: "Wood provides shelter, retains moisture, and slowly makes the surrounding soil richer." },
  { key: "bridge", label: "Bridge", icon: Plus, hint: "Place across water to open a route. Select the bridge to rotate or move it." },
  { key: "channel", label: "Channel", icon: Shovel, hint: "Draw a channel from a pond or stream. Water spreads along connected channels; plant beside the wet edges." },
  { key: "water", label: "Water", icon: Droplets, hint: "Water a patch by hand. Connected channels keep it supplied after this water dries." },
  { key: "fruit", label: "Fruit", icon: Sprout, hint: "A food source ants must discover. Uncollected fruit gradually decays into fertile soil." },
  { key: "rock", label: "Rock", icon: Mountain, hint: "Place an obstacle and watch foragers find a way around it." },
  { key: "found", label: "New colony", icon: Bug, hint: "Introduce a colony where you have prepared damp ground, wood cover, and nearby food." },
  { key: "remove", label: "Remove", icon: X, hint: "Remove an object, or fill in a channel on empty ground." },
];
const landmarks = [{ label: "Cedar bank", x: 440, y: 960 }, { label: "Dry reach", x: 800, y: 620 }, { label: "Stream crossing", x: creekX(860), y: 860 }, { label: "Willow meadow", x: 1530, y: 1040 }, { label: "Ochre grove", x: 1960, y: 560 }];
const names = { berry: "Berry bush", flower: "Flower patch", log: "Fallen wood", bridge: "Wooden bridge", fruit: "Fallen fruit", rock: "Rock" };
const clock = (tick: number) => `${Math.floor(tick * DT / 60)}:${Math.floor(tick * DT % 60).toString().padStart(2, "0")}`;
const subscribe = () => () => {};
function initial() {
  try { const raw = localStorage.getItem(SAVE_KEY); return { garden: raw ? decodeGarden(raw) : createGarden(), saved: raw ? "Restored from this browser" : "Not saved yet", protected: false }; }
  catch { return { garden: createGarden(), saved: "Could not restore a save. Autosave is paused; import a backup or start a new garden.", protected: true }; }
}
export default function GardenGame() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  if (!ready) return <div className={styles.loading}>Opening the garden…</div>;
  return <LivingGarden/>;
}
function LivingGarden() {
  const [loaded] = useState(initial);
  const [garden, setGarden] = useState(loaded.garden);
  const [saveStatus, setSaveStatus] = useState(loaded.saved);
  const [canSave, setCanSave] = useState(!loaded.protected);
  const [speed, setSpeed] = useState(1);
  const [tool, setTool] = useState<GardenTool>("observe");
  const [moving, setMoving] = useState<number | undefined>();
  const [selected, setSelected] = useState<Selection | null>({ kind: "colony", id: 0, point: loaded.garden.colonies[0] });
  const [camera, setCamera] = useState<Camera>({ x: 90, y: 520, width: 1250 });
  const [overlay, setOverlay] = useState<"none" | "moisture" | "fertility">("none");
  const [signals, setSignals] = useState(true);
  const [view, setView] = useState<number | null>(null);
  const [target, setTarget] = useState<Point>(landmarks[1]);
  const [start, setStart] = useState<Point | null>(null);
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(false);
  const [observed, setObserved] = useState(-1);
  const [role, setRole] = useState<Role>("forager");
  const upload = useRef<HTMLInputElement>(null), latest = useRef(garden);
  useEffect(() => { latest.current = garden; }, [garden]);
  useEffect(() => {
    if (!speed || reset || help) return;
    const timer = setInterval(() => { if (document.hidden) return; setGarden(s => { let next = s; for (let i = 0; i < speed * 2; i++) next = stepGarden(next); return next; }); }, 100);
    return () => clearInterval(timer);
  }, [speed, reset, help]);
  const save = () => { if (!canSave) { setSaveStatus("Previous save preserved. Import a backup or choose New garden before saving."); return; } try { localStorage.setItem(SAVE_KEY, encodeGarden(latest.current)); setSaveStatus("Saved in this browser"); } catch { setSaveStatus("Browser save failed. Export a backup to keep this garden."); } };
  useEffect(() => {
    if (!canSave) return;
    const persist = () => { try { localStorage.setItem(SAVE_KEY, encodeGarden(latest.current)); setSaveStatus(previous => previous.startsWith("Could not import") || previous.startsWith("Save file is too large") ? previous : "Saved in this browser"); } catch { setSaveStatus("Browser save failed. Export a backup to keep this garden."); } };
    const timer = setInterval(persist, 5000); window.addEventListener("pagehide", persist); document.addEventListener("visibilitychange", persist);
    return () => { clearInterval(timer); window.removeEventListener("pagehide", persist); document.removeEventListener("visibilitychange", persist); };
  }, [canSave]);
  const chooseTool = (key: GardenTool) => { setTool(key); setView(null); setStart(null); if (key !== "move") setMoving(undefined); };
  const act = (points: Point[]) => { setGarden(s => actGarden(s, tool, points, moving)); setTarget(points.at(-1)!); if (tool === "move") { setTool("observe"); setMoving(undefined); } };
  const focus = (p: Point) => { setCamera(c => ({ ...c, x: Math.max(0, Math.min(WIDTH - c.width * .6, p.x - c.width / 2)), y: Math.max(0, Math.min(HEIGHT - 200, p.y - c.width * .3)) })); setView(null); setTarget(p); };
  const chosenObject = selected?.kind === "object" ? garden.objects.find(o => o.id === selected.id) : undefined;
  const chosenColony = garden.colonies.find(c => c.id === (view ?? (selected?.kind === "colony" ? selected.id : 0))) ?? garden.colonies[0];
  const point = chosenObject ?? (selected?.kind === "colony" ? chosenColony : selected?.point) ?? target;
  const q = quality(garden, point);
  const active = tools.find(t => t.key === tool);
  const established = garden.objects.filter(o => (o.kind === "berry" || o.kind === "flower") && o.growth >= .75).length;
  const turnObject = (o: GardenObject) => setGarden(s => ({ ...s, objects: s.objects.map(p => p.id === o.id ? { ...p, angle: p.angle + Math.PI / 4 } : p) }));
  const exportSave = () => { const url = URL.createObjectURL(new Blob([encodeGarden(latest.current)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "formicarium-garden.json"; a.click(); URL.revokeObjectURL(url); };
  const batch = batchStatus(chosenColony.colony);
  const observedAnt = chosenColony.colony.ants.find(a => a.id === observed);
  return <div className={styles.game}>
    <div inert={help || reset}>
      <header className={styles.header}><div className={styles.brand}><Link href="/" aria-label="Back to homepage"><ArrowLeft size={18}/></Link><Bug size={26}/><div><h1>FORMICARIUM</h1><span>A LIVING GARDEN</span></div></div><div className={styles.headerButtons}><button onClick={() => setHelp(true)}>Field notes</button><button onClick={save} aria-label="Save garden"><Save size={17}/></button><button onClick={exportSave} aria-label="Export garden"><Download size={17}/></button><button onClick={() => upload.current?.click()} aria-label="Import garden"><Upload size={17}/></button><button onClick={() => setReset(true)} aria-label="New garden"><RotateCcw size={17}/></button></div></header>
      <input ref={upload} type="file" accept="application/json,.json" className={styles.file} aria-label="Garden save file" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; if (file.size > 32_000_000) { setSaveStatus("Save file is too large."); return; } try { const next = decodeGarden(await file.text()); setGarden(next); latest.current = next; setCanSave(true); setSpeed(0); setView(null); setSelected({ kind: "colony", id: next.colonies[0].id, point: next.colonies[0] }); setSaveStatus("Imported. Save to keep this garden in this browser."); } catch { setSaveStatus("Could not import this file. Your current garden is unchanged."); } }}/>
      <div className={styles.topline}><div><strong>{totalAnts(garden)}</strong><span>ants · {garden.colonies.length} colonies</span></div><div><strong>{established}</strong><span>established plants</span></div><div><strong>{Math.round(totalFood(garden))}</strong><span>food in nests</span></div><div><strong>{clock(garden.tick)}</strong><span>garden time</span></div><p role="status">{saveStatus}</p></div>
      <div className={styles.layout}>
        <section className={styles.workspace} aria-label="Garden workspace">
          <div className={styles.mapbar}><div className={styles.viewTabs}><button aria-pressed={view === null} onClick={() => setView(null)}><Map size={15}/>Garden</button>{garden.colonies.map(c => <button key={c.id} aria-pressed={view === c.id} onClick={() => { setView(c.id); setObserved(-1); setSelected({ kind: "colony", id: c.id, point: c }); }}><i style={{ background: c.color }}/>{c.name} nest</button>)}</div><div className={styles.playback}><button aria-label={speed ? "Pause garden" : "Play garden"} onClick={() => setSpeed(speed ? 0 : 1)}>{speed ? <Pause size={15}/> : <Play size={15}/>}</button>{[1, 3, 8].map(n => <button key={n} aria-pressed={speed === n} onClick={() => setSpeed(n)}>{n}×</button>)}</div></div>
          {view === null ? <>
            <div className={styles.tools} aria-label="Garden tools">{tools.map(t => { const Icon = t.icon; return <button key={t.key} aria-label={`${t.label} tool`} aria-pressed={tool === t.key} onClick={() => chooseTool(t.key)}><Icon size={17}/><span>{t.label}</span></button>; })}</div>
            <div className={styles.toolHint}>{tool === "move" ? "Choose where to put the selected object. Its food and growth are preserved." : active?.hint}</div>
            <div className={styles.surface}><GardenView garden={garden} camera={camera} onCamera={setCamera} tool={tool} signals={signals} overlay={overlay} selected={selected} onSelect={s => { setSelected(s); setTarget(s.point); }} onAct={act}/>
              <div className={styles.zoom}><button aria-label="Zoom in" onClick={() => setCamera(c => ({ ...c, width: Math.max(500, c.width * .75) }))}><ZoomIn size={18}/></button><button aria-label="Zoom out" onClick={() => setCamera(c => ({ ...c, width: Math.min(2600, c.width * 1.3) }))}><ZoomOut size={18}/></button><button aria-label="Show whole garden" onClick={() => setCamera({ x: 0, y: 0, width: 2400 })}><Map size={18}/></button></div>
              {!speed && <span className={styles.paused}>PAUSED</span>}
              <button className={styles.minimap} aria-label="Move to this part of the garden" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); focus({ x: (e.clientX - r.left) / r.width * WIDTH, y: (e.clientY - r.top) / r.height * HEIGHT }); }}><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true"><rect width={WIDTH} height={HEIGHT} fill="#52634a"/><path d="M1190 0Q1300 390 1140 780T1190 1560" stroke="#91b6a1" strokeWidth="100" fill="none"/>{garden.colonies.map(c => <circle key={c.id} cx={c.x} cy={c.y} r="55" fill={c.color}/>)}<rect x={camera.x} y={camera.y} width={camera.width} height={camera.width * .65} fill="#f1dfab15" stroke="#f1dfab" strokeWidth="16"/></svg></button>
            </div>
            <div className={styles.mapFooter}><label><input type="checkbox" checked={signals} onChange={e => setSignals(e.target.checked)}/>Pheromone trails</label><label>Ground<select aria-label="Ground overlay" value={overlay} onChange={e => setOverlay(e.target.value as typeof overlay)}><option value="none">Natural</option><option value="moisture">Moisture</option><option value="fertility">Fertility</option></select></label><span>24 × 15.6 m</span></div>
            <div className={styles.location}><label>Location<select aria-label="Garden location" onChange={e => { const p = landmarks[Number(e.target.value)]; setTarget(p); focus(p); }} defaultValue="1">{landmarks.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}</select></label><label>X<input aria-label="Garden X" type="number" min={0} max={WIDTH - 1} value={Math.round(target.x)} onChange={e => setTarget(p => ({ ...p, x: Math.max(0, Math.min(WIDTH - 1, Number(e.target.value))) }))}/></label><label>Y<input aria-label="Garden Y" type="number" min={0} max={HEIGHT - 1} value={Math.round(target.y)} onChange={e => setTarget(p => ({ ...p, y: Math.max(0, Math.min(HEIGHT - 1, Number(e.target.value))) }))}/></label>{tool === "channel" && <button onClick={() => setStart(target)}>{start ? "Change start" : "Set channel start"}</button>}<button onClick={() => tool === "observe" ? setSelected({ kind: "ground", point: target }) : act(tool === "channel" && start ? [start, target] : [target])}>{tool === "observe" ? "Inspect" : tool === "channel" ? "Dig channel" : "Place here"}</button></div>
          </> : <div className={styles.cutaway}><div className={styles.cutawayHeader}><div><h2>{chosenColony.name} · underground</h2><p>These are the same ants that forage in the garden. Food enters only when a carrier reaches the nest.</p></div><button onClick={() => focus(chosenColony)}>Find entrance</button></div>{observedAnt && <div className={styles.antReadout}><strong>{observedAnt.role} #{observedAnt.id}</strong><span>{observedAnt.action}</span><span>{observedAnt.zone === "surface" ? "Outside in the garden" : "Inside the nest"}{observedAnt.cargo ? ` · carrying ${observedAnt.cargo.kind}` : ""}</span></div>}<NestExplorer key={chosenColony.id} colony={chosenColony.colony} selected={observed} onSelect={setObserved} signals={signals}/></div>}
          {garden.notice && <div className={styles.notice} role="status">{garden.notice}</div>}
        </section>
        <aside className={styles.sidebar}>
          <section className={styles.panel}><div className={styles.panelHeading}><h2>{chosenObject ? names[chosenObject.kind] : selected?.kind === "colony" ? `${chosenColony.name} colony` : "Ground conditions"}</h2><Eye size={16}/></div>
            {selected?.kind === "colony" ? <><p>{chosenColony.colony.result === "lost" ? "This colony has fallen. Its nest remains part of the garden." : `${chosenColony.colony.ants.filter(a => a.zone === "surface").length} outside · ${chosenColony.colony.ants.filter(a => a.zone === "nest").length} underground`}</p><dl><div><dt>Stored food</dt><dd>{Math.floor(storedFood(chosenColony.colony))}</dd></div><div><dt>Food carried home</dt><dd>{chosenColony.colony.totals.delivered}</dd></div><div><dt>Brood / hatched</dt><dd>{chosenColony.colony.brood.length} / {chosenColony.colony.totals.hatched}</dd></div><div><dt>Workers using shelter</dt><dd>{chosenColony.sheltered} visits</dd></div><div><dt>Starvation losses</dt><dd>{chosenColony.colony.totals.starved}</dd></div></dl><button className={styles.primary} onClick={() => setView(chosenColony.id)}>Look inside the nest</button></> : <>
              <dl><div><dt>Moisture</dt><dd>{Math.round(q.moisture * 100)}% · {q.moisture < .29 ? "dry" : q.moisture > .93 ? "waterlogged" : "damp"}</dd></div><div><dt>Soil fertility</dt><dd>{Math.round(q.fertility * 100)}%</dd></div><div><dt>Cover</dt><dd>{Math.round(q.cover * 100)}%</dd></div>{chosenObject && <><div><dt>{chosenObject.kind === "berry" || chosenObject.kind === "flower" ? "Growth" : "Condition"}</dt><dd>{Math.round((chosenObject.kind === "berry" || chosenObject.kind === "flower" ? chosenObject.growth : chosenObject.condition) * 100)}%</dd></div><div><dt>Available food</dt><dd>{Math.floor(chosenObject.food)}</dd></div><div><dt>Discovered by</dt><dd>{chosenObject.visits.map(id => garden.colonies.find(c => c.id === id)?.name).join(", ") || "No colony yet"}</dd></div>{chosenObject.pollen > .05 && <div><dt>Pollination</dt><dd>Yield boosted</dd></div>}</>}</dl>
              {chosenObject && <div className={styles.objectActions}><button onClick={() => { setMoving(chosenObject.id); chooseTool("move"); }}>Move</button>{["log", "bridge"].includes(chosenObject.kind) && <button onClick={() => turnObject(chosenObject)}>Rotate</button>}<button onClick={() => { setGarden(s => actGarden(s, "remove", [chosenObject], chosenObject.id)); setSelected({ kind: "ground", point: chosenObject }); }}>Remove</button></div>}
              {!chosenObject && <p>{q.moisture < .29 ? "Dry ground. Bring a channel from the stream, or use water to begin a planting." : q.moisture > .93 ? "Water is too deep for roots. Plant along the bank instead." : "Damp ground can support plants. Fallen wood improves cover and soil over time."}</p>}
            </>}
          </section>
          <section className={styles.panel}><div className={styles.panelHeading}><h2>Colonies</h2><Bug size={17}/></div>{garden.colonies.map(c => <button className={styles.colonyRow} key={c.id} onClick={() => { setSelected({ kind: "colony", id: c.id, point: c }); focus(c); }}><i style={{ background: c.color }}/><span><strong>{c.name}</strong><small>{c.colony.result === "lost" ? "Abandoned nest" : `${c.colony.ants.length} ants · ${Math.floor(storedFood(c.colony))} food`}</small></span><ChevronDown size={14}/></button>)}</section>
          {view !== null && <section className={styles.panel}><h2>New brood</h2><p>Choose the next caste, or prepare a batch of 12 fed brood for nurses to raise.</p><select aria-label="Brood caste" value={role} onChange={e => { const next = e.target.value as Role; setRole(next); setGarden(s => ({ ...s, colonies: s.colonies.map(c => c.id === chosenColony.id ? { ...c, colony: { ...c.colony, nextRole: next } } : c) })); }}>{["forager", "nurse", "digger", "cleaner"].map(r => <option key={r} value={r}>{r}s</option>)}</select><button className={styles.primary} disabled={!!batchProblem(chosenColony.colony)} onClick={() => setGarden(s => ({ ...s, colonies: s.colonies.map(c => c.id === chosenColony.id ? { ...c, colony: prepareBatch(c.colony, role) } : c), notice: `Prepared ${role} brood in ${chosenColony.name}. Nurses must tend it.` }))}>Raise 12 · 12 food</button>{batch && <p>{batch.hatched} / {batch.total} hatched</p>}</section>}
          <section className={styles.project}><span>TRY A LASTING CHANGE</span><h2>Make the dry reach bloom.</h2><p>Lead water from the stream. Add wood and plant beside the channel. Watch for growth, visitors, and new ant trails.</p><button onClick={() => { focus(landmarks[1]); setSelected({ kind: "ground", point: landmarks[1] }); }}>Go to the dry reach <ArrowLeft size={14} style={{ transform: "rotate(180deg)" }}/></button></section>
        </aside>
      </div>
      <section className={styles.history}><div><h2>Garden history</h2><span>{garden.harvested} food collected · {garden.planted} plantings</span></div><div role="log" aria-live="off">{garden.log.slice(0, 5).map((e, i) => <p key={`${e.tick}-${i}`}><time>{clock(e.tick)}</time>{e.text}</p>)}</div></section>
      <footer className={styles.footer}><span>Saved locally · export a backup to take your garden elsewhere.</span><span>The garden rests while this tab is hidden or closed.</span></footer>
    </div>
    {(help || reset) && <div className={styles.scrim}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="garden-dialog" onKeyDown={e => { if (e.key === "Escape") { setHelp(false); setReset(false); } if (e.key === "Tab") { const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button"), first = buttons[0], last = buttons[buttons.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }}><h2 id="garden-dialog">{reset ? "Start a fresh garden?" : "Tend a place. Watch it change."}</h2>{reset ? <><p>This replaces the garden in this browser. Export it first if you want to keep a copy.</p><button autoFocus className={styles.primary} onClick={() => { const next = createGarden(); setGarden(next); latest.current = next; setCanSave(true); setSelected({ kind: "colony", id: 0, point: next.colonies[0] }); setView(null); setTool("observe"); setCamera({ x: 90, y: 520, width: 1250 }); setReset(false); setSaveStatus("New garden. Previous browser save will be replaced on autosave."); }}>Start fresh</button><button onClick={() => setReset(false)}>Keep this garden</button></> : <><p>The two colonies share the same garden. They find food locally, remember their journeys, and leave trails as they carry it home. Look inside a nest to follow deliveries, nursing, and excavation. Small nests expand as food, brood, and traffic create demand for space; diggers open chambers and bypasses while haulers clear their soil piles.</p><p>Connect channels to water, plant along their edges, and add fallen wood for shelter and fertile soil. Bridges open crossings. Pollinators visit mature plants. Fruit provides temporary food and gradually enriches the ground.</p><p>Prepare a damp, sheltered food supply before introducing another colony. Their repeated visits and food trails show which parts of the garden they use.</p><p>Autosaves stay in this browser. Export/import makes a portable backup. Nothing ages or starves while the tab is hidden or closed.</p><button autoFocus className={styles.primary} onClick={() => setHelp(false)}>Back to the garden</button></>}</section></div>}
  </div>;
}
