import { stepGarden, Garden } from "./garden";
import { applyGardenAction, WorkerCommand, WorkerFrame } from "./garden-actions";
const channel = self as unknown as { onmessage: (event: MessageEvent<WorkerCommand>) => void; postMessage: (frame: WorkerFrame) => void };
let garden: Garden | undefined, epoch = 0, speed = 0, running = false, lastFrame = 0, action = 0;
const publish = (request?: number) => { if (garden) { channel.postMessage({ garden, epoch, action, request }); lastFrame = performance.now(); } };
channel.onmessage = ({ data }) => {
  if (data.type === "replace") { garden = data.garden; epoch = data.epoch; action = 0; running = false; publish(); }
  else if (data.type === "control") { speed = [0, 1, 3, 8].includes(data.speed) ? data.speed : 0; running = data.running; if (!running || !speed) publish(); }
  else if (garden && data.epoch === epoch) {
    if (data.type === "action") { garden = applyGardenAction(garden, data.action); action = data.id; publish(); }
    else publish(data.request);
  }
};
// Bounded fixed steps, no elapsed-time catch-up after a pause or hidden tab.
setInterval(() => {
  if (!garden || !speed || !running) return;
  const started = performance.now();
  for (let i = 0; i < speed; i++) { garden = stepGarden(garden); if (performance.now() - started > 14) break; }
  if (performance.now() - lastFrame >= 180) publish();
}, 50);
