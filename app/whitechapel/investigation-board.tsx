"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Download, FileUp, RotateCcw, ZoomIn, ZoomOut, X } from "lucide-react";
import map from "./map-data.json";
import { type Case, type Kind, kinds, newCase, parseCase, visibleEvents, groupEvidence } from "./model";
import { officerColors, officerPositions, type Officer } from "./positions";
import { dragChoice, pinchView, HOLD_MS, MOVE_TOLERANCE, ROW_HEIGHT } from "./gestures";
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
	const [latest] = useState(() => [...initial.data.events, ...initial.data.placements].sort((a, b) => b.night - a.night || b.turn - a.turn)[0]);
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
	const caseMenu = useRef<HTMLDetailsElement>(null);
	const interactionRoot = useRef<HTMLDivElement>(null);
	const board = useRef<HTMLDivElement>(null);
	const zoomValue = useRef(1);
	const mapPointers = useRef(new Map<number, { x: number; y: number }>());
	const pinch = useRef<{ distance: number; zoom: number; x: number; y: number } | null>(null);
	const coast = useRef<number | null>(null);
	const velocity = useRef({ x: 0, y: 0, time: 0 });
	const menuElement = useRef<HTMLDivElement>(null);
	const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const gesture = useRef<{ target: Target | null; pointer: number; startX: number; startY: number; lastX: number; lastY: number; holding: boolean; panning: boolean; choice: number } | null>(null);

	useEffect(() => {
		const root = interactionRoot.current;
		function preventSelection(event: Event) {
			if (event.target instanceof Element && event.target.closest(`.${styles.board}, .${styles.menuLayer}`)) event.preventDefault();
		}
		root?.addEventListener("selectstart", preventSelection);
		return () => root?.removeEventListener("selectstart", preventSelection);
	}, []);
	useEffect(() => () => {
		if (holdTimer.current) clearTimeout(holdTimer.current);
		if (coast.current !== null) cancelAnimationFrame(coast.current);
	}, []);
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
	const evidence = useMemo(() => groupEvidence(visibleEvents(caseFile.events, night, turn, allNights)), [caseFile.events, night, turn, allNights]);
	const positions = useMemo(() => officerPositions(caseFile.placements, night, turn), [caseFile.placements, night, turn]);

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
	function stopCoasting() {
		if (coast.current !== null) cancelAnimationFrame(coast.current);
		coast.current = null;
	}
	function setMapZoom(value: number, x?: number, y?: number) {
		const viewport = board.current;
		const svg = viewport?.querySelector("svg");
		if (!viewport || !svg) return;
		const rect = viewport.getBoundingClientRect();
		const anchorX = x ?? rect.left + viewport.clientWidth / 2;
		const anchorY = y ?? rect.top + viewport.clientHeight / 2;
		const oldRect = svg.getBoundingClientRect();
		const ratio = Math.max(.5, Math.min(2.5, value)) / zoomValue.current;
		zoomValue.current = Math.max(.5, Math.min(2.5, value));
		svg.style.width = `${1100 * zoomValue.current}px`;
		const nextRect = svg.getBoundingClientRect();
		viewport.scrollLeft += nextRect.left + (anchorX - oldRect.left) * ratio - anchorX;
		viewport.scrollTop += nextRect.top + (anchorY - oldRect.top) * ratio - anchorY;
	}
	function zoomButton(value: number) {
		stopCoasting(); closeMenu(); setMapZoom(value); setZoom(zoomValue.current);
	}
	function beginPinch() {
		const viewport = board.current;
		const svg = viewport?.querySelector("svg");
		const [a, b] = [...mapPointers.current.values()];
		if (!svg || !a || !b) return;
		closeMenu();
		const rect = svg.getBoundingClientRect();
		pinch.current = { distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), zoom: zoomValue.current, x: ((a.x + b.x) / 2 - rect.left) / zoomValue.current, y: ((a.y + b.y) / 2 - rect.top) / zoomValue.current };
	}
	function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
		if (event.button !== 0 || (event.pointerType !== "touch" && !event.isPrimary)) return;
		event.preventDefault(); window.getSelection()?.removeAllRanges(); stopCoasting();
		mapPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
		try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic events have no active pointer. */ }
		if (mapPointers.current.size > 1) { beginPinch(); return; }
		closeMenu();
		const element = (event.target as Element).closest("[data-location], [data-crossing]");
		const target: Target | null = element?.hasAttribute("data-location") ? { type: "location", id: Number(element.getAttribute("data-location")) } : element?.hasAttribute("data-crossing") ? { type: "crossing", id: Number(element.getAttribute("data-crossing")) } : null;
		gesture.current = { target, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, holding: false, panning: false, choice: -1 };
		velocity.current = { x: 0, y: 0, time: event.timeStamp };
		if (target) holdTimer.current = setTimeout(() => {
			const active = gesture.current;
			if (!active || active.panning || mapPointers.current.size !== 1) return;
			active.holding = true; openMenu(target, active.startX, active.startY, true);
		}, HOLD_MS);
	}
	function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
		if (!mapPointers.current.has(event.pointerId)) return;
		event.preventDefault();
		mapPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
		const viewport = board.current;
		if (pinch.current && viewport) {
			const [a, b] = [...mapPointers.current.values()];
			if (!a || !b) return;
			const next = pinchView(pinch.current, a, b);
			const svg = viewport.querySelector("svg")!;
			zoomValue.current = next.zoom; svg.style.width = `${1100 * next.zoom}px`;
			const rect = svg.getBoundingClientRect();
			viewport.scrollLeft += rect.left + next.x - next.centerX;
			viewport.scrollTop += rect.top + next.y - next.centerY;
			return;
		}
		const active = gesture.current;
		if (!active || active.pointer !== event.pointerId) return;
		if (active.holding && active.target) {
			active.choice = dragChoice(active.startY, event.clientY, actionsFor(active.target).length, menuPosition(active.startY, actionsFor(active.target).length) + 80);
			setMenu(current => current ? { ...current, choice: active.choice } : null);
		} else {
			if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > MOVE_TOLERANCE) {
				active.panning = true; if (holdTimer.current) clearTimeout(holdTimer.current);
			}
			if (active.panning && viewport) {
				const dx = active.lastX - event.clientX, dy = active.lastY - event.clientY;
				viewport.scrollLeft += dx; viewport.scrollTop += dy;
				const elapsed = Math.max(1, event.timeStamp - velocity.current.time);
				velocity.current = { x: dx / elapsed, y: dy / elapsed, time: event.timeStamp };
			}
			active.lastX = event.clientX; active.lastY = event.clientY;
		}
	}
	function startCoasting(time: number) {
		if (time - velocity.current.time > 80 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		let { x, y } = velocity.current;
		x = Math.max(-3, Math.min(3, x)); y = Math.max(-3, Math.min(3, y));
		let previous = time;
		function frame(now: number) {
			const viewport = board.current;
			if (!viewport) return;
			const elapsed = Math.min(32, now - previous); previous = now;
			const left = viewport.scrollLeft, top = viewport.scrollTop;
			viewport.scrollLeft += x * elapsed; viewport.scrollTop += y * elapsed;
			const decay = Math.exp(-elapsed / 180); x *= decay; y *= decay;
			if (Math.hypot(x, y) > .02 && (viewport.scrollLeft !== left || viewport.scrollTop !== top)) coast.current = requestAnimationFrame(frame);
			else coast.current = null;
		}
		coast.current = requestAnimationFrame(frame);
	}
	function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
		if (!mapPointers.current.delete(event.pointerId)) return;
		if (pinch.current) {
			pinch.current = null; setZoom(zoomValue.current);
			if (mapPointers.current.size > 1) { beginPinch(); return; }
			const remaining = [...mapPointers.current.entries()][0];
			gesture.current = remaining ? { target: null, pointer: remaining[0], startX: remaining[1].x, startY: remaining[1].y, lastX: remaining[1].x, lastY: remaining[1].y, holding: false, panning: true, choice: -1 } : null;
			velocity.current = { x: 0, y: 0, time: event.timeStamp }; return;
		}
		const active = gesture.current;
		if (!active || active.pointer !== event.pointerId) return;
		cancelGesture();
		if (active.holding && active.target) {
			if (active.choice >= 0) apply(active.target, actionsFor(active.target)[active.choice].id);
			else setMenu(null);
		} else if (active.panning) startCoasting(event.timeStamp);
		else if (active.target) {
			if (officerToPlace && active.target.type === "crossing") apply(active.target, officerToPlace);
			else openMenu(active.target, event.clientX, event.clientY);
		}
	}
	function pointerCancel(event: React.PointerEvent<HTMLDivElement>) {
		if (!mapPointers.current.has(event.pointerId)) return;
		mapPointers.current.clear(); pinch.current = null; closeMenu(); setZoom(zoomValue.current);
	}
	function changeTime(nextNight: number, nextTurn: number) { closeMenu(); setNight(nextNight); setTurn(nextTurn); }
	function closeCaseMenu() {
		if (caseMenu.current) { caseMenu.current.open = false; caseMenu.current.querySelector("summary")?.focus(); }
	}
	function exportCase() {
		closeCaseMenu();
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

	return <div ref={interactionRoot} className={styles.desk} onPointerDownCapture={event => {
		if (board.current?.contains(event.target as Node) || (event.pointerType === "touch" && mapPointers.current.size)) pointerDown(event);
	}} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onLostPointerCapture={pointerCancel}>
		<header className={styles.header}><Link href="/#experiments" aria-label="Back to experiments"><ArrowLeft size={18} /></Link><h1>WHITECHAPEL<span> / casebook</span></h1><details ref={caseMenu} className={styles.fileTools}><summary>Case ▾</summary><div><p role="status">{status}</p><button onClick={exportCase}><Download size={15} /> Export</button><button onClick={() => { closeCaseMenu(); fileInput.current?.click(); }}><FileUp size={15} /> Import</button><button onClick={() => { closeCaseMenu(); closeMenu(); setConfirmReset(true); }}>New case</button><a href="https://github.com/bmewing/whitechapelR" onClick={closeCaseMenu}>Map data credits</a></div></details><input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import case file" hidden onChange={importCase} /></header>
		{confirmReset && <div className={styles.notice}><span>Start a new case? Export first to keep a separate copy.</span><button onClick={() => { save(newCase()); changeTime(1, 0); setConfirmReset(false); setOfficerToPlace(null); }}>Start new case</button><button onClick={() => setConfirmReset(false)}>Cancel</button></div>}
		{pendingImport && <div className={styles.notice}><span>Replace this case with the imported map?</span><button onClick={() => { save(pendingImport); const last = [...pendingImport.events, ...pendingImport.placements].sort((a, b) => b.night - a.night || b.turn - a.turn)[0]; changeTime(last?.night ?? 1, last?.turn ?? 0); setPendingImport(null); }}>Import this case</button><button onClick={() => setPendingImport(null)}>Cancel</button></div>}
		{error && <p className={styles.error} role="alert">{error}</p>}
		<section className={styles.timebar} aria-label="Investigation timeline"><div className={styles.nights}>{[1, 2, 3, 4].map(value => <button key={value} aria-label={`Night ${value}`} aria-pressed={night === value} onClick={() => changeTime(value, Math.max(0, ...[...caseFile.events, ...caseFile.placements].filter(event => event.night === value).map(event => event.turn)))}>N{value}</button>)}</div><div className={styles.turnControl}><button aria-label="Previous turn" disabled={!turn} onClick={() => changeTime(night, turn - 1)}><ArrowLeft size={17} /></button><span>Turn <strong>{String(turn).padStart(2, "0")}</strong></span><button aria-label="Next turn" disabled={turn === 30} onClick={() => changeTime(night, turn + 1)}><ArrowRight size={17} /></button></div><button aria-label="Undo last map action" disabled={!history.length} onClick={() => { closeMenu(); const previous = history[history.length - 1]; setHistory(history.slice(0, -1)); save(previous, false); }}><RotateCcw size={17} /></button></section>
		<div className={styles.officerBar} aria-label="Officer placement">{officerColors.map(color => <button key={color} aria-label={`Place ${color} officer`} aria-pressed={officerToPlace === color} onClick={() => { closeMenu(); setOfficerToPlace(officerToPlace === color ? null : color); }}><i style={{ background: `var(--officer-${color.toLowerCase()})` }} />{color}<small>{positions[color] === undefined ? "+" : "✓"}</small></button>)}</div>
		<div className={styles.mapToolbar}><p>{officerToPlace ? `Tap a crossing to place the ${officerToPlace.toLowerCase()} officer.` : "Pinch to zoom · drag to pan. Hold a node to mark."}</p><div><button aria-label="Zoom out" disabled={zoom <= .5} onClick={() => { zoomButton(zoomValue.current - .25); }}><ZoomOut size={17} /></button><button aria-label="Reset zoom" onClick={() => { zoomButton(1); }}>{Math.round(zoom * 100)}%</button><button aria-label="Zoom in" disabled={zoom >= 2.5} onClick={() => { zoomButton(zoomValue.current + .25); }}><ZoomIn size={17} /></button></div></div>
		<div className={styles.board} ref={board} tabIndex={0} aria-label="Scrollable Whitechapel map" onWheel={stopCoasting}>
			<svg viewBox="0 0 1600 1080" style={{ width: `${1100 * zoom}px` }} aria-label="Whitechapel locations and police crossings">
				<g className={styles.roads}>{map.edges.map(([from, to]) => { const a = nodes.get(from)!; const b = nodes.get(to)!; return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />; })}</g>
				{map.nodes.map(node => {
					const target: Target = node.number === null ? { type: "crossing", id: node.id } : { type: "location", id: node.number };
					const events = node.number === null ? [] : evidence.get(node.number) ?? [];
					const last = events[events.length - 1];
					const suspicion = node.number === null ? null : caseFile.suspicions[node.number];
					const present = officerColors.filter(color => positions[color] === node.id);
					const label = node.number === null ? `Crossing ${node.id}${present.length ? `, ${present.join(" and ")} officer` : ""}` : `Location ${node.number}${last ? `, ${kinds[last.kind].label}, night ${last.night}` : ""}${suspicion ? `, ${suspicion} hideout` : ""}`;
					return <g key={node.id} data-location={node.number ?? undefined} data-crossing={node.number === null ? node.id : undefined} transform={`translate(${node.x},${node.y})`} className={`${styles.node} ${node.number === null ? styles.crossing : styles.location} ${last ? styles[last.kind] : ""} ${last && last.night < night ? styles.pastEvidence : ""} ${suspicion ? styles[suspicion] : ""} ${menu?.target.type === target.type && menu.target.id === target.id ? styles.selected : ""}`} role="button" aria-label={label} aria-haspopup="dialog" tabIndex={0} onContextMenu={event => event.preventDefault()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); openMenu(target, rect.x + rect.width / 2, rect.y + rect.height / 2); } }}>
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
