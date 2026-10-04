import { expect, test } from "bun:test";
import { bindPaddlePointer } from "./pointer-controls";
import { collectPower, movePaddle, newGame, step } from "./game";

function harness() {
	const game = newGame(), captures = new Set(); let presses = 0, focusOptions;
	const element = new globalThis.EventTarget();
	element.setPointerCapture = id => captures.add(id);
	element.hasPointerCapture = id => captures.has(id);
	element.releasePointerCapture = id => captures.delete(id);
	element.focus = options => { focusOptions = options; };
	const binding = bindPaddlePointer(element, { paddleX: () => game.paddleX, move: x => movePaddle(game, x), projectX: x => x / 20, press: () => { presses++; } });
	const send = (type, props = {}) => {
		const event = new globalThis.Event(type, { cancelable: true });
		Object.assign(event, { pointerType: "touch", isPrimary: true, pointerId: 1, button: 0, clientX: 40, clientY: 300, ...props });
		element.dispatchEvent(event); return event;
	};
	return { game, captures, binding, send, presses: () => presses, focus: () => focusOptions };
}

test("touch down launches without moving the paddle; dragging uses finger deltas and fresh origins", () => {
	const h = harness(); expect(h.send("pointerdown").defaultPrevented).toBe(true);
	expect(h.game.paddleX).toBe(9); expect(h.game.balls[0].x).toBe(9); expect(h.presses()).toBe(1); expect(h.focus()).toEqual({ preventScroll: true });
	h.send("pointermove", { clientX: 80 }); expect(h.game.paddleX).toBe(11); expect(h.game.balls[0].x).toBe(11);
	h.send("pointermove", { clientX: 60 }); expect(h.game.paddleX).toBe(10);
	h.send("pointerup"); expect(h.captures.size).toBe(0);
	h.send("pointerdown", { clientX: 300 }); expect(h.game.paddleX).toBe(10);
	h.send("pointermove", { clientX: 280 }); expect(h.game.paddleX).toBe(9); h.binding.dispose();
});

test("touch reverses immediately at paddle bounds and does not replay movement after a stun", () => {
	const h = harness(); h.send("pointerdown"); h.send("pointermove", { clientX: 1000 }); expect(h.game.paddleX).toBe(16.2);
	h.send("pointermove", { clientX: 980 }); expect(h.game.paddleX).toBeCloseTo(15.2);
	collectPower(h.game, "shock"); h.send("pointermove", { clientX: 900 }); expect(h.game.paddleX).toBeCloseTo(15.2);
	h.game.mode = "playing"; step(h.game, 1.01); h.send("pointermove", { clientX: 880 }); expect(h.game.paddleX).toBeCloseTo(14.2); h.binding.dispose();
});

test("secondary fingers, uncaptured movement and canceled gestures cannot steer", () => {
	const h = harness(); h.send("pointermove", { clientX: 200 }); expect(h.game.paddleX).toBe(9);
	h.send("pointerdown"); h.send("pointerdown", { pointerId: 2, isPrimary: false, clientX: 300 }); h.send("pointermove", { pointerId: 2, isPrimary: false, clientX: 400 });
	expect(h.presses()).toBe(1); expect(h.game.paddleX).toBe(9);
	h.send("pointercancel"); h.send("pointermove", { clientX: 300 }); expect(h.game.paddleX).toBe(9); expect(h.captures.size).toBe(0);
	h.send("pointerdown"); h.send("lostpointercapture"); h.send("pointermove", { clientX: 300 }); expect(h.game.paddleX).toBe(9); h.binding.dispose();
});

test("mouse and pen remain absolute; right clicks do not move or launch", () => {
	const h = harness(); h.send("pointermove", { pointerType: "mouse", clientX: 120 }); expect(h.game.paddleX).toBe(6);
	h.send("pointerdown", { pointerType: "mouse", button: 2, clientX: 200 }); expect(h.game.paddleX).toBe(6); expect(h.presses()).toBe(0);
	h.send("pointerdown", { pointerType: "pen", clientX: 200 }); expect(h.game.paddleX).toBe(10); expect(h.presses()).toBe(1); h.binding.dispose();
});

test("blur cancellation and disposal release touch capture and remove input/context-menu listeners", () => {
	const h = harness(); expect(h.send("contextmenu").defaultPrevented).toBe(true);
	h.send("pointerdown"); h.binding.cancel(); expect(h.captures.size).toBe(0);
	h.send("pointermove", { clientX: 200 }); expect(h.game.paddleX).toBe(9);
	h.send("pointerdown"); h.binding.dispose(); expect(h.captures.size).toBe(0);
	h.send("pointerdown", { clientX: 200 }); h.send("pointermove", { pointerType: "mouse", clientX: 200 }); expect(h.game.paddleX).toBe(9);
	expect(h.send("contextmenu").defaultPrevented).toBe(false);
});
