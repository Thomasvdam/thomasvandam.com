"""Hand-authored 32px pixel parts; fixed pivots, no imaging dependencies.

Parts face right and attach at (16,16); bug limbs hinge at (8,16).
Animation is independent of artwork: app/exterminator/animation.ts.
"""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent / "public" / "images" / "exterminator"
COLORS = {
    "ink": (13, 24, 24), "joint": (38, 52, 48), "steel": (69, 89, 83),
    "metal": (112, 137, 126), "light": (178, 196, 159), "armor": (116, 151, 122),
    "darkArmor": (64, 96, 78), "glass": (109, 204, 205), "white": (221, 228, 198),
    "gold": (231, 189, 100), "orange": (226, 128, 68), "rustDark": (76, 43, 35),
    "rust": (161, 79, 48), "rustLight": (218, 144, 73), "oliveDark": (51, 66, 43),
    "olive": (109, 133, 72), "oliveLight": (179, 191, 106), "wing": (157, 182, 139),
    "wingLight": (211, 218, 164),
    "redDark": (73, 32, 37), "red": (176, 60, 56), "redLight": (244, 147, 103),
    "blueDark": (31, 56, 69), "blue": (66, 136, 151), "blueLight": (151, 218, 205),
    "ochreDark": (77, 57, 28), "ochre": (160, 122, 49), "ochreLight": (232, 191, 101),
    "violetDark": (49, 36, 57), "violet": (113, 78, 125), "violetLight": (185, 144, 181),
    "slateDark": (39, 47, 54), "slate": (95, 114, 120), "slateLight": (178, 190, 175),
}


def inside(x, y, points):
    result = False
    for i, (ax, ay) in enumerate(points):
        bx, by = points[i - 1]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


def poly(points, color):
    return points, COLORS.get(color, color)


def rect(x, y, width, height, color):
    return poly([(x, y), (x + width, y), (x + width, y + height), (x, y + height)], color)


def board(layers):
    return [[next((color for points, color in reversed(layers) if inside(x + .5, y + .5, points)), None) for x in range(32)] for y in range(32)]


def chunk(name, data):
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))


def save(name, pixels):
    size = len(pixels)
    rows = bytearray()
    for row in pixels:
        rows.append(0)
        for color in row:
            rows.extend((*color, 255) if color else (0, 0, 0, 0))
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
    path = ROOT / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


PARTS = {}


def part(name, layers):
    pixels = board(layers)
    PARTS[name] = pixels
    save(f"parts/{name}", pixels)


part("mech-chassis", [
    rect(7, 8, 17, 17, "ink"), rect(9, 10, 13, 13, "joint"),
    rect(11, 10, 9, 3, "metal"), rect(11, 20, 9, 2, "steel"),
    rect(5, 12, 4, 8, "ink"), rect(6, 13, 3, 6, "metal"),
    rect(22, 12, 4, 8, "ink"), rect(22, 13, 3, 6, "metal"),
])
part("mech-torso", [
    poly([(6, 10), (11, 6), (22, 6), (27, 11), (27, 21), (22, 25), (11, 25), (6, 21)], "ink"),
    poly([(8, 11), (12, 8), (21, 8), (25, 12), (25, 20), (21, 23), (12, 23), (8, 20)], "darkArmor"),
    rect(11, 8, 10, 4, "light"), rect(9, 12, 15, 7, "armor"),
    rect(13, 12, 8, 2, "ink"), rect(14, 12, 6, 1, "glass"),
    rect(10, 20, 4, 2, "gold"), rect(18, 20, 5, 2, "steel"),
    rect(8, 14, 2, 3, "light"), rect(23, 16, 2, 4, "metal"),
])

for name, plate, accent, width in [
    ("mech-foot", "steel", "metal", 18),
    ("mech-servo-foot", "armor", "gold", 20),
    ("mech-sprint-foot", "darkArmor", "gold", 21),
    ("mech-boost-foot", "light", "orange", 22),
]:
    layers = [rect(5, 10, width, 13, "ink"), rect(7, 11, width - 3, 10, plate),
              rect(9, 12, width - 6, 2, "metal"), rect(9, 16, 5, 4, "joint"),
              rect(17, 16, width - 13, 4, accent), rect(7, 20, width - 3, 2, "joint")]
    if name != "mech-foot":
        layers += [rect(4, 13, 4, 6, "ink"), rect(5, 14, 3, 4, accent), rect(11, 17, 2, 3, "white")]
    part(name, layers)

