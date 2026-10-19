"""Generate the hand-authored high-resolution Exterminator boss parts.

The game keeps a 32px logical registration grid, but boss sources are rendered
at 128px (four samples per logical pixel). That gives the large creatures
fine plate seams, eyes, pits, teeth, and curved limb silhouettes without
changing the existing rig scales or collision sizes.
"""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent / "public" / "images" / "exterminator"
SCALE = 4
SIZE = 32 * SCALE
COLORS = {
    "ink": (9, 17, 18), "deep": (18, 28, 27), "joint": (42, 54, 48),
    "steel": (70, 89, 82), "metal": (117, 140, 126), "light": (190, 205, 165),
    "armor": (111, 145, 115), "darkArmor": (47, 78, 63), "gold": (233, 191, 96),
    "goldDark": (133, 87, 35), "orange": (225, 119, 58), "orangeLight": (247, 171, 90),
    "rustDark": (67, 35, 31), "rust": (151, 70, 45), "rustLight": (219, 133, 66),
    "oliveDark": (39, 53, 35), "olive": (91, 119, 64), "oliveLight": (171, 187, 95),
    "redDark": (67, 25, 34), "red": (169, 51, 58), "redLight": (245, 125, 104),
    "violetDark": (45, 30, 52), "violet": (112, 67, 124), "violetLight": (196, 137, 182),
    "ochreDark": (72, 49, 24), "ochre": (161, 111, 42), "ochreLight": (238, 181, 79),
    "scar": (106, 47, 39), "scarLight": (221, 104, 73), "eye": (255, 224, 117),
}


def poly(points, color):
    return ("poly", points, COLORS[color])


def rect(x, y, width, height, color):
    return poly([(x, y), (x + width, y), (x + width, y + height), (x, y + height)], color)


def ellipse(cx, cy, rx, ry, color):
    return ("ellipse", (cx, cy, rx, ry), COLORS[color])


def line(x1, y1, x2, y2, width, color):
    return ("line", (x1, y1, x2, y2, width), COLORS[color])


def inside(x, y, points):
    result = False
    for i, (ax, ay) in enumerate(points):
        bx, by = points[i - 1]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


def distance_to_segment(x, y, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return math.hypot(x - ax, y - ay)
    t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (ax + t * dx), y - (ay + t * dy))


def contains(shape, x, y):
    kind, data, _ = shape
    if kind == "poly":
        return inside(x, y, data)
    if kind == "ellipse":
        cx, cy, rx, ry = data
        return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
    x1, y1, x2, y2, width = data
    return distance_to_segment(x, y, x1, y1, x2, y2) <= width / 2


def board(layers):
    pixels = []
    for py in range(SIZE):
        row = []
        y = (py + .5) / SCALE
        for px in range(SIZE):
            x = (px + .5) / SCALE
            row.append(next((shape[2] for shape in reversed(layers) if contains(shape, x, y)), None))
        pixels.append(row)
    return pixels


def chunk(name, data):
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))


def save(name, layers):
    pixels = board(layers)
    rows = bytearray()
    for row in pixels:
        rows.append(0)
        for color in row:
            rows.extend((*color, 255) if color else (0, 0, 0, 0))
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
    path = ROOT / f"parts/{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def flecks(points, color="light", size=.55):
    return [ellipse(x, y, size, size * .65, color) for x, y in points]


