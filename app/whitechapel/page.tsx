import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { InvestigationBoard } from "./investigation-board";

export const metadata: Metadata = {
	title: "Whitechapel casebook — Thomas van Dam",
	description: "An investigator’s companion for Letters from Whitechapel. Keep the evidence, compare the nights, and follow your hunches.",
};

export default function WhitechapelPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><InvestigationBoard /></main>;
}
