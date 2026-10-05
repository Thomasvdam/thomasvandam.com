"use client";

import { useState, type PointerEvent } from "react";
import { BreakoutGame } from "./breakout-game";
import { FIELD } from "./field";
import { LEVELS } from "./levels";
import { CELLS, exportLevel, parseLevel, validateLevel, type LevelDefinition } from "./level-format";
import styles from "./level-editor.module.css";

const clone = (level: LevelDefinition): LevelDefinition => ({ ...level, pattern: [...level.pattern] });
export default function LevelEditor() {
	const [draft, setDraft] = useState(() => clone(LEVELS[0]));
	const [undo, setUndo] = useState<LevelDefinition[]>([]), [redo, setRedo] = useState<LevelDefinition[]>([]);
	const [brush, setBrush] = useState("1"), [notice, setNotice] = useState(""), [importText, setImportText] = useState("");
	const [testLevel, setTestLevel] = useState<LevelDefinition | null>(null);
	const errors = validateLevel(draft), source = errors.length ? "Fix the layout errors to export this level." : exportLevel(draft);
	const count = draft.pattern.join("").replaceAll(".", "").length;
	function replace(next: LevelDefinition) { setDraft(next); setNotice(""); }
	function update(next: LevelDefinition) {
		if (JSON.stringify(next) === JSON.stringify(draft)) return;
		setUndo([...undo.slice(-79), clone(draft)]); setRedo([]); replace(next);
	}
	function history(back: boolean) {
		const from = back ? undo : redo, next = from.at(-1);
		if (next) {
			if (back) { setUndo(undo.slice(0, -1)); setRedo([...redo, clone(draft)]); }
			else { setRedo(redo.slice(0, -1)); setUndo([...undo, clone(draft)]); }
			replace(next);
		}
	}
	function resize(rows: number, columns: number) {
		const d = draft;
		update({ ...d, columns, pattern: Array.from({ length: rows }, (_, i) => (d.pattern[i] ?? "").slice(0, columns).padEnd(columns, ".")) });
	}
	function paint(row: number, col: number) {
		const d = draft, pattern = [...d.pattern], line = pattern[row];
		if (!line || col < 0 || col >= d.columns) return;
		pattern[row] = line.slice(0, col) + brush + line.slice(col + 1); update({ ...d, pattern });
	}
	function pointer(event: PointerEvent<HTMLDivElement>) {
		if (!event.isPrimary || (event.type === "pointermove" && !event.currentTarget.hasPointerCapture(event.pointerId))) return;
		if (event.type === "pointerdown") { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }
		const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-row]");
		if (target && event.currentTarget.contains(target)) paint(Number(target.dataset.row), Number(target.dataset.col));
	}
	async function copy() {
		try { await navigator.clipboard.writeText(source); setNotice("Source copied. Paste it into the LEVELS array in app/breakout/level-data.ts."); }
		catch { setNotice("Clipboard unavailable. Select and copy the source below."); }
	}
	function download() {
		const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }));
		const link = document.createElement("a"); link.href = url; link.download = "breakout-level.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
	}
	if (testLevel) return <><div className={styles.testBar}><button onClick={() => setTestLevel(null)}>← Back to editor</button><span>Testing {testLevel.name} · draft stays in memory</span></div><BreakoutGame customLevel={testLevel} /></>;
	return <div className={styles.page}>
		<header><div><p>Breakout workshop</p><h1>Level editor</h1></div><a href="#">Back to game ↗</a></header>
		<div className={styles.layout}>
			<section className={styles.panel} aria-label="Level settings">
				<label>Start from<select defaultValue="0" onChange={e => update(clone(LEVELS[Number(e.target.value)]))}>{LEVELS.map((level, i) => <option key={i} value={i}>{level.name}</option>)}</select></label>
				<label>Name<input value={draft.name} maxLength={60} onChange={e => update({ ...draft, name: e.target.value })} /></label>
				<div className={styles.fields}>
					<label>Columns<input type="number" min={1} max={16} value={draft.columns} onChange={e => resize(draft.pattern.length, Math.max(1, Math.min(16, Math.round(Number(e.target.value)))))} /></label>
					<label>Rows<input type="number" min={1} max={20} value={draft.pattern.length} onChange={e => resize(Math.max(1, Math.min(20, Math.round(Number(e.target.value)))), draft.columns)} /></label>
					{(["width", "height", "xStep", "yStep", "top"] as const).map(key => <label key={key}>{({ width: "Brick width", height: "Brick height", xStep: "Column spacing", yStep: "Row spacing", top: "Top row height" })[key]}<input type="number" step="0.1" value={draft[key]} onChange={e => update({ ...draft, [key]: Number(e.target.value) })} /></label>)}
				</div>
				<h2>Brush</h2><div className={styles.brushes}>{Object.entries(CELLS).map(([symbol, cell]) => <button key={symbol} aria-pressed={brush === symbol} onClick={() => setBrush(symbol)}><i style={{ background: cell.color }}>{symbol}</i>{cell.label}</button>)}</div>
				<div className={styles.actions}><button disabled={!undo.length} onClick={() => history(true)}>Undo</button><button disabled={!redo.length} onClick={() => history(false)}>Redo</button><button onClick={() => update({ ...draft, pattern: draft.pattern.map(row => ".".repeat(row.length)) })}>Clear</button></div>
			</section>
			<section aria-label="Layout preview"><div className={styles.caption}><strong>{count} bricks</strong><span>Drag to paint · keyboard buttons work too</span></div>
				<div className={styles.board} role="group" aria-label="Paintable brick layout" onPointerDown={pointer} onPointerMove={pointer} onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} onPointerCancel={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}>
					{draft.pattern.flatMap((row, r) => [...row].map((symbol, col) => {
						const x = 9 + (col - (draft.columns - 1) / 2) * draft.xStep, y = draft.top - r * draft.yStep, cell = CELLS[symbol];
						return <button key={`${r}-${col}`} data-row={r} data-col={col} aria-label={`Row ${r + 1}, column ${col + 1}: ${cell.label}`} onClick={() => paint(r, col)} style={{ left: `${(x - draft.width / 2) / FIELD.width * 100}%`, top: `${(FIELD.height - y - draft.height / 2) / FIELD.height * 100}%`, width: `${draft.width / FIELD.width * 100}%`, height: `${draft.height / FIELD.height * 100}%`, background: cell.color }} className={symbol === "." ? styles.empty : undefined}>{symbol === "." ? "" : symbol}</button>;
					}))}
					<div className={styles.paddle} />
				</div>
				<button className={styles.primary} disabled={!!errors.length} onClick={() => setTestLevel(clone(draft))}>Play-test this level</button>
				{!!errors.length && <ul className={styles.errors} aria-live="polite">{errors.slice(0, 6).map((error, i) => <li key={i}>{error}</li>)}{errors.length > 6 && <li>And {errors.length - 6} more outside the brick area.</li>}</ul>}
			</section>
			<section className={styles.panel} aria-label="Level export">
				<h2>Source export</h2><p>Paste this object into the <code>LEVELS</code> array in <code>app/breakout/level-data.ts</code>. New entries automatically join the campaign.</p>
				<p>Symbols specify every brick’s strength, behavior or reward. Dots are intentional gaps. The left and right edges join around the cylinder. Set column spacing to 18 ÷ columns for an even wrap.</p>
				<div className={styles.actions}><button disabled={!!errors.length} onClick={copy}>Copy source</button><button disabled={!!errors.length} onClick={download}>Download JSON</button></div>
				<textarea className={styles.source} aria-label="Exported level source" readOnly value={source} onFocus={e => e.target.select()} />
				<p role="status">{notice || "Drafts stay in this tab’s memory. Export before leaving or reloading."}</p>
				<details><summary>Import a level</summary><textarea aria-label="Level JSON to import" value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste a downloaded JSON definition" /><button onClick={() => { try { update(parseLevel(importText)); setNotice("Level imported."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not import this level."); } }}>Load JSON</button></details>
			</section>
		</div>
	</div>;
}