# Rhinoceros beetle ---------------------------------------------------------
save("boss-rhino-body", [
    poly([(1, 12), (3, 7), (8, 2.5), (17, 1), (25, 3.5), (30.5, 9), (31, 20), (26, 27.5), (16, 30.5), (7, 28), (1.5, 21)], "ink"),
    poly([(3.5, 12), (6.5, 6.5), (13, 3.5), (21.5, 5), (28, 10), (28.5, 20), (23, 26), (15, 28), (7, 25), (3.5, 19)], "darkArmor"),
    poly([(6, 12), (10, 7), (17, 5.5), (24, 8), (26, 13), (25, 19), (20, 24), (12, 24.5), (6.5, 20)], "armor"),
    poly([(8, 10), (13, 7), (17, 7), (22, 9), (24, 13), (23, 16), (9, 16)], "metal"),
    line(15.5, 6, 15.5, 25, .8, "light"), line(8, 18, 23, 19, .6, "darkArmor"),
    rect(9, 11, 4, 1.2, "light"), rect(19, 10, 3, 1, "light"), rect(10, 21, 3, 1, "steel"),
    *flecks([(8, 14), (11, 24), (19, 22), (23, 14), (21, 7)], "goldDark", .45),
])
save("boss-rhino-shell", [
    poly([(1, 11), (4, 5), (11, 1.5), (19, 1), (27, 5), (31, 13), (29.5, 23), (22, 30), (12, 30.5), (4, 25), (1, 18)], "ink"),
    poly([(3.5, 11), (7, 6), (12, 3.5), (19, 3), (25, 6.5), (28.5, 13), (27, 22), (21, 27.5), (13, 28), (6, 23), (3.5, 18)], "oliveDark"),
    poly([(6, 11), (10, 7), (16, 5), (22, 7), (26, 12), (26, 19), (21, 24.5), (14, 26), (8, 22), (6, 17)], "olive"),
    poly([(8, 10), (12, 7), (16, 7), (20, 8), (23, 12), (22, 15), (9, 15)], "oliveLight"),
    line(15.5, 5, 15.5, 26, 1, "oliveDark"), line(7, 17, 25, 18, .8, "goldDark"),
    rect(9, 12, 4, 1, "light"), rect(19, 10, 4, 1, "light"), rect(11, 21, 3, 1, "gold"),
    *flecks([(7, 15), (10, 23), (20, 22), (24, 14), (20, 7), (12, 6)], "oliveLight", .4),
])
save("boss-rhino-head", [
    poly([(2, 10), (8, 4), (16, 2.5), (24, 5), (27, 10), (31.5, 14), (29, 20), (25, 21), (22, 28), (12, 29), (4, 22), (2, 16)], "ink"),
    poly([(6, 11), (10, 6.5), (16, 5), (22, 7), (24.5, 12), (28.5, 15), (25, 18), (21, 24), (13, 25), (7, 20)], "armor"),
    poly([(9, 10), (14, 7), (20, 8), (22, 12), (26, 15), (22, 17), (19, 22), (13, 22), (9, 18)], "metal"),
    ellipse(20.5, 11.5, 1.1, .85, "eye"), ellipse(20.5, 11.5, .35, .6, "ink"),
    rect(12, 8, 6, 1, "light"), rect(21, 18, 3, 1, "gold"), line(10, 21, 19, 23, .7, "darkArmor"),
])
save("boss-rhino-horn", [
    poly([(0.5, 19), (4, 14), (10, 11), (15, 7), (22, 2.5), (29.5, 1.5), (31, 4), (27, 9), (22, 12), (18, 17), (27, 21), (29, 26), (24, 29), (16, 23), (10, 21), (4, 22)], "ink"),
    poly([(4, 18), (9, 15), (14, 12), (18, 8), (24, 4.5), (28, 4), (24, 8), (20, 12), (16, 17), (21, 19), (25, 23), (23, 25), (16, 21), (10, 19), (5, 20)], "gold"),
    poly([(10, 15), (15, 12), (18, 9), (21, 8), (18, 14), (15, 17), (21, 21), (18, 21), (13, 18)], "orangeLight"),
    line(6, 18, 15, 18, .7, "goldDark"), rect(23, 5, 4, .8, "light"),
])
save("boss-rhino-leg", [
    poly([(2, 6), (7, 3), (13, 4), (17, 8), (16, 12), (21, 16), (27, 19), (30, 24), (28, 29), (23, 30), (19, 26), (13, 21), (8, 18), (3, 15)], "ink"),
    poly([(5, 7), (9, 5), (13, 6), (14, 9), (13, 12), (19, 18), (25, 21), (27, 25), (25, 27), (22, 24), (17, 21), (11, 16), (6, 14)], "steel"),
    ellipse(11, 10, 3.1, 2.7, "metal"), ellipse(11, 10, 1.3, 1.1, "joint"),
    line(14, 16, 23, 23, 1.2, "light"), rect(24, 24, 4, 2, "armor"), rect(6, 8, 4, 1, "light"),
])


