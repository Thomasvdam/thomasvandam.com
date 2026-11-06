"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bug, CloudRain, FastForward, HelpCircle, Leaf, Pause, Play, RotateCcw, Shield, Shovel, Snowflake, Sprout, X, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { assignRoom, capacity, COLS, createColony, dayOf, Job, neighbors, queueDig, rainy, Room, seasonOf, spider, step, workforce } from "./simulation";
import styles from "./game.module.css";
import NestView from "./nest-view";

const roomNames: Record<Room, string> = { tunnel: "Tunnel", queen: "Queen’s chamber", food: "Food store", nursery: "Nursery", waste: "Refuse chamber" };
const colors: Record<Room, string> = { tunnel: "#bd9b69", queen: "#e7b45d", food: "#a6b66c", nursery: "#dccdb2", waste: "#9b9287" };
const jobInfo: { key: Job; label: string; icon: typeof Leaf; description: string }[] = [
  { key: "foragers", label: "Foragers", icon: Leaf, description: "Gather food on the surface" },
  { key: "nurses", label: "Nurses", icon: Sprout, description: "Care for brood and raise workers" },
  { key: "diggers", label: "Diggers", icon: Shovel, description: "Excavate, drain water, remove waste" },
  { key: "guards", label: "Guards", icon: Shield, description: "Protect foragers from spiders" },
];

