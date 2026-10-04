import { expect, test } from "bun:test";
import { BreakoutSound } from "./sound";
import { collectPower, launch, newGame, step } from "./game";

function fakeAudio() {
	const nodes = [];
	function param() {
		return { value: 0, events: [], setValueAtTime(value, time) { this.events.push([value, time]); }, exponentialRampToValueAtTime(value, time) { this.events.push([value, time]); }, setTargetAtTime(value, time) { this.events.push([value, time]); } };
	}
	function node(oscillator = false) {
		const n = { gain: param(), frequency: param(), onended: null, disconnected: 0, stops: [], connect() { return this; }, disconnect() { this.disconnected++; }, start(time) { this.started = time; }, stop(time) { this.stops.push(time); } };
		if (oscillator) nodes.push(n);
		return n;
	}
	const context = { currentTime: 0, state: "suspended", destination: {}, createGain: () => node(), createOscillator: () => node(true), async resume() { this.state = "running"; }, async close() { this.state = "closed"; } };
	return { context, nodes };
}

test("sound stays silent before a gesture and failure to unlock is nonfatal", async () => {
	let created = 0;
	const sound = new BreakoutSound(() => { created++; throw new Error("No audio device"); });
	sound.play("launch"); expect(created).toBe(0); expect(await sound.unlock()).toBe(false);
	expect(() => sound.play("break")).not.toThrow(); sound.dispose(); expect(await sound.unlock()).toBe(false);
});

test("audio cues schedule finite envelopes and mute cancels active and future notes", async () => {
	const { context, nodes } = fakeAudio(), sound = new BreakoutSound(() => context);
	expect(await sound.unlock()).toBe(true); sound.play("won"); expect(nodes).toHaveLength(4);
	nodes.forEach(n => { expect(n.stops[0]).toBeGreaterThan(n.started); expect(n.stops[0] - n.started).toBeLessThan(1); });
	sound.setMuted(true); expect(nodes.every(n => n.disconnected === 1 && n.onended === null)).toBe(true);
	sound.play("paddle"); expect(nodes).toHaveLength(4);
	sound.setMuted(false); sound.play("paddle"); expect(nodes).toHaveLength(5);
	sound.silence(); expect(nodes.at(-1).disconnected).toBe(1); sound.dispose(); expect(context.state).toBe("closed");
});

test("multiball contact cues are rate-limited and audio voices stay bounded", async () => {
	const { context, nodes } = fakeAudio(), sound = new BreakoutSound(() => context); await sound.unlock();
	for (let i = 0; i < 64; i++) sound.play("break"); expect(nodes).toHaveLength(2);
	for (let i = 0; i < 100; i++) { context.currentTime += 0.1; sound.play("duplicate"); }
	expect(nodes.filter(n => n.disconnected === 0).length).toBeLessThanOrEqual(24);
	const active = nodes.filter(n => !n.disconnected); active[0].onended(); expect(active[0].disconnected).toBe(1);
	sound.dispose(); expect(nodes.every(n => n.disconnected === 1)).toBe(true);
});

test("simulation emits actual contacts, pickups and outcomes, while forecasts stay silent", () => {
	const events = [], emit = event => events.push(event), g = newGame(); launch(g, emit); expect(events).toEqual(["launch"]);
	Object.assign(g.balls[0], { x: 0.55, y: 10, vx: -10, vy: 1 }); step(g, 1 / 120, true, Math.random, emit); expect(events.at(-1)).toBe("wall");
	const brick = g.bricks[0]; Object.assign(g.balls[0], { x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 });
	step(g, 1 / 120, true, Math.random, emit); expect(events.at(-1)).toBe("hit");
	brick.hits = 1; Object.assign(g.balls[0], { x: brick.x, y: brick.y - 0.7, vx: 0, vy: 10 });
	step(g, 1 / 120, true, Math.random, emit); expect(events.at(-1)).toBe("break");
	collectPower(g, "wide", emit); Object.assign(g.balls[0], { x: g.paddleX - 2, y: 2.5, vx: 0, vy: -10 });
	step(g, 1 / 120, true, Math.random, emit); expect(events.slice(-2)).toEqual(["chip", "paddle"]);
	g.drops.push({ id: 1000, x: g.paddleX, y: 2.1, power: "top" }); step(g, 1 / 120, true, Math.random, emit); expect(events.at(-1)).toBe("top");
	const before = events.length; Object.assign(g.balls[0], { x: 0.55, y: 10, vx: -10, vy: 1 }); step(g, 1 / 120, false, Math.random, emit); expect(events).toHaveLength(before);
	g.balls[0].y = -2; step(g, 1 / 120, true, Math.random, emit); expect(events.at(-1)).toBe("life");
	launch(g, emit); g.lives = 1; g.balls[0].y = -2; step(g, 1 / 120, true, Math.random, emit); expect(events.at(-1)).toBe("lost");
	const win = newGame(); launch(win); win.bricks.forEach(b => b.hits = 0); step(win, 1 / 120, true, Math.random, emit); expect(events.at(-1)).toBe("won");
});

test("special-brick and stun cues schedule bounded voices and clean up normally", async () => {
	const { context, nodes } = fakeAudio(), sound = new BreakoutSound(() => context); await sound.unlock();
	for (const event of ["speed", "slow", "shift", "phase", "shock", "void", "sticky", "laser", "armour", "shrink", "stick", "release", "blast", "shield", "rewind"]) {
		const before = nodes.length; sound.play(event); expect(nodes.length).toBeGreaterThan(before);
		nodes.slice(before).forEach(n => { expect(n.stops[0] - n.started).toBeLessThan(0.5); expect(n.stops[0]).toBeGreaterThan(n.started); });
	}
	sound.dispose(); expect(nodes.every(n => n.disconnected === 1)).toBe(true);
});
