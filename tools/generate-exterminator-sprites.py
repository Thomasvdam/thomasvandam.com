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
    "acidDark": (32, 57, 30), "acid": (92, 147, 47), "acidLight": (188, 227, 99),
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
    ("centipede", "ochreDark", "ochre", "ochreLight"), ("armoured", "slateDark", "slate", "slateLight"), ("beetle", "violetDark", "violet", "violetLight"), ("spitter", "acidDark", "acid", "acidLight")]:
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

part("bug-spitter-shell", [poly([(1, 13), (5, 6), (16, 5), (24, 10), (25, 22), (16, 27), (5, 26), (1, 20)], "ink"),
    poly([(3, 13), (7, 8), (15, 7), (22, 11), (23, 21), (15, 25), (7, 24), (3, 19)], "acidDark"),
    poly([(5, 12), (9, 9), (15, 9), (21, 13), (21, 20), (15, 23), (7, 22), (5, 18)], "acid"),
    rect(7, 11, 10, 3, "acidLight"), rect(6, 17, 4, 4, "acidLight"), rect(14, 17, 5, 4, "acidDark"), rect(15, 18, 3, 2, "acidLight")])
part("bug-spitter-head", [poly([(8, 11), (17, 9), (23, 12), (29, 13), (31, 16), (29, 20), (22, 20), (17, 24), (8, 21)], "ink"),
    rect(10, 12, 11, 9, "acidDark"), rect(11, 12, 6, 3, "acid"), rect(18, 11, 3, 3, "acidLight"), rect(18, 20, 3, 2, "acidLight"),
    rect(21, 14, 8, 5, "acid"), rect(26, 15, 4, 3, "acidLight"), rect(28, 16, 2, 1, "white")])
save("acid", board([poly([(3, 16), (12, 9), (23, 8), (30, 14), (30, 19), (23, 24), (12, 23)], "acidDark"),
    poly([(7, 16), (15, 11), (23, 10), (28, 15), (27, 19), (22, 22), (14, 21)], "acid"),
    rect(17, 12, 7, 6, "acidLight"), rect(22, 13, 3, 2, "white")]))

# Ants share the six-leg rig but have a pinched waist, separate abdomen, and antennae.
for prefix, dark, base, light in [("queen", "ochreDark", "ochre", "ochreLight"),
        ("worker", "rustDark", "rust", "rustLight"), ("soldier", "redDark", "red", "redLight"),
        ("bulletant", "blueDark", "blue", "acidLight")]:
    part(f"bug-{prefix}-body", [poly([(3, 14), (8, 11), (12, 14), (17, 11), (25, 13), (27, 16), (24, 20), (17, 21), (12, 18), (7, 21), (3, 18)], "ink"),
        rect(6, 14, 14, 4, dark), rect(17, 13, 7, 6, base), rect(18, 13, 4, 2, light)])
    abdomen = [(0, 13), (4, 8), (11, 7), (17, 11), (19, 16), (17, 21), (11, 25), (4, 24), (0, 20)]
    if prefix == "queen":
        abdomen = [(0, 10), (5, 4), (16, 4), (24, 10), (26, 16), (24, 23), (16, 28), (5, 28), (0, 23)]
    part(f"bug-{prefix}-shell", [poly(abdomen, "ink"),
        poly([(2, 13), (6, 9), (11, 9), (16, 12), (17, 17), (15, 21), (10, 23), (5, 22), (2, 19)], base),
        rect(5, 10, 6, 2, light), rect(8, 13, 2, 9, dark), rect(13, 13, 2, 7, dark)] +
        ([rect(18, 9, 3, 14, base), rect(22, 12, 2, 8, light), rect(4, 6, 12, 2, light), rect(5, 25, 11, 1, light)] if prefix == "queen" else []))
    head = [poly([(9, 12), (17, 9), (23, 12), (25, 16), (23, 21), (17, 23), (9, 20)], "ink"),
        rect(11, 12, 10, 9, base), rect(13, 12, 5, 2, light), rect(20, 12, 2, 2, "gold"), rect(20, 19, 2, 2, "gold"),
        poly([(13, 11), (17, 5), (25, 3), (25, 5), (19, 7), (16, 12)], dark),
        poly([(13, 21), (17, 27), (25, 29), (25, 27), (19, 25), (16, 20)], dark)]
    if prefix == "soldier":
        head += [poly([(21, 11), (29, 9), (31, 13), (26, 15), (24, 13)], light), poly([(21, 21), (29, 24), (31, 20), (26, 18), (24, 20)], light)]
    elif prefix == "worker":
        head += [rect(11, 10, 6, 3, light), rect(11, 20, 6, 3, light), rect(23, 14, 4, 5, dark)]
    elif prefix == "bulletant":
        head += [rect(21, 14, 9, 5, "ink"), rect(23, 15, 7, 3, "acid"), rect(27, 15, 3, 2, "acidLight")]
    else:
        head += [rect(14, 12, 2, 9, light), rect(23, 14, 3, 5, dark)]
    part(f"bug-{prefix}-head", head)
    part(f"bug-{prefix}-leg", [poly([(6, 15), (13, 14), (19, 18), (26, 20), (26, 23), (18, 21), (12, 17), (6, 18)], "ink"),
        poly([(8, 15), (12, 15), (19, 19), (24, 21), (24, 22), (18, 20), (12, 17), (8, 17)], base), rect(9, 15, 3, 1, light)])