# Wheel and tread modules share the feet's registration and attachment bones.
part("mech-wheel", [rect(7, 10, 19, 13, "ink"), rect(9, 11, 15, 11, "joint"),
                    rect(13, 11, 7, 11, "steel"), rect(15, 13, 3, 7, "metal")] +
     [rect(x, 10, 2, 3, "metal") for x in range(9, 24, 4)] +
     [rect(x, 21, 2, 2, "steel") for x in range(9, 24, 4)])
part("mech-tread", [rect(2, 9, 28, 15, "ink"), rect(3, 10, 26, 13, "joint"),
                    rect(5, 13, 22, 7, "steel"), rect(8, 14, 16, 4, "armor")] +
     [rect(x, y, 3, 3, "metal") for x in range(4, 28, 4) for y in [10, 20]])

# Four compatible speed stages per undercarriage: stock, servo, sprint, boost.
for stage, plate, accent, size in [
    ("servo", "armor", "gold", 21),
    ("sprint", "darkArmor", "gold", 23),
    ("boost", "light", "orange", 25),
]:
    left = 16 - size // 2
    wheel = [rect(left - 1, 8, size + 2, 17, "ink"),
             rect(left, 9, size, 15, "joint"), rect(left + 2, 11, size - 4, 11, plate),
             rect(12, 11, 8, 11, "ink"), rect(13, 12, 6, 9, accent),
             rect(14, 13, 4, 2, "white")]
    wheel += [rect(x, y, 2, 2, "metal") for x in range(left, left + size, 4) for y in [9, 22]]
    if stage != "servo":
        wheel += [rect(left - 2, 12, 4, 9, "ink"), rect(left - 1, 13, 3, 7, accent)]
    if stage == "boost":
        wheel += [rect(24, 7, 4, 3, "ink"), rect(25, 8, 2, 2, "orange")]
    part(f"mech-{stage}-wheel", wheel)
    tread = [rect(1, 7, 30, 19, "ink"), rect(2, 8, 28, 17, "joint"),
             rect(4, 11, 24, 11, plate), rect(7, 12, 18, 3, "metal"),
             rect(8, 17, 16, 3, accent)]
    tread += [rect(x, y, 3, 3, "metal") for x in range(3, 29, 4) for y in [8, 22]]
    if stage != "servo":
        tread += [rect(3, 12, 5, 9, "ink"), rect(4, 13, 3, 7, accent),
                  rect(13, 15, 2, 6, "joint"), rect(18, 15, 2, 6, "joint")]
    if stage == "boost":
        tread += [rect(24, 12, 5, 9, "ink"), rect(25, 13, 3, 7, "orange"),
                  rect(10, 17, 2, 3, "white")]
    part(f"mech-{stage}-tread", tread)

for name, barrel, accent, twin in [
    ("mech-cannon", 8, "metal", False),
    ("mech-heavy-cannon", 10, "gold", False),
    ("mech-siege-cannon", 12, "orange", True),
]:
    layers = [rect(7, 10, 12, 13, "ink"), rect(9, 11, 8, 10, "steel"),
              rect(10, 11, 7, 3, "metal"), rect(11, 18, 6, 2, accent),
              rect(16, 12, barrel, 9, "ink"), rect(17, 13, barrel - 2, 6, "metal"),
              rect(19, 15, barrel - 4, 2, "joint"), rect(16 + barrel - 2, 13, 2, 6, accent)]
    if twin:
        layers += [rect(18, 15, 10, 2, "ink"), rect(24, 10, 3, 3, "gold"), rect(24, 21, 3, 2, "gold")]
    part(name, layers)

