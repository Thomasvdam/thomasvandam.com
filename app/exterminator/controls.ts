import { clamp, limitVector, type Vector } from "./math";

export function stickVector(x: number, y: number, deadzone = .18): Vector {
	const length = Math.hypot(x, y);
	if (length <= deadzone) return { x: 0, y: 0 };
	const strength = clamp((length - deadzone) / (1 - deadzone), 0, 1);
	return { x: x / length * strength, y: y / length * strength };
}
export function keyboardVector(keys: ReadonlySet<string>): Vector {
	return limitVector({ x: Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft")), y: Number(keys.has("KeyS") || keys.has("ArrowDown")) - Number(keys.has("KeyW") || keys.has("ArrowUp")) });
}
export function readGamepad(pad: Pick<Gamepad, "axes" | "buttons" | "mapping" | "connected"> | null) {
	if (!pad?.connected || pad.mapping !== "standard") return { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, pause: false, confirm: false, previous: false, next: false, connected: false };
	const pressed = (index: number) => pad.buttons[index]?.pressed ?? false;
	return {
		move: stickVector(pad.axes[0] ?? 0, pad.axes[1] ?? 0), aim: stickVector(pad.axes[2] ?? 0, pad.axes[3] ?? 0),
		pause: pressed(9), confirm: pressed(0),
		previous: pressed(14) || pressed(12) || (pad.axes[0] ?? 0) < -.6,
		next: pressed(15) || pressed(13) || (pad.axes[0] ?? 0) > .6,
		connected: true,
	};
}

export function bindJoystick(element: HTMLElement, thumb: HTMLElement, enabled: () => boolean) {
	let pointer: number | null = null, vector: Vector = { x: 0, y: 0 };
	const update = (event: PointerEvent) => {
		const bounds = element.getBoundingClientRect(), radius = bounds.width * .32;
		const raw = limitVector({ x: (event.clientX - bounds.left - bounds.width / 2) / radius, y: (event.clientY - bounds.top - bounds.height / 2) / radius });
		vector = stickVector(raw.x, raw.y, .08);
		thumb.style.transform = `translate(${raw.x * radius}px, ${raw.y * radius}px)`;
	};
	const reset = () => {
		const captured = pointer;
		pointer = null; vector = { x: 0, y: 0 }; thumb.style.transform = "translate(0px, 0px)";
		if (captured !== null && element.hasPointerCapture(captured)) element.releasePointerCapture(captured);
	};
	const down = (event: PointerEvent) => {
		if (pointer !== null || !enabled() || event.button !== 0) return;
		event.preventDefault(); pointer = event.pointerId; element.setPointerCapture(pointer); update(event);
	};
	const move = (event: PointerEvent) => { if (event.pointerId === pointer) { event.preventDefault(); update(event); } };
	const up = (event: PointerEvent) => { if (event.pointerId === pointer) reset(); };
	element.addEventListener("pointerdown", down);
	element.addEventListener("pointermove", move);
	element.addEventListener("pointerup", up);
	element.addEventListener("pointercancel", up);
	element.addEventListener("lostpointercapture", up);
	return {
		read: () => vector, active: () => pointer !== null, reset,
		dispose: () => {
			reset(); element.removeEventListener("pointerdown", down); element.removeEventListener("pointermove", move);
			element.removeEventListener("pointerup", up); element.removeEventListener("pointercancel", up); element.removeEventListener("lostpointercapture", up);
		},
	};
}
