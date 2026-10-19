import { useEffect, useRef } from "react";
import { bugRig, speciesPose, BUG_RIG, bugPose } from "./animation";
import { bugSkin } from "./sprite-parts";
import { drawRig } from "./rig-renderer";
import { loadSprites } from "./renderer";
import type { BugVariant } from "./bug-types";

let sprites: ReturnType<typeof loadSprites> | undefined;
export function BugPortrait({ variant }: { variant: BugVariant }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		let active = true;
		sprites ??= loadSprites().catch(error => { sprites = undefined; throw error; });
		void sprites.then(images => {
			const ctx = active ? canvas.current?.getContext("2d") : null;
			if (!ctx) return;
			ctx.clearRect(0, 0, 240, 144); ctx.imageSmoothingEnabled = false;
			const skin = bugSkin(variant, 0), pose = { angle: -.3, distance: 12, time: 0 };
			if (variant === "centipede") for (let i = 5; i >= 0; i--) drawRig(ctx, images, BUG_RIG, { ...skin, head: undefined }, bugPose(pose), 100 - i * 13, 78 + i * 3, 1.2);
			drawRig(ctx, images, bugRig(variant), skin, speciesPose(variant, pose), variant === "centipede" ? 120 : 112, 72, 2.2);
		}).catch(() => { /* Field notes remain usable if a portrait cannot load. */ });
		return () => { active = false; };
	}, [variant]);
	return <canvas ref={canvas} width={240} height={144} role="img" aria-label="Bug appearance" />;
}
