import { terrainAt } from "./terrain";
import { cameraFor, screenToWorld } from "./camera";
import { bindJoystick, keyboardVector, readGamepad } from "./controls";
import { chooseUpgrade, newGame, start, step, togglePause, upgradeChoices, WAVES_PER_DEPTH, xpNeeded, type Game, type Upgrade, type Vector } from "./game";
import { loadSprites, render } from "./renderer";

export type ArenaView = ReturnType<typeof viewFromGame>;
export function viewFromGame(game: Game, controller = false, selection = 0) {
	return {
		destinationDepth: Math.floor(game.wave / WAVES_PER_DEPTH) + 1, depth: game.depth, descent: game.descent > 0, terrain: terrainAt(game.terrain, game.player.x, game.player.y), undercarriage: game.undercarriage,
		mode: game.mode, health: game.player.health, wave: game.wave, enemies: game.enemies.length + game.toSpawn + game.spawns.length,
		level: game.level, xp: game.xp, xpNeeded: xpNeeded(game.level), kills: game.kills, time: Math.floor(game.time),
		choices: upgradeChoices(game), intermission: Math.ceil(game.intermission), upgrades: { ...game.upgrades }, controller, selection,
	};
}
type RuntimeOptions = {
	canvas: HTMLCanvasElement; movePad: HTMLElement; moveThumb: HTMLElement; aimPad: HTMLElement; aimThumb: HTMLElement;
	onViewChange: (view: ArenaView) => void; onLoaded: () => void; onError: (message: string) => void;
};

