import type { LevelDefinition } from "./level-format";

// Paste editor exports into this array to add levels to the campaign.
export const LEVELS: LevelDefinition[] = [
	{
		"name": "Patchwork",
		"width": 1.8,
		"height": 0.8,
		"columns": 8,
		"xStep": 2,
		"top": 22.5,
		"yStep": 1.25,
		"pattern": [
			"3S2M1L31",
			"2O12EV23",
			"FWTDDTWF",
			"31?31?31",
			"P3B23G2H"
		]
	},
	{
		"name": "Prism",
		"width": 2,
		"height": 1,
		"columns": 7,
		"xStep": 2.25,
		"top": 22.4,
		"yStep": 1.6,
		"pattern": [
			"..3SW..",
			".M23LD.",
			"2O12F1E",
			"12T12V1",
			"P12.12B",
			"23...12",
			"G23.23H",
			"3123?23",
			"23W2312",
			".D3123.",
			"..F31.."
		]
	},
	{
		"name": "Switchback",
		"width": 2.2,
		"height": 1.2,
		"columns": 6,
		"xStep": 2.7,
		"top": 22.2,
		"yStep": 1.4,
		"pattern": [
			"2SW2M1",
			"1D..L3",
			"3OF312",
			".3T2E.",
			"12P1V3",
			"3B..12",
			"23G231",
			".2H12.",
			"31?312",
			"2W..31",
			"12D123",
			".1F31.",
			"23T231"
		]
	},
];
