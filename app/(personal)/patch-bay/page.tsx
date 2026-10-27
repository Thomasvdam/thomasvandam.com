import type { Metadata } from "next";
import { PatchGame } from "./patch-game";

export const metadata: Metadata = {
	title: "Patch Bay — Thomas van Dam",
	description: "A sliding tile puzzle about routing a synth signal to speakers.",
};

export default function PatchBayPage() {
	return <main id="main"><PatchGame /></main>;
}
