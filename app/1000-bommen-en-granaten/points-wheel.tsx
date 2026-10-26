"use client";

import { useRef, type PointerEvent } from "react";
import { Minus, Plus, ShipWheel, Skull } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_POINTS } from "./model";
import styles from "./scorekeeper.module.css";

type Props = { value: number; skull: boolean; onChange: (value: number) => void };
type Drag = { pointer: number; angle: number; remainder: number; value: number };
const KEY_STEPS: Record<string, number> = { ArrowUp: 100, ArrowRight: 100, ArrowDown: -100, ArrowLeft: -100, PageUp: 1000, PageDown: -1000 };

export function PointsWheel({ value, skull, onChange }: Props) {
	const drag = useRef<Drag | null>(null);
	const minimum = skull ? 0 : -MAX_POINTS;
	const clamp = (points: number) => Math.max(minimum, Math.min(MAX_POINTS, points));
	const Icon = skull ? Skull : ShipWheel;

	function angle(event: PointerEvent<HTMLDivElement>) {
		const rect = event.currentTarget.getBoundingClientRect();
		return Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2) * 180 / Math.PI;
	}

	function stop(event: PointerEvent<HTMLDivElement>) {
		if (drag.current?.pointer === event.pointerId) drag.current = null;
	}

	return <div className={cn(styles.wheelControl, skull && styles.skullControl)}>
		<div className={styles.wheelRow}>
			<button type="button" className={styles.adjustPoints} aria-label="Decrease points by 100" disabled={value === minimum} onClick={() => onChange(clamp(value - 100))}><Minus size={20} /></button>
			<div className={styles.wheel} role="slider" tabIndex={0} aria-label={skull ? "Skull Island points" : "Turn points"} aria-valuemin={minimum} aria-valuemax={MAX_POINTS} aria-valuenow={value} aria-valuetext={`${value} points${skull ? " deducted from each other player" : ""}`} aria-describedby="wheel-hint"
				onPointerDown={event => {
					if (!event.isPrimary || event.button !== 0) return;
					event.currentTarget.focus();
					event.currentTarget.setPointerCapture(event.pointerId);
					drag.current = { pointer: event.pointerId, angle: angle(event), remainder: 0, value };
				}}
				onPointerMove={event => {
					const current = drag.current;
					if (!current || current.pointer !== event.pointerId) return;
					const nextAngle = angle(event);
					current.remainder += ((nextAngle - current.angle + 540) % 360) - 180;
					current.angle = nextAngle;
					const steps = Math.trunc(current.remainder / 30);
					if (steps) {
						current.remainder -= steps * 30;
						current.value = clamp(current.value + steps * 100);
						onChange(current.value);
					}
				}}
				onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
				onKeyDown={event => {
					const delta = KEY_STEPS[event.key];
					if (delta !== undefined || event.key === "Home" || event.key === "End") {
						event.preventDefault();
						onChange(event.key === "Home" ? (skull ? 0 : 100) : event.key === "End" ? MAX_POINTS : clamp(value + delta!));
					}
				}}>
				<Icon aria-hidden="true" className={styles.wheelIcon} strokeWidth={1.25} style={{ transform: `rotate(${((value - (skull ? 400 : 100)) / 100 * 30) % 360}deg)` }} />
			</div>
			<button type="button" className={styles.adjustPoints} aria-label="Increase points by 100" disabled={value === MAX_POINTS} onClick={() => onChange(clamp(value + 100))}><Plus size={20} /></button>
		</div>
		<output className={styles.wheelValue} aria-live="polite" aria-label="Selected points">{value.toLocaleString("en-GB")}</output>
		<span className={styles.wheelCaption}>{skull ? "FROM EACH OTHER PLAYER" : "POINTS THIS TURN"}</span>
		<p id="wheel-hint" className={styles.hint}>Turn {skull ? "the skull" : "the wheel"}, use the buttons, or press the arrow keys. 100 points per step.</p>
	</div>;
}
