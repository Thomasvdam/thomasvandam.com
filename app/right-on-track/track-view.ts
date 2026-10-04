import { activeSignal, phaseAt, trainSpeed, type Run } from "./rhythm";
import { precisionReadout } from "./upgrades";

export const initialView = { mode: "ready" as Run["mode"], phase: -4, score: 0, speed: trainSpeed(0), switching: false, reason: "", precision: 0, feedback: "Aim for precise hits", tone: "idle", upgrades: 0 };
export type TrackView = typeof initialView;

export function trackView(run: Run): TrackView {
	const precision = precisionReadout(run);
	return { mode: run.mode, phase: Math.floor(phaseAt(run.seconds)), score: run.score, speed: trainSpeed(run.seconds), switching: activeSignal(run) !== null, reason: run.reason, precision: precision.progress, feedback: precision.feedback, tone: precision.tone, upgrades: run.upgrades };
}

export function sameTrackView(previous: TrackView, next: TrackView) {
	return previous.mode === next.mode && previous.phase === next.phase && previous.score === next.score && previous.speed === next.speed && previous.switching === next.switching && previous.reason === next.reason && previous.precision === next.precision && previous.feedback === next.feedback && previous.tone === next.tone && previous.upgrades === next.upgrades;
}
