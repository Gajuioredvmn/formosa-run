"""Deterministic ZIP payload, with compressed media stored directly for cheap reads."""
import pathlib
import sys
import zipfile

root = pathlib.Path(sys.argv[1]).resolve()
stamp = (2026, 1, 1, 0, 0, 0)
with zipfile.ZipFile(root / 'unsigned.apk', 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as out:
    with zipfile.ZipFile(root / 'resources.apk') as base:
        for name in sorted(base.namelist()):
            info = zipfile.ZipInfo(name, stamp)
            info.compress_type = zipfile.ZIP_STORED if name == 'resources.arsc' else zipfile.ZIP_DEFLATED
            out.writestr(info, base.read(name))
    for item in [root / 'dex' / 'classes.dex', *sorted((root / 'assets').rglob('*'))]:
        if not item.is_file():
            continue
        name = 'classes.dex' if item.name == 'classes.dex' else item.relative_to(root).as_posix()
        info = zipfile.ZipInfo(name, stamp)
        info.compress_type = zipfile.ZIP_STORED if item.suffix in {'.png', '.jpg', '.jpeg', '.mp3', '.ogg', '.webp', '.woff2'} else zipfile.ZIP_DEFLATED
        with item.open('rb') as src, out.open(info, 'w') as dst:
            while chunk := src.read(1024 * 1024):
                dst.write(chunk)
