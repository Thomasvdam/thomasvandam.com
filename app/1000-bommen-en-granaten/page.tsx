import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { pirateDisplay } from "./fonts";
import { Scorekeeper } from "./scorekeeper";

export const metadata: Metadata = {
	title: "1000 bommen en granaten scorekeeper — Thomas van Dam",
	description: "Scorekeeper for 1000 bommen & granaten.",
};

export default function BommenEnGranatenPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable} ${pirateDisplay.variable}`}><Scorekeeper /></main>;
}
