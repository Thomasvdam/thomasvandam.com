import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { BreakoutRoute } from "./breakout-route";

export const metadata: Metadata = {
	title: "Breakout — Thomas van Dam",
	description: "An almost three-dimensional Breakout experiment.",
};

export default function BreakoutPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><BreakoutRoute /></main>;
}