# Slugs glide without legs; the long body and mantle pulse on the shared rig.
part("bug-slug-body", [poly([(0, 17), (5, 11), (16, 7), (26, 10), (31, 15), (28, 23), (16, 25), (5, 22)], "ink"),
    poly([(2, 17), (7, 12), (16, 9), (25, 12), (28, 16), (25, 21), (16, 23), (6, 20)], "olive"), rect(7, 19, 18, 2, "wingLight"), rect(11, 11, 10, 2, "wing")])
part("bug-slug-shell", [poly([(5, 14), (11, 8), (20, 8), (25, 13), (25, 20), (18, 23), (9, 22), (5, 19)], "oliveDark"),
    poly([(8, 14), (12, 10), (19, 10), (23, 14), (22, 19), (17, 21), (10, 20)], "wing"), rect(12, 11, 7, 2, "wingLight"), rect(15, 15, 2, 4, "olive")])
part("bug-slug-head", [poly([(8, 13), (16, 11), (24, 13), (26, 18), (23, 22), (13, 22), (8, 19)], "ink"),
    rect(10, 14, 13, 6, "olive"), rect(12, 14, 9, 2, "wing"), rect(18, 6, 2, 8, "oliveDark"), rect(18, 20, 2, 8, "oliveDark"),
    rect(18, 5, 3, 3, "wingLight"), rect(18, 26, 3, 3, "wingLight")])
part("bug-egg-body", [poly([(7, 12), (11, 5), (19, 4), (25, 10), (27, 19), (23, 26), (14, 28), (8, 23)], "ink"),
    poly([(9, 12), (12, 7), (18, 6), (23, 11), (25, 19), (21, 24), (15, 26), (10, 22)], "light"),
    rect(12, 10, 4, 7, "white"), rect(19, 17, 3, 5, "armor")])

# Arena predators retain registered pivots but use distinct silhouettes.
for prefix, dark, base, light in [("bombardier", "rustDark", "orange", "gold"),
        ("dragonfly", "blueDark", "blue", "blueLight"), ("bolas", "violetDark", "violet", "violetLight"), ("assassin", "rustDark", "rust", "rustLight")]:
    part(f"bug-{prefix}-body", [poly([(3, 12), (9, 9), (22, 9), (27, 14), (27, 20), (20, 24), (8, 23), (3, 19)], "ink"),
        rect(6, 12, 17, 8, dark), rect(10, 12, 11, 3, base), rect(16, 13, 5, 2, light)])
    part(f"bug-{prefix}-head", [poly([(9, 12), (15, 8), (23, 11), (26, 16), (23, 22), (14, 24), (9, 20)], "ink"),
        rect(11, 12, 11, 9, base), rect(13, 11, 5, 2, light), rect(20, 12, 3, 2, "gold"), rect(20, 19, 3, 2, "gold"),
        poly([(23, 11), (30, 9), (27, 15)], dark), poly([(23, 21), (30, 24), (27, 18)], dark)])
    part(f"bug-{prefix}-leg", [poly([(6, 14), (13, 13), (20, 17), (28, 24), (26, 27), (18, 20), (12, 17), (6, 18)], "ink"),
        poly([(8, 15), (12, 15), (20, 19), (26, 25), (25, 25), (18, 20), (11, 17), (8, 17)], base), rect(8, 15, 3, 1, light)])
