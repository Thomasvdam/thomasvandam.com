"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bug, ChevronRight, Eye, Hand, HelpCircle, Leaf, Pause, Play, RotateCcw, Shield, Shovel, Sparkles, Sprout, Waves, X, Zap, Mountain, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { BATCH_FOOD, BATCH_SECONDS, BATCH_SIZE, batchStatus, counts, createColony, DT, elapsed, rainy, Role, ROLES, step, storedFood } from "./simulation";
import styles from "./game.module.css";
import NestView from "./nest-view";
import { batchProblem, intervene, prepareBatch, releaseHeld, Tool } from "./sandbox";
import { Point, tunnelPoint } from "./nest";

const roleInfo: Record<Role, { label: string; color: string; icon: typeof Leaf; description: string }> = {
  forager: { label: "Foragers", color: "#bfcc80", icon: Leaf, description: "Explore, follow trails, and carry food home." },
  nurse: { label: "Nurses", color: "#dbc6b4", icon: Sprout, description: "Move eggs, feed larvae, and tend the queen." },
  digger: { label: "Diggers", color: "#dda365", icon: Shovel, description: "Respond to crowding and carry soil outside." },
  soldier: { label: "Soldiers", color: "#e4ba78", icon: Shield, description: "Follow local alarms and fight invaders. Eat twice as often." },
  cleaner: { label: "Cleaners", color: "#88bcb7", icon: Waves, description: "Carry refuse and water out of the nest." },
};
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export default function Game() {
  const [colony, setColony] = useState(() => createColony());
  const [speed, setSpeed] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [tool, setTool] = useState<Tool>("observe");
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState(0);
  const [signals, setSignals] = useState(true);
  const [help, setHelp] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const ended = colony.result !== "alive";
  useEffect(() => {
    if (!speed || help || confirmReset || ended) return;
    // Fixed physical timesteps at every speed. Visual snapshots update at 10 Hz; ants interpolate between physical steps.
    const timer = setInterval(() => setColony(previous => {
      let next = previous;
      for (let i = 0; i < speed * 2; i++) next = step(next);
      return next;
    }), DT * 2000);
    return () => clearInterval(timer);
  }, [speed, help, confirmReset, ended]);
  const population = counts(colony);
  const allAnts = [...colony.ants, ...colony.rival.ants];
  const ant = allAnts.find(a => a.id === selected) ?? colony.ants[0];
  const wet = rainy(colony);
  const food = storedFood(colony);
  const batch = batchStatus(colony);
  const problem = batchProblem(colony);
  const toolInfo: Record<Tool, { label: string; icon: typeof Eye; hint: string }> = {
    observe: { label: "Observe", icon: Eye, hint: "Select an ant to follow its work." },
    hand: { label: "Hand", icon: Hand, hint: colony.held ? "Holding an object. Tap the forest floor to place it, or put it back." : "Pick up a food patch or stone, then tap the forest floor to move it." },
    stone: { label: "Stone", icon: Mountain, hint: "Place a stone on the forest floor. Tap again to lift it. An entrance stone blocks both colonies." },
    strike: { label: "Strike", icon: Zap, hint: "Strike ants within a small area. Your workers can be caught in the strike too." },
    food: { label: "Food", icon: Leaf, hint: "Tap the forest floor to add 60 seeds, or a food store to add up to 30 food." },
    water: { label: "Water", icon: Waves, hint: "Wash surface trails away, or flood / drain a chamber. Washing near the entrance sends runoff into your nest." },
    passage: { label: "Passages", icon: Shovel, hint: "Tap a passage to block it with rubble. Tap again to reopen it." },
  };
  const clearings = [
    { key: "entrance", label: "Your entrance", point: { x: 450, y: 175 } },
    { key: "border", label: "Between colonies", point: { x: 650, y: 145 } },
    { key: "left-floor", label: "Left clearing", point: { x: 300, y: 145 } },
    { key: "rival-entrance", label: "Rival entrance", point: { x: 890, y: 175 } },
  ];
  const objects = [...colony.sources.filter(f => !f.lifted && f.amount > 0).map(f => ({ key: `patch-${f.id}`, label: `Food patch ${f.id} · ${f.amount} seeds`, point: f })), ...colony.stones.filter(o => !o.lifted).map(o => ({ key: `stone-${o.id}`, label: `Stone ${o.id}`, point: o }))];
  const targets: { key: string; label: string; point: Point }[] = tool === "hand" ? colony.held ? clearings : objects
    : tool === "stone" ? [...clearings, ...objects.filter(o => o.key.startsWith("stone"))]
    : tool === "strike" ? colony.rival.ants.map(a => ({ key: `enemy-${a.id}`, label: `Rival ${a.role} #${a.id}${a.zone === "nest" ? " · in your nest" : ""}`, point: a }))
    : tool === "food" ? [
    { key: "left", label: "Left clearing", point: { x: 300, y: 150 } },
    { key: "right", label: "Right clearing", point: { x: 650, y: 150 } },
    ...colony.nest.filter(n => n.room === "food").map(n => ({ key: `food-${n.id}`, label: `Food store ${n.id}`, point: n })),
  ] : tool === "water" ? [...clearings, ...colony.nest.filter(n => n.room !== "tunnel").map(n => ({ key: `room-${n.id}`, label: `${n.room === "queen" ? "Queen’s chamber" : n.room === "nursery" ? "Nursery" : "Food store"} ${n.id}`, point: n }))]
    : tool === "passage" ? colony.nest.filter(n => n.parent !== null && !n.excavation).map(n => ({ key: `passage-${n.id}`, label: `${n.blocked ? "Blocked: " : ""}${n.room === "tunnel" ? "Tunnel" : n.room === "queen" ? "Queen passage" : n.room === "nursery" ? "Nursery passage" : "Store passage"} ${n.id}`, point: tunnelPoint(colony.nest.find(p => p.id === n.parent)!, n, n.id, .5) })) : [];
  const selectedTarget = targets.find(t => t.key === target) ?? targets[0];
  const applyTool = (point: Point) => setColony(s => intervene(s, tool, point));
  const selectTool = (next: Tool) => { setTool(next); setTarget(""); setZoom(false); setColony(s => ({ ...releaseHeld(s), notice: null })); };
  const reset = () => { setColony(createColony()); setZoom(false); setTool("observe"); setTarget(""); setSpeed(0); setSelected(0); setConfirmReset(false); setHelp(true); };
  const followNext = () => {
    const peers = allAnts.filter(a => a.role === ant?.role && a.team === ant?.team);
    const index = peers.findIndex(a => a.id === selected);
    const next = peers[(index + 1) % peers.length];
    if (next) setSelected(next.id);
  };
  const carrying = colony.ants.filter(a => a.cargo).length;

  return <div className={styles.game}><div inert={help || ended || confirmReset}>
    <header className={styles.header}>
      <div className={styles.brand}><Link href="/" aria-label="Back to homepage"><ArrowLeft size={17}/></Link><Bug size={27}/><h1>FORMICARIUM</h1><span>COLONY GUARDIAN</span></div>
      <div className={styles.headerActions}><button onClick={() => setHelp(true)} aria-label="How to play"><HelpCircle size={18}/></button><button onClick={() => setConfirmReset(true)} aria-label="Restart colony"><RotateCcw size={17}/></button></div>
    </header>
    <section className={styles.status} aria-label="Colony status">
      <div><span>POPULATION</span><strong>{colony.ants.length}<small> ants</small></strong><em>{carrying} carrying a load</em><div className={styles.statMeter} aria-hidden="true">{ROLES.map(role => <i key={role} style={{ width: `${population[role] / Math.max(1, colony.ants.length) * 100}%`, background: roleInfo[role].color }}/>)}</div></div>
      <div><span>STORED FOOD</span><strong>{Math.floor(food)}<small> seeds</small></strong><em>{colony.totals.delivered} carried into storage</em></div>
      <div><span>DEVELOPING BROOD</span><strong>{colony.brood.length}<small> larvae & eggs</small></strong><em>{colony.totals.hatched} hatched with nurse care</em></div>
      <div><span>QUEEN HEALTH</span><strong className={colony.queenHealth < 50 ? styles.danger : ""}>{Math.ceil(colony.queenHealth)}<small>%</small></strong><em>{wet ? "Rain is entering the nest" : colony.queenHunger > .8 ? "Hungry: nurses need to bring food" : "Healthy"}</em></div>
    </section>
    <div className={styles.layout}>
      <section className={styles.observation} aria-label="Live ant colony">
        <div className={styles.worldHeader}><div><span className={styles.live}/><span>FOREST FLOOR / NEST CUTAWAY</span></div><span>{wet ? "RAIN" : "CLEAR"}</span></div>
        <div className={styles.sandboxTools} aria-label="Sandbox tools">
          <div className={styles.toolButtons}>{(Object.keys(toolInfo) as Tool[]).map(key => {
            const Icon = toolInfo[key].icon;
            return <button key={key} aria-label={`${toolInfo[key].label} tool`} aria-pressed={tool === key} onClick={() => selectTool(key)}><Icon size={15}/>{toolInfo[key].label}</button>;
          })}</div>
          <p>{toolInfo[tool].hint}</p>
          {colony.held && <button className={styles.putBack} onClick={() => setColony(s => ({ ...releaseHeld(s), notice: { text: "Object put back where you found it.", point: null } }))}>Put back held {colony.held.kind === "food" ? "food" : "stone"}</button>}
          {tool !== "observe" && selectedTarget && <div className={styles.targetPicker}><label>Target<select aria-label="Intervention target" value={selectedTarget.key} onChange={e => setTarget(e.target.value)}>{targets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label><button onClick={() => applyTool(selectedTarget.point)}>Apply</button></div>}
        </div>
        <div className={styles.world}>
          <NestView colony={colony} selected={ant?.id ?? -1} onSelect={setSelected} zoom={zoom} signals={signals} tool={tool} onInteract={applyTool}/>
          <button className={styles.worldZoom} aria-label={zoom ? "Show whole colony" : "Follow this ant close up"} onClick={() => setZoom(!zoom)}>{zoom ? <ZoomOut size={16}/> : <ZoomIn size={16}/>}</button>
          {!speed && !help && !ended && <span className={styles.paused}>PAUSED</span>}
        </div>
        {colony.notice && <p role="status" className={styles.sandboxNotice}>{colony.notice.text}{!speed && " Simulation paused."}</p>}
        <div className={styles.worldFooter}>{ROLES.map(role => <span key={role}><i style={{ background: roleInfo[role].color }}/>{roleInfo[role].label}</span>)}<span><i style={{ background: "#ed8c98" }}/>Rivals</span><span className={styles.hint}>{tool === "observe" ? "Select an ant to follow" : "Tap the habitat to interact"}</span></div>
        <div className={styles.timebar}>
          <div><span className={styles.eyebrow}>COLONY AGE</span><strong>{clock(elapsed(colony))}</strong></div>
          <label className={styles.signalToggle}><input type="checkbox" checked={signals} onChange={e => setSignals(e.target.checked)}/><Sparkles size={14}/>Pheromones</label>
          <div className={styles.playback}><button aria-label={speed ? "Pause simulation" : "Play simulation"} disabled={ended} onClick={() => setSpeed(speed ? 0 : 1)}>{speed ? <Pause size={17}/> : <Play size={17}/>}</button>{[1, 3, 8].map(n => <button key={n} disabled={ended} aria-pressed={speed === n} onClick={() => setSpeed(n)}>{n}×</button>)}</div>
        </div>
      </section>
      <aside className={styles.sidebar}>
        <section className={`${styles.panel} ${styles.rivalPanel}`} aria-label="Rival colony">
          <div className={styles.panelTitle}><h2>Rival colony</h2><Shield size={17}/></div>
          <p className={styles.rivalStatus}>{colony.rival.ants.some(a => a.zone === "nest") ? "Invaders inside your nest" : colony.rival.ants.some(a => a.raid) ? "Raiders are following the invasion trail" : colony.rival.alert > .1 ? "A scout has recruited raiders" : colony.rival.ants.some(a => a.reportNest) ? "A scout is carrying your nest's scent home" : colony.rival.ants.length ? "Scouts are exploring" : "Rival colony defeated"}</p>
          <dl className={styles.workTotals}><div><dt>Rival ants / in your nest</dt><dd>{colony.rival.ants.length} / {colony.rival.ants.filter(a => a.zone === "nest").length}</dd></div><div><dt>Seeds stolen / rivals fallen</dt><dd>{colony.rival.stolen} / {colony.rival.defeated}</dd></div><div><dt>Your casualties</dt><dd>{colony.totals.casualties}</dd></div></dl>
          {!!colony.rival.ants.length && <button className={styles.followRival} onClick={() => { const a = colony.rival.ants.find(a => a.zone === "nest") ?? colony.rival.ants.find(a => a.reportNest) ?? colony.rival.ants[0]; setSelected(a.id); selectTool("observe"); }}>Follow a rival</button>}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>Raise a batch</h2><Sprout size={17}/></div>
          <p>Choose a caste for 12 new ants. Preparing fed brood costs 12 stored food; nurses finish their care.</p>
          <div className={styles.casteChoices}>{ROLES.map(role => {
            const { label, icon: Icon, color, description } = roleInfo[role];
            return <button key={role} aria-pressed={colony.nextRole === role} disabled={ended} onClick={() => setColony(s => ({ ...s, nextRole: role }))}>
              <div><Icon size={17} style={{ color }}/><strong>{label}</strong><span>{population[role]}</span></div><small>{description}</small>
            </button>;
          })}</div>
          <button className={styles.action} disabled={!!problem} onClick={() => setColony(s => prepareBatch(s, s.nextRole))}>{batch?.remaining ? "Batch incubating" : `Raise ${BATCH_SIZE} ${colony.nextRole}s · ${BATCH_FOOD} food`}</button>
          {batch && <div className={styles.batchProgress} aria-label="Brood batch status"><strong>{batch.hatched} / {batch.total} {batch.role}s hatched</strong><progress aria-label="Batch hatching progress" max={batch.total} value={batch.hatched}/>{batch.remaining > 0 && <><span>Nurse care: {batch.cared + batch.hatched} / {batch.total}</span><span>{batch.wet ? "Nursery flooded — cleaners or the water tool can help." : batch.seconds > 0 ? `Incubation: ${Math.ceil(batch.seconds)}s minimum remaining` : "Waiting for nurse visits or nursery space"}</span></>}{!batch.remaining && batch.hatched < batch.total && <span>Batch ended: {batch.total - batch.hatched} brood did not survive.</span>}</div>}
          <p className={styles.batchHint}>{batch?.remaining ? (!speed ? "Paused — press play to incubate." : "Nurses must visit every larva. Add nurses if care is slow.") : problem ?? `About ${BATCH_SECONDS}s with nurses. Existing ants keep their roles.`}</p>
        </section>
        <section className={styles.panel} aria-label="Ant inspector">
          <div className={styles.panelTitle}><h2>Under observation</h2><Eye size={16}/></div>
          {ant && <><label className={styles.observeRole}>Observe role<select aria-label="Observe role" value={ant.role} onChange={e => {
            const peers = colony.ants.filter(a => a.role === e.target.value); const next = peers.find(a => a.cargo) ?? peers[0]; if (next) setSelected(next.id);
          }}>{ROLES.map(role => <option key={role} value={role} disabled={!population[role]}>{roleInfo[role].label}</option>)}</select></label><div className={styles.antIdentity}><i style={{ background: ant.team === "rival" ? "#ed8c86" : roleInfo[ant.role].color }}/><strong>{ant.team === "rival" ? "Rival " : ""}{ant.role} #{ant.id}</strong><button onClick={followNext} aria-label="Follow next ant"><ChevronRight size={17}/></button></div><p className={styles.antAction}>{ant.action}</p><div className={styles.antDetails}><span>{ant.zone === "surface" ? "Forest floor" : "Inside the nest"}</span><span>{ant.cargo ? `Carrying ${ant.cargo.kind}` : "Empty mandibles"}</span><span>Health {Math.ceil(ant.health / (ant.role === "soldier" ? 3.2 : 1.2) * 100)}%</span></div></>}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>Colony work</h2><Bug size={16}/></div>
          <dl className={styles.workTotals}><div><dt>Food delivered</dt><dd>{colony.totals.delivered}</dd></div><div><dt>Meals delivered</dt><dd>{colony.totals.fed}</dd></div><div><dt>Soil carried outside</dt><dd>{colony.totals.soil}</dd></div><div><dt>Refuse removed</dt><dd>{colony.totals.waste.toFixed(1)}</dd></div><div><dt>Water removed</dt><dd>{colony.totals.water.toFixed(1)}</dd></div></dl>
        </section>
      </aside>
    </div>
    <div className={styles.bottom}>
      <section><span className={styles.eyebrow}>DEVELOPING BROOD</span><div className={styles.broodSummary}>{ROLES.map(role => <span key={role}><i style={{ background: roleInfo[role].color }}/>{colony.brood.filter(b => b.role === role).length} {roleInfo[role].label.toLowerCase()}</span>)}</div><p className={styles.broodNote}>Hatching needs food, nursery space, and visits from nurses.</p></section>
      <section className={styles.journal}><div className={styles.panelTitle}><h2>Colony journal</h2></div><div role="log" aria-live="polite" aria-relevant="additions">{colony.log.slice(0, 3).map((entry, i) => <p key={`${entry.time}-${entry.text}-${i}`}><span>{clock(entry.time)}</span>{entry.text}</p>)}</div></section>
    </div>
    </div>
    {(help || ended || confirmReset) && <div className={styles.scrim}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={e => {
      if (e.key === "Escape") { if (confirmReset) setConfirmReset(false); else if (help && !ended) setHelp(false); }
      if (e.key === "Tab") {
        const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button"); const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      {help && !ended && !confirmReset ? <><span className={styles.eyebrow}>COLONY GUARDIAN</span><h2 id="dialog-title">Help it thrive.</h2><p>Watch over a colony competing with a rival nest. Move food and stones, wash trails away, or intervene directly. Each ant still senses and works for itself.</p><ul><li><strong>Raise a batch.</strong> Prepare 12 fed brood for 12 food. They can hatch in about 12 seconds with nurse care; existing adults keep their roles.</li><li><strong>Shape their world.</strong> The hand moves food and stones. Stones obstruct both colonies; water washes both colonies’ trails away. Strikes can hit your own workers.</li><li><strong>Defend the hive.</strong> Rival scouts must find your entrance and return home before recruiting raiders. Raise soldiers to follow local alarms and protect food, brood, and the queen.</li></ul><p className={styles.note}>Pheromones show your food trails in green, rival trails in pink, and alarms in red. Soldiers need more food than workers. Select an ant to see what it is doing.</p><button className={styles.action} autoFocus onClick={() => { setHelp(false); setSpeed(1); }}>Watch over the colony <Play size={16}/></button><button className={styles.close} aria-label="Close instructions" onClick={() => setHelp(false)}><X size={20}/></button></> : confirmReset ? <><h2 id="dialog-title">Start a new colony?</h2><p>Your current colony will be lost.</p><button className={styles.action} autoFocus onClick={reset}>Start again</button><button className={styles.cancel} onClick={() => setConfirmReset(false)}>Keep playing</button></> : <><span className={styles.eyebrow}>COLONY LOST</span><h2 id="dialog-title">The nest falls silent.</h2><p>The colony lasted {clock(elapsed(colony))}. Watch food deliveries and nurse care, and choose new brood to address the shortages.</p><button className={styles.action} autoFocus onClick={reset}>Start a new colony</button></>}
    </section></div>}
  </div>;
}
