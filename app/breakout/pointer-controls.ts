type PaddleControls = {
	paddleX: () => number;
	move: (x: number) => void;
	projectX: (clientX: number, clientY: number) => number;
	press: () => void;
	release?: () => void;
};

export function bindPaddlePointer(element: HTMLDivElement, controls: PaddleControls) {
	let drag: { id: number; x: number } | undefined;
	const cancel = () => {
		const id = drag?.id; drag = undefined;
		if (id !== undefined && element.hasPointerCapture(id)) element.releasePointerCapture(id);
	};
	const pointer = (event: PointerEvent) => {
		if (!event.isPrimary || (event.type === "pointerdown" && event.button !== 0)) return;
		if (event.type === "pointerdown") {
			if (drag) return;
			drag = { id: event.pointerId, x: controls.projectX(event.clientX, event.clientY) };
			element.setPointerCapture(event.pointerId); element.focus({ preventScroll: true }); controls.press();
		} else {
			if (!drag || drag.id !== event.pointerId || !element.hasPointerCapture(event.pointerId)) return;
			const x = controls.projectX(event.clientX, event.clientY), delta = x - drag.x;
			drag.x = x;
			// Drag the arena with the pointer; the stationary paddle moves oppositely in world coordinates.
			controls.move(controls.paddleX() - delta);
		}
		event.preventDefault();
	};
	const end = (event: PointerEvent) => {
		if (drag?.id !== event.pointerId) return;
		if (event.type === "pointerup" && event.isPrimary && element.hasPointerCapture(event.pointerId)) controls.release?.();
		cancel();
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
