"""Hand-authored 32px pixel parts; fixed pivots, no imaging dependencies.

Parts face right and attach at (16,16); bug limbs hinge at (8,16).
Animation is independent of artwork: app/arena/animation.ts.
"""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent / "public" / "images" / "arena"
COLORS = {
    "ink": (13, 24, 24), "joint": (38, 52, 48), "steel": (69, 89, 83),
    "metal": (112, 137, 126), "light": (178, 196, 159), "armor": (116, 151, 122),
    "darkArmor": (64, 96, 78), "glass": (109, 204, 205), "white": (221, 228, 198),
    "gold": (231, 189, 100), "orange": (226, 128, 68), "rustDark": (76, 43, 35),
    "rust": (161, 79, 48), "rustLight": (218, 144, 73), "oliveDark": (51, 66, 43),
    "olive": (109, 133, 72), "oliveLight": (179, 191, 106), "wing": (157, 182, 139),
    "wingLight": (211, 218, 164), "xp": (143, 202, 115),
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
    ("mech-boost-foot", "light", "orange", 22),
]:
    layers = [rect(5, 10, width, 13, "ink"), rect(7, 11, width - 3, 10, plate),
              rect(9, 12, width - 6, 2, "metal"), rect(9, 16, 5, 4, "joint"),
              rect(17, 16, width - 13, 4, accent), rect(7, 20, width - 3, 2, "joint")]
    if name != "mech-foot":
        layers += [rect(4, 13, 4, 6, "ink"), rect(5, 14, 3, 4, accent), rect(11, 17, 2, 3, "white")]
    part(name, layers)

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

for name, length, accent in [("mech-cooler", 8, "steel"), ("mech-vent-cooler", 12, "gold"), ("mech-twin-cooler", 16, "orange")]:
    layers = [rect(16 - length // 2, 12, length, 10, "ink"), rect(17 - length // 2, 13, length - 2, 7, accent)]
    for x in range(18 - length // 2, 15 + length // 2, 3):
        layers += [rect(x, 14, 1, 5, "joint"), rect(x + 1, 14, 1, 1, "light")]
    part(name, layers)

for prefix, dark, base, highlight in [("rust", "rustDark", "rust", "rustLight"), ("olive", "oliveDark", "olive", "oliveLight")]:
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

part("bug-wing", [
    poly([(7, 15), (13, 7), (23, 4), (28, 8), (30, 14), (27, 21), (17, 24), (10, 20)], "oliveDark"),
    poly([(9, 15), (14, 9), (23, 6), (26, 9), (28, 14), (25, 19), (17, 22), (12, 19)], "wing"),
    poly([(11, 15), (17, 10), (24, 8), (24, 10), (17, 13)], "wingLight"),
    poly([(10, 16), (26, 13), (26, 14), (11, 18)], "olive"),
    poly([(16, 13), (18, 21), (16, 21), (14, 14)], "olive"),
])
save("bullet", board([rect(7, 13, 20, 6, "orange"), rect(11, 14, 15, 4, "gold"), rect(21, 14, 5, 4, "white")]))
save("xp", board([
    poly([(16, 4), (28, 16), (16, 28), (4, 16)], "ink"),
    poly([(16, 7), (25, 16), (16, 25), (7, 16)], "xp"),
    poly([(16, 11), (21, 16), (16, 21), (11, 16)], "darkArmor"), rect(15, 12, 2, 3, "light"),
]))


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