# An exposed narrow thorax and hooked forelegs distinguish the corpse collector.
part("bug-assassin-shell", [poly([(3, 14), (8, 9), (18, 10), (25, 14), (24, 20), (17, 23), (7, 22), (3, 18)], "ink"),
    poly([(5, 14), (9, 11), (18, 12), (23, 15), (21, 19), (16, 21), (8, 20)], "rustDark"),
    rect(10, 12, 3, 8, "rustLight"), rect(18, 14, 3, 4, "rust")])
part("bug-assassin-head", [poly([(7, 14), (17, 10), (24, 13), (29, 16), (24, 20), (17, 23), (7, 19)], "ink"),
    poly([(10, 14), (18, 12), (23, 15), (26, 16), (22, 18), (17, 21), (10, 18)], "rust"),
    rect(18, 13, 3, 2, "gold"), rect(18, 18, 3, 2, "gold"), poly([(24, 16), (31, 15), (29, 18), (23, 18)], "rustLight")])
part("bug-assassin-leg", [poly([(6, 14), (14, 12), (21, 15), (28, 24), (27, 29), (23, 28), (24, 24), (18, 18), (12, 17), (6, 18)], "ink"),
    poly([(8, 15), (13, 14), (20, 17), (26, 25), (26, 27), (24, 25), (18, 19), (12, 16), (8, 17)], "rust"), rect(9, 14, 3, 2, "rustLight")])
part("bug-bombardier-shell", [poly([(0, 11), (6, 5), (19, 5), (26, 11), (26, 22), (19, 28), (6, 28), (0, 22)], "ink"),
    rect(3, 11, 20, 11, "rustDark"), rect(7, 7, 12, 18, "orange"), rect(11, 7, 3, 18, "rustDark"),
    rect(4, 9, 4, 6, "gold"), rect(4, 19, 4, 6, "gold"), rect(1, 12, 3, 3, "white"), rect(1, 20, 3, 3, "white")])
part("bug-dragonfly-body", [poly([(1, 14), (21, 11), (27, 15), (27, 19), (20, 22), (1, 19)], "ink"),
    rect(2, 15, 20, 3, "blue"), rect(19, 13, 6, 7, "blueDark"), rect(20, 13, 4, 2, "blueLight")])
part("bug-dragonfly-shell", [poly([(0, 15), (24, 12), (27, 15), (26, 20), (0, 18)], "ink"),
    rect(1, 15, 24, 3, "blue"), rect(1, 15, 20, 1, "blueLight")] + [rect(x, 15, 1, 3, "blueDark") for x in [5, 10, 15, 20]])
part("bug-dragonfly-head", [poly([(9, 10), (17, 7), (24, 10), (27, 16), (24, 23), (17, 25), (9, 22)], "ink"),
    rect(12, 11, 10, 11, "blueDark"), rect(13, 9, 7, 5, "blueLight"), rect(13, 19, 7, 5, "blueLight"), rect(20, 14, 5, 5, "blue")])
part("bug-dragonfly-wing", [poly([(7, 15), (15, 9), (27, 4), (31, 8), (29, 13), (17, 20), (8, 18)], "blueDark"),
    poly([(9, 15), (16, 11), (27, 6), (29, 8), (27, 12), (17, 18), (10, 17)], "light"),
    poly([(11, 15), (26, 8), (27, 9), (14, 16)], "white"), rect(18, 12, 1, 3, "blue")])
part("bug-bolas-shell", [poly([(0, 12), (5, 5), (15, 3), (24, 9), (27, 17), (22, 26), (12, 29), (3, 24)], "ink"),
    poly([(3, 13), (7, 7), (15, 6), (22, 11), (24, 17), (20, 24), (12, 26), (5, 22)], "violetDark"),
    poly([(6, 13), (12, 9), (20, 12), (21, 19), (15, 23), (8, 21)], "violet"), rect(8, 11, 10, 3, "violetLight"),
    rect(12, 17, 4, 4, "white"), rect(4, 15, 3, 3, "light")])
