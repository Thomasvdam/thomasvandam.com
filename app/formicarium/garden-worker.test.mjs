import { setTimeout, clearTimeout } from "node:timers";
import { URL } from "node:url";
const { Worker } = globalThis;
import { expect, test } from "bun:test";
import { createGarden } from "./garden";
import { decodeGarden, encodeGarden } from "./garden-save";

function engine() {
  const worker = new Worker(new URL("./garden.worker.ts", import.meta.url));
  let request = 0, action = 0;
  const pending = new Map();
  worker.onmessage = ({ data }) => { const waiter = pending.get(data.request); if (waiter) { clearTimeout(waiter.timer); pending.delete(data.request); waiter.resolve(data); } };
  worker.onerror = event => { for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error(event.message)); } pending.clear(); };
  const post = data => worker.postMessage(data.type === "action" ? { ...data, id: ++action } : data);
  return { post, snapshot: epoch => new Promise((resolve, reject) => { const id = ++request; const timer = setTimeout(() => { pending.delete(id); reject(new Error("Worker snapshot timed out")); }, 3000); pending.set(id, { resolve, reject, timer }); post({ type: "snapshot", epoch, request: id }); }), close: () => worker.terminate() };
}
test("a paused worker applies ordered construction commands before a save barrier", async () => {
  const runtime = engine();
  try {
    const s = createGarden(), count = s.objects.length;
    runtime.post({ type: "replace", garden: s, epoch: 1 });
    runtime.post({ type: "action", epoch: 1, action: { type: "act", tool: "bridge", points: [{ x: 800, y: 700 }] } });
    runtime.post({ type: "action", epoch: 1, action: { type: "rotate", id: s.nextObject } });
    const frame = await runtime.snapshot(1); expect(frame.action).toBe(2); const { garden } = frame;
    expect(garden.tick).toBe(0); expect(garden.objects).toHaveLength(count + 1); expect(garden.objects.at(-1).angle).toBe(Math.PI / 4);
    expect(encodeGarden(decodeGarden(encodeGarden(garden)))).toBe(encodeGarden(garden));
    // A cloned snapshot can be changed by the UI without corrupting worker state.
    garden.colonies[0].colony.nest[0].water = 99; garden.moisture[0] = 99;
    const saved = await runtime.snapshot(1); expect(saved.garden.moisture[0]).toBe(s.moisture[0]); expect(saved.garden.colonies[0].colony.nest[0].water).not.toBe(99);
  } finally { runtime.close(); }
});
test("importing a replacement rejects stale commands and pause prevents further steps", async () => {
  const runtime = engine();
  try {
    runtime.post({ type: "replace", garden: createGarden(), epoch: 1 });
    runtime.post({ type: "control", speed: 8, running: true });
    await new Promise(resolve => setTimeout(resolve, 300));
    runtime.post({ type: "control", speed: 8, running: false });
    const paused = await runtime.snapshot(1); expect(paused.garden.tick).toBeGreaterThan(0);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect((await runtime.snapshot(1)).garden.tick).toBe(paused.garden.tick);
    runtime.post({ type: "control", speed: 8, running: true });
    const replacement = createGarden(); replacement.tick = 1500;
    runtime.post({ type: "replace", garden: replacement, epoch: 2 });
    runtime.post({ type: "action", epoch: 1, action: { type: "act", tool: "fruit", points: [{ x: 800, y: 700 }] } });
    const restored = await runtime.snapshot(2); expect(encodeGarden(restored.garden)).toBe(encodeGarden(replacement));
    await new Promise(resolve => setTimeout(resolve, 150));
    expect((await runtime.snapshot(2)).garden.tick).toBe(1500);
  } finally { runtime.close(); }
});
