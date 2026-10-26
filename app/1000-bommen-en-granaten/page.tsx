import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { Scorekeeper } from "./scorekeeper";

export const metadata: Metadata = {
	title: "1000 bommen en granaten scorekeeper — Thomas van Dam",
	description: "A simple scorekeeper for 1000 bommen en granaten. Enter your points, keep the totals, and get back to the game.",
};

export default function BommenEnGranatenPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><Scorekeeper /></main>;
}
