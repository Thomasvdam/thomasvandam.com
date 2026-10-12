import { activeSignal, phaseAt, trainSpeed, type Run } from "./rhythm";
import type { Practice } from "./tutorial";
import { precisionReadout } from "./upgrades";

export const initialView = { mode: "ready" as Run["mode"], phase: -4, score: 0, speed: trainSpeed(0), switching: false, reason: "", precision: 0, feedback: "", tone: "idle", upgrades: 0, practiceWaiting: false };
export type TrackView = typeof initialView;

export function trackView(run: Run, practice: Practice | null = null): TrackView {
	const precision = precisionReadout(run);
	return { mode: run.mode, phase: Math.floor(phaseAt(run.seconds) + 1e-9), score: run.score, speed: trainSpeed(run.seconds), switching: activeSignal(run) !== null, reason: run.reason, precision: precision.progress, feedback: run.mode === "crashed" ? "Miss" : precision.feedback, tone: run.mode === "crashed" ? "miss" : precision.tone, upgrades: run.upgrades, practiceWaiting: practice?.waiting ?? false };
}

export function sameTrackView(previous: TrackView, next: TrackView) {
	return previous.mode === next.mode && previous.phase === next.phase && previous.score === next.score && previous.speed === next.speed && previous.switching === next.switching && previous.reason === next.reason && previous.precision === next.precision && previous.feedback === next.feedback && previous.tone === next.tone && previous.upgrades === next.upgrades && previous.practiceWaiting === next.practiceWaiting;
}
