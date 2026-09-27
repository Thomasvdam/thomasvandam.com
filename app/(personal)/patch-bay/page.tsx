import type { Metadata } from "next";
import { PatchGame } from "./patch-game";

export const metadata: Metadata = {
	title: "Patch Bay — Thomas van Dam",
	description: "A tiny modular synth patching puzzle, tucked away in the wires.",
};

export default function PatchBayPage() {
	return <main id="main"><PatchGame /></main>;
}
