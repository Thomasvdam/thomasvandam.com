import { test, expect } from "bun:test";
import { pinchView } from "./gestures";

test("a moving pinch keeps its original map point under the finger midpoint", () => {
	const view = pinchView({ distance: 100, zoom: 1, x: 300, y: 200 }, { x: 100, y: 100 }, { x: 300, y: 100 });
	expect(view.zoom).toBe(2);
	expect(view.x).toBe(600);
	expect(view.y).toBe(400);
	expect(view.centerX).toBe(200);
	expect(view.centerY).toBe(100);
});

test("pinch limits preserve the anchor and midpoint even at extreme finger distances", () => {
	const start = { distance: 100, zoom: 1, x: 300, y: 200 };
	const small = pinchView(start, { x: 100, y: 100 }, { x: 101, y: 100 });
	expect(small.zoom).toBe(.5);
	expect(small.x / small.zoom).toBe(start.x);
	const large = pinchView(start, { x: -1000, y: 100 }, { x: 1000, y: 100 });
	expect(large.zoom).toBe(2.5);
	expect(large.x / large.zoom).toBe(start.x);
	expect(large.centerX).toBe(0);
});
