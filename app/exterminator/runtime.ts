import { createFramePublisher } from "./frame-publisher";
import { armourReduction } from "./player-damage";
import { createEncounterProgress, recordVisibleEncounters } from "./encounters";
import { encounterName, bossForHive, BOSS_NAMES, type EncounterVariant, type BossVariant } from "./boss-types";
import { createSchematicProgress, SCHEMATIC_NAMES, schematicForHive } from "./schematics";
import { lightSensitiveChance, MOTHS_TO_BLOCK } from "./light-threats";
import { enemyMixHints } from "./hives";
import { enableDebugSchematics, grantDebugFunds, setDebug, spawnDebugWave, spawnDebugBoss, type WaveComposition } from "./debug";
import { weaponSpec, type Weapon } from "./weapons";
import { terrainAt, terrainByPrevalence, TERRAIN_NAMES, type Undercarriage } from "./terrain";
import { cameraFor, screenToWorld } from "./camera";
import { bindJoystick, keyboardVector, readGamepad } from "./controls";
import { openBugpedia, closeBugpedia, chooseWeapon, closeWeapons, openWeapons, weaponChoices, purchaseService, workshopServices, closeShop, openShop, chooseHive, chooseUndercarriage, chooseUpgrade, closeWorkshop, newGame, openWorkshop, start, step, togglePause, undercarriageChoices, upgradeChoices, upgradeLevels, waveSize, type Game, type Upgrade, type WorkshopService } from "./game";
import type { Vector } from "./math";
import { loadSprites, createRenderer } from "./renderer";

function menuChoices(game: Game) {
	if (game.mode === "bugpedia") return [...game.encounters.map(id => ({ id, name: encounterName(id), key: "", kind: "entry" as const })), { id: "closeBugpedia", name: "Back", key: "B", kind: "closeBugpedia" as const }];
	if (game.mode === "paused") return [{ id: "pause", name: "Resume game", key: "1", kind: "pause" as const }, { id: "bugpedia", name: "Bugpedia", key: "B", kind: "bugpedia" as const }];
	if (game.mode === "weapons") return [...weaponChoices(game), { id: "workshop", name: "Back to workshop", key: "5", kind: "workshop" as const }];
	if (game.mode === "shop") return [...upgradeChoices(game), ...workshopServices(game), { id: "workshop", name: "Back to workshop", key: "6", kind: "workshop" as const }];
	if (game.mode === "workshop") return [
		...undercarriageChoices(game),
		{ id: "shop", name: "Upgrades & repairs", key: "4", kind: "shop" as const },
		{ id: "back", name: "Choose a hive", key: "5", kind: "back" as const },
		{ id: "weapons", name: "Change weapon", key: "6", kind: "weapons" as const },
	];
	if (game.mode === "base") return [
		...game.hives.map((hive, index) => ({ id: hive.id, name: hive.name, key: String(index + 1), kind: "hive" as const })),
		{ id: "workshop", name: "Workshop", key: "4", kind: "workshop" as const },
		{ id: "bugpedia", name: "Bugpedia", key: "B", kind: "bugpedia" as const },
	];
	return [];
}
export function nextMenuSelection(choices: readonly { kind?: string; locked?: boolean }[], current: number, direction: number) {
	for (let i = 0; i < choices.length; i++) { current = (current + direction + choices.length) % choices.length; if (!choices[current].locked) return current; }
	return current;
}
export type ExterminatorView = ReturnType<typeof viewFromGame>;
export function viewFromGame(game: Game, controller = false, selection = 0, progressSaved = true) {
	return {
		boss: game.boss ? { name: BOSS_NAMES[game.boss.variant], health: Math.ceil(game.boss.health), maxHealth: game.boss.maxHealth, phase: game.boss.phase } : null, bossIncoming: !game.debug && !game.boss && game.wave === 3 && bossForHive(game.runSeed, game.hivesCleared) !== null,
		bugpediaEntry: (game.encounters[0] ?? null) as EncounterVariant | null, encountersSaved: true, encounters: [...game.encounters], bugpediaFrom: game.bugpediaFrom,
		carriedSchematic: game.carriedSchematic ? SCHEMATIC_NAMES[game.carriedSchematic] : null, lastSchematic: game.lastSchematic ? SCHEMATIC_NAMES[game.lastSchematic] : null, schematicHunt: game.schematicReward !== null && game.carriedSchematic === null, unlockedSchematics: game.schematics.length, progressSaved,
		armourRank: game.parts.armour, armourReduction: Math.round(armourReduction(game.parts.armour) * 100),
		pit: game.pitTerrain !== null, tethered: game.tethers.filter(tether => !tether.lightTarget).length, slimed: game.slimed, glue: Math.round(game.glue * 65), debug: !!game.debug, hivesCleared: game.hivesCleared, hive: game.hive?.name ?? null, terrain: game.hive ? game.pitTerrain ?? terrainAt(game.terrain, game.player.x, game.player.y) : "firm" as const, undercarriage: game.undercarriage,
		weapon: game.weapon, weaponName: weaponSpec(game.weapon).name, weaponRanks: structuredClone(game.parts.weapons),
		mode: game.mode, health: game.player.health, wave: game.wave, enemies: game.enemies.filter(enemy => enemy.variant !== "courier").length + game.toSpawn + game.spawns.length + (game.boss && game.boss.health > 0 ? 1 : 0),
		blockedLights: Object.values(game.lightCover).filter(count => count >= MOTHS_TO_BLOCK).length, lightRank: game.parts.lights, cornerLights: { ...game.parts.cornerLights }, sensorRank: game.parts.sensor, money: game.money, lastJob: game.lastJob, payment: game.hive?.payment ?? null, kills: game.kills, time: Math.floor(game.time),
		hives: game.hives.map(hive => {
			const terrain = terrainByPrevalence(hive.terrain), difficultyKnown = game.parts.sensor >= 1;
			return {
				boss: !game.debug && bossForHive(game.runSeed, game.hivesCleared) !== null, schematicChance: !game.debug && schematicForHive(game.runSeed, game.hivesCleared, game.schematics) !== null, id: hive.id, name: hive.name, payment: hive.payment, activity: difficultyKnown ? hive.activity : null,
				threat: difficultyKnown ? hive.threat : null,
				terrain: TERRAIN_NAMES[terrain[0]], secondaryTerrain: game.parts.sensor >= 2 && terrain[1] ? TERRAIN_NAMES[terrain[1]] : null,
				lightAttackers: game.parts.sensor >= 3 ? Math.round(lightSensitiveChance(game.hivesCleared, hive.threat) * 100) : null,
				enemyMix: game.parts.sensor >= 3 ? enemyMixHints(hive.enemyMix) : null,
				minBugs: difficultyKnown ? waveSize(1, hive.threat) : null, maxBugs: difficultyKnown ? waveSize(3, hive.threat) : null,
			};
		}),
		parts: { ...game.parts.undercarriages }, choices: menuChoices(game), intermission: Math.ceil(game.intermission), upgrades: upgradeLevels(game), controller, selection,
	};
}
type RuntimeOptions = {
	canvas: HTMLCanvasElement; movePad: HTMLElement; moveThumb: HTMLElement; aimPad: HTMLElement; aimThumb: HTMLElement;
	onViewChange: (view: ExterminatorView) => void; onLoaded: () => void; onError: (message: string) => void;
};