export default function Game() {
  const [colony, setColony] = useState(() => createColony());
  const [speed, setSpeed] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [selected, setSelected] = useState(38);
  const [help, setHelp] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!speed || help || confirmReset || colony.result !== "alive") return;
    const timer = setInterval(() => setColony(s => step(s)), 1000 / speed);
    return () => clearInterval(timer);
  }, [speed, help, confirmReset, colony.result]);
  const jobs = workforce(colony);
  const day = dayOf(colony);
  const tile = colony.tiles[selected];
  const frontier = !tile.room && neighbors(selected).some(n => colony.tiles[n].room);
  const ended = colony.result !== "alive";
  const wet = rainy(colony);
  const selectTile = (i: number) => { setSelected(i); };
  const reset = () => { setColony(createColony()); setZoom(false); setSpeed(0); setSelected(38); setConfirmReset(false); setHelp(true); };

  return <div className={styles.game}><div inert={help || ended || confirmReset}>
    <header className={styles.header}>
      <div className={styles.brand}><Link href="/" aria-label="Back to homepage"><ArrowLeft size={17}/></Link><Bug size={27}/><h1>FORMICARIUM</h1><span>COLONY 01</span></div>
      <div className={styles.headerActions}><button onClick={() => setHelp(true)} aria-label="How to play"><HelpCircle size={18}/></button><button onClick={() => setConfirmReset(true)} aria-label="Restart colony"><RotateCcw size={17}/></button></div>
    </header>

    <section className={styles.status} aria-label="Colony status">
      <div><span>POPULATION</span><strong>{colony.workers}<small> workers</small></strong><em>{colony.brood} brood developing</em><div className={styles.statMeter} aria-hidden="true">{(["foragers", "nurses", "diggers", "guards"] as Job[]).map((job, k) => <i key={job} style={{ width: `${jobs[job] / Math.max(1, colony.workers) * 100}%`, background: ["#a6b67a", "#ded4b6", "#b8986a", "#8baba2"][k] }}/>)}</div></div>
      <div><span>FOOD RESERVE</span><strong className={colony.food < 15 ? styles.danger : ""}>{Math.floor(colony.food)}<small> / {capacity(colony, "food")}</small></strong><em>{day > 90 ? "Living on stored food" : "Seeds & insect protein"}</em><div className={styles.statMeter} aria-hidden="true"><i style={{ width: `${colony.food / Math.max(1, capacity(colony, "food")) * 100}%` }}/></div></div>
      <div><span>QUEEN HEALTH</span><strong className={colony.health < 40 ? styles.danger : ""}>{Math.ceil(colony.health)}<small>%</small></strong><em>{colony.health > 75 ? "Healthy" : "Colony under strain"}</em><div className={styles.statMeter} aria-hidden="true"><i style={{ width: `${colony.health}%` }}/></div></div>
      <div><span>NEST WASTE</span><strong className={colony.waste > 12 ? styles.danger : ""}>{Math.floor(colony.waste)}<small> / 25</small></strong><em>{colony.waste > 12 ? "Disease pressure rising" : "Safe conditions"}</em><div className={styles.statMeter} aria-hidden="true"><i style={{ width: `${Math.min(100, colony.waste / 25 * 100)}%` }}/></div></div>
    </section>

    <div className={styles.layout}>
      <section className={styles.observation} aria-label="Nest management">
        <div className={styles.worldHeader}><div><span className={styles.live}/><span>NEST CROSS-SECTION</span></div><span>{wet ? "RAIN" : day > 90 ? "FROST" : "CLEAR"} · {day > 90 ? "2" : wet ? "14" : "21"}°C</span></div>
        <div className={styles.world}>
          <NestView colony={colony} selected={selected} onSelect={selectTile} running={!!speed && !help && !confirmReset && !ended} speed={speed} zoom={zoom}/>
          <button className={styles.worldZoom} aria-label={zoom ? "Show whole nest" : "Zoom in on selected tile"} title={zoom ? "Show whole nest" : "Zoom in on selected tile"} onClick={() => setZoom(!zoom)}>{zoom ? <ZoomOut size={16}/> : <ZoomIn size={16}/>}</button>
          {!speed && !help && !ended && <span className={styles.paused}>PAUSED</span>}
        </div>
        <div className={styles.worldFooter}><span><i style={{ background: colors.queen }}/>Queen</span><span><i style={{ background: colors.food }}/>Food</span><span><i style={{ background: colors.nursery }}/>Brood</span><span><i style={{ background: colors.waste }}/>Refuse</span><span className={styles.hint}>Select a tile to manage</span></div>
        <div className={styles.timebar}>
          <div><span className={styles.eyebrow}>YEAR 01</span><strong>{seasonOf(colony)} <span>/ Day {Math.min(day, 120)}</span></strong></div>
          <div className={styles.seasons} aria-label={`${Math.min(day, 120)} of 120 days`}><div><span style={{ width: `${Math.min(100, day / 120 * 100)}%` }}/></div><section><span>SPRING</span><span>SUMMER</span><span>AUTUMN</span><span>WINTER</span></section></div>
          <div className={styles.playback}><button aria-label={speed ? "Pause simulation" : "Play simulation"} disabled={ended} onClick={() => setSpeed(speed ? 0 : 1)}>{speed ? <Pause size={17}/> : <Play size={17}/>}</button>{[1, 3, 8].map(n => <button key={n} disabled={ended} aria-pressed={speed === n} onClick={() => setSpeed(n)}>{n}×</button>)}</div>
        </div>
      </section>

      <aside className={styles.sidebar}>
        <section className={styles.panel}><div className={styles.panelTitle}><h2>Workforce</h2><span>{colony.workers} ANTS</span></div>
          {jobInfo.map(({ key, label, icon: Icon, description }) => <div className={styles.job} key={key}><label htmlFor={key}><Icon size={16}/>{label}<strong>{jobs[key]}</strong></label><input id={key} type="range" min="0" max="5" value={colony.jobs[key]} disabled={ended} onChange={e => setColony(s => ({ ...s, jobs: { ...s.jobs, [key]: Number(e.target.value) } }))}/><small>{description} · priority {colony.jobs[key]}</small></div>)}
          <label className={styles.toggle}><input type="checkbox" checked={colony.laying} disabled={ended} onChange={e => setColony(s => ({ ...s, laying: e.target.checked }))}/>Raise new brood <span>{colony.brood}/{capacity(colony, "nursery")}</span></label>
        </section>
        <section className={styles.panel}><div className={styles.panelTitle}><h2>Foraging grounds</h2>{spider(colony) && <Bug size={16} className={styles.danger}/>}</div><div className={styles.segment}>{(["near", "far"] as const).map(range => <button key={range} disabled={ended} aria-pressed={colony.range === range} onClick={() => setColony(s => ({ ...s, range }))}>{range === "near" ? "Nearby seeds" : "Distant insects"}</button>)}</div><p>{day > 90 ? "Frozen ground. No food can be gathered until spring." : colony.range === "far" ? "Larger hauls. Greater exposure to predators." : "Smaller hauls. Safer routes close to the nest."}</p></section>
        <section className={styles.panel}><div className={styles.panelTitle}><h2>{tile.room ? roomNames[tile.room] : "Undug soil"}</h2><span>{selected % COLS + 1} · {Math.floor(selected / COLS) + 1}</span></div>
          {tile.room ? <><p>{tile.room === "queen" ? "The heart of the colony. Keep her fed and the nest clean." : `Water level ${Math.round(tile.water * 100)}%. ${tile.water >= .6 ? "Flooded: this chamber has no usable capacity." : "Chamber is usable."}`}</p>{tile.room !== "queen" && selected !== 7 && <label className={styles.roomSelect}>Chamber use<select value={tile.room} disabled={ended} onChange={e => setColony(s => assignRoom(s, selected, e.target.value as Room))}>{(["tunnel", "food", "nursery", "waste"] as Room[]).map(r => <option key={r} value={r}>{roomNames[r]}</option>)}</select></label>}</> : <><p>{frontier ? "Diggers can extend the nest here. Once excavated, choose a chamber use." : "Excavation must connect to an existing tunnel."}</p><button className={styles.action} disabled={!frontier || ended} onClick={() => setColony(s => queueDig(s, selected))}><Shovel size={15}/>{tile.queued ? "Cancel excavation" : "Queue excavation"}</button></>}
        </section>
      </aside>
    </div>
    <section className={styles.bottom}><div className={styles.objective}><Snowflake size={23}/><div><span className={styles.eyebrow}>OBJECTIVE</span><strong>Survive the first winter</strong><p>{Math.max(0, 91 - day)} days until frost · survive through day 120</p></div></div><div className={styles.journal}><div className={styles.panelTitle}><h2>Colony journal</h2>{wet && <CloudRain size={15}/>}</div><div role="log" aria-live="polite" aria-relevant="additions">{colony.log.slice(0, 3).map((entry, i) => <p key={`${entry.day}-${entry.text}-${i}`}><span>DAY {entry.day.toString().padStart(2, "0")}</span>{entry.text}</p>)}</div></div></section>

    </div>
    {(help || ended || confirmReset) && <div className={styles.scrim}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={e => {
      if (e.key === "Escape") { if (confirmReset) setConfirmReset(false); else if (help && !ended) setHelp(false); }
      if (e.key === "Tab") {
        const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      {help && !ended && !confirmReset ? <><span className={styles.eyebrow}>A COLONY SURVIVAL SIMULATION</span><h2 id="dialog-title">Before the frost.</h2><p>A queen. Twenty-four workers. One season to build a colony that can survive winter.</p><ul><li><strong>Feed the colony.</strong> Set worker priorities and choose nearby seeds or riskier distant insects.</li><li><strong>Build the nest.</strong> Select soil beside a tunnel, queue digging, then assign food stores, nurseries, or refuse chambers.</li><li><strong>Prepare for winter.</strong> Food gathering stops on day 91. Expand storage, manage population, and stockpile enough to reach day 120.</li></ul><p className={styles.note}>Diggers also clear waste into refuse chambers and drain flooded rooms. Nurses turn brood into workers. Guards reduce spider losses.</p><button className={styles.action} autoFocus onClick={() => { setHelp(false); if (!speed) setSpeed(1); }}>Enter the colony <FastForward size={16}/></button></> : confirmReset ? <><h2 id="dialog-title">Start a new colony?</h2><p>Your current colony will be lost.</p><button className={styles.action} autoFocus onClick={reset}>Start again</button><button className={styles.cancel} onClick={() => setConfirmReset(false)}>Keep playing</button></> : <><span className={styles.eyebrow}>{colony.result === "won" ? "SPRING HAS RETURNED" : "COLONY LOST"}</span><h2 id="dialog-title">{colony.result === "won" ? "Life beneath the frost." : "The nest falls silent."}</h2><p>{colony.result === "won" ? `${colony.workers} workers and a living queen made it through winter.` : `Your colony survived ${day - 1} days. ${colony.health <= 0 ? "The queen succumbed to starvation or poor nest conditions." : "The last workers were lost."}`}</p><button className={styles.action} autoFocus onClick={reset}>Start a new colony</button></>}
      {help && !ended && !confirmReset && <button className={styles.close} aria-label="Close instructions" onClick={() => setHelp(false)}><X size={20}/></button>}
    </section></div>}
  </div>;
}