part("bug-bolas-head", [poly([(9, 12), (19, 9), (25, 13), (27, 19), (20, 24), (10, 21)], "ink"),
    rect(11, 12, 11, 10, "violetDark"), rect(15, 12, 2, 2, "gold"), rect(19, 12, 2, 2, "gold"),
    rect(15, 20, 2, 2, "gold"), rect(19, 20, 2, 2, "gold"), rect(22, 15, 4, 4, "white")])
part("bug-antlion-body", [poly([(2, 12), (8, 7), (21, 7), (28, 13), (27, 22), (20, 26), (7, 24), (2, 20)], "ink"),
    rect(5, 12, 20, 9, "ochreDark"), rect(9, 10, 12, 3, "ochre")])
part("bug-antlion-shell", [poly([(2, 13), (8, 6), (20, 6), (26, 13), (25, 22), (19, 27), (7, 25)], "ochreDark"),
    rect(5, 13, 17, 8, "ochre"), rect(8, 9, 12, 3, "ochreLight"), rect(9, 17, 2, 6, "rustDark"), rect(17, 15, 2, 8, "rustDark")])
part("bug-antlion-head", [poly([(7, 12), (16, 9), (22, 12), (28, 4), (31, 5), (27, 16), (31, 27), (28, 28), (22, 21), (14, 24), (7, 20)], "ink"),
    rect(9, 12, 12, 10, "ochre"), rect(12, 12, 6, 2, "ochreLight"), rect(20, 13, 3, 2, "gold"), rect(20, 19, 3, 2, "gold"),
    poly([(23, 12), (28, 6), (27, 12), (25, 15)], "white"), poly([(23, 21), (28, 26), (27, 21), (25, 18)], "white")])

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



# Broad, dusty wings and feathery antennae distinguish the small light-blocking moths.
part("bug-moth-body", [poly([(2, 14), (9, 10), (21, 11), (26, 15), (24, 21), (10, 22), (2, 18)], "ink"),
    rect(6, 13, 17, 6, "ochreDark"), rect(9, 13, 11, 3, "wingLight")])
part("bug-moth-shell", [poly([(5, 12), (13, 8), (22, 12), (24, 18), (17, 23), (7, 21)], "ink"),
    rect(8, 12, 12, 8, "ochre"), rect(10, 12, 7, 2, "wingLight"), rect(12, 16, 8, 2, "ochreDark")])
part("bug-moth-head", [rect(9, 11, 14, 11, "ink"), rect(11, 12, 11, 8, "wing"),
    rect(19, 12, 3, 2, "gold"), rect(19, 19, 3, 2, "gold"),
    poly([(21, 12), (27, 3), (30, 4), (24, 14)], "wingLight"),
    poly([(21, 20), (28, 28), (30, 26), (24, 18)], "wingLight")])
part("bug-moth-wing", [poly([(7, 15), (12, 3), (25, 1), (31, 9), (28, 24), (18, 29), (7, 18)], "ink"),
    poly([(9, 15), (14, 5), (24, 3), (29, 10), (26, 23), (18, 26), (9, 18)], "wing"),
    poly([(11, 15), (18, 7), (25, 6), (27, 11), (20, 15)], "wingLight"),
    rect(19, 17, 7, 5, "ochreDark"), rect(21, 18, 3, 3, "gold")])

# Small golden schematic courier: a round engraved carapace and narrow pale wings.
part("bug-courier-body", [poly([(5, 11), (11, 6), (21, 6), (27, 12), (27, 21), (21, 27), (10, 26), (5, 20)], "ink"),
    poly([(7, 12), (12, 8), (20, 8), (25, 13), (25, 20), (20, 25), (11, 24), (7, 19)], "ochreDark"),
    rect(10, 11, 12, 11, "gold"), rect(11, 11, 4, 5, "white"), rect(11, 20, 10, 2, "orange")])
part("bug-courier-shell", [poly([(6, 12), (11, 7), (21, 8), (26, 13), (24, 22), (17, 26), (8, 22)], "ochreDark"),
    poly([(8, 13), (13, 9), (20, 10), (23, 14), (22, 21), (16, 23), (10, 20)], "gold"),
    rect(13, 11, 2, 11, "ochreDark"), rect(10, 15, 12, 2, "ochreDark"), rect(17, 11, 3, 2, "white")])
part("bug-courier-head", [rect(12, 12, 10, 10, "ink"), rect(13, 13, 7, 8, "gold"),
    rect(18, 13, 3, 2, "white"), rect(18, 19, 3, 2, "white")])
