import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { ExterminatorGame } from "./exterminator-game";

export const metadata: Metadata = {
	title: "Exterminator — Thomas van Dam",
	description: "Pilot a modular mech against burrowing and winged bugs in a small twin-stick survival experiment.",
};

export default function ExterminatorPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><ExterminatorGame /></main>;
}
