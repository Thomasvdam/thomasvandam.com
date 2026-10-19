"""Generate the single-set boss parts used by the Exterminator arena.

Boss art deliberately uses the same native 32px registration grid as the
ordinary bugs.  The rigs supply the scale and articulation; these parts stay
free of animation state and appearance variants.
"""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent / "public" / "images" / "exterminator"
COLORS = {
    "ink": (13, 24, 24), "joint": (38, 52, 48), "steel": (69, 89, 83),
    "metal": (112, 137, 126), "light": (178, 196, 159), "armor": (116, 151, 122),
    "darkArmor": (64, 96, 78), "gold": (231, 189, 100), "orange": (226, 128, 68),
    "rustDark": (76, 43, 35), "rust": (161, 79, 48), "rustLight": (218, 144, 73),
    "oliveDark": (51, 66, 43), "olive": (109, 133, 72), "oliveLight": (179, 191, 106),
    "redDark": (73, 32, 37), "red": (176, 60, 56), "redLight": (244, 147, 103),
    "violetDark": (49, 36, 57), "violet": (113, 78, 125), "violetLight": (185, 144, 181),
    "ochreDark": (77, 57, 28), "ochre": (160, 122, 49), "ochreLight": (232, 191, 101),
}


def inside(x, y, points):
    result = False
    for i, (ax, ay) in enumerate(points):
        bx, by = points[i - 1]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


def poly(points, color):
    return points, COLORS[color]


def rect(x, y, width, height, color):
    return poly([(x, y), (x + width, y), (x + width, y + height), (x, y + height)], color)


def board(layers):
    return [[next((color for points, color in reversed(layers) if inside(x + .5, y + .5, points)), None)
             for x in range(32)] for y in range(32)]


def chunk(name, data):
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))


def save(name, pixels):
    rows = bytearray()
    for row in pixels:
        rows.append(0)
        for color in row:
            rows.extend((*color, 255) if color else (0, 0, 0, 0))
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 32, 32, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
    path = ROOT / f"parts/{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def part(name, layers):
    save(name, board(layers))


# Rhino beetle: broad armored body, a separate head, and a characteristic
# upturned horn.  The legs are heavy enough to read at the boss scale.
part("boss-rhino-body", [
    poly([(1, 12), (5, 5), (12, 2), (23, 4), (30, 11), (30, 22), (23, 29), (9, 29), (2, 22)], "ink"),
    poly([(4, 12), (8, 7), (13, 5), (22, 7), (27, 12), (27, 21), (21, 26), (10, 26), (5, 20)], "darkArmor"),
    poly([(7, 11), (13, 7), (21, 9), (25, 13), (24, 20), (19, 24), (11, 23), (7, 19)], "armor"),
    rect(10, 9, 10, 3, "light"), rect(14, 11, 3, 13, "metal"), rect(7, 18, 5, 3, "steel"),
])
part("boss-rhino-shell", [
    poly([(2, 12), (7, 4), (17, 2), (27, 7), (30, 16), (26, 27), (17, 30), (7, 26), (2, 19)], "ink"),
    poly([(5, 12), (9, 7), (17, 5), (24, 9), (27, 16), (23, 24), (16, 27), (8, 23), (5, 19)], "oliveDark"),
    poly([(8, 12), (12, 8), (18, 8), (23, 12), (24, 18), (20, 23), (13, 24), (8, 20)], "olive"),
    rect(11, 9, 10, 3, "oliveLight"), rect(15, 9, 3, 14, "oliveDark"), rect(8, 15, 5, 3, "gold"),
])
part("boss-rhino-head", [
    poly([(4, 10), (13, 4), (23, 6), (27, 12), (31, 16), (27, 21), (23, 27), (12, 26), (4, 20)], "ink"),
    poly([(8, 11), (14, 7), (21, 9), (24, 14), (28, 16), (24, 19), (21, 24), (13, 23), (8, 19)], "armor"),
    rect(13, 8, 8, 3, "light"), rect(20, 12, 4, 3, "gold"), rect(20, 19, 4, 3, "gold"),
])
part("boss-rhino-horn", [
    poly([(1, 18), (5, 13), (13, 10), (22, 4), (29, 3), (27, 8), (21, 12), (17, 17), (27, 22), (25, 27), (15, 22), (9, 20)], "ink"),
    poly([(5, 17), (10, 14), (15, 12), (22, 7), (27, 6), (22, 11), (18, 16), (22, 20), (16, 19), (10, 18)], "gold"),
    rect(12, 15, 7, 2, "ochreLight"), rect(22, 8, 4, 2, "rustLight"),
])
part("boss-rhino-leg", [
    poly([(3, 7), (11, 5), (18, 9), (17, 14), (24, 18), (29, 24), (27, 29), (20, 27), (14, 21), (9, 18), (4, 15)], "ink"),
    poly([(7, 9), (11, 8), (15, 11), (14, 14), (21, 20), (26, 24), (24, 26), (19, 24), (12, 18), (7, 15)], "steel"),
    rect(8, 9, 5, 3, "metal"), rect(19, 21, 6, 2, "light"), rect(24, 24, 3, 3, "darkArmor"),
])

