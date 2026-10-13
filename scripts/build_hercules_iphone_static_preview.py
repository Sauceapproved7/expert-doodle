"""Build an isolated Hercules iPhone PWA UI preview using owned source only.

The result is a static design/offline preview. It must never send prompts,
simulate working inference, or be promoted as the working Hercules AI app.
"""
import json
from pathlib import Path
import re
import struct
import zlib


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "hercules-ai" / "ui"
OUTPUT_DIR = ROOT / "dist" / "hercules-iphone-preview"

PREVIEW_SCRIPT = r"""
const speed=document.getElementById("speedMode"),readout=document.getElementById("speedReadout");
const send=document.getElementById("chatSend"),modelRetry=document.getElementById("modelRetry");
const input=document.getElementById("chatInput"),modelStatus=document.getElementById("modelStatus");
send.disabled=true;
modelRetry.disabled=true;
input.disabled=true;
modelStatus.textContent="No AI model is connected in this preview. Chat is disabled.";
const labels={turbo:"TURBO • 512 TOKEN BUDGET",fast:"FAST • 1024 TOKEN BUDGET",
 balanced:"BALANCED • 2048 TOKEN BUDGET",deep:"DEEP • 4096 TOKEN BUDGET",
 max:"MAX • 8192 TOKEN BUDGET"};
speed.addEventListener("change",()=>{readout.textContent=labels[speed.value]||labels.balanced;});
if("serviceWorker" in navigator){
 window.addEventListener("load",()=>navigator.serviceWorker.register("/service-worker.js").catch(()=>{}));
}
"""


def original_h_monogram_icon(size):
    """Generate the original Hercules shield/H pixels from the standard-library geometry."""
    if size not in (192, 512):
        raise ValueError("icon_size_unapproved")
    def pixel(x, y):
        dark = (8, 10, 13)
        orange = (255, 107, 34)
        light = (244, 241, 232)
        cx = size / 2
        cy = size / 2
        shield = max(abs((x - cx) / (size * .31)), abs((y - cy) / (size * .38)))
        shield_edge = .91 <= shield <= 1.0
        h_left = abs(x - size * .38) <= size * .035 and size * .31 <= y <= size * .69
        h_right = abs(x - size * .62) <= size * .035 and size * .31 <= y <= size * .69
        h_bar = abs(y - size * .50) <= size * .035 and size * .38 <= x <= size * .62
        color = light if (h_left or h_right or h_bar) else orange if shield_edge else dark
        return bytes(color)
    raw = b"".join(b"\x00" + b"".join(pixel(x, y) for x in range(size)) for y in range(size))
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def build_preview(source_dir=SOURCE_DIR, output_dir=OUTPUT_DIR):
    source_dir = Path(source_dir).resolve()
    output_dir = Path(output_dir).resolve()
    if source_dir == output_dir or source_dir in output_dir.parents or output_dir in source_dir.parents:
        raise ValueError("source_and_output_must_be_isolated")
    source_html = (source_dir / "index.html").read_text(encoding="utf-8")
    manifest = json.loads((source_dir / "manifest.webmanifest").read_text(encoding="utf-8"))
    worker = (source_dir / "service-worker.js").read_bytes()

    if source_html.count("<script>") != 1 or source_html.count("</script>") != 1:
        raise ValueError("unexpected_hercules_script_shape")
    if 'id="chatSend"' not in source_html or 'id="modelStatus"' not in source_html:
        raise ValueError("hercules_mobile_chat_guard_missing")
    if b"hercules-shell-v2" not in worker:
        raise ValueError("source_worker_not_security_reviewed")

    html = source_html.replace(
        "<title>HERCULES // COMMAND CENTER</title>",
        "<title>HERCULES // IPHONE PREVIEW</title>",
        1,
    )
    if 'href="/manifest.webmanifest"' not in html:
        raise ValueError("source_manifest_link_missing")
    html = html.replace('href="/manifest.webmanifest"', 'href="/manifest.json"', 1)
    if worker.count(b"/manifest.webmanifest") != 1:
        raise ValueError("source_worker_manifest_cache_unexpected")
    worker = worker.replace(b"/manifest.webmanifest", b"/manifest.json")
    html = html.replace(
        "</head>", (
            '<meta name="robots" content="noindex,nofollow">'
            '<meta http-equiv="Content-Security-Policy" '
            'content="default-src &#39;self&#39;; connect-src &#39;none&#39;; '
            'script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; '
            'worker-src &#39;self&#39;; img-src &#39;self&#39;; object-src &#39;none&#39;; '
            'base-uri &#39;none&#39;; form-action &#39;none&#39;">'
            "</head>"
        ),
        1,
    )
    html = html.replace(
        "<body>",
        ('<body><div id="previewNotice" style="background:#251a14;border-bottom:2px solid #ff6b22;'
         'color:#f4f1e8;padding:14px 5vw;font:700 13px Arial,sans-serif">'
         'PREVIEW ONLY — no live AI, payments, accounts or customer operations. '
         'Layout and home-screen installation test only.</div>'),
        1,
    )
    html = re.sub(r"<script>[\s\S]*?</script>", "<script>\n" + PREVIEW_SCRIPT + "\n</script>", html, count=1)
    html = html.replace('id="chatSend" style=', 'id="chatSend" disabled style=', 1)
    if 'id="chatSend" disabled' not in html:
        raise ValueError("preview_chat_not_disabled")
    if "fetch(" in html or "XMLHttpRequest" in html:
        raise ValueError("preview_network_request_forbidden")

    manifest["name"] = "Hercules — iPhone Preview"
    manifest["short_name"] = "Hercules Preview"
    manifest["start_url"] = "/"
    manifest["display"] = "standalone"
    if {i.get("src") for i in manifest.get("icons", []) if isinstance(i, dict)} != {
        "/app-icon-192.png", "/app-icon-512.png"
    }:
        raise ValueError("unexpected_manifest_icons")

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "index.html").write_text(html, encoding="utf-8")
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (output_dir / "service-worker.js").write_bytes(worker)
    for size in (192, 512):
        (output_dir / f"app-icon-{size}.png").write_bytes(original_h_monogram_icon(size))
    return tuple(sorted(path.name for path in output_dir.iterdir()))


if __name__ == "__main__":
    files = build_preview()
    print("Hercules iPhone static preview prepared (NO live AI, NO deployment).")
    print("\n".join(files))