export function createArenaRuntime(options: RuntimeOptions) {
	const { canvas, onViewChange, onLoaded, onError } = options;
	let game = newGame(crypto.getRandomValues(new Uint32Array(1))[0]);
	let disposed = false, loaded = false, frame = 0, width = 1, height = 1, pixelRatio = 1, accumulator = 0, lastTime = 0;
	let mouse: Vector | null = null, aimSource: "mouse" | "touch" | "controller" = "mouse";
	let selection = 0, viewKey = "", controller = false, previousPad = readGamepad(null), controllerBlocked = false;
	const keys = new Set<string>();
	const playing = () => game.mode === "playing" && game.descent === 0;
	const moveStick = bindJoystick(options.movePad, options.moveThumb, playing);
	const aimStick = bindJoystick(options.aimPad, options.aimThumb, playing);
	const publish = () => {
		const view = viewFromGame(game, controller, selection), key = JSON.stringify(view);
		if (key !== viewKey) { viewKey = key; onViewChange(view); }
	};
	const clearInput = () => {
		keys.clear(); mouse = null; moveStick.reset(); aimStick.reset(); accumulator = 0; controllerBlocked = true;
	};
	const changed = () => { clearInput(); publish(); };
	const focus = () => canvas.focus({ preventScroll: true });
	const action = (name: "start" | "pause" | "restart") => {
		if (!loaded) return;
		if (name === "start") start(game);
		if (name === "pause") togglePause(game);
		if (name === "restart") { game = newGame(crypto.getRandomValues(new Uint32Array(1))[0]); start(game); selection = 0; }
		changed(); focus();
	};
	const upgrade = (id: Upgrade) => {
		if (game.mode !== "upgrade") return;
		chooseUpgrade(game, id); changed();
		if (playing()) focus();
	};
	const keydown = (event: KeyboardEvent) => {
		if (!loaded || !(canvas.parentElement?.contains(document.activeElement))) return;
		const interactive = (event.target as HTMLElement)?.closest("button, a, input, select, textarea");
		if (event.code === "Escape" || event.code === "KeyP") { event.preventDefault(); if (!event.repeat) action("pause"); return; }
		if (game.mode === "upgrade" && /^[1-5]$/.test(event.key)) {
			event.preventDefault(); const choice = upgradeChoices(game).find(choice => choice.key === event.key);
			if (!event.repeat && choice) upgrade(choice.id); return;
		}
		if (interactive) return;
		if (event.code === "Space" || event.code === "Enter") {
			event.preventDefault(); if (event.repeat) return;
			if (game.mode === "ready") action("start");
			else if (game.mode === "dead") action("restart");
			else if (game.mode !== "upgrade") action("pause");
			return;
		}
		if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
			event.preventDefault(); if (game.mode === "playing") keys.add(event.code);
		}
	};
	const keyup = (event: KeyboardEvent) => { keys.delete(event.code); };
	const pointermove = (event: PointerEvent) => {
		if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
		const bounds = canvas.getBoundingClientRect();
		mouse = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }; aimSource = "mouse";
	};
	const pointerdown = (event: PointerEvent) => {
		if (event.pointerType === "touch" || event.button !== 0) return;
		pointermove(event); focus();
	};
	const pauseForFocus = () => { if (game.mode === "playing") togglePause(game); changed(); };
	const visibility = () => { if (document.hidden) pauseForFocus(); };
	const contextmenu = (event: Event) => event.preventDefault();
	const resize = () => {
		const bounds = canvas.getBoundingClientRect(); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
		pixelRatio = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio);
	};
	const observer = new ResizeObserver(resize); observer.observe(canvas);
	window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
	window.addEventListener("blur", pauseForFocus); document.addEventListener("visibilitychange", visibility);
	canvas.addEventListener("pointermove", pointermove); canvas.addEventListener("pointerdown", pointerdown); canvas.addEventListener("contextmenu", contextmenu);
	const pollController = () => {
		let pads: (Gamepad | null)[] = [];
		try { pads = Array.from(navigator.getGamepads?.() ?? []); } catch { /* Keyboard and touch remain available. */ }
		const pad = readGamepad(pads.find(pad => pad?.connected && pad.mapping === "standard") ?? null);
		controller = pad.connected;
		if (!pad.connected && previousPad.connected && game.mode === "playing") pauseForFocus();
		if (document.hasFocus() && !document.hidden) {
			if (pad.pause && !previousPad.pause) action("pause");
			if (game.mode === "upgrade") {
				if (pad.previous && !previousPad.previous) selection = (selection + upgradeChoices(game).length - 1) % upgradeChoices(game).length;
				if (pad.next && !previousPad.next) selection = (selection + 1) % upgradeChoices(game).length;
			}
			if (pad.confirm && !previousPad.confirm) {
				if (game.mode === "upgrade") upgrade(upgradeChoices(game)[selection].id);
				else if (game.mode === "ready") action("start");
				else if (game.mode === "dead") action("restart");
				else if (game.mode === "paused") action("pause");
			}
		}
		previousPad = pad;
		// Require neutral sticks after an overlay, blur, or restart before accepting held input.
		if (controllerBlocked && !pad.move.x && !pad.move.y && !pad.aim.x && !pad.aim.y) controllerBlocked = false;
		return controllerBlocked ? { ...pad, move: { x: 0, y: 0 }, aim: { x: 0, y: 0 } } : pad;
	};
	const getInput = (pad: ReturnType<typeof readGamepad>) => {
		const move = moveStick.active() ? moveStick.read() : pad.move.x || pad.move.y ? pad.move : keyboardVector(keys);
		let aim: Vector = { x: 0, y: 0 };
		if (pad.aim.x || pad.aim.y) aimSource = "controller";
		if (aimStick.active()) aimSource = "touch";
		if (aimSource === "touch") aim = aimStick.read();
		if (aimSource === "controller") aim = pad.aim;
		if (aimSource === "mouse") {
			if (mouse) { const world = screenToWorld(mouse, cameraFor(game.player, width, height)); aim = { x: world.x - game.player.x, y: world.y - game.player.y }; }
		}
		return { move, aim, fire: true };
	};
	const ctx = canvas.getContext("2d");
	if (!ctx) onError("Your browser could not open the playfield. Try another browser.");
	else void loadSprites().then(sprites => {
		if (disposed) return;
		loaded = true; resize(); onLoaded(); publish();
		const tick = (now: number) => {
			if (disposed) return;
			const pad = pollController(), before = game.mode, descending = game.descent > 0;
			const elapsed = lastTime ? Math.min((now - lastTime) / 1000, .1) : 0; lastTime = now;
			if (game.mode === "playing") {
				accumulator += elapsed;
				while (accumulator >= 1 / 120 && game.mode === "playing") { step(game, getInput(pad), 1 / 120); accumulator -= 1 / 120; }
			} else accumulator = 0;
			if (game.mode !== before || descending !== (game.descent > 0)) { selection = 0; clearInput(); }
			render(ctx, game, sprites, width, height, pixelRatio); publish(); frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
	}).catch(() => { if (!disposed) onError("The sprites could not load. Reload to try again."); });
	return {
		action, upgrade,
		dispose: () => {
			disposed = true; cancelAnimationFrame(frame); observer.disconnect(); moveStick.dispose(); aimStick.dispose();
			window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup);
			window.removeEventListener("blur", pauseForFocus); document.removeEventListener("visibilitychange", visibility);
			canvas.removeEventListener("pointermove", pointermove); canvas.removeEventListener("pointerdown", pointerdown); canvas.removeEventListener("contextmenu", contextmenu);
		},
	};
}
