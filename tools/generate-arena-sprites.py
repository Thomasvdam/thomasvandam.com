"""Generate the replaceable geometric Arena sprites using only the standard library."""
from pathlib import Path
import struct
import zlib


def inside(x, y, points):
    result = False
    for i, (ax, ay) in enumerate(points):
        bx, by = points[i - 1]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


def chunk(name, data):
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))


def sprite(name, layers):
    # Four samples per axis keep simple shapes clean when rotated or scaled.
    rows = bytearray()
    for y in range(64):
        rows.append(0)
        for x in range(64):
            sums = [0, 0, 0, 0]
            for sy in range(4):
                for sx in range(4):
                    px, py = x + (sx + .5) / 4, y + (sy + .5) / 4
                    color = None
                    for points, fill in layers:
                        if inside(px, py, points):
                            color = fill
                    if color:
                        for channel in range(3):
                            sums[channel] += color[channel]
                        sums[3] += 255
            alpha = round(sums[3] / 16)
            samples = sums[3] / 255
            rows.extend([round(value / samples) if samples else 0 for value in sums[:3]] + [alpha])
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 64, 64, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
    path = Path(__file__).resolve().parent.parent / "public" / "images" / "arena" / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


sprite("player", [
    ([(8, 7), (59, 32), (8, 57), (20, 32)], (166, 233, 237)),
    ([(15, 15), (47, 32), (15, 49), (23, 32)], (42, 86, 111)),
    ([(25, 27), (40, 32), (25, 37)], (234, 249, 250)),
])
sprite("enemy", [
    ([(32, 3), (61, 32), (32, 61), (3, 32)], (255, 123, 140)),
    ([(32, 10), (54, 32), (32, 54), (10, 32)], (128, 45, 68)),
    ([(32, 22), (42, 32), (32, 42), (22, 32)], (255, 176, 187)),
])
sprite("bullet", [
    ([(6, 25), (49, 25), (59, 32), (49, 39), (6, 39)], (166, 233, 237)),
    ([(20, 29), (48, 29), (53, 32), (48, 35), (20, 35)], (244, 255, 255)),
])
sprite("xp", [
    ([(32, 8), (56, 32), (32, 56), (8, 32)], (140, 229, 176)),
    ([(32, 16), (48, 32), (32, 48), (16, 32)], (31, 105, 76)),
    ([(32, 24), (40, 32), (32, 40), (24, 32)], (192, 255, 216)),
])
