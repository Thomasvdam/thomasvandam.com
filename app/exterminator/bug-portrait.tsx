import { useEffect, useRef } from "react";
import { bugRig, speciesPose, BUG_RIG, bugPose } from "./animation";
import { bugSkin } from "./sprite-parts";
import { drawRig } from "./rig-renderer";
import { loadSprites } from "./renderer";
import { isBossVariant, type EncounterVariant } from "./boss-types";
import { createBoss } from "./bosses";
import { drawBoss } from "./boss-art";

let sprites: ReturnType<typeof loadSprites> | undefined;
export function BugPortrait({ variant }: { variant: EncounterVariant }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		let active = true;
		sprites ??= loadSprites().catch(error => { sprites = undefined; throw error; });
		void sprites.then(images => {
			const ctx = active ? canvas.current?.getContext("2d") : null;
			if (!ctx) return;
			ctx.clearRect(0, 0, 240, 144); ctx.imageSmoothingEnabled = false;
			if (isBossVariant(variant)) {
				const boss = createBoss(variant, 0, { x: 500, y: 360 }); boss.x = 0; boss.y = 0; boss.angle = 0;
				boss.segments = Array.from({ length: 8 }, (_, i) => ({ x: -(i + 1) * 22, y: Math.sin(i * .4) * 14 }));
				ctx.save(); ctx.translate(145, 72); ctx.scale(.55, .55); drawBoss(ctx, images, boss, 0, true); ctx.restore(); return;
			}
			const skin = bugSkin(variant, 0), pose = { angle: -.3, distance: 12, time: 0 };
			if (variant === "centipede") for (let i = 5; i >= 0; i--) drawRig(ctx, images, BUG_RIG, { ...skin, head: undefined }, bugPose(pose), 100 - i * 13, 78 + i * 3, 1.2);
			drawRig(ctx, images, bugRig(variant), skin, speciesPose(variant, pose), variant === "centipede" ? 120 : 112, 72, 2.2);
		}).catch(() => { /* Field notes remain usable if a portrait cannot load. */ });
		return () => { active = false; };
	}, [variant]);
	return <canvas ref={canvas} width={240} height={144} role="img" aria-label="Bug appearance" />;
}