part("bug-courier-wing", [poly([(7, 15), (17, 6), (29, 3), (32, 7), (27, 13), (15, 20), (7, 18)], "ochreDark"),
    poly([(9, 15), (19, 8), (29, 5), (30, 7), (25, 12), (15, 18), (9, 17)], "white"),
    poly([(11, 15), (27, 7), (23, 11), (14, 17)], "gold")])

# New specialists keep the existing registration and independent part variants.
# Click beetle: pointed brass shield with large ivory eyespots.
part("bug-click-body", [poly([(1, 13), (7, 7), (22, 7), (29, 14), (29, 20), (20, 26), (6, 24), (1, 19)], "ink"), rect(5, 11, 20, 11, "ochreDark")])
part("bug-click-shell", [poly([(2, 16), (9, 5), (23, 6), (29, 13), (26, 23), (8, 26)], "ink"), poly([(5, 16), (11, 8), (22, 9), (26, 14), (23, 21), (10, 23)], "ochre"), rect(9, 9, 4, 5, "white"), rect(9, 19, 4, 4, "white"), rect(10, 10, 2, 3, "ink"), rect(10, 19, 2, 3, "ink"), rect(16, 11, 2, 11, "ochreDark")])
part("bug-click-head", [poly([(9, 11), (19, 9), (27, 13), (30, 16), (25, 22), (10, 21)], "ink"), rect(12, 12, 12, 8, "ochre"), rect(23, 12, 3, 3, "gold"), rect(23, 19, 3, 2, "gold")])
# Exploding ant: swollen red abdomen with bright yellow chemical sacs.
part("bug-exploding-body", [poly([(1, 11), (8, 4), (21, 5), (28, 12), (28, 22), (19, 29), (7, 27), (1, 21)], "ink"), poly([(4, 12), (10, 7), (20, 8), (25, 14), (24, 22), (18, 26), (8, 24)], "red"), rect(8, 10, 5, 12, "gold"), rect(17, 11, 4, 12, "orange")])
part("bug-exploding-shell", [rect(12, 12, 12, 10, "ink"), rect(14, 14, 8, 6, "redDark"), rect(18, 14, 3, 6, "gold")])
part("bug-exploding-head", [rect(9, 10, 16, 14, "ink"), rect(11, 12, 12, 10, "red"), rect(21, 12, 3, 3, "gold"), rect(21, 20, 3, 2, "gold"), rect(26, 10, 3, 5, "red"), rect(26, 20, 3, 5, "red")])
# Velvet worm: a soft ribbed body, many tiny feet, and paired glue nozzles.
part("bug-velvet-body", [poly([(0, 13), (5, 8), (23, 8), (31, 13), (31, 21), (24, 25), (5, 25), (0, 20)], "ink"), rect(3, 11, 25, 12, "violet"), *[rect(x, 8, 2, 18, "violetLight") for x in range(5, 27, 4)], *[rect(x, y, 2, 5, "violetDark") for x in range(3, 29, 3) for y in [5, 23]]])
part("bug-velvet-shell", [rect(7, 13, 17, 7, "violet"), rect(8, 14, 15, 2, "violetLight")])
part("bug-velvet-head", [rect(9, 11, 15, 12, "ink"), rect(11, 13, 11, 8, "violetLight"), rect(22, 7, 8, 5, "ink"), rect(22, 21, 8, 5, "ink"), rect(24, 8, 6, 3, "acidLight"), rect(24, 22, 6, 3, "acidLight"), rect(19, 13, 2, 2, "ink"), rect(19, 19, 2, 2, "ink")])
# Parasitoid wasp: narrow waist, striped abdomen, and long translucent wings.
part("bug-wasp-body", [poly([(0, 14), (7, 9), (15, 11), (21, 14), (29, 13), (29, 20), (20, 20), (13, 24), (6, 23), (0, 19)], "ink"), rect(3, 13, 12, 7, "gold"), rect(7, 12, 3, 10, "ink"), rect(18, 15, 9, 3, "ochre")])
part("bug-wasp-shell", [rect(15, 11, 12, 12, "ink"), rect(17, 13, 8, 8, "ochre"), rect(19, 13, 3, 8, "gold")])
part("bug-wasp-head", [rect(11, 11, 13, 12, "ink"), rect(13, 13, 9, 8, "gold"), rect(21, 12, 3, 3, "redDark"), rect(21, 20, 3, 2, "redDark"), rect(22, 7, 6, 2, "ink"), rect(22, 25, 6, 2, "ink")])
part("bug-wasp-wing", [poly([(7, 15), (12, 5), (27, 0), (31, 4), (26, 12), (14, 20), (7, 19)], "ink"), poly([(10, 15), (14, 7), (26, 3), (28, 5), (24, 10), (14, 17)], "wingLight"), rect(15, 10, 5, 2, "wing")])
# Larva: pale segmented grub, no wings or adult insect legs.
part("bug-larva-body", [poly([(1, 14), (7, 8), (24, 8), (30, 13), (30, 21), (24, 26), (7, 25), (1, 20)], "ink"), rect(4, 11, 22, 12, "light"), *[rect(x, 11, 2, 12, "olive") for x in [8, 14, 20]]])
part("bug-larva-shell", [rect(8, 13, 16, 7, "light"), rect(9, 14, 13, 2, "white")])
part("bug-larva-head", [rect(12, 11, 12, 12, "ink"), rect(14, 13, 8, 8, "ochre"), rect(21, 14, 3, 2, "redDark"), rect(21, 19, 3, 2, "redDark")])
for prefix, dark, base, light in [("click", "ochreDark", "ochre", "gold"), ("exploding", "redDark", "red", "gold"), ("wasp", "ochreDark", "ochre", "gold")]:
    part(f"bug-{prefix}-leg", [poly([(6, 14), (14, 12), (20, 17), (29, 25), (28, 29), (24, 27), (18, 20), (12, 17), (6, 18)], "ink"), poly([(8, 15), (13, 14), (19, 18), (26, 25), (24, 25), (17, 19), (12, 16), (8, 17)], base)])

