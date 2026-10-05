import { FIELD } from "./field";
import type { LevelDefinition } from "./level-format";

// Paste editor exports into this array to add levels to the campaign.
export const LEVELS: LevelDefinition[] = [
	{
		"name": "Patchwork",
		"width": 1.8,
		"height": 0.8,
		"columns": 8,
		"xStep": FIELD.width / 8,
		"top": 22.5,
		"yStep": 1.25,
		"pattern": [
			"3S2M1LI1",
			"2O12EV23",
			"FW1DD1WF",
			"KR?AN?Z1",
			"P3B23G2H"
		]
	},
	{
		"name": "Prism",
		"width": 2,
		"height": 1,
		"columns": 7,
		"xStep": FIELD.width / 7,
		"top": 22.9,
		"yStep": 1.5,
		"pattern": [
			"..3SW..",
			".M23LD.",
			"2O12F1E",
			"KR1ANVI",
			"P12.12B",
			"23...12",
			"G23.23H",
			"Z123?23",
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
		"xStep": FIELD.width / 6,
		"top": 22.7,
		"yStep": 1.25,
		"pattern": [
			"2SW2M1",
			"1D..L3",
			"3OF312",
			".312E.",
			"12P1V3",
			"KB..RI",
			"ANG231",
			".2H12.",
			"Z1?312",
			"2W..31",
			"12D123",
			".1F31.",
			"231231"
		]
	},
];
