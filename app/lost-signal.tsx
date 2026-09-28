"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";
import styles from "@/app/lost-signal.module.css";

const START = 430;
const CONNECTED = 548;
const TARGET = 570;

export function LostSignal() {
	const [selected, setSelected] = useState<"left" | "right" | null>(null);
	const [connected, setConnected] = useState(false);
	const [plugX, setPlugX] = useState(START);
	const dragging = useRef(false);
	const moved = useRef(false);

	function choose(end: "left" | "right") {
		if (connected) return;
		if (selected && selected !== end) {
			setConnected(true);
			setPlugX(CONNECTED);
			setSelected(null);
		} else {
			setSelected(end);
		}
	}

	function movePlug(event: PointerEvent<HTMLButtonElement>) {
		if (!dragging.current || connected) return;
		const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
		if (!bounds) return;
		const position = ((event.clientX - bounds.left) / bounds.width) * 1000;
		const next = Math.max(START, Math.min(CONNECTED, position));
		if (Math.abs(next - START) > 4) moved.current = true;
		setPlugX(next);
	}

	function releasePlug() {
		if (!dragging.current) return;
		dragging.current = false;
		if (plugX > CONNECTED - 30) {
			setConnected(true);
			setPlugX(CONNECTED);
			setSelected(null);
		} else {
			setPlugX(START);
		}
	}

	return (
		<main id="main" className={styles.page}>
			<p className={styles.overline}>Error / 404 / No signal</p>
			<h1>Lost<br /><span>signal.</span></h1>
			<p className={styles.description}>This page seems to have slipped out of the patch.</p>
			<p className={styles.instruction} id="cable-instruction">
				{connected ? "Signal found / Route restored" : "Connect the two cable ends to find your way home."}
			</p>
			<div className={`${styles.cable} ${connected ? styles.connected : ""}`} aria-describedby="cable-instruction">
				<svg className={styles.cableArt} viewBox="0 0 1000 190" preserveAspectRatio="none" aria-hidden="true">
					<path className={styles.cableOuter} d={`M-10 90 C150 90 180 165 305 145 S385 100 ${plugX} 95`} />
					<path className={styles.cableCore} d={`M-10 90 C150 90 180 165 305 145 S385 100 ${plugX} 95`} />
					<path className={styles.cableOuter} d={`M${TARGET} 95 C690 100 690 165 810 145 S930 90 1010 90`} />
					<path className={styles.cableCore} d={`M${TARGET} 95 C690 100 690 165 810 145 S930 90 1010 90`} />
				</svg>
				<button
					type="button"
					className={`${styles.plug} ${styles.leftPlug} ${selected === "left" ? styles.selected : ""}`}
					style={{ left: `${plugX / 10}%` }}
					aria-label="Left cable end. Select, then select the right end; or drag it to the right end."
					aria-pressed={selected === "left"}
					disabled={connected}
					onClick={() => { if (!moved.current) choose("left"); moved.current = false; }}
					onPointerDown={(event) => { dragging.current = true; moved.current = false; event.currentTarget.setPointerCapture(event.pointerId); }}
					onPointerMove={movePlug}
					onPointerUp={releasePlug}
					onPointerCancel={() => { dragging.current = false; moved.current = false; setPlugX(START); }}
				>
					<span aria-hidden="true" />
				</button>
				<button
					type="button"
					className={`${styles.plug} ${styles.rightPlug} ${selected === "right" ? styles.selected : ""}`}
					style={{ left: `${TARGET / 10}%` }}
					aria-label="Right cable end. Select, then select the left end."
					aria-pressed={selected === "right"}
					disabled={connected}
					onClick={() => choose("right")}
				>
					<span aria-hidden="true" />
				</button>
			</div>
			<div className={styles.reveal} aria-live="polite">
				{connected && <Link href="/" className={styles.homeLink}>← Back to the homepage</Link>}
			</div>
		</main>
	);
}