# Three compatible appearances per bug part: stock, banded/crested, ridged/spined.
# Larger markings and silhouette changes read at gameplay size; pivots stay fixed.
BUG_PALETTES = {
    "click": ("ochreDark", "ochre", "gold"), "exploding": ("redDark", "red", "gold"), "velvet": ("violetDark", "violet", "violetLight"), "wasp": ("ochreDark", "ochre", "gold"), "larva": ("oliveDark", "light", "white"),
    "rust": ("rustDark", "rust", "rustLight"), "olive": ("oliveDark", "olive", "oliveLight"),
    "lunger": ("redDark", "red", "redLight"), "evader": ("blueDark", "blue", "blueLight"),
    "centipede": ("ochreDark", "ochre", "ochreLight"), "armoured": ("slateDark", "slate", "slateLight"),
    "beetle": ("violetDark", "violet", "violetLight"), "spitter": ("acidDark", "acid", "acidLight"),
    "queen": ("ochreDark", "ochre", "ochreLight"), "worker": ("rustDark", "rust", "rustLight"),
    "soldier": ("redDark", "red", "redLight"), "bulletant": ("blueDark", "blue", "acidLight"),
    "antlion": ("ochreDark", "ochre", "ochreLight"), "bombardier": ("rustDark", "orange", "gold"),
    "dragonfly": ("blueDark", "blue", "blueLight"), "bolas": ("violetDark", "violet", "violetLight"),
    "assassin": ("rustDark", "rust", "rustLight"), "moth": ("ochreDark", "wing", "wingLight"), "courier": ("ochreDark", "gold", "white"),
    "slug": ("oliveDark", "wing", "wingLight"), "egg": ("darkArmor", "light", "white"),
}


def paint(pixels, layers, masked=False):
    overlay = board(layers)
    for y, row in enumerate(overlay):
        for x, color in enumerate(row):
            if color and (not masked or (pixels[y][x] and pixels[y][x] != COLORS["ink"])):
                pixels[y][x] = color


