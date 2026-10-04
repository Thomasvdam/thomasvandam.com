type PaddleControls = {
	paddleX: () => number;
	move: (x: number) => void;
	projectX: (clientX: number, clientY: number) => number;
	press: () => void;
	release?: () => void;
};

export function bindPaddlePointer(element: HTMLDivElement, controls: PaddleControls) {
	let touch: { id: number; x: number } | undefined;
	const cancel = () => {
		const id = touch?.id; touch = undefined;
		if (id !== undefined && element.hasPointerCapture(id)) element.releasePointerCapture(id);
	};
	const pointer = (event: PointerEvent) => {
		if (!event.isPrimary || (event.type === "pointerdown" && event.button !== 0)) return;
		if (event.pointerType === "touch") {
			if (event.type === "pointerdown") {
				if (touch) return;
				touch = { id: event.pointerId, x: controls.projectX(event.clientX, event.clientY) };
			} else {
				if (!touch || touch.id !== event.pointerId || !element.hasPointerCapture(event.pointerId)) return;
				const x = controls.projectX(event.clientX, event.clientY), delta = x - touch.x;
				touch.x = x;
				// Incremental motion reverses immediately at walls and discards motion during stun.
				controls.move(controls.paddleX() + delta);
			}
		} else {
			if (touch) return;
			controls.move(controls.projectX(event.clientX, event.clientY));
		}
		event.preventDefault();
		if (event.type === "pointerdown") {
			element.setPointerCapture(event.pointerId); element.focus({ preventScroll: true }); controls.press();
		}
	};
	const end = (event: PointerEvent) => {
		const held = element.hasPointerCapture(event.pointerId);
		if (event.type === "pointerup" && event.isPrimary && held) controls.release?.();
		if (touch?.id === event.pointerId) cancel();
		else if (held && event.type !== "lostpointercapture") element.releasePointerCapture(event.pointerId);
	};
	const contextMenu = (event: Event) => event.preventDefault();
	element.addEventListener("pointerdown", pointer); element.addEventListener("pointermove", pointer);
	element.addEventListener("pointerup", end); element.addEventListener("pointercancel", end); element.addEventListener("lostpointercapture", end);
	element.addEventListener("contextmenu", contextMenu);
	return {
		cancel,
		dispose() {
			cancel();
			element.removeEventListener("pointerdown", pointer); element.removeEventListener("pointermove", pointer);
			element.removeEventListener("pointerup", end); element.removeEventListener("pointercancel", end); element.removeEventListener("lostpointercapture", end);
			element.removeEventListener("contextmenu", contextMenu);
		},
	};
}