export function createExterminatorRuntime(options: RuntimeOptions) {
	const { canvas, onViewChange, onLoaded, onError } = options;
	let storage: Storage | null = null;
	try { storage = window.localStorage; } catch { /* Keep extracted ownership in this session when browser storage is blocked. */ }
	const progress = createSchematicProgress(storage), encounters = createEncounterProgress(storage);
	const freshGame = () => { const next = newGame(crypto.getRandomValues(new Uint32Array(1))[0], "legs", progress.read()); next.encounters = encounters.read(); setDebug(next, window.location.hash === "#debug"); return next; };
	let game = freshGame(), savedSchematics = JSON.stringify(game.schematics), savedEncounters = JSON.stringify(game.encounters);
	let bugpediaEntry: EncounterVariant | null = game.encounters[0] ?? null;
	let disposed = false, loaded = false, frame = 0, width = 1, height = 1, pixelRatio = 1, accumulator = 0, lastTime = 0;
	let mouse: Vector | null = null, aimSource: "mouse" | "touch" | "controller" = "mouse";
	let needsDraw = true;
	let selection = 0, viewKey = "", controller = false, previousPad = readGamepad(null), controllerBlocked = false;
	const keys = new Set<string>();
	const playing = () => game.mode === "playing";
	const moveStick = bindJoystick(options.movePad, options.moveThumb, playing);
	const aimStick = bindJoystick(options.aimPad, options.aimThumb, playing);
	const saveProgress = () => {
		const discovered = JSON.stringify(game.encounters);
		if (savedEncounters !== discovered) { encounters.remember(game.encounters); savedEncounters = discovered; }
		const recovered = JSON.stringify(game.schematics);
		if (savedSchematics !== recovered) { progress.remember(game.schematics); savedSchematics = recovered; }
	};
	const publish = () => {
		saveProgress();
		const view = { ...viewFromGame(game, controller, selection, progress.persistent), bugpediaEntry, encountersSaved: encounters.persistent }, key = JSON.stringify(view);
		if (key !== viewKey) { viewKey = key; needsDraw = true; onViewChange(view); }
	};
	const publishFrame = createFramePublisher(publish);
	const clearInput = () => {
		keys.clear(); mouse = null; moveStick.reset(); aimStick.reset(); accumulator = 0; controllerBlocked = true;
	};
	const changed = () => { clearInput(); publish(); };
	const focus = () => canvas.focus({ preventScroll: true });
	const action = (name: "start" | "pause" | "restart" | "workshop" | "hives" | "shop" | "weapons" | "bugpedia" | "closeBugpedia") => {
		if (!loaded) return;
		if (name === "start") start(game);
		if (name === "pause") { if (game.mode === "bugpedia") closeBugpedia(game); else togglePause(game); }
		if (name === "bugpedia") { openBugpedia(game); bugpediaEntry = game.encounters[0] ?? null; }
		if (name === "closeBugpedia") closeBugpedia(game);
		if (name === "workshop") { if (game.mode === "shop") closeShop(game); else if (game.mode === "weapons") closeWeapons(game); else openWorkshop(game); }
		if (name === "shop") openShop(game);
		if (name === "hives") closeWorkshop(game);
		if (name === "weapons") openWeapons(game);
		if (name === "restart") { game = freshGame(); start(game); selection = 0; }
		selection = 0; changed(); focus();
	};
	const upgrade = (id: Upgrade) => {
		if (game.mode !== "shop") return;
		chooseUpgrade(game, id); selection = 0; changed();
		focus();
	};
	const purchase = (id: WorkshopService) => {
		if (game.mode !== "shop") return;
		purchaseService(game, id); selection = 0; changed(); focus();
	};
	const equip = (id: Undercarriage) => {
		if (game.mode !== "workshop") return;
		chooseUndercarriage(game, id); changed();
	};
	const equipWeapon = (id: Weapon) => {
		if (game.mode !== "weapons") return;
		chooseWeapon(game, id); changed();
	};
	const deploy = (id: string) => {
		if (game.mode !== "base") return;
		chooseHive(game, id); selection = 0; changed(); focus();
	};
	const browseBug = (id: EncounterVariant) => { if (game.mode !== "bugpedia" || !game.encounters.includes(id)) return; bugpediaEntry = id; selection = game.encounters.indexOf(id); publish(); };
	const confirmChoice = (index: number) => {
		const choice = menuChoices(game)[index];
		if (!choice || ("locked" in choice && choice.locked)) return;
		if (choice.kind === "entry") browseBug(choice.id);
		if (choice.kind === "bugpedia" || choice.kind === "closeBugpedia" || choice.kind === "pause") action(choice.kind);
		if (choice.kind === "undercarriage") equip(choice.id);
		if (choice.kind === "weapon") equipWeapon(choice.id);
		if (choice.kind === "weapons") action("weapons");
		if (choice.kind === "stat") upgrade(choice.id);
		if (choice.kind === "service") purchase(choice.id);
		if (choice.kind === "hive") deploy(choice.id);
		if (choice.kind === "workshop") action("workshop");
		if (choice.kind === "back") action("hives");
		if (choice.kind === "shop") action("shop");
	};
	const debugWave = (composition: WaveComposition, lightSensitivePercent = 0) => { if (!loaded) return; spawnDebugWave(game, composition, lightSensitivePercent); changed(); focus(); };
	const debugBoss = (id: BossVariant) => { if (!loaded) return; spawnDebugBoss(game, id); changed(); focus(); };
	const enableSchematics = () => { if (!loaded || !game.debug) return; enableDebugSchematics(game); changed(); focus(); };
	const giveFunds = () => { if (!loaded || !game.debug) return; grantDebugFunds(game); changed(); focus(); };
	const hashchange = () => { setDebug(game, window.location.hash === "#debug"); changed(); };
	const keydown = (event: KeyboardEvent) => {
		if (!loaded || !(canvas.parentElement?.contains(document.activeElement))) return;
		const interactive = (event.target as HTMLElement)?.closest("button, a, input, select, textarea, summary");
		if (event.code === "Escape" || event.code === "KeyP") { event.preventDefault(); if (!event.repeat) action((game.mode === "shop" || game.mode === "weapons") ? "workshop" : game.mode === "workshop" ? "hives" : "pause"); return; }
		if (menuChoices(game).length > 0 && /^[0-9lba]$/i.test(event.key)) {
			event.preventDefault(); const index = menuChoices(game).findIndex(choice => choice.key.toLowerCase() === event.key.toLowerCase());
			if (!event.repeat && index >= 0) confirmChoice(index); return;
		}
		if (game.mode === "bugpedia" && (event.code === "PageDown" || event.code === "PageUp")) {
			event.preventDefault(); const panel = canvas.parentElement?.querySelector<HTMLElement>("[data-bugpedia-scroll]");
			panel?.scrollBy(0, panel.clientHeight * .8 * (event.code === "PageDown" ? 1 : -1)); return;
		}
		if (game.mode === "bugpedia" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
			event.preventDefault();
			if (!event.repeat) { selection = nextMenuSelection(menuChoices(game), selection, event.code === "ArrowUp" || event.code === "ArrowLeft" ? -1 : 1); if (selection < game.encounters.length) bugpediaEntry = game.encounters[selection]; publish(); focus(); }
			return;
		}
		if (interactive) return;
		if (event.code === "Space" || event.code === "Enter") {
			event.preventDefault(); if (event.repeat) return;
			if (game.mode === "ready") action("start");
			else if (game.mode === "dead") action("restart");
			else if (menuChoices(game).length > 0) confirmChoice(selection);
			else if (game.mode === "playing") action("pause");
			return;
		}
		if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
			event.preventDefault(); if (game.mode === "playing") keys.add(event.code);
			else if (menuChoices(game).length && !event.repeat) { selection = nextMenuSelection(menuChoices(game), selection, event.code === "ArrowUp" || event.code === "KeyW" || event.code === "ArrowLeft" || event.code === "KeyA" ? -1 : 1); if (game.mode === "bugpedia" && selection < game.encounters.length) bugpediaEntry = game.encounters[selection]; publish(); }
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
		needsDraw = true;
		const bounds = canvas.getBoundingClientRect(); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
		pixelRatio = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio);
	};
	const observer = new ResizeObserver(resize); observer.observe(canvas);
	window.addEventListener("hashchange", hashchange);
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
			if (game.mode === "bugpedia" && pad.aim.y) canvas.parentElement?.querySelector<HTMLElement>("[data-bugpedia-scroll]")?.scrollBy(0, pad.aim.y * 12);
			if (pad.pause && !previousPad.pause) action("pause");
			if (menuChoices(game).length > 0) {
				if (pad.previous && !previousPad.previous) selection = nextMenuSelection(menuChoices(game), selection, -1);
				if (pad.next && !previousPad.next) selection = nextMenuSelection(menuChoices(game), selection, 1);
			}
			if (pad.confirm && !previousPad.confirm) {
				if (menuChoices(game).length > 0) confirmChoice(selection);
				else if (game.mode === "ready") action("start");
				else if (game.mode === "dead") action("restart");
				else if (game.mode === "paused") action("pause");
			}
		}
		if (game.mode === "bugpedia" && (pad.previous || pad.next) && selection < game.encounters.length) bugpediaEntry = game.encounters[selection];
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
		const render = createRenderer();
		loaded = true; resize(); onLoaded(); publish();
		const tick = (now: number) => {
			if (disposed) return;
			const oldSelection = selection, oldController = controller;
			const pad = pollController(), before = game.mode;
			recordVisibleEncounters(game, width, height);
			const elapsed = lastTime ? Math.min((now - lastTime) / 1000, .1) : 0; lastTime = now;
			if (game.mode === "playing") {
				accumulator += elapsed;
				while (accumulator >= 1 / 120 && game.mode === "playing") { step(game, getInput(pad), 1 / 120); accumulator -= 1 / 120; }
			} else accumulator = 0;
			recordVisibleEncounters(game, width, height);
			if (game.mode !== before) { selection = 0; clearInput(); }
			const immediate = game.mode !== before || selection !== oldSelection || controller !== oldController;
			if (game.mode === "playing" || immediate || needsDraw) publishFrame(now, immediate);
			if (game.mode === "playing" || needsDraw) { render(ctx, game, sprites, width, height, pixelRatio); needsDraw = false; }
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
	}).catch(() => { if (!disposed) onError("The sprites could not load. Reload to try again."); });
	return {
		action, browseBug, upgrade, purchase, equip, equipWeapon, deploy, debugWave, debugBoss, enableSchematics, giveFunds,
		dispose: () => {
			saveProgress();
			disposed = true; cancelAnimationFrame(frame); observer.disconnect(); moveStick.dispose(); aimStick.dispose();
			window.removeEventListener("hashchange", hashchange);
			window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup);
			window.removeEventListener("blur", pauseForFocus); document.removeEventListener("visibilitychange", visibility);
			canvas.removeEventListener("pointermove", pointermove); canvas.removeEventListener("pointerdown", pointerdown); canvas.removeEventListener("contextmenu", contextmenu);
		},
	};
}
