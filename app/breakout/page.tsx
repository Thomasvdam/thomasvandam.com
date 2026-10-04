import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { BreakoutRoute } from "./breakout-route";

export const metadata: Metadata = {
	title: "Breakout — Thomas van Dam",
	description: "A three-dimensional Breakout experiment. Handmade brick patterns, ball and paddle powers, and a classic brought into 3D.",
};

export default function BreakoutPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><BreakoutRoute /></main>;
}