# Alternate weapons share the same weapon bone, pivot, and upgrade stages.
for stage, accent in [("", "metal"), ("heavy-", "gold"), ("siege-", "orange")]:
    for weapon in ["shotgun", "rpg", "flamethrower"]:
        layers = [rect(6, 10, 13, 13, "ink"), rect(8, 12, 9, 9, "steel"),
                  rect(9, 12, 7, 3, accent)]
        if weapon == "shotgun":
            layers += [rect(15, 10, 13, 13, "ink"), rect(16, 11, 10, 11, "metal"),
                       rect(19, 12, 8, 3, "joint"), rect(19, 18, 8, 3, "joint"),
                       rect(25, 11, 3, 11, accent)]
        elif weapon == "rpg":
            layers += [rect(3, 12, 26, 9, "ink"), rect(4, 13, 24, 7, "armor"),
                       rect(22, 11, 7, 11, "ink"), rect(23, 12, 5, 9, accent),
                       rect(26, 13, 2, 7, "joint"), rect(4, 13, 3, 7, "orange")]
        else:
            layers += [rect(13, 11, 16, 11, "ink"), rect(15, 13, 12, 7, "metal"),
                       rect(23, 12, 6, 9, accent), rect(26, 14, 3, 5, "joint"),
                       rect(5, 19, 11, 7, "ink"), rect(6, 20, 9, 5, "rust"),
                       rect(8, 20, 5, 2, "orange")]
        if stage:
            layers += [rect(9, 18, 3, 3, accent), rect(13, 18, 2, 3, "white")]
        if stage == "siege-":
            layers += [rect(17, 8, 7, 3, "ink"), rect(18, 9, 5, 2, accent)]
        part(f"mech-{stage}{weapon}", layers)

