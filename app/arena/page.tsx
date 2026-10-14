import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { ArenaGame } from "./arena-game";

export const metadata: Metadata = {
	title: "Arena — Thomas van Dam",
	description: "A small twin-stick arena survival experiment. Move, aim, survive, and upgrade.",
};

export default function ArenaPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><ArenaGame /></main>;
}
