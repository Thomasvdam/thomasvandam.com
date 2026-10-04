import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { BreakoutGame } from "./breakout-game";

export const metadata: Metadata = {
	title: "Breakout — Thomas van Dam",
	description: "A three-dimensional Breakout experiment. Forty bricks, three power-ups, one level.",
};

export default function BreakoutPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><BreakoutGame /></main>;
}