# Scorpion ------------------------------------------------------------------
save("boss-scorpion-body", [
    poly([(1, 11), (4, 5), (11, 2), (20, 2.5), (27, 7), (31, 14), (29, 23), (22, 29), (13, 30), (5, 25), (1, 18)], "ink"),
    poly([(4, 11), (8, 6), (15, 4), (22, 5), (27, 10), (28, 18), (23, 24), (16, 27), (8, 23), (4, 18)], "redDark"),
    poly([(8, 11), (13, 7), (19, 7), (24, 11), (25, 17), (21, 22), (15, 24), (10, 20)], "red"),
    line(14, 6, 15, 24, .8, "redLight"), line(6, 16, 25, 16, .65, "rustDark"),
    ellipse(10, 13, 1, .7, "orangeLight"), ellipse(21, 19, 1.2, .7, "rustLight"),
    *flecks([(7, 10), (12, 8), (20, 9), (23, 14), (18, 22), (10, 20)], "redLight", .4),
])
save("boss-scorpion-shell", [
    poly([(2, 12), (6, 5), (14, 2), (23, 4), (29, 10), (30, 20), (24, 28), (14, 30), (5, 24)], "ink"),
    poly([(5, 12), (9, 7), (15, 5), (22, 7), (26, 11), (27, 19), (21, 25), (14, 26), (7, 22)], "violetDark"),
    poly([(8, 12), (12, 8), (18, 8), (23, 11), (24, 17), (20, 22), (14, 23), (10, 20)], "violet"),
    poly([(10, 11), (14, 9), (19, 10), (22, 13), (21, 16), (10, 15)], "violetLight"),
    line(15, 7, 15, 24, 1, "violetDark"), line(7, 18, 23, 18, .8, "redDark"),
    rect(11, 12, 3, 1, "light"), rect(18, 20, 3, 1, "gold"),
])
save("boss-scorpion-head", [
    poly([(2, 12), (7, 6), (14, 3), (22, 5), (26, 10), (31, 13), (30, 20), (25, 21), (21, 27), (12, 28), (4, 22), (2, 17)], "ink"),
    poly([(6, 12), (11, 8), (17, 7), (22, 10), (24, 14), (28, 16), (24, 19), (20, 23), (13, 23), (7, 19)], "red"),
    ellipse(18, 11.5, 1.2, .9, "eye"), ellipse(18, 11.5, .4, .65, "ink"), ellipse(18, 20.5, 1.2, .9, "eye"), ellipse(18, 20.5, .4, .65, "ink"),
    rect(24, 15, 5, 1.2, "redLight"), line(8, 21, 18, 24, .7, "redDark"),
])
save("boss-scorpion-claw", [
    poly([(0.5, 12), (5, 6), (12, 5), (18, 8), (22, 11), (28, 10), (31.5, 12.5), (29, 16), (23, 16), (19, 21), (16, 27), (10, 29), (7, 25), (10, 19), (3, 19)], "ink"),
    poly([(4, 12), (8, 8), (13, 8), (17, 11), (20, 14), (27, 13), (29, 14), (24, 15), (19, 18), (16, 23), (12, 26), (10, 24), (13, 17), (7, 16)], "violet"),
    poly([(21, 12), (28, 11), (31, 13), (28, 14), (23, 14)], "violetLight"), poly([(22, 16), (29, 16), (31, 18), (28, 19), (22, 18)], "violetLight"),
    rect(9, 10, 6, 1, "light"), *[rect(x, 13.8 + (x % 2) * 2, 1, 1, "goldDark") for x in [24, 26, 28]],
])
save("boss-scorpion-tail", [
    poly([(1, 11), (5, 5), (13, 2.5), (21, 4), (28, 8), (31, 14), (28, 22), (21, 28), (12, 29), (5, 24), (1, 18)], "ink"),
    poly([(5, 11), (9, 7), (15, 6), (21, 8), (26, 12), (27, 17), (22, 22), (16, 25), (10, 22), (5, 18)], "redDark"),
    poly([(8, 10), (13, 8), (18, 9), (23, 12), (24, 16), (20, 20), (15, 22), (10, 19)], "red"),
    line(11, 8, 12, 22, .9, "rustLight"), line(17, 9, 18, 23, .9, "redLight"), line(22, 11, 21, 19, .8, "rustLight"),
    rect(8, 12, 3, 1, "gold"), rect(14, 11, 3, 1, "gold"), rect(20, 14, 3, 1, "gold"),
])
save("boss-scorpion-stinger", [
    poly([(3, 23), (7, 13), (12, 6), (18, 1), (24, 1), (27, 4), (23, 10), (19, 15), (17, 23), (12, 30), (7, 29)], "ink"),
    poly([(8, 23), (11, 15), (15, 8), (20, 3), (23, 4), (20, 10), (16, 16), (14, 23), (11, 27)], "gold"),
    poly([(14, 14), (19, 7), (21, 5), (18, 12), (15, 19)], "orangeLight"), ellipse(17, 8, .7, .7, "redLight"),
])
save("boss-scorpion-leg", [
    poly([(3, 7), (8, 3.5), (14, 4), (18, 8), (17, 13), (22, 17), (28, 20), (30, 25), (27, 29), (22, 27), (15, 21), (10, 18), (4, 14)], "ink"),
    poly([(6, 8), (10, 6), (13, 7), (14, 10), (13, 13), (19, 19), (25, 22), (27, 25), (25, 26), (21, 23), (15, 19), (9, 15), (6, 12)], "violet"),
    ellipse(11, 10, 2.5, 2.2, "violetLight"), ellipse(11, 10, 1, .8, "violetDark"), line(15, 16, 24, 24, 1, "redLight"), rect(24, 24, 4, 2, "red"),
])