# Scorpion: low body, side-facing pincers, and a segmented raised tail.
part("boss-scorpion-body", [
    poly([(1, 11), (7, 4), (19, 3), (28, 8), (31, 16), (27, 25), (17, 29), (6, 25), (1, 19)], "ink"),
    poly([(5, 11), (9, 7), (19, 6), (25, 10), (27, 16), (23, 22), (16, 25), (8, 21), (4, 17)], "redDark"),
    poly([(9, 11), (15, 8), (21, 10), (24, 15), (21, 21), (15, 23), (10, 19)], "red"),
    rect(12, 9, 8, 3, "redLight"), rect(14, 14, 4, 7, "rustDark"),
])
part("boss-scorpion-shell", [
    poly([(3, 12), (8, 5), (19, 4), (28, 10), (29, 20), (22, 28), (11, 27), (4, 21)], "ink"),
    poly([(7, 12), (11, 8), (18, 7), (24, 11), (25, 19), (20, 24), (12, 23), (7, 19)], "violetDark"),
    poly([(10, 12), (14, 9), (19, 10), (22, 13), (22, 18), (18, 21), (13, 20), (10, 17)], "violet"),
    rect(12, 10, 9, 2, "violetLight"), rect(15, 11, 2, 9, "violetDark"),
])
part("boss-scorpion-head", [
    poly([(3, 12), (10, 6), (20, 7), (25, 12), (31, 14), (30, 20), (24, 20), (20, 26), (10, 24), (3, 19)], "ink"),
    poly([(7, 13), (12, 9), (19, 10), (22, 14), (27, 16), (22, 18), (18, 22), (12, 21), (7, 18)], "red"),
    rect(16, 10, 4, 3, "gold"), rect(16, 20, 4, 3, "gold"), rect(24, 15, 5, 3, "redLight"),
])
part("boss-scorpion-claw", [
    poly([(1, 13), (7, 7), (16, 8), (21, 12), (28, 11), (31, 14), (27, 18), (22, 17), (18, 24), (11, 27), (8, 23), (12, 17), (3, 19)], "ink"),
    poly([(5, 13), (9, 10), (15, 11), (18, 14), (25, 14), (27, 16), (22, 16), (17, 21), (13, 23), (12, 19), (15, 16), (7, 17)], "violet"),
    rect(8, 11, 7, 2, "violetLight"), rect(23, 13, 5, 2, "gold"),
])
part("boss-scorpion-tail", [
    poly([(2, 11), (7, 5), (16, 4), (25, 8), (30, 14), (26, 21), (17, 25), (8, 22), (3, 17)], "ink"),
    poly([(7, 11), (10, 8), (16, 8), (22, 11), (26, 15), (22, 18), (16, 21), (10, 19), (7, 16)], "redDark"),
    rect(10, 9, 9, 3, "red"), rect(18, 14, 6, 3, "redLight"), rect(11, 18, 5, 2, "rustLight"),
])
part("boss-scorpion-stinger", [
    poly([(4, 21), (9, 11), (15, 4), (21, 1), (25, 4), (21, 11), (17, 17), (14, 26), (9, 30)], "ink"),
    poly([(9, 22), (12, 13), (16, 7), (20, 4), (18, 11), (14, 18), (12, 25)], "gold"),
    rect(16, 7, 3, 5, "redLight"),
])
part("boss-scorpion-leg", [
    poly([(5, 8), (12, 5), (17, 9), (15, 14), (22, 18), (29, 22), (28, 27), (21, 25), (14, 20), (9, 17), (4, 13)], "ink"),
    poly([(8, 10), (12, 8), (14, 11), (12, 14), (19, 20), (25, 23), (24, 25), (20, 23), (11, 17), (7, 14)], "violet"),
    rect(9, 9, 5, 2, "violetLight"), rect(20, 21, 6, 2, "red"),
])

