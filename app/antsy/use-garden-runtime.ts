"use client";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Garden } from "./garden";
import { applyGardenAction, GardenAction, WorkerCommand, WorkerFrame } from "./garden-actions";
export function useGardenRuntime(initial: Garden) {
  const [garden, setGarden] = useState(initial), [error, setError] = useState(false);
  const latest = useRef(initial), worker = useRef<Worker | null>(null), epoch = useRef(0), request = useRef(0), actionId = useRef(0);
  const edits = useRef(new Map<number, GardenAction>());
  const pending = useRef(new Map<number, { resolve: (s: Garden) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  useEffect(() => {
    let engine: Worker;
    try { engine = new Worker(new URL("./garden.worker.ts", import.meta.url), { type: "module" }); }
    catch { queueMicrotask(() => setError(true)); return; }
    worker.current = engine;
    engine.onmessage = ({ data }: MessageEvent<WorkerFrame>) => {
      if (data.epoch !== epoch.current) return;
      for (const id of edits.current.keys()) if (id <= data.action) edits.current.delete(id);
      // Keep edits visible (and autosavable) while older worker frames are in flight.
      latest.current = [...edits.current.values()].reduce(applyGardenAction, data.garden);
      const next = latest.current; startTransition(() => setGarden(next));
      if (data.request !== undefined) { const wait = pending.current.get(data.request); if (wait) { clearTimeout(wait.timer); pending.current.delete(data.request); wait.resolve(data.garden); } }
    };
    engine.onerror = () => {
      engine.terminate(); worker.current = null; setError(true);
      for (const p of pending.current.values()) { clearTimeout(p.timer); p.reject(new Error("Garden worker stopped")); } pending.current.clear();
    };
    engine.postMessage({ type: "replace", garden: latest.current, epoch: epoch.current } satisfies WorkerCommand);
    const waits = pending.current;
    return () => { engine.onmessage = null; engine.onerror = null; engine.terminate(); worker.current = null; for (const p of waits.values()) { clearTimeout(p.timer); p.reject(new Error("Garden closed")); } waits.clear(); };
  }, []);
  const dispatch = useCallback((action: GardenAction) => {
    latest.current = applyGardenAction(latest.current, action); setGarden(latest.current);
    if (worker.current) { const id = ++actionId.current; edits.current.set(id, action); worker.current.postMessage({ type: "action", id, action, epoch: epoch.current } satisfies WorkerCommand); }
  }, []);
  const replace = useCallback((next: Garden) => {
    epoch.current++; edits.current.clear(); actionId.current = 0; latest.current = next; setGarden(next);
    for (const p of pending.current.values()) { clearTimeout(p.timer); p.reject(new Error("Garden replaced")); } pending.current.clear();
    worker.current?.postMessage({ type: "replace", garden: next, epoch: epoch.current } satisfies WorkerCommand);
  }, []);
  const playback = useCallback((speed: number, running: boolean) => { worker.current?.postMessage({ type: "control", speed, running } satisfies WorkerCommand); }, []);
  const snapshot = useCallback((): Promise<Garden> => {
    const engine = worker.current; if (!engine) return Promise.resolve(latest.current);
    const id = ++request.current;
    return new Promise((resolve, reject) => { const timer = setTimeout(() => { pending.current.delete(id); reject(new Error("Garden did not respond")); }, 4000); pending.current.set(id, { resolve, reject, timer }); engine.postMessage({ type: "snapshot", epoch: epoch.current, request: id } satisfies WorkerCommand); });
  }, []);
  return { garden, latest, error, dispatch, replace, playback, snapshot };
}
