import { FIELD } from "./field";
import type { LevelDefinition } from "./level-format";

// Paste editor exports into this array to add levels to the campaign.
// Introduce a few mechanics at a time; mystery rewards wait until the finale.
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
			"31112111",
			"21121121",
			"FW1111WF",
			"11121111",
			"11211121"
		]
	},
	{
		"name": "Prism",
		"width": 2,
		"height": 1,
		"columns": 7,
		"xStep": FIELD.width / 7,
		"top": 22.9,
		"yStep": 1.35,
		"pattern": [
			"..1FW..",
			".111LD.",
			"1111F12",
			"1111112",
			"W11.12D",
			"11...12",
			"L11.11F",
			"1111212",
			"11W1112",
			".D1112.",
			"..F11.."
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
			"1PW221",
			"1D..K2",
			"11F212",
			".1121.",
			"11P122",
			"KW..21",
			"111221",
			".2K12.",
			"112212",
			"1W..21",
			"12D122",
			".1F21.",
			"121221"
		]
	},
	{
		"name": "Drift",
		"width": 1.9,
		"height": 0.8,
		"columns": 8,
		"xStep": FIELD.width / 8,
		"top": 22.5,
		"yStep": 1.1,
		"pattern": [
			"12112322",
			"1M111M22",
			"11B121B2",
			"11222232",
			"11W21F21",
			"121M232M",
			"1D122P22",
			"11B2K2B2",
			"11122212"
		]
	},
	{
		"name": "Afterburn",
		"width": 1.9,
		"height": 0.8,
		"columns": 8,
		"xStep": FIELD.width / 8,
		"top": 22.5,
		"yStep": 1.1,
		"pattern": [
			"22113322",
			"1M12M232",
			"11S12S22",
			"1H132H23",
			"12132323",
			"B11P22B2",
			"1S13S232",
			"12W22F23",
			"1D12K222",
			"H12223H2"
		]
	},
	{
		"name": "Mirage",
		"width": 1.9,
		"height": 0.8,
		"columns": 8,
		"xStep": FIELD.width / 8,
		"top": 22.5,
		"yStep": 1.1,
		"pattern": [
			"22223332",
			"12O23O23",
			"2M133M23",
			"11R22R22",
			"12132323",
			"1B13H232",
			"22O233O2",
			"12P23P23",
			"1S132S23",
			"W122F232",
			"1R12D22K"
		]
	},
	{
		"name": "Live Wire",
		"width": 1.9,
		"height": 0.8,
		"columns": 8,
		"xStep": FIELD.width / 8,
		"top": 22.5,
		"yStep": 1.1,
		"pattern": [
			"22233333",
			"2O133O23",
			"12E23E23",
			"1A132A23",
			"22223332",
			"2R233R23",
			"12M23M23",
			"2B23H232",
			"1E232E23",
			"P132D232",
			"12A23A23",
			"W13F23K2"
		]
	},
	{
		"name": "Bastion",
		"width": 1.9,
		"height": 0.8,
		"columns": 8,
		"xStep": FIELD.width / 8,
		"top": 22.5,
		"yStep": 1.1,
		"pattern": [
			"22233333",
			"2I233I33",
			"22O33O33",
			"2G133G23",
			"22333333",
			"2E333E33",
			"1R33R332",
			"22I33I33",
			"2B23H232",
			"12M23M23",
			"2P33D332",
			"12A23A23",
			"W13F23K2"
		]
	},
	{
		"name": "Undertow",
		"width": 1.9,
		"height": 0.8,
		"columns": 8,
		"xStep": FIELD.width / 8,
		"top": 22.5,
		"yStep": 1.1,
		"pattern": [
			"22233333",
			"22V33V33",
			"2I233I33",
			"2Z233Z33",
			"22333333",
			"2O333O33",
			"12N23N23",
			"2E33A332",
			"22M33M33",
			"2G33P332",
			"22V33V33",
			"1B33H332",
			"2R33D332",
			"W23F33K2"
		]
	},
	{
		"name": "Last Orbit",
		"width": 1.9,
		"height": 0.8,
		"columns": 8,
		"xStep": FIELD.width / 8,
		"top": 22.5,
		"yStep": 1.1,
		"pattern": [
			"33333333",
			"3V333V33",
			"33I33I33",
			"3?33?333",
			"33333333",
			"3M33O333",
			"33S33S33",
			"3E33A333",
			"33V33V33",
			"3G33P333",
			"33B33H33",
			"3R33D333",
			"3Z33N333",
			"W3F3K3?3"
		]
	}
];
