import importlib.util
import json
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_hercules_plugin_zip.py"

spec = importlib.util.spec_from_file_location("build_hercules_plugin_zip", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def test_submission_package_file_set_is_bounded():
    files = builder.collect_package_files(ROOT)
    assert files == [
        Path("plugin.json"),
        Path("mcp.json"),
        Path("assets/hercules-plugin.svg"),
        Path("skills/hercules-readonly/SKILL.md"),
        Path("hercules-plugin/README.md"),
    ]


def test_submission_manifest_rejects_forbidden_components():
    manifest = json.loads((ROOT / "plugin.json").read_text())
    builder.validate_manifest(manifest)
    assert "apps" not in manifest
    assert "lifecycle" not in manifest
    assert ".app.json" not in json.dumps(manifest)


def test_builder_creates_deterministic_rooted_zip(tmp_path):
    output = tmp_path / "hercules-openai-plugin.zip"
    builder.build_zip(ROOT, output)

    with ZipFile(output) as archive:
        names = archive.namelist()
        assert names == [
            "plugin.json",
            "mcp.json",
            "assets/hercules-plugin.svg",
            "skills/hercules-readonly/SKILL.md",
            "hercules-plugin/README.md",
        ]
        assert all(not name.startswith("/") for name in names)
        assert archive.read("plugin.json") == (ROOT / "plugin.json").read_bytes()
