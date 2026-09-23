import { Barlow_Condensed, DM_Sans } from "next/font/google";

export const experimentDisplay = Barlow_Condensed({
	weight: ["700", "800", "900"],
	subsets: ["latin"],
	variable: "--font-experiment-display",
	display: "swap",
});

export const experimentBody = DM_Sans({
	subsets: ["latin"],
	variable: "--font-experiment-body",
	display: "swap",
});
