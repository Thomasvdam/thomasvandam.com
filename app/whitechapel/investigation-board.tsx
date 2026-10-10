"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Download, FileUp, RotateCcw, ZoomIn, ZoomOut, X } from "lucide-react";
import map from "./map-data.json";
import { type Case, type Kind, kinds, newCase, parseCase, visibleEvents } from "./model";
import { officerColors, officerPositions, type Officer } from "./positions";
import { dragChoice, HOLD_MS, MOVE_TOLERANCE, ROW_HEIGHT } from "./gestures";
import styles from "./investigation.module.css";

const storageKey = "whitechapel-case-v1";
const nodes = new Map(map.nodes.map(node => [node.id, node]));
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
type Target = { type: "location" | "crossing"; id: number };
type Menu = { target: Target; x: number; y: number; choice: number; holding: boolean };
type Action = { id: string; label: string; symbol: string };
const locationActions: Action[] = [
	{ id: "crime", label: "Crime scene", symbol: "◆" },
	{ id: "clue", label: "Clue found", symbol: "+" },
	{ id: "clear", label: "No clue", symbol: "×" },
	{ id: "miss", label: "Missed arrest", symbol: "○" },
	{ id: "suspect", label: "Suspected hideout", symbol: "□" },
	{ id: "ruled", label: "Rule out hideout", symbol: "/" },
	{ id: "erase", label: "Clear", symbol: "↺" },
];
const crossingActions: Action[] = [...officerColors.map(color => ({ id: color, label: `${color} officer`, symbol: "●" })), { id: "erase", label: "Clear", symbol: "↺" }];
function menuPosition(y: number, count: number) { const height = count * ROW_HEIGHT + 80; return Math.max(8, Math.min(window.innerHeight - height - 8, y - height / 2)); }
function actionsFor(target: Target) { return target.type === "location" ? locationActions : crossingActions; }
function restoreCase() {
	try { const saved = localStorage.getItem(storageKey); return { data: saved ? parseCase(saved) : newCase(), status: "Saved on this device" }; }
	catch { return { data: newCase(), status: "Could not open device storage. Export to keep your case." }; }
}
export function InvestigationBoard() {
	const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
	return hydrated ? <Casebook /> : <div className={styles.desk}>Opening map…</div>;
}
function Casebook() {
	const [initial] = useState(restoreCase);
	const [caseFile, setCaseFile] = useState<Case>(initial.data);
	const latest = [...initial.data.events, ...initial.data.placements].sort((a, b) => b.night - a.night || b.turn - a.turn)[0];
	const [night, setNight] = useState(latest?.night ?? 1);
	const [turn, setTurn] = useState(latest?.turn ?? 0);
	const [allNights, setAllNights] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [history, setHistory] = useState<Case[]>([]);
	const [menu, setMenu] = useState<Menu | null>(null);
	const [status, setStatus] = useState(initial.status);
	const [confirmReset, setConfirmReset] = useState(false);
	const [pendingImport, setPendingImport] = useState<Case | null>(null);
	const [officerToPlace, setOfficerToPlace] = useState<Officer | null>(null);
	const [error, setError] = useState("");
	const fileInput = useRef<HTMLInputElement>(null);
	const interactionRoot = useRef<HTMLDivElement>(null);
	const board = useRef<HTMLDivElement>(null);
	const menuElement = useRef<HTMLDivElement>(null);
	const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const gesture = useRef<{ target: Target; pointer: number; startX: number; startY: number; lastX: number; lastY: number; holding: boolean; panning: boolean; choice: number } | null>(null);

	useEffect(() => {
		const root = interactionRoot.current;
		function preventSelection(event: Event) {
			if (event.target instanceof Element && event.target.closest(`.${styles.board}, .${styles.menuLayer}`)) event.preventDefault();
		}
		root?.addEventListener("selectstart", preventSelection);
		return () => root?.removeEventListener("selectstart", preventSelection);
	}, []);
	useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);
	useEffect(() => {
		if (menu && !menu.holding) menuElement.current?.querySelector<HTMLButtonElement>("button")?.focus();
	}, [menu]); // Focus only when opening, not while dragging.

	function cancelGesture() {
		if (holdTimer.current) clearTimeout(holdTimer.current);
		holdTimer.current = null; gesture.current = null;
	}
	function closeMenu() { cancelGesture(); setMenu(null); }
	function save(next: Case, remember = true) {
		if (remember) setHistory(previous => [...previous.slice(-29), caseFile]);
		setCaseFile(next);
		try { localStorage.setItem(storageKey, JSON.stringify(next)); setStatus("Saved on this device"); }
		catch { setStatus("Storage unavailable. Export to keep your case."); }
	}
	const visible = visibleEvents(caseFile.events, night, turn, allNights);
	const evidence = new Map<number, typeof visible>();
	for (const event of visible) if (event.location !== null && event.kind !== "note" && event.kind !== "escape") evidence.set(event.location, [...(evidence.get(event.location) ?? []), event]);
	const positions = officerPositions(caseFile.placements, night, turn);

	function apply(target: Target, action: string) {
		closeMenu(); setError("");
		if (target.type === "crossing") {
			const colors = action === "erase" ? officerColors.filter(color => positions[color] === target.id) : [action as Officer];
			if (!colors.length) return;
			if (caseFile.placements.length + colors.length > 5000) { setError("Officer history is full. Export and start a new case."); return; }
			save({ ...caseFile, placements: [...caseFile.placements, ...colors.map(officer => ({ id: crypto.randomUUID(), night, turn, officer, crossing: action === "erase" ? null : target.id }))] });
			setOfficerToPlace(null); return;
		}
		const suspicions = { ...caseFile.suspicions };
		if (action === "erase") {
			delete suspicions[target.id];
			// Clear the selected night's evidence through this turn. Future and
			// other-night observations remain intact for historical review.
			save({ ...caseFile, suspicions, events: caseFile.events.filter(event => !(event.location === target.id && event.night === night && event.turn <= turn)) });
		} else if (action === "suspect" || action === "ruled") {
			suspicions[target.id] = action; save({ ...caseFile, suspicions });
		} else {
			if (caseFile.events.length >= 5000) { setError("Evidence history is full. Export and start a new case."); return; }
			// Replacing this turn's result leaves preceding turns available.
			const events = caseFile.events.filter(event => !(event.location === target.id && event.night === night && event.turn === turn && event.kind !== "note" && event.kind !== "escape"));
			save({ ...caseFile, events: [...events, { id: crypto.randomUUID(), night, turn, kind: action as Kind, location: target.id, officer: "Unassigned", text: "" }] });
		}
	}
	function openMenu(target: Target, x: number, y: number, holding = false) {
		setMenu({ target, x, y, choice: -1, holding });
	}
	function pointerDown(event: React.PointerEvent<SVGGElement>, target: Target) {
		if (!event.isPrimary || event.button !== 0) return;
		// Own the gesture before the browser can begin selection or a callout.
		event.preventDefault();
		window.getSelection()?.removeAllRanges();
		closeMenu();
		try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic events have no active pointer. */ }
		gesture.current = { target, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, holding: false, panning: false, choice: -1 };
		holdTimer.current = setTimeout(() => {
			const active = gesture.current;
			if (!active || active.panning) return;
			active.holding = true; openMenu(target, active.startX, active.startY, true);
		}, HOLD_MS);
	}
	function pointerMove(event: React.PointerEvent<SVGGElement>) {
		const active = gesture.current;
		if (!active || active.pointer !== event.pointerId) return;
		if (active.holding) {
			event.preventDefault();
			active.choice = dragChoice(active.startY, event.clientY, actionsFor(active.target).length, menuPosition(active.startY, actionsFor(active.target).length) + 80);
			setMenu(current => current ? { ...current, choice: active.choice } : null);
		} else {
			if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > MOVE_TOLERANCE) {
				active.panning = true; if (holdTimer.current) clearTimeout(holdTimer.current);
			}
			if (active.panning && board.current) { board.current.scrollLeft -= event.clientX - active.lastX; board.current.scrollTop -= event.clientY - active.lastY; }
			active.lastX = event.clientX; active.lastY = event.clientY;
		}
	}
	function pointerUp(event: React.PointerEvent<SVGGElement>) {
		const active = gesture.current;
		if (!active || active.pointer !== event.pointerId) return;
		cancelGesture();
		if (active.holding) {
			if (active.choice >= 0) apply(active.target, actionsFor(active.target)[active.choice].id);
			else setMenu(null);
		} else if (!active.panning) {
			if (officerToPlace && active.target.type === "crossing") apply(active.target, officerToPlace);
			else openMenu(active.target, event.clientX, event.clientY);
		}
	}
	function changeTime(nextNight: number, nextTurn: number) { closeMenu(); setNight(nextNight); setTurn(nextTurn); }
	function exportCase() {
		const url = URL.createObjectURL(new Blob([JSON.stringify(caseFile, null, 2)], { type: "application/json" }));
		const anchor = document.createElement("a"); anchor.href = url; anchor.download = "whitechapel-case.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	async function importCase(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0]; event.target.value = "";
		if (!file) return;
		try { if (file.size > 2000000) throw new Error("Choose a case file smaller than 2 MB."); setPendingImport(parseCase(await file.text())); setError(""); }
		catch (error) { setError(error instanceof Error ? error.message : "Could not open this case."); }
	}
	const actions = menu ? actionsFor(menu.target) : [];
	const menuLeft = menu ? Math.max(8, Math.min(window.innerWidth - 220, menu.x + 20)) : 0;
	const menuTop = menu ? menuPosition(menu.y, actions.length) : 0;

	return <div ref={interactionRoot} className={styles.desk}>
		<header className={styles.header}><Link href="/#experiments" aria-label="Back to experiments"><ArrowLeft size={18} /></Link><h1>WHITECHAPEL<span> / casebook</span></h1><details className={styles.fileTools}><summary>Case ▾</summary><div><p role="status">{status}</p><button onClick={exportCase}><Download size={15} /> Export</button><button onClick={() => fileInput.current?.click()}><FileUp size={15} /> Import</button><button onClick={() => { closeMenu(); setConfirmReset(true); }}>New case</button><a href="https://github.com/bmewing/whitechapelR">Map data credits</a></div></details><input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import case file" hidden onChange={importCase} /></header>
		{confirmReset && <div className={styles.notice}><span>Start a new case? Export first to keep a separate copy.</span><button onClick={() => { save(newCase()); changeTime(1, 0); setConfirmReset(false); setOfficerToPlace(null); }}>Start new case</button><button onClick={() => setConfirmReset(false)}>Cancel</button></div>}
		{pendingImport && <div className={styles.notice}><span>Replace this case with the imported map?</span><button onClick={() => { save(pendingImport); const last = [...pendingImport.events, ...pendingImport.placements].sort((a, b) => b.night - a.night || b.turn - a.turn)[0]; changeTime(last?.night ?? 1, last?.turn ?? 0); setPendingImport(null); }}>Import this case</button><button onClick={() => setPendingImport(null)}>Cancel</button></div>}
		{error && <p className={styles.error} role="alert">{error}</p>}
		<section className={styles.timebar} aria-label="Investigation timeline"><div className={styles.nights}>{[1, 2, 3, 4].map(value => <button key={value} aria-label={`Night ${value}`} aria-pressed={night === value} onClick={() => changeTime(value, Math.max(0, ...[...caseFile.events, ...caseFile.placements].filter(event => event.night === value).map(event => event.turn)))}>N{value}</button>)}</div><div className={styles.turnControl}><button aria-label="Previous turn" disabled={!turn} onClick={() => changeTime(night, turn - 1)}><ArrowLeft size={17} /></button><span>Turn <strong>{String(turn).padStart(2, "0")}</strong></span><button aria-label="Next turn" disabled={turn === 30} onClick={() => changeTime(night, turn + 1)}><ArrowRight size={17} /></button></div><button aria-label="Undo last map action" disabled={!history.length} onClick={() => { closeMenu(); const previous = history[history.length - 1]; setHistory(history.slice(0, -1)); save(previous, false); }}><RotateCcw size={17} /></button></section>
		<div className={styles.officerBar} aria-label="Officer placement">{officerColors.map(color => <button key={color} aria-label={`Place ${color} officer`} aria-pressed={officerToPlace === color} onClick={() => { closeMenu(); setOfficerToPlace(officerToPlace === color ? null : color); }}><i style={{ background: `var(--officer-${color.toLowerCase()})` }} />{color}<small>{positions[color] === undefined ? "+" : "✓"}</small></button>)}</div>
		<div className={styles.mapToolbar}><p>{officerToPlace ? `Tap a crossing to place the ${officerToPlace.toLowerCase()} officer.` : "Hold a node · slide ↑↓ · release to mark. Tap for options."}</p><div><button aria-label="Zoom out" disabled={zoom <= .5} onClick={() => { closeMenu(); setZoom(Math.max(.5, zoom - .25)); }}><ZoomOut size={17} /></button><button aria-label="Reset zoom" onClick={() => { closeMenu(); setZoom(1); }}>{Math.round(zoom * 100)}%</button><button aria-label="Zoom in" disabled={zoom >= 2.5} onClick={() => { closeMenu(); setZoom(Math.min(2.5, zoom + .25)); }}><ZoomIn size={17} /></button></div></div>
		<div className={styles.board} ref={board} tabIndex={0} aria-label="Scrollable Whitechapel map">
			<svg viewBox="0 0 1600 1080" style={{ width: `${1100 * zoom}px` }} aria-label="Whitechapel locations and police crossings">
				<g className={styles.roads}>{map.edges.map(([from, to]) => { const a = nodes.get(from)!; const b = nodes.get(to)!; return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />; })}</g>
				{map.nodes.map(node => {
					const target: Target = node.number === null ? { type: "crossing", id: node.id } : { type: "location", id: node.number };
					const events = node.number === null ? [] : evidence.get(node.number) ?? [];
					const last = events[events.length - 1];
					const suspicion = node.number === null ? null : caseFile.suspicions[node.number];
					const present = officerColors.filter(color => positions[color] === node.id);
					const label = node.number === null ? `Crossing ${node.id}${present.length ? `, ${present.join(" and ")} officer` : ""}` : `Location ${node.number}${last ? `, ${kinds[last.kind].label}, night ${last.night}` : ""}${suspicion ? `, ${suspicion} hideout` : ""}`;
					return <g key={node.id} data-location={node.number ?? undefined} data-crossing={node.number === null ? node.id : undefined} transform={`translate(${node.x},${node.y})`} className={`${styles.node} ${node.number === null ? styles.crossing : styles.location} ${last ? styles[last.kind] : ""} ${last && last.night < night ? styles.pastEvidence : ""} ${suspicion ? styles[suspicion] : ""} ${menu?.target.type === target.type && menu.target.id === target.id ? styles.selected : ""}`} role="button" aria-label={label} aria-haspopup="dialog" tabIndex={0} onPointerDown={event => pointerDown(event, target)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={closeMenu} onLostPointerCapture={() => { if (gesture.current) closeMenu(); }} onContextMenu={event => event.preventDefault()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(target, rect.x + rect.width / 2, rect.y + rect.height / 2); } }}>
						<title>{label}</title><circle className={styles.hitArea} r={23} /><circle className={styles.nodeDisc} r={node.number === null ? 6 : 16} />{node.number !== null && <text textAnchor="middle" dy=".35em">{node.number}</text>}{last && <text className={styles.marker} x={13} y={-13}>{kinds[last.kind].symbol}</text>}
						{present.map((color, index) => <g key={color} data-officer={color} transform={`translate(${(index - (present.length - 1) / 2) * 19},-8)`}><path d="M-9,8 L-8,-5 Q0,-12 8,-5 L9,8 Z" fill={`var(--officer-${color.toLowerCase()})`} stroke="#263b34" strokeWidth={2} /><text className={styles.officerLetter} textAnchor="middle" y={3}>{color[0]}</text></g>)}
					</g>;
				})}
			</svg>
		</div>
		<footer className={styles.footer}><label><input type="checkbox" checked={allNights} onChange={event => { closeMenu(); setAllNights(event.target.checked); }} /> Previous nights</label><input aria-label="Review turn" type="range" min={0} max={30} value={turn} onChange={event => changeTime(night, Number(event.target.value))} /><details><summary>Key</summary><div>◆ Crime · + Clue · × No clue · ○ Missed arrest · green ring Suspect · dashed ring Ruled out. Faded marks are evidence from earlier nights. Officers occupy the small crossings and carry forward until moved. Clear removes this night’s evidence through the viewed turn and the hideout mark, or officers at a crossing. Earlier and later turns can be reviewed with the slider. Undo restores a cleared mark. Schematic; check movement on the physical board.</div></details></footer>
		{menu && <div className={styles.menuLayer} onWheel={closeMenu} onPointerDown={event => { if (event.target === event.currentTarget && !menu.holding) closeMenu(); }} onKeyDown={event => { if (event.key === "Escape") closeMenu(); }}><div ref={menuElement} className={styles.actionMenu} role="dialog" aria-label={menu.target.type === "location" ? `Actions for location ${menu.target.id}` : `Actions for crossing ${menu.target.id}`} style={{ left: menuLeft, top: menuTop }}><header><strong>{menu.target.type === "location" ? `Location ${menu.target.id}` : "Police crossing"}</strong><button aria-label="Close actions" onClick={closeMenu}><X size={16} /></button></header><p aria-live="polite">{menu.holding ? menu.choice < 0 ? "Slide ↑↓ · release to apply" : actions[menu.choice].label : `Night ${night} · turn ${turn}`}</p>{actions.map((action, index) => <button key={action.id} data-action={action.id} className={menu.choice === index ? styles.activeAction : ""} aria-pressed={menu.choice === index} onClick={() => apply(menu.target, action.id)}><span style={officerColors.includes(action.id as Officer) ? { color: `var(--officer-${action.id.toLowerCase()})` } : undefined}>{action.symbol}</span>{action.label}</button>)}</div></div>}
	</div>;
}
