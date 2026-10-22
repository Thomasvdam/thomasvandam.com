import atlas from "./sprite-atlas.json";
import type { Sprites } from "./renderer";

async function imageAt(path: string) {
	const image = new Image(); image.src = path; await image.decode(); return image;
}
export async function loadSpriteImages(): Promise<Sprites> {
	const [parts, sheets] = await Promise.all([
		imageAt(atlas.atlas),
		Promise.all(Object.entries(atlas.sheets).map(async ([id, path]) => [id, await imageAt(path)] as const)),
	]);
	const crops = await Promise.all(Object.entries(atlas.crops).map(async ([id, crop]) => {
		if (typeof createImageBitmap === "function") return [id, await createImageBitmap(parts, crop.x, crop.y, crop.width, crop.height)] as const;
		// Older browsers can crop once into a small canvas with identical pixels.
		const canvas = document.createElement("canvas"); canvas.width = crop.width; canvas.height = crop.height;
		canvas.getContext("2d")!.drawImage(parts, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
		return [id, canvas] as const;
	}));
	return Object.fromEntries([...crops, ...sheets]) as Sprites;
}
