import { expect, test } from "bun:test";
import { bindPaddlePointer } from "./pointer-controls";
import { collectPower, movePaddle, newGame, step } from "./game";

function harness() {
	const game = newGame(), captures = new Set(); let presses = 0, releases = 0, focusOptions;
	const element = new globalThis.EventTarget();
	element.setPointerCapture = id => captures.add(id);
	element.hasPointerCapture = id => captures.has(id);
	element.releasePointerCapture = id => captures.delete(id);
	element.focus = options => { focusOptions = options; };
	const binding = bindPaddlePointer(element, { paddleX: () => game.paddleX, move: x => movePaddle(game, x), projectX: x => x / 20, press: () => { presses++; }, release: () => { releases++; } });
	const send = (type, props = {}) => {
		const event = new globalThis.Event(type, { cancelable: true });
		Object.assign(event, { pointerType: "touch", isPrimary: true, pointerId: 1, button: 0, clientX: 40, clientY: 300, ...props });
		element.dispatchEvent(event); return event;
	};
	return { game, captures, binding, send, presses: () => presses, releases: () => releases, focus: () => focusOptions };
}

test("touch down launches without moving the paddle; dragging uses finger deltas and fresh origins", () => {
	const h = harness(); expect(h.send("pointerdown").defaultPrevented).toBe(true);
	expect(h.game.paddleX).toBe(9); expect(h.game.balls[0].x).toBe(9); expect(h.presses()).toBe(1); expect(h.focus()).toEqual({ preventScroll: true });
	h.send("pointermove", { clientX: 80 }); expect(h.game.paddleX).toBe(7); expect(h.game.balls[0].x).toBe(7);
	h.send("pointermove", { clientX: 60 }); expect(h.game.paddleX).toBe(8);
	h.send("pointerup"); expect(h.captures.size).toBe(0);
	h.send("pointerdown", { clientX: 300 }); expect(h.game.paddleX).toBe(8);
	h.send("pointermove", { clientX: 280 }); expect(h.game.paddleX).toBe(9); h.binding.dispose();
});

test("touch wraps around the cylinder and does not replay movement after a stun", () => {
	const h = harness(); h.send("pointerdown"); h.send("pointermove", { clientX: 1000 }); expect(h.game.paddleX).toBeCloseTo(15);
	h.send("pointermove", { clientX: 980 }); expect(h.game.paddleX).toBeCloseTo(16);
	collectPower(h.game, "shock"); h.send("pointermove", { clientX: 900 }); expect(h.game.paddleX).toBeCloseTo(16);
	h.game.mode = "playing"; step(h.game, 1.01); h.send("pointermove", { clientX: 880 }); expect(h.game.paddleX).toBeCloseTo(17); h.binding.dispose();
});

test("secondary fingers, uncaptured movement and canceled gestures cannot steer", () => {
	const h = harness(); h.send("pointermove", { clientX: 200 }); expect(h.game.paddleX).toBe(9);
	h.send("pointerdown"); h.send("pointerdown", { pointerId: 2, isPrimary: false, clientX: 300 }); h.send("pointermove", { pointerId: 2, isPrimary: false, clientX: 400 });
	expect(h.presses()).toBe(1); expect(h.game.paddleX).toBe(9);
	h.send("pointercancel"); h.send("pointermove", { clientX: 300 }); expect(h.game.paddleX).toBe(9); expect(h.captures.size).toBe(0);
	h.send("pointerdown"); h.send("lostpointercapture"); h.send("pointermove", { clientX: 300 }); expect(h.game.paddleX).toBe(9); h.binding.dispose();
});

test("mouse and pen drag relative to their press; hover and right clicks do not rotate", () => {
	const h = harness(); h.send("pointermove", { pointerType: "mouse", clientX: 120 }); expect(h.game.paddleX).toBe(9);
	h.send("pointerdown", { pointerType: "mouse", button: 2, clientX: 200 }); expect(h.game.paddleX).toBe(9); expect(h.presses()).toBe(0);
	h.send("pointerdown", { pointerType: "pen", clientX: 200 }); expect(h.game.paddleX).toBe(9); expect(h.presses()).toBe(1);
	h.send("pointermove", { pointerType: "pen", clientX: 240 }); expect(h.game.paddleX).toBe(7); h.binding.dispose();
});

test("blur cancellation and disposal release touch capture and remove input/context-menu listeners", () => {
	const h = harness(); expect(h.send("contextmenu").defaultPrevented).toBe(true);
	h.send("pointerdown"); h.binding.cancel(); expect(h.captures.size).toBe(0);
	h.send("pointermove", { clientX: 200 }); expect(h.game.paddleX).toBe(9);
	h.send("pointerdown"); h.binding.dispose(); expect(h.captures.size).toBe(0);
	h.send("pointerdown", { clientX: 200 }); h.send("pointermove", { pointerType: "mouse", clientX: 200 }); expect(h.game.paddleX).toBe(9);
	expect(h.send("contextmenu").defaultPrevented).toBe(false);
});

test("mouse and finger releases trigger Sticky release exactly once; cancellations do not", () => {
	for (const pointerType of ["touch", "mouse"]) {
		const h = harness(); h.send("pointerup", { pointerType }); expect(h.releases()).toBe(0);
		h.send("pointerdown", { pointerType }); h.send("pointerup", { pointerType }); expect(h.releases()).toBe(1);
		h.send("pointerup", { pointerType }); h.send("pointercancel", { pointerType }); h.send("lostpointercapture", { pointerType }); expect(h.releases()).toBe(1); h.binding.dispose();
	}
});
