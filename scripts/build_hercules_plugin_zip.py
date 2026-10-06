#!/usr/bin/env python3
"""Build the bounded Hercules OpenAI plugin submission ZIP."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

PACKAGE_FILES = (
    Path("plugin.json"),
    Path("mcp.json"),
    Path("assets/hercules-plugin.svg"),
    Path("skills/hercules-readonly/SKILL.md"),
    Path("hercules-plugin/README.md"),
)
FORBIDDEN_MANIFEST_KEYS = {
    "apps",
    "lifecycle",
    "test_credentials",
    "reviewer_instructions",
}
FIXED_ZIP_TIMESTAMP = (2026, 1, 1, 0, 0, 0)


def _walk_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from _walk_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_keys(child)


def validate_manifest(manifest: dict) -> None:
    if not isinstance(manifest, dict):
        raise ValueError("plugin.json must contain a JSON object")

    present_forbidden = sorted(FORBIDDEN_MANIFEST_KEYS.intersection(_walk_keys(manifest)))
    if present_forbidden:
        raise ValueError(
            "submission manifest contains forbidden private/unsupported fields: "
            + ", ".join(present_forbidden)
        )

    raw = json.dumps(manifest, sort_keys=True)
    if ".app.json" in raw:
        raise ValueError("submission manifest must not reference .app.json files")

    openai = ((manifest.get("extensions") or {}).get("com.openai") or {})
    interface = openai.get("interface") or {}
    for field in ("logo", "composerIcon"):
        value = interface.get(field)
        if not isinstance(value, str) or not value.startswith("./"):
            raise ValueError(f"interface.{field} must be a ./-relative package path")


def collect_package_files(root: Path) -> list[Path]:
    root = Path(root)
    manifest_path = root / "plugin.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_manifest(manifest)

    missing = [str(path) for path in PACKAGE_FILES if not (root / path).is_file()]
    if missing:
        raise FileNotFoundError("missing required plugin package files: " + ", ".join(missing))

    return list(PACKAGE_FILES)


def build_zip(root: Path, output: Path) -> Path:
    root = Path(root).resolve()
    output = Path(output).resolve()
    files = collect_package_files(root)
    output.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in files:
            data = (root / relative).read_bytes()
            info = ZipInfo(relative.as_posix(), date_time=FIXED_ZIP_TIMESTAMP)
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)

    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="repository root",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dist/hercules-openai-plugin.zip"),
        help="ZIP output path",
    )
    args = parser.parse_args()
    path = build_zip(args.root, args.output)
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
