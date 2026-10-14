import { expect, test } from "bun:test";
import { bindJoystick, keyboardVector, readGamepad, stickVector } from "./controls";

test("keyboard alternatives combine without double speed and opposite directions cancel", () => {
	expect(keyboardVector(new Set(["KeyD", "ArrowRight"]))).toEqual({ x: 1, y: 0 });
	expect(keyboardVector(new Set(["KeyA", "KeyD"]))).toEqual({ x: 0, y: 0 });
	const diagonal = keyboardVector(new Set(["KeyW", "ArrowRight"])); expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1); expect(diagonal.y).toBeLessThan(0);
});

test("controller sticks use radial deadzones and preserve proportional movement", () => {
	expect(stickVector(.1, .1)).toEqual({ x: 0, y: 0 });
	expect(stickVector(.59, 0).x).toBeCloseTo(.5);
	expect(Math.hypot(...Object.values(stickVector(1, 1)))).toBeCloseTo(1);
	const pad = { connected: true, mapping: "standard", axes: [-1, 0, 0, 1], buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: index === 0 || index === 9 })) };
	const state = readGamepad(pad); expect(state.move).toEqual({ x: -1, y: 0 }); expect(state.aim).toEqual({ x: 0, y: 1 }); expect(state.confirm).toBe(true); expect(state.pause).toBe(true);
	expect(readGamepad({ ...pad, connected: false }).move.x).toBe(0); expect(readGamepad({ ...pad, mapping: "" }).connected).toBe(false); expect(readGamepad(null).connected).toBe(false);
});

function joystick(left = 0) {
	const element = new globalThis.EventTarget(), thumb = { style: {} }, captures = new Set(); let enabled = true;
	element.getBoundingClientRect = () => ({ left, top: 0, width: 100, height: 100 });
	element.setPointerCapture = id => captures.add(id); element.hasPointerCapture = id => captures.has(id); element.releasePointerCapture = id => captures.delete(id);
	const binding = bindJoystick(element, thumb, () => enabled);
	const send = (type, props = {}) => { const event = new globalThis.Event(type, { cancelable: true }); Object.assign(event, { pointerId: 1, button: 0, clientX: left + 82, clientY: 50, ...props }); element.dispatchEvent(event); return event; };
	return { binding, captures, thumb, send, disable: () => { enabled = false; } };
}

test("two virtual sticks accept independent fingers and reject unrelated pointers", () => {
	const movement = joystick(), aim = joystick(200);
	movement.send("pointerdown", { pointerId: 1 }); aim.send("pointerdown", { pointerId: 2, clientX: 250, clientY: 18 });
	expect(movement.binding.read()).toEqual({ x: 1, y: 0 }); expect(aim.binding.read()).toEqual({ x: 0, y: -1 });
	movement.send("pointermove", { pointerId: 2, clientX: 0 }); expect(movement.binding.read().x).toBe(1);
	movement.send("pointerdown", { pointerId: 3 }); expect(movement.captures.size).toBe(1);
	movement.send("pointerup"); expect(movement.binding.read()).toEqual({ x: 0, y: 0 }); expect(aim.binding.read().y).toBe(-1);
	movement.binding.dispose(); aim.binding.dispose();
});

test("cancel, lost capture, pause reset, and disposal clear stick state and capture", () => {
	for (const type of ["pointercancel", "lostpointercapture"]) {
		const stick = joystick(); stick.send("pointerdown"); stick.send(type); expect(stick.binding.active()).toBe(false); expect(stick.captures.size).toBe(0);
		stick.send("pointermove"); expect(stick.binding.read().x).toBe(0); stick.binding.dispose();
	}
	const stick = joystick(); stick.send("pointerdown"); stick.binding.reset(); expect(stick.thumb.style.transform).toBe("translate(0px, 0px)");
	stick.disable(); stick.send("pointerdown"); expect(stick.binding.active()).toBe(false);
	stick.binding.dispose(); expect(stick.send("pointerdown").defaultPrevented).toBe(false);
});
