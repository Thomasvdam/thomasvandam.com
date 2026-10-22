import { expect, test } from "bun:test";
import { createFramePublisher } from "./frame-publisher";

test("HUD snapshot work stays at 10Hz at 30, 60 and 120 display Hz", () => {
	for (const fps of [30, 60, 120]) {
		let snapshots = 0; const publish = createFramePublisher(() => snapshots++);
		for (let i = 0; i < fps; i++) publish(i * 1000 / fps);
		expect(snapshots).toBe(10);
	}
});
test("mode and controller changes can publish immediately between scheduled HUD updates", () => {
	let snapshots = 0; const publish = createFramePublisher(() => snapshots++);
	publish(0); publish(5); expect(snapshots).toBe(1);
	publish(10, true); expect(snapshots).toBe(2);
	publish(109); expect(snapshots).toBe(2);
	publish(110); expect(snapshots).toBe(3);
});
