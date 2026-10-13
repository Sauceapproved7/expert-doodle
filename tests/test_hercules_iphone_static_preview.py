"""Fail-closed static iPhone preview build tests; no external network or secrets."""
import importlib.util
import json
from pathlib import Path
import re
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts" / "build_hercules_iphone_static_preview.py"
spec = importlib.util.spec_from_file_location("preview_build", BUILDER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class HerculesIphonePreviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "preview"
        self.src = ROOT / "hercules-ai" / "ui"
        self.original = (self.src / "index.html").read_bytes()
        module.build_preview(self.src, self.path)

    def test_writes_independently_installable_pwa_assets(self):
        assert set(p.name for p in self.path.iterdir()) == {
            "index.html", "manifest.webmanifest", "service-worker.js",
            "app-icon-192.png", "app-icon-512.png",
        }
        manifest = json.loads((self.path / "manifest.webmanifest").read_text())
        self.assertEqual(manifest["display"], "standalone")
        self.assertEqual(manifest["start_url"], "/")
        self.assertIn("preview", manifest["name"].lower())
        self.assertEqual({icon["src"] for icon in manifest["icons"]},
                         {"/app-icon-192.png", "/app-icon-512.png"})

    def test_does_not_change_or_serve_original_production_ui(self):
        self.assertEqual((self.src / "index.html").read_bytes(), self.original)
        html = (self.path / "index.html").read_text()
        self.assertIn("HERCULES", html)
        self.assertIn('name="robots" content="noindex,nofollow"', html)
        self.assertIn('id="previewNotice"', html)
        self.assertRegex(html, r"PREVIEW\s+ONLY")
        self.assertIn("no live ai", html.lower())

    def test_preview_chat_always_disabled_with_no_model_or_remote_calls(self):
        html = (self.path / "index.html").read_text()
        self.assertIn('id="chatSend" disabled', html)
        self.assertNotIn('fetch("/v1/chat/completions"', html)
        self.assertNotIn('fetch("/v1/models"', html)
        self.assertNotIn("https://", html)
        self.assertNotIn("http://", html)
        self.assertIn("RETRY MODEL CONNECTION", html)
        self.assertIn("modelRetry.disabled=true", html)
        self.assertIn("send.disabled=true", html)
        self.assertIn("No AI model is connected", html)

    def test_built_images_are_real_png_icons_at_expected_sizes(self):
        for size in (192, 512):
            icon = (self.path / f"app-icon-{size}.png").read_bytes()
            self.assertEqual(icon[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(struct.unpack(">II", icon[16:24]), (size, size))
            self.assertLess(len(icon), 80 * 1024)

    def test_service_worker_is_existing_guarded_own_source(self):
        self.assertEqual(
            (self.path / "service-worker.js").read_bytes(),
            (self.src / "service-worker.js").read_bytes()
        )
        html = (self.path / "index.html").read_text()
        self.assertIn('navigator.serviceWorker.register("/service-worker.js")', html)
        self.assertIn("hercules-shell-v2", (self.path / "service-worker.js").read_text())

    def test_only_generates_files_in_requested_output_directory(self):
        self.assertEqual(set(p.name for p in self.path.parent.iterdir()), {"preview"})
        html = (self.path / "index.html").read_text()
        self.assertIn("connect-src 'none'", html)
        self.assertNotIn('value="Bearer', html)


if __name__ == "__main__":
    unittest.main()
