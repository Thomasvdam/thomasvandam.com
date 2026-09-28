"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "@/app/lost-signal.module.css";

type End = "left" | "right";
type Point = { x: number; y: number };
type Ends = Record<End, Point>;

const initialEnds: Ends = { left: { x: 430, y: 95 }, right: { x: 570, y: 95 } };
const contactDistance = 38;

export function LostSignal() {
	const [ends, setEnds] = useState<Ends>(initialEnds);
	const [selected, setSelected] = useState<End | null>(null);
	const [connected, setConnected] = useState(false);
	const endsRef = useRef<Ends>(initialEnds);
	const dragging = useRef<End | null>(null);
	const moved = useRef(false);

	function touch(positions: Ends, bounds: DOMRect) {
		const distance = Math.hypot(
			((positions.left.x - positions.right.x) / 1000) * bounds.width,
			((positions.left.y - positions.right.y) / 190) * bounds.height,
		);
		if (distance > contactDistance) return false;

		const halfPlug = (14 / bounds.width) * 1000;
		const centerX = Math.max(20 + halfPlug, Math.min(980 - halfPlug, (positions.left.x + positions.right.x) / 2));
		const centerY = (positions.left.y + positions.right.y) / 2;
		const joined: Ends = {
			left: { x: centerX - halfPlug, y: centerY },
			right: { x: centerX + halfPlug, y: centerY },
		};
		endsRef.current = joined;
		setEnds(joined);
		setConnected(true);
		setSelected(null);
		dragging.current = null;
		return true;
	}

	function move(end: End, point: Point, bounds: DOMRect) {
		const next: Ends = {
			...endsRef.current,
			[end]: {
				x: Math.max(20, Math.min(980, point.x)),
				y: Math.max(23, Math.min(167, point.y)),
			},
		};
		if (touch(next, bounds)) return;
		endsRef.current = next;
		setEnds(next);
	}

	function movePointer(event: PointerEvent<HTMLButtonElement>, end: End) {
		if (dragging.current !== end || connected) return;
		const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
		if (!bounds) return;
		moved.current = true;
		move(end, {
			x: ((event.clientX - bounds.left) / bounds.width) * 1000,
			y: ((event.clientY - bounds.top) / bounds.height) * 190,
		}, bounds);
	}

	function moveKeyboard(event: KeyboardEvent<HTMLButtonElement>, end: End) {
		if (connected || !event.key.startsWith("Arrow")) return;
		const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
		if (!bounds) return;
		event.preventDefault();
		const current = endsRef.current[end];
		const stepX = (20 / bounds.width) * 1000;
		const stepY = (20 / bounds.height) * 190;
		move(end, {
			x: current.x + (event.key === "ArrowRight" ? stepX : event.key === "ArrowLeft" ? -stepX : 0),
			y: current.y + (event.key === "ArrowDown" ? stepY : event.key === "ArrowUp" ? -stepY : 0),
		}, bounds);
	}

	function choose(end: End, bounds: DOMRect | undefined) {
		if (connected || !bounds) return;
		if (selected && selected !== end) {
			const other = endsRef.current[end];
			const offset = (20 / bounds.width) * 1000;
			move(selected, { x: other.x + (selected === "left" ? -offset : offset), y: other.y }, bounds);
		} else {
			setSelected(end);
		}
	}

	const left = ends.left;
	const right = ends.right;

	return (
		<main id="main" className={styles.page}>
			<p className={styles.overline}>Error / 404 / No signal</p>
			<h1>Lost<br /><span>signal.</span></h1>
			<p className={styles.description}>This page seems to have slipped out of the patch.</p>
			<p className={styles.instruction} id="cable-instruction">
				{connected ? "Signal found / Route restored" : "Drag either cable end until they touch. Arrow keys work too."}
			</p>
			<div className={`${styles.cable} ${connected ? styles.connected : ""}`} aria-describedby="cable-instruction">
				<svg className={styles.cableArt} viewBox="0 0 1000 190" preserveAspectRatio="none" aria-hidden="true">
					<path className={styles.cableOuter} d={`M-10 90 C150 90 ${left.x - 125} ${left.y + 55} ${left.x} ${left.y}`} />
					<path className={styles.cableCore} d={`M-10 90 C150 90 ${left.x - 125} ${left.y + 55} ${left.x} ${left.y}`} />
					<path className={styles.cableOuter} d={`M${right.x} ${right.y} C${right.x + 125} ${right.y + 55} 850 90 1010 90`} />
					<path className={styles.cableCore} d={`M${right.x} ${right.y} C${right.x + 125} ${right.y + 55} 850 90 1010 90`} />
				</svg>
				{(["left", "right"] as const).map((end) => (
					<button
						key={end}
						type="button"
						className={`${styles.plug} ${end === "left" ? styles.leftPlug : styles.rightPlug} ${selected === end ? styles.selected : ""}`}
						style={{ left: `${ends[end].x / 10}%`, top: `${(ends[end].y / 190) * 100}%` }}
						aria-label={`${end === "left" ? "Left" : "Right"} cable end. Drag or use arrow keys to touch the other end. Select both ends to connect.`}
						aria-pressed={selected === end}
						disabled={connected}
						onClick={(event) => { if (!moved.current) choose(end, event.currentTarget.parentElement?.getBoundingClientRect()); moved.current = false; }}
						onKeyDown={(event) => moveKeyboard(event, end)}
						onPointerDown={(event) => { dragging.current = end; moved.current = false; event.currentTarget.setPointerCapture(event.pointerId); }}
						onPointerMove={(event) => movePointer(event, end)}
						onPointerUp={() => { dragging.current = null; }}
						onPointerCancel={() => { dragging.current = null; moved.current = false; }}
					>
						<span aria-hidden="true" />
					</button>
				))}
			</div>
			<div className={styles.reveal} aria-live="polite">
				{connected && <Link href="/" className={styles.homeLink}>← Back to the homepage</Link>}
			</div>
		</main>
	);
}