for name, length, accent in [("mech-cooler", 8, "steel"), ("mech-vent-cooler", 12, "gold"), ("mech-twin-cooler", 16, "orange")]:
    layers = [rect(16 - length // 2, 12, length, 10, "ink"), rect(17 - length // 2, 13, length - 2, 7, accent)]
    for x in range(18 - length // 2, 15 + length // 2, 3):
        layers += [rect(x, 14, 1, 5, "joint"), rect(x + 1, 14, 1, 1, "light")]
    part(name, layers)

for prefix, dark, base, highlight in [("rust", "rustDark", "rust", "rustLight"), ("olive", "oliveDark", "olive", "oliveLight"),
    ("lunger", "redDark", "red", "redLight"), ("evader", "blueDark", "blue", "blueLight"),
    ("centipede", "ochreDark", "ochre", "ochreLight"), ("armoured", "slateDark", "slate", "slateLight"), ("beetle", "violetDark", "violet", "violetLight")]:
    part(f"bug-{prefix}-body", [
        poly([(3, 12), (7, 7), (21, 7), (27, 12), (27, 21), (22, 25), (8, 25), (3, 20)], "ink"),
        poly([(5, 12), (8, 9), (21, 9), (25, 13), (25, 20), (21, 23), (8, 23), (5, 19)], dark),
        rect(9, 11, 13, 10, base), rect(7, 13, 2, 6, highlight),
    ])
    part(f"bug-{prefix}-shell", [
        poly([(5, 12), (9, 8), (20, 8), (24, 12), (24, 20), (20, 24), (9, 24), (5, 20)], dark),
        poly([(7, 12), (10, 10), (19, 10), (22, 13), (22, 19), (19, 22), (10, 22), (7, 19)], base),
        rect(10, 10, 9, 2, highlight), rect(14, 11, 2, 11, dark),
        rect(8, 14, 4, 2, highlight), rect(18, 15, 3, 2, highlight),
        rect(9, 19, 3, 1, dark), rect(18, 20, 3, 1, dark),
    ])
    part(f"bug-{prefix}-head", [
        poly([(10, 10), (17, 9), (22, 12), (23, 20), (17, 23), (10, 21)], "ink"),
        rect(12, 11, 7, 10, base), rect(13, 11, 5, 2, highlight),
        rect(18, 12, 3, 2, "gold"), rect(18, 19, 3, 2, "gold"),
        poly([(21, 12), (27, 10), (28, 12), (24, 15), (21, 15)], dark),
        poly([(21, 18), (24, 18), (28, 21), (27, 23), (21, 21)], dark),
        rect(25, 10, 2, 2, highlight), rect(25, 21, 2, 2, highlight),
    ])
    part(f"bug-{prefix}-leg", [
        poly([(6, 14), (13, 13), (18, 18), (27, 18), (29, 22), (27, 24), (16, 22), (11, 18), (6, 18)], "ink"),
        poly([(8, 15), (12, 15), (18, 20), (26, 20), (27, 22), (17, 21), (11, 17), (8, 17)], base),
        rect(8, 15, 3, 1, highlight), rect(18, 19, 6, 1, highlight), rect(26, 21, 2, 2, dark),
    ])

# Specialist parts retain the same rig registration, with distinct silhouettes.
part("bug-lunger-shell", [poly([(3, 13), (9, 6), (17, 10), (22, 15), (22, 19), (9, 26), (3, 21)], "redDark"),
    poly([(5, 14), (10, 9), (15, 12), (20, 16), (10, 23), (5, 20)], "red"),
    rect(7, 12, 3, 10, "redLight"), rect(12, 13, 2, 7, "gold")])
part("bug-lunger-head", [poly([(7, 12), (18, 9), (24, 12), (30, 7), (29, 15), (24, 17), (29, 20), (30, 26), (22, 22), (10, 22)], "ink"),
    rect(10, 12, 12, 9, "red"), rect(19, 12, 4, 2, "gold"), rect(19, 19, 4, 2, "gold"), rect(26, 10, 2, 4, "redLight"), rect(26, 21, 2, 3, "redLight")])
part("bug-evader-shell", [poly([(4, 16), (10, 7), (19, 10), (25, 16), (18, 24), (10, 25)], "blueDark"),
    poly([(6, 16), (11, 10), (18, 12), (22, 16), (17, 21), (11, 22)], "blue"),
    rect(8, 15, 11, 2, "blueLight"), rect(11, 11, 2, 3, "white"), rect(11, 19, 2, 3, "white")])
part("bug-centipede-shell", [poly([(6, 11), (11, 7), (21, 8), (25, 13), (25, 21), (20, 25), (10, 24), (6, 20)], "ochreDark"),
    rect(8, 11, 15, 10, "ochre"), rect(10, 9, 10, 3, "ochreLight"),
    rect(12, 12, 2, 11, "ochreDark"), rect(18, 12, 2, 11, "ochreDark"), rect(21, 13, 2, 6, "gold")])
part("bug-armoured-shell", [poly([(3, 11), (10, 3), (22, 3), (30, 8), (31, 24), (22, 29), (10, 29), (3, 21)], "ink"),
    poly([(5, 12), (11, 5), (21, 5), (28, 10), (29, 22), (21, 27), (11, 27), (5, 20)], "slateDark"),
    poly([(13, 7), (22, 6), (28, 11), (28, 21), (22, 26), (13, 25)], "slate"),
    rect(23, 10, 4, 13, "slateLight"), rect(12, 6, 3, 20, "metal"), rect(18, 9, 3, 3, "slateLight"), rect(18, 21, 3, 3, "slateLight")])
part("bug-armoured-head", [rect(10, 11, 12, 11, "ink"), rect(12, 13, 8, 7, "slateDark"), rect(18, 12, 3, 2, "orange"), rect(18, 19, 3, 2, "orange")])

part("bug-beetle-shell", [poly([(2, 12), (7, 5), (18, 4), (25, 9), (27, 16), (24, 24), (15, 28), (6, 25), (2, 20)], "ink"),
    poly([(4, 12), (8, 7), (17, 6), (23, 10), (25, 16), (22, 23), (15, 26), (7, 23), (4, 19)], "violetDark"),
    poly([(7, 11), (12, 8), (20, 10), (23, 16), (20, 22), (12, 24), (7, 20)], "violet"),
    rect(8, 11, 11, 2, "violetLight"), rect(14, 8, 2, 16, "violetDark"), rect(7, 15, 2, 5, "violetLight")])
part("bug-beetle-head", [poly([(9, 12), (19, 9), (24, 12), (29, 15), (30, 18), (24, 18), (20, 23), (9, 21)], "ink"),
    rect(11, 12, 10, 9, "violet"), rect(19, 12, 3, 2, "gold"), rect(19, 19, 3, 2, "gold"), rect(24, 15, 4, 2, "violetLight")])
save("dung-ball", board([poly([(5, 10), (11, 4), (21, 4), (28, 11), (28, 21), (21, 28), (11, 28), (4, 21)], "ink"),
    poly([(7, 11), (12, 6), (20, 6), (26, 12), (26, 20), (20, 26), (12, 26), (6, 20)], "rustDark"),
    rect(9, 10, 12, 10, "ochreDark"), rect(10, 8, 9, 3, "ochre"), rect(8, 13, 3, 6, "ochre"), rect(18, 18, 5, 4, "oliveDark"), rect(13, 20, 3, 3, "rust")]))

part("bug-wing", [
    poly([(7, 15), (13, 7), (23, 4), (28, 8), (30, 14), (27, 21), (17, 24), (10, 20)], "oliveDark"),
    poly([(9, 15), (14, 9), (23, 6), (26, 9), (28, 14), (25, 19), (17, 22), (12, 19)], "wing"),
    poly([(11, 15), (17, 10), (24, 8), (24, 10), (17, 13)], "wingLight"),
    poly([(10, 16), (26, 13), (26, 14), (11, 18)], "olive"),
    poly([(16, 13), (18, 21), (16, 21), (14, 14)], "olive"),
])
save("rocket", board([rect(5, 12, 19, 9, "ink"), rect(8, 13, 15, 7, "metal"), poly([(23, 12), (30, 16), (23, 21)], "orange"), rect(3, 14, 6, 5, "gold"), rect(10, 10, 5, 3, "armor"), rect(10, 21, 5, 3, "armor")]))
save("flame", board([poly([(2, 16), (11, 11), (15, 4), (20, 11), (26, 8), (30, 17), (25, 24), (16, 29), (6, 23)], "orange"), poly([(6, 16), (15, 12), (18, 8), (22, 17), (19, 24), (10, 22)], "gold"), rect(10, 15, 8, 6, "white")]))
save("bullet", board([rect(7, 13, 20, 6, "orange"), rect(11, 14, 15, 4, "gold"), rect(21, 14, 5, 4, "white")]))



# Subtle per-part cosmetic alternatives: identical registration and silhouette.
# Small palette shifts preserve each combat type's identifying colour family.
for name, pixels in list(PARTS.items()):
    if not name.startswith("bug-") or name == "bug-wing":
        continue
    for suffix, factors in [("b", (1.08, 1.02, .91)), ("c", (.92, 1.04, 1.10))]:
        variant = [[tuple(max(0, min(255, round(channel * factor))) for channel, factor in zip(color, factors)) if color else None for color in row] for row in pixels]
        if name.endswith("-shell"):
            # A few differently placed shell markings, without changing its outline.
            for x, y in ([(10, 13), (18, 19)] if suffix == "b" else [(11, 18), (19, 13)]):
                if variant[y][x]:
                    variant[y][x] = tuple(min(255, channel + 24) for channel in variant[y][x])
        save(f"parts/{name}-{suffix}", variant)


def thumbnail(name, layers, scale=1.65):
    pixels = [[None for _ in range(64)] for _ in range(64)]
    for part_name, x, y, angle, pivot_x, flip in layers:
        source, cos, sin = PARTS[part_name], math.cos(angle), math.sin(angle)
        for py in range(64):
            for px in range(64):
                dx, dy = (px + .5 - 32) / scale - x, (py + .5 - 32) / scale - y
                sx = math.floor(dx * cos + dy * sin + pivot_x)
                sy = math.floor((-dx * sin + dy * cos) * flip + 16)
                if 0 <= sx < 32 and 0 <= sy < 32 and source[sy][sx]:
                    pixels[py][px] = source[sy][sx]
    save(name, pixels)


thumbnail("player", [("mech-foot", -3, -10, 0, 16, 1), ("mech-foot", -3, 10, 0, 16, -1),
                     ("mech-chassis", 0, 0, 0, 16, 1), ("mech-torso", 0, 0, 0, 16, 1),
                     ("mech-cooler", -5, 7, 0, 16, 1), ("mech-cannon", 7, -5, 0, 16, 1)])
bug_layers = []
for side in [-1, 1]:
    for row in [-1, 0, 1]:
        bug_layers.append(("bug-rust-leg", row * 6, side * 6, side * (math.pi / 2 - row * .55), 8, -1 if side < 0 else 1))
bug_layers += [("bug-rust-body", -2, 0, 0, 16, 1), ("bug-rust-shell", -3, 0, 0, 16, 1), ("bug-rust-head", 10, 0, 0, 16, 1)]
thumbnail("enemy", bug_layers, 1.2)
flying_layers = [(name.replace("rust", "olive"), x, y, angle, pivot, flip) for name, x, y, angle, pivot, flip in bug_layers[:6]]
flying_layers += [("bug-olive-body", -2, 0, 0, 16, 1), ("bug-wing", -4, -5, -math.pi / 2, 8, -1), ("bug-wing", -4, 5, math.pi / 2, 8, 1), ("bug-olive-shell", -3, 0, 0, 16, 1), ("bug-olive-head", 10, 0, 0, 16, 1)]
thumbnail("flyer", flying_layers, 1.2)
