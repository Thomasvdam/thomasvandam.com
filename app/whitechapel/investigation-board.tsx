"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Download, FileUp, RotateCcw, Search, ZoomIn, ZoomOut } from "lucide-react";
import map from "./map-data.json";
import { type Case, type Kind, type Observation, kinds, newCase, officers, parseCase, validLocation, visibleEvents } from "./model";
import styles from "./investigation.module.css";

const storageKey = "whitechapel-case-v1";
const locations = new Map(map.locations.map(location => [location.number, location]));

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function restoreCase() {
	try {
		const saved = localStorage.getItem(storageKey);
		return { data: saved ? parseCase(saved) : newCase(), status: "Saved on this device" };
	} catch {
		return { data: newCase(), status: "Device storage unavailable or saved case unreadable. Export your case to keep it." };
	}
}

export function InvestigationBoard() {
	const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
	return hydrated ? <Casebook /> : <div className={styles.desk}><p role="status">Opening case…</p></div>;
}

function Casebook() {
	const [initial] = useState(restoreCase);
	const [caseFile, setCaseFile] = useState<Case>(initial.data);
	const ready = true;
	const [status, setStatus] = useState(initial.status);
	const latest = [...initial.data.events].sort((a, b) => b.night - a.night || b.turn - a.turn)[0];
	const [night, setNight] = useState(latest?.night ?? 1);
	const [turn, setTurn] = useState(latest?.turn ?? 0);
	const [allNights, setAllNights] = useState(false);
	const [selected, setSelected] = useState<number | null>(null);
	const [locationInput, setLocationInput] = useState("");
	const [kind, setKind] = useState<Kind>("crime");
	const [officer, setOfficer] = useState(officers[0]);
	const [text, setText] = useState("");
	const [zoom, setZoom] = useState(1);
	const [history, setHistory] = useState<Case[]>([]);
	const [confirmReset, setConfirmReset] = useState(false);
	const [pendingImport, setPendingImport] = useState<Case | null>(null);
	const [error, setError] = useState("");
	const fileInput = useRef<HTMLInputElement>(null);
	const board = useRef<HTMLDivElement>(null);

	function save(next: Case, remember = true) {
		if (remember) setHistory(previous => [...previous.slice(-29), caseFile]);
		setCaseFile(next);
		try { localStorage.setItem(storageKey, JSON.stringify(next)); setStatus("Saved on this device"); }
		catch { setStatus("Device storage unavailable. Export your case to keep it."); }
	}
	function updateText(field: "name" | "notes", value: string) {
		setHistory(previous => previous.map(snapshot => ({ ...snapshot, [field]: value })));
		save({ ...caseFile, [field]: value }, false);
	}
	function chooseLocation(number: number, focus = false) {
		setSelected(number); setLocationInput(String(number)); setError("");
		if (focus) board.current?.querySelector(`[data-location="${number}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
	}
	function addObservation(event: React.FormEvent) {
		event.preventDefault();
		const location = locationInput.trim() ? Number(locationInput) : null;
		if ((location !== null && !validLocation(location)) || (location === null && kind !== "note" && kind !== "escape")) {
			setError("Choose a location from 1 to 195."); return;
		}
		if (kind === "note" && !text.trim()) { setError("Write an observation before adding it."); return; }
		if (caseFile.events.length >= 5000) { setError("This case has reached 5,000 observations. Export it and start a new case."); return; }
		const observation: Observation = { id: crypto.randomUUID(), night, turn, kind, location, officer, text: text.trim() };
		save({ ...caseFile, events: [...caseFile.events, observation] });
		if (location !== null) setSelected(location);
		setText(""); setError("");
	}
	function markHideout(status: "suspect" | "ruled" | null) {
		if (selected === null) return;
		const suspicions = { ...caseFile.suspicions };
		if (status) suspicions[selected] = status; else delete suspicions[selected];
		save({ ...caseFile, suspicions });
	}
	function exportCase() {
		const blob = new Blob([JSON.stringify(caseFile, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a"); anchor.href = url; anchor.download = "whitechapel-case.json"; anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	async function importCase(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0]; event.target.value = "";
		if (!file) return;
		try {
			if (file.size > 2000000) throw new Error("Choose a case file smaller than 2 MB.");
			setPendingImport(parseCase(await file.text())); setError("");
		} catch (error) { setError(error instanceof Error ? error.message : "Could not open this case."); }
	}
	const visible = visibleEvents(caseFile.events, night, turn, allNights);
	const evidence = new Map<number, Observation[]>();
	for (const event of visible) {
		if (event.location !== null) evidence.set(event.location, [...(evidence.get(event.location) ?? []), event]);
	}
	const selectedEvidence = selected === null ? [] : visible.filter(event => event.location === selected);
	const suspects = Object.entries(caseFile.suspicions).filter(([, status]) => status === "suspect");
	const nightEvents = caseFile.events.filter(event => event.night === night);

	return (
		<div className={styles.desk}>
			<header className={styles.header}>
				<div><Link href="/#experiments" className={styles.back}><ArrowLeft size={14} /> Experiments</Link><p className={styles.eyebrow}>Letters from Whitechapel / Investigator’s companion</p><h1>THE CASEBOOK<span>.</span></h1><p className={styles.subtitle}>Keep the evidence. Follow the thread.</p></div>
				<div className={styles.fileTools}><p role="status">{status}</p><div><button onClick={exportCase} disabled={!ready}><Download size={15} /> Export case</button><button onClick={() => fileInput.current?.click()} disabled={!ready}><FileUp size={15} /> Import</button><button onClick={() => setConfirmReset(true)} disabled={!ready}>New case</button></div><input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import case file" hidden onChange={importCase} /></div>
			</header>
			{confirmReset && <div className={styles.notice}><p>Start a new case? Export this investigation first if you want a separate copy. You can also undo this action.</p><button onClick={() => { save(newCase()); setNight(1); setTurn(0); setSelected(null); setLocationInput(""); setText(""); setConfirmReset(false); }}>Start new case</button><button onClick={() => setConfirmReset(false)}>Cancel</button></div>}
			{pendingImport && <div className={styles.notice}><p>Replace the current investigation with “{pendingImport.name}” ({pendingImport.events.length} observations)?</p><button onClick={() => { save(pendingImport); setNight(1); setTurn(0); setSelected(null); setLocationInput(""); setText(""); setPendingImport(null); }}>Import this case</button><button onClick={() => setPendingImport(null)}>Cancel</button></div>}
			{error && <p className={styles.error} role="alert">{error}</p>}
			<div className={styles.caseTitle}><label htmlFor="case-name">Case file</label><input id="case-name" value={caseFile.name} maxLength={120} disabled={!ready} onChange={event => updateText("name", event.target.value)} /><span>{caseFile.events.length} observations · {suspects.length} suspected hideouts</span></div>
			<section className={styles.timebar} aria-label="Investigation timeline">
				<div className={styles.nights}>{[1, 2, 3, 4].map(value => <button key={value} aria-pressed={night === value} onClick={() => { setNight(value); setTurn(Math.max(0, ...caseFile.events.filter(event => event.night === value).map(event => event.turn))); }}><span>Night</span> 0{value}<i>{caseFile.events.filter(event => event.night === value).length}</i></button>)}</div>
				<div className={styles.turnControl}><button aria-label="Previous turn" disabled={turn === 0} onClick={() => setTurn(turn - 1)}><ArrowLeft size={16} /></button><label htmlFor="turn">Turn <strong>{String(turn).padStart(2, "0")}</strong></label><button aria-label="Next turn" disabled={turn === 30} onClick={() => setTurn(turn + 1)}><ArrowRight size={16} /></button><input id="turn" aria-label="Review turn" type="range" min={0} max={30} value={turn} onChange={event => setTurn(Number(event.target.value))} /><small>{turn === 0 ? "Crime / before the hunt" : "Evidence known by this turn"}</small></div>
			</section>
			<div className={styles.workspace}>
				<section className={styles.mapPanel} aria-labelledby="map-heading">
					<div className={styles.mapToolbar}><div><h2 id="map-heading">WHITECHAPEL</h2><p>Night {night} · through turn {turn}</p></div><div className={styles.zoom}><button aria-label="Zoom out" onClick={() => setZoom(Math.max(.75, zoom - .25))} disabled={zoom <= .75}><ZoomOut size={17} /></button><button onClick={() => { setZoom(1); board.current?.scrollTo(0, 0); }}>{Math.round(zoom * 100)}%</button><button aria-label="Zoom in" onClick={() => setZoom(Math.min(2.5, zoom + .25))} disabled={zoom >= 2.5}><ZoomIn size={17} /></button></div></div>
					<div className={styles.mapFilters}><label><input type="checkbox" checked={allNights} onChange={event => setAllNights(event.target.checked)} /> Include previous nights</label><form onSubmit={event => { event.preventDefault(); const number = Number(locationInput); if (validLocation(number)) chooseLocation(number, true); else setError("Choose a location from 1 to 195."); }}><input aria-label="Find location" placeholder="Location #" type="number" min={1} max={195} value={locationInput} onChange={event => { setLocationInput(event.target.value); const number = Number(event.target.value); setSelected(validLocation(number) ? number : null); }} /><button aria-label="Find location on map"><Search size={16} /></button></form></div>
					<div className={styles.board} ref={board} tabIndex={0} aria-label="Scrollable map. Select a numbered location to annotate it.">
						<svg viewBox="0 0 1600 1110" style={{ width: `${zoom * 100}%`, minWidth: `${1100 * zoom}px` }} aria-label="Schematic map of 195 numbered locations">
							<g className={styles.roads}>{map.roads.map(([from, to]) => { const a = locations.get(from)!; const b = locations.get(to)!; return <line key={`${from}-${to}`} x1={a.x} y1={a.y + 20} x2={b.x} y2={b.y + 20} />; })}</g>
							{map.locations.map(location => {
								const events = evidence.get(location.number) ?? [];
								const last = [...events].reverse().find(event => event.kind !== "note" && event.kind !== "escape");
								const suspicion = caseFile.suspicions[location.number];
								return <g key={location.number} data-location={location.number} transform={`translate(${location.x},${location.y + 20})`} className={`${styles.location} ${last ? styles[last.kind] : ""} ${suspicion ? styles[suspicion] : ""} ${selected === location.number ? styles.selected : ""}`} role="button" tabIndex={0} aria-label={`Location ${location.number}${last ? `, ${kinds[last.kind].label}, night ${last.night} turn ${last.turn}` : ""}${suspicion ? `, ${suspicion === "suspect" ? "suspected hideout" : "ruled out by investigators"}` : ""}`} aria-pressed={selected === location.number} onClick={() => chooseLocation(location.number)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseLocation(location.number); } }}><title>{String(location.number) + events.map(event => `\nN${event.night} T${event.turn}: ${kinds[event.kind].label}${event.text ? ` — ${event.text}` : ""}`).join("")}</title><circle r={16} /><text textAnchor="middle" dy=".35em">{location.number}</text>{last && <text className={styles.marker} x={13} y={-13}>{kinds[last.kind].symbol}</text>}{events.some(event => event.kind === "crime") && last?.kind !== "crime" && <path className={styles.crimeDot} d="M-21,-8 l5,-5 l5,5 l-5,5 Z" />}</g>;
							})}
						</svg>
					</div>
					<div className={styles.legend}>{(["crime", "clue", "clear", "miss"] as const).map(value => <span key={value}><i className={styles[value]}>{kinds[value].symbol}</i>{kinds[value].label}</span>)}<span><i className={styles.suspect}>□</i>Suspected hideout</span><span><i className={styles.ruled}>/</i>Ruled out</span></div>
					<p className={styles.mapNote}>Revised-edition schematic · 195 locations. Lines show road connections between numbered locations; use your physical board for crossings and alleys. The map shows the latest search result; select a location for its full evidence. Hideout marks are your theories and appear at every turn.</p>
				</section>
				<aside className={styles.sidebar}>
					<section className={styles.entryPanel} aria-labelledby="entry-heading"><p className={styles.eyebrow}>01 / Add to the record</p><h2 id="entry-heading">{selected === null ? "An observation" : `Location ${selected}`}</h2><p className={styles.context}>Night {night}, turn {turn}. Click the map or enter a number.</p>
						<form onSubmit={addObservation}>
							<label htmlFor="event-kind">What happened?</label><select id="event-kind" value={kind} onChange={event => setKind(event.target.value as Kind)}>{Object.entries(kinds).map(([value, detail]) => <option key={value} value={value}>{detail.label}</option>)}</select><p className={styles.help}>{kinds[kind].help}</p>
							<div className={styles.formRow}><div><label htmlFor="event-location">Location {(kind === "note" || kind === "escape") && "(optional)"}</label><input id="event-location" type="number" min={1} max={195} value={locationInput} onChange={event => { setLocationInput(event.target.value); const number = Number(event.target.value); setSelected(validLocation(number) ? number : null); }} /></div><div><label htmlFor="officer">Investigator</label><select id="officer" value={officer} onChange={event => setOfficer(event.target.value)}>{officers.map(value => <option key={value}>{value}</option>)}</select></div></div>
							<label htmlFor="event-note">Details / theory</label><textarea id="event-note" placeholder="What did you learn?" value={text} maxLength={2000} rows={3} onChange={event => setText(event.target.value)} /><button className={styles.primary} disabled={!ready} type="submit">+ Record observation</button>
						</form>
						<div className={styles.hideout}><h3>Hideout theory</h3><p>{selected === null ? "Select a location to mark a hunch." : "Your assessment, carried across all four nights."}</p><div><button disabled={selected === null || !ready} aria-pressed={selected !== null && caseFile.suspicions[selected] === "suspect"} onClick={() => markHideout("suspect")}>Suspect</button><button disabled={selected === null || !ready} aria-pressed={selected !== null && caseFile.suspicions[selected] === "ruled"} onClick={() => markHideout("ruled")}>Rule out</button><button disabled={selected === null || !ready || !caseFile.suspicions[selected]} onClick={() => markHideout(null)}>Clear</button></div></div>
						{selected !== null && <div className={styles.locationEvidence}><h3>Evidence at {selected}</h3>{selectedEvidence.length ? selectedEvidence.map(event => <p key={event.id}><strong>N{event.night} / T{event.turn} · {kinds[event.kind].label}</strong>{event.text && <span>{event.text}</span>}</p>) : <p>No observations in this view.</p>}</div>}
					</section>
				</aside>
			</div>
			<div className={styles.lower}>
				<section className={styles.log} aria-labelledby="log-heading"><div className={styles.panelHeading}><div><p className={styles.eyebrow}>02 / The paper trail</p><h2 id="log-heading">Night {night} record</h2></div><button disabled={!history.length} onClick={() => { const previous = history[history.length - 1]; setHistory(history.slice(0, -1)); save(previous, false); }}><RotateCcw size={14} /> Undo</button></div><p className={styles.context}>Showing {visible.length} observations through turn {turn}{allNights ? ", including earlier nights" : ""}. {nightEvents.filter(event => event.turn > turn).length} later this night.</p>
					{visible.length ? <ol>{[...visible].reverse().map(event => <li key={event.id}><button className={styles.logTurn} onClick={() => { setNight(event.night); setTurn(event.turn); if (event.location !== null) chooseLocation(event.location, true); }}>N{event.night}<br /><strong>{String(event.turn).padStart(2, "0")}</strong></button><div><h3><span className={`${styles.logSymbol} ${styles[event.kind]}`}>{kinds[event.kind].symbol}</span>{kinds[event.kind].label}{event.location !== null && <button className={styles.locationLink} onClick={() => chooseLocation(event.location!, true)}>#{event.location}</button>}</h3>{event.text && <p>{event.text}</p>}<small>{event.officer === "Unassigned" ? "Investigation team" : `${event.officer} investigator`}</small></div><button className={styles.delete} aria-label={`Remove ${kinds[event.kind].label} at ${event.location ?? "no location"}, night ${event.night} turn ${event.turn}`} onClick={() => save({ ...caseFile, events: caseFile.events.filter(item => item.id !== event.id) })}>×</button></li>)}</ol> : <div className={styles.empty}><Search size={26} /><h3>The trail starts here.</h3><p>Mark the crime scene at turn 0, then advance the turn as the hunt unfolds. Your observations will appear here.</p></div>}
				</section>
				<section className={styles.notesPanel} aria-labelledby="notes-heading"><p className={styles.eyebrow}>03 / Working theories</p><h2 id="notes-heading">Connect the dots.</h2><label htmlFor="case-notes">Notes across all nights</label><textarea id="case-notes" placeholder="Likely routes, police positions, special movements, patterns between nights…" rows={6} value={caseFile.notes} maxLength={20000} disabled={!ready} onChange={event => updateText("notes", event.target.value)} /><h3>Suspected hideouts</h3><div className={styles.suspectList}>{suspects.length ? suspects.map(([number]) => <button key={number} onClick={() => chooseLocation(Number(number), true)}>#{number}</button>) : <p>No hunches yet. Select a location and mark it as a suspect.</p>}</div><p className={styles.help}>A negative search applies only up to that search. A missed arrest applies only to that turn. Neither automatically rules out a hideout.</p></section>
			</div>
			<footer className={styles.footer}><span>Unofficial companion. Keep Jack’s secret information off this board.</span><span><a href="https://images-cdn.fantasyflightgames.com/filer_public/55/ff/55ff98ec-c39b-4607-9055-fadb150605dd/lfh_rules_letter_en_low_res.pdf" target="_blank" rel="noreferrer">Official rules ↗</a><a href="https://github.com/bmewing/whitechapelR" target="_blank" rel="noreferrer">Map data: Mark Ewing / MIT ↗</a></span></footer>
		</div>
	);
}
