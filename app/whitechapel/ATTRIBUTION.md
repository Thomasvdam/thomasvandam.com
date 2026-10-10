Numbered-location road adjacency is adapted from Mark Ewing’s whitechapelR dataset:
https://github.com/bmewing/whitechapelR (data/roads.rda).
Retrieved 2026-10-10. The 195 locations match the revised edition.
The original roads dataset represents connections between numbered locations. The crossing network described below
now provides the rendered street segments; alley connections are not represented.
This is an investigator’s schematic, not a movement engine.

MIT License

Copyright (c) 2018 Mark Ewing

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Rules reference: Fantasy Flight Games, Letters from Whitechapel, revised edition:
https://images-cdn.fantasyflightgames.com/filer_public/55/ff/55ff98ec-c39b-4607-9055-fadb150605dd/lfh_rules_letter_en_low_res.pdf

Letters from Whitechapel is owned by its respective rights holders. This is an
unofficial companion; no original board artwork is included.

Police-crossing geometry and street connectivity added 2026-10-10 from the
board transcription at https://github.com/davidapple/Letters-From-Whitechapel
(js/map.js). Only factual board coordinates, numbered-location identities, and
connections are transcribed; no upstream executable code or artwork is used.
Coordinates are normalized to a common schematic scale. Crossing IDs are stable
internal references and do not appear on the physical board. The original
whitechapelR numbered-location adjacency is retained as a separate reference.
The schematic now includes 234 police crossings and 592 street segments.
