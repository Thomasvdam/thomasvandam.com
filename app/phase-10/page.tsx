import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { PhaseTracker } from "./tracker";

export const metadata: Metadata = {
	title: "Phase 10 scorekeeper — Thomas van Dam",
	description: "Track scores, phases, and the starting player in Phase 10.",
};

export default function Phase10Page() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><PhaseTracker /></main>;
}