# Millipede -----------------------------------------------------------------
def segment_shell(name, base, dark, highlight, ridge, style):
    layers = [
        poly([(1.5, 10), (4, 4), (11, 1.5), (21, 2), (28, 6), (30.5, 13), (29, 23), (23, 29), (11, 30), (3, 25), (1.5, 18)], "ink"),
        poly([(4, 10), (7, 6), (12, 4), (20, 4), (25, 7), (27.5, 13), (26, 21), (21, 26), (12, 27), (6, 23), (4, 18)], dark),
        poly([(7, 10), (10, 7), (15, 6), (21, 7), (24, 11), (24, 18), (20, 23), (14, 24), (9, 21), (7, 17)], base),
        line(8, 11, 24, 12, .75, highlight), line(15.5, 7, 15.5, 24, 1, ridge), rect(9, 15, 5, 1, highlight), rect(18, 20, 4, 1, dark),
    ]
    if style == 0:
        layers += [line(8, 18, 23, 19, .7, ridge), rect(12, 8, 2, 2, highlight)]
    elif style == 1:
        layers += [line(9, 9, 22, 22, .7, ridge), line(21, 9, 10, 22, .7, highlight), ellipse(19, 14, 1, .8, highlight)]
    elif style == 2:
        layers += [line(8, 14, 23, 14, .8, ridge), line(9, 20, 22, 20, .8, ridge), rect(17, 8, 3, 1.2, highlight)]
    elif style == 3:
        layers += [poly([(9, 9), (14, 8), (18, 10), (17, 13), (10, 12)], highlight), poly([(16, 16), (22, 15), (23, 19), (18, 21)], dark)]
    elif style == 4:
        layers += [line(9, 8, 12, 23, .8, ridge), line(18, 7, 21, 23, .8, highlight), ellipse(12, 17, 1, .8, highlight)]
    else:
        layers += [line(8, 12, 23, 22, .8, ridge), line(9, 22, 23, 11, .8, highlight), rect(14, 9, 2, 2, highlight)]
    layers += [line(10 + i * 2.4, 7.5, 8.5 + i * 2.4, 10, .3, dark) for i in range(5)]
    layers += [line(10 + i * 2.4, 22, 11 + i * 2.4, 24, .3, highlight) for i in range(4)]
    layers += flecks([(8.5, 13), (11, 24), (20, 9), (22, 18), (17, 22)], highlight, .35)
    save(name, layers)