# Millipede: warm plated segments and a small head.  The rig repeats the
# segment parts eight times while placing the centres from the live boss.
part("boss-millipede-body", [
    poly([(3, 10), (8, 4), (23, 4), (29, 10), (29, 22), (23, 28), (8, 28), (3, 22)], "ink"),
    poly([(6, 10), (10, 7), (21, 7), (26, 11), (26, 21), (21, 25), (10, 25), (6, 21)], "ochreDark"),
    poly([(9, 10), (13, 8), (20, 9), (23, 12), (23, 20), (19, 23), (12, 22), (9, 19)], "ochre"),
    rect(11, 9, 10, 3, "ochreLight"), rect(15, 10, 3, 12, "ochreDark"),
])
part("boss-millipede-shell", [
    poly([(2, 10), (7, 3), (25, 3), (30, 10), (30, 23), (24, 29), (8, 29), (2, 22)], "ink"),
    poly([(6, 10), (10, 6), (22, 6), (26, 11), (26, 21), (21, 26), (11, 26), (6, 21)], "oliveDark"),
    poly([(9, 11), (12, 8), (21, 8), (24, 12), (24, 20), (20, 23), (12, 23), (9, 20)], "olive"),
    rect(10, 10, 12, 2, "oliveLight"), rect(14, 11, 3, 12, "oliveDark"),
])
part("boss-millipede-head", [
    poly([(3, 12), (9, 5), (18, 4), (25, 8), (28, 14), (31, 16), (27, 19), (25, 26), (16, 29), (8, 24), (3, 19)], "ink"),
    poly([(7, 12), (11, 8), (18, 8), (22, 11), (24, 16), (22, 21), (17, 25), (11, 22), (7, 18)], "ochre"),
    rect(12, 9, 8, 3, "ochreLight"), rect(20, 13, 4, 3, "gold"), rect(21, 19, 4, 3, "gold"),
    poly([(23, 10), (30, 4), (31, 6), (25, 13)], "oliveLight"), poly([(23, 22), (30, 27), (29, 29), (22, 24)], "oliveLight"),
])
part("boss-millipede-leg", [
    poly([(6, 7), (13, 6), (17, 10), (15, 15), (22, 19), (27, 24), (25, 28), (19, 24), (12, 19), (6, 15)], "ink"),
    poly([(9, 9), (13, 8), (14, 11), (12, 14), (19, 20), (23, 23), (22, 25), (18, 22), (10, 17), (8, 13)], "ochre"),
    rect(9, 9, 5, 2, "ochreLight"), rect(19, 21, 5, 2, "oliveLight"),
])


if __name__ == "__main__":
    print("generated 16 boss sprite parts")
