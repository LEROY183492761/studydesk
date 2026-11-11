import io
import os
import tarfile

from compression import zstd

SOURCE = os.path.join(".toolchain", "binutils.pkg.tar.zst")
TARGET = os.path.join(".toolchain", "binutils")

if not os.path.exists(SOURCE):
    raise SystemExit(f"missing {SOURCE}")

with open(SOURCE, "rb") as handle:
    raw = zstd.decompress(handle.read())

os.makedirs(TARGET, exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
    archive.extractall(TARGET)

print(f"extracted to {TARGET}")