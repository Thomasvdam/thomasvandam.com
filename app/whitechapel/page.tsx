import type { Metadata } from "next";
import { experimentBody, experimentDisplay } from "@/app/experiment-fonts";
import { InvestigationBoard } from "./investigation-board";

export const metadata: Metadata = {
	title: "Whitechapel casebook — Thomas van Dam",
	description: "Track evidence and officer positions across nights in Letters from Whitechapel.",
};

export default function WhitechapelPage() {
	return <main className={`${experimentBody.variable} ${experimentDisplay.variable}`}><InvestigationBoard /></main>;
}
