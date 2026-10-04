import { advance, layTrack, newRun, phaseAt, secondsAt, type Run } from "./rhythm";
import { BeatSound } from "./sound";
import type { DebugPreview } from "./debug";
import { initialView, sameTrackView, trackView, type TrackView } from "./track-view";

const BEST_KEY = "right-on-track-best";
type Callbacks = {
	onView: (view: TrackView) => void;
	onBest: (best: number) => void;
	onMuted: (muted: boolean) => void;
	onDebugOpen: (open: boolean) => void;
	onPreviewLabel: (label: string) => void;
	onAudioUnavailable: (unavailable: boolean) => void;
	onUnavailable: (unavailable: boolean) => void;
	onLoaded: (loaded: boolean) => void;
};

// Own the mutable run, clock, audio, renderer and browser listeners for one mount.
export function createTrackController(host: HTMLDivElement, callbacks: Callbacks) {
	let run = newRun(), savedRun: Run | null = null, preview: DebugPreview | null = null;
	let origin = 0, nextSound = -4, lastPaint = 0, best = 0, muted = false;
	let view = initialView;
	let disposed = false;
	let cleanup: (() => void) | undefined;
	let contextFailed = false;
	let debugTools: typeof import("./debug") | undefined;
	let previewRequest = 0;
	const speaker = new BeatSound();
	try { const saved = Number(localStorage.getItem(BEST_KEY)); best = Number.isFinite(saved) ? Math.max(0, Math.floor(saved)) : 0; } catch { /* Best score is optional when storage is unavailable. */ }
	callbacks.onBest(best);

	function paint() {
		const current = run;
		const next = trackView(current);
		if (!sameTrackView(view, next)) { view = next; callbacks.onView(next); }
		if (!savedRun && current.score > best) {
			best = current.score; callbacks.onBest(current.score);
			try { localStorage.setItem(BEST_KEY, String(current.score)); } catch { /* Best score is optional when storage is unavailable. */ }
		}
	}
	function tick() {
		const current = run;
		const now = performance.now();
		if (current.mode === "running") {
			update((now - origin) / 1000);
			if (current.mode === "running") {
				while (secondsAt(nextSound) < current.seconds + 0.12) {
					const delay = secondsAt(nextSound) - current.seconds;
					if (delay > -0.03) speaker.schedule(current, nextSound, delay);
					nextSound += 0.5;
				}
			} else speaker.stop();
		}
		if (now - lastPaint > 32) { paint(); lastPaint = now; }
		return current;
	}
	function pause() {
		if (run.mode !== "running") return;
		update((performance.now() - origin) / 1000);
		if (run.mode === "running") run.mode = "paused";
		speaker.stop(); paint();
	}
	function update(seconds: number) {
		if (preview && debugTools) debugTools.advancePreview(run, seconds, preview.autoUntil);
		else advance(run, seconds);
	}
	function toggleDebug() {
		previewRequest++;
		if (savedRun) {
			speaker.stop(); run = savedRun; savedRun = null; preview = null;
			if (window.location.hash === "#debug") history.replaceState(history.state, "", window.location.pathname + window.location.search);
			callbacks.onDebugOpen(false); callbacks.onPreviewLabel(""); host.focus(); paint();
		} else {
			pause(); savedRun = run; callbacks.onDebugOpen(true);
		}
	}
	function previewUpgrades(level: number) {
		if (!savedRun) return;
		if (!preview) { triggerPreview("hut", level); return; }
		run.upgrades = level; run.precisionStreak = 0; run.lastUpgrade = null; run.lastHit = null; paint();
	}
	function triggerPreview(id: string, level = 0) {
		const request = ++previewRequest;
		void import("./debug").then(module => {
			if (disposed || request !== previewRequest || !savedRun || !cleanup || contextFailed) return;
			debugTools = module;
			const next = module.createDebugPreview(id);
			next.run.upgrades = level;
			speaker.stop(); preview = next; run = next.run;
			origin = performance.now() - next.run.seconds * 1000;
			nextSound = Math.ceil(phaseAt(next.run.seconds) * 2) / 2;
			callbacks.onPreviewLabel(next.label); paint();
			host.focus();
			void speaker.unlock().then(ok => { if (!disposed) { speaker.setMuted(muted); callbacks.onAudioUnavailable(!ok); } });
		}).catch(() => { if (!disposed && request === previewRequest && savedRun) callbacks.onPreviewLabel("Preview unavailable. Please try again."); });
	}
	function action() {
		if (!cleanup || contextFailed || document.hidden) return;
		const current = run;
		if (savedRun && !preview) return;
		if (preview && (current.mode === "ready" || current.mode === "crashed")) {
			triggerPreview(preview.id); return;
		}
		if (current.mode === "ready" || current.mode === "crashed") {
			speaker.stop(); run = newRun(crypto.getRandomValues(new Uint32Array(1))[0]); run.mode = "running";
			origin = performance.now(); nextSound = -4;
			void speaker.unlock().then((ok) => { if (!disposed) { speaker.setMuted(muted); callbacks.onAudioUnavailable(!ok); } });
		} else if (current.mode === "paused") {
			origin = performance.now() - current.seconds * 1000;
			nextSound = Math.ceil(phaseAt(current.seconds) * 2) / 2; current.mode = "running";
			void speaker.unlock();
		} else {
			const seconds = (performance.now() - origin) / 1000;
			if (preview && debugTools) {
				if (!debugTools.previewAcceptsInput(preview, seconds)) return;
				// Finish any approach placements before handling the first player tap.
				update(seconds);
			}
			// The count-in teaches the pulse without consuming a track piece.
			if (phaseAt(seconds) < -0.5) return;
			const upgradesBefore = current.upgrades;
			layTrack(current, seconds);
			if (current.upgrades > upgradesBefore) speaker.whistle();
			if (run.mode === "crashed") speaker.stop();
		}
		paint();
	}
	const keydown = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.code === "KeyD") {
			event.preventDefault(); if (!event.repeat) toggleDebug(); return;
		}
		const target = event.target;
		if (event.code === "Space" && !(target instanceof Element && target.closest("a, input, textarea, [data-utility]"))) {
			event.preventDefault(); if (!event.repeat) action();
		}
		if (event.code === "Escape") { if (savedRun) toggleDebug(); else pause(); }
	};
	const visibility = () => { if (document.hidden) pause(); };
	const debugFromUrl = () => { if (window.location.hash === "#debug" && !savedRun) toggleDebug(); };
	debugFromUrl();
	window.addEventListener("hashchange", debugFromUrl);
	window.addEventListener("keydown", keydown);
	window.addEventListener("blur", pause);
	document.addEventListener("visibilitychange", visibility);
	void import("./railway").then(({ createRailway }) => {
		if (disposed || !host.isConnected) return;
		cleanup = createRailway(host, tick, () => {
			contextFailed = true; pause(); callbacks.onUnavailable(true);
		}, undefined, sources => speaker.environmentFrame(sources));
		callbacks.onLoaded(!contextFailed);
	}).catch(() => { if (!disposed) callbacks.onUnavailable(true); });
	function dispose() {
		disposed = true; cleanup?.(); speaker.dispose();
		window.removeEventListener("keydown", keydown); window.removeEventListener("blur", pause);
		window.removeEventListener("hashchange", debugFromUrl);
		document.removeEventListener("visibilitychange", visibility);
	}

	function toggleSound() {
		muted = !muted; callbacks.onMuted(muted); speaker.setMuted(muted);
		if (!muted) void speaker.unlock().then(ok => { if (!disposed) callbacks.onAudioUnavailable(!ok); });
	}
	return { action, toggleSound, toggleDebug, triggerPreview, previewUpgrades, dispose };
}
