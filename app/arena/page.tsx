import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { ArenaGame } from "./arena-game";

export const metadata: Metadata = {
	title: "Arena — Thomas van Dam",
	description: "Pilot a modular mech against burrowing and winged bugs in a small twin-stick survival experiment.",
};

export default function ArenaPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><ArenaGame /></main>;
}
