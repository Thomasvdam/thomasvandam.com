"use client";

import { useEffect, useLayoutEffect, useRef, type PointerEvent } from "react";
import { Minus, Plus, ShipWheel, Skull } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_POINTS } from "./model";
import { angleDelta, coastStep, MAX_VELOCITY, rotateWheel, STOP_VELOCITY, type WheelMotion } from "./wheel-motion";
import styles from "./scorekeeper.module.css";

type Props = { value: number; skull: boolean; onChange: (value: number) => void };
type Drag = { pointer: number; angle: number | null; time: number; lastMovement: number; velocity: number };
const KEY_STEPS: Record<string, number> = { ArrowUp: 100, ArrowRight: 100, ArrowDown: -100, ArrowLeft: -100, PageUp: 1000, PageDown: -1000 };

export function PointsWheel({ value, skull, onChange }: Props) {
	const drag = useRef<Drag | null>(null);
	const icon = useRef<SVGSVGElement>(null);
	const motion = useRef<WheelMotion>({ rotation: 0, remainder: 0, points: value });
	const frame = useRef<number | null>(null);
	const change = useRef(onChange);
	const minimum = skull ? 0 : -MAX_POINTS;
	const Icon = skull ? Skull : ShipWheel;

	function stopMotion() {
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
	}

	function cancelGesture() {
		stopMotion();
		drag.current = null;
	}

	useLayoutEffect(() => {
		change.current = onChange;
		// A reset from outside the wheel also cancels any remaining momentum.
		if (value !== motion.current.points) {
			cancelGesture();
			motion.current = { ...motion.current, points: value, remainder: 0 };
		}
	});

	useEffect(() => {
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const stop = () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; drag.current = null; };
		window.addEventListener("blur", stop);
		document.addEventListener("visibilitychange", stop);
		reducedMotion.addEventListener("change", stop);
		return () => {
			stop();
			window.removeEventListener("blur", stop);
			document.removeEventListener("visibilitychange", stop);
			reducedMotion.removeEventListener("change", stop);
		};
	}, []);

	function rotate(degrees: number) {
		const previous = motion.current.points;
		const next = rotateWheel(motion.current, degrees, minimum);
		motion.current = next.motion;
		// Paint continuous rotation without rerendering the scoreboard on every frame.
		if (icon.current) icon.current.style.transform = `rotate(${next.motion.rotation}deg)`;
		if (next.motion.points !== previous) change.current(next.motion.points);
		return next.blocked;
	}

	function coast(velocity: number) {
		if (Math.abs(velocity) < STOP_VELOCITY || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		let previous = performance.now();
		function tick(now: number) {
			frame.current = null;
			const elapsed = Math.max(0, now - previous);
			previous = now;
			// Never catch up unseen motion after a suspended/backgrounded frame.
			if (elapsed > 250) return;
			const next = coastStep(velocity, elapsed);
			velocity = next.velocity;
			if (!rotate(next.degrees) && Math.abs(velocity) >= STOP_VELOCITY) frame.current = requestAnimationFrame(tick);
		}
		frame.current = requestAnimationFrame(tick);
	}

	function sample(event: globalThis.PointerEvent, target: HTMLDivElement) {
		const current = drag.current;
		if (!current || current.pointer !== event.pointerId) return;
		const rect = target.getBoundingClientRect();
		const x = event.clientX - rect.left - rect.width / 2;
		const y = event.clientY - rect.top - rect.height / 2;
		// There is no meaningful turning angle at the hub; re-anchor on leaving it.
		if (Math.hypot(x, y) < 16) { current.angle = null; current.velocity = 0; current.time = event.timeStamp; return; }
		const angle = Math.atan2(y, x) * 180 / Math.PI;
		if (current.angle !== null) {
			const delta = angleDelta(current.angle, angle);
			const elapsed = event.timeStamp - current.time;
			const blocked = rotate(delta);
			if (elapsed > 0) {
				const velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, delta / elapsed));
				const blend = 1 - Math.exp(-elapsed / 40);
				current.velocity = blocked ? 0 : current.velocity + (velocity - current.velocity) * blend;
			}
			if (Math.abs(delta) > 0.05) current.lastMovement = event.timeStamp;
		}
		current.angle = angle;
		current.time = event.timeStamp;
	}

	function finish(event: PointerEvent<HTMLDivElement>, spin: boolean) {
		if (drag.current?.pointer !== event.pointerId) return;
		if (spin) sample(event.nativeEvent, event.currentTarget);
		const current = drag.current;
		drag.current = null;
		if (spin && event.timeStamp - current.lastMovement < 80) coast(current.velocity);
	}

	function setPoints(points: number) {
		cancelGesture();
		const next = Math.max(minimum, Math.min(MAX_POINTS, points));
		const rotation = motion.current.rotation + ((next - motion.current.points) / 100 % 12) * 30;
		motion.current = { points: next, rotation, remainder: 0 };
		if (icon.current) icon.current.style.transform = `rotate(${rotation}deg)`;
		change.current(next);
	}

	return <div className={cn(styles.wheelControl, skull && styles.skullControl)}>
		<div className={styles.wheelRow}>
			<button type="button" className={styles.adjustPoints} aria-label="Decrease points by 100" disabled={value === minimum} onClick={() => setPoints(motion.current.points - 100)}><Minus size={20} /></button>
			<div className={styles.wheel} role="slider" tabIndex={0} aria-label={skull ? "Skull Island points" : "Turn points"} aria-valuemin={minimum} aria-valuemax={MAX_POINTS} aria-valuenow={value} aria-valuetext={`${value} points${skull ? " deducted from each other player" : ""}`} aria-describedby="wheel-hint"
				onBlur={cancelGesture}
				onPointerDown={event => {
					if (!event.isPrimary || event.button !== 0) return;
					cancelGesture();
					event.currentTarget.focus();
					event.currentTarget.setPointerCapture(event.pointerId);
					drag.current = { pointer: event.pointerId, angle: null, time: event.timeStamp, lastMovement: event.timeStamp, velocity: 0 };
					sample(event.nativeEvent, event.currentTarget);
				}}
				onPointerMove={event => {
					const samples = event.nativeEvent.getCoalescedEvents?.();
					for (const point of samples?.length ? samples : [event.nativeEvent]) sample(point, event.currentTarget);
				}}
				onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)} onLostPointerCapture={event => finish(event, false)}
				onKeyDown={event => {
					const delta = KEY_STEPS[event.key];
					if (delta !== undefined || event.key === "Home" || event.key === "End") {
						event.preventDefault();
						setPoints(event.key === "Home" ? (skull ? 0 : 100) : event.key === "End" ? MAX_POINTS : motion.current.points + delta!);
					}
				}}>
				<Icon ref={icon} aria-hidden="true" className={styles.wheelIcon} strokeWidth={1.25} />
			</div>
			<button type="button" className={styles.adjustPoints} aria-label="Increase points by 100" disabled={value === MAX_POINTS} onClick={() => setPoints(motion.current.points + 100)}><Plus size={20} /></button>
		</div>
		<output className={styles.wheelValue} aria-live="polite" aria-label="Selected points">{value.toLocaleString("en-GB")}</output>
		<span className={styles.wheelCaption}>{skull ? "FROM EACH OTHER PLAYER" : "POINTS THIS TURN"}</span>
		<p id="wheel-hint" className={styles.hint}>Turn {skull ? "the skull" : "the wheel"} or give it a spin. Buttons and arrow keys work too. 100 points per step.</p>
	</div>;
}