for name, pixels in list(PARTS.items()):
    if not name.startswith("bug-"):
        continue
    wing = name == "bug-wing"
    prefix, kind = ("olive", "wing") if wing else name.split("-")[1:]
    dark, base, light = (COLORS[key] for key in BUG_PALETTES[prefix])
    for suffix in ["b", "c"]:
        def tint(color):
            if not color or color == COLORS["ink"]:
                return color
            if suffix == "b":
                return tuple(min(255, round(channel * .7 + highlight * .3)) for channel, highlight in zip(color, light))
            return tuple(min(255, round(channel * factor)) for channel, factor in zip(color, (.72, .86, 1.08)))
        variant = [[tint(color) for color in row] for row in pixels]
        if prefix == "egg":
            paint(variant, [rect(12, 10, 3, 12, base), rect(18, 12 if suffix == "b" else 18, 3, 3, dark)], True)
        elif kind == "shell":
            if suffix == "b":
                paint(variant, [poly([(4, 12), (7, 4), (14, 3), (17, 9), (12, 13)], "ink"),
                                poly([(6, 11), (9, 6), (13, 5), (15, 9), (11, 11)], base)])
                paint(variant, [rect(8, 8, 4, 17, light), rect(17, 10, 3, 14, light), rect(12, 13, 4, 7, dark)], True)
            else:
                paint(variant, [poly([(3, 12), (4, 5), (10, 9), (13, 4), (17, 9), (21, 6), (24, 13)], "ink"),
                                poly([(5, 12), (6, 8), (10, 12), (14, 7), (17, 12), (21, 9), (22, 13)], base)])
                paint(variant, [rect(7, 12, 16, 3, dark), rect(7, 18, 16, 3, dark),
                                rect(9, 11, 11, 2, light), rect(9, 17, 11, 2, light), rect(10, 23, 9, 2, light)], True)
        elif kind == "body":
            if suffix == "b":
                paint(variant, [poly([(1, 11), (6, 8), (12, 11), (12, 23), (5, 25), (1, 21)], "ink"),
                                rect(3, 12, 7, 9, base), rect(4, 12, 3, 9, light)])
            else:
                paint(variant, [poly([(2, 16), (6, 9), (9, 12), (9, 21), (6, 25)], "ink"),
                                poly([(4, 16), (7, 12), (8, 20), (6, 22)], light)])
                paint(variant, [rect(8, 10, 3, 14, dark), rect(15, 10, 3, 14, dark), rect(21, 10, 2, 14, light)], True)
        elif kind == "head":
            if suffix == "b":
                paint(variant, [poly([(7, 12), (9, 5), (15, 5), (19, 11)], "ink"),
                                poly([(10, 10), (11, 7), (14, 7), (16, 10)], light)])
                paint(variant, [rect(10, 12, 6, 9, light), rect(12, 15, 4, 3, dark)], True)
            else:
                paint(variant, [poly([(8, 12), (5, 5), (9, 6), (13, 12)], "ink"),
                                poly([(8, 21), (5, 28), (9, 27), (13, 21)], "ink"),
                                rect(7, 7, 2, 4, light), rect(7, 22, 2, 4, light)])
                paint(variant, [rect(10, 13, 10, 3, dark), rect(11, 18, 8, 3, light)], True)
        elif kind == "leg":
            if suffix == "b":
                paint(variant, [poly([(12, 14), (18, 14), (23, 18), (23, 23), (17, 24), (12, 19)], "ink"),
                                poly([(14, 16), (18, 16), (21, 19), (21, 21), (17, 22), (14, 18)], light)])
            else:
                paint(variant, [poly([(23, 18), (29, 18), (31, 24), (27, 29), (25, 26), (27, 23)], "ink"),
                                poly([(25, 20), (28, 20), (29, 24), (27, 26), (28, 23)], light)])
                paint(variant, [rect(11, 14, 3, 6, light), rect(19, 19, 4, 3, dark)], True)
        else:  # Optional wings: broad banded membranes or angular split tips.
            if suffix == "b":
                paint(variant, [poly([(10, 13), (17, 3), (25, 2), (30, 8), (30, 18), (24, 25), (15, 25)], "ink"),
                                poly([(12, 13), (18, 5), (24, 4), (28, 9), (28, 17), (23, 23), (16, 23)], light),
                                poly([(13, 17), (27, 8), (28, 11), (15, 21)], dark)])
            else:
                paint(variant, [poly([(12, 12), (25, 2), (30, 5), (25, 13), (31, 14), (27, 23), (17, 27)], "ink"),
                                poly([(14, 13), (25, 5), (27, 6), (22, 15), (28, 16), (25, 21), (18, 24)], base),
                                poly([(15, 14), (25, 6), (24, 10), (17, 17)], light)])
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