for index, (base, dark, highlight, ridge) in enumerate([
    ("ochre", "ochreDark", "ochreLight", "goldDark"), ("ochre", "ochreDark", "gold", "goldDark"),
    ("ochre", "rustDark", "ochreLight", "goldDark"), ("ochre", "ochreDark", "rustLight", "goldDark"),
    ("ochre", "rustDark", "gold", "ochreDark"), ("ochre", "ochreDark", "ochreLight", "rustDark"),
]):
    segment_shell(f"boss-millipede-shell-{chr(65 + index)}", base, dark, highlight, ridge, index)

save("boss-millipede-body", [
    poly([(2, 10), (5, 4), (12, 2), (22, 3), (29, 9), (30, 22), (24, 29), (10, 30), (3, 23)], "ink"),
    poly([(5, 10), (8, 6), (14, 4.5), (21, 5), (26, 10), (27, 20), (22, 25), (11, 26), (6, 21)], "ochreDark"),
    poly([(8, 11), (12, 7), (19, 7), (23, 11), (23, 19), (19, 23), (12, 23), (8, 19)], "ochre"),
    line(9, 11, 22, 12, .8, "ochreLight"), line(15, 7, 15, 23, 1, "goldDark"), rect(10, 15, 4, 1, "ochreLight"), rect(18, 20, 3, 1, "ochreDark"),
    *flecks([(9, 13), (11, 22), (20, 9), (21, 18)], "ochreLight", .4),
])
save("boss-millipede-body-weak", [
    poly([(2, 10), (5, 4), (12, 2), (22, 3), (29, 9), (30, 22), (24, 29), (10, 30), (3, 23)], "ink"),
    poly([(5, 10), (8, 6), (14, 4.5), (21, 5), (26, 10), (27, 20), (22, 25), (11, 26), (6, 21)], "scar"),
    poly([(8, 11), (12, 7), (19, 7), (23, 11), (23, 19), (19, 23), (12, 23), (8, 19)], "rustDark"),
    poly([(10, 10), (14, 8), (18, 9), (22, 13), (19, 16), (11, 15)], "scarLight"),
    line(15, 7, 15, 23, 1, "ink"), rect(10, 18, 6, 2, "scarLight"), ellipse(21, 19, 1, .7, "gold"),
])
save("boss-millipede-shell-weak", [
    poly([(1.5, 10), (4, 4), (11, 1.5), (21, 2), (28, 6), (30.5, 13), (29, 23), (23, 29), (11, 30), (3, 25), (1.5, 18)], "ink"),
    poly([(4, 10), (7, 6), (12, 4), (20, 4), (25, 7), (27.5, 13), (26, 21), (21, 26), (12, 27), (6, 23), (4, 18)], "scar"),
    poly([(7, 10), (10, 7), (15, 6), (21, 7), (24, 11), (24, 18), (20, 23), (14, 24), (9, 21), (7, 17)], "scarLight"),
    poly([(11, 8), (14, 10), (13, 15), (17, 17), (20, 23), (16, 24), (12, 18), (9, 17)], "ink"),
    line(20, 8, 22, 22, 1, "gold"), ellipse(10, 13, 1, .7, "orangeLight"), ellipse(20, 19, 1, .7, "orangeLight"),
])
save("boss-millipede-neck-body", [
    poly([(2, 10), (5, 4), (12, 2), (22, 3), (29, 9), (30, 22), (24, 29), (10, 30), (3, 23)], "ink"),
    poly([(5, 10), (8, 6), (14, 4.5), (21, 5), (26, 10), (27, 20), (22, 25), (11, 26), (6, 21)], "rustDark"),
    poly([(8, 11), (12, 7), (19, 7), (23, 11), (23, 19), (19, 23), (12, 23), (8, 19)], "rust"),
    rect(10, 10, 4, 2, "redLight"), line(15, 7, 15, 23, 1, "redDark"), ellipse(20, 13, 1, .8, "gold"),
])
save("boss-millipede-neck-shell", [
    poly([(1.5, 10), (4, 4), (11, 1.5), (21, 2), (28, 6), (30.5, 13), (29, 23), (23, 29), (11, 30), (3, 25), (1.5, 18)], "ink"),
    poly([(4, 10), (7, 6), (12, 4), (20, 4), (25, 7), (27.5, 13), (26, 21), (21, 26), (12, 27), (6, 23), (4, 18)], "redDark"),
    poly([(7, 10), (10, 7), (15, 6), (21, 7), (24, 11), (24, 18), (20, 23), (14, 24), (9, 21), (7, 17)], "red"),
    line(9, 11, 23, 12, 1, "redLight"), line(15, 7, 15, 24, 1, "rustDark"), rect(19, 19, 4, 1, "gold"),
])
save("boss-millipede-tail-body", [
    poly([(5, 7), (12, 3), (21, 4), (28, 9), (30, 16), (27, 24), (20, 29), (11, 27), (5, 21)], "ink"),
    poly([(8, 9), (13, 6), (20, 7), (25, 11), (26, 17), (23, 22), (18, 26), (12, 24), (8, 19)], "oliveDark"),
    poly([(11, 10), (15, 8), (20, 9), (23, 12), (23, 17), (20, 21), (16, 23), (12, 21)], "olive"),
    line(13, 9, 15, 22, .8, "oliveLight"), line(19, 10, 20, 21, .8, "gold"), rect(21, 14, 3, 1, "light"),
])
save("boss-millipede-tail-shell", [
    poly([(5, 7), (12, 3), (21, 4), (28, 9), (30, 16), (27, 24), (20, 29), (11, 27), (5, 21)], "ink"),
    poly([(8, 9), (13, 6), (20, 7), (25, 11), (26, 17), (23, 22), (18, 26), (12, 24), (8, 19)], "darkArmor"),
    poly([(11, 10), (15, 8), (20, 9), (23, 12), (23, 17), (20, 21), (16, 23), (12, 21)], "steel"),
    line(12, 9, 15, 22, .9, "light"), line(19, 9, 20, 21, .9, "metal"), rect(21, 14, 3, 1, "gold"),
])
save("boss-millipede-head", [
    poly([(1, 11), (5, 5), (12, 2), (20, 3), (26, 8), (29, 14), (32, 16), (28, 20), (25, 27), (17, 30), (8, 25), (2, 19)], "ink"),
    poly([(5, 11), (9, 7), (15, 5), (21, 7), (24, 12), (27, 16), (23, 19), (21, 24), (16, 26), (10, 22), (6, 18)], "ochre"),
    poly([(9, 11), (13, 8), (18, 8), (22, 11), (23, 15), (20, 18), (17, 22), (12, 20), (9, 17)], "ochreLight"),
    ellipse(18, 11, 1.3, 1, "eye"), ellipse(18, 11, .4, .7, "ink"), ellipse(19, 20, 1.2, .9, "eye"), ellipse(19, 20, .4, .6, "ink"),
    poly([(22, 10), (31, 4), (31.5, 6), (25, 14)], "oliveLight"), poly([(23, 22), (30, 29), (28, 30), (21, 25)], "oliveLight"),
    rect(10, 9, 6, 1, "light"), line(8, 20, 17, 24, .7, "ochreDark"),
])
save("boss-millipede-leg", [
    poly([(3, 6), (8, 3), (14, 4), (17, 8), (16, 12), (22, 17), (28, 21), (30, 26), (27, 30), (21, 26), (15, 21), (10, 18), (3, 14)], "ink"),
    poly([(6, 8), (10, 6), (13, 7), (14, 10), (13, 13), (19, 19), (25, 22), (27, 26), (25, 27), (21, 23), (15, 19), (8, 15), (6, 12)], "ochre"),
    ellipse(11, 10, 2.2, 2, "ochreLight"), ellipse(11, 10, .8, .7, "ochreDark"), line(15, 16, 24, 24, 1, "oliveLight"),
])


if __name__ == "__main__":
    print("generated high-resolution rhino, scorpion, and millipede boss parts")
