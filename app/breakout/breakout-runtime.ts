import { launch, movePaddle, newGame, nextLevel, releaseBalls, destructible, step, type BallPower, type Game } from "./game";
import type { LevelDefinition } from "./level-format";
import { BreakoutSound } from "./sound";
import { bindPaddlePointer } from "./pointer-controls";

export type BreakoutView = {
	mode: Game["mode"];
	score: number;
	lives: number;
	level: number;
	total: number;
	bricks: number;
	balls: number;
	leftHits: number;
	rightHits: number;
	sight: number;
	top: number;
	stun: number;
	rewind: number;
	sticky: number;
	laser: number;
	shrink: number;
	armour: boolean;
	attached: number;
	queued: BallPower[];
};

export type BreakoutAction = "launch" | "pause" | "reset" | "next";

export function viewFromGame(game: Game): BreakoutView {
	let total = 0, bricks = 0;
	for (const brick of game.bricks) if (destructible(brick)) { total++; if (brick.hits > 0) bricks++; }
	let rewind = 0, attached = 0;
	for (const ball of game.balls) {
		rewind = Math.max(rewind, Math.ceil((ball.rewindUntil ?? 0) - game.time));
		if (ball.attachedOffset !== undefined) attached++;
	}
	return {
		mode: game.mode,
		score: game.score,
		lives: game.lives,
		level: game.level,
		total,
		bricks,
		balls: game.balls.length,
		leftHits: game.leftHits,
		rightHits: game.rightHits,
		sight: Math.max(0, Math.ceil(game.sightUntil - game.time)),
		top: Math.max(0, Math.ceil(game.topUntil - game.time)),
		stun: Math.max(0, game.stunUntil - game.time),
		rewind: Math.max(0, rewind),
		sticky: Math.max(0, Math.ceil(game.stickyUntil - game.time)),
		laser: Math.max(0, Math.ceil(game.laserUntil - game.time)),
		shrink: Math.max(0, Math.ceil(game.shrinkUntil - game.time)),
		armour: game.armour,
		attached,
		queued: [...game.queuedPowers],
	};
}

function sameView(left: BreakoutView, right: BreakoutView) {
	if (left.mode !== right.mode || left.score !== right.score || left.lives !== right.lives || left.level !== right.level || left.total !== right.total || left.bricks !== right.bricks || left.balls !== right.balls || left.leftHits !== right.leftHits || left.rightHits !== right.rightHits || left.sight !== right.sight || left.top !== right.top || left.stun !== right.stun || left.rewind !== right.rewind || left.sticky !== right.sticky || left.laser !== right.laser || left.shrink !== right.shrink || left.armour !== right.armour || left.attached !== right.attached || left.queued.length !== right.queued.length) return false;
	return left.queued.every((power, index) => power === right.queued[index]);
}

type RuntimeOptions = {
	host: HTMLDivElement;
	game: Game;
	customLevel?: LevelDefinition;
	onViewChange: (view: BreakoutView) => void;
	onLoaded: () => void;
	onError: (message: string) => void;
	onAudioUnavailable: (unavailable: boolean) => void;
};

export type BreakoutRuntime = {
	action: (kind: BreakoutAction) => void;
	setMuted: (muted: boolean) => void;
	dispose: () => void;
};

export function createBreakoutRuntime({ host, game, customLevel, onViewChange, onLoaded, onError, onAudioUnavailable }: RuntimeOptions): BreakoutRuntime {
	const sound = new BreakoutSound();
	let disposed = false;
	let cleanup: (() => void) | undefined;
	let currentView = viewFromGame(game);
	let action: (kind: BreakoutAction) => void = () => {};
	let gameVersion = 0;

	const paint = () => {
		const nextView = viewFromGame(game);
		if (sameView(currentView, nextView)) return;
		currentView = nextView;
		onViewChange(nextView);
	};
	const updateAudioAvailability = (enabled: boolean) => {
		if (!disposed) onAudioUnavailable(!enabled);
	};

	void import("./scene").then(({ createScene }) => {
		if (disposed) return;
		const scene = createScene(host);
		let frame = 0, previous = performance.now(), accumulated = 0, lastUI = 0;
		const keys = new Set<string>();
		action = kind => {
			if (kind === "reset") {
				sound.silence(); Object.assign(game, newGame(customLevel));
				if (!customLevel) delete game.customLevel;
				gameVersion++;
			}
			else if (kind === "next") { sound.silence(); nextLevel(game); }
			else if (kind === "launch" && game.mode === "ready") {
				const launchedVersion = gameVersion;
				launch(game);
				void sound.unlock().then(enabled => { updateAudioAvailability(enabled); if (!disposed && gameVersion === launchedVersion && game.mode === "playing") sound.play("launch"); });
			}
			else if (kind === "pause" && game.mode === "playing") { game.mode = "paused"; sound.silence(); }
			else if (kind === "pause" && game.mode === "paused") { game.mode = "playing"; void sound.unlock().then(updateAudioAvailability); }
			paint();
		};
		const pointer = bindPaddlePointer(host, {
			paddleX: () => game.paddleX,
			move: x => movePaddle(game, x),
			projectX: scene.pointerX,
			press: () => action("launch"),
			release: () => { releaseBalls(game, event => sound.play(event)); paint(); },
		});
		const down = (event: KeyboardEvent) => {
			if ((event.target as HTMLElement)?.closest("button, a") && [" ", "Enter"].includes(event.key)) return;
			const key = event.key.toLowerCase();
			if (["arrowleft", "arrowright", "a", "d", " ", "p", "escape"].includes(key)) event.preventDefault();
			keys.add(key);
			if (event.repeat) return;
			if (key === " " && !(game.mode === "playing" && game.stickyUntil > game.time)) action(game.mode === "cleared" ? "next" : game.mode === "ready" ? "launch" : "pause");
			if (key === "p" || key === "escape") action("pause");
		};
		const up = (event: KeyboardEvent) => {
			const key = event.key.toLowerCase();
			if (key === " " && keys.has(key)) { releaseBalls(game, event => sound.play(event)); paint(); }
			keys.delete(key);
		};
		const blur = () => { keys.clear(); pointer.cancel(); if (game.mode === "playing") action("pause"); };
		const visibility = () => { if (document.hidden) blur(); };
		function tick(now: number) {
			accumulated += Math.min((now - previous) / 1000, 0.05); previous = now;
			while (accumulated >= 1 / 120) {
				const direction = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
				if (game.mode === "playing" || game.mode === "ready") movePaddle(game, game.paddleX + direction * 20 / 120);
				step(game, 1 / 120, true, Math.random, event => sound.play(event)); accumulated -= 1 / 120;
			}
			scene.sync(game);
			if (now - lastUI > 100) { paint(); lastUI = now; }
			frame = requestAnimationFrame(tick);
		}
		window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
		frame = requestAnimationFrame(tick); onLoaded();
		cleanup = () => {
			cancelAnimationFrame(frame); scene.dispose();
			pointer.dispose();
			window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
		};
	}).catch(() => { if (!disposed) onError("This experiment needs WebGL. Try a browser with hardware acceleration enabled."); });

	return {
		action: kind => action(kind),
		setMuted: muted => {
			sound.setMuted(muted);
			if (!muted) void sound.unlock().then(updateAudioAvailability);
		},
		dispose: () => {
			disposed = true;
			cleanup?.();
			sound.dispose();
		},
	};
}
