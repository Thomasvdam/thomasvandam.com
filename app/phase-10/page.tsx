import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { PhaseTracker } from "./tracker";

export const metadata: Metadata = {
	title: "Phase 10 scorekeeper — Thomas van Dam",
	description: "Less bookkeeping, more playing. A table-friendly Phase 10 score, phase, and starting-player tracker.",
};

export default function Phase10Page() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><PhaseTracker /></main>;
}
