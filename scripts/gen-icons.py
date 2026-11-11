"""生成 StudyDesk 的占位应用图标，便于后续 Tauri / NSIS 打包。

不依赖第三方库，只使用 Python 标准库。
- PNG：32 / 128 / 256
- ICO：32 / 48 / 256（BMP DIB，兼容 Windows 资源编译器）
"""

from __future__ import annotations

import os
import struct
import zlib

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons"))

BG_START = (58, 111, 247)
BG_END = (110, 140, 255)
CARD = (255, 255, 255)
LINE = (201, 214, 255)
DOT = (58, 111, 247)


def blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def inside_rounded(x: int, y: int, left: float, top: float, right: float, bottom: float, radius: float) -> bool:
    if x < left or x > right or y < top or y > bottom:
        return False
    corners = (
        (left + radius, top + radius),
        (right - radius, top + radius),
        (left + radius, bottom - radius),
        (right - radius, bottom - radius),
    )
    for cx, cy in corners:
        if (x < cx and y < cy) or (x > cx and y < cy) or (x < cx and y > cy) or (x > cx and y > cy):
            continue
        if (x - cx) ** 2 + (y - cy) ** 2 > radius**2:
            return False
    return True


def pixel(size: int, x: int, y: int) -> tuple[int, int, int, int]:
    t = (x + y) / max(1, 2 * size - 2)
    bg = blend(BG_START, BG_END, t)
    card = (size * 0.22, size * 0.20, size * 0.78, size * 0.80)
    if inside_rounded(x, y, *card, size * 0.055):
        for index, ratio in enumerate((0.36, 0.49, 0.62)):
            line_top = size * ratio
            if size * 0.28 <= x <= size * 0.66 and line_top <= y <= line_top + size * 0.045:
                return (*LINE, 255)
        if (x - size * 0.68) ** 2 + (y - size * 0.34) ** 2 <= (size * 0.045) ** 2:
            return (*DOT, 255)
        return (*CARD, 255)
    return (*bg, 255)


def png_bytes(size: int) -> bytes:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(size, x, y))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def ico_dib(size: int) -> bytes:
    pixels = [[pixel(size, x, size - 1 - y) for x in range(size)] for y in range(size)]
    header = struct.pack("<IiiHHIIiiII", 40, size, size * 2, 1, 32, 0, size * size * 4, 0, 0, 0, 0)
    body = bytearray()
    for row in pixels:
        for r, g, b, a in row:
            body.extend((b, g, r, a))
    mask_row_bytes = ((size + 31) // 32) * 4
    body.extend(b"\x00" * (mask_row_bytes * size))
    return header + bytes(body)


def write_ico(path: str, sizes: list[int]) -> None:
    images = [ico_dib(size) for size in sizes]
    offset = 6 + 16 * len(images)
    entries = bytearray()
    for size, image in zip(sizes, images):
        entries.extend(
            struct.pack(
                "<BBBBHHII",
                0 if size >= 256 else size,
                0 if size >= 256 else size,
                0,
                0,
                1,
                32,
                len(image),
                offset,
            )
        )
        offset += len(image)
    with open(path, "wb") as handle:
        handle.write(struct.pack("<HHH", 0, 1, len(images)) + bytes(entries) + b"".join(images))


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for size, name in ((32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")):
        with open(os.path.join(OUTPUT_DIR, name), "wb") as handle:
            handle.write(png_bytes(size))
    write_ico(os.path.join(OUTPUT_DIR, "icon.ico"), [32, 48, 256])
    print(f"icons written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()