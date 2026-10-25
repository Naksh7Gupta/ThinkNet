from pathlib import Path
import struct
import zlib


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size: int, rgb: tuple[int, int, int]) -> bytes:
    row = bytes([0]) + (bytes(rgb) * size)
    raw = row * size
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)),
            chunk(b"IDAT", zlib.compress(raw, 9)),
            chunk(b"IEND", b""),
        ]
    )


def main() -> None:
    root = Path(__file__).resolve().parent
    p32 = png(32, (31, 58, 138))
    p128 = png(128, (31, 58, 138))
    (root / "32x32.png").write_bytes(p32)
    (root / "128x128.png").write_bytes(p128)
    (root / "icon.ico").write_bytes(
        struct.pack("<HHH", 0, 1, 1)
        + struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(p32), 22)
        + p32
    )


if __name__ == "__main__":
    main()
